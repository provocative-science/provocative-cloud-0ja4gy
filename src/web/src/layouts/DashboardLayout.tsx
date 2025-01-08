import React, { useState, useEffect, useCallback, memo, lazy, Suspense } from 'react';
import styled from '@emotion/styled';
import { Box, Container, useMediaQuery, Skeleton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';

import Navbar from '../components/common/Navbar';
import Sidebar from '../components/common/Sidebar';
import { useAuth } from '../hooks/useAuth';

// Constants for layout dimensions
const HEADER_HEIGHT = 64;
const SIDEBAR_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const ANIMATION_DURATION = 225;

// Styled components with theme support
const StyledMain = styled.main<{ isSidebarOpen: boolean; isMobile: boolean }>`
  flex-grow: 1;
  min-height: calc(100vh - ${HEADER_HEIGHT}px);
  margin-left: ${({ isSidebarOpen, isMobile }) =>
    isSidebarOpen && !isMobile ? `${SIDEBAR_WIDTH}px` : 0};
  transition: margin ${ANIMATION_DURATION}ms cubic-bezier(0.4, 0, 0.6, 1) 0ms;
  overflow-x: hidden;
  position: relative;
  padding-top: ${HEADER_HEIGHT}px;
`;

const StyledContainer = styled(Container)`
  padding: ${({ theme }) => theme.spacing(3)};
  height: 100%;
  position: relative;

  @media (max-width: ${MOBILE_BREAKPOINT}px) {
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

// Error fallback component
const ErrorFallback = memo(({ error }: { error: Error }) => (
  <Box p={3} textAlign="center">
    <h2>Something went wrong:</h2>
    <pre>{error.message}</pre>
  </Box>
));

ErrorFallback.displayName = 'ErrorFallback';

// Loading fallback component
const LoadingFallback = memo(() => (
  <Box p={3}>
    <Skeleton variant="rectangular" height={200} />
    <Skeleton variant="text" height={40} sx={{ mt: 2 }} />
    <Skeleton variant="text" height={40} />
  </Box>
));

LoadingFallback.displayName = 'LoadingFallback';

// Props interface
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  showSidebar?: boolean;
}

/**
 * Dashboard layout component with responsive behavior and role-based access
 * Implements F-pattern layout principles and WCAG 2.1 Level AA compliance
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = memo(({
  children,
  className,
  showSidebar = true
}) => {
  const theme = useTheme();
  const { isAuthenticated, checkUserRole } = useAuth();
  const isMobile = useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT}px)`);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  // Handle sidebar toggle with touch support
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Close sidebar on mobile when clicking outside
  const handleContentClick = useCallback(() => {
    if (isMobile && isSidebarOpen) {
      setIsSidebarOpen(false);
    }
  }, [isMobile, isSidebarOpen]);

  // Update sidebar state on screen resize
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Redirect if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Box 
      sx={{ 
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default 
      }}
      className={className}
    >
      <Navbar
        onThemeToggle={() => {}} // Implement theme toggle
        isDarkMode={theme.palette.mode === 'dark'}
      />

      {showSidebar && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
      )}

      <StyledMain
        isSidebarOpen={isSidebarOpen && showSidebar}
        isMobile={isMobile}
        onClick={handleContentClick}
        role="main"
        aria-label="Dashboard content"
      >
        <StyledContainer maxWidth="xl">
          <ErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => window.location.reload()}
          >
            <Suspense fallback={<LoadingFallback />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </StyledContainer>
      </StyledMain>
    </Box>
  );
});

DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;