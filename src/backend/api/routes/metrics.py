"""
FastAPI route handlers for system-wide metrics including GPU performance, carbon capture,
and environmental metrics endpoints with enhanced caching, validation, and error handling.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Response, status
from fastapi_cache import cache

from api.services.metrics_service import MetricsService
from api.schemas.metrics import GPUMetricsBase, CarbonMetricsBase, SystemMetricsBase, MetricsResponse
from api.dependencies import get_db_session, get_current_active_user

# Initialize router with prefix and tags
router = APIRouter(prefix='/metrics', tags=['Metrics'])

# Constants
CACHE_TTL = 300  # Cache time-to-live in seconds
MAX_TIME_RANGE = timedelta(days=30)  # Maximum allowed time range for queries

@router.get('/gpu', response_model=List[GPUMetricsBase])
@cache(expire=CACHE_TTL)
async def get_gpu_metrics(
    start_time: datetime = Query(..., description="Start time for metrics query"),
    end_time: datetime = Query(..., description="End time for metrics query"),
    gpu_ids: Optional[List[str]] = Query(None, description="Optional list of specific GPU IDs"),
    metrics_type: Optional[str] = Query(None, description="Type of metrics to retrieve"),
    metrics_service: MetricsService = Depends(),
    response: Response = None,
    _: Dict = Depends(get_current_active_user)
) -> List[GPUMetricsBase]:
    """
    Retrieve GPU performance metrics with caching and validation.
    """
    try:
        # Validate time range
        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )
        
        if end_time - start_time > MAX_TIME_RANGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time range cannot exceed {MAX_TIME_RANGE.days} days"
            )

        # Get metrics with validation
        metrics = await metrics_service.get_gpu_metrics(
            start_time=start_time,
            end_time=end_time,
            gpu_ids=gpu_ids,
            metrics_type=metrics_type
        )

        # Set cache control headers
        if response:
            response.headers["Cache-Control"] = f"max-age={CACHE_TTL}"

        return metrics

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve GPU metrics: {str(e)}"
        )

@router.get('/carbon', response_model=CarbonMetricsBase)
@cache(expire=CACHE_TTL)
async def get_carbon_metrics(
    start_time: datetime = Query(..., description="Start time for metrics query"),
    end_time: datetime = Query(..., description="End time for metrics query"),
    metric_types: Optional[List[str]] = Query(None, description="Types of carbon metrics to retrieve"),
    metrics_service: MetricsService = Depends(),
    response: Response = None,
    _: Dict = Depends(get_current_active_user)
) -> CarbonMetricsBase:
    """
    Retrieve carbon capture and environmental metrics with validation.
    """
    try:
        # Validate time range
        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )

        if end_time - start_time > MAX_TIME_RANGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time range cannot exceed {MAX_TIME_RANGE.days} days"
            )

        # Get carbon metrics
        metrics = await metrics_service.get_carbon_metrics(
            start_time=start_time,
            end_time=end_time,
            metric_types=metric_types
        )

        # Set cache control headers
        if response:
            response.headers["Cache-Control"] = f"max-age={CACHE_TTL}"

        return metrics

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve carbon metrics: {str(e)}"
        )

@router.get('/system', response_model=SystemMetricsBase)
@cache(expire=CACHE_TTL)
async def get_system_metrics(
    start_time: datetime = Query(..., description="Start time for metrics query"),
    end_time: datetime = Query(..., description="End time for metrics query"),
    subsystems: Optional[List[str]] = Query(None, description="Specific subsystems to query"),
    metrics_service: MetricsService = Depends(),
    response: Response = None,
    _: Dict = Depends(get_current_active_user)
) -> SystemMetricsBase:
    """
    Retrieve system-wide performance metrics with caching.
    """
    try:
        # Validate time range
        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )

        if end_time - start_time > MAX_TIME_RANGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time range cannot exceed {MAX_TIME_RANGE.days} days"
            )

        # Get system metrics
        metrics = await metrics_service.get_system_metrics(
            start_time=start_time,
            end_time=end_time,
            subsystems=subsystems
        )

        # Set cache control headers
        if response:
            response.headers["Cache-Control"] = f"max-age={CACHE_TTL}"

        return metrics

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve system metrics: {str(e)}"
        )

@router.get('/combined', response_model=MetricsResponse)
@cache(expire=CACHE_TTL)
async def get_combined_metrics(
    start_time: datetime = Query(..., description="Start time for metrics query"),
    end_time: datetime = Query(..., description="End time for metrics query"),
    gpu_ids: List[str] = Query(..., description="List of GPU IDs to query"),
    metric_types: Optional[List[str]] = Query(None, description="Types of metrics to retrieve"),
    metrics_service: MetricsService = Depends(),
    background_tasks: BackgroundTasks = None,
    _: Dict = Depends(get_current_active_user)
) -> MetricsResponse:
    """
    Retrieve all metrics types in parallel with aggregation.
    """
    try:
        # Validate time range
        if end_time <= start_time:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time"
            )

        if end_time - start_time > MAX_TIME_RANGE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time range cannot exceed {MAX_TIME_RANGE.days} days"
            )

        # Get combined metrics
        metrics = await metrics_service.get_combined_metrics(
            start_time=start_time,
            end_time=end_time,
            gpu_ids=gpu_ids,
            metric_types=metric_types
        )

        # Schedule background cache update if needed
        if background_tasks:
            background_tasks.add_task(
                metrics_service.update_metrics_cache,
                start_time,
                end_time,
                gpu_ids,
                metric_types
            )

        return metrics

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve combined metrics: {str(e)}"
        )

@router.get('/alerts', response_model=Dict[str, List[Dict[str, Any]]])
async def get_alerts(
    severity: Optional[str] = Query(None, description="Filter alerts by severity level"),
    categories: Optional[List[str]] = Query(None, description="Filter alerts by categories"),
    metrics_service: MetricsService = Depends(),
    _: Dict = Depends(get_current_active_user)
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Retrieve current active alerts with severity filtering.
    """
    try:
        # Get current alerts
        alerts = await metrics_service.check_alerts(
            severity=severity,
            categories=categories
        )

        return alerts

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve alerts: {str(e)}"
        )