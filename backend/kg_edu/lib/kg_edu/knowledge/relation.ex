defmodule KgEdu.Knowledge.Relation do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "knowledge_relations"
    repo KgEdu.Repo
  end

  json_api do
    type "knowledge_relation"
  end

  typescript do
    type_name "KnowledgeRelation"
  end

  code_interface do
    define :get_knowledge_relation, action: :by_id
    define :list_knowledge_relations, action: :read
    define :get_relations_by_knowledge, action: :by_knowledge
    define :get_outgoing_relations, action: :outgoing_relations
    define :get_incoming_relations, action: :incoming_relations
    define :create_knowledge_relation, action: :create_knowledge_relation
    define :create_relation_import, action: :create_relation_import
    define :update_knowledge_relation, action: :update_knowledge_relation
    define :delete_knowledge_relation, action: :destroy
    define :import_relations_from_excel, action: :import_relations_from_excel
  end

  actions do
    defaults [:read, :create, :update, :destroy]

    read :by_id do
      description "Get a knowledge relation by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_knowledge do
      description "Get relations for a specific knowledge resource"
      argument :knowledge_id, :uuid, allow_nil?: false

      filter expr(
               source_knowledge_id == ^arg(:knowledge_id) or
                 target_knowledge_id == ^arg(:knowledge_id)
             )
    end

    read :outgoing_relations do
      description "Get outgoing relations from a knowledge resource"
      argument :source_knowledge_id, :uuid, allow_nil?: false
      filter expr(source_knowledge_id == ^arg(:source_knowledge_id))
    end

    read :incoming_relations do
      description "Get incoming relations to a knowledge resource"
      argument :target_knowledge_id, :uuid, allow_nil?: false
      filter expr(target_knowledge_id == ^arg(:target_knowledge_id))
    end

    create :create_knowledge_relation do
      description "Create a new knowledge relation"
      accept [:relation_type_id, :source_knowledge_id, :target_knowledge_id]

      change relate_actor(:created_by)

      validate fn changeset, _context ->
        # Prevent self-references
        source_id = Ash.Changeset.get_attribute(changeset, :source_knowledge_id)
        target_id = Ash.Changeset.get_attribute(changeset, :target_knowledge_id)

        if source_id == target_id do
          {:error, "Source and target knowledge cannot be the same"}
        else
          :ok
        end
      end
    end

    create :create_relation_import do
      description "Create a knowledge relation during import (no actor required)"
      accept [:relation_type_id, :source_knowledge_id, :target_knowledge_id]

      validate fn changeset, _context ->
        # Prevent self-references
        source_id = Ash.Changeset.get_attribute(changeset, :source_knowledge_id)
        target_id = Ash.Changeset.get_attribute(changeset, :target_knowledge_id)

        if source_id == target_id do
          {:error, "Source and target knowledge cannot be the same"}
        else
          :ok
        end
      end
    end

    update :update_knowledge_relation do
      description "Update a knowledge relation"
      accept [:relation_type_id]
    end

    action :import_relations_from_excel do
      description "Import knowledge relations from Excel file"

      argument :excel_data, :string, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, _context ->
        case KgEdu.ExcelParser.parse_from_base64(input.arguments.excel_data) do
          {:ok, sheets} ->
            # Process knowledge resources from sheet1 if available
            knowledge_result = case Map.get(sheets, :sheet1) do
              nil -> {:ok, "No knowledge data to import"}
              _knowledge_data ->
                # Re-use the same excel data but import only knowledge resources
                case KgEdu.Knowledge.Resource.import_knowledge_from_excel(%{
                  excel_data: input.arguments.excel_data,
                  course_id: input.arguments.course_id
                }) do
                  {:ok, _} -> {:ok, "Knowledge resources imported successfully"}
                  {:error, reason} -> {:error, "Failed to import knowledge resources: #{reason}"}
                end
            end

            # Process relations from sheet2 if available
            relation_result = case Map.get(sheets, :sheet2) do
              nil -> {:ok, "No relation data to import"}
              relation_data ->
                process_relation_import(relation_data, input.arguments.course_id)
            end

            # Return combined result
            case {knowledge_result, relation_result} do
              {{:ok, knowledge_msg}, {:ok, relation_msg}} ->
                {:ok, "#{knowledge_msg}. #{relation_msg}"}
              {{:error, reason}, _} ->
                {:error, reason}
              {_, {:error, reason}} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, "Failed to parse Excel file: #{reason}"}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    timestamps()
  end

  relationships do
    belongs_to :relation_type, KgEdu.Knowledge.RelationType do
      public? true
      allow_nil? false
    end

    belongs_to :source_knowledge, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
    end

    belongs_to :target_knowledge, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? true
    end
  end

  identities do
    identity :unique_relation, [:source_knowledge_id, :target_knowledge_id, :relation_type_id]
  end

  # ============ Import Implementation ============

  defp import_relations_from_excel(excel_base64, course_id, _context) do
    case KgEdu.ExcelParser.parse_from_base64(excel_base64) do
      {:ok, %{sheet2: relation_data}} ->
        process_relation_import(relation_data, course_id)

      {:error, reason} ->
        {:error, "Failed to parse Excel file: #{reason}"}
    end
  end

  defp process_relation_import(relation_data, course_id) do
    # Process each row of relation data
    result = Enum.reduce_while(relation_data, {:ok, 0}, fn row, {:ok, count} ->
      case process_relation_row(row, course_id) do
        {:ok} -> {:cont, {:ok, count + 1}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)

    case result do
      {:ok, imported_count} ->
        {:ok, "Successfully imported #{imported_count} knowledge relations"}
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp process_relation_row(row, course_id) when length(row) >= 3 do
    # Extract row data: knowledge1 name, relation type name, knowledge2 name
    [knowledge1_name, relation_type_name, knowledge2_name] = row

    # Skip row if any field is missing
    if is_nil(knowledge1_name) or is_nil(relation_type_name) or is_nil(knowledge2_name) or
       knowledge1_name == "" or relation_type_name == "" or knowledge2_name == "" do
      {:ok}  # Skip empty rows
    else
      # Find knowledge resources by name and course
      with {:ok, source_knowledge} <- find_knowledge_by_name_and_course(knowledge1_name, course_id),
           {:ok, target_knowledge} <- find_knowledge_by_name_and_course(knowledge2_name, course_id),
           {:ok, relation_type} <- create_or_get_relation_type(relation_type_name) do

        # Create the relation
        relation_attrs = %{
          source_knowledge_id: source_knowledge.id,
          target_knowledge_id: target_knowledge.id,
          relation_type_id: relation_type.id
        }

        case create_relation(relation_attrs) do
          {:ok, _relation} ->
            {:ok}
          {:error, reason} ->
            error_msg = case reason do
              %Ash.Error.Invalid{} -> Exception.message(reason)
              %Ash.Error.Query.NotFound{} -> "Resource not found"
              _ -> Exception.message(reason)
            end
            {:error, "Failed to create relation between '#{knowledge1_name}' and '#{knowledge2_name}': #{error_msg}"}
        end
      else
        {:error, reason} ->
          error_msg = case reason do
            %Ash.Error.Invalid{} -> Exception.message(reason)
            %Ash.Error.Query.NotFound{} -> "Resource not found"
            _ -> Exception.message(reason)
          end
          {:error, error_msg}
      end
    end
  end

  defp process_relation_row(row, _course_id) do
    {:error, "Invalid row format: #{inspect(row)}. Expected at least 3 columns."}
  end

  defp find_knowledge_by_name_and_course(name, course_id) do
    # Try exact name match first
    case KgEdu.Knowledge.Resource.get_by_name_and_course(%{name: name, course_id: course_id}) do
      {:ok, knowledge} -> {:ok, knowledge}
      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Try searching by subject
        case KgEdu.Knowledge.Resource.list_knowledges(
          authorize?: false,
          query: [
            filter: [
              subject: name,
              course_id: course_id
            ],
            limit: 1
          ]
        ) do
          {:ok, [knowledge]} -> {:ok, knowledge}
          {:ok, []} ->
            # Try searching by unit
            case KgEdu.Knowledge.Resource.list_knowledges(
              authorize?: false,
              query: [
                filter: [
                  unit: name,
                  course_id: course_id
                ],
                limit: 1
              ]
            ) do
              {:ok, [knowledge]} -> {:ok, knowledge}
              {:ok, []} ->
                # Create basic knowledge resource if not found
                create_basic_knowledge(name, course_id)
              {:error, reason} -> {:error, reason}
            end
          {:error, reason} -> {:error, reason}
        end
      {:error, reason} -> {:error, reason}
    end
  end

  defp create_basic_knowledge(name, course_id) do
    knowledge_attrs = %{
      name: name,
      subject: name,
      knowledge_type: :subject,
      course_id: course_id,
      importance_level: :normal,
      description: "Basic knowledge: #{name}"
    }

    case KgEdu.Knowledge.Resource.create_knowledge_resource(knowledge_attrs, authorize?: false) do
      {:ok, knowledge} -> {:ok, knowledge}
      {:error, %Ash.Error.Invalid{} = error} ->
        {:error, "Failed to create knowledge resource '#{name}': #{Exception.message(error)}"}
      {:error, reason} ->
        {:error, "Failed to create knowledge resource '#{name}': #{inspect(reason)}"}
    end
  end

  defp create_or_get_relation_type(relation_type_name) do
    # First try to get existing relation type
    case KgEdu.Knowledge.RelationType.get_relation_type_by_name(%{name: relation_type_name}) do
      {:ok, relation_type} ->
        {:ok, relation_type}

      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Create new relation type using the code interface
        case KgEdu.Knowledge.RelationType.upsert_relation_type(%{
          name: relation_type_name,
          display_name: String.capitalize(relation_type_name) |> String.replace("_", " "),
          description: "Relation type: #{String.capitalize(relation_type_name) |> String.replace("_", " ")}"
        }, authorize?: false) do
          {:ok, relation_type} -> {:ok, relation_type}
          {:error, %Ash.Error.Invalid{} = error} ->
            {:error, "Failed to create relation type '#{relation_type_name}': #{Exception.message(error)}"}
          {:error, reason} ->
            {:error, "Failed to create relation type '#{relation_type_name}': #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, "Failed to check relation type '#{relation_type_name}': #{inspect(reason)}"}
    end
  end

  defp create_relation(attrs) do
    # Check if relation already exists
    case find_existing_relation(attrs) do
      {:ok, _existing_relation} ->
        # Relation already exists, skip creation
        {:ok, nil}
      {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} ->
        # Relation doesn't exist, create it
        create_relation_import(attrs, authorize?: false)
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp find_existing_relation(attrs) do
    # Find existing relation by source, target, and relation type
    case KgEdu.Knowledge.Relation.list_knowledge_relations(
      authorize?: false,
      query: [
        filter: [
          source_knowledge_id: attrs.source_knowledge_id,
          target_knowledge_id: attrs.target_knowledge_id,
          relation_type_id: attrs.relation_type_id
        ],
        limit: 1
      ]
    ) do
      {:ok, [relation]} -> {:ok, relation}
      {:ok, []} -> {:error, Ash.Error.Query.NotFound.exception([])}
      {:error, reason} -> {:error, reason}
    end
  end
end
