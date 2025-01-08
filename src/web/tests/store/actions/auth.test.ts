import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import configureMockStore from '@jedmao/redux-mock-store';
import thunk from 'redux-thunk';
import {
  setAuthState,
  setAuthUser,
  googleAuthThunk,
  logoutThunk,
  refreshTokenThunk
} from '../../../src/store/actions/auth';
import {
  AuthState,
  GoogleAuthRequest,
  TokenResponse,
  AuthUser,
  UserRole
} from '../../../src/types/auth';
import {
  googleAuth,
  logout,
  getCurrentUser,
  refreshToken
} from '../../../src/api/auth';

// Mock API functions
jest.mock('../../../src/api/auth');
const mockGoogleAuth = googleAuth as jest.MockedFunction<typeof googleAuth>;
const mockLogout = logout as jest.MockedFunction<typeof logout>;
const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockRefreshToken = refreshToken as jest.MockedFunction<typeof refreshToken>;

// Configure mock store with thunk middleware
const mockStore = configureMockStore([thunk]);

// Test data
const mockGoogleAuthRequest: GoogleAuthRequest = {
  code: 'test_auth_code',
  redirect_uri: 'http://localhost:3000/auth/callback',
  code_verifier: 'test_code_verifier'
};

const mockTokenResponse: TokenResponse = {
  access_token: 'test_jwt_token',
  token_type: 'Bearer',
  expires_at: Date.now() + 3600000 // 1 hour from now
};

const mockAuthUser: AuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  roles: [UserRole.USER],
  created_at: Date.now()
};

describe('Authentication Actions', () => {
  let store: ReturnType<typeof mockStore>;

  beforeEach(() => {
    store = mockStore({
      auth: {
        state: AuthState.UNAUTHENTICATED,
        user: null,
        error: null
      }
    });
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('setAuthState', () => {
    test('should create action with correct type and payload', () => {
      const expectedAction = {
        type: 'auth/stateChange',
        payload: AuthState.AUTHENTICATED
      };
      expect(setAuthState(AuthState.AUTHENTICATED)).toEqual(expectedAction);
    });

    test('should validate state transitions', () => {
      const invalidState = 'INVALID_STATE' as AuthState;
      expect(() => setAuthState(invalidState)).toThrow();
    });
  });

  describe('setAuthUser', () => {
    test('should create action with correct type and user payload', () => {
      const expectedAction = {
        type: 'auth/userUpdate',
        payload: mockAuthUser
      };
      expect(setAuthUser(mockAuthUser)).toEqual(expectedAction);
    });

    test('should handle null user for logout', () => {
      const expectedAction = {
        type: 'auth/userUpdate',
        payload: null
      };
      expect(setAuthUser(null)).toEqual(expectedAction);
    });

    test('should validate user roles', () => {
      const invalidUser = {
        ...mockAuthUser,
        roles: ['INVALID_ROLE' as UserRole]
      };
      expect(() => setAuthUser(invalidUser)).toThrow();
    });
  });

  describe('googleAuthThunk', () => {
    beforeEach(() => {
      mockGoogleAuth.mockResolvedValue(mockTokenResponse);
      mockGetCurrentUser.mockResolvedValue(mockAuthUser);
    });

    test('should handle successful authentication flow', async () => {
      await store.dispatch(googleAuthThunk(mockGoogleAuthRequest) as any);
      const actions = store.getActions();

      expect(actions).toEqual([
        setAuthState(AuthState.LOADING),
        setAuthUser(mockAuthUser),
        setAuthState(AuthState.AUTHENTICATED)
      ]);
      expect(mockGoogleAuth).toHaveBeenCalledWith(mockGoogleAuthRequest);
      expect(localStorage.getItem('auth_token')).toBeTruthy();
    });

    test('should validate token encryption', async () => {
      await store.dispatch(googleAuthThunk(mockGoogleAuthRequest) as any);
      const storedToken = localStorage.getItem('auth_token');
      expect(storedToken).not.toBe(mockTokenResponse.access_token);
      expect(storedToken?.length).toBeGreaterThan(0);
    });

    test('should handle authentication failure', async () => {
      mockGoogleAuth.mockRejectedValue(new Error('Auth failed'));
      await store.dispatch(googleAuthThunk(mockGoogleAuthRequest) as any);
      const actions = store.getActions();

      expect(actions).toContainEqual(setAuthState(AuthState.UNAUTHENTICATED));
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    test('should prevent concurrent authentication attempts', async () => {
      const promise1 = store.dispatch(googleAuthThunk(mockGoogleAuthRequest) as any);
      const promise2 = store.dispatch(googleAuthThunk(mockGoogleAuthRequest) as any);
      await Promise.all([promise1, promise2]);

      expect(mockGoogleAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe('logoutThunk', () => {
    beforeEach(() => {
      mockLogout.mockResolvedValue();
      localStorage.setItem('auth_token', 'test_token');
    });

    test('should handle successful logout', async () => {
      await store.dispatch(logoutThunk() as any);
      const actions = store.getActions();

      expect(actions).toEqual([
        setAuthUser(null),
        setAuthState(AuthState.UNAUTHENTICATED)
      ]);
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(mockLogout).toHaveBeenCalled();
    });

    test('should clean up sensitive data', async () => {
      sessionStorage.setItem('sensitive_data', 'test');
      await store.dispatch(logoutThunk() as any);

      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    test('should force logout on API failure', async () => {
      mockLogout.mockRejectedValue(new Error('Logout failed'));
      await store.dispatch(logoutThunk() as any);

      expect(store.getActions()).toContainEqual(setAuthState(AuthState.UNAUTHENTICATED));
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('refreshTokenThunk', () => {
    beforeEach(() => {
      mockRefreshToken.mockResolvedValue(mockTokenResponse);
      mockGetCurrentUser.mockResolvedValue(mockAuthUser);
      localStorage.setItem('auth_token', 'encrypted_test_token');
    });

    test('should handle successful token refresh', async () => {
      await store.dispatch(refreshTokenThunk() as any);
      const actions = store.getActions();

      expect(actions).toContainEqual(setAuthUser(mockAuthUser));
      expect(localStorage.getItem('auth_token')).toBeTruthy();
      expect(mockRefreshToken).toHaveBeenCalled();
    });

    test('should validate new token encryption', async () => {
      await store.dispatch(refreshTokenThunk() as any);
      const newToken = localStorage.getItem('auth_token');
      expect(newToken).not.toBe(mockTokenResponse.access_token);
      expect(newToken?.length).toBeGreaterThan(0);
    });

    test('should handle refresh failure', async () => {
      mockRefreshToken.mockRejectedValue(new Error('Refresh failed'));
      await store.dispatch(refreshTokenThunk() as any);

      expect(store.getActions()).toContainEqual(setAuthState(AuthState.UNAUTHENTICATED));
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    test('should prevent concurrent refresh attempts', async () => {
      const promise1 = store.dispatch(refreshTokenThunk() as any);
      const promise2 = store.dispatch(refreshTokenThunk() as any);
      await Promise.all([promise1, promise2]);

      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });

    test('should handle missing token', async () => {
      localStorage.removeItem('auth_token');
      await store.dispatch(refreshTokenThunk() as any);

      expect(store.getActions()).toContainEqual(setAuthState(AuthState.UNAUTHENTICATED));
      expect(mockRefreshToken).not.toHaveBeenCalled();
    });
  });
});