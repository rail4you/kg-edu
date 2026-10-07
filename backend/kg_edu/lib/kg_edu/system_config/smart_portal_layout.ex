defmodule KgEdu.SystemConfig.SmartPortalLayout do
  @moduledoc """
  智慧门户布局配置 — 组件化 / 参数化的门户页面布局（JSON）。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - 单条记录（key = "default"），upsert 更新。
  - `layout` 为 JSON：`%{"version" => 1, "blocks" => [...]}`；
    租户动态数据在渲染时由前端按访问者租户拉取，不存入本配置。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "smart_portal_layouts"
    repo KgEdu.Repo
  end

  json_api do
    type "smart_portal_layout"
  end

  typescript do
    type_name "SmartPortalLayout"
  end

  code_interface do
    define :get_default, action: :read_default
    define :save, action: :upsert
  end

  actions do
    defaults [:read]

    read :read_default do
      description "读取默认智慧门户布局（单条）"
      filter expr(key == "default")
    end

    create :upsert do
      description "创建或更新智慧门户布局（key 固定为 default）"

      upsert? true
      upsert_identity :unique_key
      accept [:name, :layout, :enabled]

      change set_attribute(:key, "default")
    end
  end

  identities do
    identity :unique_key, [:key]
  end

  attributes do
    uuid_primary_key :id

    attribute :key, :string do
      allow_nil? false
      description "配置键（固定为 default 单条）"
      public? true
    end

    attribute :name, :string do
      allow_nil? true
      description "布局名称"
      public? true
    end

    attribute :layout, :map do
      allow_nil? true
      default %{}
      description "布局 JSON：{ version, blocks: [...] }"
      public? true
    end

    attribute :enabled, :boolean do
      allow_nil? false
      default true
      description "是否启用"
      public? true
    end

    timestamps()
  end
end
