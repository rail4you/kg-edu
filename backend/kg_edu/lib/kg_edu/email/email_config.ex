defmodule KgEdu.Email.EmailConfig do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Email,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "email_configs"
    repo KgEdu.Repo
  end

  json_api do
    type "email_config"
  end

  typescript do
    type_name "EmailConfig"
  end

  code_interface do
    define :list_email_configs, action: :read
    define :get_email_config, action: :by_id
    define :get_email_config_by_user, action: :by_user
    define :create_email_config, action: :create
    define :update_email_config, action: :update
    define :delete_email_config, action: :destroy
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get an email config by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_user do
      description "Get email config for a specific user"
      argument :user_id, :uuid, allow_nil?: false
      filter expr(user_id == ^arg(:user_id))
    end

    create :create do
      description "Create a new email config for a user"
      accept [:email_address, :sender_name, :api_key]

      argument :user_id, :uuid do
        allow_nil? false
        description "The user ID to create email config for"
      end

      change set_attribute(:user_id, arg(:user_id))

      # Validate that user doesn't already have an email config
      validate fn changeset, _context ->
        user_id = Ash.Changeset.get_argument(changeset, :user_id)

        # Read all email configs in tenant and filter manually
        case __MODULE__ |> Ash.read(tenant: changeset.tenant, authorize?: false) do
          {:ok, configs} ->
            case Enum.find(configs, fn config -> config.user_id == user_id end) do
              nil -> :ok
              _existing -> {:error, "User already has an email config"}
            end

          {:error, _} ->
            # If there's an error checking, allow the operation to proceed
            :ok
        end
      end
    end

    update :update do
      description "Update email config"
      accept [:email_address, :sender_name, :api_key]
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
    uuid_primary_key :id

    attribute :email_address, :string do
      allow_nil? false
      description "Email address for sending emails"
      public? true
    end

    attribute :sender_name, :string do
      allow_nil? false
      description "Display name for the sender"
      public? true
    end

    attribute :api_key, :string do
      allow_nil? false
      description "API key for email service provider"
      sensitive? true
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :user, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "The user who owns this email config"
    end

    has_many :received_messages, KgEdu.Email.EmailMessage do
      public? true
      destination_attribute :receiver_user_id
      description "Email messages received by this user"
    end
  end
end
