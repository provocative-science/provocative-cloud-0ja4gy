import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import Mock, patch, AsyncMock
from uuid import UUID, uuid4
from freezegun import freeze_time
from faker import Faker

# Import services
from api.services.auth_service import (
    authenticate_user, get_oauth_url, get_user_by_token,
    verify_user_role, validate_device_fingerprint
)
from api.services.gpu_service import GPUService
from api.services.billing_service import BillingService

# Initialize faker for test data generation
fake = Faker()

@pytest.fixture
def mock_db_session():
    """Fixture for mocked database session."""
    session = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    return session

@pytest.fixture
def mock_gpu_service():
    """Fixture for mocked GPU service."""
    return Mock(spec=GPUService)

@pytest.fixture
def mock_billing_service():
    """Fixture for mocked billing service."""
    return Mock(spec=BillingService)

def pytest_configure(config):
    """Configure test environment with required markers and mocks."""
    # Register custom markers
    config.addinivalue_line("markers", "auth: authentication service tests")
    config.addinivalue_line("markers", "gpu: GPU service tests")
    config.addinivalue_line("markers", "billing: billing service tests")
    config.addinivalue_line("markers", "environmental: environmental metrics tests")

class TestAuthService:
    """Test suite for authentication service functionality."""

    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_authenticate_user_success(self, mock_db_session):
        """Test successful user authentication with device fingerprinting."""
        # Prepare test data
        auth_request = {
            "code": "test_oauth_code",
            "redirect_uri": "https://provocative.cloud/oauth/callback",
            "device_id": str(uuid4())
        }
        device_fingerprint = "test_fingerprint"
        
        # Mock OAuth token verification
        with patch('api.services.auth_service.verify_oauth_token') as mock_verify:
            mock_verify.return_value = {
                "sub": "test_user_id",
                "email": "test@example.com"
            }
            
            # Mock device fingerprint validation
            with patch('api.services.auth_service.validate_device_fingerprint') as mock_validate:
                mock_validate.return_value = True
                
                # Execute authentication
                result = await authenticate_user(auth_request, mock_db_session, device_fingerprint)
                
                # Verify results
                assert result.access_token is not None
                assert result.token_type == "bearer"
                mock_db_session.commit.assert_called_once()

    @pytest.mark.auth
    @pytest.mark.asyncio
    async def test_device_fingerprint_validation(self, mock_db_session):
        """Test device fingerprint validation logic."""
        # Create test user with existing fingerprints
        test_user = Mock()
        test_user.device_fingerprints = ["existing_fingerprint"]
        
        # Test valid new fingerprint
        new_fingerprint = "new_test_fingerprint"
        await validate_device_fingerprint(test_user, new_fingerprint)
        
        # Verify fingerprint was added
        assert new_fingerprint in test_user.device_fingerprints
        
        # Test exceeding device limit
        test_user.device_fingerprints = ["fp1", "fp2", "fp3", "fp4", "fp5"]
        with pytest.raises(Exception) as exc_info:
            await validate_device_fingerprint(test_user, "new_fingerprint")
        assert "Maximum of 5 devices allowed" in str(exc_info.value)

class TestGPUService:
    """Test suite for GPU service functionality including environmental metrics."""

    @pytest.mark.gpu
    @pytest.mark.environmental
    @pytest.mark.asyncio
    async def test_get_environmental_metrics(self, mock_gpu_service):
        """Test retrieval of environmental impact metrics."""
        # Mock GPU metrics
        mock_metrics = {
            "temperature": 65.0,
            "power_usage": 250,
            "utilization": 80,
            "cooling_efficiency": 0.85,
            "carbon_capture": {
                "rate": 0.5,
                "total_captured": 100.0
            }
        }
        
        mock_gpu_service.get_metrics.return_value = mock_metrics
        
        # Get environmental metrics
        metrics = await mock_gpu_service.get_environmental_metrics()
        
        # Verify metrics
        assert "cooling_efficiency" in metrics
        assert "carbon_capture" in metrics
        assert metrics["cooling_efficiency"] >= 0.0
        assert metrics["cooling_efficiency"] <= 1.0
        assert metrics["carbon_capture"]["rate"] > 0

    @pytest.mark.gpu
    @pytest.mark.environmental
    @pytest.mark.asyncio
    async def test_gpu_allocation_with_environmental_impact(self, mock_gpu_service):
        """Test GPU allocation with environmental consideration."""
        # Prepare test data
        reservation_id = uuid4()
        requirements = {
            "gpu_id": str(uuid4()),
            "compute_requirements": {
                "memory_gb": 32,
                "max_power_watts": 300
            }
        }
        
        # Mock environmental metrics
        mock_env_metrics = {
            "power_efficiency": 0.85,
            "thermal_efficiency": 0.90,
            "carbon_efficiency": 0.88,
            "co2_captured_kg": 50.0
        }
        
        mock_gpu_service.monitor_environmental_impact.return_value = mock_env_metrics
        
        # Allocate GPU
        allocation = await mock_gpu_service.allocate_gpu(reservation_id, requirements)
        
        # Verify allocation includes environmental metrics
        assert "environmental_metrics" in allocation
        assert allocation["environmental_metrics"]["power_efficiency"] > 0
        assert allocation["environmental_metrics"]["carbon_efficiency"] > 0

class TestBillingService:
    """Test suite for billing service functionality including carbon offset billing."""

    @pytest.mark.billing
    @pytest.mark.environmental
    @pytest.mark.asyncio
    async def test_carbon_offset_calculation(self, mock_billing_service):
        """Test carbon offset fee calculation."""
        # Mock environmental metrics
        env_metrics = {
            "power_usage_kwh": 100.0,
            "co2_captured_kg": 50.0,
            "cooling_efficiency": 0.85
        }
        
        # Mock pricing configuration
        pricing_config = {
            "base_rate": Decimal("1.50"),
            "carbon_offset_rate": Decimal("0.10")
        }
        
        mock_billing_service.calculate_carbon_offset.return_value = {
            "offset_amount": Decimal("5.00"),
            "total_amount": Decimal("155.00")
        }
        
        # Calculate carbon offset
        result = await mock_billing_service.calculate_carbon_offset(env_metrics)
        
        # Verify calculations
        assert result["offset_amount"] > 0
        assert result["total_amount"] > result["offset_amount"]

    @pytest.mark.billing
    @pytest.mark.environmental
    @pytest.mark.asyncio
    async def test_dynamic_pricing_with_environmental_factors(self, mock_billing_service):
        """Test dynamic pricing based on environmental impact."""
        # Mock environmental metrics
        env_metrics = {
            "cooling_efficiency": 0.90,
            "carbon_efficiency": 0.85,
            "power_efficiency": 0.88
        }
        
        # Mock market demand data
        market_data = {
            "current_demand": 0.75,
            "peak_hours": False
        }
        
        # Set GPU pricing
        pricing_data = {
            "gpu_model": "NVIDIA A100",
            "base_price": Decimal("4.50"),
            "environmental_factors": env_metrics,
            "market_data": market_data
        }
        
        result = await mock_billing_service.set_gpu_pricing(pricing_data)
        
        # Verify pricing reflects environmental impact
        assert "environmental_adjustment" in result
        assert result["final_price"] != result["base_price"]
        assert result["environmental_adjustment"] > 0