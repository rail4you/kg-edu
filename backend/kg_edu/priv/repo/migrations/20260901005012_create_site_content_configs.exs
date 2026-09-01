defmodule KgEdu.Repo.Migrations.CreateSiteContentConfigs do
  use Ecto.Migration

  def change do
    create table(:site_content_configs, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :key, :string, null: false
      add :about_intro, :text
      add :contact_email, :string
      add :contact_address, :string
      add :contact_hours, :string
      add :privacy_policy, :text

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:site_content_configs, [:key])
  end
end