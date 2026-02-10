defmodule :"Elixir.KgEdu.Repo.TenantMigrations.AddCategoryAndTeachingGoalToKnowledgeResources" do
  @moduledoc """
  Adds category and teaching_goal columns to knowledge_resources table.
  """

  use Ecto.Migration

  def up do
    alter table(:knowledge_resources, prefix: prefix()) do
      add :category, :text
      add :teaching_goal, :text
    end
  end

  def down do
    alter table(:knowledge_resources, prefix: prefix()) do
      remove :teaching_goal
      remove :category
    end
  end
end
