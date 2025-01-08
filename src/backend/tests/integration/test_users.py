"""
Integration tests for user management endpoints and services in the Provocative Cloud platform.
Tests user profile operations, SSH key management, and role-based access control.
"""

import pytest
from uuid import uuid4
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.user import UserCreate, UserUpdate, UserResponse
from db.models.user import User

# Test constants
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "testpassword123"
TEST_SSH_KEY = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDf7O8TjXWo9V7IJ+g5y3yRHQ6OEJ5qR5Pbx9Y+Y9nJ7FH4RtH7L7fHyGBwDMm9nGn7nLdZW1XCEb4zGPgJ5D1wXtmyGwNS8NfMGYmM+xuMd+XXiE7F0M7B4Dw6p4c/QYuN/0L3X7EFhpJzRqJNPJ9qKTY3d6Qs8K3cYD6RmYzqoGGF3SQQ5XwI4Bd9EF9bmZYZQqS1nzqKYHhUVBUVf+1QKxZ+Yx+qJVBCq5NU1k5TOvOzLYGPL+QF6R6q0W5xG9Rz9djH9bQp7h8KX3rX9X5K8R3d8X5q5r5q5r5q5r5q5r5q5r5q5r5q5r5q5r5q5r5q5r5q5r5q5r5 test@example.com"

@pytest.mark.asyncio
async def test_get_current_user(async_client: AsyncClient, db_session: AsyncSession):
    """Test retrieving current user profile endpoint."""
    # Create test user
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"]
    )
    db_session.add(user)
    await db_session.commit()

    # Make request with auth token
    response = await async_client.get("/api/v1/users/me")
    assert response.status_code == 200

    # Validate response
    data = response.json()
    assert data["email"] == TEST_USER_EMAIL
    assert data["roles"] == ["user"]
    assert "id" in data
    assert "created_at" in data

@pytest.mark.asyncio
async def test_update_user_profile(async_client: AsyncClient, db_session: AsyncSession):
    """Test updating user profile information."""
    # Create test user
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"]
    )
    db_session.add(user)
    await db_session.commit()

    # Update data
    update_data = {
        "stripe_customer_id": "cus_test123"
    }

    # Make update request
    response = await async_client.patch(
        "/api/v1/users/me",
        json=update_data
    )
    assert response.status_code == 200

    # Verify update
    data = response.json()
    assert data["stripe_customer_id"] == update_data["stripe_customer_id"]
    
    # Verify database update
    updated_user = await db_session.get(User, user.id)
    assert updated_user.stripe_customer_id == update_data["stripe_customer_id"]

@pytest.mark.asyncio
async def test_add_ssh_key(async_client: AsyncClient, db_session: AsyncSession):
    """Test adding SSH key to user profile."""
    # Create test user
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"]
    )
    db_session.add(user)
    await db_session.commit()

    # SSH key data
    key_data = {
        "name": "test_key",
        "key": TEST_SSH_KEY
    }

    # Add SSH key
    response = await async_client.post(
        "/api/v1/users/me/ssh-keys",
        json=key_data
    )
    assert response.status_code == 200

    # Verify key addition
    data = response.json()
    assert "test_key" in data["ssh_keys"]
    assert data["ssh_keys"]["test_key"] == TEST_SSH_KEY

    # Verify database update
    updated_user = await db_session.get(User, user.id)
    assert "test_key" in updated_user.ssh_keys
    assert updated_user.ssh_keys["test_key"] == TEST_SSH_KEY

@pytest.mark.asyncio
async def test_remove_ssh_key(async_client: AsyncClient, db_session: AsyncSession):
    """Test removing SSH key from user profile."""
    # Create test user with SSH key
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"],
        ssh_keys={"test_key": TEST_SSH_KEY}
    )
    db_session.add(user)
    await db_session.commit()

    # Remove SSH key
    response = await async_client.delete(
        "/api/v1/users/me/ssh-keys/test_key"
    )
    assert response.status_code == 200

    # Verify key removal
    data = response.json()
    assert "test_key" not in data["ssh_keys"]

    # Verify database update
    updated_user = await db_session.get(User, user.id)
    assert "test_key" not in updated_user.ssh_keys

@pytest.mark.asyncio
async def test_get_user_by_id_admin(async_client: AsyncClient, db_session: AsyncSession):
    """Test admin endpoint for retrieving user by ID."""
    # Create admin user
    admin = User(
        email="admin@example.com",
        google_id="admin_google_id",
        roles=["admin"]
    )
    db_session.add(admin)

    # Create target user
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"]
    )
    db_session.add(user)
    await db_session.commit()

    # Make request as admin
    response = await async_client.get(f"/api/v1/users/{user.id}")
    assert response.status_code == 200

    # Validate response
    data = response.json()
    assert data["email"] == TEST_USER_EMAIL
    assert data["roles"] == ["user"]
    assert str(data["id"]) == str(user.id)

@pytest.mark.asyncio
async def test_get_user_by_id_unauthorized(async_client: AsyncClient, db_session: AsyncSession):
    """Test unauthorized access to admin user endpoint."""
    # Create regular user
    user = User(
        email=TEST_USER_EMAIL,
        google_id="test_google_id",
        roles=["user"]
    )
    db_session.add(user)

    # Create target user
    target_user = User(
        email="target@example.com",
        google_id="target_google_id",
        roles=["user"]
    )
    db_session.add(target_user)
    await db_session.commit()

    # Make request as non-admin
    response = await async_client.get(f"/api/v1/users/{target_user.id}")
    assert response.status_code == 403

    # Validate error response
    data = response.json()
    assert "detail" in data
    assert data["detail"] == "Insufficient permissions"