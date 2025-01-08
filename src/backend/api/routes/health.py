"""
Health check endpoints for Provocative Cloud platform.
Provides comprehensive system health monitoring including database connectivity,
GPU availability, and environmental metrics with enhanced error handling.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from prometheus_client import Counter, Gauge
from circuitbreaker import circuit_breaker
from cachetools import TTLCache, cached
from sqlalchemy.ext.asyncio import AsyncSession

from api.dependencies import get_db_session
from api.services.gpu_service import GPUService
from api.utils.logger import get_logger

# Initialize router
router = APIRouter(prefix="/health", tags=["Health"])

# Configure logging
logger = get_logger(__name__)

# Initialize Prometheus metrics
health_check_counter = Counter(
    'health_check_total',
    'Total health check requests',
    ['endpoint']
)
system_health_gauge = Gauge(
    'system_health_status',
    'System health status by component',
    ['component']
)

# Initialize caching
health_cache = TTLCache(maxsize=100, ttl=30)  # 30 second TTL
env_cache = TTLCache(maxsize=100, ttl=300)  # 5 minute TTL

@router.get("/")
@router.get("/ping")
@cached(cache=health_cache)
async def check_health() -> Dict:
    """
    Basic health check endpoint verifying API availability.
    
    Returns:
        Dict: Basic health status with version info
    """
    try:
        health_check_counter.labels(endpoint="ping").inc()
        
        return {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": datetime.utcnow().isoformat(),
            "uptime": "OK"
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Health check failed")

@router.get("/database")
@circuit_breaker(failure_threshold=5, recovery_timeout=60)
@cached(cache=health_cache)
async def check_database(db: AsyncSession = Depends(get_db_session)) -> Dict:
    """
    Checks database connectivity and health with connection pooling.
    
    Args:
        db: Database session from dependency
        
    Returns:
        Dict: Database health status and metrics
    """
    try:
        # Execute health check query
        result = await db.execute("SELECT 1")
        await result.fetchone()
        
        # Get connection pool stats
        pool_metrics = {
            "size": db.get_bind().pool.size(),
            "checked_out": db.get_bind().pool.checkedin(),
            "overflow": db.get_bind().pool.overflow()
        }
        
        system_health_gauge.labels(component="database").set(1)
        health_check_counter.labels(endpoint="database").inc()
        
        return {
            "status": "healthy",
            "connection_pool": pool_metrics,
            "latency_ms": 0,  # TODO: Implement latency tracking
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        system_health_gauge.labels(component="database").set(0)
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Database health check failed")

@router.get("/gpu")
@circuit_breaker(failure_threshold=3, recovery_timeout=30)
@cached(cache=health_cache)
async def check_gpu_system(db: AsyncSession = Depends(get_db_session)) -> Dict:
    """
    Comprehensive GPU system health check with detailed metrics.
    
    Args:
        db: Database session from dependency
        
    Returns:
        Dict: GPU system health status and metrics
    """
    try:
        # Initialize GPU service
        gpu_service = GPUService(db)
        
        # Get GPU metrics
        gpu_metrics = await gpu_service.get_gpu_metrics()
        
        # Calculate system health
        gpu_health = {
            "available_gpus": len([g for g in gpu_metrics if g["is_available"]]),
            "total_gpus": len(gpu_metrics),
            "average_temperature": sum(g["temperature"] for g in gpu_metrics) / len(gpu_metrics),
            "average_utilization": sum(g["utilization"] for g in gpu_metrics) / len(gpu_metrics)
        }
        
        system_health_gauge.labels(component="gpu").set(1)
        health_check_counter.labels(endpoint="gpu").inc()
        
        return {
            "status": "healthy",
            "gpu_health": gpu_health,
            "metrics": gpu_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        system_health_gauge.labels(component="gpu").set(0)
        logger.error(f"GPU health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="GPU health check failed")

@router.get("/environmental")
@circuit_breaker(failure_threshold=3, recovery_timeout=60)
@cached(cache=env_cache)
async def check_environmental() -> Dict:
    """
    Environmental system health check including carbon capture metrics.
    
    Returns:
        Dict: Environmental metrics and status
    """
    try:
        # Initialize GPU service for environmental metrics
        gpu_service = GPUService(None)  # No DB needed for env metrics
        
        # Get environmental metrics
        env_metrics = await gpu_service.get_environmental_metrics()
        
        # Calculate efficiency metrics
        efficiency_metrics = {
            "power_usage_effectiveness": env_metrics["pue"],
            "carbon_usage_effectiveness": env_metrics["cue"],
            "water_usage_effectiveness": env_metrics["wue"],
            "cooling_efficiency": env_metrics["cooling_efficiency"]
        }
        
        # Get carbon capture metrics
        carbon_metrics = {
            "co2_captured_kg": env_metrics["co2_captured"],
            "capture_rate_kgh": env_metrics["capture_rate"],
            "net_carbon_impact": env_metrics["net_carbon_impact"]
        }
        
        system_health_gauge.labels(component="environmental").set(1)
        health_check_counter.labels(endpoint="environmental").inc()
        
        return {
            "status": "healthy",
            "efficiency_metrics": efficiency_metrics,
            "carbon_metrics": carbon_metrics,
            "cooling_status": env_metrics["cooling_status"],
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        system_health_gauge.labels(component="environmental").set(0)
        logger.error(f"Environmental health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail="Environmental health check failed")