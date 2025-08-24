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
import { School, People, Assignment } from '@mui/icons-material';

function TeacherDashboardContent() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: 'secondary.main',
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
                  Teacher Dashboard
                </Typography>
                <Typography variant="body1">
                  Welcome, Teacher
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
          {/* Course Management */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <School color="secondary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    My Courses
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Create and manage your courses.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => router.push('/teacher/courses')}
                >
                  Manage Courses
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Student Management */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <People color="secondary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    Student Management
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Assign students to your courses.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => router.push('/teacher/students')}
                >
                  Manage Students
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Knowledge Resources */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Assignment color="secondary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    Knowledge Resources
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Manage knowledge resources and build relationships.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  fullWidth
                  onClick={() => router.push('/teacher/knowledge')}
                >
                  Manage Resources
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Assignments */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Assignment color="secondary" fontSize="large" />
                  <Typography variant="h5" component="h2">
                    Assignments
                  </Typography>
                </Box>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Create and manage course assignments.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
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

export default function TeacherDashboard() {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <TeacherDashboardContent />
    </ProtectedRoute>
  );
}