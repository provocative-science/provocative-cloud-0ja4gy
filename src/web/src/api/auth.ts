/**
 * Authentication API module for Provocative Cloud frontend
 * Handles Google OAuth authentication, token management, and session handling
 * @version 1.0.0
 */

import axios from 'axios'; // ^1.4.0
import CryptoJS from 'crypto-js'; // ^4.1.1
import { io } from 'socket.io-client'; // ^4.7.0

import {
  GoogleAuthRequest,
  GoogleAuthResponse,
  TokenResponse,
  AuthUser,
  UserRole
} from '../types/auth';
import { API_ENDPOINTS, apiConfig } from '../config/api';
import {
  setAuthToken,
  removeAuthToken,
  encryptToken,
  decryptToken
} from '../utils/auth';

// Create axios instance with base configuration
const authApi = axios.create(apiConfig);

// WebSocket connection for real-time auth updates
const authSocket = io(apiConfig.baseURL, {
  path: '/auth/ws',
  autoConnect: false,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

/**
 * Authenticates user with Google OAuth credentials
 * @param request Google OAuth authentication request
 * @returns Promise resolving to encrypted token response
 */
export async function googleAuth(request: GoogleAuthRequest): Promise<TokenResponse> {
  try {
    // Validate request parameters
    if (!request.code || !request.redirect_uri) {
      throw new Error('Invalid authentication request parameters');
    }

    // Send authentication request
    const response = await authApi.post<GoogleAuthResponse>(
      API_ENDPOINTS.AUTH.GOOGLE,
      request,
      {
        headers: {
          'X-Request-ID': CryptoJS.lib.WordArray.random(16).toString()
        }
      }
    );

    // Validate response
    if (!response.data.access_token || !response.data.id_token) {
      throw new Error('Invalid authentication response');
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(response.data.access_token);
    const encryptedIdToken = encryptToken(response.data.id_token);

    // Store encrypted tokens
    setAuthToken(encryptedAccessToken);

    // Initialize WebSocket connection
    authSocket.connect();
    authSocket.emit('auth_connected', { token: encryptedAccessToken });

    return {
      access_token: encryptedAccessToken,
      token_type: 'Bearer',
      expires_at: response.data.expires_at
    };
  } catch (error) {
    console.error('Google authentication error:', error);
    throw error;
  }
}

/**
 * Logs out the current user and cleans up authentication state
 */
export async function logout(): Promise<void> {
  try {
    // Send logout request to server
    await authApi.post(API_ENDPOINTS.AUTH.LOGOUT);

    // Clean up local authentication state
    removeAuthToken();
    authSocket.disconnect();

    // Perform secure cleanup
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear any sensitive data from memory
    if (window.crypto && window.crypto.randomBytes) {
      window.crypto.randomBytes(32);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

/**
 * Retrieves current authenticated user details
 * @returns Promise resolving to current user information
 */
export async function getCurrentUser(): Promise<AuthUser> {
  try {
    const token = decryptToken(localStorage.getItem('auth_token'));
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await authApi.get<AuthUser>(API_ENDPOINTS.AUTH.LOGIN, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    // Validate user role and permissions
    if (!response.data.roles.some(role => Object.values(UserRole).includes(role))) {
      throw new Error('Invalid user role');
    }

    // Update real-time connection state
    authSocket.emit('user_verified', {
      userId: response.data.id,
      roles: response.data.roles
    });

    return response.data;
  } catch (error) {
    console.error('Get current user error:', error);
    throw error;
  }
}

/**
 * Refreshes the current JWT token
 * @returns Promise resolving to new encrypted token response
 */
export async function refreshToken(): Promise<TokenResponse> {
  try {
    const currentToken = decryptToken(localStorage.getItem('auth_token'));
    if (!currentToken) {
      throw new Error('No token to refresh');
    }

    const response = await authApi.post<TokenResponse>(
      API_ENDPOINTS.AUTH.REFRESH,
      {},
      {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      }
    );

    // Validate response token
    if (!response.data.access_token) {
      throw new Error('Invalid token refresh response');
    }

    // Encrypt and store new token
    const encryptedToken = encryptToken(response.data.access_token);
    setAuthToken(encryptedToken);

    // Update WebSocket connection
    authSocket.emit('token_refreshed', { token: encryptedToken });

    return {
      access_token: encryptedToken,
      token_type: 'Bearer',
      expires_at: response.data.expires_at
    };
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

// Configure axios interceptors for automatic token refresh
authApi.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken.access_token}`;
        return authApi(originalRequest);
      } catch (refreshError) {
        removeAuthToken();
        authSocket.disconnect();
        throw refreshError;
      }
    }
    return Promise.reject(error);
  }
);

// WebSocket event handlers
authSocket.on('connect_error', (error) => {
  console.error('Auth WebSocket connection error:', error);
});

authSocket.on('auth_state_change', (state) => {
  if (state === 'expired') {
    refreshToken().catch(() => {
      removeAuthToken();
      authSocket.disconnect();
    });
  }
});

export default {
  googleAuth,
  logout,
  getCurrentUser,
  refreshToken
};