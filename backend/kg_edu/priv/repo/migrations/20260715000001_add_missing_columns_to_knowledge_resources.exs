defmodule KgEdu.Repo.Migrations.AddMissingColumnsToKnowledgeResources do
  @moduledoc """
  Adds missing columns to public.knowledge_resources that exist in tenant schemas.
  """
  use Ecto.Migration

  def up do
    alter table(:knowledge_resources) do
      add :parent_knowledge_resource_id, :uuid
      add :tag, :text
      add :dimension, :text
      add :category, :text
      add :teaching_goal, :text
      add :en_name, :text
      add :sort_path, :text, default: ""
      add :display_order, :bigint
    end
  end

  def down do
    alter table(:knowledge_resources) do
      remove :display_order
      remove :sort_path
      remove :en_name
      remove :teaching_goal
      remove :category
      remove :dimension
      remove :tag
      remove :parent_knowledge_resource_id
    end
  end
end
