# Tasks — Teacher Form Tabs & Assignments

## Phase 1 · Backend resource

- [ ] 1.1 Create `backend/kg_edu/lib/kg_edu/forms/form_assignment.ex` with `FormAssignment` resource
  - attributes (`id`, `form_id`, `student_id`, `due_at`, `status`, `assigned_by_id`, timestamps)
  - relationships (`belongs_to :form`, `:student`, `:assigned_by`; `has_one :submission`)
  - actions `create :assign_to_students`, `update :mark_submitted`, `destroy :revoke`, `read :by_form`, `:by_student`, default `:read`
  - multitenancy `:context`, policies `always()`
- [ ] 1.2 Update `backend/kg_edu/lib/kg_edu/forms/form_submission.ex`
  - add `assignment_id` attribute (nullable) + `belongs_to :assignment, KgEdu.Forms.FormAssignment`
- [ ] 1.3 Update `backend/kg_edu/lib/kg_edu/forms.ex` to register `FormAssignment` rpc_actions + expose `assignment_id` on submission
- [ ] 1.4 Run `./dev.sh codegen teacher_form_tabs` and verify the migration is reasonable
- [ ] 1.5 Run `./dev.sh migrate`
- [ ] 1.6 Restart backend (`./dev.sh restart backend`) and curl `/rpc` health

## Phase 2 · Frontend types & helpers

- [ ] 2.1 Pull the regenerated types — confirm `list_form_assignments`, `assign_form_to_students`, `mark_form_submitted`, `revoke_form_assignment`, `list_form_assignments_by_form`, `list_form_assignments_by_student` are exported from `src/lib/ash_rpc.ts`
- [ ] 2.2 Add a thin `src/lib/forms.ts` wrapper exporting typed helpers so feature files don't import the giant generated module directly

## Phase 3 · Teacher page rewrite

- [ ] 3.1 Rewrite `src/pages/teacher/custom-form.tsx` into `<Tabs>` with three panels
- [ ] 3.2 Build the **表单模板** tab (builder + table), keeping the AI formula + AI fill controls
- [ ] 3.3 Build the **分配记录** tab
  - table of assignments (form, student, status, due_at)
  - per-row "撤回" action on pending rows
- [ ] 3.4 Build the **学生表单** tab
  - table of pending submissions across all forms
  - filter by form / by student
  - approve / reject actions
- [ ] 3.5 Implement the **分配** modal
  - student picker (`Select mode="multiple"` over `list_users_from_tenant` role==:user)
  - optional `DatePicker` for `due_at`
  - call `assign_form_to_students` and toast result

## Phase 4 · Student page

- [ ] 4.1 Create `src/pages/student/data-forms.tsx`
  - lists assignments (pending vs submitted) for `user.id`
  - tap → fill view; reuse the existing `renderField` pattern from `my-forms.tsx`
  - submit creates the submission and marks the assignment as submitted in one go via `mark_form_submitted`
- [ ] 4.2 Add `<Route path="data-forms" element={<StudentDataForms />}>` inside the `/dashboard` layout in `src/App.tsx`
- [ ] 4.3 In `src/layouts/student-layout.tsx`, add `数据表单` entry under the 互动 group with `FileTextOutlined`

## Phase 5 · Verification

- [ ] 5.1 `npm run lint` from `kg-edu-vite-antd/` — zero errors
- [ ] 5.2 `npm run build` — passes
- [ ] 5.3 Manual smoke: assign a form → fill as student → approve as teacher
