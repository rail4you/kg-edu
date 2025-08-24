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
import { School, Book, Grade } from '@mui/icons-material';

function StudentDashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'success.main',
          color: 'white',
          py: 3,
          boxShadow: 1,
        }}
      >
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={2}>
              <School fontSize="large" />
              <Box>
                <Typography variant="h4" component="h1">
                  Student Dashboard
                </Typography>
                <Typography variant="body1">
                  Welcome, Student
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
          {/* My Courses */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Book color="success" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    My Courses
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  View all courses you are enrolled in.
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  onClick={() => router.push('/student/courses')}
                >
                  View My Courses
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Grades */}
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Grade color="success" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    My Grades
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  View your grades and progress.
                </Typography>
                <Button
                  variant="contained"
                  color="success"
                  fullWidth
                  disabled
                >
                  Coming Soon
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default function StudentDashboard() {
  return (
    <ProtectedRoute allowedRoles={['user', 'student']}>
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}