defmodule KgEdu.SystemConfig.SiteContentConfig do
  @moduledoc """
  站点内容配置 — 平台简介、联系我们、隐私条款等展示文案。

  - 存储于 public schema（无租户上下文），由超级管理员维护。
  - 单条记录（key = "default"），upsert 更新。
  - 「平台简介」多段文字用 `\n\n` 分隔；「隐私条款」保留换行全文。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "site_content_configs"
    repo KgEdu.Repo
  end

  json_api do
    type "site_content_config"
  end

  typescript do
    type_name "SiteContentConfig"
  end

  code_interface do
    define :get_default, action: :read_default
    define :save, action: :upsert
  end

  actions do
    defaults [:read]

    read :read_default do
      description "读取默认站点内容配置（单条）"
      filter expr(key == "default")
    end

    create :upsert do
      description "创建或更新站点内容配置（key 固定为 default）"

      upsert? true
      upsert_identity :unique_key
      accept [
        :about_intro,
        :contact_email,
        :contact_address,
        :contact_hours,
        :privacy_policy
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

    attribute :about_intro, :string do
      allow_nil? true
      description "平台简介（多段文字用两个换行分隔）"
      public? true
    end

    attribute :contact_email, :string do
      allow_nil? true
      description "联系邮箱"
      public? true
    end

    attribute :contact_address, :string do
      allow_nil? true
      description "联系地址"
      public? true
    end

    attribute :contact_hours, :string do
      allow_nil? true
      description "工作时间"
      public? true
    end

    attribute :privacy_policy, :string do
      allow_nil? true
      description "隐私条款全文"
      public? true
    end

    timestamps()
  end
end