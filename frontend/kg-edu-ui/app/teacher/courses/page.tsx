'use client';

import React, { useState } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { 
  getApiJsonCourses, 
  getApiJsonCoursesTeacherByTeacherId,
  postApiJsonCourses, 
  patchApiJsonCoursesById, 
  deleteApiJsonCoursesById 
} from '@/src/lib/api/sdk.gen';

interface Course {
  id: string;
  attributes: {
    title: string;
    description: string | null;
    teacher_id: string;
    created_at: string;
    updated_at: string;
  };
}

interface CreateCourseData {
  title: string;
  description: string;
}

function CourseManagementContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState<CreateCourseData>({
    title: '',
    description: '',
  });

  React.useEffect(() => {
    const fetchCourses = async () => {
      try {
        const response = await getApiJsonCoursesTeacherByTeacherId({
          path: {
            teacher_id: user.id,
          },
        });
        
        if (response.data?.data) {
          // Transform API response to our Course interface
          const apiCourses = response.data.data.map((course: any) => ({
            id: course.id,
            attributes: {
              title: course.attributes.title,
              description: course.attributes.description || '',
              teacher_id: course.attributes.teacher_id,
              created_at: course.attributes.created_at,
              updated_at: course.attributes.updated_at,
            },
          }));
          setCourses(apiCourses);
        }
      } catch (err) {
        setError('Failed to fetch courses. Please try again.');
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCourses();
  }, [user.id]);

  const handleOpenDialog = (course?: Course) => {
    if (course) {
      setEditingCourse(course);
      setFormData({
        title: course.attributes.title,
        description: course.attributes.description || '',
      });
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        description: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingCourse(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate form
      if (!formData.title.trim()) {
        setError('Course title is required');
        return;
      }

      if (editingCourse) {
        // Update course
        const updateData = {
          data: {
            id: editingCourse.id,
            type: 'course',
            attributes: {
              title: formData.title,
              description: formData.description || null,
            },
          },
        };
        
        const response = await patchApiJsonCoursesById({
          params: {
            id: editingCourse.id,
          },
          body: updateData,
        });

        if (response.data?.data) {
          // Update the course in the list
          const updatedCourses = courses.map(c =>
            c.id === editingCourse.id
              ? {
                  ...c,
                  attributes: {
                    ...c.attributes,
                    title: formData.title,
                    description: formData.description || null,
                    updated_at: new Date().toISOString(),
                  },
                }
              : c
          );
          setCourses(updatedCourses);
          handleCloseDialog();
        } else {
          setError('Failed to update course. Please try again.');
        }
      } else {
        // Create new course
        const createData = {
          data: {
            type: 'course',
            attributes: {
              title: formData.title,
              description: formData.description || null,
              teacher_id: user.id,
            },
          },
        };

        const response = await postApiJsonCourses({
          body: createData,
        });

        if (response.data?.data) {
          // Add the new course to the list
          const newCourse: Course = {
            id: response.data.data.id,
            attributes: {
              title: response.data.data.attributes.title,
              description: response.data.data.attributes.description || '',
              teacher_id: response.data.data.attributes.teacher_id,
              created_at: response.data.data.attributes.created_at,
              updated_at: response.data.data.attributes.updated_at,
            },
          };
          setCourses([...courses, newCourse]);
          handleCloseDialog();
        } else {
          setError('Failed to create course. Please try again.');
        }
      }
    } catch (err) {
      setError('Failed to save course. Please try again.');
      console.error('Error saving course:', err);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (window.confirm('Are you sure you want to delete this course? This will also remove all student enrollments.')) {
      try {
        const response = await deleteApiJsonCoursesById({
          params: {
            id: courseId,
          },
        });

        if (response.data) {
          // Remove the course from the list
          setCourses(courses.filter(c => c.id !== courseId));
        } else {
          setError('Failed to delete course. Please try again.');
        }
      } catch (err) {
        setError('Failed to delete course. Please try again.');
        console.error('Error deleting course:', err);
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
                  Course Management
                </Typography>
                <Typography variant="body1">
                  Manage your courses and curriculum
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
                Add Course
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
            title="My Courses"
            subheader={`Total: ${courses.length} courses`}
          />
          <CardContent>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                <CircularProgress />
              </Box>
            ) : courses.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="h6" color="text.secondary">
                  No courses yet
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Create your first course to get started
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<AddIcon />}
                  onClick={() => handleOpenDialog()}
                >
                  Create Your First Course
                </Button>
              </Box>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Course Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {courses.map((course) => (
                      <TableRow key={course.id}>
                        <TableCell>
                          <Typography variant="subtitle1" fontWeight="bold">
                            {course.attributes.title}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {course.attributes.description || 'No description'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {new Date(course.attributes.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => router.push(`/teacher/courses/${course.id}/students`)}
                            color="primary"
                            title="Manage Students"
                          >
                            <PeopleIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(course)}
                            color="primary"
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteCourse(course.id)}
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

      {/* Course Form Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCourse ? 'Edit Course' : 'Add New Course'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid xs={12}>
                <TextField
                  fullWidth
                  label="Course Title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  helperText="Enter a descriptive title for your course"
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
                  helperText="Optional: Provide a detailed description of the course content"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingCourse ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

export default function CourseManagement() {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <CourseManagementContent />
    </ProtectedRoute>
  );
}