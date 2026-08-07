defmodule KgEdu.Repo.Migrations.AddObanJobsTable do
  use Ecto.Migration

  def up do
    Oban.Migrations.up(version: 13)
  end

  def down do
    Oban.Migrations.down(version: 13)
  end
end
