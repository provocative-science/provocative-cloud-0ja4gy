"""
Integration tests for authentication functionality including Google OAuth flow,
JWT token handling, user authentication endpoints, and comprehensive security validation.
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import jwt
from fastapi import status
from freezegun import freeze_time

from api.security.oauth import get_authorization_url, exchange_code, verify_oauth_token
from api.security.jwt import create_access_token, decode_token, validate_token_security
from api.constants import JWT_ALGORITHM, JWT_TOKEN_EXPIRE_MINUTES, OAUTH_SCOPES

# Test data constants
TEST_USER_ID = "test-user-123"
TEST_EMAIL = "test@example.com"
TEST_DEVICE_ID = "test-device-456"
TEST_STATE = "test-state-789"
TEST_REDIRECT_URI = "https://provocative.cloud/oauth/callback"

@pytest.mark.asyncio
async def test_oauth_login_url(test_client):
    """Tests generation of Google OAuth authorization URL with security parameters."""
    
    # Mock state token generation
    with patch('api.security.oauth.secrets.token_urlsafe', return_value=TEST_STATE):
        response = await test_client.get(
            "/api/v1/auth/login",
            params={"redirect_uri": TEST_REDIRECT_URI}
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        
        # Verify authorization URL format and parameters
        assert "authorization_url" in data
        assert "state" in data
        assert data["state"] == TEST_STATE
        
        auth_url = data["authorization_url"]
        assert "https://accounts.google.com/o/oauth2/v2/auth" in auth_url
        assert f"state={TEST_STATE}" in auth_url
        assert f"redirect_uri={TEST_REDIRECT_URI}" in auth_url
        assert "scope=" in auth_url
        
        # Verify required OAuth scopes
        for scope in OAUTH_SCOPES:
            assert scope in auth_url

@pytest.mark.asyncio
@patch('api.security.oauth.exchange_code')
async def test_oauth_callback_success(mock_exchange, test_client, db_session):
    """Tests successful OAuth callback flow with security validation."""
    
    # Mock successful OAuth code exchange
    mock_token_response = {
        "id_token": "test_id_token",
        "access_token": "test_access_token",
        "refresh_token": "test_refresh_token",
        "expires_at": datetime.utcnow() + timedelta(hours=1)
    }
    mock_exchange.return_value = mock_token_response
    
    # Mock device fingerprint
    device_fingerprint = "test_device_fingerprint"
    
    response = await test_client.post(
        "/api/v1/auth/callback",
        json={
            "code": "test_code",
            "redirect_uri": TEST_REDIRECT_URI,
            "device_id": TEST_DEVICE_ID,
            "state": TEST_STATE
        },
        headers={"X-Device-Fingerprint": device_fingerprint}
    )
    
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    
    # Verify token response format
    assert "access_token" in data
    assert "token_type" in data
    assert "expires_at" in data
    assert "token_fingerprint" in data
    
    # Verify token contents
    token = data["access_token"]
    decoded = jwt.decode(
        token,
        options={"verify_signature": False},
        algorithms=[JWT_ALGORITHM]
    )
    assert decoded["sub"] == TEST_USER_ID
    assert decoded["email"] == TEST_EMAIL
    assert decoded["device_id"] == TEST_DEVICE_ID
    
    # Verify token expiration
    expires_at = datetime.fromisoformat(data["expires_at"])
    assert expires_at > datetime.utcnow()
    assert expires_at <= datetime.utcnow() + timedelta(minutes=JWT_TOKEN_EXPIRE_MINUTES)
    
    # Verify security headers
    assert "X-Content-Type-Options" in response.headers
    assert "X-Frame-Options" in response.headers
    assert "Strict-Transport-Security" in response.headers

@pytest.mark.asyncio
async def test_oauth_callback_security(test_client):
    """Tests OAuth callback security validations."""
    
    # Test invalid state token
    response = await test_client.post(
        "/api/v1/auth/callback",
        json={
            "code": "test_code",
            "redirect_uri": TEST_REDIRECT_URI,
            "device_id": TEST_DEVICE_ID,
            "state": "invalid_state"
        }
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test missing device fingerprint
    response = await test_client.post(
        "/api/v1/auth/callback",
        json={
            "code": "test_code",
            "redirect_uri": TEST_REDIRECT_URI,
            "device_id": TEST_DEVICE_ID,
            "state": TEST_STATE
        }
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test invalid redirect URI
    response = await test_client.post(
        "/api/v1/auth/callback",
        json={
            "code": "test_code",
            "redirect_uri": "https://malicious.com/callback",
            "device_id": TEST_DEVICE_ID,
            "state": TEST_STATE
        }
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST

@pytest.mark.asyncio
@freeze_time("2024-01-01")
async def test_jwt_token_security(test_client, db_session):
    """Tests JWT token security features."""
    
    # Create test token
    token = create_access_token(
        user_id=TEST_USER_ID,
        email=TEST_EMAIL,
        roles=["user"],
        device_id=TEST_DEVICE_ID
    )
    
    # Test token expiration
    with freeze_time("2024-01-02"):  # Move time forward
        response = await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token.access_token}"}
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test invalid token signature
    modified_token = token.access_token[:-1] + "X"  # Modify signature
    response = await test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {modified_token}"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test token without required claims
    incomplete_token = jwt.encode(
        {"sub": TEST_USER_ID},  # Missing required claims
        "test_secret",
        algorithm=JWT_ALGORITHM
    )
    response = await test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {incomplete_token}"}
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    # Test rate limiting
    for _ in range(10):
        await test_client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {token.access_token}"}
        )
    response = await test_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token.access_token}"}
    )
    assert response.status_code == status.HTTP_429_TOO_MANY_REQUESTS