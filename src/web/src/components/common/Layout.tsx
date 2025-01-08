import React, { useCallback, useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { Box, Container, useMediaQuery } from '@mui/material'; // ^5.0.0
import { useTheme } from '@mui/material/styles'; // ^5.0.0

import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';
import { useAuth } from '../../hooks/useAuth';

// Constants for layout dimensions and transitions
const HEADER_HEIGHT = 64;
const MOBILE_HEADER_HEIGHT = 56;
const FOOTER_HEIGHT = 80;
const SIDEBAR_WIDTH = 240;
const TRANSITION_DURATION = 225;

// Interface for Layout props
interface LayoutProps {
  children: React.ReactNode;
  withSidebar?: boolean;
  withFooter?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disablePadding?: boolean;
}

// Styled components with theme support
const StyledMain = styled.main<{
  sidebarOpen: boolean;
  headerHeight: number;
  footerHeight: number;
}>`
  flex-grow: 1;
  padding: ${({ theme }) => theme.spacing(3)};
  min-height: ${({ headerHeight, footerHeight }) => 
    `calc(100vh - ${headerHeight}px - ${footerHeight}px)`};
  transition: margin-left ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1);
  margin-left: ${({ sidebarOpen }) => sidebarOpen ? `${SIDEBAR_WIDTH}px` : 0};
  background-color: ${({ theme }) => theme.palette.background.default};
  position: relative;
  z-index: 1;

  @media (max-width: 768px) {
    margin-left: 0;
    padding: ${({ theme }) => theme.spacing(2)};
  }
`;

const StyledContainer = styled(Container)<{ disablePadding: boolean }>`
  padding: ${({ disablePadding, theme }) => 
    disablePadding ? 0 : theme.spacing(2)};
  margin: 0 auto;
  position: relative;
  z-index: 1;
`;

// Skip link for keyboard navigation
const SkipLink = styled.a`
  position: fixed;
  top: -100%;
  left: 16px;
  z-index: 2000;
  padding: ${({ theme }) => theme.spacing(1, 2)};
  background-color: ${({ theme }) => theme.palette.primary.main};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  text-decoration: none;
  border-radius: ${({ theme }) => theme.shape.borderRadius}px;
  transition: top 0.2s;

  &:focus {
    top: 16px;
  }
`;

const Layout: React.FC<LayoutProps> = React.memo(({
  children,
  withSidebar = false,
  withFooter = true,
  maxWidth = 'lg',
  disablePadding = false
}) => {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile && withSidebar);
  const [mainContentId] = useState(`main-content-${Math.random().toString(36).substr(2, 9)}`);

  // Calculate dynamic heights
  const headerHeight = isMobile ? MOBILE_HEADER_HEIGHT : HEADER_HEIGHT;
  const footerHeight = withFooter ? FOOTER_HEIGHT : 0;

  // Handle sidebar toggle with animation support
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  // Close sidebar on mobile when clicking outside
  const handleMainClick = useCallback(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobile, sidebarOpen]);

  // Update sidebar state on screen resize
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else if (withSidebar) {
      setSidebarOpen(true);
    }
  }, [isMobile, withSidebar]);

  return (
    <Box display="flex" flexDirection="column" minHeight="100vh">
      {/* Skip to main content link */}
      <SkipLink href={`#${mainContentId}`}>
        Skip to main content
      </SkipLink>

      {/* Header */}
      <Header />

      {/* Sidebar */}
      {withSidebar && isAuthenticated && (
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          variant={isMobile ? 'temporary' : 'permanent'}
        />
      )}

      {/* Main content */}
      <StyledMain
        id={mainContentId}
        sidebarOpen={sidebarOpen && withSidebar && isAuthenticated}
        headerHeight={headerHeight}
        footerHeight={footerHeight}
        onClick={handleMainClick}
        role="main"
        aria-label="Main content"
      >
        <StyledContainer
          maxWidth={maxWidth}
          disablePadding={disablePadding}
        >
          {children}
        </StyledContainer>
      </StyledMain>

      {/* Footer */}
      {withFooter && <Footer />}
    </Box>
  );
});

Layout.displayName = 'Layout';

export default Layout;