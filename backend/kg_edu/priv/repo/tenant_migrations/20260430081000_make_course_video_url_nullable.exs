defmodule KgEdu.Repo.TenantMigrations.MakeVideoUrlNullable do
  use Ecto.Migration

  def up do
    alter table(:course_videos, prefix: prefix()) do
      modify :video_url, :text, null: true
    end
  end

  def down do
    alter table(:course_videos, prefix: prefix()) do
      modify :video_url, :text, null: false
    end
  end
end
