defmodule KgEdu.Knowledge.QuestionConnection do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "knowledge_question_connections"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "knowledge_question_connection"
  end

  typescript do
    type_name "QuestionConnection"
  end

  code_interface do
    # Basic CRUD
    define :get_connection, action: :by_id
    define :list_connections, action: :read
    define :create_connection, action: :create_connection
    define :update_connection, action: :update
    define :delete_connection, action: :destroy

    # Connection queries
    define :get_connections_by_source, action: :by_source
    define :get_connections_by_target, action: :by_target
    define :get_course_connections, action: :by_course
  end

  actions do
    defaults [:read, :update, :destroy]

    # ============ Basic Queries ============
    read :by_id do
      description "Get a connection by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_source do
      description "Get all connections from a source question"
      argument :source_question_id, :uuid, allow_nil?: false
      filter expr(source_question_id == ^arg(:source_question_id))
      
      prepare fn query, _context ->
        Ash.Query.sort(query, created_at: :asc)
      end
    end

    read :by_target do
      description "Get all connections to a target question"
      argument :target_question_id, :uuid, allow_nil?: false
      filter expr(target_question_id == ^arg(:target_question_id))
      
      prepare fn query, _context ->
        Ash.Query.sort(query, created_at: :asc)
      end
    end

    read :by_course do
      description "Get all connections for a course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
      
      prepare fn query, _context ->
        query
        |> Ash.Query.sort(created_at: :asc)
        |> Ash.Query.load([:source_question, :target_question])
      end
    end

    # ============ Create Actions ============
    create :create_connection do
      description "Create a new question connection"
      
      accept [
        :source_question_id,
        :target_question_id,
        :course_id,
        :connection_type
      ]
      
      validate fn changeset, _context ->
        source_id = Ash.Changeset.get_attribute(changeset, :source_question_id)
        target_id = Ash.Changeset.get_attribute(changeset, :target_question_id)
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)
        
        cond do
          is_nil(source_id) ->
            {:error, "Source question ID is required"}
          
          is_nil(target_id) ->
            {:error, "Target question ID is required"}
          
          source_id == target_id ->
            {:error, "Source and target questions cannot be the same"}
          
          is_nil(course_id) ->
            {:error, "Course ID is required"}
          
          true ->
            :ok
        end
      end
    end

    # ============ Batch Actions ============
    action :create_from_flow_data do
      description "Create connections from flow edge data"
      
      argument :edges, {:array, :map}, allow_nil?: false
      argument :question_id_map, :map, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false
      
      run fn input, _context ->
        edges = input.arguments.edges
        question_id_map = input.arguments.question_id_map
        course_id = input.arguments.course_id
        
        results = Enum.map(edges, fn edge ->
          create_connection_from_edge(edge, question_id_map, course_id)
        end)
        
        successful = Enum.count(results, fn {status, _} -> status == :ok end)
        failed = Enum.count(results, fn {status, _} -> status == :error end)
        
        if failed > 0 do
          {:error, "Created #{successful} connections, #{failed} failed"}
        else
          {:ok, "Successfully created #{successful} connections"}
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

    attribute :connection_type, :atom do
      allow_nil? true
      constraints one_of: [:hierarchy, :dependency, :related]
      default :hierarchy
      public? true
      description "Type of connection between questions"
    end

    
    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
    end

    belongs_to :source_question, KgEdu.Knowledge.Question do
      public? true
      allow_nil? false
      description "The source question in the connection"
    end

    belongs_to :target_question, KgEdu.Knowledge.Question do
      public? true
      allow_nil? false
      description "The target question in the connection"
    end
  end

  identities do
    identity :unique_connection, [:source_question_id, :target_question_id]
  end

  # ============ Helper Functions ============

  defp create_connection_from_edge(edge, question_id_map, course_id) do
    source_id = get_question_id_from_key(edge["source"] || edge[:source], question_id_map)
    target_id = get_question_id_from_key(edge["target"] || edge[:target], question_id_map)
    
    cond do
      is_nil(source_id) ->
        {:error, "Source question not found: #{inspect(edge["source"] || edge[:source])}"}
      
      is_nil(target_id) ->
        {:error, "Target question not found: #{inspect(edge["target"] || edge[:target])}"}
      
      true ->
        connection_attrs = %{
          source_question_id: source_id,
          target_question_id: target_id,
          course_id: course_id,
          connection_type: edge["type"] || edge[:type] || :hierarchy
        }
        
        create_connection(connection_attrs)
    end
  end

  defp get_question_id_from_key(key, question_id_map) when is_integer(key) do
    # Convert numeric key to string key (e.g., 1 -> "1")
    Map.get(question_id_map, to_string(key))
  end

  defp get_question_id_from_key(key, question_id_map) when is_binary(key) do
    Map.get(question_id_map, key)
  end

  defp get_question_id_from_key(_, _), do: nil
end