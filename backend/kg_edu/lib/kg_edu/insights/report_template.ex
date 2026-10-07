defmodule KgEdu.Insights.ReportTemplate do
  @moduledoc """
  P4: 数据报告/报表模板 — 保存可复用的分析配置（主题/数据集/字段/排序）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Insights,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "report_templates"
    repo KgEdu.Repo
  end

  json_api do
    type "report_template"
  end

  typescript do
    type_name "ReportTemplate"
  end

  code_interface do
    define :create_report_template, action: :create
    define :update_report_template, action: :update
    define :delete_report_template, action: :destroy
    define :get_report_template, action: :read, get_by: [:id]
    define :list_report_templates, action: :read
    define :ask_data_question, action: :ask_question
    define :build_data_report, action: :build_report
    define :build_data_table, action: :build_table
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:name, :kind, :config, :created_by_id]
    end

    update :update do
      accept [:name, :kind, :config]
      require_atomic? false
    end

    # P4-13: AI 数据问答 — 自然语言问教学运行数据，返回表格 + AI 解读
    action :ask_question, :map do
      argument :question, :string, allow_nil?: false
      argument :days, :integer, allow_nil?: true, default: 30

      run fn input, context ->
        KgEdu.Insights.Engine.ask(input.arguments.question, context.tenant,
          days: input.arguments.days
        )
      end
    end

    # P4-14: AI 数据报告 — 主题 → 大纲（可调）→ 文本 + 统计图 + 数据表
    action :build_report, :map do
      argument :theme, :string, allow_nil?: false
      argument :outline, {:array, :map}, allow_nil?: true
      argument :days, :integer, allow_nil?: true, default: 30

      run fn input, context ->
        KgEdu.Insights.Engine.build_report(
          input.arguments.theme,
          context.tenant,
          outline: input.arguments[:outline],
          days: input.arguments.days
        )
      end
    end

    # P4-15: AI 数据报表 — 数据集 + 时间范围/字段/排序 → 表格
    action :build_table, :map do
      argument :dataset, :string, allow_nil?: false
      argument :days, :integer, allow_nil?: true, default: 30
      argument :fields, {:array, :string}, allow_nil?: true
      argument :sort_by, :string, allow_nil?: true
      argument :sort_dir, :string, allow_nil?: true, default: "desc"

      run fn input, context ->
        KgEdu.Insights.Engine.build_table(
          input.arguments.dataset,
          context.tenant,
          days: input.arguments.days,
          fields: input.arguments[:fields],
          sort_by: input.arguments[:sort_by],
          sort_dir: input.arguments[:sort_dir] || "desc"
        )
      end
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :kind, :atom do
      allow_nil? false
      public? true
      default :report
      constraints one_of: [:report, :table, :outline]
    end

    attribute :config, :map do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :created_by, KgEdu.Accounts.User do
      allow_nil? true
      public? true
    end
  end
end
