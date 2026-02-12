defmodule KgEdu.Repo.TenantMigrations.AddDifficultyToExercises do
  @moduledoc """
  Adds difficulty column to exercises table (idempotent - safe to run multiple times)
  """

  use Ecto.Migration

  def up do
    # Check if column already exists before adding
    prefix = prefix()

    column_exists =
      case repo().query(
             "SELECT column_name FROM information_schema.columns WHERE table_name = 'exercises' AND table_schema = $1 AND column_name = 'difficulty'",
             [prefix]
           ) do
        {:ok, %{rows: []}} -> false
        {:ok, %{rows: _}} -> true
        _ -> false
      end

    unless column_exists do
      alter table(:exercises, prefix: prefix) do
        add :difficulty, :integer
      end
    end
  end

  def down do
    alter table(:exercises, prefix: prefix()) do
      remove :difficulty
    end
  end
end
