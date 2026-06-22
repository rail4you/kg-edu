defmodule KgEdu.Repo.Migrations.AddDiscussionsTable do
  @moduledoc """
  Creates the discussions table for course evaluations.
  """

  use Ecto.Migration

  def up do
    create table(:discussions, primary_key: false) do
      add :id, :uuid, null: false, default: fragment("gen_random_uuid()"), primary_key: true
      add :title, :string, null: false, size: 200
      add :content, :text, null: false
      add :status, :string, null: false, default: "active"
      add :reply_count, :integer, null: false, default: 0
      add :view_count, :integer, null: false, default: 0
      add :rating, :integer, null: true, default: 5

      add :course_id, references(:courses, type: :uuid, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :uuid, on_delete: :nilify_all), null: true

      add :tenant, :string

      add :inserted_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")

      add :updated_at, :utc_datetime_usec,
        null: false,
        default: fragment("(now() AT TIME ZONE 'utc')")
    end

    create index(:discussions, [:course_id])
    create index(:discussions, [:tenant])
  end

  def down do
    drop table(:discussions)
  end
end
