import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Checkbox, 
  Typography, 
  Alert, 
  CircularProgress,
  useTheme 
} from '@mui/material'; // ^5.0.0

import { GoogleAuthButton } from '../../components/auth/GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';
import { Card } from '../../components/common/Card';
import AuthLayout from '../../layouts/AuthLayout';
import { GoogleAuthRequest } from '../../types/auth';

/**
 * Registration page component implementing Google OAuth flow
 * Provides secure user registration with WCAG 2.1 Level AA compliance
 */
const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { handleGoogleAuth, isLoading, error } = useAuth();
  const theme = useTheme();
  const [termsAccepted, setTermsAccepted] = useState(false);

  /**
   * Handles terms and conditions acceptance with accessibility announcements
   */
  const handleTermsAccept = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setTermsAccepted(event.target.checked);
    // Announce state change to screen readers
    const announcement = event.target.checked 
      ? 'Terms accepted, registration enabled' 
      : 'Terms not accepted, registration disabled';
    
    const announcer = document.createElement('div');
    announcer.setAttribute('aria-live', 'polite');
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);
  }, []);

  /**
   * Handles successful registration flow with error handling
   */
  const handleRegistrationSuccess = useCallback(async (request: GoogleAuthRequest) => {
    try {
      await handleGoogleAuth(request);
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
    }
  }, [handleGoogleAuth, navigate]);

  return (
    <AuthLayout>
      <Card
        elevation={3}
        padding={theme.spacing(4)}
        borderRadius={theme.shape.borderRadius}
        width="100%"
        maxWidth={400}
        role="main"
        aria-label="Registration form"
      >
        <Box 
          display="flex" 
          flexDirection="column" 
          gap={3}
          component="form"
          noValidate
        >
          <Typography 
            variant="h4" 
            component="h1" 
            align="center"
            gutterBottom
          >
            Create Account
          </Typography>

          <Typography 
            variant="body2" 
            color="textSecondary" 
            align="center"
            gutterBottom
          >
            Join Provocative Cloud to access high-performance GPU resources
          </Typography>

          {error && (
            <Alert 
              severity="error" 
              variant="filled"
              role="alert"
            >
              {error}
            </Alert>
          )}

          <Box display="flex" alignItems="center" gap={1}>
            <Checkbox
              id="terms-accept"
              checked={termsAccepted}
              onChange={handleTermsAccept}
              color="primary"
              aria-required="true"
            />
            <Typography 
              variant="body2" 
              component="label" 
              htmlFor="terms-accept"
            >
              I accept the{' '}
              <a 
                href="/terms" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: theme.palette.primary.main }}
              >
                Terms of Service
              </a>
              {' '}and{' '}
              <a 
                href="/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ color: theme.palette.primary.main }}
              >
                Privacy Policy
              </a>
            </Typography>
          </Box>

          <GoogleAuthButton
            disabled={!termsAccepted || isLoading}
            loading={isLoading}
            onSuccess={handleRegistrationSuccess}
            onError={(error) => console.error('Google OAuth error:', error)}
          />

          {isLoading && (
            <Box display="flex" justifyContent="center">
              <CircularProgress size={24} />
            </Box>
          )}

          <Typography 
            variant="body2" 
            color="textSecondary" 
            align="center"
          >
            Already have an account?{' '}
            <a 
              href="/login"
              style={{ color: theme.palette.primary.main }}
            >
              Sign in
            </a>
          </Typography>
        </Box>
      </Card>
    </AuthLayout>
  );
};

export default RegisterPage;