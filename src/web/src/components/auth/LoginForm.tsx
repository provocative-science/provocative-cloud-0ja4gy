import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnalytics } from '@analytics/react';

import { GoogleAuthButton } from './GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Constants
const DASHBOARD_ROUTE = '/dashboard';
const AUTH_RETRY_LIMIT = 3;
const AUTH_TIMEOUT_MS = 30000;

interface LoginFormProps {
  className?: string;
}

/**
 * Enhanced login form component implementing secure authentication flow
 * with Google OAuth, accessibility features, and theme support
 */
export const LoginForm: React.FC<LoginFormProps> = ({ className }) => {
  const navigate = useNavigate();
  const analytics = useAnalytics();
  const { handleGoogleAuth, isAuthenticated, error } = useAuth();
  const { theme } = useTheme();
  
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [authTimeout, setAuthTimeout] = useState<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
    };
  }, [authTimeout]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate(DASHBOARD_ROUTE);
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handles successful Google OAuth authentication with enhanced security
   */
  const handleAuthSuccess = useCallback(async (response: any) => {
    try {
      setIsLoading(true);

      // Track authentication attempt
      analytics.track('Auth Attempt', {
        provider: 'google',
        timestamp: new Date().toISOString()
      });

      // Set authentication timeout
      const timeout = setTimeout(() => {
        setIsLoading(false);
        setRetryCount(prev => prev + 1);
      }, AUTH_TIMEOUT_MS);
      setAuthTimeout(timeout);

      // Generate CSRF token
      const csrfToken = window.crypto.randomUUID();
      sessionStorage.setItem('csrf_token', csrfToken);

      // Prepare auth request
      const authRequest = {
        code: response.credential,
        redirect_uri: window.location.origin,
        csrf_token: csrfToken
      };

      // Attempt authentication
      await handleGoogleAuth(authRequest);

      // Track successful authentication
      analytics.track('Auth Success', {
        provider: 'google',
        timestamp: new Date().toISOString()
      });

      // Clear timeout on success
      clearTimeout(timeout);
      navigate(DASHBOARD_ROUTE);

    } catch (error) {
      console.error('Authentication error:', error);
      
      // Track authentication failure
      analytics.track('Auth Error', {
        provider: 'google',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      setRetryCount(prev => prev + 1);
    } finally {
      setIsLoading(false);
    }
  }, [handleGoogleAuth, navigate, analytics]);

  /**
   * Handles authentication errors with user feedback
   */
  const handleAuthError = useCallback((error: Error) => {
    console.error('Google auth error:', error);
    
    // Track authentication error
    analytics.track('Auth Error', {
      provider: 'google',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    setRetryCount(prev => prev + 1);
  }, [analytics]);

  return (
    <div 
      className={`login-form ${className || ''} ${theme.mode === 'dark' ? 'dark' : ''}`}
      role="main"
      aria-label="Login form"
    >
      <div className="login-form__container">
        <h1 className="login-form__title">
          Welcome to Provocative Cloud
        </h1>
        
        <div className="login-form__content">
          <GoogleAuthButton
            className="login-form__google-button"
            disabled={isLoading || retryCount >= AUTH_RETRY_LIMIT}
            onSuccess={handleAuthSuccess}
            onError={handleAuthError}
          />

          {error && (
            <div 
              className="login-form__error"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          {retryCount >= AUTH_RETRY_LIMIT && (
            <div 
              className="login-form__retry-limit"
              role="alert"
              aria-live="polite"
            >
              Too many failed attempts. Please try again later.
            </div>
          )}

          {isLoading && (
            <div 
              className="login-form__loading"
              role="status"
              aria-label="Authenticating"
            >
              <span className="loading-spinner" aria-hidden="true" />
              Authenticating...
            </div>
          )}
        </div>

        <div className="login-form__footer">
          <p className="login-form__help-text">
            Need help?{' '}
            <a 
              href="/support"
              className="login-form__help-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              Contact support
            </a>
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-form {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: var(--spacing-md);
          background-color: var(--background-${theme.mode});
          color: var(--primary-text-${theme.mode});
          transition: background-color 0.3s ease, color 0.3s ease;
        }

        .login-form__container {
          width: 100%;
          max-width: 400px;
          padding: var(--spacing-lg);
          border-radius: var(--border-radius-md);
          background-color: var(--background-${theme.mode === 'dark' ? 'dark' : 'light'});
          box-shadow: var(--shadow-md);
        }

        .login-form__title {
          margin-bottom: var(--spacing-lg);
          font-size: var(--font-size-xl);
          font-weight: var(--font-weight-bold);
          text-align: center;
          color: var(--primary-text-${theme.mode});
        }

        .login-form__content {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        }

        .login-form__error,
        .login-form__retry-limit {
          padding: var(--spacing-sm);
          border-radius: var(--border-radius-sm);
          background-color: var(--alert-${theme.mode});
          color: var(--primary-text-${theme.mode});
          font-size: var(--font-size-sm);
          text-align: center;
        }

        .login-form__loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          color: var(--secondary-text-${theme.mode});
        }

        .login-form__footer {
          margin-top: var(--spacing-lg);
          text-align: center;
        }

        .login-form__help-link {
          color: var(--accent-${theme.mode});
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .login-form__help-link:hover {
          text-decoration: underline;
        }

        @media (max-width: ${theme.breakpoints?.mobile}px) {
          .login-form__container {
            padding: var(--spacing-md);
          }
        }
      `}</style>
    </div>
  );
};

export default React.memo(LoginForm);