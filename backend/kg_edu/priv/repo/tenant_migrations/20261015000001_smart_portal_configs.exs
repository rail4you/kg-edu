defmodule KgEdu.Repo.TenantMigrations.SmartPortalConfigs do
  @moduledoc """
  教师端智慧门户配置表（租户 schema）。

  每位教师一条记录，包含门户布局（6 个 AI 实践功能 + 展示模块）与分配学生列表。
  """

  use Ecto.Migration

  def up do
    create table(:smart_portal_configs, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :teacher_id, :uuid, null: false
      add :name, :text, default: "智慧门户"
      add :enabled, :boolean, null: false, default: true
      add :layout, :map, null: false, default: %{}
      add :student_ids, {:array, :uuid}, null: false, default: []

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create unique_index(:smart_portal_configs, [:teacher_id], prefix: prefix())
  end

  def down do
    drop table(:smart_portal_configs, prefix: prefix())
  end
end
