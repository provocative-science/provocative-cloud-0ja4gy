"""
User service implementation for Provocative Cloud platform.
Handles user management operations with enhanced security features and audit logging.
Version: 1.0.0
"""

from datetime import datetime
import logging
from typing import Dict, Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from cryptography.hazmat.primitives.serialization import validate_ssh_key
from python_audit_logger import AuditLogger

from db.models.user import User
from api.security.oauth import verify_oauth_token, exchange_code
from api.services.stripe_service import StripeService
from api.utils.logger import get_logger

# Constants
MAX_SSH_KEYS_PER_USER = 5
DEFAULT_USER_ROLE = "user"
ALLOWED_SSH_KEY_TYPES = ["ssh-rsa", "ssh-ed25519", "ecdsa-sha2-nistp256"]

class UserService:
    """Enhanced service class for managing user operations with security features."""

    def __init__(self, db: Session, audit_logger: AuditLogger, rate_limiter: Optional[object] = None) -> None:
        """
        Initialize user service with enhanced security features.

        Args:
            db: Database session
            audit_logger: Audit logging instance
            rate_limiter: Optional rate limiting service
        """
        self.db = db
        self.stripe_service = StripeService()
        self.audit_logger = audit_logger
        self.rate_limiter = rate_limiter
        self.logger = get_logger(__name__, {"service": "user"})

    async def create_user(self, oauth_data: Dict) -> User:
        """
        Creates a new user with enhanced security validation.

        Args:
            oauth_data: Validated Google OAuth data

        Returns:
            Created user instance

        Raises:
            HTTPException: If user creation fails or validation errors occur
        """
        try:
            # Verify OAuth token
            verified_data = await verify_oauth_token(oauth_data["id_token"], oauth_data["request"])
            
            # Check for existing user
            existing_user = self.db.query(User).filter(
                User.email == verified_data["email"]
            ).first()
            
            if existing_user:
                self.logger.info(
                    "User already exists",
                    extra={"email": verified_data["email"]}
                )
                raise HTTPException(
                    status_code=400,
                    detail="User already exists"
                )

            # Create Stripe customer
            stripe_customer = await self.stripe_service.create_customer({
                "email": verified_data["email"],
                "metadata": {
                    "google_id": verified_data["sub"],
                    "created_at": datetime.utcnow().isoformat()
                }
            })

            # Create new user
            new_user = User(
                email=verified_data["email"],
                google_id=verified_data["sub"],
                stripe_customer_id=stripe_customer["id"],
                roles=[DEFAULT_USER_ROLE],
                ssh_keys={},
                last_login=datetime.utcnow()
            )

            # Save to database
            self.db.add(new_user)
            self.db.commit()
            self.db.refresh(new_user)

            # Audit log
            self.audit_logger.log_event(
                "user_created",
                user_id=str(new_user.id),
                email=new_user.email,
                roles=new_user.roles
            )

            self.logger.info(
                "User created successfully",
                extra={
                    "user_id": str(new_user.id),
                    "email": new_user.email
                }
            )

            return new_user

        except IntegrityError as e:
            self.logger.error(
                "Database integrity error during user creation",
                extra={"error": str(e)}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=400,
                detail="User creation failed due to data integrity error"
            )

        except Exception as e:
            self.logger.error(
                "User creation failed",
                extra={"error": str(e)}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="User creation failed"
            )

    async def add_ssh_key(self, user_id: UUID, key_name: str, key_value: str) -> User:
        """
        Securely adds and validates SSH key.

        Args:
            user_id: User's UUID
            key_name: Name identifier for the SSH key
            key_value: The SSH public key value

        Returns:
            Updated user instance

        Raises:
            HTTPException: If key validation fails or limits exceeded
        """
        try:
            # Rate limit check
            if self.rate_limiter:
                await self.rate_limiter.check_rate_limit(f"ssh_key:{user_id}")

            # Get user
            user = self.db.query(User).filter(User.id == user_id).first()
            if not user:
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )

            # Validate key limit
            if len(user.ssh_keys) >= MAX_SSH_KEYS_PER_USER:
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum of {MAX_SSH_KEYS_PER_USER} SSH keys allowed"
                )

            # Validate key format
            try:
                validate_ssh_key(key_value.encode())
            except Exception:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid SSH key format"
                )

            # Check key type
            key_type = key_value.split()[0]
            if key_type not in ALLOWED_SSH_KEY_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported SSH key type. Allowed types: {', '.join(ALLOWED_SSH_KEY_TYPES)}"
                )

            # Add key
            success = user.add_ssh_key(key_name, key_value)
            if not success:
                raise HTTPException(
                    status_code=400,
                    detail="Failed to add SSH key"
                )

            # Save changes
            self.db.commit()
            self.db.refresh(user)

            # Audit log
            self.audit_logger.log_event(
                "ssh_key_added",
                user_id=str(user.id),
                key_name=key_name,
                key_type=key_type
            )

            self.logger.info(
                "SSH key added successfully",
                extra={
                    "user_id": str(user.id),
                    "key_name": key_name
                }
            )

            return user

        except HTTPException:
            raise

        except Exception as e:
            self.logger.error(
                "SSH key addition failed",
                extra={
                    "user_id": str(user_id),
                    "error": str(e)
                }
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to add SSH key"
            )