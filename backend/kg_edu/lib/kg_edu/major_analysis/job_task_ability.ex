defmodule KgEdu.MajorAnalysis.JobTaskAbility do
  @moduledoc """
  任务能力点资源。

  描述完成某项岗位核心任务所需要具备的能力。一个能力点可以关联多个知识点，
  课程信息通过 `knowledge_resource.course_id` 自动获得。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "job_task_abilities"
    repo KgEdu.Repo

    references do
      reference :core_task, on_delete: :delete
      reference :graph, on_delete: :delete
    end
  end

  typescript do
    type_name "JobTaskAbility"
  end

  code_interface do
    define :create_job_task_ability, action: :create
    define :update_job_task_ability, action: :update_ability
    define :delete_job_task_ability, action: :destroy
    define :get_job_task_ability, action: :by_id
    define :list_job_task_abilities, action: :read
    define :list_abilities_by_core_task, action: :by_core_task
    define :list_abilities_by_graph, action: :by_graph
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a task ability by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _ ->
        Ash.Query.load(query, :knowledge_links)
      end
    end

    read :by_core_task do
      description "List abilities belonging to a core task"
      argument :core_task_id, :uuid, allow_nil?: false
      filter expr(core_task_id == ^arg(:core_task_id))

      prepare fn query, _ ->
        query
        |> Ash.Query.load(:knowledge_links)
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    read :by_graph do
      description "List abilities belonging to a graph"
      argument :graph_id, :uuid, allow_nil?: false
      filter expr(graph_id == ^arg(:graph_id))

      prepare fn query, _ ->
        query
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    create :create do
      description "Create a new task ability"
      primary? true
      accept [:name, :description, :level, :weight, :sort_order, :core_task_id, :graph_id]
    end

    update :update_ability do
      description "Update a task ability"
      accept [:name, :description, :level, :weight, :sort_order]
      require_atomic? false
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_id)
      authorize_if action(:by_core_task)
      authorize_if action(:by_graph)
      authorize_if action(:create)
      authorize_if action(:update_ability)
      authorize_if action(:destroy)
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      description "Ability name"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Ability description"
    end

    attribute :level, :atom do
      allow_nil? true
      public? true
      constraints one_of: [:beginner, :intermediate, :advanced]
      description "Required ability level: beginner / intermediate / advanced"
    end

    attribute :weight, :float do
      allow_nil? false
      public? true
      default 1.0
      description "Weight / importance"
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
      description "Display order within the core task"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :core_task, KgEdu.MajorAnalysis.JobCoreTask do
      allow_nil? false
      public? true
    end

    belongs_to :graph, KgEdu.MajorAnalysis.JobCompetencyGraph do
      allow_nil? false
      public? true
    end

    has_many :knowledge_links, KgEdu.MajorAnalysis.AbilityKnowledgeLink do
      public? true
      destination_attribute :ability_id
    end
  end
end
