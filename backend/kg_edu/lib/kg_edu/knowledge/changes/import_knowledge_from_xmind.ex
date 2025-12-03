defmodule KgEdu.Knowledge.Changes.ImportKnowledgeFromXmind do
  @moduledoc """
  Change module for importing knowledge resources from XMind files.
  """

  use Ash.Resource.Change
  require Logger

  @doc """
  Apply the change to a changeset.
  """
  def change(changeset, opts, context) do
    Ash.Changeset.after_action(changeset, fn changeset, record ->
      # Get the parameters from the changeset or opts
      xmind_data = Ash.Changeset.get_argument(changeset, :xmind_data) || opts[:xmind_data]
      course_id = Ash.Changeset.get_argument(changeset, :course_id) || opts[:course_id] || record.course_id

      if xmind_data && course_id do
        case KgEdu.XmindParser.parse_from_base64(xmind_data) do
          {:ok, xmind_parsed_data} ->
            case KgEdu.XmindParser.convert_to_knowledge_resources(xmind_parsed_data, course_id) do
              {:ok, knowledge_resources} ->
                # Process each knowledge resource for creation
                results = Enum.map(knowledge_resources, fn resource_attrs ->
                  create_knowledge_resource(resource_attrs, [tenant: context.tenant])
                end)

                # Check if all creations were successful
                case Enum.find(results, fn result ->
                  case result do
                    {:ok, _} -> false
                    {:error, _} -> true
                  end
                end) do
                  nil ->
                    Logger.info("Successfully imported #{length(knowledge_resources)} knowledge resources from XMind")
                    {:ok, record}

                  {:error, error} ->
                    Logger.error("Failed to import some knowledge resources from XMind: #{inspect(error)}")
                    {:error, "Failed to import knowledge resources: #{inspect(error)}"}
                end

              {:error, reason} ->
                Logger.error("Failed to convert XMind data to knowledge resources: #{inspect(reason)}")
                {:error, "Failed to process XMind data: #{inspect(reason)}"}
            end

          {:error, reason} ->
            Logger.error("Failed to parse XMind file: #{inspect(reason)}")
            {:error, "Failed to parse XMind file: #{inspect(reason)}"}
        end
      else
        {:ok, record}
      end
    end)
  end

  defp create_knowledge_resource(resource_attrs, opts) do
    # Check if resource already exists
    case KgEdu.Knowledge.Resource.get_by_name_and_course(%{
           name: resource_attrs.name,
           knowledge_type: resource_attrs.knowledge_type,
           course_id: resource_attrs.course_id
         }, opts) do
      {:ok, _existing} ->
        # Resource already exists, skip it
        Logger.debug("Knowledge resource '#{resource_attrs.name}' already exists, skipping")
        {:ok, :skipped}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Resource doesn't exist, create it
        KgEdu.Knowledge.Resource.create_knowledge_resource(resource_attrs, opts)

      {:error, reason} ->
        Logger.error("Error checking existing knowledge resource: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  Convenience function for importing XMind data directly.
  """
  def import_knowledge_from_xmind(base64_data, course_id, opts \\ []) do
    # Create a temporary changeset to use the change
    changeset = Ash.Changeset.for_create(%KgEdu.Knowledge.Resource{}, :create, %{
      xmind_data: base64_data,
      course_id: course_id
    })

    case change(changeset, [], %{tenant: opts[:tenant]}) do
      {:ok, _result} -> :ok
      {:error, error} -> {:error, error}
    end
  end
end