"""
FastAPI router for GPU server management endpoints with integrated environmental monitoring.
Handles server registration, monitoring, maintenance, metrics collection, and carbon capture tracking.
"""

from typing import Dict, List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from prometheus_client import CollectorRegistry, Counter, Gauge

from api.services.server_service import ServerService
from api.utils.auth import require_role
from api.utils.metrics import track_request

# Initialize router with prefix and tags
router = APIRouter(prefix="/api/v1/servers", tags=["servers"])

# Initialize services
server_service = ServerService()

# Initialize Prometheus metrics registry
METRICS_REGISTRY = CollectorRegistry()

# Define response models
class EnvironmentalMetrics(BaseModel):
    """Environmental impact metrics for GPU servers."""
    power_metrics: Dict = Field(..., description="Power usage and efficiency metrics")
    cooling_metrics: Dict = Field(..., description="Cooling system performance metrics")
    carbon_metrics: Dict = Field(..., description="Carbon capture and emissions data")
    efficiency_scores: Dict = Field(..., description="Overall efficiency ratings")

class ServerResponse(BaseModel):
    """Server response model with environmental data."""
    id: UUID
    hostname: str
    ip_address: str
    specs: Dict
    maintenance_mode: bool
    current_metrics: Dict
    environmental_metrics: Optional[EnvironmentalMetrics]
    status: str
    last_health_check: Optional[datetime]

@router.get("/", response_model=List[ServerResponse])
@require_role("host")
@track_request
async def get_servers_with_metrics(
    maintenance_mode: Optional[bool] = Query(None, description="Filter by maintenance status"),
    min_efficiency: Optional[float] = Query(None, ge=0, le=1, description="Minimum environmental efficiency score"),
    include_environmental: bool = Query(True, description="Include environmental metrics in response")
) -> List[ServerResponse]:
    """
    List all GPU servers with comprehensive metrics including environmental data.
    
    Args:
        maintenance_mode: Optional filter for maintenance status
        min_efficiency: Optional minimum environmental efficiency threshold
        include_environmental: Whether to include environmental metrics
        
    Returns:
        List of server details with metrics and environmental data
    """
    try:
        # Build filters
        filters = {}
        if maintenance_mode is not None:
            filters["maintenance_mode"] = maintenance_mode
        if min_efficiency is not None:
            filters["min_efficiency"] = min_efficiency

        # Get servers with metrics
        servers = await server_service.list_servers(filters)
        
        # Process response
        response = []
        for server in servers:
            server_data = ServerResponse(
                id=server["id"],
                hostname=server["hostname"],
                ip_address=server["ip_address"],
                specs=server["specs"],
                maintenance_mode=server["maintenance_mode"],
                current_metrics=server["current_metrics"],
                environmental_metrics=server["environmental_metrics"] if include_environmental else None,
                status=server["status"],
                last_health_check=server["last_health_check"]
            )
            response.append(server_data)
            
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve servers: {str(e)}")

@router.get("/{server_id}", response_model=ServerResponse)
@require_role("host")
@track_request
async def get_server_details(
    server_id: UUID,
    include_environmental: bool = Query(True, description="Include environmental metrics in response")
) -> ServerResponse:
    """
    Get detailed server information including real-time metrics and environmental data.
    
    Args:
        server_id: UUID of the server
        include_environmental: Whether to include environmental metrics
        
    Returns:
        Detailed server information with metrics
    """
    try:
        server = await server_service.get_server(server_id)
        return ServerResponse(
            id=server["id"],
            hostname=server["hostname"],
            ip_address=server["ip_address"],
            specs=server["specs"],
            maintenance_mode=server["maintenance_mode"],
            current_metrics=server["current_metrics"],
            environmental_metrics=server["environmental_metrics"] if include_environmental else None,
            status=server["status"],
            last_health_check=server["last_health_check"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve server details: {str(e)}")

@router.get("/{server_id}/environmental", response_model=EnvironmentalMetrics)
@require_role("host")
@track_request
async def get_server_environmental_metrics(
    server_id: UUID,
    start_time: datetime = Query(..., description="Start time for metrics period"),
    end_time: datetime = Query(..., description="End time for metrics period")
) -> EnvironmentalMetrics:
    """
    Get detailed environmental metrics for a specific server.
    
    Args:
        server_id: UUID of the server
        start_time: Start of metrics period
        end_time: End of metrics period
        
    Returns:
        Comprehensive environmental metrics data
    """
    try:
        metrics = await server_service.get_environmental_metrics(server_id, start_time, end_time)
        return EnvironmentalMetrics(**metrics)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve environmental metrics: {str(e)}"
        )

@router.post("/{server_id}/maintenance")
@require_role("host")
@track_request
async def toggle_maintenance_mode(
    server_id: UUID,
    maintenance_state: bool = Query(..., description="New maintenance mode state"),
    reason: str = Query(..., description="Reason for maintenance mode change")
) -> Dict:
    """
    Toggle server maintenance mode with audit logging.
    
    Args:
        server_id: UUID of the server
        maintenance_state: New maintenance mode state
        reason: Reason for the change
        
    Returns:
        Updated server status
    """
    try:
        result = await server_service.toggle_maintenance(server_id, maintenance_state, reason)
        return {
            "server_id": server_id,
            "maintenance_mode": maintenance_state,
            "status": "success",
            "message": f"Maintenance mode {'enabled' if maintenance_state else 'disabled'}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to toggle maintenance mode: {str(e)}"
        )

@router.post("/{server_id}/optimize")
@require_role("host")
@track_request
async def optimize_environmental_impact(
    server_id: UUID
) -> Dict:
    """
    Optimize server operations for environmental efficiency.
    
    Args:
        server_id: UUID of the server
        
    Returns:
        Optimization results and new efficiency metrics
    """
    try:
        result = await server_service.optimize_environmental_impact(server_id)
        return {
            "server_id": server_id,
            "optimization_applied": result["optimization_applied"],
            "previous_efficiency": result["previous_efficiency"],
            "new_efficiency": result["new_efficiency"],
            "power_savings": result["power_savings"],
            "carbon_reduction": result["carbon_reduction"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to optimize environmental impact: {str(e)}"
        )