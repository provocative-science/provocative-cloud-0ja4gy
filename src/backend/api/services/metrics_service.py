"""
Service layer for managing system-wide metrics including GPU performance, carbon capture,
and environmental metrics with comprehensive error handling and performance optimization.
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional
from functools import wraps
import time

from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.0+
from prometheus_client import Counter, Gauge, Histogram  # version: 0.16+
import structlog  # version: 23.1+
import redis  # version: 4.0+

from api.schemas.metrics import (
    GPUMetricsBase, CarbonMetricsBase, SystemMetricsBase, MetricsResponse
)
from api.utils.gpu_metrics import collect_gpu_metrics
from api.utils.carbon_metrics import (
    CarbonMetricsCollector, calculate_co2_emissions,
    calculate_carbon_capture, calculate_carbon_effectiveness
)
from api.utils.logger import get_logger

# Global constants
METRICS_COLLECTION_INTERVAL = 60
METRICS_RETENTION_DAYS = 90
ALERT_NOTIFICATION_THRESHOLD = 3
METRICS_BATCH_SIZE = 1000
CACHE_TTL_SECONDS = 300
MAX_RETRIES = 3
BACKOFF_FACTOR = 2

def log_metrics(func):
    """Decorator for logging metrics operations with timing."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        start_time = time.time()
        logger = get_logger(__name__)
        
        try:
            result = await func(*args, **kwargs)
            duration = time.time() - start_time
            logger.info(
                "Metrics operation completed",
                operation=func.__name__,
                duration=duration,
                success=True
            )
            return result
        except Exception as e:
            duration = time.time() - start_time
            logger.error(
                "Metrics operation failed",
                operation=func.__name__,
                duration=duration,
                error=str(e),
                success=False
            )
            raise
    return wrapper

def validate_params(func):
    """Decorator for validating metrics query parameters."""
    @wraps(func)
    async def wrapper(*args, **kwargs):
        if 'start_time' in kwargs and 'end_time' in kwargs:
            if kwargs['end_time'] <= kwargs['start_time']:
                raise ValueError("End time must be after start time")
            
            # Limit query range to retention period
            max_start_time = datetime.utcnow().timestamp() - (METRICS_RETENTION_DAYS * 86400)
            if kwargs['start_time'].timestamp() < max_start_time:
                kwargs['start_time'] = datetime.fromtimestamp(max_start_time)
        
        return await func(*args, **kwargs)
    return wrapper

