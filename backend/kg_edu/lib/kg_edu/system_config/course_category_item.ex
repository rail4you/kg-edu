defmodule KgEdu.SystemConfig.CourseCategoryItem do
  @moduledoc """
  课程类别下的课程项 — 记录某个租户（schema）下的某门课程。

  - 由超级管理员在「门户配置 → 课程类别」中按租户挑选课程。
  - `tenant_schema` 为组织 schema（如 org_xxx），`course_id` 为对应租户 courses 表主键。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "course_category_items"
    repo KgEdu.Repo
  end

  json_api do
    type "course_category_item"
  end

  typescript do
    type_name "CourseCategoryItem"
  end

  code_interface do
    define :list_all, action: :read, get?: false
    define :create_item, action: :create
    define :delete_item, action: :destroy
  end

  actions do
    read :read

    create :create do
      accept [:category_id, :tenant_schema, :course_id, :sort_order]
    end

    destroy :destroy
  end

  relationships do
    belongs_to :category, KgEdu.SystemConfig.CourseCategory,
      attribute_type: :uuid,
      public?: true
  end

  attributes do
    uuid_primary_key :id

    attribute :tenant_schema, :string do
      allow_nil? false
      description "课程所属租户 schema"
      public? true
    end

    attribute :course_id, :uuid do
      allow_nil? false
      description "课程 id（租户 courses 表主键）"
      public? true
    end

    attribute :sort_order, :integer do
      allow_nil? false
      default 0
      description "课程项在类别内的排序"
      public? true
    end

    timestamps()
  end
end
