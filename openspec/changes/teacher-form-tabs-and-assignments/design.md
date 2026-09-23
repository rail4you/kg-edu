# Design — Teacher Form Tabs & Assignments

## Overview

This change introduces a complete assignment lifecycle around the existing custom-form module:

```
┌──────────────┐  assign   ┌─────────────────┐  submit   ┌──────────────────┐
│ FormDef      │ ────────▶ │ FormAssignment  │ ────────▶ │ FormSubmission   │
│ (template)   │           │ per-student ptr │           │ (filled answers) │
└──────────────┘           └─────────────────┘           └──────────────────┘
                                                                    │
                                                                    ▼
                                                            Teacher reviews
                                                            approve / reject
```

## Backend

### 1. New `FormAssignment` resource

`backend/kg_edu/lib/kg_edu/forms/form_assignment.ex`

- Attributes
  - `id` uuid PK
  - `form_id` uuid (FK → form_defs, required)
  - `student_id` uuid (FK → users, required)
  - `due_at` utc_datetime (nullable)
  - `status` atom `one_of: [:pending, :submitted]` (default `:pending`)
  - `assigned_by_id` uuid (nullable FK → users)
  - timestamps

- Relationships
  - `belongs_to :form, KgEdu.Forms.FormDef`
  - `belongs_to :student, KgEdu.Accounts.User`
  - `belongs_to :assigned_by, KgEdu.Accounts.User`
  - `has_one :submission, KgEdu.Forms.FormSubmission` (via assignment_id)

- Actions
  - `create :assign_to_students` — accepts `form_id`, list of `student_ids`, optional `due_at`, `assigned_by_id`; creates one assignment per student in a single transaction.
  - `update :mark_submitted` — sets `status: :submitted` and links to a freshly created submission.
  - `destroy :revoke` — destroy a pending assignment.
  - `read :by_form` — `filter form_id == ^arg(:form_id)`.
  - `read :by_student` — `filter student_id == ^arg(:student_id)`.
  - `read :list` — default pagination-enabled read (so admin can list all).

- Multitenancy: `strategy :context` matching the rest of the Forms domain.

- Policies: `policy always() do authorize_if always() end` (matches sibling resources for now).

### 2. Update `FormSubmission`

Add a nullable `assignment_id` attribute and matching `belongs_to` to `FormAssignment`. Submission creation is now performed by `FormAssignment.mark_submitted` (creating the submission and updating the assignment in one transaction via `Ash.transact/1`).

### 3. `Forms` domain

`backend/kg_edu/lib/kg_edu/forms.ex`

```elixir
resource KgEdu.Forms.FormAssignment do
  rpc_action(:assign_form_to_students, :assign_to_students)
  rpc_action(:mark_form_submitted, :mark_submitted)
  rpc_action(:revoke_form_assignment, :revoke)
  rpc_action(:get_form_assignment, :read)
  rpc_action(:list_form_assignments, :read)
  rpc_action(:list_form_assignments_by_form, :by_form)
  rpc_action(:list_form_assignments_by_student, :by_student)
end
```

Also add `:mark_form_submitted` and `:assignment_id` to the submission RPC block.

## Frontend — Teacher

### `pages/teacher/custom-form.tsx` (rewrite)

Top-level `<Tabs>` with three panels, all sharing the same page chrome (the "移动端自定义表单" header is repurposed as a plain page title).

1. **表单模板** — keep the existing form builder card, but extract the template listing into its own `<Card>` below it. Per-row actions:
   - 编辑 (loads template into the builder)
   - 分配 (opens modal: multi-select students in tenant + optional due date)
   - 删除

2. **分配记录** — table of all `FormAssignment`s for the tenant (filterable by form). Columns: 表单标题, 学生, 分配时间, 截止时间, 状态. Per-row: 撤回 (destroy pending assignment); when status=submitted, link to "学生表单" tab filtered to that student.

3. **学生表单** — table of all pending `FormSubmission`s across the tenant. Filtering UI (按表单 / 按学生) and approve / reject per row.

### Student picker modal

`Modal` + `Select mode="multiple"` over `list_users_from_tenant` filtered to `role == :user`, with searchable names. Live "已选 N 人" counter.

## Frontend — Student

### New page `pages/student/data-forms.tsx`

Mobile-first card list:

- Section **待填写** (pending assignments) → tap → fill form (`FieldRenderer` mirror of `my-forms.tsx`).
- Section **已提交** (submitted) → tap → read-only view of the answers and reviewer status (approved / rejected / pending).

Uses `list_form_assignments_by_student` + per-assignment `get_form_def` + `list_form_submissions_by_submitter`.

### Routing

`App.tsx`: add `<Route path="data-forms" element={<StudentDataForms />} />` inside the `/dashboard` layout.

### Student navigation

Add to `student-layout.tsx` in the **互动** group:
```ts
{ key: "/dashboard/data-forms", label: "数据表单", icon: <FileTextOutlined /> },
```

## Key Design Decisions

1. **Assignment-per-student, not shared form link.** A teacher assigning a form to 30 students creates 30 `FormAssignment` rows. This keeps per-student status / due dates trivial and matches how `form_submissions_by_submitter` already queries.
2. **Status on assignment rather than separate "form_instance" table.** Cheaper for an MVP; can split later if we need versioning / locking.
3. **Student sidebar stays mobile-first.** The existing nav draws a drawer on mobile and a top bar on desktop; new entry uses `FileTextOutlined` for consistency with the Form section.
4. **No AI flow changes.** Existing `ai-fill` / `ai-formula` endpoints already work per-tenant — the student fill page reuses them 1:1.

## Trade-offs

- More rows in the DB for batch assignments → acceptable at the expected scale (one class per assignment cycle).
- Tabs in Antd add ~40 px vertical space vs the current two-column layout → offset by collapsing the right column into tabs.
- Forcing an `assignment_id` link on every future submission means a tiny backfill hazard for existing rows — handled by keeping the FK nullable + labelled "未分配" in the review UI.
