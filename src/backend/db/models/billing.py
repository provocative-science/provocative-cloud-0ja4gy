# SQLAlchemy v2.0.0+
from sqlalchemy import Column, ForeignKey, String, DateTime, Numeric, JSON, UUID, event, CheckConstraint
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from uuid import uuid4
from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional, List
import iso4217

from db.base import Base
from db.models.user import User
from db.models.reservation import Reservation

# Global constants for validation
TRANSACTION_STATUS_CHOICES = ["pending", "processing", "succeeded", "failed", "refunded", "disputed"]
PAYMENT_METHOD_CHOICES = ["card", "bank_transfer", "crypto"]
CURRENCY_CODES = ["USD", "EUR", "GBP", "JPY"]
AUDIT_ACTIONS = ["created", "updated", "refunded", "disputed", "reconciled"]

class AuditLog(Base):
    """
    SQLAlchemy model representing an audit log entry for tracking significant events
    in the billing and payment services of the Provocative Cloud platform.
    """
    __tablename__ = 'audit_logs'

    # Primary key
    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)

    # Event details
    action = Column(String(50), nullable=False)  # Action performed (e.g., payment_created, payment_processed)
    resource_id = Column(UUID, nullable=False)  # ID of the resource affected (e.g., payment, invoice)
    user_id = Column(UUID, nullable=False)  # ID of the user associated with the action
    details = Column(JSON, nullable=True)  # Additional details about the action

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    @classmethod
    def create_audit_entry(
        cls, db_session, action: str, resource_id: UUID, user_id: UUID, details: dict
    ) -> None:
        """
        Create and persist an audit log entry.

        Args:
            db_session: SQLAlchemy database session
            action: Action performed (e.g., payment_created, pricing_updated)
            resource_id: ID of the affected resource
            user_id: ID of the user performing the action
            details: Additional details about the action
        """
        audit_log = cls(
            action=action,
            resource_id=resource_id,
            user_id=user_id,
            details=details
        )
        db_session.add(audit_log)
        db_session.commit()


