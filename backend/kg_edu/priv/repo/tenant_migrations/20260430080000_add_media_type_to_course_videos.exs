defmodule KgEdu.Repo.TenantMigrations.AddMediaTypeToCourseVideos do
  use Ecto.Migration

  def up do
    alter table(:course_videos, prefix: prefix()) do
      add :media_type, :text, null: false, default: "video"
    end
  end

  def down do
    alter table(:course_videos, prefix: prefix()) do
      remove :media_type
    end
  end
end
