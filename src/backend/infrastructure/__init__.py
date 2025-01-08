"""
Infrastructure package initialization module for Provocative Cloud platform.
Exports core infrastructure management components with integrated environmental
impact monitoring, enhanced error handling, and comprehensive logging.
"""

import logging
import structlog
from typing import Dict

# External imports with versions
from logging import Logger  # version: 3.10+
import structlog  # version: 23.1.0

# Internal imports
from infrastructure.docker import DockerManager
from infrastructure.kubernetes import KubernetesManager
from infrastructure.vm import VMManager
from infrastructure.storage import StorageManager
from infrastructure.networking import NetworkManager

# Configure logging
logger: Logger = structlog.get_logger(__name__)

# Package version
VERSION = '1.1.0'

# Global retry configuration
RETRY_CONFIG = {
    'max_attempts': 3,
    'backoff_factor': 1.5
}

# Initialize managers with environmental monitoring
try:
    # Export core infrastructure components
    __all__ = [
        'DockerManager',
        'KubernetesManager', 
        'VMManager',
        'StorageManager',
        'NetworkManager',
        'VERSION',
        'RETRY_CONFIG'
    ]

    logger.info(
        "Infrastructure package initialized",
        version=VERSION,
        components=__all__,
        retry_config=RETRY_CONFIG
    )

except Exception as e:
    logger.error(
        "Infrastructure package initialization failed",
        error=str(e),
        version=VERSION
    )
    raise

def get_infrastructure_status() -> Dict:
    """
    Returns comprehensive status of all infrastructure components.
    
    Returns:
        Dict containing status and metrics for all infrastructure components
    """
    try:
        return {
            'version': VERSION,
            'components': {
                'docker': DockerManager.__name__,
                'kubernetes': KubernetesManager.__name__,
                'vm': VMManager.__name__,
                'storage': StorageManager.__name__,
                'network': NetworkManager.__name__
            },
            'retry_config': RETRY_CONFIG,
            'status': 'initialized'
        }
    except Exception as e:
        logger.error(
            "Failed to get infrastructure status",
            error=str(e)
        )
        raise

def validate_infrastructure_config() -> bool:
    """
    Validates configuration of all infrastructure components.
    
    Returns:
        bool indicating whether all components are properly configured
    """
    try:
        # Validate each component's configuration
        validations = [
            hasattr(DockerManager, 'create_container'),
            hasattr(KubernetesManager, 'create_deployment'),
            hasattr(VMManager, 'create_vm'),
            hasattr(StorageManager, 'create_volume'),
            hasattr(NetworkManager, 'create_virtual_network')
        ]
        
        return all(validations)
        
    except Exception as e:
        logger.error(
            "Infrastructure configuration validation failed",
            error=str(e)
        )
        return False