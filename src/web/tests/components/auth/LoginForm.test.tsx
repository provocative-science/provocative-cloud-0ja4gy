import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { Provider } from 'react-redux'; // ^8.1.0
import { MemoryRouter } from 'react-router-dom'; // ^6.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^4.7.0
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider } from '../../providers/ThemeProvider';
import { LoginForm } from '../../../src/components/auth/LoginForm';
import { AuthState, UserRole } from '../../../src/types/auth';
import { ThemeMode } from '../../../src/types/theme';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    handleGoogleAuth: mockHandleGoogleAuth,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    user: null
  })
}));

jest.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: {
      mode: ThemeMode.LIGHT,
      highContrast: false
    }
  })
}));

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

// Mock Google Auth
const mockHandleGoogleAuth = jest.fn();
const mockGoogleResponse = {
  credential: 'mock-credential',
  select_by: 'user'
};

// Helper function to render component with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    store = configureStore({
      reducer: {
        auth: (state = initialState) => state
      }
    }),
    ...renderOptions
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <ThemeProvider>
        <MemoryRouter>
          {children}
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store
  };
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('Accessibility Tests', () => {
    it('should have no accessibility violations', async () => {
      const { container } = renderWithProviders(<LoginForm />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels and roles', () => {
      renderWithProviders(<LoginForm />);
      
      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Login form');
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sign in with Google');
    });

    it('should be keyboard navigable', async () => {
      renderWithProviders(<LoginForm />);
      const user = userEvent.setup();

      // Tab to Google sign-in button
      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();

      // Tab to help link
      await user.tab();
      expect(screen.getByRole('link', { name: /contact support/i })).toHaveFocus();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle successful Google authentication', async () => {
      renderWithProviders(<LoginForm />);
      
      mockHandleGoogleAuth.mockResolvedValueOnce({});
      
      // Simulate Google OAuth response
      await fireEvent(window, new MessageEvent('message', {
        data: {
          type: 'oauth2_success',
          response: mockGoogleResponse
        }
      }));

      await waitFor(() => {
        expect(mockHandleGoogleAuth).toHaveBeenCalledWith({
          code: mockGoogleResponse.credential,
          redirect_uri: window.location.origin,
          csrf_token: expect.any(String)
        });
      });

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should display error message on authentication failure', async () => {
      const errorMessage = 'Authentication failed';
      mockHandleGoogleAuth.mockRejectedValueOnce(new Error(errorMessage));

      renderWithProviders(<LoginForm />);

      // Simulate failed authentication
      await fireEvent(window, new MessageEvent('message', {
        data: {
          type: 'oauth2_success',
          response: mockGoogleResponse
        }
      }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
      });
    });

    it('should handle retry limit exceeded', async () => {
      renderWithProviders(<LoginForm />);
      
      // Simulate multiple failed attempts
      for (let i = 0; i < 3; i++) {
        mockHandleGoogleAuth.mockRejectedValueOnce(new Error('Failed'));
        
        await fireEvent(window, new MessageEvent('message', {
          data: {
            type: 'oauth2_success',
            response: mockGoogleResponse
          }
        }));
      }

      await waitFor(() => {
        expect(screen.getByText(/too many failed attempts/i)).toBeInTheDocument();
        expect(screen.getByRole('button')).toBeDisabled();
      });
    });
  });

  describe('Visual and Styling Tests', () => {
    it('should apply correct theme styles', () => {
      const { container } = renderWithProviders(<LoginForm />);
      
      const loginForm = container.querySelector('.login-form');
      expect(loginForm).toHaveStyle({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      });
    });

    it('should be responsive on different screen sizes', () => {
      const { container } = renderWithProviders(<LoginForm />);
      
      // Mock mobile viewport
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn()
      }));

      const loginContainer = container.querySelector('.login-form__container');
      expect(loginContainer).toHaveStyle({
        width: '100%',
        maxWidth: '400px'
      });
    });

    it('should handle dark mode correctly', () => {
      const { container } = renderWithProviders(<LoginForm />, {
        initialState: {
          theme: {
            mode: ThemeMode.DARK
          }
        }
      });

      const loginForm = container.querySelector('.login-form');
      expect(loginForm).toHaveClass('dark');
    });
  });

  describe('Loading State', () => {
    it('should display loading indicator during authentication', async () => {
      mockHandleGoogleAuth.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      renderWithProviders(<LoginForm />);

      await fireEvent(window, new MessageEvent('message', {
        data: {
          type: 'oauth2_success',
          response: mockGoogleResponse
        }
      }));

      expect(screen.getByRole('status')).toHaveTextContent(/authenticating/i);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Authenticating');
    });
  });

  describe('Security Tests', () => {
    it('should generate and validate CSRF token', async () => {
      renderWithProviders(<LoginForm />);

      await fireEvent(window, new MessageEvent('message', {
        data: {
          type: 'oauth2_success',
          response: mockGoogleResponse
        }
      }));

      await waitFor(() => {
        expect(sessionStorage.getItem('csrf_token')).toBeTruthy();
        expect(mockHandleGoogleAuth).toHaveBeenCalledWith(
          expect.objectContaining({
            csrf_token: expect.any(String)
          })
        );
      });
    });
  });
});