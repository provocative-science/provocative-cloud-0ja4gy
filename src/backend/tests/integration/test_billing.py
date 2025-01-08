"""
Integration tests for the billing system of Provocative Cloud platform.
Tests payment processing, transactions, pricing, invoices, and security validations.
Version: 1.0.0
"""

import pytest
import stripe
from decimal import Decimal
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from uuid import uuid4
from freezegun import freeze_time

from api.services.billing_service import BillingService
from api.services.stripe_service import StripeService
from api.config import settings
from db.models.billing import Transaction, Invoice
from db.models.user import User
from db.models.reservation import Reservation
from db.models.gpu import GPU

class TestBillingSecurityFixtures:
    """Security-focused test fixtures for billing integration tests."""

    @pytest.fixture
    def webhook_secret(self) -> str:
        """Provides test webhook secret."""
        return "whsec_test_secret_key_12345"

    @pytest.fixture
    def api_key(self) -> str:
        """Provides test API key."""
        return "sk_test_51ABC123XYZ"

    @pytest.fixture
    def mock_stripe(self) -> MagicMock:
        """Creates mock Stripe client with security validations."""
        mock = MagicMock()
        mock.api_key = self.api_key
        mock.webhook_secret = self.webhook_secret
        return mock

    @pytest.fixture
    async def billing_service(self, db_session) -> BillingService:
        """Creates billing service instance with test configuration."""
        rate_limiter = MagicMock()
        return BillingService(db_session, rate_limiter)

    def create_test_webhook_signature(self, payload: dict, timestamp: int) -> str:
        """Creates test webhook signature for validation."""
        signed_payload = f"{timestamp}.{payload}"
        return f"t={timestamp},v1=abc123,v0=def456"

@pytest.mark.asyncio
async def test_payment_processing_flow(
    db_session,
    mock_stripe,
    billing_service,
    webhook_secret
):
    """Tests complete payment processing flow with security validations."""
    # Setup test data
    user_id = uuid4()
    reservation_id = uuid4()
    amount = Decimal("10.50")
    
    # Create payment with idempotency
    payment_data = {
        "user_id": user_id,
        "reservation_id": reservation_id,
        "amount": amount,
        "currency": "USD"
    }
    idempotency_key = str(uuid4())

    with patch("stripe.PaymentIntent.create") as mock_create:
        mock_create.return_value = {
            "id": "pi_test_123",
            "client_secret": "secret_123",
            "status": "requires_payment_method"
        }
        
        # Test payment creation
        payment = await billing_service.create_payment(payment_data, idempotency_key)
        assert payment["status"] == "pending"
        assert payment["amount"] == str(amount)

        # Verify idempotency handling
        duplicate_payment = await billing_service.create_payment(
            payment_data,
            idempotency_key
        )
        assert duplicate_payment["payment_id"] == payment["payment_id"]

    # Test webhook processing
    webhook_data = {
        "id": "pi_test_123",
        "object": "payment_intent",
        "status": "succeeded",
        "amount": 1050,
        "currency": "usd"
    }
    timestamp = int(datetime.now().timestamp())
    signature = TestBillingSecurityFixtures().create_test_webhook_signature(
        webhook_data,
        timestamp
    )

    with patch("stripe.Webhook.construct_event") as mock_webhook:
        mock_webhook.return_value = {
            "type": "payment_intent.succeeded",
            "data": {"object": webhook_data}
        }
        
        result = await billing_service.process_payment_webhook(webhook_data, signature)
        assert result["status"] == "success"

@pytest.mark.asyncio
async def test_pricing_management(db_session, billing_service):
    """Tests GPU pricing configuration and validation."""
    # Setup test data
    gpu_model = "NVIDIA A100"
    price_per_hour = Decimal("4.50")
    user_id = uuid4()

    # Test price setting
    pricing_data = {
        "gpu_model": gpu_model,
        "price_per_hour": price_per_hour,
        "currency": "USD",
        "effective_from": datetime.utcnow() + timedelta(hours=1),
        "effective_to": datetime.utcnow() + timedelta(days=30)
    }

    pricing = await billing_service.set_gpu_pricing(pricing_data, user_id)
    assert pricing["gpu_model"] == gpu_model
    assert Decimal(pricing["price_per_hour"]) == price_per_hour

    # Test price validation
    with pytest.raises(ValueError):
        invalid_pricing = pricing_data.copy()
        invalid_pricing["price_per_hour"] = Decimal("-1.00")
        await billing_service.set_gpu_pricing(invalid_pricing, user_id)

@pytest.mark.asyncio
async def test_invoice_generation(db_session, billing_service):
    """Tests invoice generation and validation."""
    # Setup test data
    user_id = uuid4()
    start_date = datetime.utcnow() - timedelta(days=30)
    end_date = datetime.utcnow()

    # Create test payments
    payment_data = {
        "user_id": user_id,
        "reservation_id": uuid4(),
        "amount": Decimal("100.00"),
        "currency": "USD"
    }
    await billing_service.create_payment(payment_data, str(uuid4()))

    # Test invoice generation
    background_tasks = MagicMock()
    invoice = await billing_service.generate_invoice(
        user_id,
        start_date,
        end_date,
        background_tasks
    )

    assert invoice["user_id"] == str(user_id)
    assert Decimal(invoice["total_amount"]) > 0
    assert invoice["status"] == "pending"

@pytest.mark.asyncio
async def test_payment_security_validation(db_session, mock_stripe):
    """Tests payment security validation and compliance."""
    stripe_service = StripeService()

    # Test payment amount validation
    with pytest.raises(ValueError):
        await stripe_service.create_payment_intent({
            "amount": Decimal("-10.00"),
            "currency": "USD"
        })

    # Test webhook signature validation
    invalid_signature = "invalid_signature"
    with pytest.raises(stripe.error.SignatureVerificationError):
        await stripe_service.handle_webhook_event(
            {"test": "payload"},
            invalid_signature
        )

    # Test rate limiting
    rate_limiter = MagicMock()
    rate_limiter.check.side_effect = Exception("Rate limit exceeded")
    
    billing_service = BillingService(db_session, rate_limiter)
    with pytest.raises(Exception, match="Rate limit exceeded"):
        await billing_service.create_payment({
            "amount": Decimal("10.00"),
            "currency": "USD"
        }, str(uuid4()))

@pytest.mark.asyncio
async def test_refund_processing(db_session, billing_service, mock_stripe):
    """Tests refund processing and validation."""
    # Setup test payment
    payment_data = {
        "user_id": uuid4(),
        "reservation_id": uuid4(),
        "amount": Decimal("50.00"),
        "currency": "USD"
    }
    payment = await billing_service.create_payment(payment_data, str(uuid4()))

    # Test full refund
    with patch("stripe.Refund.create") as mock_refund:
        mock_refund.return_value = {
            "id": "re_test_123",
            "amount": 5000,
            "status": "succeeded"
        }
        
        refund = await billing_service.refund_payment(
            payment["payment_id"],
            reason="customer_request"
        )
        assert refund["status"] == "succeeded"
        assert Decimal(refund["amount"]) == Decimal("50.00")

    # Test partial refund
    with patch("stripe.Refund.create") as mock_refund:
        mock_refund.return_value = {
            "id": "re_test_456",
            "amount": 2500,
            "status": "succeeded"
        }
        
        partial_refund = await billing_service.refund_payment(
            payment["payment_id"],
            amount=Decimal("25.00"),
            reason="partial_service_issue"
        )
        assert partial_refund["status"] == "succeeded"
        assert Decimal(partial_refund["amount"]) == Decimal("25.00")