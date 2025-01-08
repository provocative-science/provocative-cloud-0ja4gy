"""
Integration tests for metrics collection, processing and API endpoints, covering GPU performance metrics,
carbon capture metrics, system-wide metrics, and real-time monitoring with comprehensive test data
generation and cleanup.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List
import uuid

import pytest
from faker import Faker
from prometheus_client import REGISTRY

from api.schemas.metrics import (
    GPUMetricsBase, CarbonMetricsBase, SystemMetricsBase, MetricsResponse
)
from api.utils.gpu_metrics import (
    collect_gpu_metrics, process_metrics, calculate_carbon_impact
)
from api.utils.carbon_metrics import (
    calculate_co2_emissions, calculate_carbon_capture,
    calculate_carbon_effectiveness
)

# Initialize Faker for test data generation
fake = Faker()

class MetricsTestBase:
    """Base class for metrics integration tests with common utilities."""

    def __init__(self):
        """Initialize test configuration and fixtures."""
        self.test_config = {
            'gpu_metrics': {
                'temperature_range': (30, 85),
                'power_range': (100, 300),
                'memory_range': (0, 80),
                'utilization_range': (0, 100)
            },
            'carbon_metrics': {
                'co2_capture_rate': 0.5,
                'power_efficiency_range': (0.7, 0.95),
                'carbon_efficiency_range': (0.6, 0.9)
            },
            'system_metrics': {
                'cpu_range': (0, 100),
                'memory_range': (0, 100),
                'network_range': (0, 10000)
            }
        }

    async def setup_test_data(self, metric_type: str) -> Dict:
        """Sets up test metrics data with proper isolation."""
        if metric_type == 'gpu':
            return {
                'temperature_celsius': fake.pyfloat(
                    min_value=self.test_config['gpu_metrics']['temperature_range'][0],
                    max_value=self.test_config['gpu_metrics']['temperature_range'][1]
                ),
                'power_usage_watts': fake.pyint(
                    min_value=self.test_config['gpu_metrics']['power_range'][0],
                    max_value=self.test_config['gpu_metrics']['power_range'][1]
                ),
                'memory_used_gb': fake.pyfloat(
                    min_value=0,
                    max_value=self.test_config['gpu_metrics']['memory_range'][1]
                ),
                'memory_total_gb': self.test_config['gpu_metrics']['memory_range'][1],
                'utilization_percent': fake.pyfloat(
                    min_value=0,
                    max_value=100
                )
            }
        elif metric_type == 'carbon':
            return {
                'co2_captured_kg': fake.pyfloat(min_value=0, max_value=100),
                'co2_capture_rate_kgh': self.test_config['carbon_metrics']['co2_capture_rate'],
                'power_usage_effectiveness': fake.pyfloat(min_value=1.0, max_value=1.5),
                'carbon_usage_effectiveness': fake.pyfloat(min_value=0.5, max_value=1.0),
                'water_usage_effectiveness': fake.pyfloat(min_value=0.5, max_value=1.5)
            }
        elif metric_type == 'system':
            return {
                'cpu_usage_percent': fake.pyfloat(
                    min_value=self.test_config['system_metrics']['cpu_range'][0],
                    max_value=self.test_config['system_metrics']['cpu_range'][1]
                ),
                'memory_usage_percent': fake.pyfloat(
                    min_value=self.test_config['system_metrics']['memory_range'][0],
                    max_value=self.test_config['system_metrics']['memory_range'][1]
                ),
                'network_bandwidth_mbps': fake.pyfloat(
                    min_value=self.test_config['system_metrics']['network_range'][0],
                    max_value=self.test_config['system_metrics']['network_range'][1]
                )
            }
        return {}

@pytest.mark.asyncio
@pytest.mark.flaky(reruns=2)
async def test_gpu_metrics_collection(test_client, metrics_fixtures, db_session):
    """Tests GPU metrics collection and validation with performance monitoring."""
    # Set up test base
    test_base = MetricsTestBase()
    
    # Generate test GPU metrics
    gpu_id = str(uuid.uuid4())
    test_metrics = await test_base.setup_test_data('gpu')
    
    # Configure test thresholds
    thresholds = {
        'temperature': 85.0,
        'memory': 0.95,
        'utilization': 0.90
    }
    
    try:
        # Make request to metrics endpoint
        response = await test_client.get(f"/api/v1/metrics/gpu/{gpu_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate response structure
        assert 'gpu_metrics' in data
        assert 'environmental_metrics' in data
        
        # Validate GPU metrics
        gpu_metrics = data['gpu_metrics']
        assert isinstance(gpu_metrics['temperature_celsius'], float)
        assert isinstance(gpu_metrics['power_usage_watts'], int)
        assert isinstance(gpu_metrics['memory_used_gb'], float)
        assert isinstance(gpu_metrics['utilization_percent'], float)
        
        # Validate metric ranges
        assert 0 <= gpu_metrics['temperature_celsius'] <= thresholds['temperature']
        assert 0 <= gpu_metrics['memory_used_gb'] <= gpu_metrics['memory_total_gb']
        assert 0 <= gpu_metrics['utilization_percent'] <= 100
        
        # Validate Prometheus metrics
        gpu_temp_metric = REGISTRY.get_sample_value(
            'gpu_temperature_celsius',
            {'gpu_id': gpu_id}
        )
        assert gpu_temp_metric is not None
        
        # Cleanup test data
        await metrics_fixtures.cleanup_gpu_metrics(gpu_id)
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_carbon_capture_metrics(test_client, metrics_fixtures):
    """Tests carbon capture and environmental metrics tracking."""
    # Set up test base
    test_base = MetricsTestBase()
    
    # Generate test carbon metrics
    test_metrics = await test_base.setup_test_data('carbon')
    gpu_id = str(uuid.uuid4())
    
    try:
        # Make request to environmental metrics endpoint
        response = await test_client.get(f"/api/v1/metrics/environmental/{gpu_id}")
        assert response.status_code == 200
        
        data = response.json()
        
        # Validate response structure
        assert 'carbon_metrics' in data
        assert 'environmental_impact' in data
        
        # Validate carbon metrics
        carbon_metrics = data['carbon_metrics']
        assert isinstance(carbon_metrics['co2_captured_kg'], float)
        assert isinstance(carbon_metrics['power_usage_effectiveness'], float)
        assert isinstance(carbon_metrics['carbon_usage_effectiveness'], float)
        
        # Validate metric ranges and relationships
        assert carbon_metrics['power_usage_effectiveness'] >= 1.0
        assert 0 <= carbon_metrics['carbon_usage_effectiveness'] <= 1.0
        assert carbon_metrics['co2_captured_kg'] >= 0
        
        # Validate carbon effectiveness calculation
        effectiveness = calculate_carbon_effectiveness(
            carbon_metrics['co2_captured_kg'],
            carbon_metrics['power_usage_effectiveness']
        )
        assert 0 <= effectiveness <= 1.0
        
        # Validate Prometheus metrics
        carbon_capture_metric = REGISTRY.get_sample_value(
            'gpu_carbon_capture_rate',
            {'gpu_id': gpu_id}
        )
        assert carbon_capture_metric is not None
        
        # Cleanup test data
        await metrics_fixtures.cleanup_carbon_metrics(gpu_id)
        
    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")