"""
Utility module for authentication and authorization in the Provocative Cloud platform.
Implements role-based access control and WebSocket token validation.
"""

from functools import wraps
from typing import Callable
from fastapi import HTTPException, Depends, WebSocket, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from api.security.jwt import get_current_user
from api.schemas.auth import JWTPayload
from api.config import settings

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")


def require_role(required_role: str) -> Callable:
    """
    Decorator to enforce role-based access control on endpoints.

    Args:
        required_role: Required role for accessing the endpoint

    Returns:
        Callable: Decorated endpoint with role validation

    Raises:
        HTTPException: If the user does not have the required role
    """
    def decorator(endpoint_func: Callable) -> Callable:
        @wraps(endpoint_func)
        async def wrapper(*args, current_user: JWTPayload = Depends(get_current_user), **kwargs):
            if required_role not in current_user.roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions"
                )
            return await endpoint_func(*args, **kwargs)
        return wrapper
    return decorator


async def validate_websocket_token(websocket: WebSocket, token: str = Depends(oauth2_scheme)) -> None:
    """
    Validates the JWT token for WebSocket connections.

    Args:
        websocket: WebSocket connection
        token: JWT token extracted from the WebSocket request

    Raises:
        HTTPException: If the token is invalid or expired
    """
    try:
        # Decode and validate the token
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY.get_secret_value(),
            algorithms=[settings.JWT_ALGORITHM]
        )
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

        # Attach user ID to the WebSocket state for further use
        websocket.state.user_id = user_id

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        ) from e

