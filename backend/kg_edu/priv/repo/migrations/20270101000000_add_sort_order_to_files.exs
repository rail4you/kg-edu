defmodule KgEdu.Repo.Migrations.AddSortOrderToFiles do
  @moduledoc """
  Adds sort_order column to files table for teacher-manual ordering,
  synced to the student side listing order.
  """

  use Ecto.Migration

  def up do
    alter table(:files) do
      add :sort_order, :integer, default: 0
    end
  end

  def down do
    alter table(:files) do
      remove :sort_order
    end
  end
end