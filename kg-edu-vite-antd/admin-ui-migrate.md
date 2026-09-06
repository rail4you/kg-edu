# Admin UI Migration Plan

## Status: COMPLETED ✅

## Overview

This document outlines the migration of admin components from `minimal-vite-ts` (Material-UI based) to `kg-edu-vite-antd` (Ant Design based).

## Source Project Structure

```
minimal-vite-ts/src/
├── pages/admin/dashboard/
│   ├── index.tsx              # Admin dashboard landing page
│   ├── users.tsx              # User management page
│   ├── students.tsx           # Student management page
│   ├── classes.tsx            # Class management page
│   ├── permissions.tsx        # Permissions management page
│   ├── system.tsx             # System status page
│   └── logs.tsx               # System logs page
├── sections/admin/
│   ├── user/
│   │   ├── view/user-management-view.tsx   # User management view
│   │   ├── user-form.tsx                   # User create/edit form
│   │   └── import-user-dialog.tsx          # Bulk user import
│   ├── student/
│   │   ├── view/student-management-view.tsx # Student management view
│   │   └── student-form.tsx                 # Student create/edit form
│   ├── class/
│   │   └── view/
│   │       ├── class-management-view.tsx    # Class management view
│   │       └── class-form.tsx               # Class create/edit form
│   ├── permissions/view/index.tsx           # Permissions management
│   ├── system/view/index.tsx                # System status monitoring
│   └── logs/view/index.tsx                  # System logs viewer
└── layouts/
    └── nav-config-admin-account.tsx         # Navigation configuration
```

## Target Project Structure

```
kg-edu-vite-antd/src/
├── pages/admin/
│   ├── dashboard.tsx          # Admin dashboard (existing - needs enhancement)
│   ├── users.tsx              # User management (new)
│   ├── students.tsx           # Student management (new)
│   ├── classes.tsx            # Class management (new)
│   ├── permissions.tsx        # Permissions management (new)
│   ├── system.tsx             # System status (new)
│   └── logs.tsx               # System logs (new)
├── components/admin/
│   ├── user-form.tsx          # User create/edit form (new)
│   ├── student-form.tsx       # Student create/edit form (new)
│   ├── class-form.tsx         # Class create/edit form (new)
│   ├── import-user-modal.tsx  # Bulk user import modal (new)
│   └── user-detail-drawer.tsx # User detail sidebar (new)
└── layouts/
    ├── admin-layout.tsx       # Admin layout (existing - needs update)
    └── menu-config.ts         # Menu configuration (existing - needs update)
```

---

## Component Mapping: MUI → Ant Design

### Layout Components

| MUI Component | Ant Design Equivalent | Notes |
|--------------|----------------------|-------|
| `Box` | `div` / `Space` / Flex | Use CSS-in-JS or inline styles |
| `Grid` | `Row` / `Col` | 24-column grid system |
| `Card` | `Card` | Similar API |
| `Container` | `div` with max-width | Custom styling needed |
| `Paper` | `Card` or `div` with border | |

### Data Display

| MUI Component | Ant Design Equivalent | Notes |
|--------------|----------------------|-------|
| `Table` | `Table` | Different API, more feature-rich |
| `TablePagination` | `Pagination` | Integrated in Table |
| `Chip` | `Tag` | Similar functionality |
| `Typography` | `Typography` | Different variants |
| `Avatar` | `Avatar` | Similar API |
| `Tooltip` | `Tooltip` | Similar API |
| `Badge` | `Badge` | Similar API |
| `LinearProgress` | `Progress` (line) | Different props |

### Input Components

| MUI Component | Ant Design Equivalent | Notes |
|--------------|----------------------|-------|
| `TextField` | `Input` / `Input.TextArea` | Use Form.Item wrapper |
| `Select` | `Select` | Different API |
| `Checkbox` | `Checkbox` | Similar API |
| `Switch` | `Switch` | Similar API |
| `FormControl` | `Form.Item` | Validation integrated |
| `FormControlLabel` | `Form.Item` with label | |

### Feedback

| MUI Component | Ant Design Equivalent | Notes |
|--------------|----------------------|-------|
| `Dialog` | `Modal` | Different API |
| `Alert` | `Alert` | Similar API |
| `Snackbar` | `message` / `notification` | Global toast system |
| `Backdrop` | `Spin` with spinning prop | |
| `CircularProgress` | `Spin` | |

### Navigation

| MUI Component | Ant Design Equivalent | Notes |
|--------------|----------------------|-------|
| `Button` | `Button` | Similar API |
| `IconButton` | `Button` with icon | |
| `Tabs` | `Tabs` | Similar API |
| `Breadcrumbs` | `Breadcrumb` | Similar API |
| `List` | `List` | Similar API |
| `Menu` | `Menu` | Different API |

---

## Migration Tasks

### Phase 1: Core Infrastructure (Priority: High)

#### 1.1 Update Admin Layout
- [ ] Add new menu items for permissions, system, logs
- [ ] Update `admin-layout.tsx` with enhanced navigation
- [ ] Update `menu-config.ts` with complete admin menu

