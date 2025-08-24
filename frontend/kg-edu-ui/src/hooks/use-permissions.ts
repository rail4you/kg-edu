'use client';

import { useAuth } from '@/src/contexts/auth-context';
import { 
  hasPermission, 
  hasAnyPermission, 
  hasAllPermissions, 
  getRolePermissions,
  Permission,
  UI_CONTROLS,
  type UserRole 
} from './permissions';

/**
 * Custom hook for role-based permissions
 */
export function usePermissions() {
  const { userRole } = useAuth();

  /**
   * Check if current user has a specific permission
   */
  const can = (permission: Permission): boolean => {
    return hasPermission(userRole, permission);
  };

  /**
   * Check if current user has any of the specified permissions
   */
  const canAny = (permissions: Permission[]): boolean => {
    return hasAnyPermission(userRole, permissions);
  };

  /**
   * Check if current user has all of the specified permissions
   */
  const canAll = (permissions: Permission[]): boolean => {
    return hasAllPermissions(userRole, permissions);
  };

  /**
   * Get all permissions for the current user
   */
  const getPermissions = (): Permission[] => {
    return getRolePermissions(userRole);
  };

  /**
   * Check if current user has a specific role
   */
  const hasRole = (role: UserRole): boolean => {
    if (userRole === 'user' && role === 'student') return true;
    return userRole === role;
  };

  /**
   * Check if current user has any of the specified roles
   */
  const hasAnyRole = (roles: UserRole[]): boolean => {
    return roles.some(role => hasRole(role));
  };

  /**
   * Check if UI control should be visible for current user
   */
  const canSee = (controlKey: keyof typeof UI_CONTROLS): boolean => {
    const control = UI_CONTROLS[controlKey];
    if (!control) return false;
    
    return hasPermission(userRole, control.permission) && hasAnyRole(control.roles);
  };

  /**
   * Get user-friendly role name
   */
  const getRoleName = (): string => {
    switch (userRole) {
      case 'admin':
        return 'Administrator';
      case 'teacher':
        return 'Teacher';
      case 'student':
      case 'user':
        return 'Student';
      default:
        return 'User';
    }
  };

  /**
   * Check if user can access a specific route
   */
  const canAccess = (path: string): boolean => {
    // Import here to avoid circular dependency
    const { ROUTE_PERMISSIONS } = require('./permissions');
    
    const routeConfig = ROUTE_PERMISSIONS[path as keyof typeof ROUTE_PERMISSIONS];
    if (!routeConfig) return true; // Allow access to routes without specific permissions
    
    return hasAnyRole(routeConfig.roles) && canAny(routeConfig.permissions);
  };

  return {
    userRole,
    can,
    canAny,
    canAll,
    getPermissions,
    hasRole,
    hasAnyRole,
    canSee,
    getRoleName,
    canAccess,
    // Common permission checks for convenience
    isAdmin: hasRole('admin'),
    isTeacher: hasRole('teacher'),
    isStudent: hasRole('student') || hasRole('user'),
    
    // Common permission checks
    canManageUsers: can('manage_users'),
    canCreateCourses: can('create_courses'),
    canEditCourses: can('edit_courses'),
    canDeleteCourses: can('delete_courses'),
    canManageStudents: can('manage_students'),
    canCreateKnowledgeResources: can('create_knowledge_resources'),
    canEditKnowledgeResources: can('edit_knowledge_resources'),
    canDeleteKnowledgeResources: can('delete_knowledge_resources'),
    canManageRelations: can('manage_relations'),
    canViewGrades: can('view_grades'),
    canEnrollInCourses: can('enroll_in_courses'),
    canViewAllCourses: can('view_all_courses'),
  };
}