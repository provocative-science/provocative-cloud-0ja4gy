"""
FastAPI router module for billing-related endpoints in the Provocative Cloud platform.
Implements secure payment processing, transaction history, pricing management, and invoice generation
with comprehensive validation, monitoring and audit logging.
Version: 1.0.0
"""

from decimal import Decimal
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks, Response
from fastapi_limiter import RateLimiter
import structlog

from api.schemas.billing import (
    PaymentBase, PaymentCreate, TransactionBase, PricingBase
)
from api.services.billing_service import BillingService
from api.dependencies import get_db_session, get_current_active_user, verify_admin_role
from api.constants import RATE_LIMIT_USER

# Initialize router with prefix and tags
router = APIRouter(prefix="/billing", tags=["billing"])

# Initialize structured logger
logger = structlog.get_logger(__name__)

# Rate limiting configuration
rate_limiter = RateLimiter(RATE_LIMIT_USER)

@router.post("/payments", response_model=Dict)
async def create_payment(
    payment_data: PaymentBase,
    db = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
    idempotency_key: str = Header(..., description="Unique key for preventing duplicate payments")
) -> Dict:
    """
    Creates a new payment for GPU rental with comprehensive validation and security.
    
    Args:
        payment_data: Payment information
        db: Database session
        current_user: Authenticated user
        idempotency_key: Unique request identifier
        
    Returns:
        Dict containing payment details and client secret
        
    Raises:
        HTTPException: If payment creation fails or validation errors occur
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        # Create payment with idempotency
        payment = await billing_service.create_payment(
            payment_data=payment_data,
            idempotency_key=idempotency_key
        )
        
        logger.info(
            "Payment created successfully",
            user_id=str(current_user.id),
            payment_id=payment["payment_id"],
            amount=str(payment_data.amount)
        )
        
        return payment
        
    except Exception as e:
        logger.error(
            "Payment creation failed",
            error=str(e),
            user_id=str(current_user.id)
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to create payment"
        )

@router.post("/webhook", response_model=Dict)
async def process_stripe_webhook(
    request: Request,
    db = Depends(get_db_session),
    stripe_signature: str = Header(..., description="Stripe webhook signature")
) -> Dict:
    """
    Processes Stripe webhook events with signature verification.
    
    Args:
        request: Raw webhook request
        db: Database session
        stripe_signature: Webhook signature for verification
        
    Returns:
        Dict containing processing result
        
    Raises:
        HTTPException: If webhook processing fails
    """
    try:
        # Get raw payload
        payload = await request.body()
        
        billing_service = BillingService(db, rate_limiter)
        
        # Process webhook with signature verification
        result = await billing_service.process_payment_webhook(
            webhook_data=payload,
            signature=stripe_signature
        )
        
        logger.info(
            "Webhook processed successfully",
            event_type=result["status"],
            payment_id=result["payment_id"]
        )
        
        return result
        
    except Exception as e:
        logger.error(
            "Webhook processing failed",
            error=str(e)
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid webhook payload"
        )

@router.get("/payments", response_model=List[Dict])
async def get_user_payments(
    page: int = 1,
    limit: int = 50,
    db = Depends(get_db_session),
    current_user = Depends(get_current_active_user)
) -> List[Dict]:
    """
    Retrieves paginated payment history for authenticated user.
    
    Args:
        page: Page number
        limit: Items per page
        db: Database session
        current_user: Authenticated user
        
    Returns:
        List of payment records
        
    Raises:
        HTTPException: If retrieval fails
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        payments = await billing_service.get_user_payments(
            user_id=current_user.id,
            page=page,
            limit=limit
        )
        
        logger.info(
            "Retrieved payment history",
            user_id=str(current_user.id),
            page=page,
            count=len(payments)
        )
        
        return payments
        
    except Exception as e:
        logger.error(
            "Payment history retrieval failed",
            error=str(e),
            user_id=str(current_user.id)
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve payments"
        )

