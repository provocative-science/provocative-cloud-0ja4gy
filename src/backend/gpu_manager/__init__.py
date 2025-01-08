"""
GPU Manager package for Provocative Cloud platform.
Provides comprehensive GPU resource management with integrated carbon capture monitoring
and environmental impact tracking capabilities.

Version: 1.0.0
"""

from gpu_manager.manager import GPUManager
from gpu_manager.config import gpu_settings

# Version information
__version__ = "1.0.0"

# Define package exports
__all__ = ["GPUManager", "gpu_settings"]

# Package initialization
def initialize_gpu_manager() -> GPUManager:
    """
    Factory function to create and initialize a GPU Manager instance.
    Ensures proper setup of GPU resources and environmental monitoring.
    
    Returns:
        GPUManager: Initialized GPU manager instance
    """
    manager = GPUManager()
    return manager

# Package cleanup
def cleanup_gpu_manager(manager: GPUManager) -> None:
    """
    Cleanup function to properly shutdown GPU Manager and release resources.
    
    Args:
        manager: GPUManager instance to shutdown
    """
    if manager:
        manager.shutdown()

# Initialize global settings
gpu_config = gpu_settings.get_gpu_settings()
monitoring_config = gpu_settings.get_monitoring_settings()
environmental_config = gpu_settings.get_environmental_settings()
carbon_capture_config = gpu_settings.get_carbon_capture_settings()

# Validate configurations
if not all([gpu_config, monitoring_config, environmental_config, carbon_capture_config]):
    raise RuntimeError("Failed to initialize GPU Manager configurations")