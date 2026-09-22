defmodule KgEdu.AI.AssistantSetting do
  @moduledoc """
  需求 10：AI 助教租户级开关 — 大模型兜底回复、联网搜索。
  每租户单例行（`tenant_key` 唯一，取 tenant 字符串）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "assistant_settings"
    repo KgEdu.Repo
  end

  json_api do
    type "assistant_setting"
  end

  typescript do
    type_name "AssistantSetting"
  end

  require Ash.Query

  code_interface do
    define :get_assistant_settings, action: :read
    define :save_assistant_settings, action: :upsert
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:tenant_key, :fallback_enabled, :web_search_enabled]
    end

    update :update do
      accept [:fallback_enabled, :web_search_enabled]
      require_atomic? false
    end

    action :upsert, :map do
      description "租户设置不存在则创建，存在则更新"
      argument :fallback_enabled, :boolean, allow_nil?: true
      argument :web_search_enabled, :boolean, allow_nil?: true

      run fn input, context ->
        tenant_key = context.tenant || "default"
        attrs = input.arguments |> Map.take([:fallback_enabled, :web_search_enabled]) |> Enum.reject(fn {_, v} -> is_nil(v) end) |> Map.new()

        existing =
          KgEdu.AI.AssistantSetting
          |> Ash.Query.filter(tenant_key == ^tenant_key)
          |> Ash.read_one(tenant: context.tenant, authorize?: false)

        case existing do
          {:ok, nil} ->
            case KgEdu.AI.AssistantSetting
                 |> Ash.Changeset.for_create(:create, Map.put(attrs, :tenant_key, tenant_key))
                 |> Ash.create(tenant: context.tenant, authorize?: false) do
              {:ok, record} -> {:ok, Map.from_struct(record) |> Map.take([:id, :tenant_key, :fallback_enabled, :web_search_enabled])}
              {:error, reason} -> {:error, reason}
            end

          {:ok, record} ->
            case record
                 |> Ash.Changeset.for_update(:update, attrs)
                 |> Ash.update(tenant: context.tenant, authorize?: false) do
              {:ok, updated} -> {:ok, Map.from_struct(updated) |> Map.take([:id, :tenant_key, :fallback_enabled, :web_search_enabled])}
              {:error, reason} -> {:error, reason}
            end

          {:error, reason} ->
            {:error, reason}
        end
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

    attribute :tenant_key, :string do
      allow_nil? false
      public? true
    end

    attribute :fallback_enabled, :boolean do
      allow_nil? false
      public? true
      default true
      description "大模型兜底回复开关"
    end

    attribute :web_search_enabled, :boolean do
      allow_nil? false
      public? true
      default false
      description "联网搜索开关"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  identities do
    identity :unique_tenant_key, [:tenant_key]
  end
end
