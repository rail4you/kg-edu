defmodule KgEdu.MajorAnalysis.JobCoreTask do
  @moduledoc """
  岗位核心任务资源。

  隶属某个 `JobCompetencyGraph`，描述岗位上需要完成的关键工作。
  一个核心任务可以包含多个能力点。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "job_core_tasks"
    repo KgEdu.Repo

    references do
      reference :graph, on_delete: :delete
      reference :job_position, on_delete: :delete
    end
  end

  typescript do
    type_name "JobCoreTask"
  end

  code_interface do
    define :create_job_core_task, action: :create
    define :update_job_core_task, action: :update_task
    define :delete_job_core_task, action: :destroy
    define :get_job_core_task, action: :by_id
    define :list_job_core_tasks, action: :read
    define :list_core_tasks_by_graph, action: :by_graph
    define :list_core_tasks_by_job_position, action: :by_job_position
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a core task by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _ ->
        Ash.Query.load(query, :task_abilities)
      end
    end

    read :by_graph do
      description "List core tasks belonging to a graph"
      argument :graph_id, :uuid, allow_nil?: false
      filter expr(graph_id == ^arg(:graph_id))

      prepare fn query, _ ->
        query
        |> Ash.Query.load(:task_abilities)
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    read :by_job_position do
      description "List core tasks for a job position"
      argument :job_position_id, :uuid, allow_nil?: false
      filter expr(job_position_id == ^arg(:job_position_id))

      prepare fn query, _ ->
        query
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    create :create do
      description "Create a new core task"
      primary? true
      accept [:title, :description, :weight, :sort_order, :graph_id, :job_position_id]
    end

    update :update_task do
      description "Update a core task"
      accept [:title, :description, :weight, :sort_order]
      require_atomic? false
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_id)
      authorize_if action(:by_graph)
      authorize_if action(:by_job_position)
      authorize_if action(:create)
      authorize_if action(:update_task)
      authorize_if action(:destroy)
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      description "Core task title"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Core task description"
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
      description "Display order within the graph"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :graph, KgEdu.MajorAnalysis.JobCompetencyGraph do
      allow_nil? false
      public? true
    end

    belongs_to :job_position, KgEdu.MajorAnalysis.JobPosition do
      allow_nil? false
      public? true
    end

    has_many :task_abilities, KgEdu.MajorAnalysis.JobTaskAbility do
      public? true
      destination_attribute :core_task_id
    end
  end
end
