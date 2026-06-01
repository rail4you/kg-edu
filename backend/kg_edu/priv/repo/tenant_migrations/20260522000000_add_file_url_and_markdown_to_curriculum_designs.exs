defmodule KgEdu.Repo.TenantMigrations.AddFileUrlAndMarkdownToCurriculumDesigns do
  @moduledoc """
  Add file_url and markdown_content to curriculum_designs table.
  """
  use Ecto.Migration

  def up do
    alter table(:curriculum_designs, prefix: prefix()) do
      add :file_url, :string
      add :markdown_content, :text
    end
  end

  def down do
    alter table(:curriculum_designs, prefix: prefix()) do
      remove :file_url
      remove :markdown_content
    end
  end
end
