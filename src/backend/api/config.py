"""
Configuration settings and environment variables management for the Provocative Cloud backend API.
Handles database connections, authentication settings, API configurations, and infrastructure settings
with enhanced security and validation.
"""

from typing import Dict, List, Optional
import ssl
import logging
from urllib.parse import urlparse

from pydantic import BaseSettings, Field, SecretStr, validator
from api.constants import (
    API_VERSION, API_PREFIX, PROJECT_NAME, JWT_ALGORITHM,
    JWT_TOKEN_EXPIRE_MINUTES, OAUTH_SCOPES, RATE_LIMIT_USER,
    RATE_LIMIT_HOST, RATE_LIMIT_BURST
)

class Settings(BaseSettings):
    """
    Application settings using Pydantic BaseSettings for environment variable management
    with enhanced security and validation.
    """
    # Core API Settings
    PROJECT_NAME: str = PROJECT_NAME
    API_VERSION: str = API_VERSION
    API_PREFIX: str = API_PREFIX
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    DEBUG_MODE: bool = Field(default=False, env="DEBUG_MODE")
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")

    # Database Settings
    DATABASE_URL: SecretStr = Field(..., env="DATABASE_URL")
    DATABASE_REPLICA_URL: SecretStr = Field(default=None, env="DATABASE_REPLICA_URL")
    DATABASE_POOL_SIZE: int = Field(default=20, env="DATABASE_POOL_SIZE")
    DATABASE_MAX_OVERFLOW: int = Field(default=10, env="DATABASE_MAX_OVERFLOW")

    # Redis Settings
    REDIS_URL: SecretStr = Field(..., env="REDIS_URL")
    REDIS_POOL_SIZE: int = Field(default=20, env="REDIS_POOL_SIZE")

    # Authentication Settings
    JWT_SECRET_KEY: SecretStr = Field(..., env="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = JWT_ALGORITHM
    JWT_TOKEN_EXPIRE_MINUTES: int = JWT_TOKEN_EXPIRE_MINUTES

    # OAuth Settings
    GOOGLE_CLIENT_ID: SecretStr = Field(..., env="GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: SecretStr = Field(..., env="GOOGLE_CLIENT_SECRET")
    OAUTH_SCOPES: List[str] = OAUTH_SCOPES

    # Payment Settings
    STRIPE_API_KEY: SecretStr = Field(..., env="STRIPE_API_KEY")
    STRIPE_WEBHOOK_SECRET: SecretStr = Field(..., env="STRIPE_WEBHOOK_SECRET")

    # Security Settings
    CORS_ORIGINS: List[str] = Field(default=["https://provocative.cloud"], env="CORS_ORIGINS")
    RATE_LIMIT_USER: int = RATE_LIMIT_USER
    RATE_LIMIT_HOST: int = RATE_LIMIT_HOST
    RATE_LIMIT_BURST: int = RATE_LIMIT_BURST

    # AWS Settings
    AWS_ACCESS_KEY_ID: SecretStr = Field(..., env="AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: SecretStr = Field(..., env="AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = Field(default="us-east-1", env="AWS_REGION")
    S3_BUCKET_NAME: str = Field(..., env="S3_BUCKET_NAME")

    # Monitoring Settings
    METRICS_COLLECTION_INTERVAL: int = Field(default=60, env="METRICS_COLLECTION_INTERVAL")

    class Config:
        case_sensitive = True
        env_file = ".env"
        env_file_encoding = "utf-8"

    def __init__(self, **kwargs):
        """Initialize settings with environment variables and default values with enhanced validation."""
        super().__init__(**kwargs)
        self._configure_logging()
        self.validate_security_settings()

    def _configure_logging(self) -> None:
        """Configure logging based on environment settings."""
        logging.basicConfig(
            level=getattr(logging, self.LOG_LEVEL),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    def get_database_settings(self) -> Dict:
        """
        Returns database connection settings with connection pooling and replication configuration.
        """
        db_url = urlparse(self.DATABASE_URL.get_secret_value())
        
        settings = {
            "pool_size": self.DATABASE_POOL_SIZE,
            "max_overflow": self.DATABASE_MAX_OVERFLOW,
            "pool_timeout": 30,
            "pool_recycle": 1800,
            "pool_pre_ping": True,
            "ssl": {
                "ssl_mode": "verify-full",
                "sslcert": "/etc/ssl/certs/postgresql.crt",
                "sslkey": "/etc/ssl/private/postgresql.key",
                "sslrootcert": "/etc/ssl/certs/ca.crt"
            } if self.ENVIRONMENT == "production" else None
        }

        if self.DATABASE_REPLICA_URL:
            replica_url = urlparse(self.DATABASE_REPLICA_URL.get_secret_value())
            settings["read_replica"] = {
                "url": str(replica_url),
                "pool_size": self.DATABASE_POOL_SIZE // 2
            }

        return settings

    def get_redis_settings(self) -> Dict:
        """
        Returns Redis connection settings with connection pooling and SSL configuration.
        """
        redis_url = urlparse(self.REDIS_URL.get_secret_value())
        
        return {
            "url": str(redis_url),
            "pool_size": self.REDIS_POOL_SIZE,
            "socket_timeout": 5,
            "socket_connect_timeout": 5,
            "retry_on_timeout": True,
            "ssl": True if self.ENVIRONMENT == "production" else False,
            "ssl_cert_reqs": ssl.CERT_REQUIRED if self.ENVIRONMENT == "production" else None,
            "health_check_interval": 30
        }

    def validate_security_settings(self) -> bool:
        """
        Validates security-critical settings and their compliance.
        """
        # Validate JWT secret length
        if len(self.JWT_SECRET_KEY.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters long")

        # Validate CORS origins
        if self.ENVIRONMENT == "production":
            if "*" in self.CORS_ORIGINS:
                raise ValueError("Wildcard CORS origin not allowed in production")
            if any(not origin.startswith("https://") for origin in self.CORS_ORIGINS):
                raise ValueError("Only HTTPS origins allowed in production")

        # Validate rate limiting parameters
        if self.RATE_LIMIT_BURST > self.RATE_LIMIT_USER:
            raise ValueError("Burst rate limit cannot exceed hourly user rate limit")

        return True

    @validator("DATABASE_URL", "REDIS_URL", pre=True)
    def validate_urls(cls, v):
        """Validate database and Redis URLs."""
        try:
            result = urlparse(v)
            assert all([result.scheme, result.netloc])
            return v
        except Exception:
            raise ValueError("Invalid URL format")

# Global settings instance
settings = Settings()