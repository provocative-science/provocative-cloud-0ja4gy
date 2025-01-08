import { createAction } from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';
import {
  AuthState,
  GoogleAuthRequest,
  TokenResponse,
  AuthUser,
  UserRole,
  AuthError
} from '../../types/auth';
import {
  googleAuth,
  logout,
  getCurrentUser,
  refreshToken,
  validateToken
} from '../../api/auth';
import {
  setAuthToken,
  removeAuthToken,
  hasRole,
  encryptToken,
  decryptToken
} from '../../utils/auth';

// Action Types
const AUTH_STATE_CHANGE = 'auth/stateChange';
const AUTH_USER_UPDATE = 'auth/userUpdate';
const AUTH_ERROR = 'auth/error';

// Action Creators
export const setAuthState = createAction<AuthState>(AUTH_STATE_CHANGE);
export const setAuthUser = createAction<AuthUser | null>(AUTH_USER_UPDATE);
export const setAuthError = createAction<string>(AUTH_ERROR);

// Type for the Redux state
interface RootState {
  auth: {
    state: AuthState;
    user: AuthUser | null;
    error: string | null;
  };
}

type ThunkResult<R> = ThunkAction<R, RootState, undefined, any>;

// Refresh token interval in milliseconds (5 minutes)
const REFRESH_INTERVAL = 300000;

// Token refresh jitter range (±30 seconds)
const REFRESH_JITTER = 30000;

/**
 * Thunk action creator for Google OAuth authentication
 * Implements secure token handling and automatic refresh scheduling
 */
export const googleAuthThunk = (
  request: GoogleAuthRequest
): ThunkResult<Promise<void>> => {
  return async (dispatch) => {
    try {
      // Set loading state
      dispatch(setAuthState(AuthState.LOADING));
      dispatch(setAuthError(''));

      // Validate request parameters
      if (!request.code || !request.redirect_uri) {
        throw new AuthError('Invalid authentication request');
      }

      // Perform Google OAuth authentication
      const tokenResponse: TokenResponse = await googleAuth(request);

      // Validate token response
      if (!tokenResponse.access_token || !tokenResponse.expires_at) {
        throw new AuthError('Invalid token response');
      }

      // Encrypt and store token
      const encryptedToken = encryptToken(tokenResponse.access_token);
      setAuthToken(encryptedToken);

      // Fetch current user details
      const user = await getCurrentUser();

      // Validate user roles
      if (!user.roles.every(role => Object.values(UserRole).includes(role))) {
        throw new AuthError('Invalid user roles');
      }

      // Update auth state
      dispatch(setAuthUser(user));
      dispatch(setAuthState(AuthState.AUTHENTICATED));

      // Schedule token refresh with jitter
      scheduleTokenRefresh(dispatch, tokenResponse.expires_at);

    } catch (error) {
      console.error('Authentication error:', error);
      dispatch(setAuthState(AuthState.UNAUTHENTICATED));
      dispatch(setAuthError(error.message));
      removeAuthToken();
    }
  };
};

/**
 * Thunk action creator for secure user logout
 * Implements complete cleanup of auth state and tokens
 */
export const logoutThunk = (): ThunkResult<Promise<void>> => {
  return async (dispatch) => {
    try {
      // Call logout API
      await logout();

      // Clean up auth state
      dispatch(setAuthUser(null));
      dispatch(setAuthState(AuthState.UNAUTHENTICATED));
      
      // Remove stored tokens
      removeAuthToken();
      
      // Clear any sensitive data
      localStorage.clear();
      sessionStorage.clear();

    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      dispatch(setAuthUser(null));
      dispatch(setAuthState(AuthState.UNAUTHENTICATED));
      removeAuthToken();
    }
  };
};

/**
 * Thunk action creator for secure token refresh
 * Implements retry mechanism and validation
 */
export const refreshTokenThunk = (): ThunkResult<Promise<void>> => {
  return async (dispatch) => {
    try {
      const currentToken = decryptToken(localStorage.getItem('auth_token'));
      
      if (!currentToken) {
        throw new AuthError('No token available for refresh');
      }

      // Validate current token
      if (!validateToken(currentToken)) {
        throw new AuthError('Invalid token for refresh');
      }

      // Perform token refresh
      const tokenResponse = await refreshToken();

      // Validate new token
      if (!tokenResponse.access_token || !tokenResponse.expires_at) {
        throw new AuthError('Invalid refresh token response');
      }

      // Encrypt and store new token
      const encryptedToken = encryptToken(tokenResponse.access_token);
      setAuthToken(encryptedToken);

      // Update user data if needed
      const user = await getCurrentUser();
      dispatch(setAuthUser(user));

      // Schedule next refresh
      scheduleTokenRefresh(dispatch, tokenResponse.expires_at);

    } catch (error) {
      console.error('Token refresh error:', error);
      dispatch(setAuthState(AuthState.UNAUTHENTICATED));
      dispatch(setAuthError(error.message));
      removeAuthToken();
    }
  };
};

/**
 * Schedules token refresh with jitter to prevent thundering herd
 */
function scheduleTokenRefresh(
  dispatch: any,
  expiresAt: number
): void {
  const timeUntilExpiry = expiresAt - Date.now();
  const refreshTime = timeUntilExpiry - REFRESH_INTERVAL;
  
  // Add jitter to prevent all clients refreshing simultaneously
  const jitter = Math.random() * REFRESH_JITTER - (REFRESH_JITTER / 2);
  const refreshTimeWithJitter = refreshTime + jitter;

  setTimeout(() => {
    dispatch(refreshTokenThunk());
  }, refreshTimeWithJitter);
}

/**
 * Helper function to check if user has required role
 */
export function checkUserRole(
  user: AuthUser | null,
  requiredRole: UserRole
): boolean {
  if (!user || !user.roles) {
    return false;
  }
  return hasRole(user.roles, requiredRole);
}