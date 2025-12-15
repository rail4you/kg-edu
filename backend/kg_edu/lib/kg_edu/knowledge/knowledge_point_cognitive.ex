defmodule KgEdu.Knowledge.KnowledgePointCognitive do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "knowledge_point_cognitives"
    repo KgEdu.Repo

    references do
      reference :knowledge_resource, on_delete: :delete
      reference :created_by, on_delete: :nilify
    end
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "knowledge_point_cognitive"
  end

  typescript do
    type_name "KnowledgePointCognitive"
  end

  code_interface do
    # Basic CRUD
    define :get_knowledge_point_cognitive, action: :by_id
    define :list_knowledge_point_cognitives, action: :read
    define :create_knowledge_point_cognitive, action: :create
    define :update_knowledge_point_cognitive, action: :update
    define :delete_knowledge_point_cognitive, action: :destroy

    # Knowledge point specific queries
    define :get_cognitives_by_knowledge_point, action: :by_knowledge_point
    define :get_cognitives_by_knowledge_point_and_level, action: :by_knowledge_point_and_level
    define :get_knowledge_point_cognitive_by_knowledge_cid_and_level, action: :get_knowledge_point_cognitive_by_knowledge_cid_and_level
    define :get_cognitives_by_level, action: :by_level
    define :get_cognitives_by_course, action: :by_course

    # Batch operations (to be implemented as needed)
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [
        :cognitive_level,
        :title,
        :description,
        :learning_outcome,
        :difficulty,
        :estimated_time,
        :is_active,
        :knowledge_resource_id,
        :created_by_id
      ]
    end

    update :update do
      primary? true
      accept [
        :cognitive_level,
        :title,
        :description,
        :learning_outcome,
        :difficulty,
        :estimated_time,
        :is_active,
        :knowledge_resource_id,
        :created_by_id
      ]
    end

    # ============ Query Actions ============
    read :by_id do
      description "Get a knowledge point cognitive by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_knowledge_point do
      description "Get all cognitive resources for a specific knowledge point"
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, cognitive_level: :asc, title: :asc)
      end
    end

    read :by_knowledge_point_and_level do
      description "Get all cognitive resources for a knowledge point at a specific level"
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      argument :cognitive_level, :atom, allow_nil?: false
      filter expr(
        knowledge_resource_id == ^arg(:knowledge_resource_id) and
        cognitive_level == ^arg(:cognitive_level)
      )
    end

    read :get_knowledge_point_cognitive_by_knowledge_cid_and_level do
      description "Get a single knowledge point cognitive by knowledge resource ID and level"
      get? true
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      argument :cognitive_level, :atom, allow_nil?: false
      filter expr(
        knowledge_resource_id == ^arg(:knowledge_resource_id) and
        cognitive_level == ^arg(:cognitive_level)
      )
    end

    read :by_level do
      description "Get all cognitive resources at a specific level"
      argument :cognitive_level, :atom, allow_nil?: false
      filter expr(cognitive_level == ^arg(:cognitive_level))
      prepare fn query, _context ->
        Ash.Query.sort(query, title: :asc)
      end
    end

    read :by_course do
      description "Get all cognitive resources for knowledge points in a course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(knowledge_resource.course_id == ^arg(:course_id))
      prepare fn query, _context ->
        Ash.Query.load(query, :knowledge_resource)
        |> Ash.Query.sort(cognitive_level: :asc, title: :asc)
      end
    end

    # Bulk operations would require custom implementations
    # For now, individual creates can be done through the create action

    # Bulk update action would require a custom implementation
    # For now, individual updates can be done through the update action
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    # Cognitive level (1-6)
    attribute :cognitive_level, :atom do
      public? true
      allow_nil? false
      constraints one_of: [:level_1, :level_2, :level_3, :level_4, :level_5, :level_6]
      description "Cognitive level: 1 (记忆), 2 (理解), 3 (应用), 4 (分析), 5 (评价), 6 (创造)"
    end

    # Title/Name of the cognitive item
    attribute :title, :string do
      public? true
      allow_nil? false
      description "Title of the cognitive resource"
    end

    # Description of what should be learned at this level
    attribute :description, :string do
      public? true
      allow_nil? true
      description "Detailed description of the cognitive objective"
    end

    # Expected learning outcome
    attribute :learning_outcome, :string do
      public? true
      allow_nil? true
      description "Expected learning outcome for this cognitive level"
    end

    # Difficulty level within the cognitive level
    attribute :difficulty, :atom do
      public? true
      allow_nil? true
      default :medium
      description "Difficulty level within the cognitive level"
    end

    # Estimated learning time in minutes
    attribute :estimated_time, :integer do
      public? true
      allow_nil? true
      description "Estimated time to complete this cognitive objective (in minutes)"
    end

    # Is this cognitive objective active/available
    attribute :is_active, :boolean do
      public? true
      allow_nil? false
      default true
      description "Whether this cognitive objective is active and available"
    end

    timestamps()
  end

  relationships do
    # Belongs to the knowledge point (resource)
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
      description "The knowledge point this cognitive resource belongs to"
    end

    # Created by user
    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? true
      description "User who created this cognitive resource"
    end
  end


  # ============ Calculations ============
  calculations do
    calculate :cognitive_level_display, :string do
      calculation fn resource, _args ->
        case resource.cognitive_level do
          :level_1 -> "记忆"
          :level_2 -> "理解"
          :level_3 -> "应用"
          :level_4 -> "分析"
          :level_5 -> "评价"
          :level_6 -> "创造"
          _ -> "Unknown Level"
        end
      end
    end

    calculate :difficulty_display, :string do
      calculation fn resource, _args ->
        case resource.difficulty do
          :easy -> "简单"
          :medium -> "中等"
          :hard -> "困难"
          _ -> "未知"
        end
      end
    end
  end
end
