defmodule KgEdu.Repo.TenantMigrations.AddDiscussionSessionIdToDiscussions do
  @moduledoc """
  Adds discussion_session_id foreign key to discussions table.

  This column was manually added in some tenants but missed in the migration system.
  It allows discussions to optionally belong to a discussion session.
  """

  use Ecto.Migration

  def up do
    schema = prefix()

    execute """
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '#{schema}'
            AND table_name = 'discussions'
            AND column_name = 'discussion_session_id'
        ) THEN
          ALTER TABLE #{schema}.discussions
            ADD COLUMN discussion_session_id uuid
            CONSTRAINT discussions_discussion_session_id_fkey
            REFERENCES #{schema}.discussion_sessions(id)
            ON DELETE SET NULL;
        END IF;
      END $$;
    """
  end

  def down do
    schema = prefix()

    execute """
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '#{schema}'
            AND table_name = 'discussions'
            AND column_name = 'discussion_session_id'
        ) THEN
          ALTER TABLE #{schema}.discussions DROP COLUMN discussion_session_id;
        END IF;
      END $$;
    """
  end
end
