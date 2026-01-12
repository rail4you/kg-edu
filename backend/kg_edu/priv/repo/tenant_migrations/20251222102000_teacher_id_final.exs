defmodule KgEdu.Repo.TenantMigrations.TeacherIdFinal do
  @moduledoc """
  Add teacher_id column to courses table in all tenant schemas.
  """

  use Ecto.Migration

  def up do
    # Check if column exists using raw SQL
    column_exists =
      case repo().query(
             """
             SELECT COUNT(*)
             FROM information_schema.columns
             WHERE table_schema = $1
             AND table_name = 'courses'
             AND column_name = 'teacher_id'
             """,
             [prefix()]
           ) do
        {:ok, %{rows: [[count]]}} when count > 0 -> true
        _ -> false
      end

    if !column_exists do
      alter table(:courses, prefix: prefix()) do
        add :teacher_id, references(:users, type: :uuid), null: true
      end
    end
  end

  def down do
    alter table(:courses, prefix: prefix()) do
      remove :teacher_id
    end
  end
end