from db.base import Base
from sqlalchemy import Column, ForeignKey, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime

class MaintenanceLog(Base):
    __tablename__ = 'maintenance_log'
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    details = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Relationship back to Server
    server_id = Column(UUID(as_uuid=True), ForeignKey('server.id'))
    server = relationship("Server", back_populates="maintenance_logs")

