import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import { useMediaQuery } from 'react-responsive';
import { motion } from 'framer-motion';

import { routes } from '../../config/routes';
import { UserRole } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';

// Constants for responsive breakpoints and animations
const BREAKPOINT_MOBILE = 768;
const BREAKPOINT_TABLET = 1024;
const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_WIDTH = 64;
const TRANSITION_DURATION = 0.3;

// Interface definitions
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  roles: UserRole[];
  badge?: string | number;
}

// Navigation items with role-based access
const navigationItems: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: '📊',
    roles: [UserRole.USER, UserRole.HOST, UserRole.ADMIN]
  },
  {
    path: '/rentals',
    label: 'GPU Rentals',
    icon: '🖥️',
    roles: [UserRole.USER, UserRole.HOST, UserRole.ADMIN]
  },
  {
    path: '/host',
    label: 'Host Dashboard',
    icon: '🏢',
    roles: [UserRole.HOST, UserRole.ADMIN]
  },
  {
    path: '/host/servers',
    label: 'Server Management',
    icon: '🔧',
    roles: [UserRole.HOST, UserRole.ADMIN]
  },
  {
    path: '/host/pricing',
    label: 'Pricing',
    icon: '💰',
    roles: [UserRole.HOST, UserRole.ADMIN]
  },
  {
    path: '/admin',
    label: 'Admin Panel',
    icon: '⚙️',
    roles: [UserRole.ADMIN]
  },
  {
    path: '/admin/users',
    label: 'User Management',
    icon: '👥',
    roles: [UserRole.ADMIN]
  },
  {
    path: '/admin/analytics',
    label: 'Analytics',
    icon: '📈',
    roles: [UserRole.ADMIN]
  }
];

const Sidebar: React.FC<SidebarProps> = memo(({ isOpen, onClose }) => {
  const location = useLocation();
  const { checkUserRole, isAuthenticated } = useAuth();
  const isMobile = useMediaQuery({ maxWidth: BREAKPOINT_MOBILE });
  const isTablet = useMediaQuery({ maxWidth: BREAKPOINT_TABLET });

  // Track touch gestures for mobile swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Filter navigation items based on user roles
  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => 
      item.roles.some(role => checkUserRole(role))
    );
  }, [checkUserRole]);

  // Handle touch gestures for mobile swipe
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    
    if (isLeftSwipe && isOpen) {
      onClose();
    }
  }, [touchStart, touchEnd, isOpen, onClose]);

  // Animation variants for sidebar
  const sidebarVariants = {
    open: {
      width: SIDEBAR_WIDTH,
      transition: { duration: TRANSITION_DURATION }
    },
    closed: {
      width: isMobile ? 0 : SIDEBAR_COLLAPSED_WIDTH,
      transition: { duration: TRANSITION_DURATION }
    }
  };

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile && isOpen) {
      onClose();
    }
  }, [location, isMobile, isOpen, onClose]);

  if (!isAuthenticated) return null;

  return (
    <motion.aside
      initial={false}
      animate={isOpen ? 'open' : 'closed'}
      variants={sidebarVariants}
      className="sidebar"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="sidebar-content">
        <div className="sidebar-header">
          <img 
            src="/logo.svg" 
            alt="Provocative Cloud" 
            className="sidebar-logo"
          />
          {isOpen && <h1>Provocative Cloud</h1>}
        </div>

        <nav className="sidebar-nav">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => 
                `nav-item ${isActive ? 'active' : ''} ${!isOpen ? 'collapsed' : ''}`
              }
              title={!isOpen ? item.label : undefined}
            >
              <span className="nav-icon">{item.icon}</span>
              {isOpen && (
                <span className="nav-label">{item.label}</span>
              )}
              {isOpen && item.badge && (
                <span className="nav-badge">{item.badge}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {isMobile && isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={onClose}
          aria-label="Close sidebar"
        />
      )}
    </motion.aside>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;