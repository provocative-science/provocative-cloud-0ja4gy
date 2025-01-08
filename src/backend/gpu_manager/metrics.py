"""
Core GPU metrics collection and management module for the Provocative Cloud platform.
Handles real-time GPU metrics collection, processing, and monitoring with integration
for carbon capture metrics and environmental impact tracking.
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import time

import numpy as np  # version: 1.24.0
from prometheus_client import Counter, Gauge, Histogram  # version: 0.17.0
from pydantic import BaseModel  # version: 2.0+
import aioredis  # version: 2.0+

from gpu_manager.config import gpu_settings
from gpu_manager.nvidia import NvidiaGPU

# Global constants
METRICS_COLLECTION_INTERVAL = 60
METRICS_RETENTION_PERIOD = 2592000  # 30 days
TEMPERATURE_ALERT_THRESHOLD = 80.0
MEMORY_ALERT_THRESHOLD = 0.95
UTILIZATION_ALERT_THRESHOLD = 0.90
CARBON_INTENSITY_FACTOR = 0.475  # kgCO2/kWh
PUE_TARGET = 1.2
METRICS_BATCH_SIZE = 100
CACHE_EXPIRY = 3600
ALERT_COOLDOWN_PERIOD = 300

# Configure logging
logger = logging.getLogger(__name__)

class MetricsValidationModel(BaseModel):
    """Validation model for GPU metrics data."""
    temperature: float
    utilization: float
    memory_used: int
    memory_total: int
    power_usage: float
    carbon_impact: float

@dataclass
class GPUMetricsCollector:
    """
    Advanced metrics collection and management system for GPU resources with
    environmental impact tracking and real-time monitoring capabilities.
    """
    gpu_ids: List[int]
    config: Optional[Dict] = None
    
    # Private attributes
    _gpu_devices: List[NvidiaGPU] = field(default_factory=list)
    _metrics_cache: Dict = field(default_factory=dict)
    _is_collecting: bool = False
    _redis_client: aioredis.Redis = None
    
    # Prometheus metrics
    _metrics_counter: Counter = field(init=False)
    _temperature_gauge: Gauge = field(init=False)
    _utilization_gauge: Gauge = field(init=False)
    _memory_gauge: Gauge = field(init=False)
    _power_gauge: Gauge = field(init=False)
    _carbon_impact_gauge: Gauge = field(init=False)
    _latency_histogram: Histogram = field(init=False)

    def __post_init__(self):
        """Initialize metrics collector with monitoring setup."""
        # Initialize GPU devices
        self._gpu_devices = [NvidiaGPU(gpu_id) for gpu_id in self.gpu_ids]
        
        # Initialize Redis connection
        self._init_redis()
        
        # Initialize Prometheus metrics
        self._init_prometheus_metrics()
        
        # Load configuration
        self.monitoring_config = gpu_settings.get_monitoring_settings()
        self.alert_thresholds = gpu_settings.get_monitoring_settings()['thresholds']

    def _init_redis(self):
        """Initialize Redis connection for metrics caching."""
        try:
            self._redis_client = aioredis.from_url(
                "redis://localhost",
                encoding="utf-8",
                decode_responses=True,
                socket_timeout=5
            )
        except Exception as e:
            logger.error(f"Redis initialization failed: {str(e)}")
            raise

    def _init_prometheus_metrics(self):
        """Initialize Prometheus metrics collectors."""
        self._metrics_counter = Counter(
            'gpu_metrics_collected_total',
            'Total number of GPU metrics collected',
            ['gpu_id']
        )
        
        self._temperature_gauge = Gauge(
            'gpu_temperature_celsius',
            'GPU temperature in Celsius',
            ['gpu_id']
        )
        
        self._utilization_gauge = Gauge(
            'gpu_utilization_percent',
            'GPU utilization percentage',
            ['gpu_id']
        )
        
        self._memory_gauge = Gauge(
            'gpu_memory_usage_bytes',
            'GPU memory usage in bytes',
            ['gpu_id', 'type']
        )
        
        self._power_gauge = Gauge(
            'gpu_power_usage_watts',
            'GPU power usage in watts',
            ['gpu_id']
        )
        
        self._carbon_impact_gauge = Gauge(
            'gpu_carbon_impact_kg',
            'GPU carbon impact in kg CO2',
            ['gpu_id']
        )
        
        self._latency_histogram = Histogram(
            'gpu_metrics_collection_latency_seconds',
            'Latency of GPU metrics collection',
            ['gpu_id']
        )

    async def start_collection(self):
        """Starts asynchronous metrics collection with batching and error handling."""
        if self._is_collecting:
            return

        self._is_collecting = True
        collection_tasks = []

        try:
            # Start collection for each GPU
            for gpu_device in self._gpu_devices:
                task = asyncio.create_task(self._collect_device_metrics(gpu_device))
                collection_tasks.append(task)

            # Wait for all collection tasks
            await asyncio.gather(*collection_tasks)
        except Exception as e:
            logger.error(f"Metrics collection failed: {str(e)}")
            self._is_collecting = False
            raise
        finally:
            self._is_collecting = False

    async def _collect_device_metrics(self, gpu_device: NvidiaGPU):
        """Collects metrics for a single GPU device."""
        while self._is_collecting:
            try:
                start_time = time.time()
                
                # Collect raw metrics
                metrics = await gpu_device.get_metrics()
                
                # Process and validate metrics
                processed_metrics = await self.collect_metrics()
                
                # Calculate environmental impact
                carbon_metrics = self.calculate_carbon_metrics(processed_metrics)
                
                # Update Prometheus metrics
                self._update_prometheus_metrics(gpu_device.device_id, processed_metrics, carbon_metrics)
                
                # Cache metrics
                await self._cache_metrics(gpu_device.device_id, processed_metrics)
                
                # Record collection latency
                collection_time = time.time() - start_time
                self._latency_histogram.labels(gpu_id=str(gpu_device.device_id)).observe(collection_time)
                
                # Check alert thresholds
                await self._check_alerts(gpu_device.device_id, processed_metrics)
                
                await asyncio.sleep(METRICS_COLLECTION_INTERVAL)
            except Exception as e:
                logger.error(f"Metrics collection failed for GPU {gpu_device.device_id}: {str(e)}")
                await asyncio.sleep(5)  # Brief delay before retry

    async def collect_metrics(self) -> Dict:
        """Collects and processes metrics from all monitored GPUs with batching."""
        metrics_batch = []
        
        for gpu_device in self._gpu_devices:
            try:
                # Collect raw metrics
                raw_metrics = await gpu_device.get_metrics()
                
                # Validate metrics
                validated_metrics = MetricsValidationModel(
                    temperature=raw_metrics['temperature'],
                    utilization=raw_metrics['utilization']['gpu'],
                    memory_used=raw_metrics['memory']['used'],
                    memory_total=raw_metrics['memory']['total'],
                    power_usage=raw_metrics['power']['current'],
                    carbon_impact=0.0  # Will be calculated later
                )
                
                metrics_batch.append({
                    'gpu_id': gpu_device.device_id,
                    'metrics': validated_metrics.dict(),
                    'timestamp': time.time()
                })
                
                self._metrics_counter.labels(gpu_id=str(gpu_device.device_id)).inc()
                
            except Exception as e:
                logger.error(f"Failed to collect metrics for GPU {gpu_device.device_id}: {str(e)}")
        
        return metrics_batch

    def calculate_carbon_metrics(self, gpu_metrics: Dict, pue_override: Optional[float] = None) -> Dict:
        """Enhanced carbon impact calculation with cooling system integration."""
        carbon_metrics = {}
        pue = pue_override or PUE_TARGET
        
        for metric in gpu_metrics:
            gpu_id = metric['gpu_id']
            power_usage = metric['metrics']['power_usage']
            
            # Calculate energy consumption (kWh)
            energy_consumption = (power_usage * METRICS_COLLECTION_INTERVAL) / 3600000
            
            # Apply PUE adjustment for cooling overhead
            adjusted_energy = energy_consumption * pue
            
            # Calculate CO2 emissions (kg)
            co2_emissions = adjusted_energy * CARBON_INTENSITY_FACTOR
            
            # Calculate cooling system efficiency
            cooling_efficiency = 1.0 - (metric['metrics']['temperature'] / TEMPERATURE_ALERT_THRESHOLD)
            
            carbon_metrics[gpu_id] = {
                'energy_consumption_kwh': energy_consumption,
                'adjusted_energy_kwh': adjusted_energy,
                'co2_emissions_kg': co2_emissions,
                'cooling_efficiency': cooling_efficiency,
                'pue_applied': pue
            }
        
        return carbon_metrics

    async def _cache_metrics(self, gpu_id: int, metrics: Dict):
        """Cache processed metrics in Redis."""
        try:
            cache_key = f"gpu_metrics:{gpu_id}"
            await self._redis_client.setex(
                cache_key,
                CACHE_EXPIRY,
                str(metrics)
            )
        except Exception as e:
            logger.error(f"Failed to cache metrics for GPU {gpu_id}: {str(e)}")

    async def _check_alerts(self, gpu_id: int, metrics: Dict):
        """Check metrics against alert thresholds."""
        try:
            for metric in metrics:
                if metric['gpu_id'] == gpu_id:
                    if metric['metrics']['temperature'] > TEMPERATURE_ALERT_THRESHOLD:
                        logger.warning(f"High temperature alert for GPU {gpu_id}: {metric['metrics']['temperature']}°C")
                    
                    memory_usage = metric['metrics']['memory_used'] / metric['metrics']['memory_total']
                    if memory_usage > MEMORY_ALERT_THRESHOLD:
                        logger.warning(f"High memory usage alert for GPU {gpu_id}: {memory_usage:.2%}")
                    
                    if metric['metrics']['utilization'] > UTILIZATION_ALERT_THRESHOLD:
                        logger.warning(f"High utilization alert for GPU {gpu_id}: {metric['metrics']['utilization']}%")
        except Exception as e:
            logger.error(f"Alert check failed for GPU {gpu_id}: {str(e)}")

    def _update_prometheus_metrics(self, gpu_id: str, metrics: Dict, carbon_metrics: Dict):
        """Update Prometheus metrics collectors."""
        try:
            for metric in metrics:
                if metric['gpu_id'] == gpu_id:
                    self._temperature_gauge.labels(gpu_id=gpu_id).set(metric['metrics']['temperature'])
                    self._utilization_gauge.labels(gpu_id=gpu_id).set(metric['metrics']['utilization'])
                    self._memory_gauge.labels(gpu_id=gpu_id, type='used').set(metric['metrics']['memory_used'])
                    self._memory_gauge.labels(gpu_id=gpu_id, type='total').set(metric['metrics']['memory_total'])
                    self._power_gauge.labels(gpu_id=gpu_id).set(metric['metrics']['power_usage'])
                    
                    if gpu_id in carbon_metrics:
                        self._carbon_impact_gauge.labels(gpu_id=gpu_id).set(
                            carbon_metrics[gpu_id]['co2_emissions_kg']
                        )
        except Exception as e:
            logger.error(f"Failed to update Prometheus metrics for GPU {gpu_id}: {str(e)}")