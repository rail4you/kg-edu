defmodule KgEdu.Repo.TenantMigrations.SmartPortalAllowMultiplePerTeacher do
  @moduledoc """
  允许每位教师创建多个智慧门户：去掉 teacher_id 唯一约束，改为普通索引。
  """

  use Ecto.Migration

  def up do
    drop unique_index(:smart_portal_configs, [:teacher_id], prefix: prefix())
    create index(:smart_portal_configs, [:teacher_id], name: :smart_portal_configs_teacher_id_idx, prefix: prefix())
  end

  def down do
    drop index(:smart_portal_configs, [:teacher_id], name: :smart_portal_configs_teacher_id_idx, prefix: prefix())
    create unique_index(:smart_portal_configs, [:teacher_id], prefix: prefix())
  end
end
