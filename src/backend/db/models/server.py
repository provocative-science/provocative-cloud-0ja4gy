# SQLAlchemy v2.0.0+
from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, UUID, Index
# SQLAlchemy ORM v2.0.0+
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
import ipaddress
# jsonschema v4.0.0+
from jsonschema import validate

from db.base import Base

# JSON schema for server specifications validation
SERVER_SPECS_SCHEMA = {
    "type": "object",
    "properties": {
        "cpu": {
            "type": "object",
            "properties": {
                "model": {"type": "string"},
                "cores": {"type": "integer"},
                "threads": {"type": "integer"}
            },
            "required": ["model", "cores", "threads"]
        },
        "memory": {
            "type": "object",
            "properties": {
                "total_gb": {"type": "integer"},
                "type": {"type": "string"}
            },
            "required": ["total_gb", "type"]
        },
        "storage": {
            "type": "object",
            "properties": {
                "type": {"type": "string"},
                "capacity_gb": {"type": "integer"}
            },
            "required": ["type", "capacity_gb"]
        },
        "network": {
            "type": "object",
            "properties": {
                "bandwidth_gbps": {"type": "integer"},
                "interfaces": {"type": "array", "items": {"type": "string"}}
            },
            "required": ["bandwidth_gbps", "interfaces"]
        }
    },
    "required": ["cpu", "memory", "storage", "network"]
}

class Server(Base):
    """
    SQLAlchemy model for GPU server management in the Provocative Cloud platform.
    Handles server infrastructure, GPU assignments, metrics tracking, and maintenance status.
    """
    
    # Primary key
    id = Column(UUID, primary_key=True, default=uuid.uuid4)
    
    # Server identification
    hostname = Column(String(255), unique=True, nullable=False)
    ip_address = Column(String(45), nullable=False)  # Supports both IPv4 and IPv6
    
    # Server specifications stored as JSON
    specs = Column(JSON, nullable=False)
    
    # Maintenance status
    maintenance_mode = Column(Boolean, default=False, nullable=False)
    last_health_check = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    gpus = relationship(
        "GPU",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    metrics = relationship(
        "SystemMetrics",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    maintenance_logs = relationship(
        "MaintenanceLog",
        back_populates="server",
        cascade="all, delete-orphan",
        lazy="select"
    )
    
    # Indexes
    __table_args__ = (
        Index('ix_server_hostname', 'hostname'),
        Index('ix_server_maintenance', 'maintenance_mode'),
        Index('ix_server_health_check', 'last_health_check')
    )
    
    def __init__(self, hostname: str, ip_address: str, specs: dict):
        """
        Initialize a new Server instance with validated parameters.
        
        Args:
            hostname (str): Unique server hostname
            ip_address (str): Server IP address (IPv4 or IPv6)
            specs (dict): Server specifications matching SERVER_SPECS_SCHEMA
            
        Raises:
            ValueError: If validation fails for any parameters
        """
        super().__init__()
        
        # Validate hostname
        if not hostname or len(hostname) > 255:
            raise ValueError("Invalid hostname length")
        
        # Validate IP address
        try:
            ipaddress.ip_address(ip_address)
        except ValueError:
            raise ValueError("Invalid IP address format")
            
        # Validate specifications
        try:
            validate(instance=specs, schema=SERVER_SPECS_SCHEMA)
        except Exception as e:
            raise ValueError(f"Invalid server specifications: {str(e)}")
            
        self.id = uuid.uuid4()
        self.hostname = hostname
        self.ip_address = ip_address
        self.specs = specs
        self.maintenance_mode = False
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        
    def to_dict(self, include_relationships: bool = False) -> dict:
        """
        Convert server model to dictionary representation.
        
        Args:
            include_relationships (bool): Whether to include related entities
            
        Returns:
            dict: Server attributes and optional relationships
        """
        result = {
            'id': str(self.id),
            'hostname': self.hostname,
            'ip_address': self.ip_address,
            'specs': self.specs,
            'maintenance_mode': self.maintenance_mode,
            'last_health_check': self.last_health_check.isoformat() if self.last_health_check else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        
        if include_relationships:
            result.update({
                'gpus': [gpu.to_dict() for gpu in self.gpus],
                'metrics': [metric.to_dict() for metric in self.metrics],
                'maintenance_logs': [log.to_dict() for log in self.maintenance_logs]
            })
            
        return result
        
    def update_specs(self, new_specs: dict) -> dict:
        """
        Update server specifications with validation.
        
        Args:
            new_specs (dict): New specifications matching SERVER_SPECS_SCHEMA
            
        Returns:
            dict: Updated and validated specifications
            
        Raises:
            ValueError: If new specifications are invalid
        """
        try:
            validate(instance=new_specs, schema=SERVER_SPECS_SCHEMA)
        except Exception as e:
            raise ValueError(f"Invalid server specifications: {str(e)}")
            
        self.specs = new_specs
        self.updated_at = datetime.utcnow()
        
        # Create maintenance log entry for specs update
        self.maintenance_logs.append({
            'action': 'specs_update',
            'details': 'Server specifications updated',
            'timestamp': datetime.utcnow()
        })
        
        return self.specs
        
    def toggle_maintenance(self, maintenance_state: bool, reason: str) -> bool:
        """
        Toggle server maintenance mode with audit logging.
        
        Args:
            maintenance_state (bool): New maintenance mode state
            reason (str): Reason for maintenance mode change
            
        Returns:
            bool: New maintenance state
        """
        if not reason:
            raise ValueError("Maintenance reason is required")
            
        self.maintenance_mode = maintenance_state
        self.updated_at = datetime.utcnow()
        
        # Create maintenance log entry
        self.maintenance_logs.append({
            'action': 'maintenance_toggle',
            'details': f"Maintenance mode {'enabled' if maintenance_state else 'disabled'}: {reason}",
            'timestamp': datetime.utcnow()
        })
        
        return self.maintenance_mode
        
    def update_health_check(self, health_metrics: dict) -> datetime:
        """
        Update server health check with metrics.
        
        Args:
            health_metrics (dict): Current health metrics
            
        Returns:
            datetime: New health check timestamp
            
        Raises:
            ValueError: If health metrics are invalid
        """
        required_metrics = {'cpu_usage', 'memory_usage', 'storage_usage', 'network_status'}
        if not all(metric in health_metrics for metric in required_metrics):
            raise ValueError("Missing required health metrics")
            
        # Create new metrics entry
        self.metrics.append({
            'metrics': health_metrics,
            'timestamp': datetime.utcnow()
        })
        
        self.last_health_check = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        
        # Check health thresholds and trigger alerts if needed
        if (health_metrics['cpu_usage'] > 90 or 
            health_metrics['memory_usage'] > 90 or 
            health_metrics['storage_usage'] > 90):
            # Trigger high resource usage alert
            self.maintenance_logs.append({
                'action': 'health_alert',
                'details': 'High resource usage detected',
                'timestamp': datetime.utcnow()
            })
            
        return self.last_health_check