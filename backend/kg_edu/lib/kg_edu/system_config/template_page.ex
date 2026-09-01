defmodule KgEdu.SystemConfig.TemplatePage do
  @moduledoc """
  门户模板页配置 — 首页导航中「课程 / 微专业」之后的模板页。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - 每页包含：名称（name）、访问标识（slug）、概述（overview）、实际内容（content）、
    排序（sort_order）、是否启用（enabled）。
  - 首页导航按 sort_order 顺序展示启用的模板页，访问链接为 `/page/<slug>`。
  - content 支持 Markdown 富文本（分段、标题、列表等）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "template_pages"
    repo KgEdu.Repo
  end

  json_api do
    type "template_page"
  end

  typescript do
    type_name "TemplatePage"
  end

  code_interface do
    define :list_all, action: :read, get?: false
    define :get_by_slug, action: :by_slug, get?: true
    define :create_page, action: :create
    define :update_page, action: :update
    define :delete_page, action: :destroy
  end

  actions do
    read :read

    create :create do
      accept [:name, :slug, :overview, :content, :sort_order, :enabled]
    end

    update :update do
      require_atomic? false
      accept [:name, :slug, :overview, :content, :sort_order, :enabled]
    end

    destroy :destroy

    read :by_slug do
      description "按 slug 读取模板页"
      filter expr(slug == arg(:slug))
      argument :slug, :string, allow_nil?: false
    end
  end

  identities do
    identity :unique_slug, [:slug]
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      description "模板页名称（如：教学资源库）"
      public? true
    end

    attribute :slug, :string do
      allow_nil? false
      description "访问标识（用于 /page/<slug> 链接，需为英文字母/数字/连字符）"
      public? true
    end

    attribute :overview, :string do
      allow_nil? true
      description "概述（页面顶部简要介绍）"
      public? true
    end

    attribute :content, :string do
      allow_nil? true
      description "实际内容（支持 Markdown）"
      public? true
    end

    attribute :sort_order, :integer do
      allow_nil? false
      default 0
      description "排序（越小越靠前）"
      public? true
    end

    attribute :enabled, :boolean do
      allow_nil? false
      default true
      description "是否在首页导航展示"
      public? true
    end

    timestamps()
  end
end
