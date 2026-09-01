defmodule KgEdu.Repo.Migrations.CreateCourseCategoryTables do
  use Ecto.Migration

  def change do
    # 门户课程类别（首页推荐/新开等模块 + 课程列表页 Tab）
    create table(:course_categories, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string, null: false
      add :slug, :string, null: false
      add :sort_order, :integer, null: false, default: 0
      add :enabled, :boolean, null: false, default: true

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:course_categories, [:slug])

    # 类别下的课程项（租户 + 课程）
    create table(:course_category_items, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :category_id, references(:course_categories, type: :uuid, on_delete: :delete_all),
        null: false
      add :tenant_schema, :string, null: false
      add :course_id, :uuid, null: false
      add :sort_order, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create index(:course_category_items, [:category_id])
    create index(:course_category_items, [:tenant_schema, :course_id])
  end
end
