defmodule KgEdu.Repo.Migrations.CreateOrganizationBackupsTable do
  @moduledoc """
  Create organization_backups table for tracking SQL backups.
  """

  use Ecto.Migration

  def up do
    create table(:organization_backups) do
      add :backup_id, :string, primary_key: true
      add :organization_id, :uuid, null: false
      add :file_path, :text, null: false
      add :file_size, :bigint, null: false, default: 0
      add :backup_type, :string, null: false, default: "manual"
      add :metadata, :jsonb, null: true, default: "{}"
      add :created_at, :utc_datetime_usec, null: false, default: fragment("NOW()")
      add :restored_at, :utc_datetime_usec, null: true
      add :restored_to, :uuid, null: true
      add :created_by, :string, null: true

      timestamps()
    end

    create index(:organization_backups, [:organization_id])
    create index(:organization_backups, [:created_at])
    create index(:organization_backups, [:backup_type])
    create index(:organization_backups, [:restored_at])
  end

  def down do
    drop table(:organization_backups)
  end
end