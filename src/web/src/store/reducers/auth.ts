/**
 * Redux reducer for authentication state management in Provocative Cloud
 * Implements secure state transitions, role validation, and JWT session handling
 * @version 1.0.0
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { AuthState, AuthUser, UserRole } from '../../types/auth';
import { setAuthState, setAuthUser, AuthActionTypes } from '../actions/auth';

// Debug mode for development environment
const DEBUG = process.env.NODE_ENV === 'development';

/**
 * Interface for authentication reducer state
 */
interface AuthReducerState {
  state: AuthState;
  user: AuthUser | null;
  lastUpdated: number;
  error: string | null;
}

/**
 * Initial state for authentication reducer
 */
const initialState: AuthReducerState = {
  state: AuthState.UNAUTHENTICATED,
  user: null,
  lastUpdated: Date.now(),
  error: null
};

/**
 * Validates authentication state transitions to prevent invalid state changes
 * @param currentState Current authentication state
 * @param newState New authentication state to transition to
 * @returns boolean indicating if the transition is valid
 */
const validateStateTransition = (currentState: AuthState, newState: AuthState): boolean => {
  // Valid transitions matrix
  const validTransitions: Record<AuthState, AuthState[]> = {
    [AuthState.UNAUTHENTICATED]: [AuthState.LOADING, AuthState.AUTHENTICATED],
    [AuthState.LOADING]: [AuthState.AUTHENTICATED, AuthState.UNAUTHENTICATED],
    [AuthState.AUTHENTICATED]: [AuthState.UNAUTHENTICATED, AuthState.LOADING]
  };

  const isValid = validTransitions[currentState]?.includes(newState);
  
  if (DEBUG && !isValid) {
    console.warn(
      `Invalid auth state transition: ${currentState} -> ${newState}`
    );
  }

  return !!isValid;
};

/**
 * Validates user role assignments and permissions
 * @param user User object to validate
 * @returns boolean indicating if the user roles are valid
 */
const validateUserRole = (user: AuthUser): boolean => {
  if (!user || !Array.isArray(user.roles) || user.roles.length === 0) {
    return false;
  }

  // Validate each role is a valid UserRole enum value
  const hasValidRoles = user.roles.every(role => 
    Object.values(UserRole).includes(role)
  );

  // Validate role combinations
  const hasAdminRole = user.roles.includes(UserRole.ADMIN);
  const hasHostRole = user.roles.includes(UserRole.HOST);
  const hasUserRole = user.roles.includes(UserRole.USER);

  // Admin can have any combination of roles
  if (hasAdminRole) {
    return hasValidRoles;
  }

  // Host must also have USER role
  if (hasHostRole && !hasUserRole) {
    return false;
  }

  // At least one role must be present
  return hasValidRoles && (hasUserRole || hasHostRole);
};

/**
 * Authentication reducer with comprehensive state management and validation
 */
const authReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setAuthState, (state, action: PayloadAction<AuthState>) => {
      const newState = action.payload;
      
      // Validate state transition
      if (!validateStateTransition(state.state, newState)) {
        if (DEBUG) {
          console.error(`Invalid auth state transition rejected: ${state.state} -> ${newState}`);
        }
        return;
      }

      // Update state with timestamp
      state.state = newState;
      state.lastUpdated = Date.now();
      state.error = null;

      // Clear user data on unauthenticated state
      if (newState === AuthState.UNAUTHENTICATED) {
        state.user = null;
      }

      if (DEBUG) {
        console.log(`Auth state updated: ${newState}`);
      }
    })
    .addCase(setAuthUser, (state, action: PayloadAction<AuthUser | null>) => {
      const user = action.payload;

      // Handle user logout
      if (user === null) {
        state.user = null;
        state.state = AuthState.UNAUTHENTICATED;
        state.lastUpdated = Date.now();
        state.error = null;
        return;
      }

      // Validate user roles
      if (!validateUserRole(user)) {
        state.error = 'Invalid user roles configuration';
        if (DEBUG) {
          console.error('User role validation failed:', user.roles);
        }
        return;
      }

      // Update user state
      state.user = user;
      state.state = AuthState.AUTHENTICATED;
      state.lastUpdated = Date.now();
      state.error = null;

      if (DEBUG) {
        console.log('Auth user updated:', {
          id: user.id,
          roles: user.roles,
          timestamp: state.lastUpdated
        });
      }
    })
    .addCase(AuthActionTypes.AUTH_ERROR, (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.lastUpdated = Date.now();

      if (DEBUG) {
        console.error('Auth error:', action.payload);
      }
    });
});

export default authReducer;