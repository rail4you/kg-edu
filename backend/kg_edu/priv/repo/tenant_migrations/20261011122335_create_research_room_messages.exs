defmodule KgEdu.Repo.TenantMigrations.CreateResearchRoomMessages do
  @moduledoc """
  Creates the research_room_messages table for the 虚拟教研室.
  """

  use Ecto.Migration

  def up do
    create table(:research_room_messages, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :text, null: false
      add :content, :text, null: false
      add :author_label, :text
      add :read_status, :text, null: false, default: "unread"
      add :participated, :boolean, null: false, default: false

      add :posted_at, :utc_datetime,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :author_id,
          references(:users,
            column: :id,
            name: "research_room_messages_author_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :nilify_all
          )

      add :course_id,
          references(:courses,
            column: :id,
            name: "research_room_messages_course_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :nilify_all
          )
    end

    create index(:research_room_messages, [:author_id], prefix: prefix())
    create index(:research_room_messages, [:course_id], prefix: prefix())
  end

  def down do
    drop table(:research_room_messages, prefix: prefix())
  end
end
