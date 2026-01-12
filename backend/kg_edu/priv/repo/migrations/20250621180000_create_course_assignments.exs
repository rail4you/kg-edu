defmodule KgEdu.Repo.Migrations.CreateCourseAssignments do
  use Ecto.Migration

  def change do
    create table(:course_assignments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :role, :string, null: false, default: "assistant_teacher"
      add :assigned_at, :utc_datetime_usec, null: false, default: fragment("now()")
      add :assigned_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      add :course_id, references(:courses, type: :binary_id, on_delete: :delete_all), null: false
      add :teacher_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false

      timestamps()
    end

    create unique_index(:course_assignments, [:course_id, :teacher_id])
    create index(:course_assignments, [:course_id])
    create index(:course_assignments, [:teacher_id])
    create index(:course_assignments, [:role])
  end
end