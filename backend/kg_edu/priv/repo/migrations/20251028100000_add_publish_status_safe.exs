defmodule KgEdu.Repo.Migrations.AddPublishStatusSafe do
  @moduledoc """
  Safely adds publish_status field if it doesn't exist
  """

  use Ecto.Migration

  def up do
    # Check if column exists before adding
    try do
      execute("ALTER TABLE courses ADD COLUMN IF NOT EXISTS publish_status BOOLEAN DEFAULT true")
    rescue
      Postgrex.Error -> 
        # Column might already exist, ignore error
        :ok
    end
  end

  def down do
    # Remove column if it exists
    execute("ALTER TABLE courses DROP COLUMN IF EXISTS publish_status")
  end
end