defmodule KgEdu.Repo.TenantMigrations.CreateCurriculumDesignsTableIfNotExists do
  @moduledoc """
  Create curriculum_designs table only if it doesn't exist.
  Uses raw SQL for cross-database compatibility.
  """
  use Ecto.Migration

  def up do
    execute("""
      CREATE TABLE IF NOT EXISTS curriculum_designs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        design_data TEXT,
        file_url TEXT,
        markdown_content TEXT,
        ai_generated BOOLEAN NOT NULL DEFAULT false,
        version BIGINT NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'draft',
        major_id UUID NOT NULL,
        inserted_at TIMESTAMP(6) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
      );
    """, "DROP TABLE IF EXISTS curriculum_designs;")
  end

  def down do
    # No-op - we don't want to drop the table on rollback
    :ok
  end
end
