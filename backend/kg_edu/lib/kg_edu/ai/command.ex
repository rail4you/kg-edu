defmodule KgEdu.AI.Command do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "ai_commands"
    repo KgEdu.Repo
  end

  json_api do
    type "ai_command"
  end

  typescript do
    type_name "AICommand"
  end

  code_interface do
    define :get_command, action: :by_id
    define :list_commands, action: :read
    define :create_command, action: :create
    define :update_command, action: :update
    define :delete_command, action: :destroy
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a command by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a new AI command"
      accept [:title, :user, :system, :assistant]

      validate fn changeset, _context ->
        user = Ash.Changeset.get_attribute(changeset, :user)
        system = Ash.Changeset.get_attribute(changeset, :system)
        assistant = Ash.Changeset.get_attribute(changeset, :assistant)

        cond do
          is_nil(user) and is_nil(system) and is_nil(assistant) ->
            {:error, "At least one of user, system, or assistant command must be provided"}

          true ->
            :ok
        end
      end
    end

    update :update do
      description "Update an AI command"
      accept [:title, :user, :system, :assistant]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? true
      constraints max_length: 200
      public? true
      description "Title of the AI command"
    end

    attribute :user, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "User-provided command input"
    end

    attribute :system, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "System-generated command or instruction"
    end

    attribute :assistant, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "Assistant-generated response or command"
    end

    timestamps()
  end

  identities do
    identity :unique_user_system_assistant_trio, [:user, :system, :assistant]
  end
end
