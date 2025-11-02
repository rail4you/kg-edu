# Super Admin Multi-Tenant Setup

This document explains how to set up and use the super admin functionality in the multi-tenant KgEdu system.

## Overview

The system now supports three types of user registration and authentication:

1. **Super Admin Registration** - No tenant context required
2. **Tenant-aware User Registration** - Requires tenant specification
3. **Regular User Registration** - Works within existing tenant context

## User Roles

- `:super_admin` - Can access all tenants, create users in any tenant, sign in without tenant context
- `:admin` - Can manage users within their assigned tenant
- `:user` - Regular user with tenant-scoped access
- `:teacher` - Teacher role within tenant

## Registration Methods

### 1. Super Admin Registration (No Tenant Required)

```elixir
# Register a super admin - works without any tenant context
User.register_super_admin(%{
  member_id: "superadmin001",
  name: "System Super Admin",
  password: "very_secure_password_123",
  password_confirmation: "very_secure_password_123"
})

# Returns: {:ok, user_with_token}
```

### 2. User Registration in Specific Tenant

```elixir
# Register a user in a specific tenant
User.register_user_in_tenant(%{
  member_id: "student001",
  name: "John Doe",
  email: "john@example.com",
  password: "password123",
  password_confirmation: "password123",
  role: :user,
  tenant_id: "org-uuid-here"
})

# Returns: {:ok, user_with_token}
```

### 3. Regular User Registration (Requires Tenant Context)

```elixir
# Set tenant context first
Ash.set_tenant("org_schema_name")

# Then register user within that tenant
User.register_user(%{
  member_id: "student002",
  name: "Jane Smith",
  password: "password123",
  password_confirmation: "password123",
  role: :user
})

# Returns: {:ok, user_with_token}
```

## Authentication Methods

### 1. Super Admin Sign-In (No Tenant Required)

```elixir
# Super admin can sign in from anywhere, no tenant context needed
User.super_admin_sign_in(%{
  member_id: "superadmin001",
  password: "very_secure_password_123"
})

# Returns: {:ok, user_with_jwt_token}
```

### 2. Regular User Sign-In (Requires Tenant Context)

```elixir
# Set tenant context first
Ash.set_tenant("org_schema_name")

# Regular user sign-in within tenant
User.sign_in(%{
  member_id: "student001",
  password: "password123"
})

# Returns: {:ok, user_with_jwt_token}
```

## Super Admin Tenant Management

### Create Users in Any Tenant

```elixir
# Super admin creates user in specific tenant
User.create_user_in_tenant(%{
  member_id: "teacher001",
  name: "Teacher Name",
  email: "teacher@school.com",
  password: "teacher_pass",
  role: :teacher,
  tenant_id: "target-org-uuid"
})
```

### List Users from Any Tenant

```elixir
# Super admin gets users from specific tenant
User.get_users_from_tenant(%{tenant_id: "org-uuid-here"})
```

### List All Tenants

```elixir
# Get all available organizations/tenants
KgEdu.TenantManager.list_tenants()
# Returns: [%{id: uuid, name: "School Name", schema_name: "org_abc123"}, ...]
```

## TypeScript RPC Endpoints

All actions are available via TypeScript RPC:

### User Management RPC
```typescript
// Super admin registration
rpc.register_super_admin({
  member_id: "superadmin001",
  name: "Super Admin",
  password: "secure_pass",
  password_confirmation: "secure_pass"
})

// User registration in tenant
rpc.register_in_tenant({
  member_id: "user001",
  name: "User Name",
  password: "password123",
  password_confirmation: "password123",
  role: "user",
  tenant_id: "org-uuid-here"
})

// Super admin sign-in
rpc.super_admin_sign_in({
  member_id: "superadmin001",
  password: "secure_pass"
})

// Create user in tenant
rpc.create_user_in_tenant({
  member_id: "newuser",
  name: "New User",
  password: "password123",
  role: "user",
  tenant_id: "target-org-uuid"
})

// Get users from tenant
rpc.get_users_from_tenant({
  tenant_id: "org-uuid-here"
})
```

