"""
Entry point for the Provocative Cloud FastAPI application.
Initializes and runs the API server with comprehensive configuration,
middleware stack, and environmental monitoring integration.
"""

import asyncio
import logging
import signal
import sys
from typing import Dict, Optional

import uvicorn
from prometheus_client import start_http_server
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .app import create_application
from .config import settings
from .dependencies import get_db_session
from .utils.logger import setup_logging
from .utils.carbon_metrics import initialize_carbon_monitoring

# Initialize structured logging
logger = structlog.get_logger(__name__)

# Global constants
HOST = "0.0.0.0"
PORT = 8000
RELOAD = settings.DEBUG_MODE
WORKERS = settings.WORKER_COUNT
SSL_KEYFILE = settings.get_database_settings().get('ssl', {}).get('sslkey')
SSL_CERTFILE = settings.get_database_settings().get('ssl', {}).get('sslcert')
LOG_LEVEL = settings.LOG_LEVEL
METRICS_PORT = 9090

async def startup() -> None:
    """
    Async startup function that initializes all required services and validates dependencies.
    """
    try:
        logger.info("Starting Provocative Cloud API")

        # Initialize database connection with retry logic
        async with get_db_session() as db:
            await db.execute("SELECT 1")  # Verify database connection
            logger.info("Database connection established")

        # Initialize carbon monitoring system
        if not initialize_carbon_monitoring():
            raise RuntimeError("Failed to initialize carbon monitoring")
        logger.info("Carbon monitoring system initialized")

        # Start Prometheus metrics server
        start_http_server(METRICS_PORT)
        logger.info(f"Prometheus metrics server started on port {METRICS_PORT}")

        # Initialize environmental metrics collectors
        await initialize_environmental_metrics()
        logger.info("Environmental metrics collectors initialized")

        logger.info("Startup sequence completed successfully")

    except Exception as e:
        logger.error(f"Startup failed: {str(e)}")
        sys.exit(1)

async def shutdown() -> None:
    """
    Async shutdown function that gracefully stops all services and cleans up resources.
    """
    try:
        logger.info("Initiating graceful shutdown")

        # Stop metrics collection
        logger.info("Stopping metrics collection")
        # Cleanup will be handled by the metrics collector's context manager

        # Close database connections
        async with get_db_session() as db:
            await db.close()
        logger.info("Database connections closed")

        # Save final environmental metrics snapshot
        await save_final_metrics()
        logger.info("Final metrics snapshot saved")

        logger.info("Shutdown sequence completed successfully")

    except Exception as e:
        logger.error(f"Shutdown error: {str(e)}")
        sys.exit(1)

async def initialize_environmental_metrics() -> None:
    """Initialize environmental metrics collectors and monitoring."""
    try:
        # Configure environmental metrics collection
        env_settings = settings.get_environmental_settings()
        
        # Initialize metrics collectors
        # This will be handled by the carbon_metrics module
        
        logger.info(
            "Environmental metrics initialized",
            extra={"settings": env_settings}
        )

    except Exception as e:
        logger.error(f"Failed to initialize environmental metrics: {str(e)}")
        raise

async def save_final_metrics() -> None:
    """Save final metrics snapshot before shutdown."""
    try:
        # Final metrics collection will be handled by the metrics collector
        logger.info("Final metrics snapshot completed")

    except Exception as e:
        logger.error(f"Failed to save final metrics: {str(e)}")

def handle_signals(signal_num: int, frame) -> None:
    """
    Signal handler for graceful shutdown on system signals.
    
    Args:
        signal_num: System signal number
        frame: Current stack frame
    """
    logger.info(f"Received signal {signal_num}")
    asyncio.create_task(shutdown())

def main() -> None:
    """
    Main entry point function that starts the FastAPI application server
    with comprehensive error handling and monitoring.
    """
    try:
        # Configure structured logging
        setup_logging(log_level=LOG_LEVEL)
        logger.info("Logging configured")

        # Create FastAPI application
        app = create_application()
        logger.info("FastAPI application created")

        # Register startup and shutdown handlers
        app.add_event_handler("startup", startup)
        app.add_event_handler("shutdown", shutdown)

        # Register signal handlers
        signal.signal(signal.SIGTERM, handle_signals)
        signal.signal(signal.SIGINT, handle_signals)

        # Configure CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.CORS_ORIGINS,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"]
        )

        # Start uvicorn server
        config = {
            "app": app,
            "host": HOST,
            "port": PORT,
            "workers": WORKERS,
            "reload": RELOAD,
            "log_level": LOG_LEVEL.lower(),
            "proxy_headers": True,
            "forwarded_allow_ips": "*"
        }

        # Add SSL configuration in production
        if settings.ENVIRONMENT == "production":
            if not all([SSL_KEYFILE, SSL_CERTFILE]):
                raise ValueError("SSL certificates required in production")
            config.update({
                "ssl_keyfile": SSL_KEYFILE,
                "ssl_certfile": SSL_CERTFILE
            })

        logger.info(
            "Starting uvicorn server",
            extra={"host": HOST, "port": PORT, "workers": WORKERS}
        )
        uvicorn.run(**config)

    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()