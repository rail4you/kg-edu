defmodule KgEdu.Repo.TenantMigrations.AddQuestionLevelConfigs do
  @moduledoc """
  Adds question_level_configs table for question difficulty level configuration.

  Stores visual properties (label, description, color) for each question level
  (e.g. global, concept, method) used in exercises and question management.
  """

  use Ecto.Migration

  def up do
    create_if_not_exists table(:question_level_configs, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :level_key, :text, null: false
      add :label, :text, null: false
      add :description, :text
      add :color, :text
      add :position, :bigint, default: 0

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :course_id,
          references(:courses,
            column: :id,
            name: "question_level_configs_course_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :delete_all
          )
    end

    execute """
      CREATE UNIQUE INDEX IF NOT EXISTS question_level_configs_course_level_key_index
      ON #{prefix()}.question_level_configs (course_id, level_key)
    """
  end

  def down do
    execute """
      DROP INDEX IF EXISTS #{prefix()}.question_level_configs_course_level_key_index
    """
    execute """
      ALTER TABLE #{prefix()}.question_level_configs DROP CONSTRAINT IF EXISTS question_level_configs_course_id_fkey
    """
    execute """
      DROP TABLE IF EXISTS #{prefix()}.question_level_configs
    """
  end
end
