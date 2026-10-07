defmodule KgEdu.Repo.TenantMigrations.PracticeSessions do
  @moduledoc """
  互动实践共享会话表（租户 schema）。
  """

  use Ecto.Migration

  def up do
    create table(:practice_sessions, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :token, :text, null: false
      add :scenario, :text, null: false, default: "interactive_story"
      add :title, :text
      add :course_id, :uuid
      add :teacher_id, :uuid
      add :student_id, :uuid
      add :transcript, {:array, :map}
      add :score, :bigint
      add :report, :text
      add :status, :text, null: false, default: "open"

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create index(:practice_sessions, [:token], prefix: prefix())
  end

  def down do
    drop table(:practice_sessions, prefix: prefix())
  end
end
