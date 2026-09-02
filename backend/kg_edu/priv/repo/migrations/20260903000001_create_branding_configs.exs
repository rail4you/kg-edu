defmodule KgEdu.Repo.Migrations.CreateBrandingConfigs do
  use Ecto.Migration

  def change do
    create table(:branding_configs, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :key, :string, null: false
      add :app_name, :string
      add :app_title, :string
      add :app_description, :text
      add :app_copyright, :text
      add :logo_light, :string
      add :logo_dark, :string
      add :favicon, :string
      add :contact_email, :string

      timestamps(type: :utc_datetime_usec)
    end

    create unique_index(:branding_configs, [:key])
  end
end
