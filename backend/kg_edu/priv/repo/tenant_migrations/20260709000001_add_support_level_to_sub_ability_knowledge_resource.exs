defmodule KgEdu.Repo.TenantMigrations.AddSupportLevelToSubAbilityKnowledgeResource do
  @moduledoc """
  Add support_level / weight / description to sub_ability_knowledge_resources.
  """

  use Ecto.Migration

  def up do
    alter table(:sub_ability_knowledge_resources, prefix: prefix()) do
      add :support_level, :text, null: false, default: "primary"
      add :weight, :float, null: false, default: 1.0
      add :description, :text
    end
  end

  def down do
    alter table(:sub_ability_knowledge_resources, prefix: prefix()) do
      remove :description
      remove :weight
      remove :support_level
    end
  end
end