### Organization & Migration RPC
```typescript
// Create organization with migrations (recommended)
rpc.create_organization_with_migrations({
  name: "New School"
})

// Create verified organization (with health check)
rpc.create_verified_organization({
  name: "Verified School"
})

// Create organization without migrations
rpc.create_organization({
  name: "Basic Organization"
})

// Run migrations for specific organization
rpc.run_tenant_migrations({
  organization_id: "org-uuid-here"
})

// Run migrations for all tenants
rpc.run_all_tenant_migrations({})

// Check organization health
rpc.check_tenant_health({
  organization_id: "org-uuid-here"
})

// Get migration status for all tenants
rpc.get_migration_status({})
```

### Backup & Restore RPC
```typescript
// Backup organization (full backup with data)
rpc.backup_organization({
  organization_id: "org-uuid-here",
  backup_type: "manual",
  include_data: true
})

// Create scheduled backup
rpc.create_scheduled_backups({
  backup_type: "daily"
})

// List organization backups
rpc.list_organization_backups({
  organization_id: "org-uuid-here"
})

// Restore organization from backup
rpc.restore_organization({
  backup_id: "backup_20231201_120000",
  organization_id: "org-uuid-here",
  overwrite: false,
  create_schema: true
})

// Delete backup
rpc.delete_backup({
  backup_id: "backup_20231201_120000"
})

// Get backup statistics
rpc.get_backup_statistics({})
```

### Complete Organization Setup Example
```typescript
// Step 1: Create organization with migrations
const org = await rpc.create_organization_with_migrations({
  name: "Harvard University"
});

// Step 2: Verify organization health
const health = await rpc.check_tenant_health({
  organization_id: org.id
});

if (health.health === 'healthy') {
  // Step 3: Create admin user in the new tenant
  const admin = await rpc.create_user_in_tenant({
    member_id: "dean001",
    name: "University Dean",
    email: "dean@harvard.edu",
    password: "SecurePassword123!",
    role: "admin",
    tenant_id: org.id
  });

  console.log("Organization setup complete!", { org, admin, health });
}
```

## Security Features

### Super Admin Privileges
- Can sign in without tenant context
- Can create users in any tenant
- Can list users from any tenant
- Has global read access across all tenants
- JWT tokens include super admin claims

### Tenant Isolation
- Regular users are isolated to their tenant
- Regular sign-in requires tenant context
- User operations are tenant-scoped
- Schema-based data isolation

### Password Requirements
- Super admins: Minimum 12 characters
- Regular users: Minimum 8 characters
- All passwords are hashed with Argon2

## Initial Setup

### 1. Create First Super Admin

```elixir
# In IEx console when no tenants exist
iex> KgEdu.Accounts.User.register_super_admin(%{
  member_id: "admin",
  name: "System Administrator",
  password: "InitialSuperAdminPassword123!",
  password_confirmation: "InitialSuperAdminPassword123!"
})
```

### 2. Create Organizations/Tenants

```elixir
# Super admin creates organizations
KgEdu.Accounts.Organization.create(%{name: "First School"})
KgEdu.Accounts.Organization.create(%{name: "Second School"})
```

### 3. Register Regular Users

```elixir
# Register users in specific tenants
KgEdu.Accounts.User.register_user_in_tenant(%{
  member_id: "principal001",
  name: "School Principal",
  password: "principal_pass",
  role: :admin,
  tenant_id: "first-school-uuid"
})
```

## JWT Token Claims

Super admin tokens include:
```json
{
  "sub": "user_uuid",
  "role": "super_admin",
  "exp": timestamp,
  "iat": timestamp
}
```

Regular user tokens include:
```json
{
  "sub": "user_uuid",
  "role": "user|admin|teacher",
  "exp": timestamp,
  "iat": timestamp
}
```

