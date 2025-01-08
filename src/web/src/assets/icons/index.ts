/**
 * @fileoverview Central icon management system for the Provocative Cloud Platform
 * Provides organized access to Material-UI icons with proper TypeScript typing
 * @version 1.0.0
 */

// Navigation and dashboard icons
import {
  Dashboard as DashboardIcon,
  Memory as GpuIcon,
  CalendarToday as CalendarIcon,
  Payment as PaymentIcon,
  AdminPanelSettings as AdminPanelIcon,
  Storage as ServerIcon,
  Group as GroupIcon,
  Analytics as AnalyticsIcon,
} from '@mui/icons-material'; // ^5.0.0

// Theme and control icons
import {
  Menu as MenuIcon,
  DarkMode,
  LightMode,
  AccountCircle,
} from '@mui/icons-material'; // ^5.0.0

// Common action and status icons
import {
  Add,
  Close,
  Delete,
  Edit,
  ExpandMore,
  Favorite,
  Help,
  Info,
  Search,
  Settings,
  Warning,
} from '@mui/icons-material'; // ^5.0.0

/**
 * Common interface for icon components ensuring consistent prop types
 */
export interface IconProps {
  className?: string;
  color?: string;
  fontSize?: string;
  onClick?: () => void;
  titleAccess?: string;
  'aria-label'?: string;
}

/**
 * Navigation icons used for main application sections
 */
export const NavigationIcons = {
  DashboardIcon,
  GpuIcon,
  CalendarIcon,
  PaymentIcon,
  AdminPanelIcon,
  ServerIcon,
  GroupIcon,
  AnalyticsIcon,
} as const;

/**
 * Theme and user-related control icons
 */
export const ThemeIcons = {
  MenuIcon,
  DarkMode,
  LightMode,
  AccountCircle,
} as const;

/**
 * Common action and status icons used throughout the application
 */
export const CommonIcons = {
  Add,
  Close,
  Delete,
  Edit,
  ExpandMore,
  Favorite,
  Help,
  Info,
  Search,
  Settings,
  Warning,
} as const;

// Type exports for icon groups
export type NavigationIconType = keyof typeof NavigationIcons;
export type ThemeIconType = keyof typeof ThemeIcons;
export type CommonIconType = keyof typeof CommonIcons;

// Re-export all icons individually for direct access
export {
  DashboardIcon,
  GpuIcon,
  CalendarIcon,
  PaymentIcon,
  AdminPanelIcon,
  ServerIcon,
  GroupIcon,
  AnalyticsIcon,
  MenuIcon,
  DarkMode,
  LightMode,
  AccountCircle,
  Add,
  Close,
  Delete,
  Edit,
  ExpandMore,
  Favorite,
  Help,
  Info,
  Search,
  Settings,
  Warning,
};