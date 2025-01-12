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
#from ...db.models.user import User
from db.models.user import User

from urllib.parse import urlparse

# Initialize logging
logger = logging.getLogger(__name__)

# Initialize Redis client for rate limiting and token blacklist
redis_url = urlparse(settings.REDIS_URL.get_secret_value())
redis_client = Redis(
    host=redis_url.hostname,
    port=redis_url.port,
    password=redis_url.password,
    ssl=settings.ENVIRONMENT == "production",
    decode_responses=True
)

# Constants
RATE_LIMIT_PREFIX = "auth_rate_limit:"
DEVICE_LIMIT_PREFIX = "device_limit:"
MAX_DEVICES_PER_USER = 5
RATE_LIMIT_WINDOW = 3600  # 1 hour
IP_RATE_LIMIT = 100  # Requests per hour per IP


class AuthService:
    """Class-based authentication service for managing user authentication and token handling."""

    def __init__(self, db_session: Session):
        self.db_session = db_session

    async def authenticate_user(
        self,
        auth_request: GoogleAuthRequest,
        device_fingerprint: str,
        ip_address: str
    ) -> TokenResponse:
        """Authenticates a user using Google OAuth with enhanced security features."""
        try:
            rate_key = f"{RATE_LIMIT_PREFIX}{ip_address}"
            if redis_client.incr(rate_key) > IP_RATE_LIMIT:
                logger.warning(f"Rate limit exceeded for IP: {ip_address}")
                raise HTTPException(
                    status_code=429, detail="Authentication rate limit exceeded"
                )
            redis_client.expire(rate_key, RATE_LIMIT_WINDOW)

            oauth_response = await exchange_code(auth_request, device_fingerprint)
            token_info = await verify_oauth_token(oauth_response.id_token, device_fingerprint)

            user = await self.get_or_create_user(
                token_info["sub"], token_info["email"], device_fingerprint
            )
            await self.validate_device_fingerprint(user, device_fingerprint)

            token_response = create_access_token(
                user_id=user.id,
                email=user.email,
                roles=user.roles,
                device_id=auth_request.device_id
            )

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
                f"Authentication failed: {str(e)}", extra={"ip_address": ip_address}
            )
            raise HTTPException(status_code=401, detail="Authentication failed")

    async def get_oauth_url(self, redirect_uri: str) -> str:
        """Generates Google OAuth authorization URL with security validation."""
        try:
            if not any(domain in redirect_uri for domain in settings.CORS_ORIGINS):
                raise ValueError("Invalid redirect URI domain")

            return get_authorization_url(redirect_uri)

        except Exception as e:
            logger.error(f"Failed to generate OAuth URL: {str(e)}")
            raise HTTPException(status_code=400, detail="Invalid redirect URI")

    async def get_user_by_token(
        self, token: str, device_fingerprint: str, ip_address: str
    ) -> User:
        """Retrieves user from database using JWT token with enhanced validation."""
        try:
            payload = decode_token(token, device_fingerprint)

            user = self.db_session.query(User).filter(
                User.id == payload.sub, User.is_active == True
            ).first()

            if not user:
                raise HTTPException(status_code=404, detail="User not found")

            if device_fingerprint not in user.device_fingerprints:
                logger.warning(
                    "Invalid device fingerprint",
                    extra={"user_id": str(user.id), "ip_address": ip_address},
                )
                raise HTTPException(status_code=401, detail="Invalid device fingerprint")

            logger.debug(
                "User retrieved by token",
                extra={"user_id": str(user.id), "ip_address": ip_address},
            )
            return user

        except Exception as e:
            logger.error(
                f"Token validation failed: {str(e)}", extra={"ip_address": ip_address}
            )
            raise HTTPException(status_code=401, detail="Invalid authentication token")

    async def verify_user_role(
        self, user: User, required_role: str, resource_id: Optional[str] = None
    ) -> bool:
        """Verifies if user has required role with strict hierarchy validation."""
        try:
            role_hierarchy = {
                "admin": ["admin"],
                "host": ["host", "admin"],
                "user": ["user", "host", "admin"],
            }

            if required_role not in role_hierarchy:
                raise ValueError(f"Invalid role: {required_role}")

            allowed_roles = role_hierarchy[required_role]
            has_role = any(role in allowed_roles for role in user.roles)

            if resource_id and has_role:
                pass  # Implement resource-specific permission checks

            logger.debug(
                "Role verification completed",
                extra={
                    "user_id": str(user.id),
                    "required_role": required_role,
                    "has_role": has_role,
                },
            )

            return has_role

        except Exception as e:
            logger.error(f"Role verification failed: {str(e)}")
            raise HTTPException(status_code=403, detail="Insufficient permissions")

    async def get_or_create_user(
        self, google_id: str, email: str, device_fingerprint: str
    ) -> User:
        """Gets existing user or creates new user with secure defaults."""
        try:
            user = self.db_session.query(User).filter(User.google_id == google_id).first()

            if user:
                user.email = email
                user.last_login = datetime.utcnow()
                if device_fingerprint not in user.device_fingerprints:
                    user.device_fingerprints.append(device_fingerprint)
            else:
                user = User(
                    id=uuid4(),
                    google_id=google_id,
                    email=email,
                    roles=["user"],
                    device_fingerprints=[device_fingerprint],
                    last_login=datetime.utcnow(),
                )
                self.db_session.add(user)

            self.db_session.commit()
            return user

        except Exception as e:
            self.db_session.rollback()
            logger.error(f"User creation failed: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to create user")

    async def validate_device_fingerprint(self, user: User, device_fingerprint: str) -> None:
        """Validates device fingerprint against user's registered devices."""
        try:
            if (
                device_fingerprint not in user.device_fingerprints
                and len(user.device_fingerprints) >= MAX_DEVICES_PER_USER
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum of {MAX_DEVICES_PER_USER} devices allowed",
                )

            device_key = f"{DEVICE_LIMIT_PREFIX}{user.id}"
            if redis_client.incr(device_key) > MAX_DEVICES_PER_USER:
                raise HTTPException(
                    status_code=429, detail="Device addition rate limit exceeded"
                )
            redis_client.expire(device_key, RATE_LIMIT_WINDOW)

        except Exception as e:
            logger.error(f"Device validation failed: {str(e)}")
            raise HTTPException(status_code=400, detail="Device validation failed")
