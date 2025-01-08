"""
Test package initialization module for Provocative Cloud backend services.
Configures pytest settings, registers custom markers, and sets up test environment
with comprehensive test categorization and environment management.
"""

import logging
from typing import Dict, List, Optional

import pytest
from pytest import Config

from tests.conftest import pytest_configure, cleanup_test_environment

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
LOGGER = logging.getLogger(__name__)

# Define test markers with descriptions
TEST_MARKERS = [
    ('unit', 'Mark test as a unit test for isolated component testing'),
    ('integration', 'Mark test as an integration test for component interaction testing'),
    ('gpu', 'Mark test as GPU-related for hardware interaction testing'),
    ('auth', 'Mark test as authentication-related for security testing'),
    ('billing', 'Mark test as billing-related for payment processing testing'),
    ('metrics', 'Mark test as metrics-related for monitoring system testing'),
    ('async', 'Mark test as asynchronous for concurrent operation testing'),
    ('cleanup', 'Mark test as requiring specific cleanup procedures'),
    ('env', 'Mark test as environment-sensitive for specific setup needs'),
    ('performance', 'Mark test as performance-critical for benchmarking')
]

def register_markers(config: Config) -> None:
    """
    Registers custom pytest markers for comprehensive test categorization.
    
    Args:
        config: pytest configuration object
    """
    try:
        LOGGER.info("Registering test markers...")
        
        for marker_name, marker_desc in TEST_MARKERS:
            # Register each marker with its description
            config.addinivalue_line(
                "markers",
                f"{marker_name}: {marker_desc}"
            )
            LOGGER.debug(f"Registered marker: {marker_name}")

        # Register additional marker configurations
        config.addinivalue_line(
            "markers",
            "slow: marks tests as slow (deselect with '-m \"not slow\"')"
        )
        config.addinivalue_line(
            "markers",
            "serial: marks tests that cannot run in parallel"
        )

        LOGGER.info("Test markers registered successfully")

    except Exception as e:
        LOGGER.error(f"Failed to register markers: {str(e)}")
        raise

def setup_test_environment(config: Config) -> None:
    """
    Configures test environment with proper isolation and resource management.
    
    Args:
        config: pytest configuration object
    """
    try:
        LOGGER.info("Setting up test environment...")

        # Configure test database
        config.option.database_url = "postgresql+asyncpg://test:test@localhost:5432/test_db"
        
        # Configure test Redis instance
        config.option.redis_url = "redis://localhost:6379/1"
        
        # Configure test GPU environment
        config.option.gpu_enabled = False  # Disable real GPU usage in tests
        config.option.gpu_mock_responses = {
            "metrics": {
                "temperature": 65.0,
                "utilization": 80.0,
                "memory_used": 8192,
                "power_draw": 250
            }
        }
        
        # Configure test authentication
        config.option.auth_enabled = True
        config.option.mock_oauth = True
        
        # Configure test payment processing
        config.option.stripe_mock = True
        config.option.mock_payment_responses = {
            "success": {"status": "succeeded"},
            "failure": {"status": "failed", "error": "Test error"}
        }

        # Configure test metrics collection
        config.option.metrics_enabled = True
        config.option.metrics_interval = 1  # 1 second for faster testing
        
        # Register cleanup handler
        config.add_cleanup(cleanup_test_environment)

        LOGGER.info("Test environment setup completed")

    except Exception as e:
        LOGGER.error(f"Test environment setup failed: {str(e)}")
        raise

# Register markers and setup environment when module is imported
def pytest_configure(config: Config) -> None:
    """
    pytest hook for configuration and environment setup.
    
    Args:
        config: pytest configuration object
    """
    register_markers(config)
    setup_test_environment(config)