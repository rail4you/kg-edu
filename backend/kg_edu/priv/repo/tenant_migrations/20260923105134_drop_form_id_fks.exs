defmodule KgEdu.Repo.TenantMigrations.DropFormIdFks do
  @moduledoc """
  删除表单模板时，DB 层的 form_assignments_form_id_fkey 与
  form_submissions_form_id_fkey 会阻止 delete。放开这两个 FK，让"删除表单"
  操作直接成功（同时不会级联清掉相关分配记录 — 这是有意的，避免误删历史数据）。

  资源层 belongs_to :form 仍然存在，Ash 在 create/update 时会校验 form 存在
  于同租户 schema，所以数据完整性靠应用层保证。
  """

  use Ecto.Migration

  def up do
    drop_if_exists constraint(
                     :form_assignments,
                     "form_assignments_form_id_fkey",
                     prefix: prefix()
                   )

    drop_if_exists constraint(
                     :form_submissions,
                     "form_submissions_form_id_fkey",
                     prefix: prefix()
                   )
  end

  def down do
    execute(
      "ALTER TABLE form_assignments " <>
        "ADD CONSTRAINT form_assignments_form_id_fkey " <>
        "FOREIGN KEY (form_id) REFERENCES form_defs(id)",
      ""
    )

    execute(
      "ALTER TABLE form_submissions " <>
        "ADD CONSTRAINT form_submissions_form_id_fkey " <>
        "FOREIGN KEY (form_id) REFERENCES form_defs(id)",
      ""
    )
  end
end
