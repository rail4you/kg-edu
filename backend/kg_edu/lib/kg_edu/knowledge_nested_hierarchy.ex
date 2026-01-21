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
        |> Enum.map(&build_unit_nested_cells/1)

      # Return subject with nested units
      subject
      |> Map.put(:child_units, nested_units)
      |> Map.delete(:child_units__records__)
    end)
  end

  # Build nested cells for a unit
  defp build_unit_nested_cells(unit) do
    all_cells = get_cells_from_unit(unit)

    # Build nested hierarchy based on parent_knowledge_resource_id
    nested_cells =
      if Enum.all?(all_cells, fn c -> is_nil(c.parent_knowledge_resource_id) end) do
        # If no parent_knowledge_resource_id set, auto-nest by creation order
        Resource.auto_nest_cells_by_order(all_cells, level_3_count: 2)
      else
        # Use existing parent_knowledge_resource_id relationships
        Resource.build_nested_cell_hierarchy(all_cells)
      end

    # Return unit with nested cells
    unit
    |> Map.put(:child_cells, nested_cells)
    |> Map.delete(:child_cells__records__)
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
