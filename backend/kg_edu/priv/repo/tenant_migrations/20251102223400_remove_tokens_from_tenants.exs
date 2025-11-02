defmodule KgEdu.Repo.TenantMigrations.RemoveTokensFromTenants do
  @moduledoc """
  Remove tokens table from tenant schemas since tokens should be global for authentication.
  """

  use Ecto.Migration

  def up do
    drop table(:tokens, prefix: prefix())
  end

  def down do
    create table(:tokens, primary_key: false, prefix: prefix()) do
      add :jti, :text, null: false, primary_key: true
      add :subject, :text, null: false
      add :expires_at, :utc_datetime, null: false
      add :purpose, :text, null: false
      add :extra_data, :map

      add :created_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end
  end
end