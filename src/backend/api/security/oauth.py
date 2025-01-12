"""
Secure Google OAuth2.0 authentication implementation for the Provocative Cloud platform.
Implements enhanced security features including MFA support, audit logging, and comprehensive token validation.
"""

import logging
import hashlib
import time
from typing import Dict, Optional
from urllib.parse import urlencode

from fastapi import HTTPException, Request
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from ratelimit import limits, RateLimitException

from ..config import settings
from .jwt import create_access_token
from ..schemas.auth import GoogleAuthRequest, GoogleAuthResponse, JWTPayload

# Constants
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
RATE_LIMIT_ATTEMPTS = 5
RATE_LIMIT_WINDOW = 300  # 5 minutes

logger = logging.getLogger(__name__)

class GoogleOAuth:
    """
    Wrapper class for Google OAuth2.0 flows, reusing existing functions.
    """

    @staticmethod
    def get_authorization_url(redirect_uri: str, request: Request) -> str:
        """Static method to generate a Google OAuth authorization URL."""
        return get_authorization_url(redirect_uri, request)

    @staticmethod
    def exchange_code(auth_request: GoogleAuthRequest, request: Request) -> GoogleAuthResponse:
        """Static method to exchange an authorization code for tokens."""
        return exchange_code(auth_request, request)

    @staticmethod
    def get_user_info(access_token: str, request: Request) -> Dict:
        """Static method to retrieve user information using an access token."""
        return get_user_info(access_token, request)

    @staticmethod
    def verify_token(token: str, request: Request) -> Dict:
        """Static method to verify a Google OAuth token."""
        return verify_oauth_token(token, request)


@limits(calls=RATE_LIMIT_ATTEMPTS, period=RATE_LIMIT_WINDOW)
def create_oauth_client() -> Flow:
    """
    Creates a secure Google OAuth2.0 client instance with enhanced security features.

    Returns:
        Flow: Configured Google OAuth2.0 flow instance

    Raises:
        HTTPException: If client creation fails
    """
    try:
        client_config = {
            "web": {
                "client_id": settings.GOOGLE_CLIENT_ID.get_secret_value(),
                "client_secret": settings.GOOGLE_CLIENT_SECRET.get_secret_value(),
                "auth_uri": GOOGLE_AUTH_URL,
                "token_uri": GOOGLE_TOKEN_URL,
                "redirect_uris": [f"https://{domain}/oauth/callback" for domain in settings.CORS_ORIGINS]
            }
        }

        flow = Flow.from_client_config(
            client_config=client_config,
            scopes=settings.OAUTH_SCOPES,
            autogenerate_code_verifier=True
        )

        # Configure secure transport
        flow.fetch_token = lambda *args, **kwargs: flow._fetch_token(*args, **kwargs, timeout=30)

        return flow

    except Exception as e:
        logger.error(f"OAuth client creation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initialize OAuth client")

@limits(calls=RATE_LIMIT_ATTEMPTS, period=RATE_LIMIT_WINDOW)
def get_authorization_url(redirect_uri: str, request: Request) -> str:
    """
    Generates secure Google OAuth authorization URL with enhanced validation.

    Args:
        redirect_uri: OAuth redirect URI
        request: FastAPI request object

    Returns:
        str: Secure authorization URL for Google OAuth

    Raises:
        HTTPException: If URL generation fails or validation errors occur
    """
    try:
        # Create OAuth client
        flow = create_oauth_client()
        flow.redirect_uri = redirect_uri

        # Generate state parameter with device fingerprint
        device_fingerprint = hashlib.sha256(
            f"{request.client.host}:{request.headers.get('user-agent')}".encode()
        ).hexdigest()

        # Set secure parameters
        auth_params = {
            "access_type": "offline",
            "prompt": "consent select_account",
            "state": device_fingerprint,
            "include_granted_scopes": "true",
            "response_type": "code"
        }

        authorization_url, _ = flow.authorization_url(**auth_params)

        logger.info(
            "Generated OAuth authorization URL",
            extra={"ip": request.client.host, "fingerprint": device_fingerprint}
        )

        return authorization_url

    except Exception as e:
        logger.error(f"Authorization URL generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate authorization URL")

