defmodule KgEdu.Repo.TenantMigrations.AddCourseIdToEmailMessages do
  @moduledoc """
  Adds course_id to email_messages, linking email Q&A messages to the course
  they were initiated from.
  """

  use Ecto.Migration

  def up do
    alter table(:email_messages, prefix: prefix()) do
      add :course_id,
          references(:courses,
            column: :id,
            type: :uuid,
            prefix: prefix(),
            name: "email_messages_course_id_fkey"
          )
    end

    create index(:email_messages, [:course_id], prefix: prefix(), name: "email_messages_course_id_index")
  end

  def down do
    drop_if_exists index(:email_messages, [:course_id], prefix: prefix(), name: "email_messages_course_id_index")

    alter table(:email_messages, prefix: prefix()) do
      remove :course_id
    end
  end
end