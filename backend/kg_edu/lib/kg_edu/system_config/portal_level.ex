defmodule KgEdu.SystemConfig.PortalLevel do
  @moduledoc """
  门户学历层级配置 — 研究生 / 本科 / 高职 / 中职 四个层级的名称与副标题。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - `level_key` 固定为 graduate / undergraduate / higher_vocational / secondary_vocational，
    与课程 `education_level` 字段值保持一致。
  - 名称（title / subtitle）可被超级管理员在「门户配置」页面动态修改。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "portal_levels"
    repo KgEdu.Repo
  end

  json_api do
    type "portal_level"
  end

  typescript do
    type_name "PortalLevel"
  end

  code_interface do
    define :get_all, action: :read, get?: false
    define :save, action: :upsert
  end

  actions do
    defaults [:read]

    create :upsert do
      description "按 level_key 创建或更新层级（key 存在则更新，否则新建）"

      upsert? true
      upsert_identity :unique_level_key
      accept [:level_key, :title, :subtitle, :sort_order]
    end
  end

  identities do
    identity :unique_level_key, [:level_key]
  end

  attributes do
    uuid_primary_key :id

    attribute :level_key, :string do
      allow_nil? false
      description "层级键（graduate / undergraduate / higher_vocational / secondary_vocational）"
      public? true
    end

    attribute :title, :string do
      allow_nil? false
      description "层级名称（如：研究生）"
      public? true
    end

    attribute :subtitle, :string do
      allow_nil? true
      description "层级副标题（如：学术型 / 专业学位）"
      public? true
    end

    attribute :sort_order, :integer do
      allow_nil? false
      default 0
      description "排序（越小越靠前）"
      public? true
    end

    timestamps()
  end
end
