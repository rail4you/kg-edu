'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/auth-context';
import {
  Box,
  CircularProgress,
  Typography,
  Alert,
} from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'admin' | 'teacher' | 'user'>;
  redirectTo?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles = ['admin', 'teacher', 'user'],
  redirectTo = '/',
}) => {
  const { user, loading, userRole } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      // Redirect to home if not authenticated
      router.push('/');
    } else if (!loading && user && userRole && !allowedRoles.includes(userRole)) {
      // Redirect if user doesn't have required role
      router.push(redirectTo);
    }
  }, [user, loading, userRole, allowedRoles, redirectTo, router]);

  if (loading) {
    return (
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
    return (
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

  if (userRole && !allowedRoles.includes(userRole)) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Alert severity="error">You don't have permission to access this page.</Alert>
      </Box>
    );
  }

  return <>{children}</>;
};