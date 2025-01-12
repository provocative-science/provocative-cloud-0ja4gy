"""
Core constants and configuration values for the Provocative Cloud backend API.
This module serves as the central source of truth for configuration values
used throughout the backend services.
"""

# API Configuration
API_VERSION = "v1"
API_PREFIX = "/api/v1"
PROJECT_NAME = "Provocative Cloud"

# Authentication Settings
JWT_ALGORITHM = "HS256"
JWT_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
OAUTH_SCOPES = ["openid", "email", "profile"]

# Rate Limiting Configuration
RATE_LIMIT_USER = 1000  # requests per hour for regular users
RATE_LIMIT_HOST = 5000  # requests per hour for host users
RATE_LIMIT_BURST = 100  # maximum requests per minute

# Paths Excluded from Authentication/Rate Limiting
EXCLUDED_PATHS = [
    "/api/v1/health",
    "/docs",
    "/redoc"
]

# Role Constants
ROLE_USER = "user"
ROLE_HOST = "host"
ROLE_ADMIN = "admin"

# Role-Based Access Control
USER_ROLES = [
    "user",    # Regular platform user
    "host",    # GPU resource provider
    "admin"    # System administrator
]

# Resource Status Definitions
GPU_STATUSES = [
    "available",    # GPU ready for rental
    "reserved",     # GPU currently in use
    "maintenance"   # GPU undergoing maintenance
]

RESERVATION_STATUSES = [
    "pending",      # Reservation created but not active
    "active",       # Currently active reservation
    "completed",    # Successfully completed reservation
    "cancelled"     # Cancelled reservation
]

PAYMENT_STATUSES = [
    "pending",      # Payment initiated
    "completed",    # Payment successfully processed
    "failed",       # Payment processing failed
    "refunded"      # Payment refunded to user
]

# System Configuration
METRICS_COLLECTION_INTERVAL = 60  # Seconds between metrics collection

# Reservation Constraints
MAX_GPU_RESERVATION_HOURS = 168  # Maximum rental duration (1 week)
MIN_GPU_RESERVATION_HOURS = 1    # Minimum rental duration
