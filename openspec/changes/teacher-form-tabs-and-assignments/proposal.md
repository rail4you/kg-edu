# Teacher Form Tabs, Assignments & Student Filling Flow

## Problem

The current `/teacher/dashboard/custom-form` page mixes three responsibilities into one screen:
1. Creating / editing form templates (`FormDef`)
2. Approving individual student submissions
3. There is **no assignment step** — teachers have no way to publish a form to specific students, and students currently see every template the tenant has ever created.

On the student side, `my-forms.tsx` lists *all* templates in the tenant, with no per-student targeting. Mobile experience is acceptable but the page is not surfaced in the main navigation, so students can't find it.

## Goal

Split the teacher page into clear tabs and introduce a real **assignment → fill → review** workflow:

- **Teacher** — configure templates in one tab, assign them to students in another, and review submissions in a third.
- **Student** — see only the forms assigned to them in a main-nav tab on mobile, fill them in, and submit.

## Scope

### Backend (Ash)

- New resource `FormAssignment` linking `form_id` + `student_user_id` with status (`pending` / `submitted`) and optional due date.
- Read actions on `FormAssignment` to list assignments by form, by student, and globally.
- Update `FormSubmission` so a submission is always tied to an assignment (`assignment_id`), preserving tenant-isolated review.

### Frontend — Teacher

- Rewrite `pages/teacher/custom-form.tsx` into a tabbed layout:
  - **表单模板** — existing create/edit flow plus a new "assign" action per row that opens a student picker.
  - **分配记录** — table of assignments (form, student, status, due date) with the ability to revoke a pending assignment.
  - **学生表单** — review pending submissions across forms, with approve/reject actions.
- New API helper `listFormAssignments` (and friends) wired through the regenerated `ash_rpc.ts`.

### Frontend — Student

- New student page `pages/student/data-forms.tsx` (route `/dashboard/data-forms`) listing the user's assignments grouped by status, with a mobile-first fill UI.
- Add a "数据表单" entry to the student's main nav (`student-layout.tsx`) under the "工具" or "互动" group.
- Submitting an assignment creates a `FormSubmission` tied to that assignment and flips the assignment status to `submitted` (review UI on teacher side picks it up).

## Non-Goals

- Push notifications / in-app alerts when a new assignment is published (out of scope — teacher already sees pending assignments in the table).
- Bulk-CSV import of student lists for assignment (single-select picker only in this iteration; can be added later).
- Editing a submitted answer (students can re-submit only if a teacher explicitly re-opens it — admin flow deferred).

## Dependencies

- Reuses existing `FormsAiController` (`/api/forms/ai-fill`, `/api/forms/ai-formula`) — no new AI endpoints.
- Reuses `evaluateFormula` from `src/lib/practice.ts` for live computation of formula fields.
- Multitenancy: every new read/write goes through the existing `set_tenant` Ash context — no cross-tenant leakage.

## Risks

- **Migration**: adding `FormAssignment` requires a new migration. Must run `./dev.sh codegen teacher_form_tabs` then `./dev.sh migrate`.
- **Regeneration**: `ash_rpc.ts` is auto-generated; new RPC actions force a full regeneration. Frontend must use the regenerated names verbatim.
- **Backfill**: existing `form_submissions` (if any) pre-date this change and have no `assignment_id`. Migration adds the column as nullable so historical rows remain readable; the teacher review path falls back to "未分配" display.
