defmodule KgEdu.Knowledge.NestedHierarchyRpc do
  @moduledoc """
  RPC actions for returning fully nested knowledge hierarchy.
  """

  use Ash.Resource.ManualRead,
    action: :get_full_hierarchy_nested,
    domain: KgEdu.Knowledge,
    resource: KgEdu.Knowledge.Resource

  def read(_, input, context) do
    course_id = input.arguments.course_id
    tenant = context.tenant

    # Use the helper module to get nested hierarchy
    case KgEdu.KnowledgeNestedHierarchy.get(%{
      course_id: course_id,
      tenant: tenant
    }) do
      {:ok, nested_hierarchy} ->
        {:ok, nested_hierarchy}

      {:error, error} ->
        {:error, error}
    end
  end
end
