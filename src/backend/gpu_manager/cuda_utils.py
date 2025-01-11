"""
CUDA utility module providing low-level CUDA operations, context management,
memory utilities, power management, and environmental metrics collection
for GPU resource management.
"""

from functools import wraps
from typing import Dict, Optional, Any
import logging
from collections import deque

import numpy as np
from numba import cuda  # version: 0.57+
import pycuda.driver as drv  # version: 2022.1+
import pycuda.autoinit

from gpu_manager.config import gpu_settings

# Global Constants
CUDA_BLOCK_SIZE = 256
MAX_SHARED_MEMORY = 49152  # 48KB
DEFAULT_STREAM = 0
POWER_SAMPLING_INTERVAL = 1000  # ms
THERMAL_THRESHOLD_CELSIUS = 85
MEMORY_POOL_SIZE = 1073741824  # 1GB
GC_THRESHOLD = 0.9
POWER_METRICS_BUFFER_SIZE = 1000
THERMAL_METRICS_BUFFER_SIZE = 1000

# Configure logging
logger = logging.getLogger(__name__)

def cuda_error_handler(func):
    """Decorator for handling CUDA errors with detailed logging."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except cuda.CudaError as e:
            logger.error(f"CUDA Error in {func.__name__}: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error in {func.__name__}: {str(e)}")
            raise
    return wrapper

class CUDAMemoryPool:
    """Manages a pool of pre-allocated GPU memory for efficient allocation."""
    
    _instance = None
    
    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, initial_size: int = MEMORY_POOL_SIZE, growth_factor: float = 1.5):
        if not hasattr(self, 'initialized'):
            self.memory_blocks = {}
            self.total_size = initial_size
            self.growth_factor = growth_factor
            self.fragmentation_ratio = 0.0
            self.free_blocks = []
            self._initialize_pool()
            self.initialized = True
    
    @cuda_error_handler
    def _initialize_pool(self):
        """Initialize the memory pool with initial allocation."""
        self.memory_blocks['main'] = cuda.mem_alloc(self.total_size)
        self.free_blocks.append((self.total_size, self.memory_blocks['main']))
    
    @cuda_error_handler
    def allocate_from_pool(self, size_bytes: int) -> Any:
        """Allocates memory from pool with fragmentation handling."""
        if size_bytes <= 0:
            raise ValueError("Allocation size must be positive")
            
        # Find best fit block
        best_fit = None
        for i, (block_size, block) in enumerate(self.free_blocks):
            if block_size >= size_bytes:
                if best_fit is None or block_size < self.free_blocks[best_fit][0]:
                    best_fit = i
        
        if best_fit is not None:
            block_size, block = self.free_blocks.pop(best_fit)
            if block_size - size_bytes > 256:  # Minimum fragment size
                new_block = int(block) + size_bytes
                self.free_blocks.append((block_size - size_bytes, cuda.mem_alloc(new_block)))
            return block
            
        # Handle pool growth if needed
        if size_bytes > self.total_size:
            new_size = max(size_bytes, int(self.total_size * self.growth_factor))
            new_block = cuda.mem_alloc(new_size)
            self.total_size = new_size
            return new_block
            
        # Trigger garbage collection if needed
        if len(self.free_blocks) > 0:
            self._collect_garbage()
            return self.allocate_from_pool(size_bytes)
            
        raise cuda.CudaError("Out of GPU memory")

    @cuda_error_handler
    def _collect_garbage(self):
        """Performs garbage collection on the memory pool."""
        cuda.current_context().synchronize()
        self.free_blocks = [(size, block) for size, block in self.free_blocks if int(block) != 0]
        self.fragmentation_ratio = 1.0 - sum(size for size, _ in self.free_blocks) / self.total_size

class EnvironmentalMetricsCollector:
    """Collects and manages GPU environmental metrics internally."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, 'initialized'):
            self.power_readings_buffer = {i: deque(maxlen=POWER_METRICS_BUFFER_SIZE) 
                                       for i in range(drv.Device.count())}
            self.thermal_metrics_buffer = {i: deque(maxlen=THERMAL_METRICS_BUFFER_SIZE) 
                                        for i in range(drv.Device.count())}
            self.carbon_efficiency = 0.0
            self.initialized = True
    
    @cuda_error_handler
    def collect_metrics(self, device_id: int) -> Dict:
        """Collects comprehensive environmental metrics."""
        device = cuda.get_current_device()
        
        # Get power consumption
        power_usage = drv.Device(device_id).get_power_usage()
        self.power_readings_buffer[device_id].append(power_usage)
        
        # Get temperature
        temperature = device.get_attribute(drv.device_attribute.GPU_TEMP)
        self.thermal_metrics_buffer[device_id].append(temperature)
        
        # Calculate efficiency metrics
        avg_power = np.mean(list(self.power_readings_buffer[device_id]))
        avg_temp = np.mean(list(self.thermal_metrics_buffer[device_id]))
        
        # Update carbon efficiency based on power usage and cooling needs
        power_efficiency = 1.0 - (avg_power / gpu_settings.MAX_POWER_LIMIT_WATTS)
        thermal_efficiency = 1.0 - (avg_temp / THERMAL_THRESHOLD_CELSIUS)
        self.carbon_efficiency = (power_efficiency + thermal_efficiency) / 2
        
        return {
            'power_usage': power_usage,
            'temperature': temperature,
            'average_power': avg_power,
            'average_temperature': avg_temp,
            'carbon_efficiency': self.carbon_efficiency
        }

