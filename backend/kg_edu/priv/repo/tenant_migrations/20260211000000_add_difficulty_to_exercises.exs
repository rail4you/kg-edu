defmodule KgEdu.Repo.TenantMigrations.AddDifficultyToExercises do
  @moduledoc """
  Adds difficulty column to exercises table
  """

  use Ecto.Migration

  def up do
    alter table(:exercises, prefix: prefix()) do
      add :difficulty, :integer
    end
  end

  def down do
    alter table(:exercises, prefix: prefix()) do
      remove :difficulty
    end
  end
end
