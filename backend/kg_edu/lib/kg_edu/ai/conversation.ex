defmodule KgEdu.AI.Conversation do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "ai_conversations"
    repo KgEdu.Repo
  end

  json_api do
    type "ai_conversation"
  end

  typescript do
    type_name "AIConversation"
  end

  code_interface do
    define :get_conversation, action: :by_id
    define :list_conversations, action: :read
    define :create_conversation, action: :create
    define :delete_conversation, action: :destroy
  end

  actions do
    defaults [:destroy]

    read :read do
      description "List AI conversations, optionally filtered by user"
      pagination offset?: true, keyset?: true, required?: false
      primary? true

      argument :created_by_id, :uuid do
        description "Filter by creator user ID"
        allow_nil? true
      end

      prepare build(sort: [inserted_at: :desc])

      filter expr(
        is_nil(^arg(:created_by_id)) or created_by_id == ^arg(:created_by_id)
      )
    end

    read :by_id do
      description "Get a conversation by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a new AI conversation"
      accept [:title, :thread_id, :ai_command_id, :created_by_id]
    end

    update :update do
      description "Update an AI conversation"
      accept [:title]
    end
  end

  policies do
    policy action(:read) do
      authorize_if always()
    end

    policy action(:create) do
      authorize_if always()
    end

    policy action(:by_id) do
      authorize_if always()
    end

    policy action(:update) do
      authorize_if always()
    end

    policy action(:destroy) do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      constraints max_length: 500
      public? true
      description "Title of the conversation"
    end

    attribute :thread_id, :string do
      allow_nil? false
      constraints max_length: 255
      public? true
      description "Pi Agent thread ID"
    end

    attribute :ai_command_id, :uuid do
      allow_nil? true
      public? true
      description "Optional reference to the AI command used"
    end

    attribute :created_by_id, :uuid do
      allow_nil? false
      public? true
      description "User ID who created the conversation"
    end

    timestamps()
  end

  identities do
    identity :unique_thread_id, [:thread_id]
  end
end
