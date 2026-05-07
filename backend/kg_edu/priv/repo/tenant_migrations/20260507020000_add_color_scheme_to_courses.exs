defmodule KgEdu.Repo.TenantMigrations.AddColorSchemeToCourses do
  use Ecto.Migration

  def up do
    alter table(:courses) do
      add :color_scheme, :string, default: "auto"
    end
  end

  def down do
    alter table(:courses) do
      remove :color_scheme
    end
  end
end
