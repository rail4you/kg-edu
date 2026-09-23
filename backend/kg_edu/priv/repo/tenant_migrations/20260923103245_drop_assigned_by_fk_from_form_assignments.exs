defmodule KgEdu.Repo.TenantMigrations.DropAssignedByFkFromFormAssignments do
  @moduledoc """
  form_assignments.assigned_by_id 的 DB 外键移除。

  背景：`KgEdu.Forms.FormAssignment` 不再声明 `belongs_to :assigned_by`，
  因为教师经常跨租户做分配，资源层 belongs_to 会在当前 schema 的 users 表里校验，
  会把外租户教师误判成"不存在"。
  student_id 和 form_id 仍是同租户引用，FK 保留；只有 assigned_by_id 放开。
  """

  use Ecto.Migration

  def up do
    drop_if_exists constraint(
                     :form_assignments,
                     "form_assignments_assigned_by_id_fkey",
                     prefix: prefix()
                   )
  end

  def down do
    execute(
      "ALTER TABLE form_assignments " <>
        "ADD CONSTRAINT form_assignments_assigned_by_id_fkey " <>
        "FOREIGN KEY (assigned_by_id) REFERENCES users(id)",
      ""
    )
  end
end
