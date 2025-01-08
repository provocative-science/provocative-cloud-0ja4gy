"""
Pytest configuration and fixtures module providing comprehensive test infrastructure
for the GPU rental platform's backend test suite, including database setup,
application configuration, and test clients.
"""

import asyncio
import logging
import os
from typing import AsyncGenerator, Dict, Optional

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from api.app import create_application
from db.base import Base
from db.session import engine, SessionLocal

# Configure test logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Test configuration constants
TEST_DB_URL = os.getenv('TEST_DATABASE_URL', 'postgresql+asyncpg://test:test@localhost:5432/test_db')
TEST_LOG_LEVEL = os.getenv('TEST_LOG_LEVEL', 'INFO')
TEST_TIMEOUT = int(os.getenv('TEST_TIMEOUT', '30'))

@pytest.fixture(autouse=True, scope='session')
@pytest.mark.asyncio
async def setup_test_db() -> None:
    """
    Setup and teardown fixture for test database with proper cleanup.
    Creates all tables before tests and drops them after completion.
    """
    logger.info("Setting up test database...")
    
    try:
        # Drop existing tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            logger.info("Dropped existing tables")

        # Create new tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Created test database tables")

        yield  # Run tests

    except Exception as e:
        logger.error(f"Test database setup failed: {str(e)}")
        raise

    finally:
        # Cleanup
        logger.info("Cleaning up test database...")
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("Test database cleanup completed")

@pytest.fixture
@pytest.mark.asyncio
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Fixture providing isolated database session for tests with proper cleanup.
    Uses nested transactions for test isolation.
    """
    async with SessionLocal() as session:
        # Start nested transaction
        transaction = await session.begin_nested()
        
        try:
            yield session
        finally:
            # Rollback nested transaction
            await transaction.rollback()
            # Close session
            await session.close()

@pytest.fixture
def app():
    """
    Fixture providing configured FastAPI test application instance.
    Includes test-specific middleware and dependency overrides.
    """
    app = create_application()

    # Configure test-specific settings
    app.state.testing = True
    
    # Override authentication for tests
    async def override_auth():
        return {"user_id": "test_user", "roles": ["user"]}
    app.dependency_overrides[get_current_user] = override_auth

    # Override database session
    async def override_db():
        async with SessionLocal() as session:
            yield session
    app.dependency_overrides[get_db_session] = override_db

    # Override external services
    app.state.stripe_client = MockStripeClient()
    app.state.gpu_manager = MockGPUManager()

    return app

@pytest.fixture
@pytest.mark.asyncio
async def async_client(app) -> AsyncGenerator[AsyncClient, None]:
    """
    Fixture providing configured async HTTP client for API testing.
    Includes test authentication headers and proper cleanup.
    """
    async with AsyncClient(
        app=app,
        base_url="http://test",
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer test_token"
        },
        timeout=TEST_TIMEOUT
    ) as client:
        yield client

# Mock classes for external service overrides
class MockStripeClient:
    """Mock Stripe client for testing payment endpoints."""
    async def create_payment_intent(self, *args, **kwargs):
        return {"id": "test_intent", "client_secret": "test_secret"}

class MockGPUManager:
    """Mock GPU manager for testing GPU resource endpoints."""
    async def get_available_gpus(self):
        return [{"id": "test_gpu", "model": "NVIDIA A100"}]