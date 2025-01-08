/**
 * Authentication utility functions for Provocative Cloud frontend
 * Manages user authentication state, JWT tokens, and Google OAuth flow
 * @version 1.0.0
 */

import { 
  UserRole, 
  AuthState, 
  TokenResponse, 
  GoogleAuthResponse, 
  JWTPayload, 
  AuthUser, 
  TOKEN_STORAGE_KEY, 
  AUTH_HEADER_PREFIX 
} from '../types/auth';
import jwtDecode from 'jwt-decode'; // v3.1.2
import { io, Socket } from 'socket.io-client'; // v4.7.0
import { AES, enc } from 'crypto-js'; // v4.1.1

// Constants for token management
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes in milliseconds
const ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || 'default-key';

/**
 * Parses and validates a JWT token
 * @param token JWT token string
 * @returns Decoded token payload or null if invalid
 */
export function parseJwt(token: string): JWTPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const decoded = jwtDecode<JWTPayload>(token);
    
    // Validate token expiration
    if (!decoded.exp || Date.now() >= decoded.exp * 1000) {
      return null;
    }

    // Validate required claims
    if (!decoded.sub || !decoded.email || !Array.isArray(decoded.roles)) {
      return null;
    }

    // Validate roles
    if (!decoded.roles.every(role => Object.values(UserRole).includes(role))) {
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('Token parsing error:', error);
    return null;
  }
}

/**
 * Refreshes the authentication token before expiration
 * @param currentToken Current JWT token
 * @returns Promise resolving to new token response
 */
export async function refreshToken(currentToken: string): Promise<TokenResponse> {
  try {
    const decoded = parseJwt(currentToken);
    if (!decoded) {
      throw new Error('Invalid token');
    }

    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `${AUTH_HEADER_PREFIX} ${currentToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const tokenResponse: TokenResponse = await response.json();
    
    // Store encrypted token
    const encryptedToken = AES.encrypt(
      tokenResponse.access_token,
      ENCRYPTION_KEY
    ).toString();
    
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedToken);
    
    return tokenResponse;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}

/**
 * Authentication manager class for handling auth state and WebSocket connections
 */
export class AuthManager {
  private socket: Socket | null = null;
  private currentState: AuthState = AuthState.LOADING;
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeSocket();
    this.setupTokenRefresh();
  }

  /**
   * Initializes WebSocket connection for real-time auth status
   */
  private initializeSocket(): void {
    this.socket = io('/auth', {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Auth WebSocket connected');
    });

    this.socket.on('auth_state_change', (newState: AuthState) => {
      this.handleAuthStateChange(newState);
    });

    this.socket.on('error', (error: Error) => {
      console.error('Auth WebSocket error:', error);
    });
  }

  /**
   * Sets up automatic token refresh interval
   */
  private setupTokenRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(async () => {
      try {
        const encryptedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
        if (!encryptedToken) return;

        const token = AES.decrypt(encryptedToken, ENCRYPTION_KEY).toString(enc.Utf8);
        const decoded = parseJwt(token);

        if (!decoded) {
          this.handleAuthStateChange(AuthState.UNAUTHENTICATED);
          return;
        }

        const timeUntilExpiry = decoded.exp * 1000 - Date.now();
        if (timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD) {
          await refreshToken(token);
        }
      } catch (error) {
        console.error('Token refresh interval error:', error);
        this.handleAuthStateChange(AuthState.UNAUTHENTICATED);
      }
    }, TOKEN_REFRESH_THRESHOLD / 2);
  }

  /**
   * Handles authentication state changes
   * @param newState New authentication state
   */
  public handleAuthStateChange(newState: AuthState): void {
    this.currentState = newState;
    
    // Emit state change event
    const event = new CustomEvent('authStateChange', { 
      detail: { state: newState } 
    });
    window.dispatchEvent(event);

    // Handle state-specific logic
    if (newState === AuthState.UNAUTHENTICATED) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      this.socket?.disconnect();
    } else if (newState === AuthState.AUTHENTICATED) {
      this.socket?.connect();
    }
  }

  /**
   * Gets the current authentication state
   */
  public getCurrentState(): AuthState {
    return this.currentState;
  }

  /**
   * Gets the current authenticated user
   */
  public getCurrentUser(): AuthUser | null {
    try {
      const encryptedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!encryptedToken) return null;

      const token = AES.decrypt(encryptedToken, ENCRYPTION_KEY).toString(enc.Utf8);
      const decoded = parseJwt(token);
      
      if (!decoded) return null;

      return {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles,
        created_at: Date.now()
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  /**
   * Cleans up resources when the manager is destroyed
   */
  public destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.socket?.disconnect();
    this.socket?.removeAllListeners();
  }
}

export default AuthManager;