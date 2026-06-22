defmodule KgEdu.Repo.Migrations.AddApiKeyConfigs do
  @moduledoc """
  Adds the api_key_configs table for storing AI provider API keys.
  This is a global table (public schema, no tenant context).
  """

  use Ecto.Migration

  def up do
    create table(:api_key_configs, primary_key: false) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :provider, :string, null: false
      add :api_key, :text, null: false
      add :base_url, :text

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create unique_index(:api_key_configs, [:provider],
             name: "api_key_configs_unique_provider_index"
           )
  end

  def down do
    drop_if_exists unique_index(:api_key_configs, [:provider],
                     name: "api_key_configs_unique_provider_index"
                   )

    drop table(:api_key_configs)
  end
end
