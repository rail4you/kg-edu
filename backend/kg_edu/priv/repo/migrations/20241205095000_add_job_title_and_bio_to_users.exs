defmodule KgEdu.Repo.Migrations.AddJobTitleAndBioToUsers do
  @moduledoc """
  Add job_title and bio columns to users table
  """

  use Ecto.Migration

  def up do
    # Fresh-install guard: users table is recreated by a later migration,
    # so it may not exist yet when bootstrapping a new DB.
    if table_exists?("users") do
      alter table(:users) do
        add :job_title, :text, comment: "职称 (Job Title)"
        add :bio, :text, comment: "个人简介 (Personal Bio)"
      end
    end
  end

  def down do
    if column_exists?("users", "bio") do
      alter table(:users) do
        remove :bio
      end
    end

    if column_exists?("users", "job_title") do
      alter table(:users) do
        remove :job_title
      end
    end
  end

  defp table_exists?(table) do
    %{rows: [[exists?]]} =
      Ecto.Adapters.SQL.query!(
        repo(),
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)",
        [table]
      )

    exists?
  end

  defp column_exists?(table, column) do
    %{rows: [[exists?]]} =
      Ecto.Adapters.SQL.query!(
        repo(),
        "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2)",
        [table, column]
      )

    exists?
  end
end
