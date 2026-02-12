defmodule KgEdu.Repo.Migrations.AddJobTitleAndBioToUsers do
  @moduledoc """
  Add job_title and bio columns to users table
  """

  use Ecto.Migration

  def up do
    alter table(:users) do
      add :job_title, :text, comment: "职称 (Job Title)"
      add :bio, :text, comment: "个人简介 (Personal Bio)"
    end
  end

  def down do
    alter table(:users) do
      remove :bio
      remove :job_title
    end
  end
end