@cuda_error_handler
def initialize_cuda() -> bool:
    """Initializes CUDA runtime with enhanced error handling and driver validation."""
    try:
        if not drv.get_version():
            raise RuntimeError("CUDA driver not found")
            
        # Initialize CUDA context
        cuda.select_device(0)
        cuda.close()
        cuda.init()
        
        # Validate driver version
        required_version = 11.0
        if drv.get_version() < required_version:
            raise RuntimeError(f"CUDA driver version {required_version} or higher required")
        
        # Initialize memory pool
        CUDAMemoryPool()
        
        # Configure power management
        for device in range(drv.Device.count()):
            if gpu_settings.ENABLE_POWER_MANAGEMENT:
                drv.Device(device).set_power_management_limit(gpu_settings.MAX_POWER_LIMIT_WATTS)
        
        return True
    except Exception as e:
        logger.error(f"CUDA initialization failed: {str(e)}")
        return False

@cuda_error_handler
def manage_power_state(device_id: int, power_state: str) -> bool:
    """Manages GPU power states for optimal efficiency."""
    try:
        device = drv.Device(device_id)
        current_power = device.get_power_usage()
        
        if power_state == "low":
            target_power = gpu_settings.MIN_POWER_LIMIT_WATTS
        elif power_state == "high":
            target_power = gpu_settings.MAX_POWER_LIMIT_WATTS
        else:
            raise ValueError(f"Invalid power state: {power_state}")
            
        device.set_power_management_limit(target_power)
        
        # Verify power state change
        new_power = device.get_power_usage()
        success = abs(new_power - target_power) <= (target_power * 0.1)  # 10% tolerance
        
        if success:
            record_environmental_metrics(device_id, new_power, device.get_attribute(drv.device_attribute.GPU_TEMP))
            
        return success
    except Exception as e:
        logger.error(f"Power state management failed: {str(e)}")
        return False

@cuda_error_handler
def record_environmental_metrics(device_id: int, power_reading: float, temperature: float) -> Dict:
    """Records power usage and thermal metrics internally."""
    try:
        if not (0 <= power_reading <= gpu_settings.MAX_POWER_LIMIT_WATTS):
            raise ValueError(f"Invalid power reading: {power_reading}")
        if not (0 <= temperature <= THERMAL_THRESHOLD_CELSIUS):
            raise ValueError(f"Invalid temperature reading: {temperature}")
            
        collector = EnvironmentalMetricsCollector()
        collector.power_readings_buffer[device_id].append(power_reading)
        collector.thermal_metrics_buffer[device_id].append(temperature)
        
        return {
            'device_id': device_id,
            'power_reading': power_reading,
            'temperature': temperature,
            'power_efficiency': 1.0 - (power_reading / gpu_settings.MAX_POWER_LIMIT_WATTS),
            'thermal_efficiency': 1.0 - (temperature / THERMAL_THRESHOLD_CELSIUS)
        }
    except Exception as e:
        logger.error(f"Environmental metrics recording failed: {str(e)}")
        raise
