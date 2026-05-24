defmodule KgEdu.Repo.TenantMigrations.AddMicroMajorCourseModel do
  use Ecto.Migration

  def up do
    alter table(:majors, prefix: prefix()) do
      add_if_not_exists :cover_url, :text
      add_if_not_exists :intro, :text
      add_if_not_exists :target_audience, :text
      add_if_not_exists :talent_direction, :text
      add_if_not_exists :school_name, :text
      add_if_not_exists :credit, :float
      add_if_not_exists :period, :bigint
      add_if_not_exists :sort_order, :bigint, null: false, default: 0
      add_if_not_exists :published_at, :utc_datetime
    end

    create_if_not_exists table(:major_courses, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true

      add :major_id,
          references(:majors,
            column: :id,
            name: "major_courses_major_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :course_id,
          references(:courses,
            column: :id,
            name: "major_courses_course_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :course_type, :text, null: false, default: "required"
      add :support_role, :text, null: false, default: "core"
      add :sort_order, :bigint, null: false, default: 0
      add :credit, :float
      add :period, :bigint
      add :description, :text

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create_if_not_exists unique_index(:major_courses, [:major_id, :course_id],
                           name: "major_courses_major_course_unique",
                           prefix: prefix()
                         )

    create_if_not_exists index(:major_courses, [:major_id], prefix: prefix())
    create_if_not_exists index(:major_courses, [:course_id], prefix: prefix())

    create_if_not_exists table(:competency_course_supports, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true

      add :major_competency_id,
          references(:major_competencies,
            column: :id,
            name: "competency_course_supports_competency_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :course_id,
          references(:courses,
            column: :id,
            name: "competency_course_supports_course_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          ),
          null: false

      add :support_level, :text, null: false, default: "primary"
      add :description, :text
      add :weight, :float, null: false, default: 1.0

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create_if_not_exists unique_index(
                           :competency_course_supports,
                           [:major_competency_id, :course_id],
                           name: "competency_course_supports_unique",
                           prefix: prefix()
                         )

    create_if_not_exists index(:competency_course_supports, [:major_competency_id],
                           prefix: prefix()
                         )

    create_if_not_exists index(:competency_course_supports, [:course_id], prefix: prefix())
  end

  def down do
    drop_if_exists table(:competency_course_supports, prefix: prefix())
    drop_if_exists table(:major_courses, prefix: prefix())

    alter table(:majors, prefix: prefix()) do
      remove_if_exists :published_at, :utc_datetime_usec
      remove_if_exists :sort_order, :bigint
      remove_if_exists :period, :bigint
      remove_if_exists :credit, :float
      remove_if_exists :school_name, :text
      remove_if_exists :talent_direction, :text
      remove_if_exists :target_audience, :text
      remove_if_exists :intro, :text
      remove_if_exists :cover_url, :text
    end
  end
end
