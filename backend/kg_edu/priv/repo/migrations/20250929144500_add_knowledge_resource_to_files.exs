defmodule KgEdu.Repo.Migrations.AddKnowledgeResourceToFiles do
  use Ecto.Migration

  def change do
    alter table(:files) do
      add :knowledge_resource_id, references(:knowledge_resources, type: :uuid, on_delete: :nilify_all)
    end

    create index(:files, [:knowledge_resource_id])
  end
end