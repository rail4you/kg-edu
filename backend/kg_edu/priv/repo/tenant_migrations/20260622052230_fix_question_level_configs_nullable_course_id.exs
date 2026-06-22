defmodule KgEdu.Repo.TenantMigrations.FixQuestionLevelConfigsNullableCourseId do
  @moduledoc """
  Makes question_level_configs.course_id nullable — some legacy data
  has global-level configs not tied to a specific course.
  """

  use Ecto.Migration

  def up do
    execute("ALTER TABLE #{prefix()}.question_level_configs ALTER COLUMN course_id DROP NOT NULL")
  end

  def down do
    execute("ALTER TABLE #{prefix()}.question_level_configs ALTER COLUMN course_id SET NOT NULL")
  end
end