class MetricsService:
    """Enhanced service class for managing all system metrics operations."""
    
    def __init__(self, db_session, logger, cache):
        """Initialize metrics service with enhanced components."""
        self._session = db_session
        self._logger = logger or get_logger(__name__)
        self._cache = cache
        
        # Initialize metrics collectors
        self._gpu_metrics = self._setup_prometheus_metrics()
        self._carbon_collector = CarbonMetricsCollector()
        
        # Start background collection
        self._start_collection_tasks()
        
        # Register shutdown handlers
        self._register_shutdown_handlers()

    def _setup_prometheus_metrics(self) -> Dict:
        """Initialize Prometheus metrics collectors."""
        return {
            'gpu_temperature': Gauge(
                'gpu_temperature_celsius',
                'GPU temperature in Celsius',
                ['gpu_id']
            ),
            'gpu_utilization': Gauge(
                'gpu_utilization_percent',
                'GPU utilization percentage',
                ['gpu_id']
            ),
            'gpu_memory': Gauge(
                'gpu_memory_usage_bytes',
                'GPU memory usage',
                ['gpu_id', 'type']
            ),
            'gpu_power': Gauge(
                'gpu_power_usage_watts',
                'GPU power consumption',
                ['gpu_id']
            ),
            'carbon_impact': Gauge(
                'gpu_carbon_impact_kg',
                'GPU carbon impact',
                ['gpu_id']
            ),
            'collection_latency': Histogram(
                'metrics_collection_latency_seconds',
                'Metrics collection latency'
            )
        }

    def _start_collection_tasks(self):
        """Start background metrics collection tasks."""
        asyncio.create_task(self._collect_metrics_loop())
        self._carbon_collector.start_collection()

    def _register_shutdown_handlers(self):
        """Register cleanup handlers for graceful shutdown."""
        import atexit
        atexit.register(self._cleanup)

    def _cleanup(self):
        """Cleanup resources on shutdown."""
        self._carbon_collector.stop_collection()
        self._logger.info("Metrics service shutdown completed")

    async def _collect_metrics_loop(self):
        """Background task for continuous metrics collection."""
        while True:
            try:
                start_time = time.time()
                
                # Collect GPU metrics
                gpu_metrics = await collect_gpu_metrics()
                
                # Update Prometheus metrics
                self._update_prometheus_metrics(gpu_metrics)
                
                # Calculate and record carbon impact
                for gpu_id, metrics in gpu_metrics.items():
                    emissions = calculate_co2_emissions(metrics)
                    captured = calculate_carbon_capture(emissions)
                    self._gpu_metrics['carbon_impact'].labels(gpu_id=gpu_id).set(
                        emissions - captured
                    )
                
                # Record collection latency
                collection_time = time.time() - start_time
                self._gpu_metrics['collection_latency'].observe(collection_time)
                
                await asyncio.sleep(METRICS_COLLECTION_INTERVAL)
            except Exception as e:
                self._logger.error(f"Metrics collection failed: {str(e)}")
                await asyncio.sleep(5)  # Brief delay before retry

    def _update_prometheus_metrics(self, metrics: Dict):
        """Update Prometheus metrics collectors with latest values."""
        try:
            for gpu_id, gpu_metrics in metrics.items():
                self._gpu_metrics['gpu_temperature'].labels(
                    gpu_id=gpu_id
                ).set(gpu_metrics['temperature'])
                
                self._gpu_metrics['gpu_utilization'].labels(
                    gpu_id=gpu_id
                ).set(gpu_metrics['utilization'])
                
                self._gpu_metrics['gpu_memory'].labels(
                    gpu_id=gpu_id, type='used'
                ).set(gpu_metrics['memory_used'])
                
                self._gpu_metrics['gpu_power'].labels(
                    gpu_id=gpu_id
                ).set(gpu_metrics['power_usage'])
        except Exception as e:
            self._logger.error(f"Failed to update Prometheus metrics: {str(e)}")

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=BACKOFF_FACTOR),
        reraise=True
    )
    @validate_params
    @log_metrics
    async def get_gpu_metrics(
        self,
        start_time: datetime,
        end_time: datetime,
        gpu_ids: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> List[GPUMetricsBase]:
        """
        Retrieve GPU metrics with caching and validation.
        
        Args:
            start_time: Start of metrics period
            end_time: End of metrics period
            gpu_ids: Optional list of specific GPU IDs
            use_cache: Whether to use cached metrics
            
        Returns:
            List[GPUMetricsBase]: Validated GPU metrics
        """
        try:
            # Check cache if enabled
            if use_cache:
                cache_key = f"gpu_metrics:{start_time.isoformat()}:{end_time.isoformat()}"
                cached_metrics = await self._cache.get(cache_key)
                if cached_metrics:
                    return [GPUMetricsBase.parse_raw(m) for m in cached_metrics]

            # Query metrics in batches
            metrics = []
            async with self._session() as session:
                query = session.query(GPUMetricsBase)
                if gpu_ids:
                    query = query.filter(GPUMetricsBase.gpu_id.in_(gpu_ids))
                query = query.filter(
                    GPUMetricsBase.timestamp.between(start_time, end_time)
                ).order_by(GPUMetricsBase.timestamp.desc())

                # Process in batches
                offset = 0
                while True:
                    batch = await query.offset(offset).limit(METRICS_BATCH_SIZE).all()
                    if not batch:
                        break
                    
                    metrics.extend(batch)
                    offset += METRICS_BATCH_SIZE

            # Validate metrics
            validated_metrics = []
            for metric in metrics:
                try:
                    validated_metric = GPUMetricsBase(**metric.to_orm())
                    validated_metrics.append(validated_metric)
                except Exception as e:
                    self._logger.warning(f"Invalid metric data: {str(e)}")

            # Cache results if enabled
            if use_cache and validated_metrics:
                await self._cache.setex(
                    cache_key,
                    CACHE_TTL_SECONDS,
                    [m.json() for m in validated_metrics]
                )

            return validated_metrics

        except Exception as e:
            self._logger.error(f"Failed to retrieve GPU metrics: {str(e)}")
            raise