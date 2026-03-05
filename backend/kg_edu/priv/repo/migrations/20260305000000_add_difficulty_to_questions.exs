defmodule KgEdu.Repo.Migrations.AddDifficultyToQuestions do
  @moduledoc """
  Add difficulty field to knowledge_questions table
  """

  use Ecto.Migration

  def up do
    alter table(:knowledge_questions) do
      add(:difficulty, :integer, default: 1, null: true)
    end
  end

  def down do
    alter table(:knowledge_questions) do
      remove(:difficulty)
    end
  end
end
