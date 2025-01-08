"""
Main FastAPI application configuration and initialization module for the Provocative Cloud platform.
Implements core API functionality with environmental metrics integration, enhanced security,
and real-time monitoring capabilities.
"""

import logging
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, Request, WebSocket, status
from fastapi.responses import JSONResponse
from prometheus_client import Counter, Gauge, Histogram  # version: 0.17.0
import structlog  # version: 23.1.0

from .middleware import setup_middleware
from .routes.auth import router as auth_router
from .routes.gpus import router as gpu_router
from .dependencies import get_db_session
from .utils.carbon_metrics import initialize_carbon_monitoring
from .config import settings

# Initialize structured logging
logger = structlog.get_logger()

# Initialize Prometheus metrics
api_requests = Counter(
    'api_requests_total',
    'Total number of API requests',
    ['endpoint', 'method']
)

environmental_metrics = Gauge(
    'environmental_metrics',
    'Environmental impact metrics',
    ['metric_type']
)

request_latency = Histogram(
    'request_latency_seconds',
    'Request latency in seconds',
    ['endpoint']
)

def create_application() -> FastAPI:
    """
    Creates and configures the FastAPI application instance with environmental monitoring.
    
    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Initialize FastAPI with enhanced documentation
    app = FastAPI(
        title="Provocative Cloud API",
        version="1.0.0",
        description="GPU rental platform with integrated carbon capture",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_tags=[
            {
                "name": "Authentication",
                "description": "User authentication and authorization endpoints"
            },
            {
                "name": "GPU Resources",
                "description": "GPU management and monitoring endpoints"
            },
            {
                "name": "Environmental",
                "description": "Environmental metrics and carbon capture endpoints"
            }
        ]
    )

    # Configure middleware stack
    setup_middleware(app)

    # Configure routers
    configure_routers(app)

    # Initialize environmental monitoring
    initialize_carbon_monitoring()

    # Configure exception handlers
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
        """Global exception handler with structured logging."""
        logger.error(
            "Request failed",
            error=str(exc),
            status_code=exc.status_code,
            path=request.url.path,
            method=request.method
        )
        
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "status_code": exc.status_code,
                "path": request.url.path
            }
        )

    # Configure startup event handler
    @app.on_event("startup")
    async def startup_event_handler() -> None:
        """Handles application startup tasks including metrics initialization."""
        logger.info("Starting Provocative Cloud API")
        
        try:
            # Initialize database connection
            async with get_db_session() as db:
                await db.execute("SELECT 1")  # Verify database connection
            
            # Initialize environmental metrics
            environmental_metrics.labels(metric_type="carbon_capture_rate").set(0)
            environmental_metrics.labels(metric_type="cooling_efficiency").set(1.0)
            
            logger.info("Application startup completed successfully")
            
        except Exception as e:
            logger.error(f"Startup failed: {str(e)}")
            raise

    # Configure shutdown event handler
    @app.on_event("shutdown")
    async def shutdown_event_handler() -> None:
        """Handles graceful application shutdown."""
        logger.info("Shutting down Provocative Cloud API")
        
        try:
            # Cleanup tasks
            await cleanup_resources()
            logger.info("Application shutdown completed successfully")
            
        except Exception as e:
            logger.error(f"Shutdown error: {str(e)}")
            raise

    # Configure health check endpoint
    @app.get("/health")
    async def health_check() -> Dict:
        """Health check endpoint with enhanced monitoring."""
        return {
            "status": "healthy",
            "version": app.version,
            "environment": settings.ENVIRONMENT
        }

    return app

def configure_routers(app: FastAPI) -> None:
    """
    Configures and includes all API route handlers including environmental endpoints.
    
    Args:
        app: FastAPI application instance
    """
    # Include authentication routes
    app.include_router(
        auth_router,
        prefix="/api/v1",
        tags=["Authentication"]
    )

    # Include GPU management routes
    app.include_router(
        gpu_router,
        prefix="/api/v1",
        tags=["GPU Resources"]
    )

    # Configure WebSocket endpoint for real-time metrics
    @app.websocket("/api/v1/metrics/ws")
    async def metrics_websocket(websocket: WebSocket) -> None:
        """WebSocket endpoint for real-time metrics streaming."""
        await websocket.accept()
        
        try:
            while True:
                # Get latest environmental metrics
                metrics = await get_environmental_metrics()
                await websocket.send_json(metrics)
                await asyncio.sleep(5)  # Update every 5 seconds
                
        except Exception as e:
            logger.error(f"WebSocket error: {str(e)}")
            await websocket.close(code=status.WS_1011_INTERNAL_ERROR)

async def cleanup_resources() -> None:
    """Cleanup resources during shutdown."""
    try:
        # Cleanup tasks here
        pass
    except Exception as e:
        logger.error(f"Resource cleanup failed: {str(e)}")
        raise

async def get_environmental_metrics() -> Dict:
    """
    Retrieves current environmental metrics.
    
    Returns:
        Dict: Current environmental metrics
    """
    try:
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "carbon_capture_rate": environmental_metrics.labels(
                metric_type="carbon_capture_rate"
            )._value.get(),
            "cooling_efficiency": environmental_metrics.labels(
                metric_type="cooling_efficiency"
            )._value.get()
        }
    except Exception as e:
        logger.error(f"Failed to get environmental metrics: {str(e)}")
        raise

# Create global application instance
app = create_application()