#### 1.2 Enhance Admin Dashboard
- [ ] Convert dashboard cards from MUI to Ant Design
- [ ] Add statistics cards with real data
- [ ] Implement navigation to sub-pages

### Phase 2: User Management (Priority: High)

#### 2.1 User Management Page (`pages/admin/users.tsx`)
- [ ] Create user list with Ant Design Table
- [ ] Implement pagination, search, filtering
- [ ] Add CRUD operations (Create, Read, Update, Delete)
- [ ] Implement user statistics display

#### 2.2 User Form Component (`components/admin/user-form.tsx`)
- [ ] Convert form from MUI TextField to Ant Design Form
- [ ] Implement validation with Zod schema
- [ ] Add role selection (admin/teacher/student)
- [ ] Add teacher-specific fields (job title, bio)
- [ ] Implement avatar upload

#### 2.3 User Import Modal (`components/admin/import-user-modal.tsx`)
- [ ] Convert dialog to Modal
- [ ] Implement Excel file upload
- [ ] Add template download functionality
- [ ] Show import progress

#### 2.4 User Detail Drawer (`components/admin/user-detail-drawer.tsx`)
- [ ] Convert sidebar to Drawer
- [ ] Display user information
- [ ] Show activity history

### Phase 3: Student Management (Priority: High)

#### 3.1 Student Management Page (`pages/admin/students.tsx`)
- [ ] Create student list with Table
- [ ] Filter students by role='user'
- [ ] Implement search functionality
- [ ] Add CRUD operations

#### 3.2 Student Form Component (`components/admin/student-form.tsx`)
- [ ] Convert form to Ant Design
- [ ] Add class association dropdown
- [ ] Implement password fields

### Phase 4: Class Management (Priority: High)

#### 4.1 Class Management Page (`pages/admin/classes.tsx`)
- [ ] Create class list with Table
- [ ] Show student count per class
- [ ] Add CRUD operations
- [ ] Implement student association modal
- [ ] Implement student dissociation modal

#### 4.2 Class Form Component (`components/admin/class-form.tsx`)
- [ ] Convert form to Ant Design
- [ ] Add college and major fields

### Phase 5: Permissions Management (Priority: Medium)

#### 5.1 Permissions Page (`pages/admin/permissions.tsx`)
- [ ] Create user list with role display
- [ ] Implement role editing modal
- [ ] Show permission chips per user
- [ ] Add role-based permission templates

### Phase 6: System Monitoring (Priority: Low)

#### 6.1 System Status Page (`pages/admin/system.tsx`)
- [ ] Create system metrics cards (CPU, Memory, Disk, Network)
- [ ] Add real-time update simulation
- [ ] Create service status table
- [ ] Add service control buttons (start/stop/restart)
- [ ] Create system info panel
- [ ] Add recent alerts section

#### 6.2 System Logs Page (`pages/admin/logs.tsx`)
- [ ] Create log table with filtering
- [ ] Add search functionality
- [ ] Implement level/module filters
- [ ] Add export functionality
- [ ] Create statistics overview

---

## Detailed Implementation Guide

### 1. Dashboard Page Conversion

**Source (MUI):**
```tsx
// From: minimal-vite-ts/src/pages/admin/dashboard/index.tsx
<Container maxWidth="xl">
  <Grid container spacing={3}>
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card onClick={() => navigate(item.path)}>
        <CardContent>
          <Iconify icon={item.icon} />
          <Typography variant="h6">{item.title}</Typography>
        </CardContent>
      </Card>
    </Grid>
  </Grid>
</Container>
```

**Target (Ant Design):**
```tsx
// To: kg-edu-vite-antd/src/pages/admin/dashboard.tsx
<Row gutter={[24, 24]}>
  {menuItems.map(item => (
    <Col xs={24} sm={12} md={8} lg={6} key={item.path}>
      <Card hoverable onClick={() => navigate(item.path)}>
        <Space direction="vertical" align="center">
          {item.icon}
          <Typography.Title level={5}>{item.title}</Typography.Title>
        </Space>
      </Card>
    </Col>
  ))}
</Row>
```

### 2. Table Conversion

**Source (MUI):**
```tsx
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell>Email</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {users.map(user => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
<TablePagination
  component="div"
  count={total}
  page={page}
  onPageChange={handleChangePage}
/>
```

**Target (Ant Design):**
```tsx
const columns = [
  { title: 'Name', dataIndex: 'name', key: 'name' },
  { title: 'Email', dataIndex: 'email', key: 'email' },
];

<Table
  columns={columns}
  dataSource={users}
  rowKey="id"
  pagination={{
    total,
    current: page + 1,
    onChange: (p) => setPage(p - 1),
  }}
/>
```

### 3. Form Conversion

**Source (MUI):**
```tsx
<Controller
  name="name"
  control={control}
  render={({ field }) => (
    <TextField
      {...field}
      label="Name"
      error={!!errors.name}
      helperText={errors.name?.message}
    />
  )}
/>
```

