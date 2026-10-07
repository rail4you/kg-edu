defmodule KgEdu.Repo.Migrations.CreateSmartPortalLayouts do
  use Ecto.Migration

  def change do
    create table(:smart_portal_layouts, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :key, :string, null: false
      add :name, :string
      add :layout, :map, default: %{}
      add :enabled, :boolean, null: false, default: true

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:smart_portal_layouts, [:key])
  end
end