## Error Handling

Common errors:
- `:tenant_not_found` - Specified tenant doesn't exist
- `:invalid_credentials` - Wrong member_id or password
- `:unauthorized` - User doesn't have required permissions
- `:no_tenant_available` - No tenants exist for super admin registration

## Best Practices

1. **First Super Admin**: Create the initial super admin directly in the database or console
2. **Password Security**: Use strong passwords for super admin accounts
3. **Tenant Management**: Always validate tenant existence before user operations
4. **Token Validation**: Verify JWT claims, especially the `role` field
5. **Audit Logging**: Log all super admin actions for security auditing

## Programmatic Migration Management

### Migration Manager Modules

Two modules are provided for programmatic migration management:

1. **`KgEdu.AshMigrationManager`** - AshPostgres-specific (Recommended)
2. **`KgEdu.MigrationManager`** - General PostgreSQL utilities

### Key Migration Functions

#### Create Organization with Migrations
```elixir
# Complete setup with verification
KgEdu.AshMigrationManager.setup_verified_tenant("New School")

# Create and migrate in one step
KgEdu.AshMigrationManager.create_organization_with_migrations("New School")
```

#### Run Migrations for Existing Tenants
```elixir
# Run migrations for all existing tenants
KgEdu.AshMigrationManager.run_all_tenant_migrations()

# Run migrations for specific tenant
org = KgEdu.Accounts.Organization |> Ash.get!("org-uuid")
KgEdu.AshMigrationManager.run_tenant_migrations_for_org(org)

# Run migrations for specific tenant schema
KgEdu.AshMigrationManager.run_tenant_migrations("org_schema_name")
```

#### Migration Status and Health
```elixir
# Check migration status for all tenants
KgEdu.AshMigrationManager.get_tenant_migration_status()
# Returns: [{"org_schema1", 1, :ok}, {"org_schema2", 1, :ok}]

# Check tenant health
KgEdu.AshMigrationManager.check_tenant_health(organization)
# Returns: :ok or {:error, reason}
```

#### Advanced Migration Operations
```elixir
# Migrate to specific version
KgEdu.AshMigrationManager.migrate_tenant_to("org_schema", 20231201000000)

# Rollback tenant migrations
KgEdu.AshMigrationManager.rollback_tenant("org_schema", 1)

# Drop tenant (dangerous - deletes all data)
KgEdu.AshMigrationManager.drop_tenant(organization)
```

## SQL Backup & Restore System

### Overview

The system provides comprehensive SQL-based backup and restore functionality for multi-tenant organizations. Each organization has its own PostgreSQL schema that can be backed up and restored independently.

### Key Features

- **Full Schema Backups**: Complete tenant schema with all tables, data, and dependencies
- **Incremental Backups**: Support for different backup types (manual, scheduled, daily, etc.)
- **Metadata Tracking**: Automatic tracking of backup history, size, and restoration records
- **PostgreSQL Native**: Uses `pg_dump` and `pg_restore` for reliable backups
- **TypeScript RPC**: Full frontend integration for backup management

### Backup Types

```elixir
# Manual backup (on-demand)
KgEdu.BackupManager.backup_organization("org-uuid", backup_type: :manual)

# Scheduled backups (automated)
KgEdu.BackupManager.create_scheduled_backups(:daily)

# System-wide backup
KgEdu.BackupManager.backup_all_organizations(backup_type: :full_system)
```

### Complete Backup Workflow

#### 1. Initial Setup
```elixir
# Create backup tracking table
KgEdu.BackupManager.create_backup_table()
```

#### 2. Create Organization Backup
```elixir
# Full backup with metadata
{:ok, backup_info} = KgEdu.BackupManager.backup_organization("org-uuid-here", [
  backup_type: :manual,
  include_data: true
])

# Returns: %{
#   backup_id: "backup_20231201_120000",
#   organization_id: "org-uuid-here",
#   organization_name: "Harvard University",
#   schema_name: "org_abc123",
#   timestamp: ~U[2023-12-01 12:00:00Z],
#   file_path: "/path/to/backup.sql"
# }
```

