defmodule KgEdu.Repo.TenantMigrations.AddGraduationRequirementsToCourseInfos do
  @moduledoc """
  Adds graduation_requirements column to course_infos table in tenant schemas.
  """
  use Ecto.Migration

  def up do
    alter table(:course_infos, prefix: prefix()) do
      add :graduation_requirements, :text
    end
  end

  def down do
    alter table(:course_infos, prefix: prefix()) do
      remove :graduation_requirements
    end
  end
end
