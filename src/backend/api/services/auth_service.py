"""
Authentication service module for the Provocative Cloud platform.
Implements secure user authentication, token management, and OAuth integration
with enhanced security features including device fingerprinting and role validation.
"""

import logging
from datetime import datetime
from typing import Optional, Tuple
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session
from redis import Redis

from ..config import settings
from ..security.jwt import create_access_token, decode_token
from ..security.oauth import get_authorization_url, exchange_code, verify_oauth_token
from ..schemas.auth import TokenResponse, GoogleAuthRequest, GoogleAuthResponse, JWTPayload
from ...db.models.user import User

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize Redis client for rate limiting and token blacklist
redis_client = Redis(
    host=settings.REDIS_URL.get_secret_value().split("@")[1].split(":")[0],
    port=int(settings.REDIS_URL.get_secret_value().split(":")[-1]),
    ssl=settings.ENVIRONMENT == "production",
    decode_responses=True
)

# Constants
RATE_LIMIT_PREFIX = "auth_rate_limit:"
DEVICE_LIMIT_PREFIX = "device_limit:"
MAX_DEVICES_PER_USER = 5
RATE_LIMIT_WINDOW = 3600  # 1 hour
IP_RATE_LIMIT = 100  # Requests per hour per IP

async def authenticate_user(
    auth_request: GoogleAuthRequest,
    db_session: Session,
    device_fingerprint: str,
    ip_address: str
) -> TokenResponse:
    """
    Authenticates a user using Google OAuth with enhanced security features.
    
    Args:
        auth_request: OAuth authentication request
        db_session: Database session
        device_fingerprint: Client device fingerprint
        ip_address: Client IP address
    
    Returns:
        TokenResponse: JWT token response with access token
    
    Raises:
        HTTPException: If authentication fails or rate limit exceeded
    """
    try:
        # Check IP rate limiting
        rate_key = f"{RATE_LIMIT_PREFIX}{ip_address}"
        if redis_client.incr(rate_key) > IP_RATE_LIMIT:
            logger.warning(f"Rate limit exceeded for IP: {ip_address}")
            raise HTTPException(
                status_code=429,
                detail="Authentication rate limit exceeded"
            )
        redis_client.expire(rate_key, RATE_LIMIT_WINDOW)

        # Exchange OAuth code for tokens
        oauth_response = await exchange_code(auth_request, device_fingerprint)
        
        # Verify OAuth token
        token_info = await verify_oauth_token(oauth_response.id_token, device_fingerprint)
        
        # Get or create user
        user = await get_or_create_user(
            db_session,
            token_info["sub"],
            token_info["email"],
            device_fingerprint
        )

        # Validate device fingerprint
        await validate_device_fingerprint(user, device_fingerprint)

        # Generate JWT token
        token_response = create_access_token(
            user_id=user.id,
            email=user.email,
            roles=user.roles,
            device_id=auth_request.device_id
        )

        # Log successful authentication
        logger.info(
            "User authenticated successfully",
            extra={
                "user_id": str(user.id),
                "email": user.email,
                "device_id": auth_request.device_id,
                "ip_address": ip_address
            }
        )

        return token_response

    except Exception as e:
        logger.error(
            f"Authentication failed: {str(e)}",
            extra={"ip_address": ip_address}
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )

async def get_oauth_url(redirect_uri: str) -> str:
    """
    Generates Google OAuth authorization URL with security validation.
    
    Args:
        redirect_uri: OAuth redirect URI
    
    Returns:
        str: Authorization URL
    
    Raises:
        HTTPException: If URL generation fails
    """
    try:
        # Validate redirect URI against allowed domains
        if not any(domain in redirect_uri for domain in settings.CORS_ORIGINS):
            raise ValueError("Invalid redirect URI domain")

        return get_authorization_url(redirect_uri)

    except Exception as e:
        logger.error(f"Failed to generate OAuth URL: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Invalid redirect URI"
        )

