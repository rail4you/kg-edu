defmodule KgEdu.SystemConfig.ApiKeyConfig do
  @moduledoc """
  Global API key configuration for AI providers (Qwen, etc.).
  Stored in the public schema (no tenant context) — managed by super admins only.
  Supports runtime key replacement without restarting the application.

  Providers:
  - `:qwen` — DashScope (https://dashscope.aliyuncs.com/compatible-mode/v1)
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.SystemConfig,
    data_layer: AshPostgres.DataLayer,
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "api_key_configs"
    repo KgEdu.Repo
  end

  json_api do
    type "api_key_config"
  end

  typescript do
    type_name "ApiKeyConfig"
  end

  code_interface do
    define :get_config, action: :by_provider
    define :set_config, action: :upsert
    define :list_configs, action: :read
    define :delete_config, action: :destroy
  end

  actions do
    defaults [:read, :destroy]

    read :by_provider do
      description "Get API key config for a specific provider"
      argument :provider, :string, allow_nil?: false
      filter expr(provider == ^arg(:provider))
    end

    create :upsert do
      description "Create or update an API key config for a provider"

      argument :provider, :atom do
        allow_nil? false
        constraints one_of: [:qwen]
        description "The AI provider identifier"
      end

      argument :api_key, :string do
        allow_nil? false
        sensitive? true
        description "The API key for the provider"
      end

      argument :base_url, :string do
        allow_nil? true
        description "Optional custom base URL override"
      end

      upsert? true
      upsert_identity :unique_provider
      accept [:provider, :api_key, :base_url]

      change set_attribute(:provider, arg(:provider))
      change set_attribute(:api_key, arg(:api_key))

      change fn changeset, _context ->
        base_url = Ash.Changeset.get_argument(changeset, :base_url)
        if base_url, do: Ash.Changeset.force_change_attribute(changeset, :base_url, base_url), else: changeset
      end

      # After saving to DB, refresh the in-memory cache immediately
      change fn changeset, _context ->
        KgEdu.Agent.ApiKeyProvider.refresh()
        changeset
      end
    end
  end

  identities do
    identity :unique_provider, [:provider]
  end

  attributes do
    uuid_primary_key :id

    attribute :provider, :string do
      allow_nil? false
      description "Provider identifier (e.g. 'qwen')"
      public? true
    end

    attribute :api_key, :string do
      allow_nil? false
      description "The encrypted or plaintext API key"
      sensitive? true
      public? true
    end

    attribute :base_url, :string do
      allow_nil? true
      description "Optional API base URL override"
      public? true
    end

    timestamps()
  end
end
