'use client';

import React from 'react';
import { useAuth } from '@/src/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/src/components/auth/protected-route';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { AdminPanelSettings, School, Person } from '@mui/icons-material';

function AdminDashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          py: 3,
          boxShadow: 1,
        }}
      >
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <AdminPanelSettings fontSize="large" />
              <Box>
                <Typography variant="h4" component="h1">
                  Admin Dashboard
                </Typography>
                <Typography variant="body1">
                  Welcome, Admin
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => router.push('/')}
              >
                Back to Home
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={logout}
              >
                Sign Out
              </Button>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Grid container spacing={3}>
          {/* User Management */}
          {/* <Grid item xs={12} md={6}> */}
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Person color="primary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    User Management
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Manage all users in the system. Create, edit, and delete user accounts.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={() => router.push('/admin/users')}
                >
                  Manage Users
                </Button>
              </CardContent>
            </Card>
          {/* </Grid> */}

          {/* System Overview */}
          {/* <Grid item xs={12} md={6}> */}
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <School color="primary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    System Overview
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  View system statistics and manage platform settings.
                </Typography>
                <Button
                  variant="contained"
                  fullWidth
                  disabled
                >
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </Grid>
        {/* </Grid> */}
      </Container>
    </Box>
  );
}

export default function AdminDashboard() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}