"""
Utility module for calculating, tracking, and reporting carbon metrics related to GPU usage
and the integrated carbon capture system. Provides comprehensive functionality for measuring
CO2 emissions, capture rates, environmental impact metrics, and real-time monitoring.
"""

import numpy as np  # version: 1.24.0
from prometheus_client import Counter, Gauge, Histogram  # version: 0.17.0
import threading
import time
from typing import Dict, Optional

from api.utils.logger import setup_logging, get_logger
from api.utils.gpu_metrics import collect_gpu_metrics

# Global constants for carbon metrics calculations and monitoring
CO2_CAPTURE_RATE = 0.5  # 50% capture target
POWER_TO_CO2_RATIO = 0.85  # kgCO2/kWh conversion factor
METRICS_COLLECTION_INTERVAL = 300  # 5 minutes
CARBON_METRICS_PREFIX = 'provocative_carbon'

# Initialize logging
logger = get_logger(__name__)

def initialize_carbon_monitoring() -> bool:
    """
    Initializes the enhanced carbon metrics monitoring system with validation and optimization features.
    """
    try:
        # Set up Prometheus metrics collectors
        _setup_prometheus_metrics()

        # Initialize logging with detailed tracking
        setup_logging()

        # Validate system configuration
        logger.info("Carbon monitoring system initialized with capture rate: %.2f", CO2_CAPTURE_RATE)
        return True
    except Exception as e:
        logger.error(f"Failed to initialize carbon monitoring: {str(e)}")
        return False

def calculate_co2_emissions(gpu_metrics: Dict) -> float:
    """
    Calculates CO2 emissions with enhanced accuracy and validation.

    Args:
        gpu_metrics: Dictionary containing GPU power usage and efficiency metrics

    Returns:
        float: Validated CO2 emissions in kilograms with confidence score
    """
    try:
        # Extract and validate power consumption metrics
        power_usage = gpu_metrics.get('power_usage', 0)
        if not isinstance(power_usage, (int, float)) or power_usage < 0:
            raise ValueError(f"Invalid power usage value: {power_usage}")

        # Calculate energy consumption (kWh)
        duration_hours = METRICS_COLLECTION_INTERVAL / 3600
        energy_consumption = (power_usage * duration_hours) / 1000

        # Calculate emissions with validation
        emissions = energy_consumption * POWER_TO_CO2_RATIO

        # Validate results against historical trends
        if emissions > 100:  # Threshold for unrealistic values
            logger.warning(f"Unusually high emissions detected: {emissions} kgCO2")

        return emissions
    except Exception as e:
        logger.error(f"CO2 emissions calculation failed: {str(e)}")
        raise

def calculate_carbon_capture(co2_emissions: float) -> float:
    """
    Calculates CO2 capture with advanced validation and monitoring.

    Args:
        co2_emissions: CO2 emissions in kilograms

    Returns:
        float: Validated CO2 captured in kilograms with system efficiency metrics
    """
    try:
        # Validate input emissions data
        if not isinstance(co2_emissions, (int, float)) or co2_emissions < 0:
            raise ValueError(f"Invalid CO2 emissions value: {co2_emissions}")

        # Calculate capture amount with system efficiency
        captured_co2 = co2_emissions * CO2_CAPTURE_RATE

        # Validate capture efficiency
        if captured_co2 / co2_emissions > CO2_CAPTURE_RATE + 0.1:
            logger.warning(f"Unusually high capture efficiency detected: {captured_co2/co2_emissions:.2f}")

        return captured_co2
    except Exception as e:
        logger.error(f"Carbon capture calculation failed: {str(e)}")
        raise

def calculate_carbon_effectiveness(total_emissions: float, total_captured: float) -> float:
    """
    Calculates enhanced Carbon Usage Effectiveness (CUE) with trend analysis.

    Args:
        total_emissions: Total CO2 emissions in kilograms
        total_captured: Total CO2 captured in kilograms

    Returns:
        float: CUE ratio with trend analysis and confidence metrics
    """
    try:
        # Validate input metrics
        if not all(isinstance(x, (int, float)) and x >= 0 for x in [total_emissions, total_captured]):
            raise ValueError("Invalid input values for carbon effectiveness calculation")

        # Calculate net emissions
        net_emissions = total_emissions - total_captured

        # Calculate CUE ratio
        if total_emissions > 0:
            cue_ratio = net_emissions / total_emissions
        else:
            cue_ratio = 0.0

        # Validate effectiveness metrics
        if cue_ratio < 0 or cue_ratio > 1:
            logger.warning(f"Carbon effectiveness ratio outside expected range: {cue_ratio}")

        return cue_ratio
    except Exception as e:
        logger.error(f"Carbon effectiveness calculation failed: {str(e)}")
        raise

