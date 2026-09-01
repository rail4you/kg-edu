defmodule KgEdu.SystemConfig.CourseCategory do
  @moduledoc """
  门户课程类别配置 — 首页「推荐课程 / 新开课程」等模块与课程列表页 Tab。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - 每个类别包含：名称（name）、标识（slug）、排序（sort_order）、是否启用（enabled），
    以及按租户选定的课程项（items，见 CourseCategoryItem）。
  - 首页按 sort_order 顺序渲染启用的类别模块；课程列表页「全部课程」之外的 Tab 均为动态类别。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "course_categories"
    repo KgEdu.Repo
  end

  json_api do
    type "course_category"
  end

  typescript do
    type_name "CourseCategory"
  end

  code_interface do
    define :list_all, action: :read, get?: false
    define :create_category, action: :create
    define :update_category, action: :update
    define :delete_category, action: :destroy
  end

  actions do
    read :read

    create :create do
      accept [:name, :slug, :sort_order, :enabled]
    end

    update :update do
      require_atomic? false
      accept [:name, :slug, :sort_order, :enabled]
    end

    destroy :destroy
  end

  relationships do
    has_many :items, KgEdu.SystemConfig.CourseCategoryItem,
      destination_attribute: :category_id,
      public?: true
  end

  identities do
    identity :unique_slug, [:slug]
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      description "类别名称（如：推荐课程）"
      public? true
    end

    attribute :slug, :string do
      allow_nil? false
      description "类别标识（英文，如 recommended）"
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
      description "是否在首页与课程列表页展示"
      public? true
    end

    timestamps()
  end
end
