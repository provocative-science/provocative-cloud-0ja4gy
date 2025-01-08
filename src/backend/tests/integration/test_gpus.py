"""
Integration tests for GPU resource management endpoints, validating GPU listing,
allocation, monitoring, and environmental metrics in the Provocative Cloud platform.
"""

import pytest
from uuid import uuid4
from datetime import datetime

from tests.conftest import test_app, test_client, db_session, mock_gpu_metrics, mock_carbon_metrics
from api.schemas.gpu import GPUBase, GPUCreate, GPUUpdate, GPUResponse
from db.models.gpu import GPU

# API endpoint prefix
API_PREFIX = "/api/v1"

# Test data constants
VALID_GPU_DATA = {
    'model': 'NVIDIA A100',
    'vram_gb': 80,
    'price_per_hour': '4.50',
    'cooling_efficiency': 0.85
}

SAMPLE_HARDWARE_METRICS = {
    'temperature': 65,
    'utilization': 80,
    'memory_used': 65536,
    'power_draw': 250
}

SAMPLE_ENVIRONMENTAL_METRICS = {
    'co2_capture_rate': 45.5,
    'pue': 1.1,
    'cue': 0.7,
    'wue': 0.4,
    'cooling_efficiency': 0.85,
    'airflow_rate': 120
}

class GPUTestData:
    """Test data helper class for GPU and environmental metrics tests."""

    @staticmethod
    async def create_test_gpu_with_metrics(db_session) -> GPU:
        """Creates a test GPU record with associated metrics."""
        gpu = GPU(
            server_id=str(uuid4()),
            model=VALID_GPU_DATA['model'],
            vram_gb=VALID_GPU_DATA['vram_gb'],
            price_per_hour=VALID_GPU_DATA['price_per_hour']
        )
        gpu.metrics = {
            'hardware': SAMPLE_HARDWARE_METRICS,
            'environmental': SAMPLE_ENVIRONMENTAL_METRICS,
            'timestamp': datetime.utcnow().isoformat()
        }
        db_session.add(gpu)
        await db_session.commit()
        await db_session.refresh(gpu)
        return gpu

@pytest.mark.asyncio
@pytest.mark.integration
async def test_list_gpus(test_client, db_session, mock_carbon_metrics):
    """Test listing available GPU resources with environmental metrics."""
    # Create test GPU records
    gpu1 = await GPUTestData.create_test_gpu_with_metrics(db_session)
    gpu2 = await GPUTestData.create_test_gpu_with_metrics(db_session)

    # Configure mock environmental metrics
    mock_carbon_metrics.return_value = {
        str(gpu1.id): SAMPLE_ENVIRONMENTAL_METRICS,
        str(gpu2.id): SAMPLE_ENVIRONMENTAL_METRICS
    }

    # Make request
    response = await test_client.get(f"{API_PREFIX}/gpus/")
    assert response.status_code == 200

    # Validate response format
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2

    # Verify GPU data
    for gpu in data:
        assert gpu['model'] == VALID_GPU_DATA['model']
        assert gpu['vram_gb'] == VALID_GPU_DATA['vram_gb']
        assert float(gpu['price_per_hour']) == float(VALID_GPU_DATA['price_per_hour'])

        # Validate environmental metrics
        env_metrics = gpu['environmental_metrics']
        assert 'co2_capture_rate' in env_metrics
        assert 'cooling_efficiency' in env_metrics
        assert 'pue' in env_metrics
        assert 'cue' in env_metrics
        assert 'wue' in env_metrics

        # Verify metrics ranges
        assert 0 <= env_metrics['cooling_efficiency'] <= 1
        assert env_metrics['pue'] >= 1.0
        assert 0 <= env_metrics['cue'] <= 2.0
        assert env_metrics['co2_capture_rate'] >= 0

@pytest.mark.asyncio
@pytest.mark.integration
async def test_get_gpu_metrics(test_client, db_session, mock_gpu_metrics, mock_carbon_metrics):
    """Test retrieving comprehensive GPU metrics including environmental data."""
    # Create test GPU
    gpu = await GPUTestData.create_test_gpu_with_metrics(db_session)

    # Configure mock metrics
    mock_gpu_metrics.return_value = {
        'hardware': SAMPLE_HARDWARE_METRICS,
        'timestamp': datetime.utcnow().isoformat()
    }
    mock_carbon_metrics.return_value = SAMPLE_ENVIRONMENTAL_METRICS

    # Make request
    response = await test_client.get(f"{API_PREFIX}/gpus/{gpu.id}/metrics")
    assert response.status_code == 200

    # Validate response data
    data = response.json()
    assert 'hardware_metrics' in data
    assert 'environmental_metrics' in data

    # Validate hardware metrics
    hw_metrics = data['hardware_metrics']
    assert hw_metrics['temperature'] == SAMPLE_HARDWARE_METRICS['temperature']
    assert hw_metrics['utilization'] == SAMPLE_HARDWARE_METRICS['utilization']
    assert hw_metrics['memory_used'] == SAMPLE_HARDWARE_METRICS['memory_used']
    assert hw_metrics['power_draw'] == SAMPLE_HARDWARE_METRICS['power_draw']

    # Validate environmental metrics
    env_metrics = data['environmental_metrics']
    assert env_metrics['co2_capture_rate'] == SAMPLE_ENVIRONMENTAL_METRICS['co2_capture_rate']
    assert env_metrics['pue'] == SAMPLE_ENVIRONMENTAL_METRICS['pue']
    assert env_metrics['cue'] == SAMPLE_ENVIRONMENTAL_METRICS['cue']
    assert env_metrics['wue'] == SAMPLE_ENVIRONMENTAL_METRICS['wue']
    assert env_metrics['cooling_efficiency'] == SAMPLE_ENVIRONMENTAL_METRICS['cooling_efficiency']

@pytest.mark.asyncio
@pytest.mark.integration
async def test_gpu_metrics_websocket(test_client, db_session, mock_gpu_metrics, mock_carbon_metrics):
    """Test GPU metrics WebSocket connection with real-time environmental data."""
    # Create test GPU
    gpu = await GPUTestData.create_test_gpu_with_metrics(db_session)

    # Configure mock metrics streams
    mock_gpu_metrics.return_value = {
        'hardware': SAMPLE_HARDWARE_METRICS,
        'timestamp': datetime.utcnow().isoformat()
    }
    mock_carbon_metrics.return_value = SAMPLE_ENVIRONMENTAL_METRICS

    # Connect to WebSocket
    async with test_client.websocket_connect(f"{API_PREFIX}/gpus/{gpu.id}/ws/environmental") as websocket:
        # Verify connection established
        assert websocket.client_state.connected

        # Receive initial metrics
        data = await websocket.receive_json()
        assert 'timestamp' in data
        assert 'gpu_id' in data
        assert 'metrics' in data

        # Validate metrics format
        metrics = data['metrics']
        assert 'power_efficiency' in metrics
        assert 'thermal_efficiency' in metrics
        assert 'carbon_efficiency' in metrics
        assert 'cooling_status' in metrics

        # Validate metrics ranges
        assert 0 <= metrics['power_efficiency'] <= 1
        assert 0 <= metrics['thermal_efficiency'] <= 1
        assert 0 <= metrics['carbon_efficiency'] <= 1
        assert isinstance(metrics['cooling_status'], dict)

        # Receive second metrics update
        data = await websocket.receive_json()
        assert 'timestamp' in data
        assert data['gpu_id'] == str(gpu.id)

        # Close connection
        await websocket.close()