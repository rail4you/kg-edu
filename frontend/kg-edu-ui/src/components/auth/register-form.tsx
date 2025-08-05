'use client';

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../contexts/auth-context';
import { apiClient } from '../../lib/auth/client';
import { postApiJsonUsersRegister } from '../../lib/api/sdk.gen';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Link,
} from '@mui/material';

const registerSchema = z.object({
  studentId: z.string().min(1, 'Please enter your student ID'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  passwordConfirmation: z.string().min(8, 'Password confirmation is required'),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: "Passwords don't match",
  path: ["passwordConfirmation"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

interface RegisterFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await postApiJsonUsersRegister({
        client: apiClient,
        body: {
          data: {
            type: 'user',
            attributes: {
              student_id: data.studentId,
              password: data.password,
              password_confirmation: data.passwordConfirmation,
            },
          }
        },
      });
      console.log(response)
      console.log(response.data?.metadata?.token)

      if (response.data?.meta?.token) {
        await login(response.data.meta.token);
        onSuccess?.();
      } else {
        setError('Registration failed. Please try again.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Typography component="h1" variant="h4" gutterBottom>
          KgEdu
        </Typography>
        <Typography component="h2" variant="h5" gutterBottom>
          Create your account
        </Typography>
        
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 3, width: '100%' }}>
          <Controller
            name="studentId"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                id="studentId"
                label="Student ID"
                autoComplete="student-id"
                autoFocus
                error={!!errors.studentId}
                helperText={errors.studentId?.message}
                disabled={isLoading}
              />
            )}
          />
          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
                error={!!errors.password}
                helperText={errors.password?.message}
                disabled={isLoading}
              />
            )}
          />
          <Controller
            name="passwordConfirmation"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                margin="normal"
                required
                fullWidth
                name="passwordConfirmation"
                label="Confirm Password"
                type="password"
                id="passwordConfirmation"
                autoComplete="new-password"
                error={!!errors.passwordConfirmation}
                helperText={errors.passwordConfirmation?.message}
                disabled={isLoading}
              />
            )}
          />
          
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
          </Button>
          
          {onSwitchToLogin && (
            <Box textAlign="center">
              <Link
                component="button"
                variant="body2"
                onClick={onSwitchToLogin}
                type="button"
              >
                Already have an account? Sign in
              </Link>
            </Box>
          )}
        </Box>
      </Box>
    </Container>
  );
};