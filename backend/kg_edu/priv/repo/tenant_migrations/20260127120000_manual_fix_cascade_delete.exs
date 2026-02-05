defmodule KgEdu.Repo.TenantMigrations.ManualFixCascadeDelete do
  @moduledoc """
  Manual migration to fix CASCADE DELETE on all knowledge_resources foreign keys.
  Run this for each tenant schema that needs fixing.
  """

  use Ecto.Migration

  def up do
    tenant = prefix()

    # Fix knowledge_resources self-referential constraints
    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      DROP CONSTRAINT IF EXISTS knowledge_resources_parent_subject_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      ADD CONSTRAINT knowledge_resources_parent_subject_id_fkey 
      FOREIGN KEY (parent_subject_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      DROP CONSTRAINT IF EXISTS knowledge_resources_parent_unit_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      ADD CONSTRAINT knowledge_resources_parent_unit_id_fkey 
      FOREIGN KEY (parent_unit_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      DROP CONSTRAINT IF EXISTS knowledge_resources_parent_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_resources 
      ADD CONSTRAINT knowledge_resources_parent_knowledge_resource_id_fkey 
      FOREIGN KEY (parent_knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix files table
    execute """
    ALTER TABLE "#{tenant}".files 
      DROP CONSTRAINT IF EXISTS files_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".files 
      ADD CONSTRAINT files_knowledge_resource_id_fkey 
      FOREIGN KEY (knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix videos table
    execute """
    ALTER TABLE "#{tenant}".videos 
      DROP CONSTRAINT IF EXISTS videos_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".videos 
      ADD CONSTRAINT videos_knowledge_resource_id_fkey 
      FOREIGN KEY (knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix homeworks table
    execute """
    ALTER TABLE "#{tenant}".homeworks 
      DROP CONSTRAINT IF EXISTS homeworks_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".homeworks 
      ADD CONSTRAINT homeworks_knowledge_resource_id_fkey 
      FOREIGN KEY (knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix knowledge_questions table
    execute """
    ALTER TABLE "#{tenant}".knowledge_questions 
      DROP CONSTRAINT IF EXISTS knowledge_questions_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_questions 
      ADD CONSTRAINT knowledge_questions_knowledge_resource_id_fkey 
      FOREIGN KEY (knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix user_cases table
    execute """
    ALTER TABLE "#{tenant}".user_cases 
      DROP CONSTRAINT IF EXISTS user_cases_knowledge_resource_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".user_cases 
      ADD CONSTRAINT user_cases_knowledge_resource_id_fkey 
      FOREIGN KEY (knowledge_resource_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix knowledge_relations table - source_knowledge_id
    execute """
    ALTER TABLE "#{tenant}".knowledge_relations 
      DROP CONSTRAINT IF EXISTS knowledge_relations_source_knowledge_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_relations 
      ADD CONSTRAINT knowledge_relations_source_knowledge_id_fkey 
      FOREIGN KEY (source_knowledge_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """

    # Fix knowledge_relations table - target_knowledge_id
    execute """
    ALTER TABLE "#{tenant}".knowledge_relations 
      DROP CONSTRAINT IF EXISTS knowledge_relations_target_knowledge_id_fkey
    """

    execute """
    ALTER TABLE "#{tenant}".knowledge_relations 
      ADD CONSTRAINT knowledge_relations_target_knowledge_id_fkey 
      FOREIGN KEY (target_knowledge_id) 
      REFERENCES "#{tenant}".knowledge_resources(id) 
      ON DELETE CASCADE
    """
  end

  def down do
    # No rollback needed - the previous state is the same as without CASCADE
  end
end
