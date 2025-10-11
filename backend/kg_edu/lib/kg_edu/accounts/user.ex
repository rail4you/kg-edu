defmodule KgEdu.Accounts.User do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Accounts,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshAuthentication, AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  authentication do
    add_ons do
      log_out_everywhere do
        apply_on_password_change? true
      end
    end

    tokens do
      enabled? true
      token_resource KgEdu.Accounts.Token
      signing_secret KgEdu.Secrets
      store_all_tokens? true
      require_token_presence_for_authentication? true
    end

    strategies do
      password :password do
        identity_field :member_id
        hash_provider AshAuthentication.BcryptProvider

        resettable do
          sender KgEdu.Accounts.User.Senders.SendPasswordResetEmail
          # these configurations will be the default in a future release
          password_reset_action_name :reset_password_with_token
          request_password_reset_action_name :request_password_reset_token
        end
      end
    end
  end

  postgres do
    table "users"
    repo KgEdu.Repo
  end

  json_api do
    type "user"
  end

  code_interface do
    define :register_user, action: :register_with_password
    define :sign_in, action: :sign_in_with_password
    define :sign_out, action: :sign_out
    define :get_current_user, action: :get_current_user
    define :change_password, action: :change_password
    define :request_password_reset, action: :request_password_reset_token
    define :reset_password, action: :reset_password_with_token
    define :create_user, action: :create
    define :update_user, action: :update
    define :delete_user, action: :destroy
    define :get_user, action: :read, get_by: [:id]
    define :get_users, action: :read
  end

  actions do
    defaults [:read, :create, :update, :destroy]

    read :get_users do
      description "Get all users"

      # This action is used to retrieve all users, typically for admin purposes
      # filter expr(true) # No filter, retrieves all users
    end

    read :by_id do
      description "Get a user by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :get_current_user do
      description "Get the current authenticated user"
      get? true

      # Uses the authenticated user from the actor context
      filter expr(id == ^actor(:id))
    end

    read :get_by_subject do
      description "Get a user by the subject claim in a JWT"
      argument :subject, :string, allow_nil?: false
      get? true
      prepare AshAuthentication.Preparations.FilterBySubject
    end

    update :change_password do
      # Use this action to allow users to change their password by providing
      # their current password and a new password.

      require_atomic? false
      accept []
      argument :current_password, :string, sensitive?: true, allow_nil?: false

      argument :password, :string,
        sensitive?: true,
        allow_nil?: false,
        constraints: [min_length: 8]

      argument :password_confirmation, :string, sensitive?: true, allow_nil?: false

      validate confirm(:password, :password_confirmation)

      validate {AshAuthentication.Strategy.Password.PasswordValidation,
                strategy_name: :password, password_argument: :current_password}

      change {AshAuthentication.Strategy.Password.HashPasswordChange, strategy_name: :password}
    end

    read :sign_in_with_password do
      description "Attempt to sign in using a student ID and password."
      get? true

      argument :member_id, :string do
        description "The student ID to use for retrieving the user."
        allow_nil? false
      end

      argument :password, :string do
        description "The password to check for the matching user."
        allow_nil? false
        sensitive? true
      end

      # validates the provided student_id and password and generates a token
      prepare AshAuthentication.Strategy.Password.SignInPreparation

      metadata :token, :string do
        description "A JWT that can be used to authenticate the user."
        allow_nil? false
      end
    end

    read :sign_in_with_token do
      # In the generated sign in components, we validate the
      # email and password directly in the LiveView
      # and generate a short-lived token that can be used to sign in over
      # a standard controller action, exchanging it for a standard token.
      # This action performs that exchange. If you do not use the generated
      # liveviews, you may remove this action, and set
      # `sign_in_tokens_enabled? false` in the password strategy.

      description "Attempt to sign in using a short-lived sign in token."
      get? true

      argument :token, :string do
        description "The short-lived sign in token."
        allow_nil? false
        sensitive? true
      end

      # validates the provided sign in token and generates a token
      prepare AshAuthentication.Strategy.Password.SignInWithTokenPreparation

      metadata :token, :string do
        description "A JWT that can be used to authenticate the user."
        allow_nil? false
      end
    end

    create :register_with_password do
      description "Register a new user with a student ID and password."

      argument :member_id, :string do
        allow_nil? false
      end

      argument :name, :string do
        allow_nil? true
      end

      argument :password, :string do
        description "The proposed password for the user, in plain text."
        allow_nil? false
        constraints min_length: 8
        sensitive? true
      end

      argument :password_confirmation, :string do
        description "The proposed password for the user (again), in plain text."
        allow_nil? false
        sensitive? true
      end


      argument :role, :atom do
        description "The role of the user (admin, user, teacher). Defaults to :user."
        allow_nil? true
        default :user
        constraints one_of: [:admin, :user, :teacher]
      end

      # Sets the student_id from the argument
      change set_attribute(:member_id, arg(:member_id))
      change set_attribute(:name, arg(:name))

      # Sets the role from the argument
      change set_attribute(:role, arg(:role))

      # Hashes the provided password
      change AshAuthentication.Strategy.Password.HashPasswordChange

      # Generates an authentication token for the user
      change AshAuthentication.GenerateTokenChange

      # validates that the password matches the confirmation
      validate AshAuthentication.Strategy.Password.PasswordConfirmationValidation

      metadata :token, :string do
        description "A JWT that can be used to authenticate the user."
        allow_nil? false
      end

      # Log user registration data
      change {__MODULE__.Changes.LogUserRegistration, []}
    end

    action :request_password_reset_token do
      description "Send password reset instructions to a user if they exist."

      argument :member_id, :string do
        allow_nil? false
      end

      # creates a reset token and invokes the relevant senders
      run {AshAuthentication.Strategy.Password.RequestPasswordReset, action: :get_by_member_id}
    end

    read :get_by_member_id do
      description "Looks up a user by their student ID"
      get? true

      argument :member_id, :string do
        allow_nil? false
      end

      filter expr(member_id == ^arg(:member_id))
    end

    update :reset_password_with_token do
      argument :reset_token, :string do
        allow_nil? false
        sensitive? true
      end

      argument :password, :string do
        description "The proposed password for the user, in plain text."
        allow_nil? false
        constraints min_length: 8
        sensitive? true
      end

      argument :password_confirmation, :string do
        description "The proposed password for the user (again), in plain text."
        allow_nil? false
        sensitive? true
      end

      # validates the provided reset token
      validate AshAuthentication.Strategy.Password.ResetTokenValidation

      # validates that the password matches the confirmation
      validate AshAuthentication.Strategy.Password.PasswordConfirmationValidation

      # Hashes the provided password
      change AshAuthentication.Strategy.Password.HashPasswordChange

      # Generates an authentication token for the user
      change AshAuthentication.GenerateTokenChange
    end

    action :sign_out do
      description "Sign out the current user by revoking their token"

      argument :id, :uuid do
        description "The user ID"
        allow_nil? false
      end

      argument :token, :string do
        description "The JWT token to revoke"
        allow_nil? false
        sensitive? true
      end

      run {AshAuthentication.Actions.SignOut, action: :sign_out}
    end
  end

  policies do
     policy always() do
      authorize_if always()
    end

    # bypass AshAuthentication.Checks.AshAuthenticationInteraction do
    #   authorize_if always()
    # end

    # # Allow public access to authentication actions
    # policy action(:register_with_password) do
    #   authorize_if always()
    # end

    # policy action(:sign_in_with_password) do
    #   authorize_if always()
    # end

    # policy action(:request_password_reset_token) do
    #   authorize_if always()
    # end

    # policy action(:reset_password_with_token) do
    #   authorize_if always()
    # end

    # # Require authentication for user-specific actions
    # policy action(:get_current_user) do
    #   authorize_if actor_present()
    # end

    # policy action(:change_password) do
    #   authorize_if actor_present()
    # end

    # policy action(:sign_out) do
    #   authorize_if actor_present()
    # end

    # # Admin can manage all users and roles
    # policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #   description "Admin can manage all users"
    #   authorize_if actor_attribute_equals(:role, "admin")
    # end

    # # Users can only read their own profile
    # # policy [action(:read)] do
    # #   description "Users can read their own profile"
    # #   authorize_if expr(id == ^actor(:id))
    # # end

    # # Users can update their own profile (but not role)
    # policy [action(:update)] do
    #   description "Users can update their own profile (except role)"
    #   authorize_if expr(id == ^actor(:id))
    #   forbid_if changing_attributes(:role)
    # end

    # # Default policy - forbid everything else
    # policy always() do
    #   authorize_if always()
    # end
  end

  attributes do
    uuid_primary_key :id

    attribute :member_id, :string do
      allow_nil? false
      public? true
    end

    attribute :name, :string do
      allow_nil? true
      public? true
    end

    attribute :email, :ci_string do
      allow_nil? true
      public? true
    end

    attribute :hashed_password, :string do
      allow_nil? false
      sensitive? true
    end

    attribute :role, :atom do
      allow_nil? false
      default :user
      constraints one_of: [:admin, :user, :teacher]
      public? true
    end
  end

  calculations do
    calculate :auth_token, :string do
      calculation expr(context[:token])
    end
  end

  identities do
    identity :unique_member_id, [:member_id]
  end
end
