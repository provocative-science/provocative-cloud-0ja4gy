"""
Utility module for collecting, processing, and managing GPU metrics data for the Provocative Cloud platform.
Provides high-level abstractions for GPU monitoring, metrics aggregation, and environmental impact tracking.
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Optional

import numpy as np  # version: 1.24.0
from prometheus_client import Counter, Gauge, Histogram  # version: 0.17.0

from gpu_manager.metrics import GPUMetricsCollector
from api.utils.logger import get_logger

# Global constants for metrics collection and thresholds
METRICS_COLLECTION_INTERVAL = 60  # seconds
METRICS_RETENTION_PERIOD = 2592000  # 30 days
TEMPERATURE_ALERT_THRESHOLD = 80.0  # Celsius
MEMORY_ALERT_THRESHOLD = 0.95  # 95% utilization
UTILIZATION_ALERT_THRESHOLD = 0.90  # 90% utilization
CARBON_INTENSITY_FACTOR = 0.475  # kgCO2/kWh
PUE_TARGET = 1.2  # Power Usage Effectiveness target
COOLING_EFFICIENCY_THRESHOLD = 0.85  # Minimum cooling efficiency
CO2_CAPTURE_RATE = 0.5  # 50% capture rate

# Initialize logger
logger = get_logger(__name__)

class GPUMetricsManager:
    """Enhanced manager for GPU metrics with environmental impact tracking."""
    
    def __init__(self, enable_environmental_tracking: bool = True, prometheus_config: Optional[Dict] = None):
        """Initialize the GPU metrics manager with environmental monitoring support."""
        self._collector = GPUMetricsCollector()
        self._metrics_cache = {}
        self._logger = logger
        self._is_collecting = False
        self._environmental_metrics = {}
        
        # Initialize Prometheus metrics
        self._prometheus_client = self._setup_prometheus_metrics(prometheus_config)

    def _setup_prometheus_metrics(self, config: Optional[Dict]) -> Dict:
        """Set up Prometheus metrics collectors with environmental metrics."""
        return {
            'gpu_temperature': Gauge('gpu_temperature_celsius', 'GPU temperature', ['gpu_id']),
            'gpu_utilization': Gauge('gpu_utilization_percent', 'GPU utilization', ['gpu_id']),
            'gpu_memory_used': Gauge('gpu_memory_used_bytes', 'GPU memory used', ['gpu_id']),
            'gpu_power_usage': Gauge('gpu_power_usage_watts', 'GPU power consumption', ['gpu_id']),
            'carbon_impact': Gauge('gpu_carbon_impact_kg', 'GPU carbon impact', ['gpu_id']),
            'cooling_efficiency': Gauge('gpu_cooling_efficiency', 'Cooling system efficiency', ['gpu_id']),
            'co2_captured': Counter('gpu_co2_captured_kg', 'CO2 captured from GPU cooling', ['gpu_id']),
            'collection_latency': Histogram('gpu_metrics_collection_seconds', 'Metrics collection latency')
        }

    async def start_collection(self, include_environmental: bool = True) -> None:
        """Start asynchronous metrics collection with environmental tracking."""
        if self._is_collecting:
            return

        self._is_collecting = True
        self._logger.info("Starting GPU metrics collection with environmental tracking")

        try:
            while self._is_collecting:
                metrics = await collect_gpu_metrics(self._collector.gpu_ids, include_environmental)
                processed_metrics = process_metrics(metrics, include_environmental)
                
                # Update Prometheus metrics
                for gpu_id, gpu_metrics in processed_metrics.items():
                    self._update_prometheus_metrics(gpu_id, gpu_metrics)
                
                # Cache processed metrics
                self._metrics_cache.update(processed_metrics)
                
                # Check for alerts
                alerts = check_alerts(processed_metrics, include_environmental)
                for alert in alerts:
                    self._logger.warning(f"GPU Alert: {alert['message']}", extra=alert)
                
                await asyncio.sleep(METRICS_COLLECTION_INTERVAL)
        except Exception as e:
            self._logger.error(f"Metrics collection failed: {str(e)}")
            self._is_collecting = False
            raise

    def stop_collection(self) -> None:
        """Gracefully stop metrics collection."""
        self._is_collecting = False
        self._logger.info("Stopping GPU metrics collection")

    async def get_metrics(self, start_time: datetime, end_time: datetime, 
                         include_environmental: bool = True) -> Dict:
        """Retrieve comprehensive GPU metrics with environmental data."""
        try:
            metrics = await self._collector.get_historical_metrics(start_time, end_time)
            processed_metrics = process_metrics(metrics, include_environmental)
            
            if include_environmental:
                for gpu_id in processed_metrics:
                    carbon_impact = calculate_carbon_impact(
                        processed_metrics[gpu_id]['power_usage'],
                        (end_time - start_time).total_seconds() / 3600,
                        processed_metrics[gpu_id]['cooling_efficiency'],
                        CO2_CAPTURE_RATE
                    )
                    processed_metrics[gpu_id]['environmental'] = carbon_impact
            
            return processed_metrics
        except Exception as e:
            self._logger.error(f"Failed to retrieve metrics: {str(e)}")
            raise

    def _update_prometheus_metrics(self, gpu_id: str, metrics: Dict) -> None:
        """Update Prometheus metrics with latest values."""
        try:
            self._prometheus_client['gpu_temperature'].labels(gpu_id=gpu_id).set(metrics['temperature'])
            self._prometheus_client['gpu_utilization'].labels(gpu_id=gpu_id).set(metrics['utilization'])
            self._prometheus_client['gpu_memory_used'].labels(gpu_id=gpu_id).set(metrics['memory_used'])
            self._prometheus_client['gpu_power_usage'].labels(gpu_id=gpu_id).set(metrics['power_usage'])
            
            if 'environmental' in metrics:
                self._prometheus_client['carbon_impact'].labels(gpu_id=gpu_id).set(
                    metrics['environmental']['net_carbon_impact']
                )
                self._prometheus_client['cooling_efficiency'].labels(gpu_id=gpu_id).set(
                    metrics['environmental']['cooling_efficiency']
                )
                self._prometheus_client['co2_captured'].labels(gpu_id=gpu_id).inc(
                    metrics['environmental']['co2_captured']
                )
        except Exception as e:
            self._logger.error(f"Failed to update Prometheus metrics: {str(e)}")

async def collect_gpu_metrics(gpu_ids: List[str], include_environmental: bool = True) -> Dict:
    """Asynchronously collect comprehensive metrics from all available GPUs."""
    try:
        collector = GPUMetricsCollector()
        raw_metrics = await collector.collect_metrics()
        
        if include_environmental:
            for gpu_id in gpu_ids:
                raw_metrics[gpu_id]['environmental'] = {
                    'cooling_efficiency': raw_metrics[gpu_id].get('cooling_efficiency', 0),
                    'power_efficiency': raw_metrics[gpu_id].get('power_efficiency', 0)
                }
        
        return raw_metrics
    except Exception as e:
        logger.error(f"Failed to collect GPU metrics: {str(e)}")
        raise

def process_metrics(raw_metrics: Dict, validate_environmental: bool = True) -> Dict:
    """Process raw GPU metrics into standardized format with validation."""
    processed_metrics = {}
    
    try:
        for gpu_id, metrics in raw_metrics.items():
            processed_metrics[gpu_id] = {
                'temperature': float(metrics['temperature']),
                'utilization': float(metrics['utilization']['gpu']) / 100,
                'memory_used': int(metrics['memory']['used']),
                'memory_total': int(metrics['memory']['total']),
                'power_usage': float(metrics['power']['current']),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            if validate_environmental and 'environmental' in metrics:
                processed_metrics[gpu_id]['cooling_efficiency'] = float(
                    metrics['environmental']['cooling_efficiency']
                )
                processed_metrics[gpu_id]['power_efficiency'] = float(
                    metrics['environmental']['power_efficiency']
                )
    
        return processed_metrics
    except Exception as e:
        logger.error(f"Failed to process metrics: {str(e)}")
        raise

def calculate_carbon_impact(power_watts: float, duration_hours: float,
                          cooling_efficiency: float, capture_rate: float) -> Dict:
    """Calculate comprehensive carbon impact including CO2 capture offset."""
    try:
        # Convert power to kWh
        energy_kwh = (power_watts * duration_hours) / 1000
        
        # Calculate PUE adjusted power consumption
        pue_adjusted_energy = energy_kwh * PUE_TARGET
        
        # Calculate base carbon emissions
        base_emissions = pue_adjusted_energy * CARBON_INTENSITY_FACTOR
        
        # Calculate cooling impact and CO2 capture
        cooling_power = energy_kwh * (1 - cooling_efficiency)
        co2_captured = cooling_power * CARBON_INTENSITY_FACTOR * capture_rate
        
        # Calculate net carbon impact
        net_carbon_impact = base_emissions - co2_captured
        
        return {
            'energy_consumption_kwh': energy_kwh,
            'pue_adjusted_energy_kwh': pue_adjusted_energy,
            'base_emissions_kg': base_emissions,
            'cooling_efficiency': cooling_efficiency,
            'co2_captured': co2_captured,
            'net_carbon_impact': net_carbon_impact,
            'capture_rate': capture_rate
        }
    except Exception as e:
        logger.error(f"Failed to calculate carbon impact: {str(e)}")
        raise

def check_alerts(metrics: Dict, include_environmental: bool = True) -> List[Dict]:
    """Check for metric threshold violations including environmental metrics."""
    alerts = []
    
    try:
        for gpu_id, gpu_metrics in metrics.items():
            # Temperature alerts
            if gpu_metrics['temperature'] > TEMPERATURE_ALERT_THRESHOLD:
                alerts.append({
                    'gpu_id': gpu_id,
                    'type': 'temperature',
                    'severity': 'high',
                    'message': f"GPU temperature exceeds threshold: {gpu_metrics['temperature']}°C"
                })
            
            # Memory usage alerts
            memory_usage = gpu_metrics['memory_used'] / gpu_metrics['memory_total']
            if memory_usage > MEMORY_ALERT_THRESHOLD:
                alerts.append({
                    'gpu_id': gpu_id,
                    'type': 'memory',
                    'severity': 'warning',
                    'message': f"High memory usage: {memory_usage:.1%}"
                })
            
            # Utilization alerts
            if gpu_metrics['utilization'] > UTILIZATION_ALERT_THRESHOLD:
                alerts.append({
                    'gpu_id': gpu_id,
                    'type': 'utilization',
                    'severity': 'warning',
                    'message': f"High GPU utilization: {gpu_metrics['utilization']:.1%}"
                })
            
            # Environmental alerts
            if include_environmental and 'cooling_efficiency' in gpu_metrics:
                if gpu_metrics['cooling_efficiency'] < COOLING_EFFICIENCY_THRESHOLD:
                    alerts.append({
                        'gpu_id': gpu_id,
                        'type': 'cooling',
                        'severity': 'warning',
                        'message': f"Low cooling efficiency: {gpu_metrics['cooling_efficiency']:.1%}"
                    })
        
        return alerts
    except Exception as e:
        logger.error(f"Failed to check alerts: {str(e)}")
        raise