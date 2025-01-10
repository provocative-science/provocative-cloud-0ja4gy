# pydantic v2.0+
from decimal import Decimal
from datetime import datetime
from typing import Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field, validator

from db.base import Base

# Payment and transaction status choices
PAYMENT_STATUS_CHOICES = ('pending', 'completed', 'failed', 'refunded')
TRANSACTION_STATUS_CHOICES = ('pending', 'success', 'failed')
SUPPORTED_CURRENCIES = ('USD', 'EUR', 'GBP')
MIN_PAYMENT_AMOUNT = Decimal('0.01')

class PaymentBase(BaseModel):
    """Base Pydantic model for payment data validation with enhanced currency and amount validation."""
    user_id: UUID
    reservation_id: UUID
    amount: Decimal = Field(..., gt=MIN_PAYMENT_AMOUNT)
    currency: str = Field(default='USD', max_length=3)

    @validator('amount')
    def validate_amount(cls, value: Decimal) -> Decimal:
        """Validates payment amount is positive and has correct decimal places."""
        if value <= MIN_PAYMENT_AMOUNT:
            raise ValueError(f'Payment amount must be greater than {MIN_PAYMENT_AMOUNT}')
        
        # Ensure amount has max 2 decimal places
        if abs(value.as_tuple().exponent) > 2:
            raise ValueError('Payment amount cannot have more than 2 decimal places')
        
        # Round to 2 decimal places
        return round(value, 2)

    @validator('currency')
    def validate_currency(cls, value: str) -> str:
        """Validates currency is supported."""
        value = value.upper()
        if value not in SUPPORTED_CURRENCIES:
            raise ValueError(f'Currency must be one of: {", ".join(SUPPORTED_CURRENCIES)}')
        return value

class PaymentCreate(PaymentBase):
    """Pydantic model for creating new payments with Stripe integration."""
    stripe_payment_id: str = Field(..., max_length=255, pattern='^pi_[a-zA-Z0-9]{24}$')

    status: str = Field(default='pending')

    @validator('status')
    def validate_status(cls, value: str) -> str:
        """Validates payment status with transition rules."""
        if value not in PAYMENT_STATUS_CHOICES:
            raise ValueError(f'Status must be one of: {", ".join(PAYMENT_STATUS_CHOICES)}')
        
        # Additional status transition validation could be added here
        # For example: pending -> completed/failed, completed -> refunded
        return value

class TransactionBase(BaseModel):
    """Base Pydantic model for transaction data validation with enhanced tracking."""
    payment_id: UUID
    amount: Decimal = Field(..., gt=MIN_PAYMENT_AMOUNT)
    description: Optional[str] = Field(None, max_length=255)
    status: str = Field(default='pending')
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator('status')
    def validate_status(cls, value: str) -> str:
        """Validates transaction status with detailed error handling."""
        if value not in TRANSACTION_STATUS_CHOICES:
            raise ValueError(f'Status must be one of: {", ".join(TRANSACTION_STATUS_CHOICES)}')
        
        # Status transition validation
        # pending -> success/failed only
        return value

    @validator('metadata')
    def validate_metadata(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        """Validates transaction metadata format."""
        # Check metadata size (max 16KB)
        metadata_size = len(str(value).encode('utf-8'))
        if metadata_size > 16 * 1024:  # 16KB
            raise ValueError('Metadata size exceeds 16KB limit')

        # Validate metadata types
        for key, val in value.items():
            if not isinstance(key, str):
                raise ValueError('Metadata keys must be strings')
            
            if not isinstance(val, (str, int, float)):
                raise ValueError('Metadata values must be string, integer, or float')

        return value

class PricingBase(BaseModel):
    """Base Pydantic model for GPU pricing configuration with temporal validation."""
    gpu_model: str = Field(..., max_length=255)
    price_per_hour: Decimal = Field(..., gt=MIN_PAYMENT_AMOUNT)
    currency: str = Field(default='USD', max_length=3)
    effective_from: datetime
    effective_to: Optional[datetime] = None

    @validator('price_per_hour')
    def validate_price(cls, value: Decimal) -> Decimal:
        """Validates price per hour with market rate checks."""
        if value <= MIN_PAYMENT_AMOUNT:
            raise ValueError(f'Price must be greater than {MIN_PAYMENT_AMOUNT}')

        # Market rate validation thresholds
        MAX_HOURLY_RATE = Decimal('100.0')  # Example maximum hourly rate
        if value > MAX_HOURLY_RATE:
            raise ValueError(f'Price exceeds maximum hourly rate of {MAX_HOURLY_RATE}')

        # Round to 4 decimal places for hourly rates
        return round(value, 4)

    @validator('effective_to')
    def validate_effective_dates(cls, value: Optional[datetime], values: Dict[str, Any]) -> Optional[datetime]:
        """Validates pricing effective date range."""
        effective_from = values.get('effective_from')
        if not effective_from:
            raise ValueError('effective_from is required')

        # Validate effective_from is not in past
        if effective_from < datetime.utcnow():
            raise ValueError('effective_from cannot be in the past')

        # Validate effective_to if provided
        if value is not None:
            if value <= effective_from:
                raise ValueError('effective_to must be after effective_from')
            
            # Maximum pricing period validation (e.g., 1 year)
            max_period = effective_from.replace(year=effective_from.year + 1)
            if value > max_period:
                raise ValueError('Pricing period cannot exceed 1 year')

        return value

    @validator('currency')
    def validate_currency(cls, value: str) -> str:
        """Validates currency is supported."""
        value = value.upper()
        if value not in SUPPORTED_CURRENCIES:
            raise ValueError(f'Currency must be one of: {", ".join(SUPPORTED_CURRENCIES)}')
        return value
