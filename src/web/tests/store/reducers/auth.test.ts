/**
 * Unit tests for authentication reducer
 * Tests state transitions, user data management, and error handling
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach } from '@jest/globals'; // ^29.6.0
import authReducer from '../../../src/store/reducers/auth';
import { setAuthState, setAuthUser, setAuthError } from '../../../src/store/actions/auth';
import { AuthState, AuthUser, UserRole } from '../../../src/types/auth';

describe('authReducer', () => {
  // Mock initial state for each test
  const initialState = {
    state: AuthState.UNAUTHENTICATED,
    user: null,
    lastUpdated: expect.any(Number),
    error: null
  };

  // Mock user data
  const mockUser: AuthUser = {
    id: 'test-uuid',
    email: 'test@example.com',
    roles: [UserRole.USER],
    created_at: '2023-01-01T00:00:00Z'
  };

  // Mock error message
  const mockError = 'Authentication failed';

  beforeEach(() => {
    // Reset any timers or mocks before each test
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should return the initial state', () => {
      const state = authReducer(undefined, { type: '@@INIT' });
      expect(state).toEqual(initialState);
    });

    it('should have correct type safety for initial state', () => {
      const state = authReducer(undefined, { type: '@@INIT' });
      expect(Object.values(AuthState)).toContain(state.state);
      expect(state.user).toBeNull();
      expect(typeof state.lastUpdated).toBe('number');
      expect(state.error).toBeNull();
    });
  });

  describe('State Transitions', () => {
    it('should handle transition to LOADING state', () => {
      const state = authReducer(
        initialState,
        setAuthState(AuthState.LOADING)
      );
      expect(state.state).toBe(AuthState.LOADING);
      expect(state.lastUpdated).toBeGreaterThan(initialState.lastUpdated);
      expect(state.error).toBeNull();
    });

    it('should handle transition to AUTHENTICATED state', () => {
      const state = authReducer(
        { ...initialState, state: AuthState.LOADING },
        setAuthState(AuthState.AUTHENTICATED)
      );
      expect(state.state).toBe(AuthState.AUTHENTICATED);
      expect(state.lastUpdated).toBeGreaterThan(initialState.lastUpdated);
      expect(state.error).toBeNull();
    });

    it('should prevent invalid state transitions', () => {
      const state = authReducer(
        { ...initialState, state: AuthState.AUTHENTICATED },
        setAuthState(AuthState.LOADING)
      );
      expect(state.state).toBe(AuthState.AUTHENTICATED);
    });

    it('should clear user data on transition to UNAUTHENTICATED', () => {
      const state = authReducer(
        { ...initialState, state: AuthState.AUTHENTICATED, user: mockUser },
        setAuthState(AuthState.UNAUTHENTICATED)
      );
      expect(state.state).toBe(AuthState.UNAUTHENTICATED);
      expect(state.user).toBeNull();
    });
  });

  describe('User Management', () => {
    it('should update user data and set AUTHENTICATED state', () => {
      const state = authReducer(
        initialState,
        setAuthUser(mockUser)
      );
      expect(state.user).toEqual(mockUser);
      expect(state.state).toBe(AuthState.AUTHENTICATED);
      expect(state.error).toBeNull();
    });

    it('should handle user logout', () => {
      const state = authReducer(
        { ...initialState, state: AuthState.AUTHENTICATED, user: mockUser },
        setAuthUser(null)
      );
      expect(state.user).toBeNull();
      expect(state.state).toBe(AuthState.UNAUTHENTICATED);
      expect(state.error).toBeNull();
    });

    it('should validate user roles', () => {
      const invalidUser = {
        ...mockUser,
        roles: ['INVALID_ROLE']
      };
      const state = authReducer(
        initialState,
        setAuthUser(invalidUser as AuthUser)
      );
      expect(state.error).toBe('Invalid user roles configuration');
      expect(state.user).toBeNull();
    });

    it('should handle multiple user roles correctly', () => {
      const multiRoleUser = {
        ...mockUser,
        roles: [UserRole.USER, UserRole.HOST]
      };
      const state = authReducer(
        initialState,
        setAuthUser(multiRoleUser)
      );
      expect(state.user).toEqual(multiRoleUser);
      expect(state.state).toBe(AuthState.AUTHENTICATED);
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      const state = authReducer(
        initialState,
        setAuthError(mockError)
      );
      expect(state.error).toBe(mockError);
      expect(state.lastUpdated).toBeGreaterThan(initialState.lastUpdated);
    });

    it('should clear error on successful state transition', () => {
      const state = authReducer(
        { ...initialState, error: mockError },
        setAuthState(AuthState.LOADING)
      );
      expect(state.error).toBeNull();
    });

    it('should clear error on successful user update', () => {
      const state = authReducer(
        { ...initialState, error: mockError },
        setAuthUser(mockUser)
      );
      expect(state.error).toBeNull();
    });

    it('should maintain error state on invalid transitions', () => {
      const initialStateWithError = {
        ...initialState,
        error: mockError
      };
      const state = authReducer(
        initialStateWithError,
        setAuthState(AuthState.AUTHENTICATED)
      );
      expect(state.error).toBe(mockError);
    });
  });

  describe('State Immutability', () => {
    it('should not mutate previous state on updates', () => {
      const previousState = {
        ...initialState,
        user: mockUser
      };
      const previousStateCopy = JSON.parse(JSON.stringify(previousState));
      
      const newState = authReducer(
        previousState,
        setAuthState(AuthState.LOADING)
      );
      
      expect(previousState).toEqual(previousStateCopy);
      expect(newState).not.toBe(previousState);
    });

    it('should create new user object references on update', () => {
      const previousState = {
        ...initialState,
        user: mockUser
      };
      
      const updatedUser = {
        ...mockUser,
        email: 'updated@example.com'
      };
      
      const newState = authReducer(
        previousState,
        setAuthUser(updatedUser)
      );
      
      expect(newState.user).not.toBe(previousState.user);
    });
  });
});