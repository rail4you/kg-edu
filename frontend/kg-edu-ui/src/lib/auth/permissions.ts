/**
 * Role-based permissions utilities for the KgEdu application
 */

export type UserRole = 'admin' | 'teacher' | 'student' | 'user';

export type Permission = 
  | 'view_courses'
  | 'create_courses'
  | 'edit_courses'
  | 'delete_courses'
  | 'view_students'
  | 'manage_students'
  | 'view_knowledge_resources'
  | 'create_knowledge_resources'
  | 'edit_knowledge_resources'
  | 'delete_knowledge_resources'
  | 'manage_relations'
  | 'view_grades'
  | 'manage_users'
  | 'view_all_courses'
  | 'enroll_in_courses';

/**
 * Define role-based permissions matrix
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view_courses',
    'create_courses',
    'edit_courses',
    'delete_courses',
    'view_students',
    'manage_students',
    'view_knowledge_resources',
    'create_knowledge_resources',
    'edit_knowledge_resources',
    'delete_knowledge_resources',
    'manage_relations',
    'view_grades',
    'manage_users',
    'view_all_courses',
    'enroll_in_courses',
  ],
  teacher: [
    'view_courses',
    'create_courses',
    'edit_courses',
    'delete_courses',
    'view_students',
    'manage_students',
    'view_knowledge_resources',
    'create_knowledge_resources',
    'edit_knowledge_resources',
    'delete_knowledge_resources',
    'manage_relations',
    'view_grades',
    'view_all_courses',
  ],
  student: [
    'view_courses',
    'view_knowledge_resources',
    'view_grades',
    'enroll_in_courses',
  ],
  user: [
    'view_courses',
    'view_knowledge_resources',
    'view_grades',
    'enroll_in_courses',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole | null, permission: Permission): boolean {
  if (!role) return false;
  
  // For backward compatibility, treat 'user' as 'student'
  const normalizedRole = role === 'user' ? 'student' : role;
  
  return ROLE_PERMISSIONS[normalizedRole]?.includes(permission) || false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole | null, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole | null): Permission[] {
  if (!role) return [];
  
  // For backward compatibility, treat 'user' as 'student'
  const normalizedRole = role === 'user' ? 'student' : role;
  
  return ROLE_PERMISSIONS[normalizedRole] || [];
}

/**
 * Role-specific route protection configuration
 */
export const ROUTE_PERMISSIONS = {
  '/admin': { roles: ['admin'] as UserRole[], permissions: ['manage_users'] as Permission[] },
  '/teacher': { roles: ['teacher'] as UserRole[], permissions: ['create_courses'] as Permission[] },
  '/student': { roles: ['student', 'user'] as UserRole[], permissions: ['view_courses'] as Permission[] },
  '/teacher/courses': { roles: ['teacher'] as UserRole[], permissions: ['create_courses'] as Permission[] },
  '/teacher/knowledge': { roles: ['teacher'] as UserRole[], permissions: ['create_knowledge_resources'] as Permission[] },
  '/student/courses': { roles: ['student', 'user'] as UserRole[], permissions: ['view_courses'] as Permission[] },
};

/**
 * UI visibility controls based on permissions
 */
export const UI_CONTROLS = {
  // Admin controls
  adminUserManagement: { permission: 'manage_users' as Permission, roles: ['admin'] as UserRole[] },
  
  // Teacher controls
  teacherCourseCreation: { permission: 'create_courses' as Permission, roles: ['teacher'] as UserRole[] },
  teacherKnowledgeManagement: { permission: 'create_knowledge_resources' as Permission, roles: ['teacher'] as UserRole[] },
  teacherStudentManagement: { permission: 'manage_students' as Permission, roles: ['teacher'] as UserRole[] },
  
  // Student controls
  studentCourseEnrollment: { permission: 'enroll_in_courses' as Permission, roles: ['student', 'user'] as UserRole[] },
  studentGradeViewing: { permission: 'view_grades' as Permission, roles: ['student', 'user'] as UserRole[] },
  
  // Common controls
  courseViewing: { permission: 'view_courses' as Permission, roles: ['admin', 'teacher', 'student', 'user'] as UserRole[] },
  knowledgeViewing: { permission: 'view_knowledge_resources' as Permission, roles: ['admin', 'teacher', 'student', 'user'] as UserRole[] },
};