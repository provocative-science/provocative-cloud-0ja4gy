"""
Centralized logging configuration and utility for the Provocative Cloud backend API.
Provides structured logging with different log levels, request tracking, and integration
with monitoring systems.
"""

import logging
import json
import threading
import queue
from typing import Dict, Optional
from logging.handlers import RotatingFileHandler
from datetime import datetime

import json_logging  # version: 2.0.7
import structlog    # version: 23.1.0
from elasticsearch_logger import ElasticsearchLogger  # version: 1.2.0
import sentry_sdk  # version: 1.28.1

from api.config import settings
from api.constants import PROJECT_NAME

# Global configuration constants
DEFAULT_LOG_FORMAT = {
    "timestamp": "%(asctime)s",
    "level": "%(levelname)s",
    "request_id": "%(request_id)s",
    "module": "%(name)s",
    "message": "%(message)s",
    "context": "%(context)s",
    "trace_id": "%(trace_id)s"
}

LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL
}

SENSITIVE_PATTERNS = [
    "password", "token", "secret", "key", "credential",
    "auth", "jwt", "session", "cookie"
]

class RequestIdFilter(logging.Filter):
    """Thread-safe logging filter that adds request ID to all log records."""
    
    def __init__(self):
        super().__init__()
        self._lock = threading.Lock()
        self._local = threading.local()
        self._local.request_id = None

    @property
    def request_id(self) -> Optional[str]:
        """Get current request ID."""
        return getattr(self._local, 'request_id', None)

    @request_id.setter
    def request_id(self, value: str):
        """Set request ID for current thread."""
        self._local.request_id = value

    def filter(self, record: logging.LogRecord) -> bool:
        """Add request ID to log record in thread-safe manner."""
        with self._lock:
            if not hasattr(record, 'request_id'):
                record.request_id = self.request_id or 'no_request_id'
            return True

class AsyncLogHandler(logging.Handler):
    """Asynchronous log handler for improved performance."""
    
    def __init__(self, capacity: int = 10000):
        super().__init__()
        self._queue = queue.Queue(maxsize=capacity)
        self._worker = threading.Thread(target=self._process_logs, daemon=True)
        self._batch_size = 100
        self._worker.start()

    def emit(self, record: logging.LogRecord):
        """Queue log record for async processing."""
        try:
            self._queue.put_nowait(record)
        except queue.Full:
            self.handleError(record)

    def _process_logs(self):
        """Process queued log records in batches."""
        batch = []
        while True:
            try:
                record = self._queue.get()
                sanitized_record = sanitize_log_data(record.__dict__)
                batch.append(sanitized_record)
                
                if len(batch) >= self._batch_size:
                    self._flush_batch(batch)
                    batch = []
            except Exception as e:
                self.handleError(e)

    def _flush_batch(self, batch: list):
        """Flush a batch of log records."""
        try:
            # Process batch of logs (e.g., send to ELK)
            pass
        finally:
            batch.clear()

def sanitize_log_data(log_data: Dict) -> Dict:
    """Sanitize sensitive data from log messages."""
    if isinstance(log_data, dict):
        sanitized = {}
        for key, value in log_data.items():
            # Skip sensitive keys
            if any(pattern in key.lower() for pattern in SENSITIVE_PATTERNS):
                sanitized[key] = "[REDACTED]"
            # Recursively sanitize nested structures
            elif isinstance(value, (dict, list)):
                sanitized[key] = sanitize_log_data(value)
            else:
                sanitized[key] = value
        return sanitized
    elif isinstance(log_data, list):
        return [sanitize_log_data(item) for item in log_data]
    return log_data

def setup_logging(
    log_level: str = "INFO",
    elk_host: str = "localhost",
    elk_port: int = 9200,
    sentry_dsn: Optional[str] = None
) -> None:
    """Configure the logging system with JSON formatting and security measures."""
    
    # Configure JSON logging
    json_logging.init_fastapi(enable_json=True)
    json_logging.init_request_instrument()

    # Configure base logger
    logger = logging.getLogger(PROJECT_NAME)
    logger.setLevel(LOG_LEVELS.get(log_level.upper(), logging.INFO))
    
    # Add request ID tracking
    request_filter = RequestIdFilter()
    logger.addFilter(request_filter)

    # Configure rotating file handler with compression
    file_handler = RotatingFileHandler(
        filename=f"logs/{PROJECT_NAME.lower()}.log",
        maxBytes=100_000_000,  # 100MB
        backupCount=30,  # 90 days retention
        encoding='utf-8'
    )
    file_handler.setFormatter(
        logging.Formatter(json.dumps(DEFAULT_LOG_FORMAT))
    )
    logger.addHandler(file_handler)

    # Configure ELK Stack integration
    if settings.ENVIRONMENT == "production":
        elk_handler = ElasticsearchLogger(
            hosts=[f"https://{elk_host}:{elk_port}"],
            auth_type="api_key",
            api_key=settings.ELK_API_KEY.get_secret_value(),
            index_name=f"{PROJECT_NAME.lower()}-logs",
            ssl_verify=True,
            use_ssl=True
        )
        logger.addHandler(elk_handler)

    # Configure Sentry integration
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=0.1
        )

    # Configure structured logging
    structlog.configure(
        processors=[
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.stdlib.add_log_level,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True
    )

def get_logger(module_name: str, context: Dict = None) -> structlog.BoundLogger:
    """Returns a configured logger instance with context support."""
    logger = structlog.get_logger(module_name)
    
    if context:
        sanitized_context = sanitize_log_data(context)
        logger = logger.bind(**sanitized_context)
    
    return logger