# 微专业学生报名审批功能 - 开发计划

## 概述

为学生端提供微专业自主报名通道，教师端提供审批管理功能。学生报名后进入待审核状态，教师可在微专业学生管理中查看并审批，审批通过后学生端可见。

---

## 功能流程

```
学生端                                   教师端
  │                                        │
  ├─ 浏览已发布微专业列表                    │
  │   (公开页面 /micro-majors)              │
  │                                        │
  ├─ 点击"报名申请"                          │
  │   → 创建 pending 状态的 Enrollment       │
  │   (仅 active 状态的微专业可报名)         │
  │                                        │
  │                            ┌────────────┤
  │                            │ 微专业学生管理 │
  │                            │ → 待审核 Tab  │
  │                            │ → 已通过 Tab  │
  │                            │ → 已拒绝 Tab  │
  │                            │              │
  │                            │ 审核操作:     │
  │                            │ ✅ 批准       │
  │                            │ ❌ 拒绝 (+理由)│
  │                            └────────────┤
  │                                        │
  ├─ 查看审核结果                            │
  │   → "我的微专业"页面                      │
  │   → pending: 显示"审核中"                 │
  │   → active: 可正常访问                    │
  │   → rejected: 显示拒绝原因 + 可重新报名     │
  │                                        │
  ├─ (rejected) 点击"重新报名"                │
  │   → 状态更新为 pending, 清空拒绝原因        │
```

---

## Part 1: 后端 - 数据模型与 API 扩展

### 1.1 扩展 MicroMajorEnrollment 状态与字段

**文件**: `backend/kg_edu/lib/kg_edu/major_analysis/micro_major_enrollment.ex`

**改动**:

**(a) status 枚举扩展** — 在 `:status` 属性的 `one_of` 约束中新增 `:pending` 和 `:rejected`：
```diff
- constraints one_of: [:active, :completed, :removed]
+ constraints one_of: [:pending, :active, :rejected, :completed, :removed]
```

| 值 | 说明 |
|------|------|
| `:pending` | 学生已报名，等待教师审核 |
| `:active` | 审核通过 / 教师手动分配，可正常学习（已有） |
| `:rejected` | 教师拒绝报名 |
| `:completed` | 已完成（已有） |
| `:removed` | 已移除（已有） |

**(b) 新增字段**：

```elixir
attribute :rejected_reason, :string do
  allow_nil? true
  public? true
  description "审批拒绝原因"
end

attribute :reviewed_at, :utc_datetime do
  allow_nil? true
  public? true
  description "审核时间（批准或拒绝时置为当前时间）"
end

attribute :reviewed_by_id, :uuid do
  allow_nil? true
  public? true
  description "审核人 ID"
end
```

### 1.2 新增 API Actions

**文件**: `backend/kg_edu/lib/kg_edu/major_analysis/micro_major_enrollment.ex`

**新增 Action 列表**:

| Action | 类型 | 说明 |
|--------|------|------|
| `apply` | create | 学生自主报名，验证微专业为 active，设置 pending |
| `approve` | update | 教师批准，status → active，记录审核人和审核时间 |
| `reject` | update | 教师拒绝，status → rejected，填写理由并记录审核时间 |
| `reapply` | update | 被拒学生重新报名，pending + 清空拒绝原因 |
| `list_pending` | read | 教师端查看待审批列表（按 micro_major_id + status = pending） |
| `my_applications` | read | 学生端查看自己的报名申请记录（含审核状态） |

**关键 Action 代码**:

