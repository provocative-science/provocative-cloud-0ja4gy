"""
Main entry point for service modules in the Provocative Cloud platform.
Provides centralized access to core business logic services including authentication,
GPU management, billing, and other platform services.
Version: 1.0.0
"""

import logging
from typing import Dict, List, Optional, Tuple
from fastapi import HTTPException

from .auth_service import AuthService
from .gpu_service import GPUService
from .billing_service import BillingService

# Version identifier
__version__ = "1.0.0"

# Export service classes
__all__ = ["AuthService", "GPUService", "BillingService"]

# Configure logging
logger = logging.getLogger(__name__)

async def initialize_services(config: Dict) -> Tuple[AuthService, GPUService, BillingService]:
    """
    Initializes all service components with proper error handling and logging.
    
    Args:
        config: Configuration dictionary containing service settings
        
    Returns:
        Tuple containing initialized service instances
        
    Raises:
        HTTPException: If service initialization fails
    """
    try:
        # Initialize authentication service
        auth_service = AuthService(
            db_session=config['db_session'],
            redis_client=config.get('redis_client')
        )
        logger.info("Authentication service initialized successfully")

        # Initialize GPU service with environmental monitoring
        gpu_service = GPUService(
            db_session=config['db_session'],
            gpu_manager=config['gpu_manager'],
            carbon_metrics=config.get('carbon_metrics')
        )
        logger.info("GPU service initialized successfully with environmental monitoring")

        # Initialize billing service with Stripe integration
        billing_service = BillingService(
            db=config['db_session'],
            rate_limiter=config['rate_limiter']
        )
        logger.info("Billing service initialized successfully")

        # Verify service health
        services = [auth_service, gpu_service, billing_service]
        health_status = await check_service_health(services)

        if not all(status['healthy'] for status in health_status.values()):
            unhealthy_services = [
                service for service, status in health_status.items()
                if not status['healthy']
            ]
            raise HTTPException(
                status_code=500,
                detail=f"Service initialization failed for: {', '.join(unhealthy_services)}"
            )

        return auth_service, gpu_service, billing_service

    except Exception as e:
        logger.error(f"Service initialization failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize services"
        )

async def check_service_health(services: List[any]) -> Dict:
    """
    Performs health checks on all initialized services.
    
    Args:
        services: List of service instances to check
        
    Returns:
        Dict containing health status of each service
        
    Raises:
        HTTPException: If health check fails
    """
    try:
        health_status = {}

        for service in services:
            service_name = service.__class__.__name__
            try:
                # Check database connection
                if hasattr(service, 'db') or hasattr(service, 'db_session'):
                    db = getattr(service, 'db', None) or getattr(service, 'db_session')
                    db.execute("SELECT 1")

                # Check Redis connection if applicable
                if hasattr(service, '_redis_client') and service._redis_client:
                    await service._redis_client.ping()

                # Check GPU manager connection if applicable
                if isinstance(service, GPUService) and service._gpu_manager:
                    await service._gpu_manager.get_metrics()

                # Service-specific health checks
                if isinstance(service, AuthService):
                    # Verify JWT configuration
                    assert service._verify_jwt_config()

                elif isinstance(service, BillingService):
                    # Verify Stripe connection
                    await service.stripe_service.create_payment_intent(
                        payment_data={"amount": 0.01, "currency": "USD"},
                        idempotency_key="health_check"
                    )

                health_status[service_name] = {
                    "healthy": True,
                    "timestamp": logging.Formatter().converter(),
                    "message": "Service is healthy"
                }

            except Exception as e:
                logger.error(f"Health check failed for {service_name}: {str(e)}")
                health_status[service_name] = {
                    "healthy": False,
                    "timestamp": logging.Formatter().converter(),
                    "error": str(e)
                }

        return health_status

    except Exception as e:
        logger.error(f"Service health check failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Service health check failed"
        )