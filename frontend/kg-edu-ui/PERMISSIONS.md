# Role-Based Permissions System

This document describes the role-based permissions system implemented for the KgEdu application.

## Overview

The permissions system provides fine-grained access control for different user roles in the application. It's built on top of the existing authentication system and provides both backend API integration and frontend UI controls.

## User Roles

The system supports the following user roles:

1. **Admin** (`admin`) - Full system access
2. **Teacher** (`teacher`) - Course and resource management
3. **Student** (`student`) - Course enrollment and content viewing
4. **User** (`user`) - Legacy role, treated as `student` for backward compatibility

## Permissions

### Course Management
- `view_courses` - View course listings
- `create_courses` - Create new courses
- `edit_courses` - Modify existing courses
- `delete_courses` - Remove courses
- `view_all_courses` - View all courses in the system

### Student Management
- `view_students` - View student information
- `manage_students` - Add/remove students from courses

### Knowledge Resources
- `view_knowledge_resources` - View knowledge resources
- `create_knowledge_resources` - Create new knowledge resources
- `edit_knowledge_resources` - Modify existing resources
- `delete_knowledge_resources` - Remove resources
- `manage_relations` - Create and manage resource relationships

### User Management
- `manage_users` - Create and manage user accounts

### Student Features
- `enroll_in_courses` - Enroll in courses
- `view_grades` - View personal grades

## Permission Matrix

| Permission | Admin | Teacher | Student |
|------------|-------|---------|----------|
| `view_courses` | ✅ | ✅ | ✅ |
| `create_courses` | ✅ | ✅ | ❌ |
| `edit_courses` | ✅ | ✅ | ❌ |
| `delete_courses` | ✅ | ✅ | ❌ |
| `view_students` | ✅ | ✅ | ❌ |
| `manage_students` | ✅ | ✅ | ❌ |
| `view_knowledge_resources` | ✅ | ✅ | ✅ |
| `create_knowledge_resources` | ✅ | ✅ | ❌ |
| `edit_knowledge_resources` | ✅ | ✅ | ❌ |
| `delete_knowledge_resources` | ✅ | ✅ | ❌ |
| `manage_relations` | ✅ | ✅ | ❌ |
| `view_grades` | ✅ | ✅ | ✅ |
| `manage_users` | ✅ | ❌ | ❌ |
| `view_all_courses` | ✅ | ✅ | ❌ |
| `enroll_in_courses` | ✅ | ❌ | ✅ |

## Usage Examples

### Using the usePermissions Hook

```tsx
import { usePermissions } from '@/src/hooks/use-permissions';

function MyComponent() {
  const { canCreateCourses, isTeacher, can } = usePermissions();
  
  return (
    <div>
      {canCreateCourses && (
        <button>Create New Course</button>
      )}
      
      {isTeacher && (
        <div>Teacher-specific content</div>
      )}
      
      {can('view_grades') && (
        <div>Grades information</div>
      )}
    </div>
  );
}
```

### Using PermissionGuard Component

```tsx
import { PermissionGuard } from '@/src/components/auth/permission-route';

function MyComponent() {
  return (
    <div>
      {/* Only show to users with create_courses permission */}
      <PermissionGuard permissions={['create_courses']}>
        <button>Create Course</button>
      </PermissionGuard>
      
      {/* Show fallback if no permission */}
      <PermissionGuard permissions={['manage_users']} fallback={<div>Access denied</div>}>
        <AdminPanel />
      </PermissionGuard>
      
      {/* Require multiple permissions */}
      <PermissionGuard permissions={['edit_courses', 'manage_students']} requireAll={true}>
        <AdvancedCourseManagement />
      </PermissionGuard>
    </div>
  );
}
```

### Using PermissionRoute Component

```tsx
import { PermissionRoute } from '@/src/components/auth/permission-route';

function ProtectedPage() {
  return (
    <PermissionRoute permissions={['create_courses']} roles={['teacher']}>
      <CourseCreationForm />
    </PermissionRoute>
  );
}
```

### Route-Level Protection

```tsx
// pages/teacher/courses/page.tsx
export default function CourseManagement() {
  return (
    <ProtectedRoute allowedRoles={['teacher']}>
      <CourseManagementContent />
    </ProtectedRoute>
  );
}
```

## Backend Integration

The permission system is designed to work with the Ash Framework's authorization system. When implementing new features:

1. **Define permissions** in the `permissions.ts` file
2. **Implement backend policies** in your Ash resources
3. **Use permission checks** in your frontend components
4. **Test thoroughly** with different user roles

## Best Practices

1. **Principle of Least Privilege**: Only grant the minimum permissions necessary
2. **Consistent Naming**: Use clear, descriptive permission names
3. **Permission Composition**: Combine permissions for complex operations
4. **UI Feedback**: Hide/disable UI elements for unauthorized actions
5. **Error Handling**: Provide clear feedback for permission denied scenarios

## Testing

Test the permission system with different user roles:

```tsx
// Example test case
describe('Permission System', () => {
  it('should allow teachers to create courses', () => {
    const { canCreateCourses } = usePermissions();
    expect(canCreateCourses).toBe(true);
  });
  
  it('should not allow students to create courses', () => {
    const { canCreateCourses } = usePermissions();
    expect(canCreateCourses).toBe(false);
  });
});
```

## Migration Guide

### For Existing Components

1. Replace role checks with permission checks:
   ```tsx
   // Old way
   {userRole === 'teacher' && <button>Edit</button>}
   
   // New way
   {can('edit_courses') && <button>Edit</button>}
   ```

2. Update route protection:
   ```tsx
   // Old way
   <ProtectedRoute allowedRoles={['teacher']}>
   
   // New way
   <PermissionRoute permissions={['create_courses']}>
   ```

### For New Features

1. Define new permissions in `permissions.ts`
2. Add permissions to appropriate roles
3. Use permission checks in components
4. Update backend policies accordingly

## Future Enhancements

1. **Dynamic Permissions**: Support for user-specific permissions
2. **Permission Groups**: Group related permissions for easier management
3. **Audit Logging**: Track permission usage and changes
4. **Time-based Permissions**: Temporary permissions for specific actions
5. **Permission Inheritance**: Hierarchical permission structures