@router.post("/refund/{payment_id}", response_model=Dict)
async def refund_payment(
    payment_id: UUID,
    amount: Optional[Decimal] = None,
    reason: Optional[str] = None,
    db = Depends(get_db_session),
    current_user = Depends(get_current_active_user)
) -> Dict:
    """
    Processes a payment refund with validation and audit logging.
    
    Args:
        payment_id: Payment to refund
        amount: Optional refund amount
        reason: Optional refund reason
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Dict containing refund details
        
    Raises:
        HTTPException: If refund fails
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        refund = await billing_service.refund_payment(
            payment_id=payment_id,
            amount=amount,
            reason=reason
        )
        
        logger.info(
            "Payment refunded successfully",
            payment_id=str(payment_id),
            user_id=str(current_user.id),
            amount=str(amount) if amount else "full"
        )
        
        return refund
        
    except Exception as e:
        logger.error(
            "Refund processing failed",
            error=str(e),
            payment_id=str(payment_id)
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to process refund"
        )

@router.post("/pricing", response_model=Dict)
async def set_gpu_pricing(
    pricing_data: PricingBase,
    db = Depends(get_db_session),
    current_user = Depends(get_current_active_user),
    admin = Depends(verify_admin_role)
) -> Dict:
    """
    Sets or updates GPU pricing with market rate validation.
    
    Args:
        pricing_data: New pricing information
        db: Database session
        current_user: Authenticated user
        admin: Admin role verification
        
    Returns:
        Dict containing updated pricing
        
    Raises:
        HTTPException: If pricing update fails
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        pricing = await billing_service.set_gpu_pricing(
            pricing_data=pricing_data,
            user_id=current_user.id
        )
        
        logger.info(
            "GPU pricing updated",
            user_id=str(current_user.id),
            gpu_model=pricing_data.gpu_model,
            price=str(pricing_data.price_per_hour)
        )
        
        return pricing
        
    except Exception as e:
        logger.error(
            "Pricing update failed",
            error=str(e),
            gpu_model=pricing_data.gpu_model
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to update pricing"
        )

@router.get("/pricing/{gpu_model}", response_model=Dict)
async def get_active_pricing(
    gpu_model: str,
    db = Depends(get_db_session)
) -> Dict:
    """
    Retrieves current active pricing for a GPU model.
    
    Args:
        gpu_model: GPU model identifier
        db: Database session
        
    Returns:
        Dict containing current pricing details
        
    Raises:
        HTTPException: If pricing retrieval fails
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        pricing = await billing_service.get_active_pricing(gpu_model)
        
        logger.info(
            "Retrieved GPU pricing",
            gpu_model=gpu_model
        )
        
        return pricing
        
    except Exception as e:
        logger.error(
            "Pricing retrieval failed",
            error=str(e),
            gpu_model=gpu_model
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve pricing"
        )

@router.post("/invoices", response_model=Dict)
async def generate_invoice(
    user_id: UUID,
    start_date: datetime,
    end_date: datetime,
    background_tasks: BackgroundTasks,
    db = Depends(get_db_session),
    current_user = Depends(get_current_active_user)
) -> Dict:
    """
    Generates a detailed invoice for a specified period.
    
    Args:
        user_id: User to generate invoice for
        start_date: Invoice period start
        end_date: Invoice period end
        background_tasks: FastAPI background tasks
        db: Database session
        current_user: Authenticated user
        
    Returns:
        Dict containing invoice details
        
    Raises:
        HTTPException: If invoice generation fails
    """
    try:
        billing_service = BillingService(db, rate_limiter)
        
        invoice = await billing_service.generate_invoice(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            background_tasks=background_tasks
        )
        
        logger.info(
            "Invoice generated successfully",
            user_id=str(user_id),
            start_date=start_date.isoformat(),
            end_date=end_date.isoformat()
        )
        
        return invoice
        
    except Exception as e:
        logger.error(
            "Invoice generation failed",
            error=str(e),
            user_id=str(user_id)
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to generate invoice"
        )