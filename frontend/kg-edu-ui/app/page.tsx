'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '../src/components/auth/login-form';
import { RegisterForm } from '../src/components/auth/register-form';
import { useAuth } from '../src/contexts/auth-context';
import {
  Box,
  CircularProgress,
  Typography,
} from '@mui/material';

export default function Home() {
  const { user, loading, userRole } = useAuth();
  const router = useRouter();
  const [isLoginMode, setIsLoginMode] = React.useState(true);

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
        <Box textAlign="center">
          <CircularProgress size={48} />
          <Typography sx={{ mt: 2 }}>Loading...</Typography>
        </Box>
      </Box>
    );
  }

  React.useEffect(() => {
    if (user && userRole) {
      // Redirect based on user role with backward compatibility
      switch (userRole) {
        case 'admin':
          router.push('/admin');
          break;
        case 'teacher':
          router.push('/teacher');
          break;
        case 'student':
          router.push('/student');
          break;
        case 'user':
          router.push('/student'); // Treat 'user' as 'student' for backward compatibility
          break;
        default:
          // Fallback to student dashboard
          router.push('/student');
      }
    }
  }, [user, userRole, router]);

  if (user) {
    // Show loading state while redirecting
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <Box textAlign="center">
          <CircularProgress size={48} />
          <Typography sx={{ mt: 2 }}>Redirecting to your dashboard...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      {isLoginMode ? (
        <LoginForm
          onSuccess={() => {
            // The auth context will handle the state update
          }}
          onSwitchToRegister={() => setIsLoginMode(false)}
        />
      ) : (
        <RegisterForm
          onSuccess={() => {
            // The auth context will handle the state update
          }}
          onSwitchToLogin={() => setIsLoginMode(true)}
        />
      )}
    </Box>
  );
}