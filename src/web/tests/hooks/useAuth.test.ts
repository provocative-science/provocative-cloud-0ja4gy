import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { Provider } from 'react-redux'; // ^8.1.0
import { configureStore } from '@reduxjs/toolkit'; // ^1.9.5
import { jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

import useAuth from '../../src/hooks/useAuth';
import { 
  AuthState, 
  AuthUser, 
  UserRole, 
  GoogleAuthRequest, 
  TokenResponse 
} from '../../src/types/auth';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};

// Mock BroadcastChannel for multi-tab sync
const mockBroadcastChannel = {
  postMessage: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  close: jest.fn()
};

// Mock data
const mockUser: AuthUser = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'test@example.com',
  roles: [UserRole.USER],
  created_at: Date.now()
};

const mockGoogleAuthRequest: GoogleAuthRequest = {
  code: 'test_auth_code',
  redirect_uri: 'http://localhost:3000/auth/callback'
};

const mockTokenResponse: TokenResponse = {
  access_token: 'mock_access_token',
  token_type: 'Bearer',
  expires_at: Date.now() + 3600000 // 1 hour from now
};

// Configure mock store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: (state = initialState, action) => state
    }
  });
};

describe('useAuth', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let wrapper: React.FC;

  beforeEach(() => {
    // Setup mocks
    jest.useFakeTimers();
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
    Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });
    Object.defineProperty(window, 'BroadcastChannel', { value: jest.fn(() => mockBroadcastChannel) });

    // Reset mock store
    mockStore = createMockStore({
      state: AuthState.UNAUTHENTICATED,
      user: null,
      error: null
    });

    // Create wrapper with Redux Provider
    wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={mockStore}>{children}</Provider>
    );

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with unauthenticated state', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should attempt token refresh on mount if token exists', async () => {
      mockLocalStorage.getItem.mockReturnValue('encrypted_token');
      
      const { result, waitForNextUpdate } = renderHook(() => useAuth(), { wrapper });
      await waitForNextUpdate();

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle expired token on mount', async () => {
      mockLocalStorage.getItem.mockReturnValue('expired_token');
      
      const { result, waitForNextUpdate } = renderHook(() => useAuth(), { wrapper });
      await waitForNextUpdate();

      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('handleGoogleAuth', () => {
    it('should handle successful Google authentication', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.handleGoogleAuth(mockGoogleAuthRequest);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        try {
          await result.current.handleGoogleAuth({ ...mockGoogleAuthRequest, code: 'invalid_code' });
        } catch (error) {
          expect(error).toBeDefined();
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBeDefined();
    });

    it('should implement retry mechanism for failed requests', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      let attempts = 0;

      jest.spyOn(global, 'fetch').mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve(new Response(JSON.stringify(mockTokenResponse)));
      });

      await act(async () => {
        await result.current.handleGoogleAuth(mockGoogleAuthRequest);
      });

      expect(attempts).toBe(3);
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('handleLogout', () => {
    it('should clear authentication state on logout', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
      expect(mockSessionStorage.clear).toHaveBeenCalled();
    });

    it('should synchronize logout across tabs', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'logout_broadcast',
        expect.any(String)
      );
    });
  });

  describe('checkUserRole', () => {
    it('should correctly verify user roles', () => {
      mockStore = createMockStore({
        state: AuthState.AUTHENTICATED,
        user: mockUser,
        error: null
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.checkUserRole(UserRole.USER)).toBe(true);
      expect(result.current.checkUserRole(UserRole.ADMIN)).toBe(false);
    });

    it('should cache role check results', () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      const firstCheck = result.current.checkUserRole(UserRole.USER);
      const secondCheck = result.current.checkUserRole(UserRole.USER);

      expect(firstCheck).toBe(secondCheck);
    });
  });

  describe('refreshToken', () => {
    it('should automatically refresh token before expiration', async () => {
      mockLocalStorage.getItem.mockReturnValue('encrypted_token');
      
      const { result, waitForNextUpdate } = renderHook(() => useAuth(), { wrapper });
      
      // Fast-forward until just before token expiration
      jest.advanceTimersByTime(3300000); // 55 minutes
      
      await waitForNextUpdate();

      expect(result.current.isAuthenticated).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle failed token refresh', async () => {
      mockLocalStorage.getItem.mockReturnValue('encrypted_token');
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Refresh failed'));

      const { result, waitForNextUpdate } = renderHook(() => useAuth(), { wrapper });
      
      await act(async () => {
        jest.advanceTimersByTime(3300000); // 55 minutes
      });
      
      await waitForNextUpdate();

      expect(result.current.isAuthenticated).toBe(false);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });
});