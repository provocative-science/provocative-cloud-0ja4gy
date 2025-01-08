"""
Initialization module for backend integration tests configuring pytest markers,
fixtures, and common test utilities for comprehensive integration testing of the
GPU rental platform with carbon capture capabilities.
"""

import pytest

# Define integration test markers with detailed descriptions
INTEGRATION_MARKERS = [
    ('integration', 'General integration tests for core platform functionality'),
    ('async', 'Tests for asynchronous operations and real-time updates'),
    ('database', 'Database integration tests for data persistence and transactions'),
    ('gpu', 'GPU resource management and allocation tests'),
    ('auth', 'Authentication and authorization integration tests'),
    ('billing', 'Payment processing and billing integration tests'),
    ('carbon', 'Environmental metrics and carbon capture system tests'),
    ('performance', 'System performance and resource utilization tests'),
    ('api', 'API endpoint integration tests'),
    ('security', 'Security features and access control tests')
]

def configure_integration_markers(config):
    """
    Configures pytest markers for comprehensive integration testing of the
    GPU rental platform including core functionality and environmental metrics.
    
    Args:
        config: pytest config object
    """
    for marker, description in INTEGRATION_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: {description}"
        )

def pytest_configure(config):
    """
    Pytest hook to configure integration test environment and markers.
    Integrates with core test configuration from conftest.py.
    """
    # Configure integration test markers
    configure_integration_markers(config)

    # Set test environment variables
    config.option.log_level = "INFO"
    config.option.verbose = 2

    # Configure test timeouts
    config.option.timeout = 300  # 5 minutes max per test

    # Enable async test support
    config.option.asyncio_mode = "auto"

def pytest_collection_modifyitems(items):
    """
    Pytest hook to modify test items for integration testing requirements.
    Adds markers and metadata for test organization and reporting.
    """
    for item in items:
        # Add integration marker to all tests in this directory
        if "integration" in item.nodeid:
            item.add_marker(pytest.mark.integration)

        # Add async marker to coroutine tests
        if item.get_closest_marker("asyncio"):
            item.add_marker(pytest.mark.async_test)

        # Add database marker to tests using db_session fixture
        if "db_session" in item.fixturenames:
            item.add_marker(pytest.mark.database)

        # Add environmental marker to carbon metrics tests
        if "carbon" in item.keywords or "environmental" in item.keywords:
            item.add_marker(pytest.mark.carbon)

        # Add performance marker to resource monitoring tests
        if "performance" in item.keywords or "metrics" in item.keywords:
            item.add_marker(pytest.mark.performance)