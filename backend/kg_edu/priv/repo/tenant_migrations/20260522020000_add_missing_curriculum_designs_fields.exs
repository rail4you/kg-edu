defmodule KgEdu.Repo.TenantMigrations.AddMissingCurriculumDesignsFields do
  @moduledoc """
  Add missing fields to curriculum_designs table.
  Uses Ecto DSL with tenant prefix.
  """
  use Ecto.Migration

  def change do
    alter table(:curriculum_designs, prefix: prefix()) do
      add :file_url, :text
      add :markdown_content, :text
    end
  end
end