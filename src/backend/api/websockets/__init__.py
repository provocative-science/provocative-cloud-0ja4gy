"""
WebSocket initialization module for real-time GPU metrics, system updates, and environmental impact tracking.
Provides centralized WebSocket connection management and metrics distribution with comprehensive error handling.
"""

from typing import Dict, Optional
import logging

from api.websockets.manager import WebSocketManager
from api.websockets.gpu_metrics import GPUMetricsWebSocket
from api.utils.logger import get_logger

# Initialize logger
logger = get_logger(__name__)

# Initialize global WebSocket manager with connection lifecycle settings
websocket_manager = WebSocketManager()

# Initialize GPU metrics handler with environmental tracking
gpu_metrics_handler = GPUMetricsWebSocket()

async def initialize_websocket_handlers() -> None:
    """
    Initialize WebSocket handlers and monitoring systems.
    Sets up connection management, metrics collection, and environmental tracking.
    """
    try:
        logger.info("Initializing WebSocket handlers and monitoring systems")
        
        # Start GPU metrics collection with environmental tracking
        await gpu_metrics_handler.start_collection()
        
        # Initialize connection cleanup task
        await websocket_manager.start_cleanup_task()
        
        logger.info("WebSocket handlers initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize WebSocket handlers: {str(e)}")
        raise

async def cleanup_websocket_handlers() -> None:
    """
    Cleanup WebSocket handlers and monitoring systems.
    Ensures graceful shutdown of connections and metrics collection.
    """
    try:
        logger.info("Cleaning up WebSocket handlers")
        
        # Stop GPU metrics collection
        await gpu_metrics_handler.stop_collection()
        
        # Cleanup all active connections
        await websocket_manager.cleanup_all_connections()
        
        logger.info("WebSocket handlers cleaned up successfully")
    except Exception as e:
        logger.error(f"Failed to cleanup WebSocket handlers: {str(e)}")
        raise

async def handle_client_connection(
    websocket: "WebSocket",
    client_id: Optional[str] = None,
    preferences: Optional[Dict] = None
) -> str:
    """
    Handle new WebSocket client connection with monitoring preferences.
    
    Args:
        websocket: The WebSocket connection instance
        client_id: Optional client identifier
        preferences: Optional monitoring preferences including environmental tracking
        
    Returns:
        str: Unique connection identifier
        
    Raises:
        Exception: If connection handling fails
    """
    try:
        # Set default preferences if none provided
        preferences = preferences or {
            "monitor_environmental": True,
            "metrics_interval": 60,
            "batch_size": 100
        }
        
        # Register connection with WebSocket manager
        connection_id = await websocket_manager.connect(websocket, client_id)
        
        # Initialize GPU metrics monitoring for client
        await gpu_metrics_handler.connect_client(websocket, preferences)
        
        logger.info(
            "Client connected successfully",
            extra={
                "connection_id": connection_id,
                "client_id": client_id,
                "preferences": preferences
            }
        )
        
        return connection_id
    except Exception as e:
        logger.error(
            "Failed to handle client connection",
            extra={
                "client_id": client_id,
                "error": str(e)
            }
        )
        raise

async def handle_client_disconnection(connection_id: str) -> None:
    """
    Handle client disconnection with cleanup.
    
    Args:
        connection_id: The unique identifier of the connection to disconnect
        
    Raises:
        Exception: If disconnection handling fails
    """
    try:
        # Cleanup GPU metrics monitoring
        await gpu_metrics_handler.disconnect_client(connection_id)
        
        # Remove connection from WebSocket manager
        await websocket_manager.disconnect(connection_id)
        
        logger.info(
            "Client disconnected successfully",
            extra={"connection_id": connection_id}
        )
    except Exception as e:
        logger.error(
            "Failed to handle client disconnection",
            extra={
                "connection_id": connection_id,
                "error": str(e)
            }
        )
        raise

# Export WebSocket manager and GPU metrics handler instances
__all__ = [
    "websocket_manager",
    "gpu_metrics_handler",
    "initialize_websocket_handlers",
    "cleanup_websocket_handlers",
    "handle_client_connection",
    "handle_client_disconnection"
]