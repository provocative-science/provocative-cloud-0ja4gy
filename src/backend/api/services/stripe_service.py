"""
Stripe payment processing service for Provocative Cloud platform.
Implements secure payment processing, webhook handling, refunds, and comprehensive error management.
Version: 1.0.0
"""

from decimal import Decimal
from typing import Dict, Optional
import logging

import stripe  # version: 5.0+
from fastapi import HTTPException
from tenacity import retry, stop_after_attempt, wait_exponential  # version: 8.0+

from api.schemas.billing import PaymentBase, PaymentCreate
from api.config import settings
from api.utils.logger import setup_logging, get_logger

# Constants for Stripe integration
STRIPE_API_VERSION = "2023-10-16"
CURRENCY_MULTIPLIER = 100  # Convert dollars to cents
MAX_RETRIES = 3
RETRY_DELAY_BASE = 0.5
WEBHOOK_TOLERANCE = 300  # Webhook timestamp tolerance in seconds

class StripeService:
    """Service class for handling Stripe payment processing operations with comprehensive error handling and logging."""

    def __init__(self) -> None:
        """Initialize Stripe service with API configuration and logging setup."""
        # Configure Stripe client with API key and version
        stripe.api_key = settings.STRIPE_API_KEY.get_secret_value()
        stripe.api_version = STRIPE_API_VERSION

        # Initialize logging
        self.logger = get_logger(__name__, {"service": "stripe"})
        
        # Store webhook secret
        self._webhook_secret = settings.STRIPE_WEBHOOK_SECRET.get_secret_value()
        
        # Configure Stripe client timeout settings
        self.stripe_client = stripe.http_client.RequestsClient(
            timeout=10,  # seconds
            verify_ssl_certs=True
        )
        stripe.default_http_client = self.stripe_client

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY_BASE),
        reraise=True
    )
    async def create_payment_intent(
        self, 
        payment_data: PaymentBase,
        idempotency_key: Optional[str] = None
    ) -> Dict:
        """
        Creates a Stripe payment intent for GPU rental with idempotency and retry logic.
        
        Args:
            payment_data: Validated payment data
            idempotency_key: Optional idempotency key for request
            
        Returns:
            Dict containing payment intent details
            
        Raises:
            HTTPException: On payment processing errors
        """
        try:
            # Convert amount to cents for Stripe
            amount_cents = int(payment_data.amount * CURRENCY_MULTIPLIER)
            
            # Prepare payment intent data
            intent_data = {
                "amount": amount_cents,
                "currency": payment_data.currency.lower(),
                "metadata": {
                    "user_id": str(payment_data.user_id),
                    "reservation_id": str(payment_data.reservation_id)
                }
            }
            
            # Create payment intent with idempotency
            payment_intent = stripe.PaymentIntent.create(
                **intent_data,
                idempotency_key=idempotency_key
            )
            
            self.logger.info(
                "Payment intent created",
                extra={
                    "payment_intent_id": payment_intent.id,
                    "amount": payment_data.amount,
                    "currency": payment_data.currency,
                    "user_id": str(payment_data.user_id)
                }
            )
            
            return {
                "id": payment_intent.id,
                "client_secret": payment_intent.client_secret,
                "amount": payment_data.amount,
                "currency": payment_data.currency,
                "status": payment_intent.status
            }
            
        except stripe.error.CardError as e:
            self.logger.error(
                "Card error occurred",
                extra={"error": str(e), "code": e.code}
            )
            raise HTTPException(
                status_code=400,
                detail=f"Card error: {e.error.message}"
            )
            
        except stripe.error.StripeError as e:
            self.logger.error(
                "Stripe error occurred",
                extra={"error": str(e), "type": type(e).__name__}
            )
            raise HTTPException(
                status_code=500,
                detail="Payment processing error occurred"
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY_BASE),
        reraise=True
    )
    async def process_payment(self, payment_intent_id: str) -> Dict:
        """
        Processes a completed payment with validation and error handling.
        
        Args:
            payment_intent_id: Stripe payment intent ID
            
        Returns:
            Dict containing payment processing result
            
        Raises:
            HTTPException: On payment processing errors
        """
        try:
            # Retrieve payment intent
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            # Validate payment status
            if payment_intent.status not in ['requires_capture', 'succeeded']:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid payment status: {payment_intent.status}"
                )
            
            # Capture payment if needed
            if payment_intent.status == 'requires_capture':
                payment_intent = stripe.PaymentIntent.capture(payment_intent_id)
            
            self.logger.info(
                "Payment processed successfully",
                extra={
                    "payment_intent_id": payment_intent_id,
                    "amount": payment_intent.amount / CURRENCY_MULTIPLIER,
                    "status": payment_intent.status
                }
            )
            
            return {
                "id": payment_intent.id,
                "amount": payment_intent.amount / CURRENCY_MULTIPLIER,
                "currency": payment_intent.currency,
                "status": payment_intent.status,
                "metadata": payment_intent.metadata
            }
            
        except stripe.error.StripeError as e:
            self.logger.error(
                "Payment processing error",
                extra={"error": str(e), "payment_intent_id": payment_intent_id}
            )
            raise HTTPException(
                status_code=500,
                detail="Payment processing error occurred"
            )

    async def handle_webhook_event(self, payload: str, signature: str) -> Dict:
        """
        Handles incoming Stripe webhook events with signature verification.
        
        Args:
            payload: Raw webhook payload
            signature: Stripe signature header
            
        Returns:
            Dict containing event processing result
            
        Raises:
            HTTPException: On webhook processing errors
        """
        try:
            # Verify webhook signature
            event = stripe.Webhook.construct_event(
                payload=payload,
                sig_header=signature,
                secret=self._webhook_secret,
                tolerance=WEBHOOK_TOLERANCE
            )
            
            # Process different event types
            if event.type == 'payment_intent.succeeded':
                await self._handle_payment_success(event.data.object)
            elif event.type == 'payment_intent.payment_failed':
                await self._handle_payment_failure(event.data.object)
            elif event.type == 'charge.dispute.created':
                await self._handle_dispute(event.data.object)
                
            self.logger.info(
                "Webhook event processed",
                extra={"event_type": event.type, "event_id": event.id}
            )
            
            return {"status": "success", "event_type": event.type}
            
        except stripe.error.SignatureVerificationError:
            self.logger.error("Invalid webhook signature")
            raise HTTPException(
                status_code=400,
                detail="Invalid webhook signature"
            )
            
        except Exception as e:
            self.logger.error(
                "Webhook processing error",
                extra={"error": str(e)}
            )
            raise HTTPException(
                status_code=500,
                detail="Webhook processing error occurred"
            )

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=RETRY_DELAY_BASE),
        reraise=True
    )
    async def refund_payment(
        self,
        payment_intent_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict:
        """
        Processes a refund with amount validation and status tracking.
        
        Args:
            payment_intent_id: Payment intent to refund
            amount: Optional refund amount (full refund if None)
            reason: Optional refund reason
            
        Returns:
            Dict containing refund details
            
        Raises:
            HTTPException: On refund processing errors
        """
        try:
            # Retrieve payment intent
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            # Prepare refund data
            refund_data = {
                "payment_intent": payment_intent_id,
                "reason": reason
            }
            
            # Add amount for partial refunds
            if amount:
                refund_data["amount"] = int(amount * CURRENCY_MULTIPLIER)
            
            # Process refund
            refund = stripe.Refund.create(**refund_data)
            
            self.logger.info(
                "Refund processed",
                extra={
                    "payment_intent_id": payment_intent_id,
                    "refund_id": refund.id,
                    "amount": refund.amount / CURRENCY_MULTIPLIER
                }
            )
            
            return {
                "id": refund.id,
                "amount": refund.amount / CURRENCY_MULTIPLIER,
                "status": refund.status,
                "reason": refund.reason
            }
            
        except stripe.error.StripeError as e:
            self.logger.error(
                "Refund processing error",
                extra={"error": str(e), "payment_intent_id": payment_intent_id}
            )
            raise HTTPException(
                status_code=500,
                detail="Refund processing error occurred"
            )

    async def _handle_payment_success(self, payment_intent: stripe.PaymentIntent) -> None:
        """Handle successful payment webhook event."""
        self.logger.info(
            "Payment succeeded",
            extra={
                "payment_intent_id": payment_intent.id,
                "amount": payment_intent.amount / CURRENCY_MULTIPLIER
            }
        )

    async def _handle_payment_failure(self, payment_intent: stripe.PaymentIntent) -> None:
        """Handle failed payment webhook event."""
        self.logger.error(
            "Payment failed",
            extra={
                "payment_intent_id": payment_intent.id,
                "error": payment_intent.last_payment_error
            }
        )

    async def _handle_dispute(self, dispute: stripe.Dispute) -> None:
        """Handle payment dispute webhook event."""
        self.logger.warning(
            "Payment disputed",
            extra={
                "dispute_id": dispute.id,
                "payment_intent_id": dispute.payment_intent,
                "reason": dispute.reason
            }
        )