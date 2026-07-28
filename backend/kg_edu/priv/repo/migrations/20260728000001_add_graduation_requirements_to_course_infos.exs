defmodule KgEdu.Repo.Migrations.AddGraduationRequirementsToCourseInfos do
  @moduledoc """
  Adds graduation_requirements column to course_infos table.
  """
  use Ecto.Migration

  def up do
    alter table(:course_infos) do
      add :graduation_requirements, :text
    end
  end

  def down do
    alter table(:course_infos) do
      remove :graduation_requirements
    end
  end
end
