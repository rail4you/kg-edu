'use client';

import React from 'react';
import { LoginForm } from '../src/components/auth/login-form';
import { RegisterForm } from '../src/components/auth/register-form';
import { useAuth } from '../src/contexts/auth-context';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardMedia,
} from '@mui/material';

export default function Home() {
  const { user, loading, logout } = useAuth();
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

  if (user) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={1}>
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              KgEdu
            </Typography>
            <Typography variant="body1" sx={{ mr: 2 }}>
              Welcome, {user.attributes?.email}
            </Typography>
            <Button color="inherit" onClick={logout}>
              Sign out
            </Button>
          </Toolbar>
        </AppBar>
        
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box
            sx={{
              p: 4,
              textAlign: 'center',
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 1,
            }}
          >
            <Typography variant="h4" component="h2" gutterBottom>
              Welcome to KgEdu
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              You are successfully signed in! This is your dashboard.
            </Typography>
            
            <Grid container spacing={3} sx={{ mt: 4 }}>
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardMedia
                    component="div"
                    sx={{
                      height: 140,
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h3" color="white">
                      📊
                    </Typography>
                  </CardMedia>
                  <CardContent>
                    <Typography variant="h6" component="h3" gutterBottom>
                      Knowledge Graphs
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Manage your educational knowledge graphs
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardMedia
                    component="div"
                    sx={{
                      height: 140,
                      bgcolor: 'secondary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h3" color="white">
                      🎯
                    </Typography>
                  </CardMedia>
                  <CardContent>
                    <Typography variant="h6" component="h3" gutterBottom>
                      Learning Paths
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Create and follow personalized learning paths
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card sx={{ height: '100%' }}>
                  <CardMedia
                    component="div"
                    sx={{
                      height: 140,
                      bgcolor: 'success.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography variant="h3" color="white">
                      📈
                    </Typography>
                  </CardMedia>
                  <CardContent>
                    <Typography variant="h6" component="h3" gutterBottom>
                      Progress Tracking
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Monitor your learning progress and achievements
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Container>
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