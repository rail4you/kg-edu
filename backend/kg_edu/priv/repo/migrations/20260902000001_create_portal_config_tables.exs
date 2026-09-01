defmodule KgEdu.Repo.Migrations.CreatePortalConfigTables do
  use Ecto.Migration

  def change do
    # 门户学历层级（研究生 / 本科 / 高职 / 中职）
    create table(:portal_levels, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :level_key, :string, null: false
      add :title, :string, null: false
      add :subtitle, :string
      add :sort_order, :integer, null: false, default: 0

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:portal_levels, [:level_key])

    # 门户模板页（导航中「课程/微专业」之后的动态页面）
    create table(:template_pages, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string, null: false
      add :slug, :string, null: false
      add :overview, :text
      add :content, :text
      add :sort_order, :integer, null: false, default: 0
      add :enabled, :boolean, null: false, default: true

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:template_pages, [:slug])
  end
end
