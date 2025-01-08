/**
 * Central route configuration for Provocative Cloud platform frontend
 * Defines all application routes, access controls, layouts, and security policies
 * @version 1.0.0
 */

import { lazy } from 'react'; // ^18.0.0
import { UserRole } from '../types/auth';

// Global configuration constants
export const BASE_PATH = '/';
export const DEFAULT_LAYOUT = 'MainLayout';
export const AUTH_LAYOUT = 'AuthLayout';
export const DASHBOARD_LAYOUT = 'DashboardLayout';
export const ADMIN_LAYOUT = 'AdminLayout';

/**
 * Interface defining the structure of route configurations
 */
export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<any>;
  roles?: UserRole[];
  layout: string;
  exact: boolean;
  metadata: {
    title: string;
    description: string;
  };
  errorBoundary?: React.ComponentType<any>;
  loadingFallback?: React.ComponentType<any>;
  transitionAnimation?: string;
}

/**
 * Checks if a route is accessible based on user role and authentication status
 */
export function isRouteAccessible(route: RouteConfig, userRole: UserRole | null): boolean {
  // Public routes are always accessible
  if (!route.roles || route.roles.length === 0) {
    return true;
  }

  // Protected routes require authentication
  if (!userRole) {
    return false;
  }

  // Check if user role matches required roles
  return route.roles.includes(userRole);
}

/**
 * Comprehensive route configurations for the application
 */
export const routes: RouteConfig[] = [
  // Public routes
  {
    path: '/',
    component: lazy(() => import('../pages/home/Index')),
    layout: DEFAULT_LAYOUT,
    exact: true,
    metadata: {
      title: 'Provocative Cloud - GPU Rental Platform',
      description: 'Rent high-performance GPUs with integrated carbon capture technology'
    }
  },
  {
    path: '/login',
    component: lazy(() => import('../pages/auth/Login')),
    layout: AUTH_LAYOUT,
    exact: true,
    metadata: {
      title: 'Login - Provocative Cloud',
      description: 'Secure access to your GPU rental dashboard'
    }
  },
  
  // User routes
  {
    path: '/dashboard',
    component: lazy(() => import('../pages/dashboard/Index')),
    roles: [UserRole.USER, UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'Dashboard - Provocative Cloud',
      description: 'Manage your GPU rentals and monitor usage'
    }
  },
  {
    path: '/rentals',
    component: lazy(() => import('../pages/rentals/Index')),
    roles: [UserRole.USER, UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'GPU Rentals - Provocative Cloud',
      description: 'View and manage your active GPU rentals'
    }
  },
  {
    path: '/rentals/:id',
    component: lazy(() => import('../pages/rentals/Details')),
    roles: [UserRole.USER, UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'Rental Details - Provocative Cloud',
      description: 'Detailed information about your GPU rental'
    }
  },
  
  // Host routes
  {
    path: '/host',
    component: lazy(() => import('../pages/host/Index')),
    roles: [UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'Host Dashboard - Provocative Cloud',
      description: 'Manage your GPU servers and monitor performance'
    }
  },
  {
    path: '/host/servers',
    component: lazy(() => import('../pages/host/Servers')),
    roles: [UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'Server Management - Provocative Cloud',
      description: 'Configure and monitor your GPU servers'
    }
  },
  {
    path: '/host/pricing',
    component: lazy(() => import('../pages/host/Pricing')),
    roles: [UserRole.HOST, UserRole.ADMIN],
    layout: DASHBOARD_LAYOUT,
    exact: true,
    metadata: {
      title: 'Pricing Configuration - Provocative Cloud',
      description: 'Manage GPU rental pricing and policies'
    }
  },
  
  // Admin routes
  {
    path: '/admin',
    component: lazy(() => import('../pages/admin/Index')),
    roles: [UserRole.ADMIN],
    layout: ADMIN_LAYOUT,
    exact: true,
    metadata: {
      title: 'Admin Dashboard - Provocative Cloud',
      description: 'System administration and monitoring'
    }
  },
  {
    path: '/admin/users',
    component: lazy(() => import('../pages/admin/Users')),
    roles: [UserRole.ADMIN],
    layout: ADMIN_LAYOUT,
    exact: true,
    metadata: {
      title: 'User Management - Provocative Cloud',
      description: 'Manage platform users and permissions'
    }
  },
  {
    path: '/admin/analytics',
    component: lazy(() => import('../pages/admin/Analytics')),
    roles: [UserRole.ADMIN],
    layout: ADMIN_LAYOUT,
    exact: true,
    metadata: {
      title: 'Platform Analytics - Provocative Cloud',
      description: 'System-wide analytics and reporting'
    }
  },
  
  // Error routes
  {
    path: '/404',
    component: lazy(() => import('../pages/errors/NotFound')),
    layout: DEFAULT_LAYOUT,
    exact: true,
    metadata: {
      title: '404 Not Found - Provocative Cloud',
      description: 'The requested page could not be found'
    }
  },
  {
    path: '/403',
    component: lazy(() => import('../pages/errors/Forbidden')),
    layout: DEFAULT_LAYOUT,
    exact: true,
    metadata: {
      title: '403 Forbidden - Provocative Cloud',
      description: 'You do not have permission to access this page'
    }
  }
];

export default routes;