**Target (Ant Design):**
```tsx
<Form.Item
  name="name"
  label="Name"
  rules={[{ required: true, message: 'Name is required' }]}
>
  <Input />
</Form.Item>
```

### 4. Dialog/Modal Conversion

**Source (MUI):**
```tsx
<Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
  <DialogTitle>Title</DialogTitle>
  <DialogContent>
    {/* Content */}
  </DialogContent>
  <DialogActions>
    <Button onClick={onClose}>Cancel</Button>
    <Button onClick={onSubmit}>Submit</Button>
  </DialogActions>
</Dialog>
```

**Target (Ant Design):**
```tsx
<Modal
  open={open}
  onCancel={onClose}
  title="Title"
  width={800}
  footer={[
    <Button key="cancel" onClick={onClose}>Cancel</Button>,
    <Button key="submit" type="primary" onClick={onSubmit}>Submit</Button>,
  ]}
>
  {/* Content */}
</Modal>
```

---

## API Integration

The current project already has the necessary API functions in `src/lib/ash_rpc.ts`. Key functions used:

- `getUsersFromTenant()` - Fetch users for tenant
- `createUser()` - Create new user
- `updateUser()` - Update existing user
- `deleteUser()` - Delete user
- `listClasses()` - List all classes
- `createClass()` - Create new class
- `updateClass()` - Update class
- `deleteClass()` - Delete class

These functions should work with the migrated components without modification.

---

## File Creation Checklist

### Pages (to create in `src/pages/admin/`)
- [ ] `users.tsx` - User management page
- [ ] `students.tsx` - Student management page
- [ ] `classes.tsx` - Class management page
- [ ] `permissions.tsx` - Permissions management page
- [ ] `system.tsx` - System status page
- [ ] `logs.tsx` - System logs page

### Components (to create in `src/components/admin/`)
- [ ] `user-form.tsx` - User create/edit form
- [ ] `student-form.tsx` - Student create/edit form
- [ ] `class-form.tsx` - Class create/edit form
- [ ] `import-user-modal.tsx` - Bulk user import
- [ ] `user-detail-drawer.tsx` - User detail sidebar

### Updates Required
- [ ] `src/pages/admin/dashboard.tsx` - Enhance with navigation cards
- [ ] `src/layouts/admin-layout.tsx` - Add new menu items
- [ ] `src/layouts/menu-config.ts` - Add complete admin menu
- [ ] `src/App.tsx` - Add new routes

---

## Estimated Effort

| Component | Estimated Time | Priority | Status |
|-----------|---------------|----------|--------|
| Dashboard Enhancement | 2-4 hours | High | ✅ Completed |
| User Management | 4-6 hours | High | ✅ Completed |
| Student Management | 3-4 hours | High | ✅ Completed |
| Class Management | 4-5 hours | High | ✅ Completed |
| Permissions Management | 3-4 hours | Medium | ✅ Completed |
| System Status | 4-6 hours | Low | ✅ Completed |
| System Logs | 3-4 hours | Low | ✅ Completed |

**Total Estimated Time: 23-33 hours**

---

## Completed Files

### Pages Created (`src/pages/admin/`)
- ✅ `dashboard.tsx` - Enhanced with navigation cards and statistics
- ✅ `users.tsx` - Full user management with CRUD, search, and detail drawer
- ✅ `students.tsx` - Student management with class association
- ✅ `classes.tsx` - Class management with student association/dissociation
- ✅ `permissions.tsx` - Role-based permission management
- ✅ `system.tsx` - System status monitoring (CPU, Memory, Disk, Network)
- ✅ `logs.tsx` - System logs viewer with filtering and export

### Components Created (`src/components/admin/`)
- ✅ `user-form.tsx` - User create/edit form with validation
- ✅ `student-form.tsx` - Student create/edit form
- ✅ `class-form.tsx` - Class create/edit form

### Files Updated
- ✅ `src/layouts/menu-config.ts` - Added all admin menu items
- ✅ `src/layouts/admin-layout.tsx` - Updated with new menu icons
- ✅ `src/App.tsx` - Added all admin routes

---

## Testing Checklist

After migration, verify:

- [ ] All pages render correctly
- [ ] CRUD operations work for users, students, classes
- [ ] Forms validate correctly
- [ ] Tables sort and paginate
- [ ] Search and filtering work
- [ ] Modals open and close properly
- [ ] API calls complete successfully
- [ ] Error handling works
- [ ] Loading states display correctly
- [ ] Responsive design works on mobile

---

## Notes

1. **Icons**: MUI uses `@iconify` icons. Ant Design uses `@ant-design/icons`. Some icons may need substitution.

2. **Animations**: The source uses `framer-motion`. Can use Ant Design's built-in animations or CSS transitions.

3. **Theme**: The source uses MUI theming. Ant Design uses ConfigProvider for theming.

4. **Form Validation**: Both use Zod, but Ant Design's Form has built-in validation support.

5. **Date Handling**: Both use dayjs, should be compatible.

6. **State Management**: Both use @tanstack/react-query, should be compatible.