#### 3. List and Manage Backups
```elixir
# List all backups for organization
{:ok, backups} = KgEdu.BackupManager.list_organization_backups("org-uuid-here")

# Get backup statistics
{:ok, stats} = KgEdu.BackupManager.get_backup_statistics()
```

#### 4. Restore from Backup
```elixir
# Restore to existing organization
KgEdu.BackupManager.restore_organization("backup_20231201_120000", "org-uuid-here", [
  overwrite: true,
  create_schema: false,
  reset_sequences: true
])
```

### Frontend Integration Examples

#### Backup Organization
```typescript
const backup = await rpc.backup_organization({
  organization_id: "org-uuid-here",
  backup_type: "manual",
  include_data: true
});

console.log("Backup created:", backup);
// Returns: {
//   backup_id: "backup_20231201_120000",
//   organization_id: "org-uuid-here",
//   organization_name: "Harvard University",
//   schema_name: "org_abc123",
//   timestamp: "2023-12-01T12:00:00Z",
//   file_path: "/path/to/backup.sql",
//   backup_type: "manual"
// }
```

#### List Backups
```typescript
const backups = await rpc.list_organization_backups({
  organization_id: "org-uuid-here"
});

console.log("Available backups:", backups.backups);
// Returns: [
//   {
//     backup_id: "backup_20231201_120000",
//     organization_id: "org-uuid-here",
//     created_at: "2023-12-01T12:00:00Z",
//     file_size: 5242880,
//     backup_type: "manual",
//     metadata: {...}
//   }
// ]
```

#### Restore Organization
```typescript
const restore = await rpc.restore_organization({
  backup_id: "backup_20231201_120000",
  organization_id: "org-uuid-here",
  overwrite: false,
  create_schema: true
});

console.log("Restore result:", restore);
// Returns: { message: "Restore completed successfully" }
```

### Advanced Usage

#### Scheduled Backups
```typescript
// Create daily backups for all organizations
const result = await rpc.create_scheduled_backups({
  backup_type: "daily"
});

console.log("Scheduled backups created:", result);
// Returns: { successful: 5, total: 5, results: [...] }
```

#### Backup Statistics
```typescript
const stats = await rpc.get_backup_statistics({});

console.log("Backup statistics:", stats.statistics);
// Returns: [
//   {
//     backup_type: "manual",
//     count: 15,
//     total_size: 104857600,
//     last_backup: "2023-12-01T12:00:00Z"
//   },
//   {
//     backup_type: "daily",
//     count: 30,
//     total_size: 209715200,
//     last_backup: "2023-12-01T06:00:00Z"
//   }
// ]
```

### Backup File Structure

Backups are stored as SQL files with embedded metadata:

```sql
-- KgEdu Organization Backup
-- Backup ID: backup_20231201_120000
-- Organization: Harvard University (org-uuid-here)
-- Schema: org_abc123
-- Created: 2023-12-01T12:00:00Z
-- Metadata: {"backup_id":"backup_20231201_120000",...}

-- pg_dump dump content
CREATE TABLE users (...);
INSERT INTO users VALUES (...);
-- ... rest of the backup
```

### Migration Requirements

The system needs database migrations to:
1. Add `:super_admin` to user role constraints
2. Ensure existing users can be upgraded to super admin role
3. Create proper indexes for multi-tenant queries
4. Create backup tracking table

Run migrations after implementing:
```bash
mix ash.codegen super_admin_role_update
mix ash.migrate
```

### Migration Workflow Examples

