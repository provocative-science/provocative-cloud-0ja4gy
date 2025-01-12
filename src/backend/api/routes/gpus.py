"""
FastAPI router implementation for GPU resource management endpoints with integrated
environmental impact tracking and carbon capture metrics in the Provocative Cloud platform.
"""

from typing import List, Optional, Dict, AsyncIterator
from uuid import UUID
import asyncio

from fastapi import APIRouter, Depends, HTTPException, WebSocket, BackgroundTasks
from prometheus_client import Counter, Gauge

from api.schemas.gpu import (
    GPUBase, GPUCreate, GPUUpdate, GPUResponse, GPUMetrics, GPUEnvironmental
)
from api.services.gpu_service import GPUService
from api.utils.auth import require_role, validate_websocket_token
from api.utils.cache import cache
from api.utils.carbon_metrics import calculate_carbon_effectiveness
from api.constants import ROLE_USER

# Initialize router
router = APIRouter(prefix="/gpus", tags=["GPU Resources"])

# Prometheus metrics
gpu_request_counter = Counter(
    'gpu_api_requests_total',
    'Total number of GPU API requests',
    ['endpoint']
)

environmental_metrics_gauge = Gauge(
    'gpu_environmental_metrics',
    'GPU environmental impact metrics',
    ['gpu_id', 'metric_type']
)

@router.get("/")
@require_role(ROLE_USER)
@cache(ttl=30)
async def list_gpus(
    gpu_service: GPUService = Depends(),
    include_environmental: Optional[bool] = True
) -> List[GPUResponse]:
    """
    Retrieve list of available GPUs with environmental metrics.

    Args:
        gpu_service: Injected GPU service instance
        include_environmental: Whether to include environmental metrics

    Returns:
        List[GPUResponse]: List of available GPUs with specifications and metrics
    """
    gpu_request_counter.labels(endpoint="list_gpus").inc()

    try:
        gpus = await gpu_service.get_available_gpus()

        if include_environmental:
            for gpu in gpus:
                env_metrics = await gpu_service.get_gpu_metrics(gpu['id'])
                gpu['environmental_metrics'] = env_metrics['environmental_metrics']

                # Update Prometheus metrics
                environmental_metrics_gauge.labels(
                    gpu_id=gpu['id'],
                    metric_type='carbon_efficiency'
                ).set(env_metrics['environmental_metrics']['carbon_efficiency'])

        return gpus
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{gpu_id}", response_model=GPUResponse)
@require_role(ROLE_USER)
async def get_gpu(
    gpu_id: UUID,
    gpu_service: GPUService = Depends()
) -> GPUResponse:
    """
    Get detailed information about a specific GPU including environmental metrics.

    Args:
        gpu_id: GPU identifier
        gpu_service: Injected GPU service instance

    Returns:
        GPUResponse: Detailed GPU information with metrics
    """
    gpu_request_counter.labels(endpoint="get_gpu").inc()

    try:
        gpu_data = await gpu_service.get_gpu_metrics(gpu_id)
        return gpu_data
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{gpu_id}/environmental", response_model=GPUEnvironmental)
@require_role(ROLE_USER)
async def get_environmental_metrics(
    gpu_id: UUID,
    gpu_service: GPUService = Depends()
) -> Dict:
    """
    Get detailed environmental impact metrics for a specific GPU.

    Args:
        gpu_id: GPU identifier
        gpu_service: Injected GPU service instance

    Returns:
        Dict: Environmental metrics including carbon capture data
    """
    gpu_request_counter.labels(endpoint="get_environmental_metrics").inc()

    try:
        metrics = await gpu_service.get_gpu_metrics(gpu_id)
        env_metrics = metrics['environmental_metrics']

        # Calculate carbon effectiveness
        effectiveness = calculate_carbon_effectiveness(
            env_metrics['power_efficiency'],
            env_metrics['carbon_efficiency']
        )

        # Update Prometheus metrics
        environmental_metrics_gauge.labels(
            gpu_id=str(gpu_id),
            metric_type='effectiveness'
        ).set(effectiveness)

        return {
            'gpu_id': str(gpu_id),
            'power_efficiency': env_metrics['power_efficiency'],
            'thermal_efficiency': env_metrics['thermal_efficiency'],
            'carbon_efficiency': env_metrics['carbon_efficiency'],
            'cooling_status': env_metrics['cooling_status'],
            'carbon_effectiveness': effectiveness
        }
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.websocket("/{gpu_id}/ws/environmental")
@validate_websocket_token
async def environmental_metrics_websocket(
    websocket: WebSocket,
    gpu_id: UUID,
    gpu_service: GPUService = Depends()
) -> AsyncIterator[Dict]:
    """
    WebSocket endpoint for real-time environmental metrics streaming.

    Args:
        websocket: WebSocket connection
        gpu_id: GPU identifier
        gpu_service: Injected GPU service instance
    """
    await websocket.accept()

    try:
        while True:
            # Get latest environmental metrics
            metrics = await gpu_service.get_gpu_metrics(gpu_id)
            env_metrics = metrics['environmental_metrics']

            # Calculate effectiveness
            effectiveness = calculate_carbon_effectiveness(
                env_metrics['power_efficiency'],
                env_metrics['carbon_efficiency']
            )

            # Prepare metrics payload
            payload = {
                'timestamp': metrics['timestamp'],
                'gpu_id': str(gpu_id),
                'metrics': {
                    'power_efficiency': env_metrics['power_efficiency'],
                    'thermal_efficiency': env_metrics['thermal_efficiency'],
                    'carbon_efficiency': env_metrics['carbon_efficiency'],
                    'cooling_status': env_metrics['cooling_status'],
                    'carbon_effectiveness': effectiveness
                }
            }

            await websocket.send_json(payload)
            await asyncio.sleep(5)  # Update every 5 seconds

    except Exception as e:
        await websocket.close(code=1000)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/optimize-cooling", response_model=Dict)
@require_role(ROLE_USER)
async def optimize_cooling(
    background_tasks: BackgroundTasks,
    gpu_service: GPUService = Depends()
) -> Dict:
    """
    Trigger cooling system optimization for all GPUs.

    Args:
        background_tasks: FastAPI background tasks
        gpu_service: Injected GPU service instance

    Returns:
        Dict: Optimization results for all GPUs
    """
    gpu_request_counter.labels(endpoint="optimize_cooling").inc()

    try:
        # Run optimization in background
        background_tasks.add_task(gpu_service.optimize_cooling)

        return {
            'status': 'optimization_started',
            'message': 'Cooling system optimization initiated'
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
