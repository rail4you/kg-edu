'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon,
  PersonAdd as PersonAddIcon,
  RemoveCircle as RemoveCircleIcon,
} from '@mui/icons-material';
import { 
  getApiJsonUsers,
  getApiJsonCourseEnrollmentsCourseByCourseId,
  postApiJsonCourseEnrollments,
  deleteApiJsonCourseEnrollmentsById
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

interface Enrollment {
  id: string;
  attributes: {
    course_id: string;
    student_id: string;
    enrolled_at: string;
  };
  relationships?: {
    student?: {
      data: {
        id: string;
        type: string;
      };
    };
  };
}

interface CourseStudentManagementContentProps {
  courseId: string;
}

function CourseStudentManagementContent({ courseId }: CourseStudentManagementContentProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [enrolledStudents, setEnrolledStudents] = useState<Enrollment[]>([]);
  const [availableStudents, setAvailableStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch enrolled students
        const enrollmentsResponse = await getApiJsonCourseEnrollmentsCourseByCourseId({
          params: {
            course_id: courseId,
          },
        });
        
        if (enrollmentsResponse.data?.data) {
          setEnrolledStudents(enrollmentsResponse.data.data);
        }

        // Fetch all students (users with role 'user')
        const usersResponse = await getApiJsonUsers({});
        
        if (usersResponse.data?.data) {
          const students = usersResponse.data.data
            .filter((u: any) => u.attributes.role === 'user')
            .map((u: any) => ({
              id: u.id,
              attributes: {
                student_id: u.attributes.student_id,
                email: u.attributes.email || '',
                role: u.attributes.role,
                created_at: u.attributes.created_at,
                updated_at: u.attributes.updated_at,
              },
            }));
          setAvailableStudents(students);
        }
      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [courseId]);

  const handleOpenDialog = () => {
    setSelectedStudent(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedStudent(null);
    setError(null);
  };

  const handleEnrollStudent = async () => {
    if (!selectedStudent) {
      setError('Please select a student to enroll');
      return;
    }

    try {
      const enrollData = {
        data: {
          type: 'course_enrollment',
          attributes: {
            course_id: courseId,
            student_id: selectedStudent.id,
          },
        },
      };

      const response = await postApiJsonCourseEnrollments({
        body: enrollData,
      });

      if (response.data?.data) {
        // Add the new enrollment to the list
        const newEnrollment: Enrollment = {
          id: response.data.data.id,
          attributes: {
            course_id: response.data.data.attributes.course_id,
            student_id: response.data.data.attributes.student_id,
            enrolled_at: response.data.data.attributes.enrolled_at,
          },
        };
        setEnrolledStudents([...enrolledStudents, newEnrollment]);
        handleCloseDialog();
      } else {
        setError('Failed to enroll student. Please try again.');
      }
    } catch (err) {
      setError('Failed to enroll student. Please try again.');
      console.error('Error enrolling student:', err);
    }
  };

  const handleUnenrollStudent = async (enrollmentId: string, studentName: string) => {
    if (window.confirm(`Are you sure you want to unenroll ${studentName}?`)) {
      try {
        const response = await deleteApiJsonCourseEnrollmentsById({
          path: {
            id: enrollmentId,
          },
        });

        if (response.data) {
          // Remove the enrollment from the list
          setEnrolledStudents(enrolledStudents.filter(e => e.id !== enrollmentId));
        } else {
          setError('Failed to unenroll student. Please try again.');
        }
      } catch (err) {
        setError('Failed to unenroll student. Please try again.');
        console.error('Error unenrolling student:', err);
      }
    }
  };

  const getStudentById = (studentId: string) => {
    return availableStudents.find(s => s.id === studentId);
  };

  const enrolledStudentIds = enrolledStudents.map(e => e.attributes.student_id);
  const unenrolledStudents = availableStudents.filter(s => !enrolledStudentIds.includes(s.id));

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
            <CircularProgress />
          </Box>
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
              <IconButton color="inherit" onClick={() => router.push('/teacher/courses')}>
                <ArrowBackIcon />
              </IconButton>
              <Box>
                <Typography variant="h4" component="h1">
                  Student Management
                </Typography>
                <Typography variant="body1">
                  Course Management
                </Typography>
              </Box>
            </Box>
            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="inherit"
                startIcon={<PersonAddIcon />}
                onClick={handleOpenDialog}
                disabled={unenrolledStudents.length === 0}
              >
                Enroll Student
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

        <Grid container spacing={3}>
          {/* Enrolled Students */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="Enrolled Students"
                subheader={`${enrolledStudents.length} students enrolled`}
              />
              <CardContent>
                {enrolledStudents.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="h6" color="text.secondary">
                      No students enrolled
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Enroll students to get started
                    </Typography>
                    <Button
                      variant="contained"
                      color="secondary"
                      startIcon={<PersonAddIcon />}
                      onClick={handleOpenDialog}
                      disabled={unenrolledStudents.length === 0}
                    >
                      Enroll First Student
                    </Button>
                  </Box>
                ) : (
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Student ID</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Enrolled Date</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {enrolledStudents.map((enrollment) => {
                          const student = getStudentById(enrollment.attributes.student_id);
                          return (
                            <TableRow key={enrollment.id}>
                              <TableCell>
                                <Typography variant="subtitle1">
                                  {student?.attributes.student_id || 'Unknown'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {student?.attributes.email || 'No email'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                {new Date(enrollment.attributes.enrolled_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() => handleUnenrollStudent(
                                    enrollment.id,
                                    student?.attributes.student_id || 'Student'
                                  )}
                                  color="error"
                                  title="Unenroll Student"
                                >
                                  <RemoveCircleIcon />
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

          {/* Available Students */}
          {unenrolledStudents.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardHeader
                  title="Available Students"
                  subheader={`${unenrolledStudents.length} students available for enrollment`}
                />
                <CardContent>
                  <TableContainer component={Paper}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Student ID</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {unenrolledStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Typography variant="subtitle1">
                                {student.attributes.student_id}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {student.attributes.email}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PersonAddIcon />}
                                onClick={() => {
                                  setSelectedStudent(student);
                                  setOpenDialog(true);
                                }}
                              >
                                Enroll
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Container>

      {/* Enroll Student Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Enroll Student</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid xs={12}>
              <Autocomplete
                options={unenrolledStudents}
                getOptionLabel={(option) => `${option.attributes.student_id} - ${option.attributes.email}`}
                value={selectedStudent}
                onChange={(event, newValue) => setSelectedStudent(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Student"
                    placeholder="Choose a student to enroll"
                    fullWidth
                  />
                )}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            type="submit" 
            variant="contained"
            onClick={handleEnrollStudent}
            disabled={!selectedStudent}
          >
            Enroll Student
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

interface CourseStudentManagementProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function CourseStudentManagement({ params }: CourseStudentManagementProps) {
  const { courseId } = await params;
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <CourseStudentManagementContent courseId={courseId} />
    </ProtectedRoute>
  );
}