#### Setting Up a New Organization
```elixir
# 1. Create organization with migrations
{:ok, result} = KgEdu.AshMigrationManager.create_organization_with_migrations("New School")

# 2. Verify setup
:ok = KgEdu.AshMigrationManager.check_tenant_health(result.organization)

# 3. Create users in the new tenant
KgEdu.Accounts.User.create_user_in_tenant(%{
  member_id: "principal001",
  name: "School Principal",
  password: "secure_password",
  role: :admin,
  tenant_id: result.organization.id
})
```

#### Managing Multiple Tenants
```elixir
# Get all organizations
organizations = KgEdu.Accounts.Organization |> Ash.read!()

# Migrate all tenants
{:ok, results} = KgEdu.AshMigrationManager.run_all_tenant_migrations()

# Check status for all tenants
status = KgEdu.AshMigrationManager.get_tenant_migration_status()

# Handle any failed migrations
Enum.each(status, fn {tenant, version, status} ->
  if status != :ok do
    IO.puts("Tenant #{tenant} has issues: #{status}")
  end
end)
```

## Testing the Implementation

To test the super admin functionality:

### 1. Start the Server
```bash
iex -S mix phx.server
```

### 2. Create First Super Admin
```elixir
# In IEx console
KgEdu.Accounts.User.register_super_admin(%{
  member_id: "superadmin001",
  name: "System Super Admin",
  password: "SuperAdminPassword123!",
  password_confirmation: "SuperAdminPassword123!"
})
# Note: Do NOT include role parameter - it's automatically set to :super_admin
```

### 3. Test Super Admin Sign-In
```elixir
# Test sign-in without tenant context
KgEdu.Accounts.User.super_admin_sign_in(%{
  member_id: "superadmin001",
  password: "SuperAdminPassword123!"
})
```

### 4. Create an Organization with Migrations

#### Option A: Create Organization and Run Migrations (Recommended)
```elixir
# Create organization and automatically run tenant migrations
KgEdu.AshMigrationManager.create_organization_with_migrations("Test School")

# Or with additional attributes
KgEdu.AshMigrationManager.create_organization_with_migrations("Test School", %{
  description: "A test school for demonstration"
})
```

#### Option B: Create Organization Without Migrations
```elixir
# Create organization without running migrations
KgEdu.Accounts.Organization.create(%{name: "Test School"})

# Then run migrations manually
org = KgEdu.Accounts.Organization |> Ash.read!() |> List.first()
KgEdu.AshMigrationManager.run_tenant_migrations_for_org(org)
```

#### Option C: Complete Tenant Setup with Verification
```elixir
# Create organization, run migrations, and verify everything works
KgEdu.AshMigrationManager.setup_verified_tenant("Test School")
```

### 5. Create Users in Specific Tenant
```elixir
# Get the organization ID first
org = KgEdu.Accounts.Organization |> Ash.read!() |> List.first()

# Create user in that tenant
KgEdu.Accounts.User.create_user_in_tenant(%{
  member_id: "student001",
  name: "Test Student",
  email: "student@test.com",
  password: "StudentPassword123!",
  role: :user,
  tenant_id: org.id
})
```

### 6. List Users from Tenant
```elixir
# List users from specific tenant
KgEdu.Accounts.User.get_users_from_tenant(%{tenant_id: org.id})
```

## Troubleshooting

### Common Issues

1. **`Ash.set_tenant/1 is undefined`**: Fixed by using `tenant: schema_name` option in Ash operations
2. **Compilation errors**: Ensure all role constraints include `:super_admin`
3. **Tenant not found**: Verify organization exists before creating users
4. **Authentication failures**: Check password requirements (8 chars for users, 8 chars for super admins)

### Debug Commands

```elixir
# List all tenants
KgEdu.Repo.all_tenants()

# Check user roles
KgEdu.Accounts.User |> Ash.read!() |> Enum.map(&{&1.member_id, &1.role})

# Verify tenant schemas
KgEdu.Accounts.Organization |> Ash.read!() |> Enum.map(&{&1.name, &1.schema_name})
```