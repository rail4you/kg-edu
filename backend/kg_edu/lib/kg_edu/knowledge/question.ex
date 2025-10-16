defmodule KgEdu.Knowledge.Question do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "knowledge_questions"
    repo KgEdu.Repo
  end

  json_api do
    type "knowledge_question"
  end

  typescript do
    type_name "Question"
  end

  code_interface do
    # Basic CRUD
    define :get_question, action: :by_id
    define :list_questions, action: :read
    define :create_question, action: :create
    define :update_question, action: :update_question
    define :delete_question, action: :destroy

    # Question level queries
    define :list_global_questions, action: :list_global_questions
    define :list_concept_questions, action: :list_concept_questions
    define :list_method_questions, action: :list_method_questions

    # Flow queries
    define :get_question_flow, action: :get_question_flow
    define :get_question_connections, action: :get_question_connections
  end

  actions do
    defaults [:read, :destroy]

    # ============ Basic Queries ============
    read :by_id do
      description "Get a question by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    # ============ Question Level Queries ============
    read :list_global_questions do
      description "List all global level questions"
      argument :course_id, :uuid, allow_nil?: true

      filter expr(
        question_level == :global and
        (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
      )

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end
    end

    read :list_concept_questions do
      description "List all concept level questions"
      argument :course_id, :uuid, allow_nil?: true

      filter expr(
        question_level == :concept and
        (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
      )

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end
    end

    read :list_method_questions do
      description "List all method level questions"
      argument :course_id, :uuid, allow_nil?: true

      filter expr(
        question_level == :method and
        (is_nil(^arg(:course_id)) or course_id == ^arg(:course_id))
      )

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, title: :asc)
      end
    end

    # ============ Flow Queries ============
    read :get_question_flow do
      description "Get the complete question flow for a course"
      argument :course_id, :uuid, allow_nil?: false

      filter expr(course_id == ^arg(:course_id))

      prepare fn query, _context ->
        query
        |> Ash.Query.sort(question_level: :asc, position: :asc)
        |> Ash.Query.load([:source_connections, :target_connections])
      end
    end

    read :get_question_connections do
      description "Get connections for a specific question"
      argument :question_id, :uuid, allow_nil?: false

      prepare fn query, _context ->
        query
        |> Ash.Query.filter(expr(id == ^arg(:question_id)))
        |> Ash.Query.load([:source_connections, :target_connections])
      end
    end

    # ============ Create Actions ============
    create :create do
      description "Create a new question"

      accept [
        :title,
        :description,
        :course_id,
        :question_level,
        :position,
        :tags
      ]

      validate fn changeset, _context ->
        title = Ash.Changeset.get_attribute(changeset, :title)
        question_level = Ash.Changeset.get_attribute(changeset, :question_level)
        position = Ash.Changeset.get_attribute(changeset, :position)
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)

        cond do
          is_nil(title) or title == "" ->
            {:error, "Title is required"}

          is_nil(question_level) ->
            {:error, "Question level is required"}

          is_nil(position) ->
            {:error, "Position is required"}

          is_nil(course_id) ->
            {:error, "Course ID is required"}

          true ->
            :ok
        end
      end
    end

    # ============ Update Actions ============
    update :update_question do
      description "Update a question"
      accept [:title, :description, :position, :tags]
    end

    # ============ Batch Actions ============
    action :create_from_flow do
      description "Create questions from flow data"

      argument :flow_data, :map, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, _context ->
        flow_data = input.arguments.flow_data
        course_id = input.arguments.course_id

        try do
          # Create questions from the flow data
          results =
            flow_data
            |> Enum.map(fn {level, questions} ->
              Enum.map(questions, fn question_data ->
                create_question_from_data(question_data, level, course_id)
              end)
            end)
            |> List.flatten()

          successful = Enum.count(results, fn {status, _} -> status == :ok end)
          failed = Enum.count(results, fn {status, _} -> status == :error end)

          if failed > 0 do
            {:error, "Created #{successful} questions, #{failed} failed"}
          else
            {:ok, "Successfully created #{successful} questions"}
          end
        rescue
          e ->
            {:error, "Failed to process flow data: #{Exception.message(e)}"}
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

    attribute :title, :string do
      allow_nil? false
      public? true
      description "The question title displayed in the flow"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Additional description or context for the question"
    end

    attribute :question_level, :atom do
      allow_nil? false
      constraints one_of: [:global, :concept, :method]
      public? true
      description "The level of the question in the knowledge hierarchy"
    end

    attribute :position, :integer do
      allow_nil? false
      default 0
      public? true
      description "Position within the question level for ordering"
    end

    attribute :tags, {:array, :string} do
      allow_nil? true
      default []
      public? true
      description "Tags associated with the question"
    end


    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
    end

    # Flow connections
    has_many :source_connections, KgEdu.Knowledge.QuestionConnection do
      public? true
      destination_attribute :source_question_id
      description "Connections from this question to other questions"
    end

    has_many :target_connections, KgEdu.Knowledge.QuestionConnection do
      public? true
      destination_attribute :target_question_id
      description "Connections to this question from other questions"
    end

    # Knowledge resource relationship
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? true
      description "Related knowledge resource"
    end
  end

  identities do
    identity :unique_title_position_per_level, [:title, :question_level, :course_id]
  end

  # ============ Helper Functions ============

  defp create_question_from_data(question_data, level, course_id) do
    attrs = %{
      title: question_data["title"] || question_data[:title],
      description: question_data["description"] || question_data[:description],
      question_level: level,
      position: question_data["position"] || question_data[:position] || 0,
      tags: question_data["tags"] || question_data[:tags] || [],
      course_id: course_id
    }

    case KgEdu.Knowledge.Question.create_question(attrs) do
      {:ok, question} ->
        # Create connections if provided
        if question_data["connections"] || question_data[:connections] do
          create_question_connections(question, question_data["connections"] || question_data[:connections])
        end
        {:ok, question}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp create_question_connections(_question, _connections) do
    # TODO: Implement connection creation
    # This would create QuestionConnection records
    :ok
  end
end
