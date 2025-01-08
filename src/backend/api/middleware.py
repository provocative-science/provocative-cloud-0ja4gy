"""
Middleware components for the Provocative Cloud API handling cross-cutting concerns
including request logging, authentication, rate limiting, CORS, and error handling
with enhanced reliability features.
"""

import uuid
import secrets
from typing import Callable, Dict, Optional

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from redis import Redis
from circuitbreaker import CircuitBreaker  # version: 1.3+

from api.config import settings
from api.utils.logger import StructuredLogger
from api.security.jwt import decode_token

# Global security headers with CSP nonce template
SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'nonce-{nonce}' 'strict-dynamic'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin'
}

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Enhanced middleware for structured logging of HTTP requests and responses with correlation IDs."""
    
    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.logger = StructuredLogger()
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with enhanced logging and correlation tracking."""
        correlation_id = str(uuid.uuid4())
        trace_id = request.headers.get('X-Trace-ID', str(uuid.uuid4()))
        
        # Log request with context
        self.logger.log_request(
            request,
            extra={
                'correlation_id': correlation_id,
                'trace_id': trace_id,
                'source_ip': request.client.host,
                'user_agent': request.headers.get('User-Agent')
            }
        )
        
        try:
            response = await call_next(request)
            
            # Log response with context
            self.logger.log_response(
                response,
                extra={
                    'correlation_id': correlation_id,
                    'trace_id': trace_id,
                    'response_time': response.headers.get('X-Process-Time')
                }
            )
            
            # Add correlation headers
            response.headers['X-Correlation-ID'] = correlation_id
            response.headers['X-Trace-ID'] = trace_id
            return response
            
        except Exception as e:
            self.logger.log_response(
                None,
                extra={
                    'correlation_id': correlation_id,
                    'trace_id': trace_id,
                    'error': str(e)
                }
            )
            raise

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enhanced rate limiting middleware with circuit breaker pattern."""
    
    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.redis_client = Redis.from_url(
            settings.REDIS_URL.get_secret_value(),
            decode_responses=True
        )
        self.logger = StructuredLogger()
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=settings.CIRCUIT_BREAKER_THRESHOLD,
            recovery_timeout=60,
            name="rate_limit_breaker"
        )
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle request rate limiting with circuit breaker protection."""
        try:
            # Extract token from authorization header
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                payload = decode_token(token, request.headers.get('X-Token-Fingerprint'))
                
                # Determine rate limit based on role
                rate_limit = (
                    settings.RATE_LIMIT_HOST if 'host' in payload.roles
                    else settings.RATE_LIMIT_USER
                )
                
                # Check rate limit using circuit breaker
                with self.circuit_breaker:
                    key = f"rate_limit:{payload.sub}:{request.url.path}"
                    current = self.redis_client.incr(key)
                    
                    if current == 1:
                        self.redis_client.expire(key, 3600)  # 1 hour expiry
                        
                    if current > rate_limit:
                        raise HTTPException(
                            status_code=429,
                            detail="Rate limit exceeded"
                        )
                    
                    # Check burst limit
                    burst_key = f"burst:{payload.sub}:{request.url.path}"
                    burst_count = self.redis_client.incr(burst_key)
                    
                    if burst_count == 1:
                        self.redis_client.expire(burst_key, 60)  # 1 minute expiry
                        
                    if burst_count > settings.RATE_LIMIT_BURST:
                        raise HTTPException(
                            status_code=429,
                            detail="Burst rate limit exceeded"
                        )
            
            return await call_next(request)
            
        except CircuitBreaker.CircuitBreakerError:
            raise HTTPException(
                status_code=503,
                detail="Service temporarily unavailable"
            )

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Enhanced security headers middleware with dynamic CSP nonces."""
    
    def __init__(self, app: FastAPI):
        super().__init__(app)
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add comprehensive security headers to responses."""
        response = await call_next(request)
        
        # Generate CSP nonce
        nonce = secrets.token_urlsafe(32)
        
        # Add security headers
        for header, value in SECURITY_HEADERS.items():
            if header == 'Content-Security-Policy':
                response.headers[header] = value.format(nonce=nonce)
            else:
                response.headers[header] = value
                
        # Add nonce to response for client-side use
        response.headers['X-CSP-Nonce'] = nonce
        
        return response

def setup_middleware(app: FastAPI) -> None:
    """Configure all enhanced middleware for the FastAPI application."""
    
    # Add CORS middleware with strict options
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Correlation-ID", "X-Trace-ID", "X-CSP-Nonce"],
        max_age=3600
    )
    
    # Add enhanced request logging
    app.add_middleware(RequestLoggingMiddleware)
    
    # Add rate limiting with circuit breaker
    app.add_middleware(RateLimitMiddleware)
    
    # Add security headers
    app.add_middleware(SecurityHeadersMiddleware)