import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import analytics from '@segment/analytics-next';

import Layout from '../components/common/Layout';
import useAuth from '../hooks/useAuth';
import { UserRole } from '../types/auth';

// Initialize analytics
const analyticsClient = analytics({
  writeKey: process.env.REACT_APP_SEGMENT_WRITE_KEY || ''
});

// Constants
const ADMIN_ROLE = UserRole.ADMIN;
const ROLE_CHECK_INTERVAL = 300000; // 5 minutes
const UNAUTHORIZED_REDIRECT = '/login?unauthorized=true';

interface AdminLayoutProps {
  children: React.ReactNode;
  className?: string;
  withAnalytics?: boolean;
}

const AdminLayout: React.FC<AdminLayoutProps> = React.memo(({
  children,
  className,
  withAnalytics = true
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, checkUserRole, user } = useAuth();

  // Verify admin role with caching
  const isAdmin = useMemo(() => {
    return checkUserRole(ADMIN_ROLE);
  }, [checkUserRole]);

  // Track admin access attempts
  const trackAccess = useCallback((success: boolean) => {
    if (!withAnalytics) return;

    analyticsClient.track({
      userId: user?.id,
      event: 'Admin Access Attempt',
      properties: {
        success,
        timestamp: new Date().toISOString(),
        path: window.location.pathname
      }
    });
  }, [user, withAnalytics]);

  // Handle unauthorized access
  const handleUnauthorized = useCallback(() => {
    trackAccess(false);
    navigate(UNAUTHORIZED_REDIRECT, { replace: true });
  }, [navigate, trackAccess]);

  // Periodic role verification
  useEffect(() => {
    if (!isAuthenticated || !isAdmin) {
      handleUnauthorized();
      return;
    }

    trackAccess(true);

    const verificationInterval = setInterval(() => {
      if (!checkUserRole(ADMIN_ROLE)) {
        handleUnauthorized();
      }
    }, ROLE_CHECK_INTERVAL);

    return () => {
      clearInterval(verificationInterval);
    };
  }, [isAuthenticated, isAdmin, checkUserRole, handleUnauthorized, trackAccess]);

  // Show loading state
  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Show nothing if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <Layout
      withSidebar
      withFooter
      className={className}
    >
      {children}
    </Layout>
  );
});

AdminLayout.displayName = 'AdminLayout';

export default AdminLayout;