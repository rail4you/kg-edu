defmodule KgEdu.Repo.TenantMigrations.CreateCurriculumDesignsTableIfNotExists do
  @moduledoc """
  Create curriculum_designs table only if it doesn't exist.
  This handles the case where table was created in a different migration.
  """
  use Ecto.Migration

  def change do
    execute("""
      CREATE TABLE IF NOT EXISTS curriculum_designs (
        id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
        title text NOT NULL,
        description text,
        design_data text,
        file_url text,
        markdown_content text,
        ai_generated boolean NOT NULL DEFAULT false,
        version bigint NOT NULL DEFAULT 1,
        status text NOT NULL DEFAULT 'draft',
        major_id uuid NOT NULL,
        inserted_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    """, "Create curriculum_designs table if not exists")

    execute("""
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'curriculum_designs_major_id_fkey'
        ) THEN
          ALTER TABLE curriculum_designs 
          ADD CONSTRAINT curriculum_designs_major_id_fkey 
          FOREIGN KEY (major_id) REFERENCES majors(id) ON DELETE CASCADE;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    """, "Add foreign key constraint if not exists")

    execute("""
      CREATE INDEX IF NOT EXISTS curriculum_designs_major_id_index 
      ON curriculum_designs(major_id)
    """, "Create index on major_id")
  end
end