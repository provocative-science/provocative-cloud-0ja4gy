import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react'; // ^14.0.0
import userEvent from '@testing-library/user-event'; // ^14.0.0
import { axe, toHaveNoViolations } from 'jest-axe'; // ^8.0.0
import { ThemeProvider } from '@mui/material'; // ^5.0.0
import { GoogleLogin } from '@react-oauth/google'; // ^1.0.0

import { GoogleAuthButton } from '../../src/components/auth/GoogleAuthButton';
import { useAuth } from '../../src/hooks/useAuth';
import { createTheme } from '../../src/theme';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock dependencies
jest.mock('../../src/hooks/useAuth');
jest.mock('@react-oauth/google');
jest.mock('@segment/analytics-next');

describe('GoogleAuthButton', () => {
  // Test setup variables
  const mockHandleGoogleAuth = jest.fn();
  const mockShowBoundary = jest.fn();
  const mockAnalyticsTrack = jest.fn();
  const defaultProps = {
    className: 'test-class',
    disabled: false,
    loading: false
  };

  // Theme setup for testing
  const theme = createTheme({
    mode: 'light',
    highContrast: false
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock useAuth hook
    (useAuth as jest.Mock).mockReturnValue({
      handleGoogleAuth: mockHandleGoogleAuth,
      isAuthenticating: false
    });

    // Mock Google OAuth component
    (GoogleLogin as jest.Mock).mockImplementation(({ onSuccess, onError }) => (
      <button 
        onClick={() => onSuccess({ credential: 'test-token' })}
        onError={() => onError(new Error('Google auth error'))}
      >
        Google Login
      </button>
    ));

    // Mock analytics
    global.analytics = {
      track: mockAnalyticsTrack
    };
  });

  // Render helper with theme provider
  const renderWithTheme = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <GoogleAuthButton {...defaultProps} {...props} />
      </ThemeProvider>
    );
  };

  it('renders correctly with default props', () => {
    renderWithTheme();
    
    const button = screen.getByRole('button', { name: /sign in with google/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('test-class');
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('handles successful authentication', async () => {
    renderWithTheme();
    
    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(mockHandleGoogleAuth).toHaveBeenCalledWith(expect.objectContaining({
      code: 'test-token',
      redirect_uri: expect.any(String),
      csrf_token: expect.any(String)
    }));

    expect(mockAnalyticsTrack).toHaveBeenCalledWith('Auth Attempt', expect.any(Object));
    expect(mockAnalyticsTrack).toHaveBeenCalledWith('Auth Success', expect.any(Object));
  });

  it('handles authentication errors', async () => {
    mockHandleGoogleAuth.mockRejectedValueOnce(new Error('Auth failed'));
    renderWithTheme();
    
    const button = screen.getByRole('button');
    await userEvent.click(button);

    await waitFor(() => {
      expect(mockShowBoundary).toHaveBeenCalledWith(expect.any(Error));
      expect(mockAnalyticsTrack).toHaveBeenCalledWith('Auth Error', expect.any(Object));
    });
  });

  it('handles loading states correctly', () => {
    renderWithTheme({ loading: true });
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles disabled state correctly', () => {
    renderWithTheme({ disabled: true });
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  it('handles high contrast mode', () => {
    const highContrastTheme = createTheme({
      mode: 'light',
      highContrast: true
    });

    render(
      <ThemeProvider theme={highContrastTheme}>
        <GoogleAuthButton {...defaultProps} />
      </ThemeProvider>
    );

    const button = screen.getByRole('button');
    expect(button).toHaveStyle({
      backgroundColor: expect.stringMatching(/#000000/i),
      color: expect.stringMatching(/#FFFFFF/i)
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = renderWithTheme();
    
    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check ARIA attributes
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Sign in with Google');
    expect(button).toHaveAttribute('role', 'button');

    // Test keyboard navigation
    button.focus();
    expect(button).toHaveFocus();
    
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockHandleGoogleAuth).toHaveBeenCalled();
  });

  it('handles authentication state changes', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      handleGoogleAuth: mockHandleGoogleAuth,
      isAuthenticating: true
    });

    renderWithTheme();
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    // Simulate auth state change
    (useAuth as jest.Mock).mockReturnValue({
      handleGoogleAuth: mockHandleGoogleAuth,
      isAuthenticating: false
    });

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).not.toHaveAttribute('aria-busy');
    });
  });

  it('handles CSRF token generation and validation', async () => {
    renderWithTheme();
    
    const button = screen.getByRole('button');
    await userEvent.click(button);

    expect(mockHandleGoogleAuth).toHaveBeenCalledWith(expect.objectContaining({
      csrf_token: expect.any(String)
    }));

    expect(sessionStorage.getItem('csrf_token')).toBeTruthy();
  });

  it('cleans up resources on unmount', () => {
    const { unmount } = renderWithTheme();
    unmount();

    // Verify cleanup
    expect(sessionStorage.getItem('csrf_token')).toBeNull();
  });
});