```elixir
# ── 学生报名 ──
create :apply do
  description "Student applies to a micro major (micro_major must be :active)"
  accept [:micro_major_id]

  change set_attribute(:student_id, actor(:id))
  change set_attribute(:status, :pending)
  change set_attribute(:assigned_at, &DateTime.utc_now/0)

  # 验证微专业状态为 active，禁止报名 draft/archived 微专业
  change fn changeset, _context ->
    mm_id = Ash.Changeset.get_argument(changeset, :micro_major_id)
    tenant = changeset.tenant

    mm = Ash.get!(KgEdu.MajorAnalysis.MicroMajor, mm_id,
      tenant: tenant,
      actor: changeset.actor
    )

    if mm.status != :active do
      Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidAttribute.exception(
        field: :micro_major_id,
        message: "该微专业暂未开放报名"
      ))
    else
      changeset
    end
  end
end

# ── 审核通过 ──
update :approve do
  description "Approve a student's micro major application"
  accept [:notes]
  require_atomic? false

  change set_attribute(:status, :active)
  change set_attribute(:reviewed_by_id, actor(:id))
  change set_attribute(:reviewed_at, &DateTime.utc_now/0)
end

# ── 审核拒绝 ──
update :reject do
  description "Reject a student's micro major application"
  accept [:rejected_reason, :notes]
  require_atomic? false

  change set_attribute(:status, :rejected)
  change set_attribute(:reviewed_by_id, actor(:id))
  change set_attribute(:reviewed_at, &DateTime.utc_now/0)
end

# ── 重新报名（被拒后）──
update :reapply do
  description "Re-apply after rejection"
  accept []
  require_atomic? false

  change set_attribute(:status, :pending)
  change set_attribute(:rejected_reason, nil)
  change set_attribute(:assigned_at, &DateTime.utc_now/0)

  # 验证当前状态必须是 rejected
  change fn changeset, _ ->
    case Ash.Changeset.get_attribute(changeset, :status) do
      :rejected -> changeset
      _ -> Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidAttribute.exception(
        field: :status,
        message: "只能对已拒绝的报名重新申请"
      ))
    end
  end
end

# ── 教师端待审批列表 ──
read :list_pending do
  description "List pending enrollments for a micro major"
  argument :micro_major_id, :uuid, allow_nil?: false
  filter expr(micro_major_id == ^arg(:micro_major_id) and status == :pending)

  prepare fn query, _context ->
    Ash.Query.load(query, :student)
  end
end

# ── 学生端查看报名记录 ──
read :my_applications do
  description "Get current student's application history"

  prepare fn query, context ->
    Ash.Query.filter(query, student_id == ^actor(:id))
    |> Ash.Query.load(:micro_major)
  end
end
```

### 1.3 可选：`by_micro_major` 增加 status 过滤参数

**文件**: `backend/.../micro_major_enrollment.ex`，现有 `read :by_micro_major` action

新增可选 `status` 参数，方便教师端按状态筛选，避免前端全量加载后过滤：

```elixir
read :by_micro_major do
  description "Get student enrollments for a micro major, optionally filtered by status"
  argument :micro_major_id, :uuid, allow_nil?: false
  argument :status, :atom, allow_nil?: true  # 新增可选
  filter expr(
    micro_major_id == ^arg(:micro_major_id) and
    (is_nil(^arg(:status)) or status == ^arg(:status))
  )

  prepare fn query, _context ->
    Ash.Query.load(query, :student)
  end
end
```

### 1.4 code_interface 注册

在 `MicroMajorEnrollment` 的 `code_interface do` 块中新增：

```elixir
define :apply_to_micro_major, action: :apply
define :approve_enrollment, action: :approve
define :reject_enrollment, action: :reject
define :reapply_to_micro_major, action: :reapply
define :list_pending_enrollments, action: :list_pending
define :my_applications, action: :my_applications
```

### 1.5 Domain 注册 RPC

**文件**: `backend/kg_edu/lib/kg_edu/major_analysis.ex`

在 `MajorAnalysis` domain 的 micro_major_enrollment 资源中新增 RPC actions：

```elixir
resource KgEdu.MajorAnalysis.MicroMajorEnrollment do
  rpc_action :assign_student_to_micro_major, :create
  rpc_action :remove_student_from_micro_major, :destroy
  # 新增：
  rpc_action :apply_to_micro_major, :apply
  rpc_action :approve_enrollment, :approve
  rpc_action :reject_enrollment, :reject
  rpc_action :reapply_to_micro_major, :reapply
  rpc_action :list_pending_enrollments, :list_pending
  rpc_action :my_applications, :my_applications
end
```

### 1.6 数据库迁移

**文件**: `backend/kg_edu/priv/repo/tenant_migrations/YYYYMMDDHHMMSS_add_mm_enrollment_application.exs`

```elixir
def change do
  alter table(:micro_major_enrollments) do
    add :rejected_reason, :text
    add :reviewed_at, :utc_datetime
    add :reviewed_by_id, :uuid
  end
end
```

**执行**:
```bash
mix ash.migrate --tenants
```

