import pytest
import asyncio
from unittest.mock import Mock, patch
from datetime import datetime

from gpu_manager.manager import GPUManager
from tests.conftest import mock_gpu_metrics, mock_environmental_metrics

# Constants for testing
TEST_GPU_ID = "test-gpu-1"
TEST_TEMPERATURE = 65.0
TEST_POWER_USAGE = 250
TEST_MEMORY_USED = 40
TEST_MEMORY_TOTAL = 80
TEST_UTILIZATION = 75.0

@pytest.fixture
async def setup_gpu_manager():
    """Initialize GPU manager with mocked devices and monitoring."""
    manager = GPUManager()
    
    # Mock internal components
    manager._gpu_devices = {
        TEST_GPU_ID: Mock(
            device_id=TEST_GPU_ID,
            get_metrics=Mock(return_value={
                'temperature': TEST_TEMPERATURE,
                'power': {'current': TEST_POWER_USAGE},
                'memory': {
                    'used': TEST_MEMORY_USED,
                    'total': TEST_MEMORY_TOTAL
                },
                'utilization': {'gpu': TEST_UTILIZATION},
                'environmental': {
                    'power_efficiency': 0.85,
                    'thermal_efficiency': 0.90,
                    'carbon_efficiency': 0.875
                }
            })
        )
    }
    
    await manager.initialize()
    yield manager
    await manager.shutdown()

@pytest.mark.asyncio
async def test_initialize_gpu_manager(setup_gpu_manager):
    """Test GPU manager initialization with environmental monitoring."""
    manager = setup_gpu_manager
    
    assert manager._is_initialized
    assert len(manager._gpu_devices) > 0
    assert manager._metrics_collector is not None
    
    # Verify environmental monitoring setup
    assert manager._environmental_metrics == {}
    assert manager._cooling_status == {}
    assert manager._gpu_allocation_gauge is not None
    assert manager._cooling_efficiency_gauge is not None
    assert manager._carbon_capture_gauge is not None

@pytest.mark.asyncio
async def test_monitor_environmental_impact(setup_gpu_manager, mock_environmental_metrics):
    """Test environmental metrics collection and monitoring."""
    manager = setup_gpu_manager
    
    # Get environmental metrics
    env_metrics = await manager.monitor_environmental_impact()
    
    # Verify metrics structure
    assert TEST_GPU_ID in env_metrics
    gpu_metrics = env_metrics[TEST_GPU_ID]
    
    # Validate metric values
    assert 0 <= gpu_metrics['power_usage_watts'] <= 500
    assert 0 <= gpu_metrics['temperature_celsius'] <= 100
    assert 0 <= gpu_metrics['power_efficiency'] <= 1
    assert 0 <= gpu_metrics['thermal_efficiency'] <= 1
    assert 0 <= gpu_metrics['carbon_efficiency'] <= 1
    assert 'target_efficiency' in gpu_metrics

@pytest.mark.asyncio
async def test_optimize_cooling(setup_gpu_manager):
    """Test cooling system optimization functionality."""
    manager = setup_gpu_manager
    
    # Test cooling optimization
    result = await manager.optimize_cooling(TEST_GPU_ID)
    
    # Verify optimization result structure
    assert 'optimization_applied' in result
    assert 'temperature_reduced' in result
    assert 'new_power_limit' in result
    assert 'cooling_efficiency' in result
    
    # Validate optimization values
    assert isinstance(result['optimization_applied'], bool)
    if result['optimization_applied']:
        assert result['new_power_limit'] < TEST_POWER_USAGE
        assert 0 <= result['cooling_efficiency'] <= 1

@pytest.mark.asyncio
async def test_gpu_metrics_collection(setup_gpu_manager, mock_gpu_metrics):
    """Test GPU metrics collection with environmental data."""
    manager = setup_gpu_manager
    
    # Get metrics for test GPU
    gpu = manager._gpu_devices[TEST_GPU_ID]
    metrics = await gpu.get_metrics()
    
    # Verify metrics structure
    assert 'temperature' in metrics
    assert 'power' in metrics
    assert 'memory' in metrics
    assert 'utilization' in metrics
    assert 'environmental' in metrics
    
    # Validate environmental metrics
    env_metrics = metrics['environmental']
    assert 0 <= env_metrics['power_efficiency'] <= 1
    assert 0 <= env_metrics['thermal_efficiency'] <= 1
    assert 0 <= env_metrics['carbon_efficiency'] <= 1

@pytest.mark.asyncio
async def test_cooling_system_monitor(setup_gpu_manager):
    """Test continuous cooling system monitoring."""
    manager = setup_gpu_manager
    
    # Start monitoring
    monitor_task = asyncio.create_task(manager._cooling_system_monitor())
    
    # Let monitoring run briefly
    await asyncio.sleep(1)
    
    # Check cooling status
    assert TEST_GPU_ID in manager._cooling_status
    cooling_status = manager._cooling_status[TEST_GPU_ID]
    
    # Verify cooling status structure
    assert 'optimized' in cooling_status
    assert 'temperature_celsius' in cooling_status
    assert 'power_limit_watts' in cooling_status
    assert 'timestamp' in cooling_status
    
    # Cancel monitoring
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass

@pytest.mark.asyncio
async def test_environmental_metrics_monitor(setup_gpu_manager):
    """Test continuous environmental impact monitoring."""
    manager = setup_gpu_manager
    
    # Start monitoring
    monitor_task = asyncio.create_task(manager._monitor_environmental_impact())
    
    # Let monitoring run briefly
    await asyncio.sleep(1)
    
    # Verify metrics are being collected
    assert len(manager._environmental_metrics) > 0
    assert TEST_GPU_ID in manager._environmental_metrics
    
    # Validate collected metrics
    gpu_metrics = manager._environmental_metrics[TEST_GPU_ID]
    assert 'power_usage_watts' in gpu_metrics
    assert 'temperature_celsius' in gpu_metrics
    assert 'power_efficiency' in gpu_metrics
    assert 'thermal_efficiency' in gpu_metrics
    assert 'carbon_efficiency' in gpu_metrics
    
    # Cancel monitoring
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass

@pytest.mark.asyncio
async def test_shutdown_cleanup(setup_gpu_manager):
    """Test proper cleanup during shutdown."""
    manager = setup_gpu_manager
    
    # Perform shutdown
    await manager.shutdown()
    
    # Verify cleanup
    assert not manager._is_initialized
    assert manager._metrics_collector is None
    for gpu in manager._gpu_devices.values():
        assert gpu.reset_device.called

@pytest.mark.asyncio
async def test_prometheus_metrics_update(setup_gpu_manager):
    """Test Prometheus metrics updates."""
    manager = setup_gpu_manager
    
    # Get environmental metrics to trigger Prometheus updates
    await manager.monitor_environmental_impact()
    
    # Verify Prometheus metrics were updated
    assert manager._cooling_efficiency_gauge._value is not None
    assert manager._carbon_capture_gauge._value is not None