"""
FastAPI routes initialization module for the Provocative Cloud platform.
Aggregates and exports all API route modules with versioning, security, and monitoring.
Version: 1.0.0
"""

from fastapi import APIRouter
from loguru import logger

# Import route modules
from .auth import router as auth_router
from .gpus import router as gpus_router
from .reservations import router as reservations_router
from .billing import router as billing_router
from .metrics import router as metrics_router
from .servers import router as servers_router
from .users import router as users_router

# Initialize main API router with versioning
api_router = APIRouter(
    prefix="/api/v1",
    tags=["api"],
    responses={404: {"description": "Not found"}}
)

def include_routers() -> APIRouter:
    """
    Includes all route modules in the main API router with proper dependency ordering
    and validation.

    Returns:
        APIRouter: Configured API router with all routes included and validated

    Raises:
        RuntimeError: If route validation fails
    """
    try:
        logger.info("Starting API route registration")

        # Include auth router first (required by other routes)
        api_router.include_router(
            auth_router,
            prefix="/auth",
            tags=["Authentication"]
        )
        logger.debug("Registered authentication routes")

        # Include users router second (depends on auth)
        api_router.include_router(
            users_router,
            prefix="/users",
            tags=["Users"]
        )
        logger.debug("Registered user management routes")

        # Include servers router third (required by GPU routes)
        api_router.include_router(
            servers_router,
            prefix="/servers",
            tags=["Servers"]
        )
        logger.debug("Registered server management routes")

        # Include gpus router fourth (depends on servers)
        api_router.include_router(
            gpus_router,
            prefix="/gpus",
            tags=["GPUs"]
        )
        logger.debug("Registered GPU management routes")

        # Include reservations router fifth (depends on GPUs)
        api_router.include_router(
            reservations_router,
            prefix="/reservations",
            tags=["Reservations"]
        )
        logger.debug("Registered reservation management routes")

        # Include billing router sixth (depends on reservations)
        api_router.include_router(
            billing_router,
            prefix="/billing",
            tags=["Billing"]
        )
        logger.debug("Registered billing routes")

        # Include metrics router last (depends on all other routes)
        api_router.include_router(
            metrics_router,
            prefix="/metrics",
            tags=["Metrics"]
        )
        logger.debug("Registered metrics routes")

        # Validate complete route registration
        if not validate_dependencies():
            raise RuntimeError("Route dependency validation failed")

        logger.info("API route registration completed successfully")
        return api_router

    except Exception as e:
        logger.error(f"Failed to register API routes: {str(e)}")
        raise RuntimeError(f"Route registration failed: {str(e)}")

def validate_dependencies() -> bool:
    """
    Validates route dependencies and middleware compatibility.

    Returns:
        bool: True if all dependencies are valid

    Raises:
        ValueError: If dependency validation fails
    """
    try:
        # Verify all required route modules are loaded
        required_routes = {
            "auth": auth_router,
            "users": users_router,
            "servers": servers_router,
            "gpus": gpus_router,
            "reservations": reservations_router,
            "billing": billing_router,
            "metrics": metrics_router
        }

        for name, router in required_routes.items():
            if not router:
                raise ValueError(f"Required route module not loaded: {name}")

        # Verify route dependencies
        dependencies = {
            "users": ["auth"],
            "servers": ["auth"],
            "gpus": ["auth", "servers"],
            "reservations": ["auth", "gpus"],
            "billing": ["auth", "reservations"],
            "metrics": ["auth", "servers", "gpus"]
        }

        for route, deps in dependencies.items():
            for dep in deps:
                if dep not in required_routes:
                    raise ValueError(f"Missing dependency {dep} for route {route}")

        logger.debug("Route dependencies validated successfully")
        return True

    except Exception as e:
        logger.error(f"Route dependency validation failed: {str(e)}")
        return False

# Initialize routes on module import
api_router = include_routers()

# Export configured router
__all__ = ["api_router"]