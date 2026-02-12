defmodule KgEdu.KnowledgeHierarchyHelper do
  @moduledoc """
  Helper module for restructing knowledge resource hierarchies.
  Use this to convert flat cell structures into proper nested hierarchies (levels 4-7).
  """

  require Ash.Query
  alias KgEdu.Knowledge.Resource

  @doc """
  Restructure cells under a unit to create proper nested hierarchy.

  Based on the cell names indicating levels (e.g., "四级知识点" = Level 4),
  this function reorganizes flat cells into a proper parent-child structure.

  ## Example

      # For unit with cells named like:
      # - "Level 3 Cell" (keeps parent_unit_id)
      # - "四级知识点" (Level 4, becomes child of Level 3)
      # - "五级知识点" (Level 5, becomes child of Level 4)
      # - etc.

      KgEdu.KnowledgeHierarchyHelper.restructure_unit_cells(
        "unit_uuid_here",
        tenant: "org_tenant"
      )
  """
  def restructure_unit_cells(unit_id, opts) do
    tenant = Keyword.fetch!(opts, :tenant)

    # Use a simpler approach - filter by attribute directly
    Resource
    |> Ash.Query.filter(parent_unit_id: unit_id)
    |> Ash.Query.sort(inserted_at: :asc)
    |> Ash.read(authorize?: false, tenant: tenant)
    |> case do
      {:ok, cells} when length(cells) > 0 ->
        IO.puts("Found #{length(cells)} cells under unit #{unit_id}")

        # Analyze cell names to determine hierarchy
        cells_with_levels =
          Enum.map(cells, fn cell ->
            level = extract_level_from_name(cell.name)
            {cell, level}
          end)

        # Group by detected level
        level_3_cells =
          Enum.filter(cells_with_levels, fn {_, level} -> level == 3 end)
          |> Enum.map(fn {cell, _} -> cell end)

        level_4_cells =
          Enum.filter(cells_with_levels, fn {_, level} -> level == 4 end)
          |> Enum.map(fn {cell, _} -> cell end)

        level_5_cells =
          Enum.filter(cells_with_levels, fn {_, level} -> level == 5 end)
          |> Enum.map(fn {cell, _} -> cell end)

        level_6_cells =
          Enum.filter(cells_with_levels, fn {_, level} -> level == 6 end)
          |> Enum.map(fn {cell, _} -> cell end)

        level_7_cells =
          Enum.filter(cells_with_levels, fn {_, level} -> level == 7 end)
          |> Enum.map(fn {cell, _} -> cell end)

        # If no level detected, use simple ordering (first 2 are level 3, rest are nested)
        {level_3_cells, nested_cells} =
          if Enum.all?(cells_with_levels, fn {_, level} -> is_nil(level) end) do
            IO.puts("No level patterns detected in names, using creation order")
            Enum.split(cells, 2)
          else
            {level_3_cells, level_4_cells ++ level_5_cells ++ level_6_cells ++ level_7_cells}
          end

        IO.puts("Level 3 cells: #{length(level_3_cells)}")
        IO.puts("Nested cells (4-7): #{length(nested_cells)}")

        # Update nested cells to use parent_knowledge_resource_id
        Enum.each(nested_cells, fn cell ->
          parent_id = find_parent_for_cell(cell, cells, level_3_cells)

          if parent_id do
            IO.puts("Updating cell '#{cell.name}' (#{cell.id}) to have parent #{parent_id}")

            cell
            |> Ash.Changeset.for_update(:update_knowledge_resource, %{
              parent_unit_id: nil,
              parent_subject_id: nil
            })
            |> Ash.Changeset.change_attribute(:parent_knowledge_resource_id, parent_id)
            |> Ash.update(authorize?: false, tenant: tenant)
            |> case do
              {:ok, updated} ->
                IO.puts("  ✓ Updated successfully")
                {:ok, updated}

              {:error, error} ->
                IO.puts("  ✗ Error: #{inspect(error)}")
                {:error, error}
            end
          else
            IO.puts("Skipping cell '#{cell.name}' - could not determine parent")
          end
        end)

        {:ok, %{level_3: length(level_3_cells), nested: length(nested_cells)}}

      {:ok, []} ->
        IO.puts("No cells found under unit #{unit_id}")
        {:ok, :no_cells}

      {:error, error} ->
        IO.puts("Error reading cells: #{inspect(error)}")
        {:error, error}
    end
  end

  # Extract level from Chinese cell names
  defp extract_level_from_name(name) do
    cond do
      String.contains?(name, "三级") -> 3
      String.contains?(name, "四级") -> 4
      String.contains?(name, "五级") -> 5
      String.contains?(name, "六级") -> 6
      String.contains?(name, "七级") -> 7
      true -> nil
    end
  end

  # Find the appropriate parent for a nested cell
  defp find_parent_for_cell(cell, all_cells, level_3_cells) do
    cell_level = extract_level_from_name(cell.name)
    cell_index = Enum.find_index(all_cells, fn c -> c.id == cell.id end)

    cond do
      # If level detected, find parent by level
      cell_level && cell_level > 3 ->
        # Find potential parent with level = cell_level - 1
        parent_cell =
          Enum.find(all_cells, fn c ->
            extract_level_from_name(c.name) == cell_level - 1
          end)

        if parent_cell, do: parent_cell.id, else: find_previous_cell(all_cells, cell_index)

      # For first 2 nested cells (index 2-3), use first level 3 cell as parent
      cell_index in [2, 3] ->
        if length(level_3_cells) > 0, do: Enum.at(level_3_cells, 0).id

      # For cells at index 4-5, use second level 3 cell as parent
      cell_index in [4, 5] ->
        if length(level_3_cells) > 1, do: Enum.at(level_3_cells, 1).id

      # For deeper levels, use previous cell as parent
      cell_index > 5 ->
        find_previous_cell(all_cells, cell_index)

      true ->
        nil
    end
  end

  # Find the previous cell in the list
  defp find_previous_cell(cells, index) when index > 0 do
    Enum.at(cells, index - 1).id
  end

  defp find_previous_cell(_, _), do: nil
end
