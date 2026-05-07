defmodule KgEdu.Repo.Migrations.AddColorSchemeToCourses do
  use Ecto.Migration

  def change do
    alter table(:courses) do
      add :color_scheme, :string, default: "auto"
    end
  end
end
