import React, { useEffect, useMemo } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Container, CircularProgress } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { UserDashboard } from '../../components/dashboard/UserDashboard';
import { AdminDashboard } from '../../components/dashboard/AdminDashboard';
import { useAuth } from '../../hooks/useAuth';

/**
 * Error fallback component for dashboard error boundary
 */
const DashboardErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <Container 
    sx={{ 
      p: 4, 
      textAlign: 'center',
      color: 'error.main'
    }}
    role="alert"
    aria-live="polite"
  >
    <h2>Dashboard Error</h2>
    <p>{error.message}</p>
    <p>Please try refreshing the page or contact support if the issue persists.</p>
  </Container>
);

/**
 * Loading state component with accessibility support
 */
const LoadingState: React.FC = () => (
  <Container 
    sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '50vh' 
    }}
  >
    <div role="status" aria-live="polite">
      <CircularProgress size={48} />
      <p>Loading dashboard...</p>
    </div>
  </Container>
);

/**
 * Main dashboard page component that handles role-based rendering
 * and authentication state management
 */
const DashboardPage: React.FC = () => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    isLoading, 
    user, 
    error, 
    checkUserRole 
  } = useAuth();

  // Memoize role checks to prevent unnecessary re-renders
  const isAdmin = useMemo(() => 
    checkUserRole('ADMIN'), [checkUserRole]
  );

  const isHost = useMemo(() => 
    checkUserRole('HOST'), [checkUserRole]
  );

  // Handle authentication loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <Navigate 
        to="/login" 
        state={{ from: location }} 
        replace 
      />
    );
  }

  // Handle authentication errors
  if (error) {
    throw new Error(`Authentication error: ${error}`);
  }

  return (
    <ErrorBoundary
      FallbackComponent={DashboardErrorFallback}
      onReset={() => window.location.reload()}
    >
      <Container 
        maxWidth={false}
        sx={{ 
          p: { xs: 2, sm: 3 },
          minHeight: '100vh',
          backgroundColor: 'background.default'
        }}
      >
        {/* Render appropriate dashboard based on user role */}
        {(isAdmin || isHost) ? (
          <AdminDashboard 
            environmentalMetricsEnabled={true}
            refreshInterval={30000}
          />
        ) : (
          <UserDashboard />
        )}
      </Container>
    </ErrorBoundary>
  );
};

// Add display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;