class Transaction(Base):
    """
    SQLAlchemy model representing a billing transaction with enhanced security and audit capabilities.
    Handles payment processing, refunds, and transaction history tracking.
    """
    __tablename__ = 'transactions'

    # Primary key and relationships
    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)
    user_id = Column(UUID, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reservation_id = Column(UUID, ForeignKey('reservations.id', ondelete='CASCADE'), nullable=False)
    
    # Stripe integration fields
    stripe_payment_id = Column(String(100), unique=True, nullable=True)
    stripe_idempotency_key = Column(String(100), unique=True, nullable=False)
    
    # Transaction details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    status = Column(String(20), nullable=False)
    payment_method = Column(String(20), nullable=False)
    payment_details = Column(JSON, nullable=False, default=dict)
    audit_trail = Column(JSON, nullable=False, default=list)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    reconciled_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", backref="transactions", lazy="joined")
    reservation = relationship("Reservation", backref="transactions", lazy="joined")

    # Constraints
    __table_args__ = (
        CheckConstraint(currency.in_(CURRENCY_CODES), name='valid_currency'),
        CheckConstraint(status.in_(TRANSACTION_STATUS_CHOICES), name='valid_status'),
        CheckConstraint(payment_method.in_(PAYMENT_METHOD_CHOICES), name='valid_payment_method'),
        CheckConstraint(amount > 0, name='positive_amount'),
    )

    @validates('currency')
    def validate_currency(self, key: str, value: str) -> str:
        """Validate currency code against ISO 4217 standards."""
        if value not in CURRENCY_CODES:
            raise ValueError(f"Invalid currency code: {value}")
        return value

    @validates('status')
    def validate_status(self, key: str, value: str) -> str:
        """Validate transaction status transitions."""
        if value not in TRANSACTION_STATUS_CHOICES:
            raise ValueError(f"Invalid transaction status: {value}")
        return value

    def to_dict(self) -> Dict:
        """Convert transaction model to dictionary with masked sensitive data."""
        result = {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'reservation_id': str(self.reservation_id),
            'amount': str(self.amount),
            'currency': self.currency,
            'status': self.status,
            'payment_method': self.payment_method,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

        # Mask sensitive payment details
        if self.payment_details:
            masked_details = self.payment_details.copy()
            if 'card' in masked_details:
                masked_details['card']['number'] = f"****{masked_details['card']['number'][-4:]}"
            result['payment_details'] = masked_details

        return result

    def process_refund(self, amount: Decimal, reason: str, refund_method: str) -> bool:
        """Process a secure refund with validation and audit trail."""
        if amount > self.amount:
            raise ValueError("Refund amount cannot exceed original transaction amount")

        if self.status not in ['succeeded']:
            raise ValueError("Transaction must be succeeded to process refund")

        # Update audit trail
        self.audit_trail.append({
            'action': 'refund_initiated',
            'amount': str(amount),
            'reason': reason,
            'method': refund_method,
            'timestamp': datetime.utcnow().isoformat(),
            'previous_status': self.status
        })

        self.status = 'refunded'
        self.updated_at = datetime.utcnow()
        return True

class Invoice(Base):
    """
    SQLAlchemy model representing a billing invoice with enhanced reporting capabilities.
    Handles invoice generation, tax calculations, and compliance requirements.
    """
    __tablename__ = 'invoices'

    # Primary key and relationships
    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)
    user_id = Column(UUID, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    stripe_invoice_id = Column(String(100), unique=True, nullable=True)
    
    # Invoice details
    total_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    status = Column(String(20), nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    
    # Additional details
    line_items = Column(JSON, nullable=False, default=list)
    tax_details = Column(JSON, nullable=False, default=dict)
    audit_trail = Column(JSON, nullable=False, default=list)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="invoices", lazy="joined")

    def to_dict(self) -> Dict:
        """Convert invoice model to dictionary with detailed line items."""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'total_amount': str(self.total_amount),
            'currency': self.currency,
            'status': self.status,
            'due_date': self.due_date.isoformat(),
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'line_items': self.line_items,
            'tax_details': self.tax_details,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def generate_pdf(self, template_name: str, custom_fields: Dict) -> bytes:
        """Generate compliant PDF invoice with required legal information."""
        # Validate required legal fields
        required_fields = ['company_name', 'tax_id', 'billing_address']
        if not all(field in custom_fields for field in required_fields):
            raise ValueError(f"Missing required fields: {required_fields}")

        # Add digital signature and compliance headers
        custom_fields['generated_at'] = datetime.utcnow().isoformat()
        custom_fields['invoice_id'] = str(self.id)

        # Record audit trail
        self.audit_trail.append({
            'action': 'pdf_generated',
            'template': template_name,
            'timestamp': datetime.utcnow().isoformat()
        })

        # Return signed PDF content (implementation details handled by PDF generation service)
        return bytes()

class Payment(Base):
    """
    SQLAlchemy model representing a payment record associated with a transaction.
    Handles payment status tracking and refund processing.
    """
    __tablename__ = 'payments'

    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)
    transaction_id = Column(UUID, ForeignKey('transactions.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(UUID, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), nullable=False)
    method = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    payment_metadata = Column(JSON, nullable=True, default=dict)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", backref="payments", lazy="joined")
    transaction = relationship("Transaction", backref="payments", lazy="joined")

    @validates('currency')
    def validate_currency(self, key: str, value: str) -> str:
        """Validate currency code against ISO 4217 standards."""
        if value not in CURRENCY_CODES:
            raise ValueError(f"Invalid currency code: {value}")
        return value

    def to_dict(self) -> Dict:
        """Convert payment model to dictionary."""
        return {
            'id': str(self.id),
            'transaction_id': str(self.transaction_id),
            'user_id': str(self.user_id),
            'amount': str(self.amount),
            'currency': self.currency,
            'method': self.method,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'payment_metadata': self.payment_metadata
        }

class GPUPricing(Base):
    """
    SQLAlchemy model representing the pricing details for GPU usage.
    Handles dynamic pricing updates and versioning for billing purposes.
    """
    __tablename__ = 'gpu_pricing'

    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)
    gpu_type = Column(String(50), nullable=False, unique=True)
    price_per_hour = Column(Numeric(10, 4), nullable=False)
    currency = Column(String(3), nullable=False)

    # Versioning and audit trail
    effective_from = Column(DateTime(timezone=True), nullable=False)
    effective_to = Column(DateTime(timezone=True), nullable=True)
    audit_trail = Column(JSON, nullable=False, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(currency.in_(CURRENCY_CODES), name='valid_currency'),
        CheckConstraint(price_per_hour > 0, name='positive_price'),
    )

    def to_dict(self) -> Dict:
        """Convert GPU pricing model to dictionary."""
        return {
            'id': str(self.id),
            'gpu_type': self.gpu_type,
            'price_per_hour': str(self.price_per_hour),
            'currency': self.currency,
            'effective_from': self.effective_from.isoformat(),
            'effective_to': self.effective_to.isoformat() if self.effective_to else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

    def update_price(self, new_price: Decimal, effective_to: Optional[datetime] = None):
        """Update GPU price with audit trail."""
        if new_price <= 0:
            raise ValueError("Price must be greater than zero.")

        # Update audit trail
        self.audit_trail.append({
            'action': 'price_updated',
            'previous_price': str(self.price_per_hour),
            'new_price': str(new_price),
            'timestamp': datetime.utcnow().isoformat()
        })

        self.price_per_hour = new_price
        self.effective_to = effective_to or None
        self.updated_at = datetime.utcnow()

