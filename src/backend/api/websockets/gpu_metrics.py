"""
WebSocket handler for real-time GPU metrics streaming and monitoring in the Provocative Cloud platform.
Implements comprehensive environmental impact tracking, real-time metrics updates, and intelligent
alert management with carbon capture integration.
"""

import asyncio
from typing import Dict, List, Optional, Set
from datetime import datetime

from fastapi import WebSocket
from api.websockets.manager import WebSocketManager
from api.utils.gpu_metrics import GPUMetricsManager
from api.utils.logger import get_logger

# Constants for update intervals and thresholds
METRICS_UPDATE_INTERVAL = 1.0  # seconds
ALERT_CHECK_INTERVAL = 5.0  # seconds
CARBON_UPDATE_INTERVAL = 60.0  # seconds
COOLING_CHECK_INTERVAL = 30.0  # seconds
MAX_BATCH_SIZE = 100
ALERT_THRESHOLDS = {
    "temperature": 80.0,  # Celsius
    "power": 300.0,      # Watts
    "memory": 0.95       # 95% utilization
}

logger = get_logger(__name__)

class GPUMetricsWebSocket:
    """
    Enhanced WebSocket handler for real-time GPU metrics streaming with environmental impact monitoring.
    """

    def __init__(self):
        """Initialize the enhanced GPU metrics WebSocket handler with environmental monitoring."""
        self._manager = WebSocketManager()
        self._metrics_manager = GPUMetricsManager()
        self._update_tasks: Dict[str, asyncio.Task] = {}
        self._gpu_subscriptions: Dict[str, Set[str]] = {}  # connection_id -> set of gpu_ids
        self._environmental_cache: Dict[str, Dict] = {}
        self._last_carbon_update: Dict[str, float] = {}
        self._metrics_batch: Dict[str, List] = {}

    async def connect_client(self, websocket: WebSocket, preferences: Dict) -> str:
        """
        Handle new client connection with enhanced monitoring setup.
        
        Args:
            websocket: WebSocket connection instance
            preferences: Client monitoring preferences
            
        Returns:
            str: Unique connection ID
        """
        try:
            connection_id = await self._manager.connect(websocket)
            self._gpu_subscriptions[connection_id] = set()
            self._metrics_batch[connection_id] = []

            # Initialize environmental monitoring if requested
            if preferences.get("monitor_environmental", True):
                self._environmental_cache[connection_id] = {}
                self._last_carbon_update[connection_id] = 0

            # Start metrics collection task
            self._update_tasks[connection_id] = asyncio.create_task(
                self._collect_metrics(connection_id, websocket, preferences)
            )

            logger.info(
                "Client connected to GPU metrics stream",
                extra={
                    "connection_id": connection_id,
                    "preferences": preferences
                }
            )

            return connection_id

        except Exception as e:
            logger.error(
                "Failed to establish GPU metrics connection",
                extra={"error": str(e)}
            )
            raise

    async def disconnect_client(self, connection_id: str):
        """Handle client disconnection with cleanup."""
        try:
            if connection_id in self._update_tasks:
                self._update_tasks[connection_id].cancel()
                del self._update_tasks[connection_id]

            if connection_id in self._gpu_subscriptions:
                del self._gpu_subscriptions[connection_id]

            if connection_id in self._environmental_cache:
                del self._environmental_cache[connection_id]

            if connection_id in self._last_carbon_update:
                del self._last_carbon_update[connection_id]

            if connection_id in self._metrics_batch:
                del self._metrics_batch[connection_id]

            await self._manager.disconnect(connection_id)

            logger.info(
                "Client disconnected from GPU metrics stream",
                extra={"connection_id": connection_id}
            )

        except Exception as e:
            logger.error(
                "Error during GPU metrics client disconnection",
                extra={
                    "connection_id": connection_id,
                    "error": str(e)
                }
            )

    async def subscribe_to_gpu(self, connection_id: str, gpu_id: str):
        """Subscribe client to specific GPU metrics stream."""
        try:
            if connection_id in self._gpu_subscriptions:
                self._gpu_subscriptions[connection_id].add(gpu_id)
                logger.info(
                    "Client subscribed to GPU metrics",
                    extra={
                        "connection_id": connection_id,
                        "gpu_id": gpu_id
                    }
                )
        except Exception as e:
            logger.error(
                "Failed to subscribe to GPU metrics",
                extra={
                    "connection_id": connection_id,
                    "gpu_id": gpu_id,
                    "error": str(e)
                }
            )

    async def unsubscribe_from_gpu(self, connection_id: str, gpu_id: str):
        """Unsubscribe client from specific GPU metrics stream."""
        try:
            if connection_id in self._gpu_subscriptions:
                self._gpu_subscriptions[connection_id].discard(gpu_id)
                logger.info(
                    "Client unsubscribed from GPU metrics",
                    extra={
                        "connection_id": connection_id,
                        "gpu_id": gpu_id
                    }
                )
        except Exception as e:
            logger.error(
                "Failed to unsubscribe from GPU metrics",
                extra={
                    "connection_id": connection_id,
                    "gpu_id": gpu_id,
                    "error": str(e)
                }
            )

    async def _collect_metrics(self, connection_id: str, websocket: WebSocket, preferences: Dict):
        """Collect and broadcast GPU metrics with environmental data."""
        try:
            while True:
                for gpu_id in self._gpu_subscriptions[connection_id]:
                    metrics = await self._metrics_manager.get_metrics(
                        datetime.utcnow(),
                        datetime.utcnow(),
                        include_environmental=preferences.get("monitor_environmental", True)
                    )

                    if gpu_id in metrics:
                        # Add metrics to batch
                        self._metrics_batch[connection_id].append({
                            "gpu_id": gpu_id,
                            "timestamp": datetime.utcnow().isoformat(),
                            "metrics": metrics[gpu_id]
                        })

                        # Check for alerts
                        await self._check_alerts(connection_id, gpu_id, metrics[gpu_id])

                        # Process environmental metrics
                        if preferences.get("monitor_environmental", True):
                            await self.broadcast_environmental_metrics(gpu_id, metrics[gpu_id])

                    # Broadcast batch if size threshold reached
                    if len(self._metrics_batch[connection_id]) >= MAX_BATCH_SIZE:
                        await self._broadcast_metrics_batch(connection_id)

                await asyncio.sleep(METRICS_UPDATE_INTERVAL)

        except asyncio.CancelledError:
            logger.info(
                "Metrics collection cancelled",
                extra={"connection_id": connection_id}
            )
        except Exception as e:
            logger.error(
                "Error in metrics collection",
                extra={
                    "connection_id": connection_id,
                    "error": str(e)
                }
            )

    async def broadcast_environmental_metrics(self, gpu_id: str, metrics: dict):
        """
        Broadcasts environmental impact metrics to subscribed clients.
        
        Args:
            gpu_id: GPU identifier
            metrics: Current GPU metrics including environmental data
        """
        try:
            if "environmental" not in metrics:
                return

            env_metrics = metrics["environmental"]
            current_time = datetime.utcnow().timestamp()

            # Process carbon impact data
            carbon_data = {
                "timestamp": current_time,
                "carbon_efficiency": env_metrics.get("carbon_efficiency", 0),
                "power_efficiency": env_metrics.get("power_efficiency", 0),
                "cooling_efficiency": env_metrics.get("cooling_efficiency", 0),
                "co2_captured": env_metrics.get("co2_captured", 0),
                "net_carbon_impact": env_metrics.get("net_carbon_impact", 0)
            }

            # Broadcast to subscribed clients
            for connection_id, subscribed_gpus in self._gpu_subscriptions.items():
                if gpu_id in subscribed_gpus:
                    if current_time - self._last_carbon_update.get(connection_id, 0) >= CARBON_UPDATE_INTERVAL:
                        await self._manager.broadcast(
                            {
                                "type": "environmental_metrics",
                                "gpu_id": gpu_id,
                                "data": carbon_data
                            },
                            exclude=[connection_id]
                        )
                        self._last_carbon_update[connection_id] = current_time

            # Update environmental cache
            self._environmental_cache[gpu_id] = carbon_data

        except Exception as e:
            logger.error(
                "Failed to broadcast environmental metrics",
                extra={
                    "gpu_id": gpu_id,
                    "error": str(e)
                }
            )

    async def _check_alerts(self, connection_id: str, gpu_id: str, metrics: Dict):
        """Check metrics against alert thresholds."""
        try:
            alerts = []

            if metrics["temperature"] > ALERT_THRESHOLDS["temperature"]:
                alerts.append({
                    "type": "temperature",
                    "severity": "high",
                    "message": f"GPU temperature exceeds threshold: {metrics['temperature']}°C"
                })

            if metrics["power_usage"] > ALERT_THRESHOLDS["power"]:
                alerts.append({
                    "type": "power",
                    "severity": "warning",
                    "message": f"High power consumption: {metrics['power_usage']}W"
                })

            memory_usage = metrics["memory_used"] / metrics["memory_total"]
            if memory_usage > ALERT_THRESHOLDS["memory"]:
                alerts.append({
                    "type": "memory",
                    "severity": "warning",
                    "message": f"High memory usage: {memory_usage:.1%}"
                })

            if alerts:
                await self._manager.broadcast(
                    {
                        "type": "alerts",
                        "gpu_id": gpu_id,
                        "alerts": alerts
                    },
                    exclude=[connection_id]
                )

        except Exception as e:
            logger.error(
                "Failed to check alerts",
                extra={
                    "connection_id": connection_id,
                    "gpu_id": gpu_id,
                    "error": str(e)
                }
            )

    async def _broadcast_metrics_batch(self, connection_id: str):
        """Broadcast accumulated metrics batch to client."""
        try:
            if self._metrics_batch[connection_id]:
                await self._manager.broadcast(
                    {
                        "type": "metrics_batch",
                        "data": self._metrics_batch[connection_id]
                    },
                    exclude=[connection_id]
                )
                self._metrics_batch[connection_id] = []

        except Exception as e:
            logger.error(
                "Failed to broadcast metrics batch",
                extra={
                    "connection_id": connection_id,
                    "error": str(e)
                }
            )