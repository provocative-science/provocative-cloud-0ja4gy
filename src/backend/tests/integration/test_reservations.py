import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4
from freezegun import freeze_time

from api.services.reservation_service import ReservationService
from api.utils.carbon_metrics import CarbonMetricsCollector
from gpu_manager.metrics import EnvironmentalMetricsCollector
from api.schemas.reservation import ReservationCreate, ReservationResponse
from api.schemas.gpu import GPUBase

# Test configuration constants
COOLING_EFFICIENCY_THRESHOLD = 0.85
CARBON_CAPTURE_RATE = 0.5
POWER_USAGE_THRESHOLD = 0.9
TEST_ENVIRONMENTAL_CONFIG = {
    "cooling_enabled": True,
    "carbon_capture": True,
    "monitoring_interval": 300
}

class TestEnvironmentalMetricsFixtures:
    """Test fixtures for environmental metrics testing."""

    @pytest.fixture
    async def carbon_metrics_collector(self):
        """Fixture providing configured carbon metrics collector."""
        collector = CarbonMetricsCollector()
        collector.start_collection()
        try:
            yield collector
        finally:
            collector.stop_collection()

    @pytest.fixture
    async def env_metrics_collector(self):
        """Fixture providing environmental metrics collector."""
        collector = EnvironmentalMetricsCollector()
        try:
            yield collector
        finally:
            # Cleanup not needed as collector is singleton
            pass

    @pytest.fixture
    async def test_gpu(self):
        """Fixture providing test GPU configuration."""
        return GPUBase(
            id=uuid4(),
            server_id=uuid4(),
            model="NVIDIA A100",
            vram_gb=80,
            price_per_hour=Decimal("4.50"),
            cooling_efficiency=0.9,
            power_limit_watts=250
        )

    @pytest.fixture
    async def test_reservation_data(self, test_gpu):
        """Fixture providing test reservation data."""
        return ReservationCreate(
            user_id=uuid4(),
            gpu_id=test_gpu.id,
            start_time=datetime.utcnow() + timedelta(minutes=5),
            duration_hours=1,
            auto_renew=False,
            carbon_preference="eco_friendly"
        )

