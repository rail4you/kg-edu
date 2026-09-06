defmodule KgEdu.Repo.Migrations.CreateClassTable do
  @moduledoc """
  Create classes table and add class_id to users table
  """

  use Ecto.Migration

  def up do
    # Create classes table
    create table(:classes, primary_key: false) do
      add :id, :uuid, primary_key: true, default: fragment("gen_random_uuid()")
      add :name, :text, null: false
      add :college, :text
      add :major, :text

      timestamps()
    end

    # Add unique index for class name combination
    create unique_index(:classes, [:name, :college, :major])

    # Add class_id foreign key to users table (only if users already exists;
    # on fresh installs users is created by a later migration, and the
    # follow-up codegen migration backfills this column)
    if table_exists?("users") do
      alter table(:users) do
        add :class_id, references(:classes, type: :uuid, on_delete: :nilify_all)
      end

      # Create index for class_id in users table for better performance
      create index(:users, [:class_id])
    end
  end

  def down do
    # Remove class_id from users table
    if column_exists?("users", "class_id") do
      alter table(:users) do
        remove :class_id
      end
    end

    # Drop classes table
    drop table(:classes)
  end

  # Fresh-install guard: this migration predates the users table recreation,
  # so the referenced table may not exist yet when bootstrapping a new DB.
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
