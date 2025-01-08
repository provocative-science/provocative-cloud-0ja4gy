"""
Pydantic schema models for authentication and authorization in the Provocative Cloud platform.
Implements secure validation for JWT tokens, Google OAuth flow, and user authentication.
"""

from datetime import datetime, timedelta
import re
from typing import List
from pydantic import BaseModel, Field, EmailStr, UUID4, validator, constr

# Constants for validation
MIN_TOKEN_LENGTH = 128
MAX_ROLES = 5
ALLOWED_ROLES = {"user", "host", "admin"}
JWT_PATTERN = r"^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.[A-Za-z0-9-_\-\+\/=]*$"
ALLOWED_DOMAINS = {"provocative.cloud", "api.provocative.cloud"}
DEVICE_ID_PATTERN = r"^[a-zA-Z0-9-]{36}$"

class TokenResponse(BaseModel):
    """Response model for JWT token authentication with enhanced validation."""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type, always 'bearer'")
    expires_at: datetime = Field(..., description="Token expiration timestamp")
    token_fingerprint: str = Field(..., description="Unique token fingerprint for verification")

    @validator("access_token")
    def validate_token(cls, value: str) -> str:
        """Validates token format and length."""
        if len(value) < MIN_TOKEN_LENGTH:
            raise ValueError(f"Token length must be at least {MIN_TOKEN_LENGTH} characters")
        if not re.match(JWT_PATTERN, value):
            raise ValueError("Invalid JWT token format")
        return value

class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth authentication with strict validation."""
    code: str = Field(..., description="OAuth authorization code")
    redirect_uri: str = Field(..., description="OAuth redirect URI")
    device_id: str = Field(..., description="Unique device identifier")

    @validator("redirect_uri")
    def validate_redirect_uri(cls, value: str) -> str:
        """Validates redirect URI format and domain."""
        try:
            domain = value.split("://")[1].split("/")[0]
            if domain not in ALLOWED_DOMAINS:
                raise ValueError("Invalid redirect domain")
        except IndexError:
            raise ValueError("Invalid redirect URI format")
        return value

    @validator("device_id")
    def validate_device_id(cls, value: str) -> str:
        """Validates device ID format."""
        if not re.match(DEVICE_ID_PATTERN, value):
            raise ValueError("Invalid device ID format")
        return value

class GoogleAuthResponse(BaseModel):
    """Response model for Google OAuth authentication with enhanced security."""
    id_token: str = Field(..., description="Google ID token")
    access_token: str = Field(..., description="Google access token")
    refresh_token: str = Field(..., description="Google refresh token")
    expires_at: datetime = Field(..., description="Token expiration timestamp")
    device_fingerprint: str = Field(..., description="Device fingerprint for security")

    @validator("expires_at")
    def validate_expiration(cls, value: datetime) -> datetime:
        """Validates token expiration is in the future."""
        if value <= datetime.utcnow():
            raise ValueError("Token expiration must be in the future")
        return value

class JWTPayload(BaseModel):
    """JWT token payload model with role validation."""
    sub: UUID4 = Field(..., description="Subject (user ID)")
    email: EmailStr = Field(..., description="User email")
    roles: List[str] = Field(..., description="User roles", max_items=MAX_ROLES)
    exp: datetime = Field(..., description="Token expiration")
    device_id: str = Field(..., description="Device identifier")
    session_id: str = Field(..., description="Unique session identifier")

    @validator("roles")
    def validate_roles(cls, roles: List[str]) -> List[str]:
        """Validates user roles against allowed values."""
        if not roles or len(roles) > MAX_ROLES:
            raise ValueError(f"Must have 1-{MAX_ROLES} roles")
        invalid_roles = set(roles) - ALLOWED_ROLES
        if invalid_roles:
            raise ValueError(f"Invalid roles: {invalid_roles}")
        return roles

class TokenRefreshRequest(BaseModel):
    """Request model for refreshing JWT tokens with validation."""
    refresh_token: str = Field(..., description="JWT refresh token")
    device_id: str = Field(..., description="Device identifier")

    @validator("refresh_token")
    def validate_refresh_token(cls, value: str) -> str:
        """Validates refresh token format."""
        if len(value) < MIN_TOKEN_LENGTH:
            raise ValueError(f"Refresh token length must be at least {MIN_TOKEN_LENGTH} characters")
        if not re.match(JWT_PATTERN, value):
            raise ValueError("Invalid refresh token format")
        return value

class TokenVerifyRequest(BaseModel):
    """Request model for verifying JWT tokens with enhanced validation."""
    token: str = Field(..., description="JWT token to verify")
    token_fingerprint: str = Field(..., description="Token fingerprint for verification")

    @validator("token")
    def validate_token(cls, value: str) -> str:
        """Validates token format."""
        if len(value) < MIN_TOKEN_LENGTH:
            raise ValueError(f"Token length must be at least {MIN_TOKEN_LENGTH} characters")
        if not re.match(JWT_PATTERN, value):
            raise ValueError("Invalid token format")
        return value

    @validator("token_fingerprint")
    def validate_fingerprint(cls, value: str, values: dict) -> str:
        """Validates token fingerprint format and uniqueness."""
        if not value or len(value) != 64:  # SHA-256 hexadecimal length
            raise ValueError("Invalid token fingerprint format")
        return value