@pytest.mark.asyncio
@freeze_time("2024-01-01")
async def test_create_reservation_with_environmental_metrics(
    carbon_metrics_collector,
    env_metrics_collector,
    test_gpu,
    test_reservation_data
):
    """
    Test reservation creation with environmental impact tracking.
    Validates cooling system integration and carbon metrics collection.
    """
    # Initialize services
    reservation_service = ReservationService(
        db_session=None,  # Mock will be injected
        env_metrics=env_metrics_collector,
        gpu_service=None,  # Mock will be injected
        billing_service=None  # Mock will be injected
    )

    try:
        # Create reservation with environmental tracking
        reservation_response = await reservation_service.create_reservation(test_reservation_data)

        # Validate reservation creation
        assert isinstance(reservation_response, ReservationResponse)
        assert reservation_response.reservation.gpu_id == test_gpu.id
        assert reservation_response.reservation.status == "pending"

        # Validate environmental metrics
        env_metrics = reservation_response.environmental_metrics
        assert "co2_captured_kg" in env_metrics
        assert "power_usage_kwh" in env_metrics
        assert "cooling_efficiency" in env_metrics
        assert "carbon_offset_kg" in env_metrics

        # Validate cooling system metrics
        assert env_metrics["cooling_efficiency"] >= COOLING_EFFICIENCY_THRESHOLD
        assert reservation_response.cooling_efficiency >= COOLING_EFFICIENCY_THRESHOLD

        # Validate carbon impact calculations
        carbon_impact = reservation_response.carbon_impact_report
        assert carbon_impact["co2_emissions_kg"] > 0
        assert carbon_impact["co2_captured_kg"] > 0
        assert carbon_impact["net_impact_kg"] >= 0

        # Validate power usage metrics
        assert env_metrics["power_usage_kwh"] > 0
        assert env_metrics["power_usage_kwh"] <= test_gpu.power_limit_watts * test_reservation_data.duration_hours / 1000

        # Verify carbon capture rate
        capture_rate = env_metrics["co2_captured_kg"] / carbon_impact["co2_emissions_kg"]
        assert capture_rate <= CARBON_CAPTURE_RATE
        assert capture_rate > 0

    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_reservation_carbon_offset_calculation(
    carbon_metrics_collector,
    test_gpu,
    test_reservation_data
):
    """
    Test carbon offset calculations for active reservation.
    Validates CO2 capture metrics and environmental impact tracking.
    """
    # Initialize services
    reservation_service = ReservationService(
        db_session=None,  # Mock will be injected
        env_metrics=carbon_metrics_collector,
        gpu_service=None,  # Mock will be injected
        billing_service=None  # Mock will be injected
    )

    try:
        # Create test reservation
        reservation_response = await reservation_service.create_reservation(test_reservation_data)

        # Collect initial carbon metrics
        initial_metrics = await carbon_metrics_collector.get_current_metrics()
        assert initial_metrics["emissions_kg"] >= 0
        assert initial_metrics["captured_kg"] >= 0
        assert initial_metrics["effectiveness_ratio"] <= 1.0

        # Wait for metrics collection interval
        await asyncio.sleep(1)  # Simulated wait in test environment

        # Collect updated metrics
        updated_metrics = await carbon_metrics_collector.get_current_metrics()

        # Validate carbon metrics progression
        assert updated_metrics["emissions_kg"] >= initial_metrics["emissions_kg"]
        assert updated_metrics["captured_kg"] >= initial_metrics["captured_kg"]

        # Validate carbon effectiveness
        effectiveness_delta = abs(
            updated_metrics["effectiveness_ratio"] - initial_metrics["effectiveness_ratio"]
        )
        assert effectiveness_delta >= 0
        assert updated_metrics["effectiveness_ratio"] <= 1.0

        # Verify carbon offset pricing
        carbon_pricing = reservation_response.payment.carbon_offset_amount
        assert carbon_pricing > Decimal("0.00")
        assert carbon_pricing <= reservation_response.payment.amount * Decimal("0.1")  # Max 10% of base price

        # Validate environmental impact report
        impact_report = reservation_response.carbon_impact_report
        assert "total_power_consumption_kwh" in impact_report
        assert "carbon_usage_effectiveness" in impact_report
        assert "water_usage_effectiveness" in impact_report
        assert impact_report["carbon_usage_effectiveness"] <= 2.0
        assert impact_report["water_usage_effectiveness"] <= 2.0

    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")

@pytest.mark.asyncio
async def test_reservation_cooling_system_integration(
    env_metrics_collector,
    test_gpu,
    test_reservation_data
):
    """
    Test cooling system integration with GPU reservations.
    Validates cooling efficiency metrics and power management.
    """
    # Initialize services
    reservation_service = ReservationService(
        db_session=None,  # Mock will be injected
        env_metrics=env_metrics_collector,
        gpu_service=None,  # Mock will be injected
        billing_service=None  # Mock will be injected
    )

    try:
        # Create reservation with cooling system monitoring
        reservation_response = await reservation_service.create_reservation(test_reservation_data)

        # Validate cooling system metrics
        cooling_metrics = await env_metrics_collector.collect_metrics(test_gpu.id)
        assert cooling_metrics["temperature"] <= THERMAL_THRESHOLD_CELSIUS
        assert cooling_metrics["cooling_efficiency"] >= COOLING_EFFICIENCY_THRESHOLD

        # Validate power management integration
        assert cooling_metrics["power_usage"] <= test_gpu.power_limit_watts
        assert cooling_metrics["power_efficiency"] >= POWER_USAGE_THRESHOLD

        # Verify environmental optimization
        env_impact = reservation_response.environmental_metrics
        assert env_impact["cooling_power_usage_watts"] > 0
        assert env_impact["temperature_celsius"] > 0
        assert env_impact["co2_capture_rate_kgh"] > 0

        # Validate cooling system status
        assert reservation_response.reservation.cooling_status in ["optimal", "degraded", "critical"]
        if reservation_response.reservation.cooling_status != "optimal":
            assert cooling_metrics["cooling_efficiency"] < COOLING_EFFICIENCY_THRESHOLD

    except Exception as e:
        pytest.fail(f"Test failed: {str(e)}")