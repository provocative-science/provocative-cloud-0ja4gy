"""
GPU Manager configuration settings with environment variables management.
Handles GPU-specific settings, monitoring configurations, resource allocation,
and environmental impact tracking parameters.
"""

from typing import Dict, List, Optional
from pydantic import BaseSettings, Field

from api.config import settings

class GPUManagerSettings(BaseSettings):
    """
    GPU manager settings using Pydantic BaseSettings for environment variable management
    with enhanced validation and environmental impact considerations.
    """
    # GPU Driver and Hardware Settings
    NVIDIA_DRIVER_PATH: str = Field(
        default="/usr/lib/nvidia-driver",
        env="NVIDIA_DRIVER_PATH",
        description="Path to NVIDIA driver installation"
    )
    NVIDIA_SMI_PATH: str = Field(
        default="/usr/bin/nvidia-smi",
        env="NVIDIA_SMI_PATH",
        description="Path to nvidia-smi binary"
    )
    
    # Resource Management Settings
    GPU_POLLING_INTERVAL: int = Field(
        default=settings.METRICS_COLLECTION_INTERVAL,
        env="GPU_POLLING_INTERVAL",
        description="GPU metrics collection interval in seconds"
    )
    MAX_POWER_LIMIT_WATTS: int = Field(
        default=300,
        env="MAX_POWER_LIMIT_WATTS",
        description="Maximum allowed GPU power limit in watts"
    )
    MIN_POWER_LIMIT_WATTS: int = Field(
        default=100,
        env="MIN_POWER_LIMIT_WATTS",
        description="Minimum allowed GPU power limit in watts"
    )
    DEFAULT_MEMORY_ALLOCATION: int = Field(
        default=90,
        env="DEFAULT_MEMORY_ALLOCATION",
        description="Default memory allocation percentage"
    )
    
    # Monitoring Thresholds
    TEMPERATURE_ALERT_THRESHOLD: float = Field(
        default=80.0,
        env="TEMPERATURE_ALERT_THRESHOLD",
        description="Temperature threshold for alerts in Celsius"
    )
    UTILIZATION_ALERT_THRESHOLD: float = Field(
        default=95.0,
        env="UTILIZATION_ALERT_THRESHOLD",
        description="GPU utilization threshold percentage for alerts"
    )
    
    # Hardware Management
    ENABLE_POWER_MANAGEMENT: bool = Field(
        default=True,
        env="ENABLE_POWER_MANAGEMENT",
        description="Enable dynamic power management"
    )
    ENABLE_ECC: bool = Field(
        default=True,
        env="ENABLE_ECC",
        description="Enable Error Correction Code memory"
    )
    ALLOWED_COMPUTE_MODES: List[str] = Field(
        default=[
            "Default",
            "Exclusive_Process",
            "Exclusive_Thread"
        ],
        env="ALLOWED_COMPUTE_MODES",
        description="Allowed GPU compute modes"
    )
    
    # Environmental Impact Settings
    CARBON_EFFICIENCY_TARGET: float = Field(
        default=0.85,
        env="CARBON_EFFICIENCY_TARGET",
        description="Target carbon efficiency ratio (0-1)"
    )
    COOLING_SYSTEM_THRESHOLD: int = Field(
        default=75,
        env="COOLING_SYSTEM_THRESHOLD",
        description="Temperature threshold for cooling system activation in Celsius"
    )

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    def get_gpu_settings(self) -> Dict:
        """
        Returns GPU-specific configuration settings with hardware validation.
        """
        return {
            "driver_path": self.NVIDIA_DRIVER_PATH,
            "smi_path": self.NVIDIA_SMI_PATH,
            "power_management": {
                "enabled": self.ENABLE_POWER_MANAGEMENT,
                "max_limit": self.MAX_POWER_LIMIT_WATTS,
                "min_limit": self.MIN_POWER_LIMIT_WATTS
            },
            "memory": {
                "ecc_enabled": self.ENABLE_ECC,
                "default_allocation": self.DEFAULT_MEMORY_ALLOCATION
            },
            "compute_modes": self.ALLOWED_COMPUTE_MODES
        }

    def get_monitoring_settings(self) -> Dict:
        """
        Returns monitoring-specific configuration settings including environmental metrics.
        """
        return {
            "polling_interval": self.GPU_POLLING_INTERVAL,
            "thresholds": {
                "temperature": self.TEMPERATURE_ALERT_THRESHOLD,
                "utilization": self.UTILIZATION_ALERT_THRESHOLD,
                "cooling_system": self.COOLING_SYSTEM_THRESHOLD
            },
            "metrics_interval": settings.METRICS_COLLECTION_INTERVAL
        }

    def get_environmental_settings(self) -> Dict:
        """
        Returns environmental impact and power management settings.
        """
        return {
            "carbon_efficiency": {
                "target": self.CARBON_EFFICIENCY_TARGET,
                "monitoring_enabled": True
            },
            "cooling": {
                "threshold": self.COOLING_SYSTEM_THRESHOLD,
                "power_management_enabled": self.ENABLE_POWER_MANAGEMENT
            },
            "power_limits": {
                "max_watts": self.MAX_POWER_LIMIT_WATTS,
                "min_watts": self.MIN_POWER_LIMIT_WATTS
            }
        }

# Global settings instance
gpu_settings = GPUManagerSettings()