'use client';

import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '../../../src/components/auth/protected-route';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { 
  getApiJsonUsers, 
  postApiJsonUsersRegister, 
  patchApiJsonUsersById, 
  deleteApiJsonUsersById 
} from '@/src/lib/api/sdk.gen';

interface User {
  id: string;
  attributes: {
    student_id: string;
    email: string;
    role: 'admin' | 'user' | 'teacher';
    created_at: string;
    updated_at: string;
  };
}

interface CreateUserData {
  student_id: string;
  email: string;
  role: 'admin' | 'user' | 'teacher';
  password: string;
}

function UserManagementContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<CreateUserData>({
    student_id: '',
    email: '',
    role: 'user',
    password: '',
  });

  React.useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getApiJsonUsers({});
        if (response.data?.data) {
          // Transform API response to our User interface
          const apiUsers = response.data.data.map((user: any) => ({
            id: user.id,
            attributes: {
              student_id: user.attributes.student_id,
              email: user.attributes.email || '',
              role: user.attributes.role,
              created_at: user.attributes.created_at,
              updated_at: user.attributes.updated_at,
            },
          }));
          setUsers(apiUsers);
        }
      } catch (err) {
        setError('Failed to fetch users. Please try again.');
        console.error('Error fetching users:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        student_id: user.attributes.student_id,
        email: user.attributes.email,
        role: user.attributes.role,
        password: '',
      });
    } else {
      setEditingUser(null);
      setFormData({
        student_id: '',
        email: '',
        role: 'user',
        password: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingUser(null);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    if (name) {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate form
      if (!formData.student_id.trim()) {
        setError('Student ID is required');
        return;
      }
      if (!formData.email.trim()) {
        setError('Email is required');
        return;
      }
      if (!editingUser && !formData.password.trim()) {
        setError('Password is required for new users');
        return;
      }

      if (editingUser) {
        // Update user
        const updateData = {
          data: {
            id: editingUser.id,
            type: 'user',
            attributes: {
              student_id: formData.student_id,
              email: formData.email,
              role: formData.role,
            },
          },
        };
        
        const response = await patchApiJsonUsersById({
          params: {
            id: editingUser.id,
          },
          body: updateData,
        });

        if (response.data?.data) {
          // Update the user in the list
          const updatedUsers = users.map(u =>
            u.id === editingUser.id
              ? {
                  ...u,
                  attributes: {
                    ...u.attributes,
                    student_id: formData.student_id,
                    email: formData.email,
                    role: formData.role,
                    updated_at: new Date().toISOString(),
                  },
                }
              : u
          );
          setUsers(updatedUsers);
          handleCloseDialog();
        } else {
          setError('Failed to update user. Please try again.');
        }
      } else {
        // Create new user
        const createData = {
          data: {
            type: 'user',
            attributes: {
              student_id: formData.student_id,
              email: formData.email,
              role: formData.role,
              password: formData.password,
              password_confirmation: formData.password,
            },
          },
        };

        const response = await postApiJsonUsersRegister({
          body: createData,
        });

        if (response.data?.data) {
          // Add the new user to the list
          const newUser: User = {
            id: response.data.data.id,
            attributes: {
              student_id: response.data.data.attributes.student_id,
              email: response.data.data.attributes.email || '',
              role: response.data.data.attributes.role,
              created_at: response.data.data.attributes.created_at,
              updated_at: response.data.data.attributes.updated_at,
            },
          };
          setUsers([...users, newUser]);
          handleCloseDialog();
        } else {
          setError('Failed to create user. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to save user. Please try again.');
      console.error('Error saving user:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await deleteApiJsonUsersById({
          path: {
            id: userId,
          },
        });

        if (response.data) {
          // Remove the user from the list
          setUsers(users.filter(u => u.id !== userId));
        } else {
          setError('Failed to delete user. Please try again.');
        }
      } catch (err) {
        setError('Failed to delete user. Please try again.');
        console.error('Error deleting user:', err);
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'error';
      case 'teacher':
        return 'secondary';
      case 'user':
        return 'primary';
      default:
        return 'default';
    }
  };

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
              <IconButton color="inherit" onClick={() => router.push('/admin')}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" component="h1">
                  User Management
                </Typography>
                <Typography variant="body1">
                  Manage all users in the system
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<AddIcon />}
                onClick={() => handleOpenDialog()}
              >
                Add User
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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Card>
          <CardHeader
            title="All Users"
            subheader={`Total: ${users.length} users`}
          />
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Student ID</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.attributes.student_id}</TableCell>
                        <TableCell>{user.attributes.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={user.attributes.role}
                            color={getRoleColor(user.attributes.role) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(user.attributes.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(user)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteUser(user.id)}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Container>

      {/* User Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Add New User'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Student ID"
                  name="student_id"
                  value={formData.student_id}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid xs={12}>
                <FormControl fullWidth required>
                  <InputLabel>Role</InputLabel>
                  <Select
                    name="role"
                    value={formData.role}
                    onChange={handleSelectChange}
                    label="Role"
                  >
                    <MenuItem value="user">Student</MenuItem>
                    <MenuItem value="teacher">Teacher</MenuItem>
                    <MenuItem value="admin">Admin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label={editingUser ? "New Password (leave blank to keep current)" : "Password"}
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!editingUser}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingUser ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default function UserManagement() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <UserManagementContent />
    </ProtectedRoute>
  );
}