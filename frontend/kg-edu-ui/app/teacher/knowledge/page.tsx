'use client';

import React, { useState } from 'react';
import { useAuth } from '@/src/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/src/components/auth/protected-route';
import { usePermissions } from '@/src/hooks/use-permissions';
import { PermissionGuard } from '@/src/components/auth/permission-route';
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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  Link as LinkIcon,
  Description as DescriptionIcon,
  Title as TitleIcon,
} from '@mui/icons-material';
import { 
  getApiJsonKnowledgeResources, 
  postApiJsonKnowledgeResources, 
  patchApiJsonKnowledgeResourcesById, 
  deleteApiJsonKnowledgeResourcesById 
} from '@/src/lib/api/sdk.gen';

interface KnowledgeResource {
  id: string;
  attributes: {
    name: string;
    description: string | null;
    course_id: string;
    created_by_id: string | null;
    created_at: string;
    updated_at: string;
  };
}

interface CreateResourceData {
  name: string;
  description: string;
  course_id: string;
}

function KnowledgeResourcesContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { canCreateKnowledgeResources, canEditKnowledgeResources, canDeleteKnowledgeResources } = usePermissions();
  const [resources, setResources] = useState<KnowledgeResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingResource, setEditingResource] = useState<KnowledgeResource | null>(null);
  const [formData, setFormData] = useState<CreateResourceData>({
    name: '',
    description: '',
    course_id: '',
  });

  React.useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await getApiJsonKnowledgeResources();
      
      if (response.data?.data) {
        // Transform API response to our KnowledgeResource interface
        const apiResources = response.data.data.map((resource: any) => ({
          id: resource.id,
          attributes: {
            name: resource.attributes.name,
            description: resource.attributes.description || '',
            course_id: resource.attributes.course_id,
            created_by_id: resource.attributes.created_by_id,
            created_at: resource.attributes.created_at,
            updated_at: resource.attributes.updated_at,
          },
        }));
        setResources(apiResources);
      }
    } catch (err) {
      setError('Failed to fetch knowledge resources. Please try again.');
      console.error('Error fetching resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (resource?: KnowledgeResource) => {
    if (resource) {
      setEditingResource(resource);
      setFormData({
        name: resource.attributes.name,
        description: resource.attributes.description || '',
        course_id: resource.attributes.course_id,
      });
    } else {
      setEditingResource(null);
      setFormData({
        name: '',
        description: '',
        course_id: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingResource(null);
    setError(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
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
      if (!formData.name.trim()) {
        setError('Resource name is required');
        return;
      }

      if (!formData.course_id) {
        setError('Course selection is required');
        return;
      }

      if (editingResource) {
        // Update resource
        const updateData = {
          data: {
            id: editingResource.id,
            type: 'knowledge_resource',
            attributes: {
              name: formData.name,
              description: formData.description || null,
              course_id: formData.course_id,
            },
          },
        };
        
        const response = await patchApiJsonKnowledgeResourcesById({
          params: {
            id: editingResource.id,
          },
          body: updateData,
        });

        if (response.data?.data) {
          // Update the resource in the list
          const updatedResources = resources.map(r =>
            r.id === editingResource.id
              ? {
                  ...r,
                  attributes: {
                    ...r.attributes,
                    name: formData.name,
                    description: formData.description || null,
                    course_id: formData.course_id,
                    updated_at: new Date().toISOString(),
                  },
                }
              : r
          );
          setResources(updatedResources);
          handleCloseDialog();
        } else {
          setError('Failed to update resource. Please try again.');
        }
      } else {
        // Create new resource
        const createData = {
          data: {
            type: 'knowledge_resource',
            attributes: {
              name: formData.name,
              description: formData.description || null,
              course_id: formData.course_id,
              created_by_id: user.id,
            },
          },
        };

        const response = await postApiJsonKnowledgeResources({
          body: createData,
        });

        if (response.data?.data) {
          // Add the new resource to the list
          const newResource: KnowledgeResource = {
            id: response.data.data.id,
            attributes: {
              name: response.data.data.attributes.name,
              description: response.data.data.attributes.description || '',
              course_id: response.data.data.attributes.course_id,
              created_by_id: response.data.data.attributes.created_by_id,
              created_at: response.data.data.attributes.created_at,
              updated_at: response.data.data.attributes.updated_at,
            },
          };
          setResources([...resources, newResource]);
          handleCloseDialog();
        } else {
          setError('Failed to create resource. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to save resource. Please try again.');
      console.error('Error saving resource:', err);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (window.confirm('Are you sure you want to delete this knowledge resource?')) {
      try {
        const response = await deleteApiJsonKnowledgeResourcesById({
          params: {
            id: resourceId,
          },
        });

        if (response.data) {
          // Remove the resource from the list
          setResources(resources.filter(r => r.id !== resourceId));
        } else {
          setError('Failed to delete resource. Please try again.');
        }
      } catch (err) {
        setError('Failed to delete resource. Please try again.');
        console.error('Error deleting resource:', err);
      }
    }
  };

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
              <IconButton color="inherit" onClick={() => router.push('/teacher')}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" component="h1">
                  Knowledge Resources
                </Typography>
                <Typography variant="body1">
                  Manage knowledge resources and build relationships
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              {canCreateKnowledgeResources && (
                <Button
                  variant="contained"
                  color="inherit"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Add Resource
                </Button>
              )}
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
            title="Knowledge Resources"
            subheader={`Total: ${resources.length} resources`}
          />
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <CircularProgress />
              </Box>
            ) : resources.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  No knowledge resources yet
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Create your first knowledge resource to get started
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Create Your First Resource
                </Button>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Course ID</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resources.map((resource) => (
                      <TableRow key={resource.id}>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <DescriptionIcon color="secondary" fontSize="small" />
                            <Button
                              onClick={() => router.push(`/teacher/knowledge/${resource.id}`)}
                              color="primary"
                              sx={{ textTransform: 'none', justifyContent: 'flex-start', p: 0 }}
                            >
                              <Typography variant="subtitle1" fontWeight="bold">
                                {resource.attributes.name}
                              </Typography>
                            </Button>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {resource.attributes.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={resource.attributes.course_id}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(resource.attributes.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {canEditKnowledgeResources && (
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(resource)}
                              color="primary"
                              title="Edit Resource"
                            >
                              <EditIcon />
                            </IconButton>
                          )}
                          {canDeleteKnowledgeResources && (
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteResource(resource.id)}
                              color="error"
                              title="Delete Resource"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
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

      {/* Resource Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingResource ? 'Edit Knowledge Resource' : 'Add New Knowledge Resource'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Resource Name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  helperText="Enter a descriptive name for the knowledge resource"
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  multiline
                  rows={4}
                  helperText="Optional: Provide a detailed description of the resource"
                />
              </Grid>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Course ID"
                  name="course_id"
                  value={formData.course_id}
                  onChange={handleInputChange}
                  required
                  helperText="Enter the course ID this resource belongs to"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingResource ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default function KnowledgeResources() {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <KnowledgeResourcesContent />
    </ProtectedRoute>
  );
}