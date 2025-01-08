import React, { useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Container, Paper } from '@mui/material';
import styled from '@emotion/styled';
import { ErrorBoundary } from 'react-error-boundary';
import { Analytics } from '@segment/analytics-next';

import Layout from '../components/common/Layout';
import { useAuth } from '../hooks/useAuth';

// Constants
const DASHBOARD_ROUTE = '/dashboard';
const AUTH_ROUTES = ['/login', '/register'];
const HEADER_HEIGHT = 64;
const TRANSITION_DURATION = 300;

// Initialize analytics
const analytics = new Analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

// Styled components with theme and accessibility support
const StyledContainer = styled(Container)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - ${HEADER_HEIGHT}px);
  padding: ${({ theme }) => theme.spacing(2)};
  margin: 0 auto;
  max-width: 100%;
  position: relative;
  direction: ${({ theme }) => theme.direction};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const StyledPaper = styled(Paper)`
  max-width: ${({ theme }) => ({ xs: '100%', sm: '400px' })[theme.breakpoints.keys[0]]};
  margin: ${({ theme }) => theme.spacing(2, 'auto')};
  padding: ${({ theme }) => theme.spacing({ xs: 2, sm: 3, md: 4 })};
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  box-shadow: ${({ theme }) => theme.shadows[3]};
  transition: all ${TRANSITION_DURATION}ms ease-in-out;
  background-color: ${({ theme }) => theme.palette.background.paper};
  position: relative;
  outline: none;

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.palette.primary.main};
  }
`;

// Error fallback component
const AuthErrorFallback = ({ error }: { error: Error }) => (
  <Box
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center'
    }}
  >
    {error.message}
  </Box>
);

interface AuthLayoutProps {
  children: React.ReactNode;
  withAnimation?: boolean;
  testId?: string;
}

/**
 * Specialized layout component for authentication pages
 * Implements WCAG 2.1 Level AA compliance and comprehensive security measures
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  withAnimation = true,
  testId = 'auth-layout'
}) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // Track authentication page views
  useEffect(() => {
    analytics.track('Auth Page View', {
      path: location.pathname,
      timestamp: new Date().toISOString()
    });
  }, [location.pathname]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      const focusableElements = document.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusableElements[0] as HTMLElement)?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Redirect authenticated users if not on auth routes
  if (isAuthenticated && !AUTH_ROUTES.includes(location.pathname)) {
    return <Navigate to={DASHBOARD_ROUTE} replace />;
  }

  return (
    <ErrorBoundary FallbackComponent={AuthErrorFallback}>
      <Layout withFooter={false}>
        <StyledContainer
          maxWidth="sm"
          component="main"
          data-testid={testId}
          role="main"
          aria-label="Authentication"
        >
          <StyledPaper
            elevation={3}
            tabIndex={-1}
            sx={{
              opacity: withAnimation ? 1 : 0,
              transform: withAnimation ? 'translateY(0)' : 'translateY(-20px)',
              transition: withAnimation ? `all ${TRANSITION_DURATION}ms ease-in-out` : 'none'
            }}
          >
            {children}
          </StyledPaper>
        </StyledContainer>
      </Layout>
    </ErrorBoundary>
  );
};

AuthLayout.displayName = 'AuthLayout';

export default React.memo(AuthLayout);