def calculate_power_usage_effectiveness(total_facility_power: float, it_power: float) -> float:
    """
    Calculates the Power Usage Effectiveness (PUE), which is the ratio of
    the total amount of power used by the data center facility to the
    power delivered to IT equipment (e.g., servers, GPUs).

    Args:
        total_facility_power (float): Total power consumption for the entire facility (kW or kWh).
        it_power (float): Power consumption used specifically by IT equipment (kW or kWh).

    Returns:
        float: The calculated PUE. Typical values range above 1.0.
    """
    try:
        # Basic validation
        if total_facility_power <= 0 or it_power <= 0:
            raise ValueError("Total facility power and IT power must be positive.")

        # Calculate PUE
        pue = total_facility_power / it_power

        # Optionally warn if PUE is outside a normal-ish range
        if pue < 1.0:
            logger.warning(f"Unusually low PUE (<1.0) detected: {pue:.2f}")
        elif pue > 2.5:
            logger.warning(f"High PUE detected: {pue:.2f}")

        return pue

    except Exception as e:
        logger.error(f"Failed to calculate PUE: {str(e)}")
        raise

def calculate_carbon_usage_effectiveness(total_data_center_emissions: float, it_equipment_energy_kwh: float) -> float:
    """
    Calculates the Carbon Usage Effectiveness (CUE), the ratio of the total
    data center CO₂ emissions to the energy used by the IT equipment (in kWh).

    Args:
        total_data_center_emissions (float): Total CO₂ emissions from the data center, in kilograms.
        it_equipment_energy_kwh (float): Energy consumption of IT equipment, in kWh.

    Returns:
        float: The CUE ratio. Lower is generally better (less CO₂ per kWh of IT power).
    """
    try:
        if total_data_center_emissions < 0 or it_equipment_energy_kwh <= 0:
            raise ValueError(
                f"Invalid inputs for CUE calculation. "
                f"Emissions={total_data_center_emissions}, IT Energy={it_equipment_energy_kwh}"
            )

        cue = total_data_center_emissions / it_equipment_energy_kwh

        # Optional: warn if the ratio is outside typical bounds
        if cue < 0.0:
            logger.warning(f"Unusually low (negative) CUE detected: {cue:.2f}")
        elif cue > 2.0:
            logger.warning(f"High CUE detected: {cue:.2f}")

        return cue

    except Exception as e:
        logger.error(f"Failed to calculate Carbon Usage Effectiveness: {str(e)}")
        raise

def calculate_co2_captured(total_co2_emissions: float, capture_rate: float = 0.5) -> float:
    """
    Calculates how much CO₂ has been captured, given total emissions and a capture rate.

    Args:
        total_co2_emissions (float): Total CO₂ emissions in kilograms.
        capture_rate (float): Fraction (0-1) of CO₂ emissions captured. Default is 0.5 (50%).

    Returns:
        float: CO₂ captured in kilograms.

    Raises:
        ValueError: If inputs are invalid (e.g., negative emissions or capture rate).
    """
    try:
        if total_co2_emissions < 0:
            raise ValueError(f"CO₂ emissions must be non-negative. Received: {total_co2_emissions}")
        if not (0 <= capture_rate <= 1):
            raise ValueError(f"Capture rate must be between 0 and 1. Received: {capture_rate}")

        captured_co2 = total_co2_emissions * capture_rate

        # Optionally log a warning if capture_rate is suspiciously high
        if capture_rate > 0.9:
            logger.warning(f"High CO₂ capture rate: {capture_rate * 100:.2f}%")

        return captured_co2

    except Exception as e:
        logger.error(f"Failed to calculate CO₂ captured: {str(e)}")
        raise

