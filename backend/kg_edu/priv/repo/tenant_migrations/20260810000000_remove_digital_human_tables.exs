defmodule KgEdu.Repo.TenantMigrations.RemoveDigitalHumanTables do
  @moduledoc """
  Removes digital human module tables (moved to digital-human-studio).

  This file was manually created to drop tables previously added by:
    - add_digital_human_tasks
    - add_camera_scripts
    - add_chroma_key_records
  """

  use Ecto.Migration

  def up do
    drop_if_exists table(:chroma_key_records, prefix: prefix())
    drop_if_exists table(:camera_scripts, prefix: prefix())
    drop_if_exists table(:digital_human_tasks, prefix: prefix())
  end

  def down do
    create table(:digital_human_tasks, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :text
      add :status, :text, null: false, default: "queued"
      add :progress_message, :text
      add :image_url, :text
      add :audio_url, :text
      add :video_url, :text
      add :dashscope_task_id, :text
      add :resolution, :text, default: "480P"
      add :error_message, :text
      add :created_by_id, :uuid

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create table(:camera_scripts, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :text
      add :status, :text, null: false, default: "draft"
      add :scenes, :jsonb
      add :video_url, :text
      add :error_message, :text
      add :created_by_id, :uuid

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create table(:chroma_key_records, primary_key: false, prefix: prefix()) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :source_image_url, :text, null: false
      add :result_image_url, :text
      add :color, :text, null: false, default: "green"
      add :similarity, :float, null: false, default: 0.4
      add :blend, :float, null: false, default: 0.1
      add :yuv, :boolean, null: false, default: true
      add :despill, :boolean, null: false, default: false
      add :created_by_id, :uuid

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end
  end
end
