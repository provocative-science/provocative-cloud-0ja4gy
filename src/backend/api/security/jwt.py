"""
JWT token generation, validation and user authentication module for the Provocative Cloud platform.
Implements secure token handling, user session management, and comprehensive security controls with audit logging.
"""

from datetime import datetime, timedelta
import hashlib
import logging
import uuid

from fastapi import HTTPException, Depends, Security
from fastapi.security import SecurityScopes, HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from redis import Redis

from ..config import settings
from ..schemas.auth import JWTPayload, TokenResponse

# Constants
TOKEN_BLACKLIST_PREFIX = "token_blacklist:"
RATE_LIMIT_PREFIX = "rate_limit:"
TOKEN_RATE_LIMIT = 10  # Tokens per minute per user
TOKEN_BLACKLIST_TTL = 86400  # 24 hours in seconds

# Initialize components
oauth2_scheme = HTTPBearer(auto_error=True)
redis_client = Redis(
    host=settings.REDIS_URL.get_secret_value().split("@")[1].split(":")[0],
    port=int(settings.REDIS_URL.get_secret_value().split(":")[-1]),
    ssl=settings.ENVIRONMENT == "production",
    decode_responses=True
)
logger = logging.getLogger(__name__)

def create_access_token(
    user_id: uuid.UUID,
    email: str,
    roles: list[str],
    device_id: str
) -> TokenResponse:
    """
    Creates a new JWT access token with enhanced security features.
    
    Args:
        user_id: User's unique identifier
        email: User's email address
        roles: List of user roles
        device_id: Unique device identifier
    
    Returns:
        TokenResponse containing access token, expiration and fingerprint
    
    Raises:
        HTTPException: If rate limit exceeded or token generation fails
    """
    try:
        # Check rate limiting
        rate_key = f"{RATE_LIMIT_PREFIX}{user_id}"
        if redis_client.incr(rate_key) > TOKEN_RATE_LIMIT:
            raise HTTPException(
                status_code=429,
                detail="Token generation rate limit exceeded"
            )
        redis_client.expire(rate_key, 60)  # Reset after 1 minute

        # Generate token fingerprint
        fingerprint = hashlib.sha256(
            f"{device_id}:{datetime.utcnow().timestamp()}".encode()
        ).hexdigest()

        # Set token expiration
        expires_delta = timedelta(minutes=settings.JWT_TOKEN_EXPIRE_MINUTES)
        expire = datetime.utcnow() + expires_delta

        # Create JWT payload
        payload = {
            "sub": str(user_id),
            "email": email,
            "roles": roles,
            "exp": expire.timestamp(),
            "device_id": device_id,
            "fingerprint": fingerprint,
            "session_id": str(uuid.uuid4())
        }

        # Generate token
        access_token = jwt.encode(
            payload,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithm=settings.JWT_ALGORITHM
        )

        logger.info(
            f"Token generated for user {user_id}",
            extra={
                "user_id": str(user_id),
                "device_id": device_id,
                "roles": roles
            }
        )

        return TokenResponse(
            access_token=access_token,
            expires_at=expire,
            token_fingerprint=fingerprint
        )

    except Exception as e:
        logger.error(
            f"Token generation failed: {str(e)}",
            extra={"user_id": str(user_id)}
        )
        raise HTTPException(
            status_code=500,
            detail="Error generating access token"
        )

def decode_token(token: str, fingerprint: str) -> JWTPayload:
    """
    Decodes and validates JWT token with comprehensive security checks.
    
    Args:
        token: JWT token string
        fingerprint: Token fingerprint for validation
    
    Returns:
        JWTPayload containing validated user information
    
    Raises:
        HTTPException: If token is invalid, expired, or blacklisted
    """
    try:
        # Check token blacklist
        if redis_client.exists(f"{TOKEN_BLACKLIST_PREFIX}{token}"):
            raise HTTPException(
                status_code=401,
                detail="Token has been revoked"
            )

        # Decode token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithms=[settings.JWT_ALGORITHM]
        )

        # Validate expiration
        if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
            raise HTTPException(
                status_code=401,
                detail="Token has expired"
            )

        # Verify fingerprint
        if payload.get("fingerprint") != fingerprint:
            raise HTTPException(
                status_code=401,
                detail="Invalid token fingerprint"
            )

        # Convert to JWTPayload model
        jwt_payload = JWTPayload(
            sub=uuid.UUID(payload["sub"]),
            email=payload["email"],
            roles=payload["roles"],
            exp=datetime.fromtimestamp(payload["exp"]),
            device_id=payload["device_id"],
            session_id=payload["session_id"]
        )

        logger.debug(
            f"Token decoded for user {jwt_payload.sub}",
            extra={
                "user_id": str(jwt_payload.sub),
                "device_id": jwt_payload.device_id
            }
        )

        return jwt_payload

    except JWTError as e:
        logger.warning(
            f"Token validation failed: {str(e)}",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token"
        )

async def get_current_user(
    security_scopes: SecurityScopes,
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    fingerprint: str = None
) -> JWTPayload:
    """
    FastAPI dependency for authenticated user with enhanced security.
    
    Args:
        security_scopes: Required security scopes
        credentials: Bearer token credentials
        fingerprint: Token fingerprint for validation
    
    Returns:
        JWTPayload containing current user information
    
    Raises:
        HTTPException: If authentication fails or insufficient permissions
    """
    if not fingerprint:
        raise HTTPException(
            status_code=401,
            detail="Token fingerprint required"
        )

    try:
        # Decode and validate token
        payload = decode_token(credentials.credentials, fingerprint)

        # Verify security scopes
        if security_scopes.scopes:
            for scope in security_scopes.scopes:
                if scope not in payload.roles:
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions"
                    )

        logger.info(
            f"Access granted to user {payload.sub}",
            extra={
                "user_id": str(payload.sub),
                "scopes": security_scopes.scopes,
                "device_id": payload.device_id
            }
        )

        return payload

    except Exception as e:
        logger.error(
            f"Authentication failed: {str(e)}",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )