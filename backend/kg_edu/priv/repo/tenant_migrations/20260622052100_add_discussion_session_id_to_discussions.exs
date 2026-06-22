defmodule KgEdu.Repo.TenantMigrations.AddDiscussionSessionIdToDiscussions do
  @moduledoc """
  Adds discussion_session_id foreign key to discussions table.

  This column was manually added in some tenants but missed in the migration system.
  It allows discussions to optionally belong to a discussion session.
  """

  use Ecto.Migration

  def up do
    alter table(:discussions, prefix: prefix()) do
      add :discussion_session_id,
          references(:discussion_sessions,
            column: :id,
            name: "discussions_discussion_session_id_fkey",
            type: :uuid,
            prefix: prefix(),
            on_delete: :nilify_all
          )
    end
  end

  def down do
    alter table(:discussions, prefix: prefix()) do
      remove :discussion_session_id
    end
  end
end
