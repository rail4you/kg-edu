defmodule KgEdu.Repo.Migrations.CreateCourseAssignments do
  use Ecto.Migration

  def change do
    # Fresh-install guard: this migration predates the recreation of the
    # users/courses tables, so FK targets may not exist yet when
    # bootstrapping a new DB. Create plain uuid columns in that case; the
    # follow-up codegen migration backfills the foreign keys.
    users_exists? = table_exists?("users")
    courses_exists? = table_exists?("courses")

    create table(:course_assignments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :role, :string, null: false, default: "assistant_teacher"
      add :assigned_at, :utc_datetime_usec, null: false, default: fragment("now()")

      if users_exists? do
        add :assigned_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)
      else
        add :assigned_by_id, :uuid
      end

      if courses_exists? do
        add :course_id, references(:courses, type: :binary_id, on_delete: :delete_all), null: false
      else
        add :course_id, :uuid, null: false
      end

      if users_exists? do
        add :teacher_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      else
        add :teacher_id, :uuid, null: false
      end

      timestamps()
    end

    create unique_index(:course_assignments, [:course_id, :teacher_id])
    create index(:course_assignments, [:course_id])
    create index(:course_assignments, [:teacher_id])
    create index(:course_assignments, [:role])
  end

  defp table_exists?(table) do
    %{rows: [[exists?]]} =
      Ecto.Adapters.SQL.query!(
        repo(),
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [table]
      )

    exists?
  end
end
