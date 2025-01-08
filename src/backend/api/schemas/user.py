from datetime import datetime
from typing import List, Optional, Dict, Any
import re
from pydantic import BaseModel, Field, EmailStr, UUID4, validator, constr

# Import internal models
from db.models.user import User

# Constants for validation
ALLOWED_ROLES = ['user', 'admin', 'host']
MAX_SSH_KEY_NAME_LENGTH = 50
MAX_SSH_KEY_LENGTH = 4096
SSH_KEY_PATTERN = r'^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}\s+[^@]+(@[^@]+)?$'
KEY_NAME_PATTERN = r'^[a-zA-Z0-9_-]+$'

class UserBase(BaseModel):
    """Base Pydantic model for user data validation with enhanced security controls."""
    
    email: EmailStr = Field(..., description="User's email address")
    google_id: Optional[str] = Field(None, description="Google OAuth ID")
    stripe_customer_id: Optional[str] = Field(None, description="Stripe customer ID")
    ssh_keys: Optional[Dict[str, str]] = Field(
        default={},
        description="Dictionary of SSH public keys with key names as keys"
    )
    roles: List[str] = Field(
        default=['user'],
        description="List of user roles"
    )

    @validator('roles')
    def validate_roles(cls, value: List[str]) -> List[str]:
        """
        Validate user roles with enhanced security checks.
        
        Args:
            value: List of role names to validate
            
        Returns:
            List[str]: Validated list of roles
            
        Raises:
            ValueError: If role validation fails
        """
        if not value:
            raise ValueError("At least one role must be assigned")

        # Check for invalid roles
        invalid_roles = set(value) - set(ALLOWED_ROLES)
        if invalid_roles:
            raise ValueError(f"Invalid roles detected: {invalid_roles}")

        # Validate role combinations
        if 'admin' in value and len(value) > 1:
            raise ValueError("Admin role cannot be combined with other roles")
            
        if 'host' in value and 'user' in value:
            raise ValueError("Host role cannot be combined with user role")

        return value

    @validator('ssh_keys')
    def validate_ssh_keys(cls, value: Dict[str, str]) -> Dict[str, str]:
        """
        Validate SSH keys with comprehensive security checks.
        
        Args:
            value: Dictionary of SSH keys to validate
            
        Returns:
            Dict[str, str]: Validated SSH keys dictionary
            
        Raises:
            ValueError: If SSH key validation fails
        """
        if not value:
            return {}

        validated_keys = {}
        for key_name, key_value in value.items():
            # Validate key name
            if not key_name or len(key_name) > MAX_SSH_KEY_NAME_LENGTH:
                raise ValueError(f"Key name must be between 1 and {MAX_SSH_KEY_NAME_LENGTH} characters")

            if not re.match(KEY_NAME_PATTERN, key_name):
                raise ValueError(f"Invalid key name format: {key_name}")

            # Validate key value
            if not key_value or len(key_value) > MAX_SSH_KEY_LENGTH:
                raise ValueError(f"Key value must be between 1 and {MAX_SSH_KEY_LENGTH} characters")

            if not re.match(SSH_KEY_PATTERN, key_value):
                raise ValueError(f"Invalid SSH key format for key: {key_name}")

            # Store validated key
            validated_keys[key_name] = key_value

        return validated_keys

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class UserCreate(UserBase):
    """Pydantic model for user creation with required fields."""
    
    google_id: str = Field(
        ...,
        description="Required Google OAuth ID for user creation"
    )


class UserUpdate(BaseModel):
    """Pydantic model for user updates with optional fields."""
    
    ssh_keys: Optional[Dict[str, str]] = Field(
        None,
        description="Dictionary of SSH public keys to update"
    )
    stripe_customer_id: Optional[str] = Field(
        None,
        description="Stripe customer ID to update"
    )

    @validator('ssh_keys')
    def validate_ssh_keys(cls, value: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        """Reuse SSH key validation from UserBase."""
        if value is None:
            return None
        return UserBase.validate_ssh_keys(value)


class UserResponse(BaseModel):
    """Pydantic model for user response data with audit fields."""
    
    id: UUID4 = Field(..., description="User's unique identifier")
    email: EmailStr = Field(..., description="User's email address")
    roles: List[str] = Field(..., description="User's assigned roles")
    ssh_keys: Optional[Dict[str, str]] = Field(
        None,
        description="User's SSH public keys"
    )
    created_at: datetime = Field(..., description="Timestamp of user creation")
    updated_at: datetime = Field(..., description="Timestamp of last update")

    class Config:
        """Pydantic model configuration."""
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
        orm_mode = True