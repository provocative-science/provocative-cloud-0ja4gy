"""
Main entry point for the security module that consolidates authentication, authorization,
and permission management functionality for the Provocative Cloud platform.

This module provides comprehensive security features including:
- JWT token handling with fingerprinting
- Google OAuth2.0 integration with OpenID Connect
- Role-based access control (RBAC)
- Rate limiting
- Audit logging
- WebSocket security
"""

from datetime import timedelta
import logging
from typing import Optional

from fastapi import Depends, HTTPException, Security
from fastapi.security import SecurityScopes

# Import JWT functionality
from .jwt import (
    create_access_token,
    decode_token,
    verify_token,
    get_current_user,
    oauth2_scheme,
    validate_token_fingerprint
)

# Import OAuth functionality
from .oauth import (
    GoogleOAuth,
    get_authorization_url,
    exchange_code,
    verify_oauth_token
)

# Import RBAC functionality
from .permissions import (
    require_role,
    check_permission,
    get_user_permissions,
    ROLE_USER,
    ROLE_HOST,
    ROLE_ADMIN,
    ROLE_HIERARCHY
)

# Configure logging
logger = logging.getLogger(__name__)

# Export all security components
__all__ = [
    # JWT components
    "create_access_token",
    "decode_token",
    "verify_token",
    "get_current_user",
    "oauth2_scheme",
    "validate_token_fingerprint",
    
    # OAuth components
    "GoogleOAuth",
    "get_authorization_url",
    "exchange_code",
    "verify_oauth_token",
    
    # RBAC components
    "require_role",
    "check_permission",
    "get_user_permissions",
    "ROLE_USER",
    "ROLE_HOST",
    "ROLE_ADMIN",
    "ROLE_HIERARCHY"
]

# Default token expiration
DEFAULT_TOKEN_EXPIRY = timedelta(hours=24)

async def get_authenticated_user(
    security_scopes: SecurityScopes,
    token: str = Depends(oauth2_scheme),
    fingerprint: Optional[str] = None
):
    """
    Enhanced FastAPI dependency for authenticated user access with comprehensive security checks.
    
    Args:
        security_scopes: Required security scopes
        token: JWT token from request
        fingerprint: Token fingerprint for validation
        
    Returns:
        JWTPayload: Validated user information
        
    Raises:
        HTTPException: If authentication fails or insufficient permissions
    """
    try:
        # Validate token and fingerprint
        if not fingerprint:
            raise HTTPException(
                status_code=401,
                detail="Token fingerprint required"
            )
            
        # Get user from token
        user = await get_current_user(
            security_scopes=security_scopes,
            credentials=token,
            fingerprint=fingerprint
        )
        
        # Verify required scopes
        if security_scopes.scopes:
            user_permissions = get_user_permissions(user)
            for scope in security_scopes.scopes:
                if scope not in user_permissions:
                    logger.warning(
                        f"Insufficient permissions for user {user.sub}",
                        extra={
                            "user_id": str(user.sub),
                            "required_scopes": security_scopes.scopes,
                            "user_permissions": list(user_permissions)
                        }
                    )
                    raise HTTPException(
                        status_code=403,
                        detail="Insufficient permissions"
                    )
        
        logger.info(
            f"Authentication successful for user {user.sub}",
            extra={
                "user_id": str(user.sub),
                "scopes": security_scopes.scopes
            }
        )
        
        return user
        
    except Exception as e:
        logger.error(
            f"Authentication failed: {str(e)}",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=401,
            detail="Authentication failed"
        )

async def verify_websocket_token(
    token: str,
    fingerprint: str
) -> bool:
    """
    Verifies JWT token for WebSocket connections with enhanced security.
    
    Args:
        token: JWT token from WebSocket request
        fingerprint: Token fingerprint for validation
        
    Returns:
        bool: True if token is valid
        
    Raises:
        HTTPException: If token validation fails
    """
    try:
        # Verify token with fingerprint
        is_valid = verify_token(token, fingerprint)
        
        if not is_valid:
            logger.warning(
                "Invalid WebSocket token",
                extra={"token_fingerprint": fingerprint}
            )
            return False
            
        # Decode token for logging
        payload = decode_token(token, fingerprint)
        
        logger.info(
            f"WebSocket token verified for user {payload.sub}",
            extra={
                "user_id": str(payload.sub),
                "token_fingerprint": fingerprint
            }
        )
        
        return True
        
    except Exception as e:
        logger.error(
            f"WebSocket token verification failed: {str(e)}",
            extra={"error": str(e)}
        )
        return False