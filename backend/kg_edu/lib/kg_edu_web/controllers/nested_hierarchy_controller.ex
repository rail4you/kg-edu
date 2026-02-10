defmodule KgEduWeb.NestedHierarchyController do
  use KgEduWeb, :controller

  def get_nested_hierarchy(conn, %{"course_id" => course_id}) do
    # Extract tenant from the request
    # The tenant should be set by the KgEduWeb.Plug.SetTenantFromToken plug
    # Also allow tenant to be passed as query parameter for testing

    # Get tenant from query param or connection assigns
    tenant_param = conn.params["tenant"] || conn.assigns[:tenant]

    # Resolve tenant to schema name if it's an organization ID
    tenant = case tenant_param do
      nil -> "org_default"
      tenant_id ->
        # Try to resolve organization ID to schema name
        case resolve_tenant_schema(tenant_id) do
          {:ok, schema_name} -> schema_name
          _ ->
            # If resolution fails, assume it's already a schema name
            tenant_param
        end
    end

    case KgEdu.KnowledgeNestedHierarchy.get(%{
      course_id: course_id,
      tenant: tenant
    }) do
      {:ok, nested_hierarchy} ->
        # Serialize Ash Resources to maps before JSON encoding
        json(conn, %{success: true, data: serialize_resources(nested_hierarchy)})

      {:error, error} ->
        json(conn, %{
          success: false,
          errors: [%{message: inspect(error), type: "error"}]
        })
    end
  end

  # Recursively convert Ash Resource structs to plain maps
  defp serialize_resources(list) when is_list(list) do
    Enum.map(list, &serialize_resource/1)
  end

  defp serialize_resource(%KgEdu.Knowledge.Resource{} = resource) do
    # Get the attributes as a map
    serialized = %{
      id: resource.id,
      name: resource.name,
      knowledgeType: resource.knowledge_type,
      subject: resource.subject,
      unit: resource.unit,
      importanceLevel: resource.importance_level,
      description: resource.description,
      tag: resource.tag,
      dimension: resource.dimension,
      category: resource.category,
      teachingGoal: resource.teaching_goal,
      insertedAt: resource.inserted_at,
      updatedAt: resource.updated_at,
      courseId: resource.course_id,
      chapterId: resource.chapter_id,
      parentSubjectId: resource.parent_subject_id,
      parentUnitId: resource.parent_unit_id,
      parentKnowledgeResourceId: resource.parent_knowledge_resource_id
    }

    # Recursively serialize relationships
    serialized =
      if is_list(resource.child_units) and length(resource.child_units) > 0 do
        Map.put(serialized, :childUnits, serialize_resources(resource.child_units))
      else
        serialized
      end

    serialized =
      if is_list(resource.child_cells) and length(resource.child_cells) > 0 do
        Map.put(serialized, :childCells, serialize_resources(resource.child_cells))
      else
        serialized
      end

    serialized =
      if is_list(resource.direct_cells) and length(resource.direct_cells) > 0 do
        Map.put(serialized, :directCells, serialize_resources(resource.direct_cells))
      else
        serialized
      end

    serialized =
      if is_list(resource.subject_cells) and length(resource.subject_cells) > 0 do
        Map.put(serialized, :subjectCells, serialize_resources(resource.subject_cells))
      else
        serialized
      end

    # Check for nested child cells (custom field) - this handles level 4+ cells
    serialized =
      case Map.get(resource, :nestedChildCells) do
        nil -> serialized
        nested when is_list(nested) ->
          Map.put(serialized, :nestedChildCells, serialize_resources(nested))
      end

    serialized
  end

  defp serialize_resource(resource) when is_map(resource) do
    # Handle maps that may have been processed by KnowledgeNestedHierarchy
    # Extract basic attributes
    serialized = %{
      id: Map.get(resource, :id),
      name: Map.get(resource, :name),
      knowledgeType: Map.get(resource, :knowledge_type),
      subject: Map.get(resource, :subject),
      unit: Map.get(resource, :unit),
      importanceLevel: Map.get(resource, :importance_level),
      description: Map.get(resource, :description),
      tag: Map.get(resource, :tag),
      dimension: Map.get(resource, :dimension),
      category: Map.get(resource, :category),
      teachingGoal: Map.get(resource, :teaching_goal),
      insertedAt: Map.get(resource, :inserted_at),
      updatedAt: Map.get(resource, :updated_at),
      courseId: Map.get(resource, :course_id),
      chapterId: Map.get(resource, :chapter_id),
      parentSubjectId: Map.get(resource, :parent_subject_id),
      parentUnitId: Map.get(resource, :parent_unit_id),
      parentKnowledgeResourceId: Map.get(resource, :parent_knowledge_resource_id)
    }

    # Recursively serialize relationships
    serialized =
      case Map.get(resource, :child_units) do
        nil when is_nil(resource.child_units) -> serialized
        units when is_list(units) ->
          Map.put(serialized, :childUnits, serialize_resources(units))
        _ -> serialized
      end

    serialized =
      case Map.get(resource, :child_cells) do
        nil when is_nil(resource.child_cells) -> serialized
        cells when is_list(cells) ->
          Map.put(serialized, :childCells, serialize_resources(cells))
        _ -> serialized
      end

    serialized =
      case Map.get(resource, :direct_cells) do
        nil when is_nil(resource.direct_cells) -> serialized
        cells when is_list(cells) ->
          Map.put(serialized, :directCells, serialize_resources(cells))
        _ -> serialized
      end

    serialized =
      case Map.get(resource, :subject_cells) do
        nil when is_nil(resource.subject_cells) -> serialized
        cells when is_list(cells) ->
          Map.put(serialized, :subjectCells, serialize_resources(cells))
        _ -> serialized
      end

    # Check for nested child cells (custom field) - this handles level 4+ cells
    serialized =
      case Map.get(resource, :nestedChildCells) do
        nil -> serialized
        nested when is_list(nested) ->
          Map.put(serialized, :nestedChildCells, serialize_resources(nested))
      end

    # Remove nil values
    Enum.reject(serialized, fn {_k, v} -> is_nil(v) end)
    |> Map.new()
  end

  # Resolve tenant ID to schema name
  defp resolve_tenant_schema(tenant_id) do
    require Ash.Query

    case KgEdu.Accounts.Organization
         |> Ash.Query.filter(id == ^tenant_id)
         |> Ash.read(authorize?: false) do
      {:ok, [org]} -> {:ok, org.schema_name}
      _ -> {:error, :not_found}
    end
  end
end
