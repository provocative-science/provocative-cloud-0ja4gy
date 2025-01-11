# SQLAlchemy v2.0.0+
from sqlalchemy import Column, ForeignKey, String, Boolean, DateTime, Numeric, JSON, UUID, event
from sqlalchemy.orm import relationship, validates
from sqlalchemy.sql import func
from uuid import uuid4
from datetime import datetime, timedelta
from decimal import Decimal
import jsonschema
from typing import Dict, Optional

from db.base import Base
from db.models.user import User
from db.models.gpu import GPU

# Constants for validation and business rules
RESERVATION_STATUSES = ['pending', 'validating', 'active', 'suspended', 'completed', 'cancelled', 'failed']
VALID_STATUS_TRANSITIONS = {
    'pending': ['validating', 'cancelled'],
    'validating': ['active', 'failed'],
    'active': ['suspended', 'completed'],
    'suspended': ['active', 'completed'],
    'completed': [],
    'cancelled': [],
    'failed': []
}
MAX_RENTAL_DURATION = timedelta(hours=720)  # 30 days
MIN_RENTAL_DURATION = timedelta(hours=1)

# Deployment configuration schema
DEPLOYMENT_CONFIG_SCHEMA = {
    "type": "object",
    "properties": {
        "type": {"type": "string", "enum": ["ssh", "docker", "jupyter"]},
        "resources": {
            "type": "object",
            "properties": {
                "memory_limit": {"type": "integer", "minimum": 1024},
                "storage_gb": {"type": "integer", "minimum": 10}
            },
            "required": ["memory_limit", "storage_gb"]
        },
        "security": {
            "type": "object",
            "properties": {
                "ssh_key_name": {"type": "string"},
                "network_access": {"type": "string", "enum": ["public", "private"]}
            }
        }
    },
    "required": ["type", "resources"]
}

class Reservation(Base):
    """
    SQLAlchemy model for GPU rental reservations with enhanced status tracking
    and deployment validation.
    """
    __tablename__ = 'reservations'

    # Primary key and relationships
    id = Column(UUID, primary_key=True, default=uuid4)
    user_id = Column(UUID, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    gpu_id = Column(UUID, ForeignKey('gpus.id', ondelete='CASCADE'), nullable=False)

    # Rental period tracking
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    auto_renew = Column(Boolean, default=False, nullable=False)
    last_renewed_at = Column(DateTime(timezone=True), nullable=True)

    # Status management
    status = Column(String(20), nullable=False, default='pending')
    status_history = Column(JSON, nullable=False, default=list)

    # Cost tracking
    total_cost = Column(Numeric(10, 2), nullable=False)
    hourly_rate = Column(Numeric(10, 2), nullable=False)

    # Configuration storage
    deployment_config = Column(JSON, nullable=False)
    billing_config = Column(JSON, nullable=False, default=dict)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    #user = relationship("User", backref="reservations", lazy="joined")
    #gpu = relationship("GPU", backref="reservations", lazy="joined")
    user = relationship("User", lazy="joined")
    gpu = relationship("GPU", lazy="joined")

    def __init__(self, user_id: UUID, gpu_id: UUID, start_time: datetime,
                 end_time: datetime, auto_renew: bool, deployment_config: Dict,
                 billing_config: Optional[Dict] = None) -> None:
        """Initialize a new reservation with comprehensive validation."""
        super().__init__()

        # Validate rental period
        rental_duration = end_time - start_time
        if rental_duration > MAX_RENTAL_DURATION:
            raise ValueError(f"Rental duration exceeds maximum allowed ({MAX_RENTAL_DURATION})")
        if rental_duration < MIN_RENTAL_DURATION:
            raise ValueError(f"Rental duration below minimum required ({MIN_RENTAL_DURATION})")
        if start_time < datetime.utcnow():
            raise ValueError("Start time cannot be in the past")

        # Validate deployment configuration
        self.validate_deployment_config(deployment_config)

        # Initialize basic attributes
        self.id = uuid4()
        self.user_id = user_id
        self.gpu_id = gpu_id
        self.start_time = start_time
        self.end_time = end_time
        self.auto_renew = auto_renew
        self.deployment_config = deployment_config
        self.billing_config = billing_config or {}

        # Initialize status tracking
        self.status = 'pending'
        self.status_history = [{
            'status': 'pending',
            'timestamp': datetime.utcnow().isoformat(),
            'reason': 'Initial reservation created'
        }]

        # Calculate initial costs
        self.hourly_rate = self.gpu.price_per_hour
        self.total_cost = self.calculate_cost()

    @validates('status')
    def validate_status(self, key: str, status: str) -> str:
        """Validate status transitions."""
        if status not in RESERVATION_STATUSES:
            raise ValueError(f"Invalid status: {status}")

        if self.status and status != self.status:
            if status not in VALID_STATUS_TRANSITIONS[self.status]:
                raise ValueError(f"Invalid status transition: {self.status} -> {status}")

        return status

    def calculate_cost(self) -> Decimal:
        """Calculate total cost with support for partial hours and promotions."""
        duration = (self.end_time - self.start_time).total_seconds() / 3600
        base_cost = Decimal(str(duration)) * self.hourly_rate

        # Apply promotional rates if configured
        if self.billing_config.get('promotion_rate'):
            discount = Decimal(str(self.billing_config['promotion_rate']))
            base_cost = base_cost * (1 - discount)

        # Apply volume discounts
        if duration >= 168:  # 7 days
            base_cost = base_cost * Decimal('0.9')  # 10% discount
        elif duration >= 72:  # 3 days
            base_cost = base_cost * Decimal('0.95')  # 5% discount

        return base_cost.quantize(Decimal('0.01'))

    def extend_rental(self, new_end_time: datetime) -> bool:
        """Extend the rental period with availability check."""
        if new_end_time <= self.end_time:
            raise ValueError("New end time must be after current end time")

        extension_duration = new_end_time - self.end_time
        if extension_duration + (self.end_time - self.start_time) > MAX_RENTAL_DURATION:
            raise ValueError(f"Total rental duration would exceed maximum allowed ({MAX_RENTAL_DURATION})")

        # Update rental period
        self.end_time = new_end_time
        self.total_cost = self.calculate_cost()
        self.updated_at = datetime.utcnow()

        # Update status history
        self.status_history.append({
            'status': self.status,
            'timestamp': datetime.utcnow().isoformat(),
            'reason': f'Rental period extended by {extension_duration}'
        })

        return True

    def update_status(self, new_status: str, reason: str) -> str:
        """Update reservation status with transition validation."""
        self.validate_status(None, new_status)

        old_status = self.status
        self.status = new_status

        # Record status change
        self.status_history.append({
            'status': new_status,
            'timestamp': datetime.utcnow().isoformat(),
            'reason': reason,
            'previous_status': old_status
        })

        self.updated_at = datetime.utcnow()
        return new_status

    @staticmethod
    def validate_deployment_config(config: Dict) -> bool:
        """Validate deployment configuration against schema."""
        try:
            jsonschema.validate(instance=config, schema=DEPLOYMENT_CONFIG_SCHEMA)
            return True
        except jsonschema.exceptions.ValidationError as e:
            raise ValueError(f"Invalid deployment configuration: {str(e)}")

    def __repr__(self) -> str:
        """String representation of the reservation."""
        return f"<Reservation(id={self.id}, status={self.status}, gpu={self.gpu_id})>"
