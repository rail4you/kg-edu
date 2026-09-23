# Spec — Form Assignment & Review

## ADDED Requirements

### Capability: assign-form

The system SHALL allow a teacher to publish a `FormAssignment` to one or many students in the same tenant.

- When the teacher clicks "分配" on a `FormDef`, the system SHALL open a student picker modal.
- The picker SHALL list all users in the current tenant with `role == :user`.
- The picker SHALL allow selecting zero or more students.
- Confirming the picker with at least one student selected SHALL create one `FormAssignment` row per student with `status: :pending`, `assigned_by_id` set to the current user, and an optional `due_at`.
- The system SHALL display a success message containing the number of assignments created.
- The system SHALL NOT create assignments for students who already have a pending assignment for the same form (idempotency at UI layer; backend may surface an error but should not duplicate rows).

### Capability: revoke-assignment

The system SHALL allow a teacher to revoke a `FormAssignment` while it is still `:pending`.

- Selecting "撤回" on a pending assignment row SHALL destroy the row.
- Selecting "撤回" on a submitted assignment SHALL be disabled and the UI SHALL explain why.

### Capability: student-fill-assignment

The system SHALL allow a student to view, fill, and submit `FormAssignment`s assigned to them.

- The student dashboard SHALL include a "数据表单" entry visible in the main navigation.
- The page SHALL list all assignments for the current student grouped as "待填写" (`status == :pending`) and "已提交" (`status == :submitted`).
- Selecting a pending assignment SHALL open a fill UI showing the form `schema` rendered as labelled fields (text / textarea / number / date / radio / checkbox / select / image / attachment / formula) preserving required markers and the existing AI 填表 shortcut.
- The fill UI SHALL validate that every `required` field has a value before allowing submission.
- Submitting SHALL atomically:
  1. Create a `FormSubmission` with `assignment_id` set to the current assignment and `submitter_id` set to the current student.
  2. Update the assignment `status` to `:submitted`.
- After a successful submit, the assignment SHALL appear under "已提交" with `status: 待审核`.
- The student SHALL NOT be able to view or fill assignments belonging to other students (enforced by the `by_student` filter reading the current user's id).

### Capability: teacher-review-submissions

The system SHALL allow a teacher to approve or reject any `FormSubmission` belonging to the same tenant.

- The "学生表单" tab SHALL list all submissions in the current tenant with `status: :submitted` (expandable to all).
- Each row SHALL display: 学生 (resolved from `submitter_id`), 表单标题, 提交时间, answers (rendered read-only key/value).
- Per submitted row the teacher SHALL have 批准 / 驳回 actions that write the matching status to the submission.
- The assignment row in "分配记录" SHALL show the latest submission status once the assignment transitions to `:submitted`.

## MODIFIED Requirements

### Capability: form-template (existing)

The existing "创建表单" UI on `/teacher/dashboard/custom-form` SHALL keep working but move into the first tab of a tabbed layout. New behavior additions:

- The form list under the builder SHALL gain a per-row 分配 button as specified in `assign-form`.
- The 单列表 (审批 row inside the existing review block) SHALL be removed in favor of the new "学生表单" tab.

### Capability: student-my-forms (existing)

`pages/student/my-forms.tsx` is the legacy single-file page that currently lists all tenant forms with no assignment. It SHALL be deprecated and routed only via `/student/dashboard/data-forms`. The legacy file SHALL be left untouched for backward compatibility but may be removed in a future change.
