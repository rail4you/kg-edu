defmodule KgEdu.Repo.TenantMigrations.AddMissingCurriculumDesignsFields do
  @moduledoc """
  Add missing fields to curriculum_designs table.
  Uses raw SQL to avoid duplicate column errors.
  """
  use Ecto.Migration

  def up do
    execute("""
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'curriculum_designs' AND column_name = 'file_url') THEN
          ALTER TABLE curriculum_designs ADD COLUMN file_url text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'curriculum_designs' AND column_name = 'markdown_content') THEN
          ALTER TABLE curriculum_designs ADD COLUMN markdown_content text;
        END IF;
      END $$;
    """, "")
  end

  def down do
    # No-op since we're not removing columns in down
    :ok
  end
end