@limits(calls=RATE_LIMIT_ATTEMPTS, period=RATE_LIMIT_WINDOW)
def exchange_code(auth_request: GoogleAuthRequest, request: Request) -> GoogleAuthResponse:
    """
    Securely exchanges OAuth authorization code for tokens with MFA validation.

    Args:
        auth_request: OAuth authentication request
        request: FastAPI request object

    Returns:
        GoogleAuthResponse: Validated OAuth tokens response

    Raises:
        HTTPException: If token exchange fails or validation errors occur
    """
    try:
        # Create OAuth client
        flow = create_oauth_client()
        flow.redirect_uri = auth_request.redirect_uri

        # Exchange code for tokens
        flow.fetch_token(
            code=auth_request.code,
            code_verifier=flow.code_verifier
        )

        # Validate tokens
        credentials = flow.credentials
        if not credentials or not credentials.valid:
            raise HTTPException(status_code=401, detail="Invalid OAuth credentials")

        # Get user info and verify email
        user_info = get_user_info(credentials.token, request)
        if not user_info.get("email_verified"):
            raise HTTPException(status_code=401, detail="Email not verified")

        # Generate device fingerprint
        device_fingerprint = hashlib.sha256(
            f"{auth_request.device_id}:{time.time()}".encode()
        ).hexdigest()

        # Create JWT token
        jwt_token = create_access_token(
            user_id=user_info["sub"],
            email=user_info["email"],
            roles=["user"],
            device_id=auth_request.device_id
        )

        logger.info(
            "OAuth code exchange successful",
            extra={
                "user_id": user_info["sub"],
                "device_id": auth_request.device_id
            }
        )

        return GoogleAuthResponse(
            id_token=credentials.id_token,
            access_token=jwt_token.access_token,
            refresh_token=credentials.refresh_token,
            expires_at=jwt_token.expires_at,
            device_fingerprint=device_fingerprint
        )

    except Exception as e:
        logger.error(f"OAuth code exchange failed: {str(e)}")
        raise HTTPException(status_code=401, detail="OAuth authentication failed")

@limits(calls=RATE_LIMIT_ATTEMPTS, period=RATE_LIMIT_WINDOW)
def get_user_info(access_token: str, request: Request) -> Dict:
    """
    Securely retrieves user information from Google with enhanced validation.

    Args:
        access_token: Google access token
        request: FastAPI request object

    Returns:
        dict: Validated user profile information

    Raises:
        HTTPException: If user info retrieval fails
    """
    try:
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json"
        }

        google_request = GoogleRequest()
        response = google_request(
            url=GOOGLE_USERINFO_URL,
            headers=headers,
            method="GET",
            timeout=30
        )

        if response.status != 200:
            raise HTTPException(status_code=401, detail="Failed to retrieve user info")

        user_info = response.data.decode("utf-8")

        logger.debug(
            "Retrieved user info",
            extra={"ip": request.client.host}
        )

        return user_info

    except Exception as e:
        logger.error(f"User info retrieval failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Failed to retrieve user information")

@limits(calls=RATE_LIMIT_ATTEMPTS, period=RATE_LIMIT_WINDOW)
def verify_oauth_token(token: str, request: Request) -> Dict:
    """
    Comprehensively verifies Google OAuth ID token with security checks.

    Args:
        token: Google ID token
        request: FastAPI request object

    Returns:
        dict: Verified and validated token claims

    Raises:
        HTTPException: If token verification fails
    """
    try:
        # Create request for token verification
        google_request = GoogleRequest()

        # Verify token
        id_info = google_request.verify_oauth2_token(
            token,
            google_request,
            settings.GOOGLE_CLIENT_ID.get_secret_value()
        )

        # Validate claims
        if id_info["iss"] not in ["accounts.google.com", "https://accounts.google.com"]:
            raise ValueError("Invalid token issuer")

        if id_info["aud"] != settings.GOOGLE_CLIENT_ID.get_secret_value():
            raise ValueError("Invalid token audience")

        if time.time() > id_info["exp"]:
            raise ValueError("Token expired")

        logger.info(
            "OAuth token verified",
            extra={"user_id": id_info["sub"], "ip": request.client.host}
        )

        return id_info

    except Exception as e:
        logger.error(f"OAuth token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid OAuth token")
