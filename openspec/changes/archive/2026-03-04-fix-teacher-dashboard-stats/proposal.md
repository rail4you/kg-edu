# Fix: Teacher Dashboard Statistics Display zero

## Problem

The teacher dashboard page (`/teacher/dashboard`) displays four statistics cards:
- Active Courses (活跃课程)
- Total Students (学生总数)
- Knowledge Points (知识点)
- Total Homework (作业总数)

All four statistics currently show **0** even when data exists in the database.

## Root Cause

The frontend code in `dashboard.tsx` calls `listFiles`, `listHomeworks`, and `listUsers` APIs with `page: { limit: 1, count: true }` to get the count of records. However, the backend resources for **File**, **Homework**, and **User** do not have pagination configured, so the API never returns the `count` field.

The `extractCount` helper function returns 0 when `count` field is missing, causing all statistics to display as 0.

### Affected Resources

| Resource | File | Has Pagination | Returns Count |
|----------|------|----------------|----------------|
| Course | `course.ex` | Yes (`countable true`) | Yes |
| File | `file.ex` | No | No |
| Homework | `homework.ex` | No | No |
| User | `user.ex` | No | No |

## Proposed Solution

Add pagination configuration to the backend resources:

1. **File resource** (`file.ex`) - Add pagination to the default `:read` action
2. **Homework resource** (`homework.ex`) - Add pagination to the default `:read` action
3. **User resource** (`user.ex`) - Add pagination to the `:get_users` action

## Impact

- **Affected Files**:
  - `backend/kg_edu/lib/kg_edu/courses/file.ex`
  - `backend/kg_edu/lib/kg_edu/knowledge/homework.ex`
  - `backend/kg_edu/lib/kg_edu/accounts/user.ex`
- **API Changes**: No API contract changes,- **Dependencies**: No new dependencies
- **Systems**: Backend (Ash Framework)

## New Capabilities

None - this is a bug fix, not a new feature.
