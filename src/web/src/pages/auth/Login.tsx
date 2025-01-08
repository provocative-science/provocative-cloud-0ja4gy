import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { 
  Typography, 
  Box, 
  Alert, 
  CircularProgress, 
  useTheme 
} from '@mui/material';

import AuthLayout from '../../layouts/AuthLayout';
import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';

/**
 * Login page component implementing secure Google OAuth 2.0 authentication
 * Includes comprehensive error handling, loading states, and accessibility features
 */
const Login: React.FC = React.memo(() => {
  const theme = useTheme();
  const location = useLocation();
  const { isAuthenticated, handleGoogleAuth, error: authError } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get return URL from location state or default to dashboard
  const returnUrl = (location.state as any)?.from?.pathname || '/dashboard';

  // Clear error state when component unmounts
  useEffect(() => {
    return () => setError(null);
  }, []);

  /**
   * Handles Google OAuth authentication with comprehensive error handling
   */
  const handleLogin = useCallback(async (request: any) => {
    try {
      setLoading(true);
      setError(null);

      // Validate request parameters
      if (!request?.code) {
        throw new Error('Invalid authentication request');
      }

      // Generate CSRF token for security
      const csrfToken = window.crypto.randomUUID();
      sessionStorage.setItem('csrf_token', csrfToken);

      // Prepare auth request with security measures
      const authRequest = {
        code: request.code,
        redirect_uri: window.location.origin,
        csrf_token: csrfToken
      };

      await handleGoogleAuth(authRequest);

    } catch (error: any) {
      console.error('Authentication error:', error);
      setError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [handleGoogleAuth]);

  // Redirect authenticated users
  if (isAuthenticated) {
    return <Navigate to={returnUrl} replace />;
  }

  return (
    <AuthLayout>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: theme.spacing(3),
          padding: theme.spacing(4),
          maxWidth: '100%',
          width: '400px',
          margin: '0 auto'
        }}
      >
        {/* Platform branding */}
        <Typography
          variant="h4"
          component="h1"
          align="center"
          sx={{
            marginBottom: theme.spacing(2),
            color: theme.palette.text.primary,
            fontWeight: theme.typography.fontWeightMedium
          }}
        >
          Welcome to Provocative Cloud
        </Typography>

        <Typography
          variant="body1"
          align="center"
          color="textSecondary"
          sx={{ marginBottom: theme.spacing(3) }}
        >
          Rent high-performance GPUs with integrated carbon capture technology
        </Typography>

        {/* Authentication button with loading state */}
        <GoogleAuthButton
          disabled={loading}
          loading={loading}
          onSuccess={handleLogin}
          onError={(error) => setError(error.message)}
        />

        {/* Error display with retry option */}
        {(error || authError) && (
          <Alert 
            severity="error"
            sx={{ 
              width: '100%',
              marginTop: theme.spacing(2),
              borderRadius: theme.shape.borderRadius
            }}
          >
            {error || authError}
          </Alert>
        )}

        {/* Loading indicator */}
        {loading && (
          <CircularProgress
            size={24}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-12px',
              marginLeft: '-12px'
            }}
          />
        )}
      </Box>
    </AuthLayout>
  );
});

// Set display name for debugging
Login.displayName = 'Login';

export default Login;