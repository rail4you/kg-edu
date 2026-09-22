defmodule KgEdu.AI.AssistantTool do
  @moduledoc """
  需求 10：智能体应用池 / 自建插件 / MCP 服务注册表。
  kind: builtin（内置能力）/ plugin（自建插件）/ mcp（外部 MCP 服务）。
  plugin：插件类型名（见 PluginRunner），mcp 则在 config 存 endpoint。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "assistant_tools"
    repo KgEdu.Repo
  end

  json_api do
    type "assistant_tool"
  end

  typescript do
    type_name "AssistantTool"
  end

  code_interface do
    define :create_assistant_tool, action: :create
    define :update_assistant_tool, action: :update
    define :delete_assistant_tool, action: :destroy
    define :get_assistant_tool, action: :read, get_by: [:id]
    define :list_assistant_tools, action: :read
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:name, :kind, :plugin, :config, :enabled]
    end

    update :update do
      accept [:name, :kind, :plugin, :config, :enabled]
      require_atomic? false
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
      default :plugin
      constraints one_of: [:builtin, :plugin, :mcp]
    end

    attribute :plugin, :string do
      allow_nil? true
      public? true
      description "插件类型名（PluginRunner 支持列表）或 mcp 服务标识"
    end

    attribute :config, :map do
      allow_nil? true
      public? true
    end

    attribute :enabled, :boolean do
      allow_nil? false
      public? true
      default true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
