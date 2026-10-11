defmodule KgEdu.Knowledge.SmartPortalConfig do
  @moduledoc """
  教师端智慧门户配置 — 存于租户 schema，每位教师可创建多个门户。

  - `layout` 为组件化 JSON：`%{"version" => 1, "blocks" => [...]}`，
    默认包含 6 个 AI 实践功能块（可配置角色/参数）与课程列表等展示模块；
  - `student_ids` 记录该门户分配到的学生；学生端仅能读取分配给自己的配置；
  - 沿用 PracticeSession / PracticeAttempt 的租户策略与放开式 policy。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "smart_portal_configs"
    repo KgEdu.Repo
  end

  json_api do
    type "smart_portal_config"
  end

  typescript do
    type_name "SmartPortalConfig"
  end

  code_interface do
    define :create_config, action: :create
    define :get_config, action: :read, get_by: [:id]
    define :list_configs, action: :read
    define :list_by_teacher, action: :by_teacher
    define :update_config, action: :update
    define :delete_config, action: :destroy
  end

  actions do
    defaults [:read, :destroy]

    read :by_teacher do
      description "按教师读取智慧门户配置"
      argument :teacher_id, :uuid, allow_nil?: false
      filter expr(teacher_id == ^arg(:teacher_id))
    end

    create :create do
      accept [:teacher_id, :name, :enabled, :layout, :student_ids]
    end

    update :update do
      accept [:name, :enabled, :layout, :student_ids]
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

    attribute :teacher_id, :uuid do
      allow_nil? false
      public? true
      description "所属教师"
    end

    attribute :name, :string do
      allow_nil? true
      public? true
      default "智慧门户"
    end

    attribute :enabled, :boolean do
      allow_nil? false
      public? true
      default true
    end

    attribute :layout, :map do
      allow_nil? true
      public? true
      default %{}
      description "布局 JSON：{ version, blocks: [...] }"
    end

    attribute :student_ids, {:array, :uuid} do
      allow_nil? false
      public? true
      default []
      description "已分配该门户的学生 id 列表"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
