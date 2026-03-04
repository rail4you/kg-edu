defmodule KgEdu.KnowledgeNestedHierarchy do
  @moduledoc """
  Module for fetching and processing knowledge hierarchy with proper nesting.
  Call this from your controller or API endpoint to return fully nested data.
  """

  require Ash.Query
  alias KgEdu.Knowledge.Resource

  @doc """
  Get fully nested hierarchy for a course.
  Returns subjects with units and cells nested up to 7 levels deep.

  ## Example

      {:ok, nested_hierarchy} = KgEdu.KnowledgeNestedHierarchy.get(%{
        course_id: "course_uuid",
        tenant: "org_tenant"
      })
  """
  def get(params) do
    course_id = params[:course_id] || params["course_id"]
    tenant = params[:tenant] || params["tenant"]

    # Use the existing action to fetch hierarchy
    case Resource.get_full_hierarchy(%{course_id: course_id}, tenant: tenant) do
      {:ok, subjects} ->
        # Build nested structure
        nested_subjects = build_nested_hierarchy(subjects)
        {:ok, nested_subjects}

      {:error, error} ->
        {:error, error}
    end
  end

  # Build nested hierarchy from subjects
  defp build_nested_hierarchy(subjects) when is_list(subjects) do
    Enum.map(subjects, fn subject ->
      # Process units to build nested cell hierarchy
      nested_units =
        subject.child_units
        |> case do
          %{__records__: records} when is_list(records) -> records
          list when is_list(list) -> list
          _ -> []
        end
        |> Enum.sort_by(fn unit -> unit.sort_path || "" end)
        |> Enum.map(&build_unit_nested_cells/1)

      # Return subject with nested units
      subject
      |> Map.put(:child_units, nested_units)
      |> Map.delete(:child_units__records__)
    end)
  end

  # Build nested cells for a unit
  defp build_unit_nested_cells(unit) do
    # Get level 3 cells (direct children of unit)
    level_3_cells = get_cells_from_unit(unit)

    # Process each level 3 cell to include its nested children (level 4+)
    nested_cells =
      level_3_cells
      |> Enum.sort_by(fn cell -> cell.sort_path || "" end)
      |> Enum.map(fn cell ->
        # Get nested child cells (level 4+) if they exist
        nested_children = get_nested_child_cells(cell)

        # If there are nested children, recursively process them
        if length(nested_children) > 0 do
          # Build the nested structure for this cell
          cell
          |> Map.put(:nestedChildCells, build_nested_cell_children(nested_children))
          |> Map.delete(:nested_child_cells)
        else
          # No nested children, return as is
          cell
        end
      end)

    # Return unit with nested cells
    unit
    |> Map.put(:child_cells, nested_cells)
    |> Map.delete(:child_cells__records__)
  end

  # Recursively build nested cell children
  defp build_nested_cell_children(cells) when is_list(cells) do
    cells
    |> Enum.sort_by(fn cell -> cell.sort_path || "" end)
    |> Enum.map(fn cell ->
      # Get nested children of this cell
      nested_children = get_nested_child_cells(cell)

      if length(nested_children) > 0 do
        cell
        |> Map.put(:nestedChildCells, build_nested_cell_children(nested_children))
        |> Map.delete(:nested_child_cells)
      else
        cell
      end
    end)
  end

  # Get nested child cells from a cell
  defp get_nested_child_cells(cell) do
    case Map.get(cell, :nested_child_cells) do
      %{__records__: records} when is_list(records) -> records
      list when is_list(list) -> list
      _ -> []
    end
  end

  # Extract cells from unit structure
  defp get_cells_from_unit(unit) do
    case unit.child_cells do
      %{__records__: records} when is_list(records) -> records
      cells when is_list(cells) -> cells
      _ -> []
    end
  end
end