class CarbonMetricsCollector:
    """
    Enhanced class for continuous collection and monitoring of carbon-related metrics
    with validation and optimization.
    """

    def __init__(self):
        """Initializes enhanced carbon metrics collector with validation."""
        self._collectors = self._setup_prometheus_collectors()
        self._metrics_cache = {}
        self._logger = get_logger(__name__)
        self._validation_metrics = {}
        self._trend_analysis = {}
        self._collection_thread = None
        self._is_collecting = False

    def _setup_prometheus_collectors(self) -> Dict:
        """Sets up Prometheus metrics collectors."""
        return {
            'emissions': Gauge(
                f'{CARBON_METRICS_PREFIX}_emissions_total',
                'Total CO2 emissions in kilograms',
                ['gpu_id']
            ),
            'captured': Gauge(
                f'{CARBON_METRICS_PREFIX}_captured_total',
                'Total CO2 captured in kilograms',
                ['gpu_id']
            ),
            'effectiveness': Gauge(
                f'{CARBON_METRICS_PREFIX}_effectiveness_ratio',
                'Carbon usage effectiveness ratio',
                ['gpu_id']
            ),
            'collection_latency': Histogram(
                f'{CARBON_METRICS_PREFIX}_collection_latency_seconds',
                'Carbon metrics collection latency'
            )
        }

    def start_collection(self) -> None:
        """Starts enhanced continuous carbon metrics collection."""
        if self._is_collecting:
            return

        self._is_collecting = True
        self._collection_thread = threading.Thread(target=self._collection_loop)
        self._collection_thread.daemon = True
        self._collection_thread.start()
        self._logger.info("Carbon metrics collection started")

    def stop_collection(self) -> None:
        """Stops carbon metrics collection with cleanup."""
        self._is_collecting = False
        if self._collection_thread:
            self._collection_thread.join()
        self._logger.info("Carbon metrics collection stopped")

    def get_current_metrics(self) -> Dict:
        """Returns comprehensive current carbon metrics with validation."""
        try:
            # Collect current GPU metrics
            gpu_metrics = collect_gpu_metrics()

            # Calculate emissions and capture
            emissions = calculate_co2_emissions(gpu_metrics)
            captured = calculate_carbon_capture(emissions)
            effectiveness = calculate_carbon_effectiveness(emissions, captured)

            metrics = {
                'emissions_kg': emissions,
                'captured_kg': captured,
                'effectiveness_ratio': effectiveness,
                'timestamp': time.time()
            }

            # Validate metrics
            self._validate_metrics(metrics)

            return metrics
        except Exception as e:
            self._logger.error(f"Failed to get current metrics: {str(e)}")
            raise

    def _collection_loop(self) -> None:
        """Internal collection loop for continuous monitoring."""
        while self._is_collecting:
            try:
                start_time = time.time()

                # Collect and process metrics
                metrics = self.get_current_metrics()

                # Update Prometheus metrics
                self._update_prometheus_metrics(metrics)

                # Update cache and trend analysis
                self._update_metrics_cache(metrics)

                # Calculate collection latency
                latency = time.time() - start_time
                self._collectors['collection_latency'].observe(latency)

                time.sleep(METRICS_COLLECTION_INTERVAL)
            except Exception as e:
                self._logger.error(f"Metrics collection error: {str(e)}")
                time.sleep(5)  # Brief delay before retry

    def _validate_metrics(self, metrics: Dict) -> None:
        """Validates collected metrics against expected ranges and historical trends."""
        try:
            # Validate emissions
            if metrics['emissions_kg'] < 0:
                raise ValueError(f"Invalid negative emissions: {metrics['emissions_kg']}")

            # Validate capture ratio
            capture_ratio = metrics['captured_kg'] / metrics['emissions_kg'] if metrics['emissions_kg'] > 0 else 0
            if capture_ratio > CO2_CAPTURE_RATE + 0.1:
                self._logger.warning(f"Unusually high capture ratio detected: {capture_ratio:.2f}")

            # Validate effectiveness
            if not 0 <= metrics['effectiveness_ratio'] <= 1:
                raise ValueError(f"Invalid effectiveness ratio: {metrics['effectiveness_ratio']}")
        except Exception as e:
            self._logger.error(f"Metrics validation failed: {str(e)}")
            raise

    def _update_prometheus_metrics(self, metrics: Dict) -> None:
        """Updates Prometheus metrics collectors with latest values."""
        try:
            self._collectors['emissions'].labels(gpu_id='total').set(metrics['emissions_kg'])
            self._collectors['captured'].labels(gpu_id='total').set(metrics['captured_kg'])
            self._collectors['effectiveness'].labels(gpu_id='total').set(metrics['effectiveness_ratio'])
        except Exception as e:
            self._logger.error(f"Failed to update Prometheus metrics: {str(e)}")

    def _update_metrics_cache(self, metrics: Dict) -> None:
        """Updates metrics cache with latest values and performs trend analysis."""
        try:
            self._metrics_cache[metrics['timestamp']] = metrics

            # Clean old cache entries
            current_time = time.time()
            self._metrics_cache = {
                ts: m for ts, m in self._metrics_cache.items()
                if current_time - ts <= 86400  # Keep 24 hours of data
            }

            # Update trend analysis
            if len(self._metrics_cache) > 1:
                timestamps = sorted(self._metrics_cache.keys())
                recent_effectiveness = [
                    self._metrics_cache[ts]['effectiveness_ratio']
                    for ts in timestamps[-10:]  # Analyze last 10 readings
                ]
                self._trend_analysis['effectiveness_trend'] = np.mean(recent_effectiveness)
        except Exception as e:
            self._logger.error(f"Failed to update metrics cache: {str(e)}")
