"""
WebSocket connection manager for handling real-time communication in the Provocative Cloud platform.
Implements connection lifecycle management, secure message broadcasting, health monitoring,
and automatic connection cleanup with comprehensive metrics collection.
"""

import asyncio
import json
from typing import Dict, List, Optional, Set
import uuid
from fastapi import WebSocket, WebSocketDisconnect, HTTPException
from datetime import datetime, timezone

from api.utils.logger import get_logger

# Constants for WebSocket management
PING_INTERVAL = 30.0  # Seconds between ping messages
PING_TIMEOUT = 10.0   # Seconds to wait for pong response
MAX_CONNECTIONS = 10000  # Maximum concurrent connections
MAX_MESSAGE_SIZE = 1048576  # Maximum message size in bytes (1MB)
BROADCAST_TIMEOUT = 5.0  # Seconds to wait for broadcast completion

logger = get_logger(__name__)

class WebSocketManager:
    """
    Manages WebSocket connections with support for secure message broadcasting,
    connection health monitoring, and automatic cleanup of stale connections.
    """

    def __init__(self):
        """Initialize WebSocket manager with connection tracking and monitoring."""
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_ids: Dict[str, str] = {}  # WebSocket -> connection_id mapping
        self.connection_latencies: Dict[str, float] = {}
        self.message_counts: Dict[str, int] = {}
        self._lock = asyncio.Lock()
        self._monitoring_tasks: Dict[str, asyncio.Task] = {}

    async def connect(self, websocket: WebSocket, client_id: Optional[str] = None) -> str:
        """
        Handle new WebSocket connection with validation and rate limiting.
        
        Args:
            websocket: The WebSocket connection instance
            client_id: Optional client identifier for connection tracking
            
        Returns:
            str: Unique connection ID for the established connection
            
        Raises:
            HTTPException: If connection limit is reached or validation fails
        """
        async with self._lock:
            if len(self.active_connections) >= MAX_CONNECTIONS:
                logger.warning("Connection limit reached", extra={"max_connections": MAX_CONNECTIONS})
                raise HTTPException(status_code=503, detail="Connection limit reached")

            connection_id = str(uuid.uuid4())
            try:
                await websocket.accept()
                self.active_connections[connection_id] = websocket
                self.connection_ids[id(websocket)] = connection_id
                self.connection_latencies[connection_id] = 0.0
                self.message_counts[connection_id] = 0

                # Start connection monitoring
                self._monitoring_tasks[connection_id] = asyncio.create_task(
                    self.monitor_connection(connection_id)
                )

                logger.info(
                    "WebSocket connection established",
                    extra={
                        "connection_id": connection_id,
                        "client_id": client_id,
                        "remote_ip": websocket.client.host
                    }
                )
                return connection_id

            except Exception as e:
                logger.error(
                    "Failed to establish WebSocket connection",
                    extra={
                        "error": str(e),
                        "client_id": client_id,
                        "remote_ip": websocket.client.host
                    }
                )
                raise HTTPException(status_code=400, detail="Connection failed")

    async def disconnect(self, connection_id: str) -> None:
        """
        Handle WebSocket disconnection with cleanup and metric recording.
        
        Args:
            connection_id: The unique identifier of the connection to disconnect
        """
        async with self._lock:
            if connection_id in self.active_connections:
                websocket = self.active_connections[connection_id]
                
                # Clean up monitoring task
                if connection_id in self._monitoring_tasks:
                    self._monitoring_tasks[connection_id].cancel()
                    del self._monitoring_tasks[connection_id]

                # Clean up connection tracking
                del self.active_connections[connection_id]
                del self.connection_ids[id(websocket)]
                del self.connection_latencies[connection_id]
                del self.message_counts[connection_id]

                logger.info(
                    "WebSocket connection closed",
                    extra={
                        "connection_id": connection_id,
                        "total_messages": self.message_counts.get(connection_id, 0),
                        "avg_latency": self.connection_latencies.get(connection_id, 0)
                    }
                )

    async def broadcast(
        self,
        message: Dict,
        exclude: Optional[List[str]] = None,
        validate: Optional[bool] = True
    ) -> Dict[str, bool]:
        """
        Broadcast message to all connected clients with rate limiting and error handling.
        
        Args:
            message: The message to broadcast
            exclude: Optional list of connection IDs to exclude
            validate: Whether to validate message size and format
            
        Returns:
            Dict[str, bool]: Delivery status for each connection
        """
        exclude = exclude or []
        delivery_status = {}

        if validate:
            message_size = len(json.dumps(message).encode('utf-8'))
            if message_size > MAX_MESSAGE_SIZE:
                raise ValueError(f"Message size exceeds limit: {message_size} bytes")

        async with self._lock:
            broadcast_tasks = []
            
            for conn_id, websocket in self.active_connections.items():
                if conn_id not in exclude:
                    task = asyncio.create_task(self._send_message(conn_id, websocket, message))
                    broadcast_tasks.append(task)

            try:
                results = await asyncio.gather(*broadcast_tasks, return_exceptions=True)
                for conn_id, result in zip(self.active_connections.keys(), results):
                    if isinstance(result, Exception):
                        delivery_status[conn_id] = False
                        logger.error(
                            "Broadcast failed for connection",
                            extra={
                                "connection_id": conn_id,
                                "error": str(result)
                            }
                        )
                    else:
                        delivery_status[conn_id] = True
                        self.message_counts[conn_id] = self.message_counts.get(conn_id, 0) + 1

            except Exception as e:
                logger.error(
                    "Broadcast operation failed",
                    extra={"error": str(e), "recipients": len(broadcast_tasks)}
                )

            return delivery_status

    async def monitor_connection(self, connection_id: str) -> None:
        """
        Monitor WebSocket connection health with automatic cleanup of stale connections.
        
        Args:
            connection_id: The unique identifier of the connection to monitor
        """
        while True:
            try:
                websocket = self.active_connections.get(connection_id)
                if not websocket:
                    break

                # Send ping and measure latency
                ping_start = datetime.now(timezone.utc)
                await websocket.send_text(json.dumps({"type": "ping"}))
                
                try:
                    async with asyncio.timeout(PING_TIMEOUT):
                        response = await websocket.receive_text()
                        if json.loads(response).get("type") == "pong":
                            latency = (datetime.now(timezone.utc) - ping_start).total_seconds()
                            self.connection_latencies[connection_id] = latency
                except asyncio.TimeoutError:
                    logger.warning(
                        "Connection timeout detected",
                        extra={"connection_id": connection_id}
                    )
                    await self.disconnect(connection_id)
                    break

                await asyncio.sleep(PING_INTERVAL)

            except WebSocketDisconnect:
                await self.disconnect(connection_id)
                break
            except Exception as e:
                logger.error(
                    "Connection monitoring error",
                    extra={
                        "connection_id": connection_id,
                        "error": str(e)
                    }
                )
                await self.disconnect(connection_id)
                break

    async def _send_message(self, conn_id: str, websocket: WebSocket, message: Dict) -> None:
        """
        Send message to a specific WebSocket connection with timeout.
        
        Args:
            conn_id: Connection identifier
            websocket: WebSocket connection instance
            message: Message to send
            
        Raises:
            asyncio.TimeoutError: If send operation times out
            WebSocketDisconnect: If connection is lost
        """
        try:
            async with asyncio.timeout(BROADCAST_TIMEOUT):
                await websocket.send_json(message)
        except Exception as e:
            logger.error(
                "Failed to send message",
                extra={
                    "connection_id": conn_id,
                    "error": str(e)
                }
            )
            raise