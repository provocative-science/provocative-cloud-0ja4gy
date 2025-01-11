# SQLAlchemy v2.0.0+
from sqlalchemy import Column, String, JSON, ARRAY, UUID, DateTime, ForeignKey, Boolean, CheckConstraint
from sqlalchemy.orm import relationship, validates
from uuid import uuid4
import re
from ..base import Base

# Constants for validation
ALLOWED_ROLES = ['user', 'admin', 'host']
MAX_SSH_KEY_NAME_LENGTH = 50
MAX_SSH_KEY_LENGTH = 4096
SSH_KEY_PATTERN = r'^(ssh-rsa|ssh-ed25519|ecdsa-sha2-nistp256|ecdsa-sha2-nistp384|ecdsa-sha2-nistp521)\s+[A-Za-z0-9+/]+[=]{0,3}\s+[^@]+(@[^@]+)?$'

class User(Base):
    """
    SQLAlchemy model for user accounts with enhanced security and validation.
    Implements role-based access control, SSH key management, and payment integration.
    """

    __tablename__ = "users"

    # Primary key using UUID for enhanced security
    id = Column(UUID, primary_key=True, default=uuid4, nullable=False)

    # Authentication and identification fields
    email = Column(String(255), unique=True, nullable=False, index=True)
    google_id = Column(String(100), unique=True, nullable=False)
    stripe_customer_id = Column(String(100), unique=True, nullable=True)

    # SSH keys stored as JSON with schema validation
    ssh_keys = Column(JSON, nullable=False, default=dict,
                     server_default='{}')

    # Role-based access control
    roles = Column(ARRAY(String), nullable=False, default=list,
                  server_default='{}')

    # Account status tracking
    is_active = Column(Boolean, nullable=False, default=True)
    last_login = Column(DateTime, nullable=True)

    # Constraints
    __table_args__ = (
        CheckConstraint(
            "array_length(roles, 1) > 0",
            name="user_must_have_role"
        ),
    )

    @validates('email')
    def validate_email(self, key, email):
        """Validate email format and length."""
        if not email or len(email) > 255:
            raise ValueError("Invalid email length")
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise ValueError("Invalid email format")
        return email.lower()

    @validates('roles')
    def validate_roles(self, key, roles):
        """Validate role assignments against allowed roles."""
        if not roles:
            raise ValueError("User must have at least one role")

        invalid_roles = set(roles) - set(ALLOWED_ROLES)
        if invalid_roles:
            raise ValueError(f"Invalid roles: {invalid_roles}")

        # Validate role combinations
        if 'admin' in roles and len(roles) > 1:
            raise ValueError("Admin role cannot be combined with other roles")

        return roles

    def add_ssh_key(self, key_name: str, key_value: str) -> bool:
        """
        Add a new SSH key with comprehensive validation.

        Args:
            key_name: Name identifier for the SSH key
            key_value: The actual SSH public key

        Returns:
            bool: Success status of adding the key

        Raises:
            ValueError: If validation fails
        """
        # Validate key name
        if not key_name or len(key_name) > MAX_SSH_KEY_NAME_LENGTH:
            raise ValueError(f"Key name must be between 1 and {MAX_SSH_KEY_NAME_LENGTH} characters")

        if not re.match(r"^[a-zA-Z0-9_-]+$", key_name):
            raise ValueError("Key name contains invalid characters")

        # Validate key value
        if not key_value or len(key_value) > MAX_SSH_KEY_LENGTH:
            raise ValueError(f"Key value must be between 1 and {MAX_SSH_KEY_LENGTH} characters")

        if not re.match(SSH_KEY_PATTERN, key_value):
            raise ValueError("Invalid SSH key format")

        # Check for duplicate key names
        if self.ssh_keys.get(key_name):
            raise ValueError(f"Key name '{key_name}' already exists")

        # Add the key
        if not isinstance(self.ssh_keys, dict):
            self.ssh_keys = {}

        self.ssh_keys[key_name] = {
            'key': key_value,
            'added_at': datetime.utcnow().isoformat()
        }

        return True

    def remove_ssh_key(self, key_name: str) -> bool:
        """
        Remove an SSH key with validation.

        Args:
            key_name: Name of the SSH key to remove

        Returns:
            bool: Success status of removing the key
        """
        # Validate key name
        if not key_name or len(key_name) > MAX_SSH_KEY_NAME_LENGTH:
            raise ValueError(f"Invalid key name length")

        if not re.match(r"^[a-zA-Z0-9_-]+$", key_name):
            raise ValueError("Key name contains invalid characters")

        # Remove the key if it exists
        if key_name in self.ssh_keys:
            del self.ssh_keys[key_name]
            return True

        return False

    def has_role(self, role: str) -> bool:
        """
        Check if user has a specific role.

        Args:
            role: Role to check

        Returns:
            bool: Whether user has the role
        """
        if role not in ALLOWED_ROLES:
            raise ValueError(f"Invalid role: {role}")

        return role in self.roles

    def __repr__(self):
        """String representation of the user model."""
        return f"<User(id={self.id}, email={self.email}, roles={self.roles})>"
