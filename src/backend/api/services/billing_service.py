"""
Enhanced billing service for managing payment operations, transactions, and pricing
in the Provocative Cloud platform with comprehensive security and audit features.
Version: 1.0.0
"""

from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID, uuid4
import logging

from sqlalchemy.orm import Session
from fastapi import HTTPException, BackgroundTasks
from fastapi_limiter.depends import RateLimiter

from db.models.billing import Payment, Transaction, GPUPricing, Invoice, AuditLog
from api.schemas.billing import (
    PaymentBase, PaymentCreate, TransactionBase, PricingBase, PaymentValidation
)
from api.services.stripe_service import StripeService
from api.utils.logger import get_logger

# Constants
DEFAULT_CURRENCY = "USD"
PAYMENT_PAGINATION_LIMIT = 50
MAX_RETRIES = 3
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_PERIOD = 60
IDEMPOTENCY_KEY_EXPIRY = 86400  # 24 hours

class BillingService:
    """
    Enhanced service class for managing billing operations with comprehensive
    security, validation, and audit capabilities.
    """

    def __init__(self, db: Session, rate_limiter: RateLimiter) -> None:
        """Initialize billing service with enhanced security features."""
        self.db = db
        self.stripe_service = StripeService()
        self.rate_limiter = rate_limiter
        self.logger = get_logger(__name__, {"service": "billing"})
        self._idempotency_store = {}

    async def create_payment(
        self,
        payment_data: PaymentBase,
        idempotency_key: str
    ) -> Dict:
        """
        Creates a new payment with enhanced validation and security measures.
        
        Args:
            payment_data: Validated payment information
            idempotency_key: Unique key for preventing duplicate payments
            
        Returns:
            Dict containing payment details and security token
            
        Raises:
            HTTPException: For validation or processing errors
        """
        # Check rate limits
        await self.rate_limiter.check(f"payment:{payment_data.user_id}")

        # Validate idempotency
        if idempotency_key in self._idempotency_store:
            return self._idempotency_store[idempotency_key]

        try:
            # Validate payment data
            PaymentValidation.validate_amount(payment_data.amount)
            PaymentValidation.validate_currency(payment_data.currency)

            # Create Stripe payment intent
            stripe_payment = await self.stripe_service.create_payment_intent(
                payment_data=payment_data,
                idempotency_key=idempotency_key
            )

            # Create payment record
            payment = Payment(
                id=uuid4(),
                user_id=payment_data.user_id,
                reservation_id=payment_data.reservation_id,
                amount=payment_data.amount,
                currency=payment_data.currency,
                stripe_payment_id=stripe_payment["id"],
                stripe_idempotency_key=idempotency_key,
                status="pending"
            )

            # Create audit trail
            AuditLog.create_audit_entry(
                self.db,
                "payment_created",
                payment.id,
                payment_data.user_id,
                {"amount": str(payment_data.amount), "currency": payment_data.currency}
            )

            self.db.add(payment)
            self.db.commit()

            # Cache response for idempotency
            response = {
                "payment_id": str(payment.id),
                "stripe_payment_id": payment.stripe_payment_id,
                "client_secret": stripe_payment["client_secret"],
                "amount": str(payment.amount),
                "currency": payment.currency,
                "status": payment.status
            }
            self._idempotency_store[idempotency_key] = response

            self.logger.info(
                "Payment created successfully",
                extra={
                    "payment_id": str(payment.id),
                    "user_id": str(payment_data.user_id),
                    "amount": str(payment.amount)
                }
            )

            return response

        except Exception as e:
            self.logger.error(
                "Payment creation failed",
                extra={
                    "error": str(e),
                    "user_id": str(payment_data.user_id)
                }
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Payment processing failed"
            )

    async def process_payment_webhook(
        self,
        webhook_data: Dict,
        signature: str
    ) -> Dict:
        """
        Process Stripe webhook events with signature verification.
        
        Args:
            webhook_data: Raw webhook payload
            signature: Stripe signature header
            
        Returns:
            Dict containing processing result
        """
        try:
            event = await self.stripe_service.handle_webhook_event(
                webhook_data,
                signature
            )

            payment = self.db.query(Payment).filter(
                Payment.stripe_payment_id == event["id"]
            ).first()

            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")

            # Update payment status
            payment.status = event["status"]
            payment.updated_at = datetime.utcnow()

            # Create transaction record
            transaction = Transaction(
                payment_id=payment.id,
                amount=payment.amount,
                status=event["status"],
                metadata=event
            )

            self.db.add(transaction)
            
            # Create audit trail
            AuditLog.create_audit_entry(
                self.db,
                "payment_processed",
                payment.id,
                payment.user_id,
                {"status": event["status"]}
            )

            self.db.commit()

            return {"status": "success", "payment_id": str(payment.id)}

        except Exception as e:
            self.logger.error(
                "Webhook processing failed",
                extra={"error": str(e)}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Webhook processing failed"
            )

    async def get_user_payments(
        self,
        user_id: UUID,
        page: int = 1,
        limit: int = PAYMENT_PAGINATION_LIMIT
    ) -> List[Dict]:
        """
        Retrieve paginated payment history for a user.
        
        Args:
            user_id: User ID to fetch payments for
            page: Page number for pagination
            limit: Number of items per page
            
        Returns:
            List of payment records
        """
        try:
            offset = (page - 1) * limit
            payments = self.db.query(Payment).filter(
                Payment.user_id == user_id
            ).offset(offset).limit(limit).all()

            return [payment.to_dict() for payment in payments]

        except Exception as e:
            self.logger.error(
                "Failed to retrieve payments",
                extra={"error": str(e), "user_id": str(user_id)}
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve payments"
            )

    async def refund_payment(
        self,
        payment_id: UUID,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict:
        """
        Process a refund with validation and audit trail.
        
        Args:
            payment_id: Payment to refund
            amount: Optional refund amount
            reason: Optional refund reason
            
        Returns:
            Dict containing refund details
        """
        try:
            payment = self.db.query(Payment).get(payment_id)
            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")

            refund = await self.stripe_service.refund_payment(
                payment.stripe_payment_id,
                amount,
                reason
            )

            # Update payment status
            payment.status = "refunded"
            payment.updated_at = datetime.utcnow()

            # Create audit trail
            AuditLog.create_audit_entry(
                self.db,
                "payment_refunded",
                payment.id,
                payment.user_id,
                {"amount": str(amount) if amount else "full", "reason": reason}
            )

            self.db.commit()

            return {
                "refund_id": refund["id"],
                "payment_id": str(payment_id),
                "amount": str(refund["amount"]),
                "status": refund["status"]
            }

        except Exception as e:
            self.logger.error(
                "Refund processing failed",
                extra={"error": str(e), "payment_id": str(payment_id)}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Refund processing failed"
            )

    async def set_gpu_pricing(
        self,
        pricing_data: PricingBase,
        user_id: UUID
    ) -> Dict:
        """
        Set or update GPU pricing with market rate validation.
        
        Args:
            pricing_data: New pricing information
            user_id: User setting the price
            
        Returns:
            Dict containing updated pricing details
        """
        try:
            # Validate pricing
            PaymentValidation.validate_price(pricing_data.price_per_hour)
            PaymentValidation.validate_market_rate(
                pricing_data.gpu_model,
                pricing_data.price_per_hour
            )

            pricing = GPUPricing(
                gpu_model=pricing_data.gpu_model,
                price_per_hour=pricing_data.price_per_hour,
                currency=pricing_data.currency,
                effective_from=pricing_data.effective_from,
                effective_to=pricing_data.effective_to
            )

            self.db.add(pricing)

            # Create audit trail
            AuditLog.create_audit_entry(
                self.db,
                "pricing_updated",
                pricing.id,
                user_id,
                {"model": pricing.gpu_model, "price": str(pricing.price_per_hour)}
            )

            self.db.commit()

            return pricing.to_dict()

        except Exception as e:
            self.logger.error(
                "Pricing update failed",
                extra={"error": str(e), "gpu_model": pricing_data.gpu_model}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to update pricing"
            )

    async def get_active_pricing(self, gpu_model: str) -> Dict:
        """
        Retrieve active pricing for a GPU model.
        
        Args:
            gpu_model: GPU model to get pricing for
            
        Returns:
            Dict containing current pricing details
        """
        try:
            pricing = self.db.query(GPUPricing).filter(
                GPUPricing.gpu_model == gpu_model,
                GPUPricing.effective_from <= datetime.utcnow(),
                (
                    GPUPricing.effective_to.is_(None) |
                    (GPUPricing.effective_to > datetime.utcnow())
                )
            ).first()

            if not pricing:
                raise HTTPException(
                    status_code=404,
                    detail=f"No active pricing found for {gpu_model}"
                )

            return pricing.to_dict()

        except Exception as e:
            self.logger.error(
                "Failed to retrieve pricing",
                extra={"error": str(e), "gpu_model": gpu_model}
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to retrieve pricing"
            )

    async def generate_invoice(
        self,
        user_id: UUID,
        start_date: datetime,
        end_date: datetime,
        background_tasks: BackgroundTasks
    ) -> Dict:
        """
        Generate a detailed invoice for a specified period.
        
        Args:
            user_id: User to generate invoice for
            start_date: Invoice period start
            end_date: Invoice period end
            background_tasks: FastAPI background tasks
            
        Returns:
            Dict containing invoice details
        """
        try:
            # Get all payments for the period
            payments = self.db.query(Payment).filter(
                Payment.user_id == user_id,
                Payment.created_at.between(start_date, end_date),
                Payment.status == "completed"
            ).all()

            if not payments:
                raise HTTPException(
                    status_code=404,
                    detail="No completed payments found for period"
                )

            # Calculate totals
            total_amount = sum(payment.amount for payment in payments)

            # Create invoice
            invoice = Invoice(
                user_id=user_id,
                total_amount=total_amount,
                currency=DEFAULT_CURRENCY,
                status="pending",
                due_date=datetime.utcnow() + timedelta(days=30),
                line_items=[payment.to_dict() for payment in payments]
            )

            self.db.add(invoice)

            # Create audit trail
            AuditLog.create_audit_entry(
                self.db,
                "invoice_generated",
                invoice.id,
                user_id,
                {
                    "period_start": start_date.isoformat(),
                    "period_end": end_date.isoformat(),
                    "total_amount": str(total_amount)
                }
            )

            self.db.commit()

            # Schedule PDF generation in background
            background_tasks.add_task(
                self._generate_invoice_pdf,
                invoice.id,
                user_id
            )

            return invoice.to_dict()

        except Exception as e:
            self.logger.error(
                "Invoice generation failed",
                extra={"error": str(e), "user_id": str(user_id)}
            )
            self.db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to generate invoice"
            )

    async def _generate_invoice_pdf(self, invoice_id: UUID, user_id: UUID) -> None:
        """Background task to generate PDF invoice."""
        try:
            invoice = self.db.query(Invoice).get(invoice_id)
            if not invoice:
                raise ValueError("Invoice not found")

            # Generate PDF content
            pdf_content = invoice.generate_pdf(
                template_name="invoice_template",
                custom_fields={
                    "company_name": "Provocative Cloud",
                    "tax_id": "XX-XXXXXXX",
                    "billing_address": "123 Cloud Street, Server City, DC 10101"
                }
            )

            # Store PDF in secure location
            # Implementation details handled by storage service

            self.logger.info(
                "Invoice PDF generated",
                extra={
                    "invoice_id": str(invoice_id),
                    "user_id": str(user_id)
                }
            )

        except Exception as e:
            self.logger.error(
                "Invoice PDF generation failed",
                extra={
                    "error": str(e),
                    "invoice_id": str(invoice_id),
                    "user_id": str(user_id)
                }
            )
