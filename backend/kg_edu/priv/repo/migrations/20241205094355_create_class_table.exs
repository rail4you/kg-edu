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

    # Add class_id foreign key to users table
    alter table(:users) do
      add :class_id, references(:classes, type: :uuid, on_delete: :nilify_all)
    end

    # Create index for class_id in users table for better performance
    create index(:users, [:class_id])
  end

  def down do
    # Remove class_id from users table
    alter table(:users) do
      remove :class_id
    end

    # Drop classes table
    drop table(:classes)
  end
end
