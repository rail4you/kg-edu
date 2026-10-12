defmodule KgEdu.Repo.TenantMigrations.AddCourseIdToCheckInSessions do
  @moduledoc """
  Adds course_id to check_in_sessions, linking a check-in session to the course
  it was initiated from.
  """

  use Ecto.Migration

  def up do
    alter table(:check_in_sessions, prefix: prefix()) do
      add :course_id,
          references(:courses,
            column: :id,
            type: :uuid,
            prefix: prefix(),
            name: "check_in_sessions_course_id_fkey"
          )
    end

    create index(:check_in_sessions, [:course_id],
             prefix: prefix(),
             name: "check_in_sessions_course_id_index"
           )
  end

  def down do
    drop_if_exists index(:check_in_sessions, [:course_id],
                     prefix: prefix(),
                     name: "check_in_sessions_course_id_index"
                   )

    alter table(:check_in_sessions, prefix: prefix()) do
      remove :course_id
    end
  end
end
