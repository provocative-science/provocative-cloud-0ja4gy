import React, { useState, useCallback, useEffect, memo } from 'react';
import styled from '@emotion/styled';
import {
  useMediaQuery,
  AppBar,
  Toolbar,
  IconButton,
  Menu,
  MenuItem,
  Drawer,
  List,
  ListItem,
  Fade
} from '@mui/material';
import {
  MenuIcon,
  AccountCircle,
  Brightness4,
  Brightness7,
  ChevronLeft,
  Settings,
  Dashboard
} from '@mui/icons-material';

import { Button } from './Button';
import { GoogleAuthButton } from '../auth/GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';

// Styled components with theme support
const StyledAppBar = styled(AppBar)`
  background-color: ${props => props.theme.palette.background.paper};
  box-shadow: none;
  border-bottom: 1px solid ${props => props.theme.palette.divider};
  transition: all 0.3s ease;
`;

const Logo = styled.div`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.palette.text.primary};
  margin-right: ${props => props.theme.spacing(4)};
`;

const NavLinks = styled.div`
  display: flex;
  gap: ${props => props.theme.spacing(2)};
  align-items: center;
  margin-left: auto;

  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileDrawer = styled(Drawer)`
  width: 240px;
  flex-shrink: 0;

  & .MuiDrawer-paper {
    width: 240px;
    box-sizing: border-box;
    background-color: ${props => props.theme.palette.background.paper};
  }
`;

interface NavbarProps {
  onThemeToggle: () => void;
  isDarkMode: boolean;
  isHighContrast: boolean;
  onContrastToggle: () => void;
}

interface MenuState {
  mobileMenuOpen: boolean;
  profileMenuOpen: boolean;
  settingsMenuOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = memo(({
  onThemeToggle,
  isDarkMode,
  isHighContrast,
  onContrastToggle
}) => {
  const { isAuthenticated, user, handleLogout, checkUserRole } = useAuth();
  const isMobile = useMediaQuery('(max-width:768px)');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuState, setMenuState] = useState<MenuState>({
    mobileMenuOpen: false,
    profileMenuOpen: false,
    settingsMenuOpen: false
  });

  // Handle mobile menu toggle
  const handleMobileMenuToggle = useCallback(() => {
    setMenuState(prev => ({
      ...prev,
      mobileMenuOpen: !prev.mobileMenuOpen
    }));
  }, []);

  // Handle profile menu toggle
  const handleProfileMenuToggle = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setMenuState(prev => ({
      ...prev,
      profileMenuOpen: !prev.profileMenuOpen
    }));
  }, []);

  // Handle menu close
  const handleMenuClose = useCallback(() => {
    setAnchorEl(null);
    setMenuState(prev => ({
      ...prev,
      profileMenuOpen: false,
      settingsMenuOpen: false
    }));
  }, []);

  // Handle logout with cleanup
  const handleLogoutClick = useCallback(async () => {
    handleMenuClose();
    await handleLogout();
  }, [handleLogout, handleMenuClose]);

  // Update ARIA labels based on menu state
  useEffect(() => {
    const menuButton = document.getElementById('menu-button');
    if (menuButton) {
      menuButton.setAttribute('aria-expanded', menuState.mobileMenuOpen.toString());
    }
  }, [menuState.mobileMenuOpen]);

  const renderMobileMenu = () => (
    <MobileDrawer
      anchor="left"
      open={menuState.mobileMenuOpen}
      onClose={handleMobileMenuToggle}
      ModalProps={{ keepMounted: true }}
    >
      <List role="navigation" aria-label="Main navigation">
        <ListItem>
          <IconButton
            onClick={handleMobileMenuToggle}
            aria-label="Close menu"
            edge="start"
          >
            <ChevronLeft />
          </IconButton>
        </ListItem>
        {isAuthenticated && (
          <>
            <ListItem>
              <Button
                variant="text"
                fullWidth
                ariaLabel="Dashboard"
                onClick={() => {/* Navigate to dashboard */}}
              >
                <Dashboard /> Dashboard
              </Button>
            </ListItem>
            {checkUserRole('HOST') && (
              <ListItem>
                <Button
                  variant="text"
                  fullWidth
                  ariaLabel="Host Settings"
                  onClick={() => {/* Navigate to host settings */}}
                >
                  <Settings /> Host Settings
                </Button>
              </ListItem>
            )}
          </>
        )}
      </List>
    </MobileDrawer>
  );

  const renderProfileMenu = () => (
    <Menu
      id="profile-menu"
      anchorEl={anchorEl}
      open={menuState.profileMenuOpen}
      onClose={handleMenuClose}
      TransitionComponent={Fade}
      keepMounted
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={handleMenuClose}>Profile</MenuItem>
      <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
      <MenuItem onClick={handleLogoutClick}>Logout</MenuItem>
    </Menu>
  );

  return (
    <>
      <StyledAppBar position="fixed" elevation={0}>
        <Toolbar>
          {isMobile && (
            <IconButton
              id="menu-button"
              color="inherit"
              aria-label="Open menu"
              aria-controls="mobile-menu"
              aria-haspopup="true"
              onClick={handleMobileMenuToggle}
              edge="start"
              size="large"
            >
              <MenuIcon />
            </IconButton>
          )}

          <Logo>Provocative Cloud</Logo>

          <NavLinks>
            {isAuthenticated ? (
              <>
                <Button
                  variant="text"
                  ariaLabel="Dashboard"
                  onClick={() => {/* Navigate to dashboard */}}
                >
                  Dashboard
                </Button>
                {checkUserRole('HOST') && (
                  <Button
                    variant="text"
                    ariaLabel="Host Settings"
                    onClick={() => {/* Navigate to host settings */}}
                  >
                    Host Settings
                  </Button>
                )}
              </>
            ) : (
              <GoogleAuthButton />
            )}
          </NavLinks>

          <IconButton
            onClick={onThemeToggle}
            color="inherit"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>

          <IconButton
            onClick={onContrastToggle}
            color="inherit"
            aria-label={isHighContrast ? 'Disable high contrast' : 'Enable high contrast'}
          >
            <Settings />
          </IconButton>

          {isAuthenticated && (
            <IconButton
              onClick={handleProfileMenuToggle}
              color="inherit"
              aria-label="Account settings"
              aria-controls="profile-menu"
              aria-haspopup="true"
            >
              <AccountCircle />
            </IconButton>
          )}
        </Toolbar>
      </StyledAppBar>

      {renderMobileMenu()}
      {renderProfileMenu()}
    </>
  );
});

Navbar.displayName = 'Navbar';

export default Navbar;