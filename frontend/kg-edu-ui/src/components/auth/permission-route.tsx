'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/auth-context';
import { usePermissions } from '@/src/hooks/use-permissions';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
  Card,
  CardContent,
} from '@mui/material';

interface PermissionRouteProps {
  children: React.ReactNode;
  permissions?: string[];
  roles?: Array<'admin' | 'teacher' | 'student' | 'user'>;
  requireAll?: boolean; // If true, requires all permissions, otherwise any
  redirectTo?: string;
  loadingComponent?: React.ReactNode;
  fallbackComponent?: React.ReactNode;
}

/**
 * Enhanced ProtectedRoute component with permission-based access control
 */
export const PermissionRoute: React.FC<PermissionRouteProps> = ({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  redirectTo = '/',
  loadingComponent,
  fallbackComponent,
}) => {
  const { user, loading } = useAuth();
  const { canAny, canAll, hasAnyRole } = usePermissions();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      // Redirect to home if not authenticated
      router.push('/');
    } else if (!loading && user) {
      // Check role-based access
      const hasRoleAccess = roles.length === 0 || hasAnyRole(roles);
      
      // Check permission-based access
      const hasPermissionAccess = permissions.length === 0 || 
        (requireAll ? canAll(permissions as any) : canAny(permissions as any));
      
      if (!hasRoleAccess || !hasPermissionAccess) {
        router.push(redirectTo);
      }
    }
  }, [user, loading, permissions, roles, requireAll, redirectTo, router, canAny, canAll, hasAnyRole]);

  if (loading) {
    return loadingComponent || (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return fallbackComponent || (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Alert severity="error">Please sign in to access this page.</Alert>
      </Box>
    );
  }

  // Check permissions
  const hasRoleAccess = roles.length === 0 || hasAnyRole(roles);
  const hasPermissionAccess = permissions.length === 0 || 
    (requireAll ? canAll(permissions as any) : canAny(permissions as any));

  if (!hasRoleAccess || !hasPermissionAccess) {
    return fallbackComponent || (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Card sx={{ maxWidth: 500 }}>
          <CardContent>
            <Alert severity="error">
              <Typography variant="h6" gutterBottom>
                Access Denied
              </Typography>
              <Typography variant="body2">
                You don't have the required permissions to access this page.
              </Typography>
              {permissions.length > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Required permissions: {permissions.join(', ')}
                </Typography>
              )}
              {roles.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Required roles: {roles.join(', ')}
                </Typography>
              )}
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return <>{children}</>;
};

/**
 * Higher-order component for permission-based protection
 */
export function withPermission<T>(
  Component: React.ComponentType<T>,
  options: Omit<PermissionRouteProps, 'children'>
) {
  return function ProtectedComponent(props: T) {
    return (
      <PermissionRoute {...options}>
        <Component {...props} />
      </PermissionRoute>
    );
  };
}

/**
 * Component for conditionally rendering content based on permissions
 */
interface PermissionGuardProps {
  children: React.ReactNode;
  permissions?: string[];
  roles?: Array<'admin' | 'teacher' | 'student' | 'user'>;
  requireAll?: boolean;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permissions = [],
  roles = [],
  requireAll = false,
  fallback = null,
}) => {
  const { canAny, canAll, hasAnyRole } = usePermissions();

  const hasRoleAccess = roles.length === 0 || hasAnyRole(roles);
  const hasPermissionAccess = permissions.length === 0 || 
    (requireAll ? canAll(permissions as any) : canAny(permissions as any));

  if (!hasRoleAccess || !hasPermissionAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};