async def get_user_by_token(
    token: str,
    db_session: Session,
    device_fingerprint: str,
    ip_address: str
) -> User:
    """
    Retrieves user from database using JWT token with enhanced validation.
    
    Args:
        token: JWT token string
        db_session: Database session
        device_fingerprint: Client device fingerprint
        ip_address: Client IP address
    
    Returns:
        User: User database model instance
    
    Raises:
        HTTPException: If token is invalid or user not found
    """
    try:
        # Decode and validate token
        payload = decode_token(token, device_fingerprint)

        # Get user from database
        user = db_session.query(User).filter(
            User.id == payload.sub,
            User.is_active == True
        ).first()

        if not user:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Validate device fingerprint
        if device_fingerprint not in user.device_fingerprints:
            logger.warning(
                "Invalid device fingerprint",
                extra={
                    "user_id": str(user.id),
                    "ip_address": ip_address
                }
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid device fingerprint"
            )

        logger.debug(
            "User retrieved by token",
            extra={
                "user_id": str(user.id),
                "ip_address": ip_address
            }
        )

        return user

    except Exception as e:
        logger.error(
            f"Token validation failed: {str(e)}",
            extra={"ip_address": ip_address}
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

async def verify_user_role(
    user: User,
    required_role: str,
    resource_id: Optional[str] = None
) -> bool:
    """
    Verifies if user has required role with strict hierarchy validation.
    
    Args:
        user: User instance
        required_role: Required role for access
        resource_id: Optional resource identifier for specific permissions
    
    Returns:
        bool: True if user has required role
    
    Raises:
        HTTPException: If role verification fails
    """
    try:
        # Define role hierarchy
        role_hierarchy = {
            "admin": ["admin"],
            "host": ["host", "admin"],
            "user": ["user", "host", "admin"]
        }

        # Validate required role
        if required_role not in role_hierarchy:
            raise ValueError(f"Invalid role: {required_role}")

        # Check user roles against hierarchy
        allowed_roles = role_hierarchy[required_role]
        has_role = any(role in allowed_roles for role in user.roles)

        # Additional resource-specific checks
        if resource_id and has_role:
            # Implement resource-specific permission checks here
            pass

        logger.debug(
            "Role verification completed",
            extra={
                "user_id": str(user.id),
                "required_role": required_role,
                "has_role": has_role
            }
        )

        return has_role

    except Exception as e:
        logger.error(f"Role verification failed: {str(e)}")
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions"
        )

async def get_or_create_user(
    db_session: Session,
    google_id: str,
    email: str,
    device_fingerprint: str
) -> User:
    """
    Gets existing user or creates new user with secure defaults.
    
    Args:
        db_session: Database session
        google_id: Google user ID
        email: User email
        device_fingerprint: Client device fingerprint
    
    Returns:
        User: User database model instance
    """
    try:
        # Check for existing user
        user = db_session.query(User).filter(
            User.google_id == google_id
        ).first()

        if user:
            # Update existing user
            user.email = email
            user.last_login = datetime.utcnow()
            if device_fingerprint not in user.device_fingerprints:
                user.device_fingerprints.append(device_fingerprint)
        else:
            # Create new user
            user = User(
                id=uuid4(),
                google_id=google_id,
                email=email,
                roles=["user"],
                device_fingerprints=[device_fingerprint],
                last_login=datetime.utcnow()
            )
            db_session.add(user)

        db_session.commit()
        return user

    except Exception as e:
        db_session.rollback()
        logger.error(f"User creation failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create user"
        )

async def validate_device_fingerprint(
    user: User,
    device_fingerprint: str
) -> None:
    """
    Validates device fingerprint against user's registered devices.
    
    Args:
        user: User instance
        device_fingerprint: Client device fingerprint
    
    Raises:
        HTTPException: If device validation fails
    """
    try:
        # Check device limit
        if (
            device_fingerprint not in user.device_fingerprints and
            len(user.device_fingerprints) >= MAX_DEVICES_PER_USER
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Maximum of {MAX_DEVICES_PER_USER} devices allowed"
            )

        # Rate limit device additions
        device_key = f"{DEVICE_LIMIT_PREFIX}{user.id}"
        if redis_client.incr(device_key) > MAX_DEVICES_PER_USER:
            raise HTTPException(
                status_code=429,
                detail="Device addition rate limit exceeded"
            )
        redis_client.expire(device_key, RATE_LIMIT_WINDOW)

    except Exception as e:
        logger.error(f"Device validation failed: {str(e)}")
        raise HTTPException(
            status_code=400,
            detail="Device validation failed"
        )