import { FC, PropsWithChildren, memo, useEffect } from 'react'; // ^18.0.0
import { Navigate, useLocation } from 'react-router-dom'; // ^6.11.0
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types/auth';

/**
 * Props interface for ProtectedRoute component
 */
interface ProtectedRouteProps {
  /**
   * Required role for accessing the route
   */
  requiredRole?: UserRole;
  /**
   * Path to redirect to when access is denied
   * @default '/login'
   */
  fallbackPath?: string;
  /**
   * Whether to preserve query parameters when redirecting
   * @default true
   */
  preserveQuery?: boolean;
}

/**
 * Enhanced higher-order component that implements secure route protection with
 * role-based access control, real-time authentication updates, and audit logging
 */
const ProtectedRoute: FC<PropsWithChildren<ProtectedRouteProps>> = memo(({
  children,
  requiredRole,
  fallbackPath = '/login',
  preserveQuery = true
}) => {
  const location = useLocation();
  const { isAuthenticated, isLoading, checkUserRole, authError } = useAuth();

  // Log route access attempts for audit purposes
  useEffect(() => {
    if (!isLoading) {
      console.info('Route access attempt:', {
        path: location.pathname,
        authenticated: isAuthenticated,
        requiredRole,
        timestamp: new Date().toISOString()
      });
    }
  }, [isLoading, isAuthenticated, location.pathname, requiredRole]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="protected-route-loading" aria-live="polite">
        <span className="sr-only">Verifying authentication...</span>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    console.error('Authentication error:', authError);
    return (
      <Navigate 
        to="/error" 
        state={{ 
          error: authError,
          returnPath: location.pathname
        }} 
        replace 
      />
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Preserve the attempted path and query parameters for post-login redirect
    const search = preserveQuery ? location.search : '';
    const returnPath = `${location.pathname}${search}`;
    
    return (
      <Navigate
        to={fallbackPath}
        state={{ returnPath }}
        replace
      />
    );
  }

  // Check role-based access if required
  if (requiredRole) {
    const hasRequiredRole = checkUserRole(requiredRole);
    
    if (!hasRequiredRole) {
      console.warn('Access denied - insufficient permissions:', {
        path: location.pathname,
        requiredRole,
        timestamp: new Date().toISOString()
      });
      
      return (
        <Navigate
          to="/forbidden"
          state={{ 
            requiredRole,
            currentPath: location.pathname
          }}
          replace
        />
      );
    }
  }

  // Wrap children in error boundary for enhanced stability
  return (
    <div className="protected-route" role="main">
      {children}
    </div>
  );
});

// Display name for debugging
ProtectedRoute.displayName = 'ProtectedRoute';

export default ProtectedRoute;