'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/src/components/auth/protected-route';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Chip,
  Divider,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Link as LinkIcon,
  Description as DescriptionIcon,
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
} from '@mui/icons-material';
import { 
  getApiJsonKnowledgeResources, 
  patchApiJsonKnowledgeResourcesById, 
  deleteApiJsonKnowledgeResourcesById,
  getApiJsonKnowledgeRelations,
  postApiJsonKnowledgeRelations,
  deleteApiJsonKnowledgeRelationsById
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

interface KnowledgeRelation {
  id: string;
  attributes: {
    source_id: string;
    target_id: string;
    relation_type: string;
    description: string | null;
    created_at: string;
  };
}

function KnowledgeResourceDetailContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const resourceId = params.id as string;
  
  const [resource, setResource] = useState<KnowledgeResource | null>(null);
  const [relations, setRelations] = useState<KnowledgeRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
  });
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [newRelation, setNewRelation] = useState({
    target_id: '',
    relation_type: 'related_to',
    description: '',
  });

  useEffect(() => {
    if (resourceId) {
      fetchResourceDetail();
      fetchResourceRelations();
    }
  }, [resourceId]);

  const fetchResourceDetail = async () => {
    try {
      const response = await getApiJsonKnowledgeResources();
      
      if (response.data?.data) {
        const foundResource = response.data.data.find((r: any) => r.id === resourceId);
        if (foundResource) {
          const resourceData: KnowledgeResource = {
            id: foundResource.id,
            attributes: {
              name: foundResource.attributes.name,
              description: foundResource.attributes.description || '',
              course_id: foundResource.attributes.course_id,
              created_by_id: foundResource.attributes.created_by_id,
              created_at: foundResource.attributes.created_at,
              updated_at: foundResource.attributes.updated_at,
            },
          };
          setResource(resourceData);
          setEditForm({
            name: resourceData.attributes.name,
            description: resourceData.attributes.description || '',
          });
        } else {
          setError('Resource not found');
        }
      }
    } catch (err) {
      setError('Failed to fetch resource details. Please try again.');
      console.error('Error fetching resource:', err);
    }
  };

  const fetchResourceRelations = async () => {
    try {
      const response = await getApiJsonKnowledgeRelations();
      
      if (response.data?.data) {
        // Filter relations where this resource is either source or target
        const resourceRelations = response.data.data
          .filter((relation: any) => 
            relation.attributes.source_id === resourceId || 
            relation.attributes.target_id === resourceId
          )
          .map((relation: any) => ({
            id: relation.id,
            attributes: {
              source_id: relation.attributes.source_id,
              target_id: relation.attributes.target_id,
              relation_type: relation.attributes.relation_type,
              description: relation.attributes.description || '',
              created_at: relation.attributes.created_at,
            },
          }));
        setRelations(resourceRelations);
      }
    } catch (err) {
      console.error('Error fetching relations:', err);
    }
  };

  const handleUpdateResource = async () => {
    if (!resource) return;

    try {
      const updateData = {
        data: {
          id: resource.id,
          type: 'knowledge_resource',
          attributes: {
            name: editForm.name,
            description: editForm.description || null,
          },
        },
      };
      
      const response = await patchApiJsonKnowledgeResourcesById({
        params: {
          id: resource.id,
        },
        body: updateData,
      });

      if (response.data?.data) {
        setResource({
          ...resource,
          attributes: {
            ...resource.attributes,
            name: editForm.name,
            description: editForm.description || null,
            updated_at: new Date().toISOString(),
          },
        });
        setEditMode(false);
      } else {
        setError('Failed to update resource. Please try again.');
      }
    } catch (err) {
      setError('Failed to update resource. Please try again.');
      console.error('Error updating resource:', err);
    }
  };

  const handleDeleteResource = async () => {
    if (!resource) return;

    if (window.confirm('Are you sure you want to delete this knowledge resource? This action cannot be undone.')) {
      try {
        const response = await deleteApiJsonKnowledgeResourcesById({
          params: {
            id: resource.id,
          },
        });

        if (response.data) {
          router.push('/teacher/knowledge');
        } else {
          setError('Failed to delete resource. Please try again.');
        }
      } catch (err) {
        setError('Failed to delete resource. Please try again.');
        console.error('Error deleting resource:', err);
      }
    }
  };

  const handleAddRelation = async () => {
    if (!resource) return;

    try {
      const createData = {
        data: {
          type: 'knowledge_relation',
          attributes: {
            source_id: resource.id,
            target_id: newRelation.target_id,
            relation_type: newRelation.relation_type,
            description: newRelation.description || null,
          },
        },
      };

      const response = await postApiJsonKnowledgeRelations({
        body: createData,
      });

      if (response.data?.data) {
        // Refresh relations
        await fetchResourceRelations();
        setRelationDialogOpen(false);
        setNewRelation({
          target_id: '',
          relation_type: 'related_to',
          description: '',
        });
      } else {
        setError('Failed to create relation. Please try again.');
      }
    } catch (err) {
      setError('Failed to create relation. Please try again.');
      console.error('Error creating relation:', err);
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (window.confirm('Are you sure you want to delete this relation?')) {
      try {
        const response = await deleteApiJsonKnowledgeRelationsById({
          params: {
            id: relationId,
          },
        });

        if (response.data) {
          setRelations(relations.filter(r => r.id !== relationId));
        } else {
          setError('Failed to delete relation. Please try again.');
        }
      } catch (err) {
        setError('Failed to delete relation. Please try again.');
        console.error('Error deleting relation:', err);
      }
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
        </Container>
      </Box>
    );
  }

  if (error && !resource) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ mt: 4 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => router.push('/teacher/knowledge')}
          >
            Back to Knowledge Resources
          </Button>
        </Container>
      </Box>
    );
  }

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
              <IconButton color="inherit" onClick={() => router.push('/teacher/knowledge')}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" component="h1">
                  Knowledge Resource Details
                </Typography>
                <Typography variant="body1">
                  View and manage resource information and relationships
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => router.push('/teacher/knowledge')}
              >
                Back to List
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

        {resource && (
          <Grid container spacing={3}>
            {/* Resource Information */}
            <Grid item xs={12} md={8}>
              <Card>
                <CardHeader
                  title={
                    <Box display="flex" alignItems="center" gap={2}>
                      <DescriptionIcon color="secondary" />
                      <Typography variant="h5">Resource Information</Typography>
                      <IconButton
                        size="small"
                        onClick={() => setEditMode(!editMode)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                  }
                  action={
                    <IconButton
                      color="error"
                      onClick={handleDeleteResource}
                      title="Delete Resource"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                />
                <CardContent>
                  {editMode ? (
                    <Box component="form" onSubmit={(e) => { e.preventDefault(); handleUpdateResource(); }}>
                      <Grid container spacing={2}>
                        <Grid xs={12}>
                          <TextField
                            fullWidth
                            label="Resource Name"
                            value={editForm.name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                            required
                          />
                        </Grid>
                        <Grid xs={12}>
                          <TextField
                            fullWidth
                            label="Description"
                            value={editForm.description}
                            onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                            multiline
                            rows={4}
                          />
                        </Grid>
                        <Grid xs={12}>
                          <Box display="flex" gap={2}>
                            <Button type="submit" variant="contained">
                              Save Changes
                            </Button>
                            <Button variant="outlined" onClick={() => setEditMode(false)}>
                              Cancel
                            </Button>
                          </Box>
                        </Grid>
                      </Grid>
                    </Box>
                  ) : (
                    <Grid container spacing={2}>
                      <Grid xs={12}>
                        <Typography variant="h6" gutterBottom>
                          {resource.attributes.name}
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                          {resource.attributes.description || 'No description provided'}
                        </Typography>
                      </Grid>
                      <Grid xs={12} sm={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <CalendarIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            Created: {new Date(resource.attributes.created_at).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid xs={12} sm={6}>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonIcon color="action" fontSize="small" />
                          <Typography variant="body2">
                            Course ID: {resource.attributes.course_id}
                          </Typography>
                        </Box>
                      </Grid>
                    </Grid>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Quick Actions */}
            <Grid item xs={12} md={4}>
              <Card>
                <CardHeader title="Quick Actions" />
                <CardContent>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<LinkIcon />}
                      onClick={() => setRelationDialogOpen(true)}
                    >
                      Add Relation
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => setEditMode(true)}
                    >
                      Edit Resource
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Relations */}
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title={
                    <Box display="flex" alignItems="center" gap={2}>
                      <LinkIcon color="secondary" />
                      <Typography variant="h5">Resource Relations</Typography>
                      <Chip
                        label={relations.length}
                        size="small"
                        color="primary"
                      />
                    </Box>
                  }
                />
                <CardContent>
                  {relations.length === 0 ? (
                    <Box textAlign="center" py={4}>
                      <Typography variant="h6" color="text.secondary">
                        No relations found
                      </Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>
                        This resource is not connected to any other resources yet
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<LinkIcon />}
                        onClick={() => setRelationDialogOpen(true)}
                      >
                        Add First Relation
                      </Button>
                    </Box>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Related Resource</TableCell>
                            <TableCell>Relation Type</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Created</TableCell>
                            <TableCell>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {relations.map((relation) => {
                            const isSource = relation.attributes.source_id === resourceId;
                            const relatedResourceId = isSource ? relation.attributes.target_id : relation.attributes.source_id;
                            
                            return (
                              <TableRow key={relation.id}>
                                <TableCell>
                                  <Chip
                                    label={relatedResourceId}
                                    size="small"
                                    color={isSource ? "primary" : "secondary"}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">
                                    {isSource ? '→' : '←'} {relation.attributes.relation_type}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {relation.attributes.description || 'No description'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {new Date(relation.attributes.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleDeleteRelation(relation.id)}
                                    color="error"
                                    title="Delete Relation"
                                  >
                                    <DeleteIcon />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </Container>

      {/* Add Relation Dialog */}
      <Dialog open={relationDialogOpen} onClose={() => setRelationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Relation</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Target Resource ID"
                value={newRelation.target_id}
                onChange={(e) => setNewRelation(prev => ({ ...prev, target_id: e.target.value }))}
                required
                helperText="Enter the ID of the resource to relate to"
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Relation Type"
                value={newRelation.relation_type}
                onChange={(e) => setNewRelation(prev => ({ ...prev, relation_type: e.target.value }))}
                required
                helperText="e.g., related_to, depends_on, prerequisite_for"
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newRelation.description}
                onChange={(e) => setNewRelation(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={3}
                helperText="Optional: Describe the relationship"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRelationDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleAddRelation} variant="contained">
            Add Relation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default function KnowledgeResourceDetail() {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <KnowledgeResourceDetailContent />
    </ProtectedRoute>
  );
}