"""
FastAPI router module for user-related endpoints in the Provocative Cloud platform.
Implements secure user profile management, SSH key management, and role-based access control
with comprehensive validation and audit logging.
Version: 1.0.0
"""

from typing import Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi_limiter import RateLimiter
from cryptography.hazmat.primitives.asymmetric.rsa import SSHKey
from python_audit_logger import AuditLogger

from api.schemas.user import UserCreate, UserUpdate, UserResponse
from api.services.user_service import UserService
from api.dependencies import get_current_active_user, get_user_service
from api.utils.logger import get_logger

# Initialize router with prefix and tags
router = APIRouter(prefix='/users', tags=['users'])

# Constants for rate limiting and SSH key validation
SSH_KEY_MIN_LENGTH = 2048
SSH_KEY_MAX_LENGTH = 4096
RATE_LIMIT_ATTEMPTS = 5
RATE_LIMIT_WINDOW = 300  # 5 minutes

# Initialize logger
logger = get_logger(__name__, {"service": "users"})

# Initialize rate limiters
rate_limiter = RateLimiter(
    key_func=lambda: "users",
    max_requests=RATE_LIMIT_ATTEMPTS,
    window_seconds=RATE_LIMIT_WINDOW
)

@router.get('/me', response_model=UserResponse)
async def get_current_user(
    current_user: UserResponse = Depends(get_current_active_user),
    _rate_limit: bool = Depends(rate_limiter)
) -> UserResponse:
    """
    Retrieve current authenticated user's profile with rate limiting.
    
    Args:
        current_user: Currently authenticated user from JWT token
        _rate_limit: Rate limiting dependency
        
    Returns:
        UserResponse: Current user's profile data
        
    Raises:
        HTTPException: If rate limit exceeded or user not found
    """
    try:
        logger.info(
            "Profile retrieved",
            extra={"user_id": str(current_user.id)}
        )
        return current_user
        
    except Exception as e:
        logger.error(
            "Profile retrieval failed",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user profile"
        )

@router.patch('/me', response_model=UserResponse)
async def update_user_profile(
    user_data: UserUpdate,
    current_user: UserResponse = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
    _rate_limit: bool = Depends(rate_limiter)
) -> UserResponse:
    """
    Update current user's profile with validation.
    
    Args:
        user_data: Profile update data
        current_user: Currently authenticated user
        user_service: User management service
        _rate_limit: Rate limiting dependency
        
    Returns:
        UserResponse: Updated user profile
        
    Raises:
        HTTPException: If update fails or validation errors occur
    """
    try:
        updated_user = await user_service.update_user(
            user_id=current_user.id,
            update_data=user_data
        )
        
        logger.info(
            "Profile updated",
            extra={
                "user_id": str(current_user.id),
                "updated_fields": user_data.dict(exclude_unset=True)
            }
        )
        
        return updated_user
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "Profile update failed",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )

@router.post('/me/ssh-keys', response_model=UserResponse)
async def add_ssh_key(
    key_name: str,
    public_key: str,
    current_user: UserResponse = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
    _rate_limit: bool = Depends(rate_limiter)
) -> UserResponse:
    """
    Add SSH key to user profile with comprehensive validation.
    
    Args:
        key_name: Name identifier for the SSH key
        public_key: SSH public key value
        current_user: Currently authenticated user
        user_service: User management service
        _rate_limit: Rate limiting dependency
        
    Returns:
        UserResponse: Updated user profile with new SSH key
        
    Raises:
        HTTPException: If key validation fails or limits exceeded
    """
    try:
        # Validate key format and length
        if not user_service.validate_ssh_key(public_key):
            raise ValueError("Invalid SSH key format")
            
        # Add key to user profile
        updated_user = await user_service.add_ssh_key(
            user_id=current_user.id,
            key_name=key_name,
            key_value=public_key
        )
        
        logger.info(
            "SSH key added",
            extra={
                "user_id": str(current_user.id),
                "key_name": key_name
            }
        )
        
        return updated_user
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "SSH key addition failed",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add SSH key"
        )

@router.delete('/me/ssh-keys/{key_name}', response_model=UserResponse)
async def remove_ssh_key(
    key_name: str,
    current_user: UserResponse = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
    _rate_limit: bool = Depends(rate_limiter)
) -> UserResponse:
    """
    Remove SSH key from user profile.
    
    Args:
        key_name: Name of the SSH key to remove
        current_user: Currently authenticated user
        user_service: User management service
        _rate_limit: Rate limiting dependency
        
    Returns:
        UserResponse: Updated user profile without the SSH key
        
    Raises:
        HTTPException: If key removal fails
    """
    try:
        updated_user = await user_service.remove_ssh_key(
            user_id=current_user.id,
            key_name=key_name
        )
        
        logger.info(
            "SSH key removed",
            extra={
                "user_id": str(current_user.id),
                "key_name": key_name
            }
        )
        
        return updated_user
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(
            "SSH key removal failed",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove SSH key"
        )

@router.get('/{user_id}', response_model=UserResponse)
async def get_user_by_id(
    user_id: UUID,
    current_user: UserResponse = Depends(get_current_active_user),
    user_service: UserService = Depends(get_user_service),
    _rate_limit: bool = Depends(rate_limiter)
) -> UserResponse:
    """
    Admin endpoint to get user by ID with role validation.
    
    Args:
        user_id: Target user's UUID
        current_user: Currently authenticated user
        user_service: User management service
        _rate_limit: Rate limiting dependency
        
    Returns:
        UserResponse: Requested user's profile data
        
    Raises:
        HTTPException: If user not found or insufficient permissions
    """
    try:
        # Verify admin role
        if 'admin' not in current_user.roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin role required"
            )
            
        user = await user_service.get_user(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
            
        logger.info(
            "User retrieved by admin",
            extra={
                "admin_id": str(current_user.id),
                "target_user_id": str(user_id)
            }
        )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "User retrieval failed",
            extra={"error": str(e)}
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )