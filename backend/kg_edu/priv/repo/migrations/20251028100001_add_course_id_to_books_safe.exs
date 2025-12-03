defmodule KgEdu.Repo.Migrations.AddCourseIdToBooksSafe do
  @moduledoc """
  Safely adds course_id field to books table if it doesn't exist
  """

  use Ecto.Migration

  def up do
    # Add course_id column if it doesn't exist
    try do
      execute("ALTER TABLE books ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id)")
    rescue
      Postgrex.Error -> 
        # Column might already exist, ignore error
        :ok
    end

    # Create index if it doesn't exist
    try do
      create_if_not_exists unique_index(:books, [:course_id], name: "books_unique_course_book_index")
    rescue
      Postgrex.Error -> 
        # Index might already exist, ignore error
        :ok
    end
  end

  def down do
    drop_if_exists unique_index(:books, [:course_id], name: "books_unique_course_book_index")
    
    # Remove column if it exists
    execute("ALTER TABLE books DROP COLUMN IF EXISTS course_id")
  end
end