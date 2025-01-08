#!/usr/bin/env python3
"""
Admin user creation script for Provocative Cloud platform.
Creates an admin user with full system access privileges and enhanced security controls.
Version: 1.0.0
"""

import argparse
import asyncio
import logging
import sys
from typing import Optional
from uuid import uuid4

from email_validator import validate_email, EmailNotValidError
from password_validator import PasswordValidator
from rate_limit import RateLimiter

from db.models.user import User
from db.session import SessionLocal
from api.services.user_service import UserService

# Constants for script configuration
ADMIN_ROLE = "admin"
MAX_RETRIES = 3
RATE_LIMIT_PERIOD = 3600  # 1 hour
MAX_ATTEMPTS = 5
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Configure password validation schema
password_schema = PasswordValidator()
password_schema.min(12)\
    .max(128)\
    .has().uppercase()\
    .has().lowercase()\
    .has().digits()\
    .has().symbols()\
    .has().no().spaces()

def setup_logging() -> logging.Logger:
    """Configure logging with proper formatting and handlers."""
    logger = logging.getLogger("admin_creation")
    logger.setLevel(logging.INFO)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(console_handler)

    # File handler for audit logging
    file_handler = logging.FileHandler("admin_creation.log")
    file_handler.setFormatter(logging.Formatter(LOG_FORMAT))
    logger.addHandler(file_handler)

    return logger

def parse_args() -> argparse.Namespace:
    """Parse and validate command line arguments."""
    parser = argparse.ArgumentParser(
        description="Create an admin user for Provocative Cloud platform"
    )
    
    parser.add_argument(
        "--email",
        required=True,
        help="Admin user email address"
    )
    
    parser.add_argument(
        "--password",
        required=True,
        help="Admin user password (min 12 chars, must include upper, lower, number, symbol)"
    )
    
    parser.add_argument(
        "--enable-mfa",
        action="store_true",
        help="Enable Multi-Factor Authentication"
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="Skip confirmation prompts"
    )

    return parser.parse_args()

def validate_inputs(email: str, password: str) -> bool:
    """Validate user inputs for security and format compliance."""
    try:
        # Validate email format
        validate_email(email, check_deliverability=True)
        
        # Validate password strength
        if not password_schema.validate(password):
            raise ValueError("Password does not meet security requirements")
        
        # Check for restricted patterns
        restricted_patterns = ["admin", "root", "system", "superuser"]
        if any(pattern in email.lower() for pattern in restricted_patterns):
            raise ValueError("Email contains restricted patterns")
            
        return True
        
    except EmailNotValidError as e:
        logging.error(f"Invalid email format: {str(e)}")
        return False
    except ValueError as e:
        logging.error(f"Validation error: {str(e)}")
        return False

async def create_admin(
    email: str,
    password: str,
    enable_mfa: bool = False
) -> Optional[User]:
    """Create an admin user with full system access and security controls."""
    logger = logging.getLogger("admin_creation")
    db = SessionLocal()
    
    try:
        # Initialize UserService
        user_service = UserService(
            db=db,
            audit_logger=logger,
            rate_limiter=RateLimiter(MAX_ATTEMPTS, RATE_LIMIT_PERIOD)
        )
        
        # Create user data
        user_data = {
            "id": uuid4(),
            "email": email,
            "google_id": f"admin_{uuid4().hex}",  # Placeholder for admin users
            "roles": [ADMIN_ROLE],
            "is_active": True
        }
        
        # Validate user data
        if not await user_service.validate_user_data(user_data):
            raise ValueError("Invalid user data")
            
        # Create admin user with retries
        retries = 0
        while retries < MAX_RETRIES:
            try:
                user = await user_service.create_user(user_data)
                
                # Set up MFA if enabled
                if enable_mfa:
                    await user_service.enable_mfa(user.id)
                    
                # Log successful creation
                logger.info(
                    f"Admin user created successfully: {email}",
                    extra={
                        "user_id": str(user.id),
                        "roles": user.roles,
                        "mfa_enabled": enable_mfa
                    }
                )
                
                await db.commit()
                return user
                
            except Exception as e:
                retries += 1
                logger.warning(
                    f"Retry {retries}/{MAX_RETRIES} failed: {str(e)}",
                    extra={"email": email}
                )
                await db.rollback()
                
                if retries >= MAX_RETRIES:
                    raise
                
                await asyncio.sleep(1 * retries)  # Exponential backoff
                
    except Exception as e:
        logger.error(
            f"Failed to create admin user: {str(e)}",
            extra={"email": email},
            exc_info=True
        )
        await db.rollback()
        raise
        
    finally:
        await db.close()

async def main() -> int:
    """Main entry point for admin user creation script."""
    logger = setup_logging()
    args = parse_args()
    
    try:
        # Validate inputs
        if not validate_inputs(args.email, args.password):
            return 1
            
        # Confirm admin creation
        if not args.force:
            confirm = input(
                f"Create admin user with email {args.email}? [y/N]: "
            ).lower()
            if confirm != 'y':
                logger.info("Admin creation cancelled by user")
                return 0
                
        # Create admin user
        user = await create_admin(
            email=args.email,
            password=args.password,
            enable_mfa=args.enable_mfa
        )
        
        if user:
            print(f"Admin user created successfully: {user.email}")
            print(f"User ID: {user.id}")
            print(f"MFA Enabled: {args.enable_mfa}")
            return 0
        else:
            print("Failed to create admin user")
            return 1
            
    except Exception as e:
        logger.error(f"Script execution failed: {str(e)}", exc_info=True)
        return 1
        
    finally:
        # Clean up resources
        handlers = logger.handlers[:]
        for handler in handlers:
            handler.close()
            logger.removeHandler(handler)

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))