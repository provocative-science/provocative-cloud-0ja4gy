"""
Role-based access control (RBAC) and permission management for the Provocative Cloud platform.
Implements secure permission validation, caching, and audit logging with role hierarchy support.
"""

from functools import wraps
import logging
from typing import Callable, Set

from fastapi import HTTPException, Depends
from cachetools import Cache, TTLCache

from .jwt import get_current_user
from ..schemas.auth import JWTPayload

# Role constants
ROLE_USER = "user"
ROLE_HOST = "host"
ROLE_ADMIN = "admin"

# Role hierarchy mapping - higher roles inherit lower role permissions
ROLE_HIERARCHY = {
    "admin": ["host", "user"],
    "host": ["user"],
    "user": []
}

# Cache settings
PERMISSION_CACHE_TTL = 300  # 5 minutes
MAX_PERMISSION_CHECKS_PER_MINUTE = 1000

# Initialize components
permission_cache = TTLCache(maxsize=10000, ttl=PERMISSION_CACHE_TTL)
logger = logging.getLogger(__name__)

def check_permission(user: JWTPayload, required_role: str) -> bool:
    """
    Enhanced permission checking with caching and audit logging.
    
    Args:
        user: JWT payload containing user information
        required_role: Role required for access
        
    Returns:
        bool: True if user has required role or higher
    """
    # Check cache first
    cache_key = f"{user.sub}:{required_role}"
    if cache_key in permission_cache:
        return permission_cache[cache_key]

    try:
        # Validate user roles
        if not user.roles:
            logger.warning(
                f"No roles found for user {user.sub}",
                extra={"user_id": str(user.sub)}
            )
            return False

        # Check direct role match
        has_permission = required_role in user.roles

        # Check role hierarchy
        if not has_permission:
            for role in user.roles:
                if required_role in ROLE_HIERARCHY.get(role, []):
                    has_permission = True
                    break

        # Cache result
        permission_cache[cache_key] = has_permission

        # Audit logging
        logger.info(
            f"Permission check for user {user.sub}: {required_role} -> {has_permission}",
            extra={
                "user_id": str(user.sub),
                "required_role": required_role,
                "user_roles": user.roles,
                "result": has_permission
            }
        )

        return has_permission

    except Exception as e:
        logger.error(
            f"Permission check failed: {str(e)}",
            extra={
                "user_id": str(user.sub),
                "required_role": required_role,
                "error": str(e)
            }
        )
        return False

def get_user_permissions(user: JWTPayload) -> Set[str]:
    """
    Gets all effective permissions with inheritance and caching.
    
    Args:
        user: JWT payload containing user information
        
    Returns:
        Set[str]: Set of all effective permissions with inheritance
    """
    # Check cache first
    cache_key = f"permissions:{user.sub}"
    if cache_key in permission_cache:
        return permission_cache[cache_key]

    try:
        # Start with direct roles
        permissions = set(user.roles)

        # Add inherited permissions
        for role in user.roles:
            permissions.update(ROLE_HIERARCHY.get(role, []))

        # Cache permissions
        permission_cache[cache_key] = permissions

        # Audit logging
        logger.info(
            f"Resolved permissions for user {user.sub}",
            extra={
                "user_id": str(user.sub),
                "base_roles": user.roles,
                "effective_permissions": list(permissions)
            }
        )

        return permissions

    except Exception as e:
        logger.error(
            f"Permission resolution failed: {str(e)}",
            extra={
                "user_id": str(user.sub),
                "error": str(e)
            }
        )
        return set()

def require_role(required_role: str) -> Callable:
    """
    Enhanced decorator for role-based endpoint protection with audit logging.
    
    Args:
        required_role: Role required to access the endpoint
        
    Returns:
        Callable: Decorated function with role check
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from JWT token
            user = await get_current_user(
                security_scopes=None,
                credentials=kwargs.get("credentials"),
                fingerprint=kwargs.get("fingerprint")
            )

            # Check permissions with caching
            if not check_permission(user, required_role):
                logger.warning(
                    f"Access denied for user {user.sub} - required role: {required_role}",
                    extra={
                        "user_id": str(user.sub),
                        "required_role": required_role,
                        "user_roles": user.roles,
                        "endpoint": func.__name__
                    }
                )
                raise HTTPException(
                    status_code=403,
                    detail=f"Insufficient permissions. Required role: {required_role}"
                )

            # Log successful access
            logger.info(
                f"Access granted to {func.__name__} for user {user.sub}",
                extra={
                    "user_id": str(user.sub),
                    "endpoint": func.__name__,
                    "required_role": required_role
                }
            )

            return await func(*args, **kwargs)
        return wrapper
    return decorator