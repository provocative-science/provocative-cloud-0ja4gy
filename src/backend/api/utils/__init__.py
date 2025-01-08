"""
Main entry point for the utils package, providing centralized access to utility functions
for logging, validation, GPU metrics, and carbon metrics tracking in the Provocative Cloud platform.
Implements comprehensive monitoring, data validation, and environmental impact tracking capabilities.
"""

__version__ = "1.0.0"

# Import logging utilities
from api.utils.logger import (
    setup_logging,
    get_request_logger,
    log_request,
    log_error
)

# Import validation utilities
from api.utils.validators import (
    validate_gpu_specifications,
    validate_payment_info,
    validate_email,
    validate_uuid
)

# Import GPU metrics utilities
from api.utils.gpu_metrics import (
    GPUMetricsCollector,
    collect_gpu_metrics,
    process_metrics,
    calculate_carbon_impact
)

# Import carbon metrics utilities
from api.utils.carbon_metrics import (
    CarbonMetricsCollector,
    calculate_co2_emissions,
    calculate_carbon_capture,
    calculate_carbon_effectiveness
)

# Export all utility functions and classes
__all__ = [
    # Logging utilities
    'setup_logging',
    'get_request_logger',
    'log_request',
    'log_error',
    
    # Validation utilities
    'validate_gpu_specifications',
    'validate_payment_info',
    'validate_email',
    'validate_uuid',
    
    # GPU metrics utilities
    'GPUMetricsCollector',
    'collect_gpu_metrics',
    'process_metrics',
    'calculate_carbon_impact',
    
    # Carbon metrics utilities
    'CarbonMetricsCollector',
    'calculate_co2_emissions',
    'calculate_carbon_capture',
    'calculate_carbon_effectiveness'
]

# Initialize logging system
setup_logging()

# Initialize metrics collectors
gpu_metrics_collector = GPUMetricsCollector()
carbon_metrics_collector = CarbonMetricsCollector()

def get_metrics_collectors():
    """
    Returns initialized instances of metrics collectors for GPU and carbon metrics.
    
    Returns:
        tuple: (GPUMetricsCollector, CarbonMetricsCollector) instances
    """
    return gpu_metrics_collector, carbon_metrics_collector

def start_metrics_collection():
    """
    Starts metrics collection for both GPU and carbon metrics with proper initialization.
    """
    gpu_metrics_collector.start_collection()
    carbon_metrics_collector.start_collection()

def stop_metrics_collection():
    """
    Stops metrics collection gracefully with cleanup.
    """
    gpu_metrics_collector.stop_collection()
    carbon_metrics_collector.stop_collection()

def validate_and_process_metrics(metrics_data: dict) -> dict:
    """
    Validates and processes incoming metrics data with comprehensive checks.
    
    Args:
        metrics_data: Raw metrics data to validate and process
        
    Returns:
        dict: Processed and validated metrics data
    """
    # Validate GPU specifications
    if not validate_gpu_specifications(metrics_data):
        raise ValueError("Invalid GPU metrics data")
        
    # Process GPU metrics
    processed_metrics = process_metrics(metrics_data)
    
    # Calculate environmental impact
    carbon_impact = calculate_carbon_impact(
        processed_metrics.get('power_usage', 0),
        processed_metrics.get('duration_hours', 1),
        processed_metrics.get('cooling_efficiency', 0.8),
        0.5  # Default CO2 capture rate
    )
    
    # Combine metrics
    processed_metrics['environmental_impact'] = carbon_impact
    
    return processed_metrics

def initialize_monitoring():
    """
    Initializes comprehensive monitoring system with logging and metrics collection.
    
    Returns:
        bool: Success status of initialization
    """
    try:
        # Set up logging
        setup_logging()
        
        # Initialize metrics collectors
        gpu_metrics_collector.start_collection()
        carbon_metrics_collector.start_collection()
        
        return True
    except Exception as e:
        log_error("Failed to initialize monitoring", error=str(e))
        return False

def cleanup_monitoring():
    """
    Performs cleanup of monitoring systems with proper shutdown.
    """
    try:
        # Stop metrics collection
        stop_metrics_collection()
        
        # Additional cleanup if needed
        pass
    except Exception as e:
        log_error("Failed to cleanup monitoring", error=str(e))