### 1.7 状态字段说明与排序

在 status 属性的 `description` 中注明枚举含义（可选增强可读性）：

```elixir
attribute :status, :atom do
  allow_nil? false
  public? true
  default :active
  constraints one_of: [:pending, :active, :rejected, :completed, :removed]
  description "状态：pending(报名待审), active(已批准/已分配), rejected(已拒绝), completed(已完成), removed(已移除)"
end
```

---

## Part 2: 前端 - TypeScript API 生成

### 2.1 生成 TS API

```bash
cd backend/kg_edu
mix ash.codegen "add_mm_enrollment_apply"
mix ash.migrate && mix ash.migrate --tenants
mix ash.gen.typescript
```

这将自动更新 `kg-edu-vite-antd/src/lib/ash_rpc.ts`，生成以下函数：
- `applyToMicroMajor`
- `approveEnrollment`
- `rejectEnrollment`
- `reapplyToMicroMajor`
- `listPendingEnrollments`
- `myApplications`

---

## Part 3: 前端 - 学生端报名入口

### 3.1 公开微专业详情页增加报名按钮

**文件**: `kg-edu-vite-antd/src/pages/micro-major-detail.tsx`

**改动**:
- 在微专业详情页的信息区域，增加"报名申请"按钮
- 逻辑：
  - 如果用户未登录 → 跳转登录页
  - 查询 `myApplications` 判断当前用户对当前微专业的报名状态
  - **状态判断**：查找 `myApplications` 中 `microMajorId === 当前微专业 ID` 的记录
    - 无记录 → 显示"报名申请"按钮
    - `pending` → 显示橙色标签"审核中"
    - `active` → 显示绿色标签"已通过"
    - `rejected` → 显示红色标签"已拒绝"+ 拒绝原因 + "重新报名"按钮（调用 `reapplyToMicroMajor`）
- 报名成功后 → 显示成功提示，"报名成功，等待教师审核"

### 3.2 学生端"我的微专业"页面增加报名入口与状态展示

**文件**: `kg-edu-vite-antd/src/pages/student/micro-majors.tsx`

**改动**：
- 在页面顶部增加"报名微专业"按钮 → 跳转到公开微专业列表 `/micro-majors`
- 在"暂无关联微专业"的空状态中，增加"浏览可报名微专业"链接
- **查询 `myApplications` 合并展示**：将 `myMicroMajorEnrollments`（已分配/已批准的）和 `myApplications`（自主报名的）合并展示

**状态标签规则**:

| 状态 | 标签颜色 | 文字 |
|------|---------|------|
| `pending` | orange/warning | 审核中 |
| `active` | green/success | 已通过 |
| `rejected` | red/error | 已拒绝 |
| `completed` | blue | 已完成 |

**审核拒绝的卡片**：
- 显示拒绝原因（如果有）
- 显示"重新报名"按钮 → 调用 `reapplyToMicroMajor` → 刷新列表

---

## Part 4: 前端 - 教师端审批功能

### 4.1 微专业学生管理页面增加审批 Tab

**文件**: `kg-edu-vite-antd/src/pages/teacher/micro-major-students.tsx`

**改动**:
- 将原有页面从单列表改为 **Tabs 布局**，三个 Tab：

**(a) "待审核" Tab**
  - 数据源：`listPendingEnrollments(microMajorId)`
  - 表格列: 序号、学生姓名、学号、班级、报名时间
  - 操作列：
    - ✅ **批准** → 调用 `approveEnrollment(enrollmentId)`
    - ❌ **拒绝** → 弹出 Modal 填写拒绝原因 → 调用 `rejectEnrollment(enrollmentId, reason)`
  - 批准/拒绝后刷新列表

**(b) "已通过 / 已分配" Tab**（复用现有功能）
  - 保留原有的"批量添加学生"按钮 + 已分配学生列表
  - 数据源：`listEnrollmentsByMicroMajor(microMajorId)` + 前端过滤 status == active

**(c) "已拒绝" Tab**
  - 数据源：`listEnrollmentsByMicroMajor(microMajorId)` + 前端过滤 status == rejected
  - 表格列: 学生姓名、学号、拒绝原因、报名时间、操作（可重新批准）

### 4.2 教师端导航增加提示

**文件**: 微专业 Layout 侧边栏（`micro-major-layout.tsx` 的 MENU_ITEMS）

