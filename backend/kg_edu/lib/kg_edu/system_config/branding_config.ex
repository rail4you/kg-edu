defmodule KgEdu.SystemConfig.BrandingConfig do
  @moduledoc """
  品牌配置 — 应用名称、Logo、页脚版权等全局外观设置。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - 单条记录（key = "default"），upsert 更新。
  - 字段为空时前端回退到默认值或环境变量。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "branding_configs"
    repo KgEdu.Repo
  end

  json_api do
    type "branding_config"
  end

  typescript do
    type_name "BrandingConfig"
  end

  code_interface do
    define :get_default, action: :read_default
    define :save, action: :upsert
  end

  actions do
    defaults [:read]

    read :read_default do
      description "读取默认品牌配置（单条）"
      filter expr(key == "default")
    end

    create :upsert do
      description "创建或更新品牌配置（key 固定为 default）"

      upsert? true
      upsert_identity :unique_key

      accept [
        :app_name,
        :app_title,
        :app_description,
        :app_copyright,
        :logo_light,
        :logo_dark,
        :favicon,
        :contact_email
      ]

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

    attribute :app_name, :string do
      allow_nil? true
      description "应用名称（如：易课程）"
      public? true
    end

    attribute :app_title, :string do
      allow_nil? true
      description "应用标题（如：智慧教学系统）"
      public? true
    end

    attribute :app_description, :string do
      allow_nil? true
      description "应用描述"
      public? true
    end

    attribute :app_copyright, :string do
      allow_nil? true
      description "页脚版权文本"
      public? true
    end

    attribute :logo_light, :string do
      allow_nil? true
      description "浅色 Logo 路径/URL"
      public? true
    end

    attribute :logo_dark, :string do
      allow_nil? true
      description "深色 Logo 路径/URL"
      public? true
    end

    attribute :favicon, :string do
      allow_nil? true
      description "Favicon 路径/URL"
      public? true
    end

    attribute :contact_email, :string do
      allow_nil? true
      description "联系邮箱"
      public? true
    end

    timestamps()
  end
end
