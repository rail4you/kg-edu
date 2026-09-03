defmodule KgEdu.MajorAnalysis.JobPosition do
  @moduledoc """
  岗位信息资源。
  记录与专业关联的岗位信息，支持 AI 分析。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "job_positions"
    repo KgEdu.Repo

    references do
      reference :major, on_delete: :delete
    end
  end

  json_api do
    type "job_position"
  end

  typescript do
    type_name "JobPosition"
  end

  code_interface do
    define :create_job_position, action: :create
    define :update_job_position, action: :update_job_position
    define :delete_job_position, action: :destroy
    define :get_job_position, action: :by_id
    define :list_job_positions, action: :read
    define :get_positions_by_major, action: :by_major
    define :trigger_ai_analysis, action: :trigger_ai_analysis
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a job position by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_major do
      description "Get job positions by major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))
    end

    create :create do
      description "Create a new job position"
      accept [:title, :description, :requirements, :salary_range, :source, :major_id]
    end

    update :update_job_position do
      description "Update a job position"
      accept [:title, :description, :requirements, :salary_range, :source, :ai_analysis, :major_id]
      require_atomic? false
    end

    action :trigger_ai_analysis, :map do
      description "Trigger AI analysis for a specific job position"
      argument :id, :uuid, allow_nil?: false

      run fn input, context ->
        tenant = context.tenant

        case Ash.get(__MODULE__, input.arguments.id, tenant: tenant, authorize?: false) do
          {:ok, position} ->
            # Call AI Agent service for analysis
            case call_ai_job_analysis(position, tenant) do
              {:ok, analysis_result} ->
                # Update the position with AI analysis
                position
                |> Ash.Changeset.for_update(:update_job_position, %{
                  ai_analysis: analysis_result
                }, tenant: tenant, authorize?: false)
                |> Ash.update()

              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, reason}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_id)
      authorize_if action(:by_major)
      authorize_if action(:create)
      authorize_if action(:update_job_position)
      authorize_if action(:destroy)
      authorize_if action(:trigger_ai_analysis)
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
      description "Job title"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Job description"
    end

    attribute :requirements, :string do
      allow_nil? true
      public? true
      description "Job requirements"
    end

    attribute :salary_range, :string do
      allow_nil? true
      public? true
      description "Salary range"
    end

    attribute :source, :string do
      allow_nil? true
      public? true
      description "Source of job information"
    end

    attribute :ai_analysis, :string do
      allow_nil? true
      public? true
      description "AI analysis result (JSON string)"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :major, KgEdu.MajorAnalysis.Major do
      allow_nil? false
      public? true
    end
  end

  defp call_ai_job_analysis(_position, _tenant) do
    # TODO: Call actual AI Agent service
    # For now, return a placeholder analysis
    {:ok, Jason.encode!(%{
      core_skills: ["沟通能力", "团队协作", "专业技能"],
      development_prospect: "良好",
      difficulty_level: "中等",
      recommended_courses: [],
      analyzed_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })}
  end
end
