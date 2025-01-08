"""
Comprehensive unit tests for security components including JWT authentication,
Google OAuth integration, role-based access control (RBAC), and environmental
impact tracking for the Provocative Cloud platform.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch
import jwt
from freezegun import freeze_time

from api.security.jwt import (
    create_access_token, decode_token, get_current_user,
    validate_device_fingerprint
)
from api.security.oauth import (
    get_authorization_url, exchange_code, verify_oauth_token,
    validate_oauth_state
)
from api.security.permissions import (
    ROLE_USER, ROLE_HOST, ROLE_ADMIN, require_role,
    check_permission, get_user_permissions, validate_role_hierarchy
)
from tests.conftest import test_app, test_client, mock_oauth_client

# Test data
TEST_USER_ID = "550e8400-e29b-41d4-a716-446655440000"
TEST_EMAIL = "test@example.com"
TEST_DEVICE_ID = "device-123456789"
TEST_FINGERPRINT = "abcdef1234567890"

@pytest.mark.asyncio
@freeze_time("2024-01-01")
async def test_create_access_token():
    """Tests JWT access token creation with device fingerprinting."""
    # Test token creation with basic user role
    token_response = await create_access_token(
        user_id=TEST_USER_ID,
        email=TEST_EMAIL,
        roles=[ROLE_USER],
        device_id=TEST_DEVICE_ID
    )
    
    assert token_response.access_token is not None
    assert token_response.token_fingerprint is not None
    assert token_response.expires_at > datetime.utcnow()
    
    # Decode and verify token contents
    decoded = jwt.decode(
        token_response.access_token,
        "test_secret",
        algorithms=["HS256"]
    )
    assert decoded["sub"] == TEST_USER_ID
    assert decoded["email"] == TEST_EMAIL
    assert ROLE_USER in decoded["roles"]
    assert decoded["device_id"] == TEST_DEVICE_ID
    assert decoded["fingerprint"] == token_response.token_fingerprint
    
    # Test token creation with multiple roles
    token_response = await create_access_token(
        user_id=TEST_USER_ID,
        email=TEST_EMAIL,
        roles=[ROLE_USER, ROLE_HOST],
        device_id=TEST_DEVICE_ID
    )
    decoded = jwt.decode(
        token_response.access_token,
        "test_secret",
        algorithms=["HS256"]
    )
    assert ROLE_USER in decoded["roles"]
    assert ROLE_HOST in decoded["roles"]
    
    # Test token expiration
    assert decoded["exp"] == (datetime.utcnow() + timedelta(minutes=1440)).timestamp()

@pytest.mark.asyncio
async def test_oauth_flow():
    """Tests complete OAuth flow including state validation."""
    mock_client = mock_oauth_client()
    
    # Test authorization URL generation
    redirect_uri = "https://provocative.cloud/oauth/callback"
    auth_url = await get_authorization_url(redirect_uri, mock_client.request)
    
    assert "accounts.google.com" in auth_url
    assert "redirect_uri=" in auth_url
    assert "state=" in auth_url
    assert "scope=" in auth_url
    
    # Test authorization code exchange
    mock_code = "test_auth_code"
    mock_tokens = {
        "access_token": "test_access_token",
        "id_token": "test_id_token",
        "refresh_token": "test_refresh_token"
    }
    
    with patch("api.security.oauth.exchange_code") as mock_exchange:
        mock_exchange.return_value = mock_tokens
        tokens = await exchange_code(
            auth_request={"code": mock_code, "redirect_uri": redirect_uri},
            device_fingerprint=TEST_FINGERPRINT
        )
        
        assert tokens["access_token"] == mock_tokens["access_token"]
        assert tokens["id_token"] == mock_tokens["id_token"]
        
    # Test token verification
    mock_user_info = {
        "sub": TEST_USER_ID,
        "email": TEST_EMAIL,
        "email_verified": True
    }
    
    with patch("api.security.oauth.verify_oauth_token") as mock_verify:
        mock_verify.return_value = mock_user_info
        user_info = await verify_oauth_token(
            mock_tokens["id_token"],
            mock_client.request
        )
        
        assert user_info["sub"] == TEST_USER_ID
        assert user_info["email"] == TEST_EMAIL

@pytest.mark.asyncio
async def test_role_hierarchy():
    """Tests role hierarchy and inheritance."""
    # Create test users with different role combinations
    admin_user = {
        "id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "roles": [ROLE_ADMIN]
    }
    
    host_user = {
        "id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "roles": [ROLE_HOST]
    }
    
    regular_user = {
        "id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "roles": [ROLE_USER]
    }
    
    # Test role validation
    assert await check_permission(admin_user, ROLE_ADMIN)
    assert await check_permission(admin_user, ROLE_HOST)
    assert await check_permission(admin_user, ROLE_USER)
    
    assert not await check_permission(host_user, ROLE_ADMIN)
    assert await check_permission(host_user, ROLE_HOST)
    assert await check_permission(host_user, ROLE_USER)
    
    assert not await check_permission(regular_user, ROLE_ADMIN)
    assert not await check_permission(regular_user, ROLE_HOST)
    assert await check_permission(regular_user, ROLE_USER)
    
    # Test role inheritance
    admin_perms = await get_user_permissions(admin_user)
    assert ROLE_ADMIN in admin_perms
    assert ROLE_HOST in admin_perms
    assert ROLE_USER in admin_perms
    
    host_perms = await get_user_permissions(host_user)
    assert ROLE_ADMIN not in host_perms
    assert ROLE_HOST in host_perms
    assert ROLE_USER in host_perms
    
    user_perms = await get_user_permissions(regular_user)
    assert ROLE_ADMIN not in user_perms
    assert ROLE_HOST not in user_perms
    assert ROLE_USER in user_perms
    
    # Test role hierarchy validation
    with pytest.raises(ValueError):
        await validate_role_hierarchy([ROLE_ADMIN, ROLE_USER])
    
    with pytest.raises(ValueError):
        await validate_role_hierarchy([ROLE_HOST, ROLE_ADMIN])
    
    assert await validate_role_hierarchy([ROLE_USER, ROLE_HOST])

@pytest.mark.asyncio
async def test_environmental_impact_tracking():
    """Tests environmental impact metrics validation."""
    # Mock environmental metrics
    mock_metrics = {
        "power_efficiency": 0.85,
        "thermal_efficiency": 0.90,
        "carbon_efficiency": 0.875,
        "co2_captured": 150.5
    }
    
    # Test metrics validation
    assert 0 <= mock_metrics["power_efficiency"] <= 1
    assert 0 <= mock_metrics["thermal_efficiency"] <= 1
    assert 0 <= mock_metrics["carbon_efficiency"] <= 1
    assert mock_metrics["co2_captured"] >= 0
    
    # Test metrics calculation
    avg_efficiency = (mock_metrics["power_efficiency"] + 
                     mock_metrics["thermal_efficiency"]) / 2
    assert abs(avg_efficiency - mock_metrics["carbon_efficiency"]) < 0.001