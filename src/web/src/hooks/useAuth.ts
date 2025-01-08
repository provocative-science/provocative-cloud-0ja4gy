import { useDispatch, useSelector } from 'react-redux'; // ^8.1.0
import { useCallback, useEffect, useRef } from 'react'; // ^18.0.0
import { io } from 'socket.io-client'; // ^4.7.0
import jwtDecode from 'jwt-decode'; // ^3.1.2
import CryptoJS from 'crypto-js'; // ^4.1.1

import {
  AuthState,
  AuthUser,
  UserRole,
  TokenResponse,
  GoogleAuthRequest
} from '../types/auth';
import {
  loginWithGoogle,
  getCurrentUserAction,
  logoutAction
} from '../store/actions/auth';

// Constants
const AUTH_STATE_SELECTOR = (state: any) => state.auth;
const TOKEN_REFRESH_THRESHOLD = 300000; // 5 minutes
const ROLE_CACHE_DURATION = 60000; // 1 minute
const MAX_AUTH_RETRIES = 3;
const ENCRYPTION_KEY = process.env.REACT_APP_TOKEN_ENCRYPTION_KEY || 'default-key';

/**
 * Custom hook for managing authentication state and operations
 * Provides secure authentication utilities and real-time session management
 */
export function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector(AUTH_STATE_SELECTOR);
  
  // WebSocket reference for real-time auth updates
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  
  // Role check cache
  const roleCache = useRef<Map<string, { result: boolean; timestamp: number }>>(
    new Map()
  );

  // Token refresh timer reference
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Initializes WebSocket connection for real-time auth updates
   */
  const initializeSocket = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io('/auth', {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current.on('auth_state_change', (newState: AuthState) => {
      if (newState === AuthState.UNAUTHENTICATED) {
        handleLogout();
      }
    });

    socketRef.current.on('token_refresh_required', async () => {
      try {
        await refreshToken();
      } catch (error) {
        handleLogout();
      }
    });

    socketRef.current.connect();
  }, []);

  /**
   * Encrypts sensitive token data
   */
  const encryptToken = useCallback((token: string): string => {
    return CryptoJS.AES.encrypt(token, ENCRYPTION_KEY).toString();
  }, []);

  /**
   * Decrypts token data
   */
  const decryptToken = useCallback((encryptedToken: string): string => {
    return CryptoJS.AES.decrypt(encryptedToken, ENCRYPTION_KEY).toString(CryptoJS.enc.Utf8);
  }, []);

  /**
   * Validates and refreshes authentication token
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    const encryptedToken = localStorage.getItem('auth_token');
    if (!encryptedToken) return;

    try {
      const token = decryptToken(encryptedToken);
      const decoded = jwtDecode<{ exp: number }>(token);
      
      if (Date.now() >= (decoded.exp * 1000) - TOKEN_REFRESH_THRESHOLD) {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Token refresh failed');

        const tokenResponse: TokenResponse = await response.json();
        const newEncryptedToken = encryptToken(tokenResponse.access_token);
        localStorage.setItem('auth_token', newEncryptedToken);
        
        // Update user data
        dispatch(getCurrentUserAction());
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      handleLogout();
    }
  }, [dispatch, encryptToken, decryptToken]);

  /**
   * Handles Google OAuth authentication flow
   */
  const handleGoogleAuth = useCallback(async (
    request: GoogleAuthRequest,
    retryCount = 0
  ): Promise<void> => {
    try {
      if (!request.code || !request.redirect_uri) {
        throw new Error('Invalid authentication request');
      }

      // Add CSRF token
      const csrfToken = CryptoJS.lib.WordArray.random(16).toString();
      sessionStorage.setItem('csrf_token', csrfToken);

      const response = await dispatch(loginWithGoogle(request));
      
      if (response.error) throw new Error(response.error);

      const { access_token, expires_at } = response.payload as TokenResponse;
      
      // Encrypt and store token
      const encryptedToken = encryptToken(access_token);
      localStorage.setItem('auth_token', encryptedToken);

      // Initialize WebSocket connection
      initializeSocket();

      // Schedule token refresh
      const refreshTime = expires_at - Date.now() - TOKEN_REFRESH_THRESHOLD;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(refreshToken, refreshTime);

    } catch (error) {
      console.error('Google auth error:', error);
      
      // Implement retry mechanism
      if (retryCount < MAX_AUTH_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        return handleGoogleAuth(request, retryCount + 1);
      }
      
      throw error;
    }
  }, [dispatch, encryptToken, initializeSocket, refreshToken]);

  /**
   * Handles user logout across all tabs
   */
  const handleLogout = useCallback(async (): Promise<void> => {
    try {
      // Clean up auth state
      dispatch(logoutAction());
      localStorage.removeItem('auth_token');
      sessionStorage.clear();
      
      // Clear refresh timer
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      // Close WebSocket connection
      socketRef.current?.disconnect();
      
      // Broadcast logout to other tabs
      localStorage.setItem('logout_broadcast', Date.now().toString());
      
      // Clear role cache
      roleCache.current.clear();

    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      dispatch(logoutAction());
      localStorage.removeItem('auth_token');
    }
  }, [dispatch]);

  /**
   * Checks if user has specified role with caching
   */
  const checkUserRole = useCallback((role: UserRole): boolean => {
    const cacheKey = `role_${role}`;
    const cached = roleCache.current.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < ROLE_CACHE_DURATION) {
      return cached.result;
    }

    const hasRole = auth.user?.roles.includes(role) ?? false;
    
    roleCache.current.set(cacheKey, {
      result: hasRole,
      timestamp: Date.now()
    });

    return hasRole;
  }, [auth.user]);

  // Set up auth state synchronization across tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'logout_broadcast') {
        handleLogout();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [handleLogout]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      socketRef.current?.disconnect();
      roleCache.current.clear();
    };
  }, []);

  return {
    isAuthenticated: auth.state === AuthState.AUTHENTICATED,
    isLoading: auth.state === AuthState.LOADING,
    user: auth.user,
    error: auth.error,
    handleGoogleAuth,
    handleLogout,
    checkUserRole,
    tokenExpiresIn: auth.tokenExpiresAt ? auth.tokenExpiresAt - Date.now() : 0
  };
}

export default useAuth;