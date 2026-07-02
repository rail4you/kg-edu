defmodule KgEdu.MajorAnalysis.JobCompetencyGraph do
  @moduledoc """
  岗位能力图谱（顶层实体）。

  以岗位为中心，将岗位核心任务、任务能力点、能力点对应的知识点与课程组织成
  多层级图谱结构。同一个岗位可同时存在多个版本的图谱。

  图谱 → 核心任务 → 能力点 → 知识点 → 课程  五级层级。
  课程信息通过 `knowledge_resource.course_id` 外键自动关联，不在此处冗余存储。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "job_competency_graphs"
    repo KgEdu.Repo

    references do
      reference :job_position, on_delete: :delete
    end
  end

  typescript do
    type_name "JobCompetencyGraph"
  end

  code_interface do
    define :create_job_competency_graph, action: :create
    define :update_job_competency_graph, action: :update_graph
    define :delete_job_competency_graph, action: :destroy
    define :get_job_competency_graph, action: :by_id
    define :list_job_competency_graphs, action: :read
    define :list_graphs_by_job_position, action: :by_job_position
    define :activate_job_competency_graph, action: :activate
    define :clone_job_competency_graph, action: :clone
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a job competency graph by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _ ->
        Ash.Query.load(query, :core_tasks)
      end
    end

    read :by_job_position do
      description "List graphs belonging to a specific job position"
      argument :job_position_id, :uuid, allow_nil?: false
      filter expr(job_position_id == ^arg(:job_position_id))
    end

    create :create do
      description "Create a new job competency graph"
      primary? true
      accept [:name, :description, :is_active, :version, :job_position_id]

      change fn changeset, _context ->
        if is_nil(Ash.Changeset.get_attribute(changeset, :is_active)) do
          Ash.Changeset.change_attribute(changeset, :is_active, true)
        else
          changeset
        end
      end
    end

    update :update_graph do
      description "Update a job competency graph"
      accept [:name, :description, :is_active, :version]
      require_atomic? false
    end

    update :activate do
      description "Mark this graph as the active one for its job position"
      accept []
      require_atomic? false

      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :is_active, true)
      end
    end

    action :clone, :map do
      description "Deep clone a graph with all tasks, abilities and links"

      argument :id, :uuid do
        allow_nil? false
      end

      argument :new_name, :string do
        allow_nil? true
      end

      run fn input, context ->
        tenant = context.tenant
        graph_id = input.arguments.id

        with {:ok, source} <-
               Ash.get(__MODULE__, graph_id, tenant: tenant, authorize?: false, load: [:core_tasks]),
             {:ok, new_graph} <-
               create_cloned_graph(source, input.arguments.new_name, tenant),
             :ok <- clone_core_tasks(source, new_graph, tenant) do
          {:ok, new_graph}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_id)
      authorize_if action(:by_job_position)
      authorize_if action(:create)
      authorize_if action(:update_graph)
      authorize_if action(:activate)
      authorize_if action(:clone)
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
      description "Graph name"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Graph description"
    end

    attribute :is_active, :boolean do
      allow_nil? false
      public? true
      default true
      description "Whether this graph is the active one for its job position"
    end

    attribute :version, :integer do
      allow_nil? false
      public? true
      default 1
      description "Version number for the graph"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :job_position, KgEdu.MajorAnalysis.JobPosition do
      allow_nil? false
      public? true
    end

    has_many :core_tasks, KgEdu.MajorAnalysis.JobCoreTask do
      public? true
      destination_attribute :graph_id
    end

    has_many :task_abilities, KgEdu.MajorAnalysis.JobTaskAbility do
      public? true
      destination_attribute :graph_id
    end

    has_many :ability_knowledge_links, KgEdu.MajorAnalysis.AbilityKnowledgeLink do
      public? true
      destination_attribute :graph_id
    end
  end

  defp create_cloned_graph(source, new_name, tenant) do
    attrs = %{
      name: new_name || "#{source.name} (副本)",
      description: source.description,
      is_active: false,
      version: 1,
      job_position_id: source.job_position_id
    }

    Ash.create(__MODULE__, attrs, tenant: tenant, authorize?: false)
  end

  defp clone_core_tasks(source_graph, new_graph, tenant) do
    source_graph.core_tasks
    |> Enum.reduce_while({:ok, []}, fn task, {:ok, acc} ->
      new_attrs = %{
        title: task.title,
        description: task.description,
        weight: task.weight,
        sort_order: task.sort_order,
        graph_id: new_graph.id,
        job_position_id: new_graph.job_position_id
      }

      case Ash.create(KgEdu.MajorAnalysis.JobCoreTask, new_attrs, tenant: tenant, authorize?: false) do
        {:ok, new_task} -> {:cont, {:ok, [new_task | acc]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, _} -> :ok
      error -> error
    end
  end
end
