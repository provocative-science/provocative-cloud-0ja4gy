"""
Authentication routes module for the Provocative Cloud platform.
Implements secure user authentication endpoints with enhanced security features
including device fingerprinting, rate limiting, and comprehensive audit logging.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from fastapi_limiter.depends import RateLimiter
#from python_audit_logger import AuditLogger

from ..schemas.auth import (
    TokenResponse, GoogleAuthRequest, GoogleAuthResponse,
    JWTPayload, DeviceFingerprint
)
#from ..services.auth_service import (
#    authenticate_user, get_oauth_url, get_user_by_token, validate_device
#)
from ..services.auth_service import AuthService
from ..security.jwt import get_current_user, validate_token_device

# Initialize router with prefix and tags
router = APIRouter(prefix='/auth', tags=['Authentication'])

# Initialize audit logger for authentication events
#audit_logger = AuditLogger()

# Configure rate limiter with IP-based tracking
#rate_limiter = RateLimiter(key_func=lambda r: r.client.host)

# Initialize AuthService instance
from sqlalchemy.orm import Session
from db import SessionLocal
def get_db_session() -> Session:
    """Creates and returns a new database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
db_session = next(get_db_session())  # Manually get a session instance
auth_service = AuthService(db_session=db_session)

from fastapi import FastAPI
from fastapi_limiter import FastAPILimiter
from redis import Redis

# Create your FastAPI app instance
app = FastAPI()

# Initialize FastAPILimiter with Redis and key function
@app.on_event("startup")
async def startup():
    redis = Redis(host="localhost", port=6379, decode_responses=True)  # Adjust Redis connection details
    await FastAPILimiter.init(redis, identifier=lambda request: request.client.host)

@router.get('/login', dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def oauth_login(request: Request, redirect_uri: str) -> dict:
    """
    Generates Google OAuth authorization URL with enhanced security validation.

    Args:
        request: FastAPI request object for IP tracking
        redirect_uri: OAuth callback URI

    Returns:
        dict: Authorization URL and state token

    Raises:
        HTTPException: If validation fails or rate limit exceeded
    """
    try:
        # Log authentication attempt
        audit_logger.info(
            "OAuth login initiated",
            extra={
                "ip_address": request.client.host,
                "user_agent": request.headers.get("user-agent"),
                "redirect_uri": redirect_uri
            }
        )

        # Generate authorization URL with state token
        auth_url = await auth_service.get_oauth_url(redirect_uri)

        return {
            "authorization_url": auth_url,
            "state": request.state.oauth_state
        }

    except Exception as e:
        audit_logger.error(
            "OAuth login failed",
            extra={
                "error": str(e),
                "ip_address": request.client.host
            }
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to generate authorization URL"
        )

@router.post('/callback', dependencies=[Depends(RateLimiter(times=3, seconds=60))])
async def oauth_callback(
    auth_request: GoogleAuthRequest,
    device_info: DeviceFingerprint,
    request: Request,
    db_session: Session = Depends()  # Mark db_session as a dependency
) -> TokenResponse:
    """
    Handles OAuth callback with enhanced security and device validation.
    """
    try:
        # Validate device fingerprint
        await auth_service.validate_device(device_info, request.client.host)

        # Authenticate user with enhanced security
        token_response = await auth_service.authenticate_user(
            auth_request=auth_request,
            db_session=db_session,
            device_fingerprint=device_info.fingerprint_hash,
            ip_address=request.client.host
        )

        # Log successful authentication
        audit_logger.info(
            "OAuth authentication successful",
            extra={
                "device_id": auth_request.device_id,
                "ip_address": request.client.host
            }
        )

        return token_response

    except Exception as e:
        audit_logger.error(
            "OAuth callback failed",
            extra={
                "error": str(e),
                "ip_address": request.client.host
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed"
        )

@router.get('/me')
async def get_me(
    current_user: JWTPayload = Depends(get_current_user),
    db_session: Session = Depends(),  # Inject db_session using Depends
    request: Request = None
) -> dict:
    """
    Returns current authenticated user information with role validation.

    Args:
        current_user: JWT payload from token
        db_session: Database session
        request: FastAPI request object

    Returns:
        dict: Current user data with roles

    Raises:
        HTTPException: If token validation fails
    """
    try:
        # Get user from database with role information
        user = await auth_service.get_user_by_token(
            token=request.headers.get("Authorization").split()[1],
            db_session=db_session,
            device_fingerprint=current_user.device_id,
            ip_address=request.client.host
        )

        # Log access attempt
        audit_logger.info(
            "User info retrieved",
            extra={
                "user_id": str(user.id),
                "ip_address": request.client.host
            }
        )

        return user.to_dict(exclude_fields=["password_hash", "ssh_keys"])

    except Exception as e:
        audit_logger.error(
            "User info retrieval failed",
            extra={
                "error": str(e),
                "ip_address": request.client.host
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Failed to retrieve user information"
        )

@router.post('/verify', dependencies=[Depends(RateLimiter(times=10, seconds=60))])
async def verify_token(
    verify_request: dict,
    device_info: DeviceFingerprint,
    request: Request
) -> dict:
    """
    Verifies JWT token with comprehensive security checks.

    Args:
        verify_request: Token verification request
        device_info: Client device fingerprint
        request: FastAPI request object

    Returns:
        dict: Token verification result

    Raises:
        HTTPException: If token verification fails
    """
    try:
        # Validate token and device binding
        await validate_token_device(
            token=verify_request.get("token"),
            device_fingerprint=device_info.fingerprint_hash
        )

        # Log verification attempt
        audit_logger.info(
            "Token verification successful",
            extra={
                "device_id": device_info.device_id,
                "ip_address": request.client.host
            }
        )

        return {
            "valid": True,
            "message": "Token is valid"
        }

    except Exception as e:
        audit_logger.error(
            "Token verification failed",
            extra={
                "error": str(e),
                "ip_address": request.client.host
            }
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