- 确保"学生管理"菜单项在侧边栏可见
- 在待审核学生数量 > 0 时，在菜单项上显示 Badge 计数

---

## Part 5: 学生端查看审核结果

### 5.1 我的微专业列表状态展示

已在 Part 3.2 实现：
- 状态标签（审核中/已通过/已拒绝）
- 拒绝原因展示
- 重新报名入口

### 5.2 微专业详情页状态同步

在 `/micro-majors/:tenant/:id` 页面：
- 查询 `myApplications` 判断当前用户是否已报名该微专业
- 根据状态显示不同的 UI（报名按钮 / 审核中 / 已通过 / 已拒绝+重新报名）

---

## 执行顺序

```
Part 1 (后端模型) → Part 2 (TS API 生成) → Part 3 (学生端) → Part 4 (教师端) → Part 5 (审核结果展示)
```

## 关键文件清单

| # | 文件 | 操作 |
|---|------|------|
| 1 | `backend/.../micro_major_enrollment.ex` | 扩展 status, 新增 actions + fields |
| 2 | `backend/.../major_analysis.ex` | 注册新 RPC |
| 3 | `backend/.../tenant_migrations/..._add_mm_enrollment_application.exs` | 新迁移文件 |
| 4 | `kg-edu-vite-antd/src/lib/ash_rpc.ts` | 自动生成（Part 2） |
| 5 | `kg-edu-vite-antd/src/pages/micro-major-detail.tsx` | 增加报名按钮 + 状态展示 |
| 6 | `kg-edu-vite-antd/src/pages/student/micro-majors.tsx` | 增加报名入口 + 状态展示 + 重新报名 |
| 7 | `kg-edu-vite-antd/src/pages/teacher/micro-major-students.tsx` | 增加审批 Tab（待审核/已通过/已拒绝） |
| 8 | `kg-edu-vite-antd/src/pages/teacher/mm-students-page.tsx` | 可选优化 |

## 数据流示意图

```
学生报名 (apply)
  │
  ▼
micro_major_enrollments.status = "pending"  (assigned_at 记录报名时间)
  │
  ▼
教师端审批列表 ←── 查询 listPendingEnrollments(mmId)
  │
  ├─ 批准 (approve) ──→ status = "active"
  │                      reviewed_at, reviewed_by_id 记录审核时间/人
  │                      ──→ 学生端可见"已通过"
  │
  └─ 拒绝 (reject) ──→ status = "rejected"
                         rejected_reason 记录拒绝原因
                         reviewed_at, reviewed_by_id 记录审核时间/人
                         ──→ 学生端可见拒绝原因
                               │
                               ▼
                         点击"重新报名"(reapply)
                               │
                               ▼
                          status = "pending"
                          rejected_reason = nil
                          ──→ 重新进入待审核
```

## 状态机

```
                              ┌──────────┐
                              │  PENDING  │ (学生报名 / 重新报名)
                              └────┬─────┘
                                   │
                     ┌─────────────┼─────────────┐
                     ▼             ▼             ▼
                 ┌──────┐   ┌──────────┐   ┌──────────┐
                 │ACTIVE│   │ REJECTED │   │ (REMOVED)│
                 └──┬───┘   └────┬─────┘   └──────────┘
                    │            │
                    │            └── reapply ──→ PENDING (重新报名)
                    ▼
              ┌───────────┐
              │ COMPLETED  │
              └───────────┘
```

---

## 设计决策说明

| 决策 | 说明 |
|------|------|
| **policy 保持 `always()`** | 当前微专业模块沿用已有策略，不对审批 action 做额外权限控制。后续可按需细化 |
| **`apply` 验证微专业为 active** | 禁止学生报名草稿或已归档的微专业，避免无效申请 |
| **`reviewed_at` / `reviewed_by_id`** | `assigned_by_id` 已有"分配者"语义，新增独立审核字段避免语义混淆 |
| **`reapply` 独立 action** | 受唯一约束限制不能重新 create，故用 update 实现 rejected → pending 流转；重新报名时清空拒绝原因 |
| **`approve` 接受 `notes`** | 教师批准时可填写备注，灵活应对不同场景 |
| **迁移兼容** | 新增字段均有默认 null，已有 `active/completed/removed` 记录不受影响 |
