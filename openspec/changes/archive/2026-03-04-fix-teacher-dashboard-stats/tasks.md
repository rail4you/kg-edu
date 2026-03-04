# Implementation Tasks (Revised)

## 1. Backend - Create Statistics Action

- [x] 1.1 Create `get_dashboard_stats` action in Course resource to return:
  - student_count: users with role = :user
  - knowledge_count: knowledge_resources count
  - homework_count: homeworks count
- [x] 1.2 Expose action via AshTypescript.Rpc in courses.ex
- [x] 1.3 Run `mix ash.codegen` to regenerate RPC types

## 2. Frontend - Update Dashboard

- [x] 2.1 Create `getDashboardStats` API call in ash_rpc.ts (auto-generated)
- [x] 2.2 Update dashboard.tsx to use new stats API instead of individual list calls

## 3. Verification

- [x] 3.1 Verify backend compiles successfully
- [x] 3.2 Test statistics display on teacher dashboard
