# SQLAlchemy v2.0+
from sqlalchemy import Column, ForeignKey, Integer, String, Boolean, DateTime, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import uuid
from decimal import Decimal
from typing import Dict, Optional

from db.base import Base

class GPU(Base):
    """
    SQLAlchemy model representing a GPU resource in the system.
    Tracks specifications, health metrics, and rental pricing for GPU inventory management.
    """

    __tablename__ = "gpus"

    # Primary key and relationships
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    server_id = Column(String(36), ForeignKey('server.id', ondelete='CASCADE'), nullable=False)

    # GPU specifications
    model = Column(String(100), nullable=False)
    vram_gb = Column(Integer, nullable=False)
    metrics = Column(JSON, nullable=False, default=dict)
    price_per_hour = Column(Numeric(10, 2), nullable=False)
    is_available = Column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), nullable=False, default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now())

    # Relationships
    server = relationship("Server", back_populates="gpus", foreign_keys=[server_id], lazy="joined")
    reservations = relationship("Reservation", back_populates="gpu", cascade="all, delete-orphan", lazy="select")

    def __init__(self, server_id: str, model: str, vram_gb: int, price_per_hour: Decimal) -> None:
        """
        Initialize a new GPU instance with required specifications.

        Args:
            server_id (str): UUID of the server hosting this GPU
            model (str): GPU model name/identifier
            vram_gb (int): GPU memory capacity in GB
            price_per_hour (Decimal): Initial rental price per hour
        """
        super().__init__()

        if not isinstance(price_per_hour, Decimal):
            price_per_hour = Decimal(str(price_per_hour))

        if price_per_hour <= Decimal('0'):
            raise ValueError("Price per hour must be positive")

        if vram_gb <= 0:
            raise ValueError("VRAM capacity must be positive")

        self.id = str(uuid.uuid4())
        self.server_id = server_id
        self.model = model
        self.vram_gb = vram_gb
        self.price_per_hour = price_per_hour
        self.metrics = {}
        self.is_available = True

    def to_dict(self, include_relationships: bool = True) -> Dict:
        """
        Convert GPU model to dictionary representation including relationships.

        Args:
            include_relationships (bool): Whether to include related objects

        Returns:
            Dict: Dictionary containing all GPU attributes and loaded relationships
        """
        result = {
            'id': self.id,
            'server_id': self.server_id,
            'model': self.model,
            'vram_gb': self.vram_gb,
            'metrics': self.metrics,
            'price_per_hour': str(self.price_per_hour),
            'is_available': self.is_available,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

        if include_relationships:
            if self.server:
                result['server'] = self.server.to_dict(include_relationships=False)
            if self.reservations:
                result['reservations'] = [
                    r.to_dict(include_relationships=False) 
                    for r in self.reservations if r.is_active
                ]

        return result

    def update_metrics(self, metrics_data: Dict) -> None:
        """
        Update GPU metrics with latest monitoring data.

        Args:
            metrics_data (Dict): Dictionary containing GPU metrics
                Required keys: temperature, utilization, memory_used, power_draw

        Raises:
            ValueError: If metrics data is invalid or missing required fields
        """
        required_fields = {'temperature', 'utilization', 'memory_used', 'power_draw'}
        if not all(field in metrics_data for field in required_fields):
            raise ValueError(f"Missing required metrics fields: {required_fields}")

        # Validate metric ranges
        if not (0 <= metrics_data['temperature'] <= 120):
            raise ValueError("Temperature must be between 0-120°C")
        if not (0 <= metrics_data['utilization'] <= 100):
            raise ValueError("Utilization must be between 0-100%")
        if not (0 <= metrics_data['memory_used'] <= self.vram_gb * 1024):  # Convert GB to MB
            raise ValueError(f"Memory usage must be between 0-{self.vram_gb * 1024}MB")
        if not (0 <= metrics_data['power_draw'] <= 500):
            raise ValueError("Power draw must be between 0-500W")

        metrics_data['timestamp'] = datetime.utcnow().isoformat()
        self.metrics = metrics_data
        self.updated_at = datetime.utcnow()

    def update_price(self, new_price: Decimal) -> Decimal:
        """
        Update GPU rental price with validation.

        Args:
            new_price (Decimal): New price per hour

        Returns:
            Decimal: New validated price per hour

        Raises:
            ValueError: If price is invalid or change exceeds allowed range
        """
        if not isinstance(new_price, Decimal):
            new_price = Decimal(str(new_price))

        if new_price <= Decimal('0'):
            raise ValueError("Price must be positive")

        # Limit price changes to maximum 50% increase/decrease
        max_change = self.price_per_hour * Decimal('0.5')
        if abs(new_price - self.price_per_hour) > max_change:
            raise ValueError("Price change exceeds maximum allowed range (±50%)")

        self.price_per_hour = new_price
        self.updated_at = datetime.utcnow()

        return new_price
