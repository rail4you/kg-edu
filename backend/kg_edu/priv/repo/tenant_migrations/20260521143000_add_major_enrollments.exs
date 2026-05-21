defmodule KgEdu.Repo.TenantMigrations.AddMajorEnrollments do
  use Ecto.Migration

  def up do
    create table(:major_enrollments, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true

      add :major_id,
          references(:majors,
            column: :id,
            name: "major_enrollments_major_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :student_id,
          references(:users,
            column: :id,
            name: "major_enrollments_student_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :assigned_by_id,
          references(:users,
            column: :id,
            name: "major_enrollments_assigned_by_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :nilify_all
          )

      add :status, :text, null: false, default: "active"
      add :progress, :float, null: false, default: 0.0
      add :notes, :text
      add :assigned_at, :utc_datetime_usec, null: false, default: fragment("(now() AT TIME ZONE 'utc')")
      add :completed_at, :utc_datetime_usec

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create unique_index(:major_enrollments, [:major_id, :student_id],
             name: "major_enrollments_major_student_unique",
             prefix: prefix()
           )

    create index(:major_enrollments, [:student_id], prefix: prefix())
    create index(:major_enrollments, [:major_id], prefix: prefix())
  end

  def down do
    drop_if_exists table(:major_enrollments, prefix: prefix())
  end
end
