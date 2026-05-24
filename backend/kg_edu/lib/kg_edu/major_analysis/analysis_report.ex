defmodule KgEdu.MajorAnalysis.AnalysisReport do
  @moduledoc """
  分析报告资源。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "analysis_reports"
    repo KgEdu.Repo
    references do
      reference :major, on_delete: :delete
    end
  end

  json_api do
    type "analysis_report"
  end

  typescript do
    type_name "AnalysisReport"
  end

  code_interface do
    define :create_report, action: :create
    define :delete_report, action: :destroy
    define :get_report, action: :by_id
    define :list_reports, action: :read
    define :get_reports_by_major, action: :by_major
    define :get_reports_by_type, action: :by_type
    define :generate_report, action: :generate_report
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_major do
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))
    end

    read :by_type do
      argument :report_type, :atom, allow_nil?: false
      filter expr(report_type == ^arg(:report_type))
    end

    create :create do
      accept [:title, :report_type, :content, :major_id, :ai_generated]
    end

    action :generate_report, :map do
      description "Generate an AI analysis report"
      argument :major_id, :uuid, allow_nil?: false
      argument :report_type, :atom, allow_nil?: false
      argument :title, :string, allow_nil?: true

      run fn input, context ->
        tenant = context.tenant
        report_title = input.arguments.title || default_title(input.arguments.report_type)
        content = generate_markdown(input.arguments.report_type)

        __MODULE__
        |> Ash.Changeset.for_create(:create, %{
          title: report_title,
          report_type: input.arguments.report_type,
          content: content,
          major_id: input.arguments.major_id,
          ai_generated: true
        }, tenant: tenant, authorize?: false)
        |> Ash.create()
      end
    end
  end

  policies do
    # 公开读取分析报告
    policy [action(:read), action(:by_id), action(:by_major), action(:by_type)] do
      authorize_if always()
    end

    # 教师/管理员可管理报告
    policy [action(:create), action(:destroy), action(:generate_report)] do
      authorize_if expr(:teacher == ^actor(:role))
      authorize_if expr(:admin == ^actor(:role))
      authorize_if expr(:super_admin == ^actor(:role))
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
    end

    attribute :report_type, :atom do
      allow_nil? false
      public? true
      constraints one_of: [:job_analysis, :competency, :curriculum, :comprehensive]
    end

    attribute :content, :string do
      allow_nil? true
      public? true
      description "Markdown content"
    end

    attribute :ai_generated, :boolean do
      allow_nil? false
      public? true
      default false
    end

    attribute :generated_at, :utc_datetime_usec do
      allow_nil? true
      public? true
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

  defp default_title(:job_analysis), do: "岗位分析报告"
  defp default_title(:competency), do: "专业能力图谱报告"
  defp default_title(:curriculum), do: "课程体系设计报告"
  defp default_title(:comprehensive), do: "综合分析报告"
  defp default_title(_), do: "分析报告"

  defp generate_markdown(type) do
    now = DateTime.utc_now() |> DateTime.to_string()
    "# #{default_title(type)}\n\n> 生成时间: #{now}\n\n## 概述\n\n本报告基于专业信息数据，通过 AI 辅助分析生成。\n\n## 详细分析\n\n（AI 分析内容将在实际集成后填充）\n"
  end
end
