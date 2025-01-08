"""
Unit test initialization module for Provocative Cloud backend services.
Configures test markers, collection settings, and environmental impact testing.
"""

import pytest
from typing import Dict, List

# Test markers for unit test categorization
UNIT_TEST_MARKER = 'unit'
TEST_MARKERS = [
    'unit',          # Basic unit tests
    'gpu',           # GPU resource management tests
    'auth',          # Authentication and authorization tests
    'billing',       # Payment and billing tests
    'metrics',       # System metrics tests
    'reservation',   # Resource reservation tests
    'server',        # Server management tests
    'user',          # User management tests
    'carbon',        # Carbon capture tests
    'cooling',       # Cooling system tests
    'environmental'  # Environmental impact tests
]

# Mock response data for API testing
MOCK_RESPONSES = {
    'gpu_metrics': {
        'temperature': 65.0,
        'utilization': 80.0,
        'memory_used': 32768,
        'power_draw': 250.0,
        'cooling_efficiency': 0.85
    },
    'carbon_metrics': {
        'co2_captured_kg': 0.5,
        'power_usage_effectiveness': 1.2,
        'carbon_usage_effectiveness': 0.8,
        'water_usage_effectiveness': 1.1
    }
}

# Environmental metrics test data
ENVIRONMENTAL_METRICS = {
    'co2_capture': {
        'target_rate': 0.5,  # 50% capture target
        'min_efficiency': 0.6,
        'max_efficiency': 1.0,
        'alert_threshold': 0.4
    },
    'cooling_efficiency': {
        'target': 0.85,
        'min_acceptable': 0.7,
        'max_power_usage': 300,  # watts
        'temperature_threshold': 80  # celsius
    },
    'power_usage': {
        'baseline': 200,  # watts
        'max_limit': 400,  # watts
        'efficiency_target': 0.9
    },
    'water_usage': {
        'target_wue': 1.2,
        'max_wue': 1.8,
        'alert_threshold': 1.5
    }
}

def pytest_configure_unit(config) -> None:
    """
    Pytest hook to configure unit test specific settings including environmental impact testing.
    
    Args:
        config: Pytest config object
    """
    # Register all test markers
    for marker in TEST_MARKERS:
        config.addinivalue_line(
            "markers",
            f"{marker}: mark test as {marker} test type"
        )

    # Configure test collection settings
    config.option.markexpr = UNIT_TEST_MARKER
    config.option.verbose = 2
    
    # Configure test isolation settings
    config.option.isolated_download = True
    config.option.strict = True
    
    # Configure environmental monitoring test settings
    config.option.env_monitoring = True
    config.option.carbon_tracking = True
    
    # Set up cleanup handlers
    config.option.clean = "on"
    config.option.clean_scope = "function"
    
    # Initialize environmental metrics test data
    config.environmental_metrics = ENVIRONMENTAL_METRICS
    config.mock_responses = MOCK_RESPONSES
    
    # Configure carbon capture test data
    config.co2_capture = {
        'enabled': True,
        'monitoring_interval': 60,  # seconds
        'data_retention': 2592000   # 30 days
    }