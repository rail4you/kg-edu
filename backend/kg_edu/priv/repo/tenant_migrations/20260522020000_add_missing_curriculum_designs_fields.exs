defmodule KgEdu.Repo.TenantMigrations.AddMissingCurriculumDesignsFields do
  @moduledoc """
  Add missing fields to curriculum_designs table.
  This migration runs AFTER the table creation migration and adds the new fields.
  """
  use Ecto.Migration

  def change do
    alter table(:curriculum_designs, prefix: prefix()) do
      add :file_url, :string
      add :markdown_content, :text
    end
  end
end