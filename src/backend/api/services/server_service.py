"""
Service layer for managing GPU server resources with integrated environmental impact tracking.
Provides comprehensive operations for server provisioning, monitoring, maintenance, and
carbon capture metrics in the Provocative Cloud platform.
"""

import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, and_
from fastapi import HTTPException
from prometheus_client import Counter, Gauge, Histogram

from db.models.server import Server
from db.session import get_session
from api.utils.gpu_metrics import GPUMetricsManager

# Prometheus metrics
SERVER_METRICS = {
    'server_status': Gauge('server_status', 'Server operational status', ['server_id']),
    'server_temperature': Gauge('server_temperature', 'Server temperature', ['server_id']),
    'server_power_usage': Gauge('server_power_usage', 'Server power consumption', ['server_id']),
    'server_carbon_captured': Counter('server_carbon_captured', 'CO2 captured by server', ['server_id']),
    'server_pue': Gauge('server_pue', 'Power Usage Effectiveness', ['server_id']),
    'server_cue': Gauge('server_cue', 'Carbon Usage Effectiveness', ['server_id'])
}

class ServerService:
    """
    Enhanced service class for managing GPU server operations with environmental impact tracking.
    Handles server provisioning, monitoring, maintenance, and carbon capture metrics.
    """

    def __init__(self):
        """Initialize server service with metrics manager and caching."""
        self._metrics_manager = GPUMetricsManager()
        self._server_cache = {}
        self._environmental_cache = {}
        self._logger = logging.getLogger(__name__)
        self._init_prometheus_metrics()

    def _init_prometheus_metrics(self):
        """Initialize Prometheus metrics collectors."""
        self._collection_latency = Histogram(
            'server_metrics_collection_seconds',
            'Time spent collecting server metrics'
        )

    async def get_server(self, server_id: UUID) -> Dict:
        """
        Retrieve comprehensive server details including environmental metrics.

        Args:
            server_id: UUID of the server

        Returns:
            Dict containing server details with metrics and environmental data

        Raises:
            HTTPException: If server not found or metrics collection fails
        """
        try:
            async with get_session() as session:
                # Get server from database
                query = select(Server).where(Server.id == server_id)
                result = await session.execute(query)
                server = result.scalar_one_or_none()

                if not server:
                    raise HTTPException(status_code=404, detail="Server not found")

                # Get current metrics
                metrics = await self._metrics_manager.get_metrics(
                    start_time=datetime.utcnow() - timedelta(minutes=5),
                    end_time=datetime.utcnow(),
                    include_environmental=True
                )

                # Get environmental metrics
                env_metrics = await self.get_environmental_metrics(
                    server_id,
                    datetime.utcnow() - timedelta(hours=1),
                    datetime.utcnow()
                )

                # Combine all data
                server_data = server.to_dict(include_relationships=True)
                server_data.update({
                    'current_metrics': metrics.get(str(server_id), {}),
                    'environmental_metrics': env_metrics,
                    'status': 'maintenance' if server.maintenance_mode else 'active'
                })

                # Update Prometheus metrics
                self._update_prometheus_metrics(server_id, server_data)

                return server_data

        except Exception as e:
            self._logger.error(f"Error retrieving server {server_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve server details")

    async def list_servers(self, filters: Optional[Dict] = None) -> List[Dict]:
        """
        List all servers with optional filtering and environmental metrics.

        Args:
            filters: Optional dictionary of filter criteria

        Returns:
            List of server details with metrics and environmental data
        """
        try:
            async with get_session() as session:
                # Build query with filters
                query = select(Server)
                if filters:
                    if filters.get('maintenance_mode') is not None:
                        query = query.where(Server.maintenance_mode == filters['maintenance_mode'])
                    if filters.get('min_efficiency'):
                        # Filter by environmental efficiency
                        pass

                # Execute query
                result = await session.execute(query)
                servers = result.scalars().all()

                # Collect metrics for all servers
                server_list = []
                for server in servers:
                    server_data = server.to_dict(include_relationships=True)
                    
                    # Get current metrics
                    metrics = await self._metrics_manager.get_metrics(
                        start_time=datetime.utcnow() - timedelta(minutes=5),
                        end_time=datetime.utcnow(),
                        include_environmental=True
                    )
                    
                    # Get environmental metrics
                    env_metrics = await self.get_environmental_metrics(
                        server.id,
                        datetime.utcnow() - timedelta(hours=1),
                        datetime.utcnow()
                    )

                    server_data.update({
                        'current_metrics': metrics.get(str(server.id), {}),
                        'environmental_metrics': env_metrics,
                        'status': 'maintenance' if server.maintenance_mode else 'active'
                    })

                    server_list.append(server_data)

                return server_list

        except Exception as e:
            self._logger.error(f"Error listing servers: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to list servers")

    async def get_environmental_metrics(
        self,
        server_id: UUID,
        start_time: datetime,
        end_time: datetime
    ) -> Dict:
        """
        Get detailed environmental metrics for a server.

        Args:
            server_id: Server UUID
            start_time: Start of metrics period
            end_time: End of metrics period

        Returns:
            Dict containing environmental metrics and carbon capture data
        """
        try:
            # Get base metrics
            metrics = await self._metrics_manager.get_metrics(
                start_time=start_time,
                end_time=end_time,
                include_environmental=True
            )

            # Calculate environmental impact
            server_metrics = metrics.get(str(server_id), {})
            if not server_metrics:
                return {}

            # Calculate efficiency metrics
            power_usage = server_metrics.get('power_usage', 0)
            cooling_efficiency = server_metrics.get('cooling_efficiency', 0)
            
            # Calculate PUE (Power Usage Effectiveness)
            total_power = power_usage * (1 + (1 - cooling_efficiency))
            pue = total_power / power_usage if power_usage > 0 else 0

            # Calculate CUE (Carbon Usage Effectiveness)
            carbon_captured = server_metrics.get('co2_captured', 0)
            total_emissions = power_usage * 0.475  # kgCO2/kWh
            cue = (total_emissions - carbon_captured) / total_emissions if total_emissions > 0 else 0

            return {
                'time_period': {
                    'start': start_time.isoformat(),
                    'end': end_time.isoformat()
                },
                'power_metrics': {
                    'average_usage_watts': power_usage,
                    'total_energy_kwh': power_usage * ((end_time - start_time).total_seconds() / 3600),
                    'pue': pue
                },
                'cooling_metrics': {
                    'efficiency': cooling_efficiency,
                    'power_overhead_watts': power_usage * (1 - cooling_efficiency)
                },
                'carbon_metrics': {
                    'total_emissions_kg': total_emissions,
                    'carbon_captured_kg': carbon_captured,
                    'net_impact_kg': total_emissions - carbon_captured,
                    'cue': cue
                },
                'efficiency_scores': {
                    'power_efficiency': 1 - (pue - 1),
                    'carbon_efficiency': 1 - cue,
                    'overall_efficiency': (1 - (pue - 1) + (1 - cue)) / 2
                }
            }

        except Exception as e:
            self._logger.error(f"Error getting environmental metrics for server {server_id}: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to retrieve environmental metrics")

    def _update_prometheus_metrics(self, server_id: UUID, server_data: Dict):
        """Update Prometheus metrics with latest server data."""
        try:
            # Update server status
            SERVER_METRICS['server_status'].labels(server_id=str(server_id)).set(
                1 if server_data['status'] == 'active' else 0
            )

            # Update environmental metrics
            if 'environmental_metrics' in server_data:
                env_metrics = server_data['environmental_metrics']
                
                SERVER_METRICS['server_pue'].labels(server_id=str(server_id)).set(
                    env_metrics['power_metrics']['pue']
                )
                SERVER_METRICS['server_cue'].labels(server_id=str(server_id)).set(
                    env_metrics['carbon_metrics']['cue']
                )
                SERVER_METRICS['server_carbon_captured'].labels(server_id=str(server_id)).inc(
                    env_metrics['carbon_metrics']['carbon_captured_kg']
                )

        except Exception as e:
            self._logger.error(f"Error updating Prometheus metrics for server {server_id}: {str(e)}")