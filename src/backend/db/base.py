# SQLAlchemy v2.0.0+
from sqlalchemy.orm import declarative_base, as_declarative, declared_attr
from sqlalchemy import MetaData, Column, Boolean, DateTime
from datetime import datetime
from typing import Dict, Any, Optional, List

# Define naming convention for database constraints
metadata = MetaData(naming_convention={
    'ix': 'ix_%(column_0_label)s',
    'uq': 'uq_%(table_name)s_%(column_0_name)s',
    'ck': 'ck_%(table_name)s_%(constraint_name)s',
    'fk': 'fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s',
    'pk': 'pk_%(table_name)s'
})

@as_declarative(metadata=metadata)
class Base:
    """
    SQLAlchemy declarative base class providing common model attributes and behaviors.
    All database models should inherit from this base class.
    """
    
    # Common columns for all models
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __init__(self) -> None:
        """Initialize base model with default tracking fields."""
        self.is_active = True
        self.created_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    @declared_attr
    @classmethod
    def __tablename__(cls) -> str:
        """
        Generate standardized table name from class name.
        Converts CamelCase to snake_case.
        
        Returns:
            str: Lowercase table name with underscores
        """
        name = cls.__name__
        # Convert camel case to snake case
        return ''.join(['_' + c.lower() if c.isupper() else c.lower() 
                       for c in name]).lstrip('_')

    def to_dict(self, include_relationships: bool = False, 
                exclude_fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Convert model instance to dictionary representation with proper type handling.
        
        Args:
            include_relationships (bool): Whether to include relationship attributes
            exclude_fields (Optional[List[str]]): List of field names to exclude
            
        Returns:
            Dict[str, Any]: Dictionary containing model attributes with proper type conversion
        """
        result = {}
        exclude_fields = exclude_fields or []
        
        # Get all model attributes
        for key in self.__mapper__.attrs.keys():
            # Skip excluded fields
            if key in exclude_fields:
                continue
                
            value = getattr(self, key)
            
            # Handle None values
            if value is None:
                result[key] = None
                continue
                
            # Convert datetime objects to ISO format
            if isinstance(value, datetime):
                result[key] = value.isoformat()
                continue
                
            # Handle relationship attributes
            if include_relationships and hasattr(value, 'to_dict'):
                if isinstance(value, list):
                    # Handle collections of related objects
                    result[key] = [item.to_dict(include_relationships=False) 
                                 for item in value]
                else:
                    # Handle single related object
                    result[key] = value.to_dict(include_relationships=False)
                continue
                
            # Handle regular attributes
            if not hasattr(value, '__call__'):
                result[key] = value
                
        return result