defmodule KgEdu.Repo.TenantMigrations.CreateCurriculumDesignsTableIfNotExists do
  @moduledoc """
  Create curriculum_designs table only if it doesn't exist.
  Uses Ecto DSL with tenant prefix.
  """
  use Ecto.Migration

  def change do
    create_if_not_exists table(:curriculum_designs, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :text, null: false
      add :description, :text
      add :design_data, :text
      add :file_url, :text
      add :markdown_content, :text
      add :ai_generated, :boolean, null: false, default: false
      add :version, :bigint, null: false, default: 1
      add :status, :text, null: false, default: "draft"
      add :major_id, references(:majors, type: :uuid, prefix: prefix()), null: false

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end
  end
end