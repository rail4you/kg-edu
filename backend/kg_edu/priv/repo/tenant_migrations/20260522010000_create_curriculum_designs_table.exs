defmodule KgEdu.Repo.TenantMigrations.CreateCurriculumDesignsTable do
  @moduledoc """
  Create curriculum_designs table for major analysis.
  """
  use Ecto.Migration

  def change do
    create table(:curriculum_designs, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :text, null: false
      add :description, :text
      add :design_data, :text
      add :file_url, :text
      add :markdown_content, :text
      add :ai_generated, :boolean, null: false, default: false
      add :version, :bigint, null: false, default: 1
      add :status, :text, null: false, default: "draft"

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :major_id, :uuid, null: false
    end

    alter table(:curriculum_designs, prefix: prefix()) do
      modify :major_id,
             references(:majors,
               column: :id,
               name: "curriculum_designs_major_id_fkey",
               type: :uuid,
               prefix: prefix(),
               on_delete: :delete_all
             )
    end

    create index(:curriculum_designs, [:major_id], prefix: prefix())
  end
end