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

  multitenancy do
    strategy :context
  end

  json_api do
    type "user"
  end

  typescript do
    type_name "User"
  end

  code_interface do
    define :register_user, action: :register_with_password
    define :register_user_in_tenant, action: :register_user_in_tenant
    define :register_super_admin, action: :register_super_admin
    define :sign_in, action: :sign_in_with_password
    define :super_admin_sign_in, action: :super_admin_sign_in
    define :sign_in_tenant, action: :sign_in_tenant
    define :sign_out, action: :sign_out
    define :get_current_user, action: :get_current_user
    define :change_password, action: :change_password
    define :request_password_reset, action: :request_password_reset_token
    define :reset_password, action: :reset_password_with_token
    define :create_user, action: :create_user
    define :update_user, action: :update
    define :delete_user, action: :destroy
    define :get_user, action: :read, get_by: [:id]
    define :get_users, action: :read
    define :import_users_from_excel, action: :import_users_from_excel
    # student crud
    define :create_student, action: :create_student
    define :list_student, action: :list_student
    define :update_student, action: :update_student
    # class-based queries
    define :get_students_by_class, action: :get_students_by_class
    define :list_student_classes, action: :list_student_classes
    define :create_students_for_class, action: :create_students_for_class
    # class management
    define :remove_student_from_class, action: :remove_student_from_class
    # super admin tenant management
    define :get_users_from_tenant, action: :get_users_from_tenant
  end

  actions do
    defaults [:read, :destroy]

    create :create_student do
      accept [:member_id, :name, :phone, :email, :class_name, :major, :colledge, :avatar_url, :class_id, :job_title, :bio]
      argument :password, :string do
        description "Student password (will be hashed)"
        allow_nil? false
        constraints min_length: 8
        sensitive? true
      end
      change set_attribute(:role, :user)
      change AshAuthentication.Strategy.Password.HashPasswordChange
      change {KgEdu.Accounts.User.Changes.UpdateStudent, []}
    end

    action :create_students_for_class, :map do
      description "Create multiple students for a specific class"

      argument :class_name, :string do
        description "The class name to assign students to"
        allow_nil? false
      end

      argument :students, {:array, :map} do
        description "List of student maps with member_id, name, phone, email, password"
        allow_nil? false
      end

      run fn input, context ->
        class_name = input.arguments.class_name
        students = input.arguments.students

        results = Enum.map(students, fn student_attrs ->
          student_with_class = Map.put(student_attrs, :class_name, class_name)

          case KgEdu.Accounts.User
               |> Ash.Changeset.for_action(:create_student, student_with_class)
               |> Ash.create(tenant: context.tenant) do
            {:ok, student} -> {:ok, student}
            {:error, error} -> {:error, "Failed to create student #{student_attrs[:member_id]}: #{inspect(error)}"}
          end
        end)

        # Separate successful and failed results
        {successful, failed} = Enum.split_with(results, fn
          {:ok, _} -> true
          {:error, _} -> false
        end)

        {:ok, %{
          created: length(successful),
          failed: length(failed),
          errors: Enum.map(failed, &elem(&1, 1)),
          students: Enum.map(successful, &elem(&1, 1))
        }}
      end
    end

    read :list_student do
      filter expr(role == :user)
    end

    update :update_student do
      accept [:member_id, :name, :phone, :email, :major, :colledge, :class_name, :avatar_url, :class_id, :job_title, :bio]
      argument :password, :string do
        allow_nil? true
      end
      require_atomic? false
      # change set_attribute(:role, "user")
      change {KgEdu.Accounts.User.Changes.UpdateStudent, []}
    end

    update :remove_student_from_class do
      description "Remove a student from their class (set class_id to nil)"
      accept []

      change set_attribute(:class_id, nil)
      change set_attribute(:class_name, nil)

      # Note: This action should only be called on student users (role == :user)
    end

    
    read :get_students_by_class do
      description "Get students filtered by class name"
      argument :class_name, :string do
        description "The class name to filter students by"
        allow_nil? true
      end

      argument :class_id, :uuid do
        description "The class ID to filter students by"
        allow_nil? true
      end

      filter expr(role == :user and
                 ((not is_nil(^arg(:class_name)) and class_name == ^arg(:class_name)) or
                  (not is_nil(^arg(:class_id)) and class_id == ^arg(:class_id))))
    end

    read :list_student_classes do
      description "Get all unique class names from student users"
      filter expr(role == :user and not is_nil(class_name))
    end

    create :create_user do
      description "Create a new user with specified parameters"

      argument :member_id, :string do
        description "The user's member ID"
        allow_nil? false
      end

      argument :name, :string do
        description "The user's name"
        allow_nil? true
      end

      argument :phone, :string do
        description "The user's name"
        allow_nil? true
      end

      argument :email, :string do
        description "The user's email"
        allow_nil? true
      end

      argument :password, :string do
        description "The user's password (will be hashed)"
        allow_nil? false
        constraints min_length: 8
        sensitive? true
      end

      argument :role, :atom do
        description "The user's role (super_admin, admin, user, teacher)"
        allow_nil? true
        default :user
        constraints one_of: [:super_admin, :admin, :user, :teacher]
      end

      argument :tenant_id, :uuid do
        description "The tenant ID to create the user in (for super admin use)"
        allow_nil? true
      end

      argument :job_title, :string do
        description "The user's job title (职称)"
        allow_nil? true
      end

      argument :bio, :string do
        description "The user's personal bio (个人简介)"
        allow_nil? true
      end

      # Use the CreateUser change to handle password hashing and data storage
      change {__MODULE__.Changes.CreateUser, []}

      # Validate unique member_id
      change set_attribute(:member_id, arg(:member_id))
      change set_attribute(:name, arg(:name))
      change set_attribute(:phone, arg(:phone))
      change set_attribute(:email, arg(:email))
      change set_attribute(:role, arg(:role))
      change set_attribute(:job_title, arg(:job_title))
      change set_attribute(:bio, arg(:bio))
    end

    update :update do
      description "Update user profile information"
      accept [:name, :role, :phone, :avatar_url, :job_title, :bio, :class_id, :class_name]
      require_atomic? false
    end

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

    action :super_admin_sign_in, :map do
      description "Super admin sign in that works across all tenants."

      argument :member_id, :string do
        description "The super admin's member ID"
        allow_nil? false
      end

      argument :password, :string do
        description "The super admin's password"
        allow_nil? false
        sensitive? true
      end

      run fn input, context ->
        # Search across all tenants for super admin
        results =
          KgEdu.Repo.all_tenants()
          |> Enum.flat_map(fn tenant_schema ->
            case KgEdu.Accounts.User |> Ash.read(tenant: tenant_schema) do
              {:ok, users} ->
                users
                |> Enum.filter(&(&1.role == :super_admin))
                |> Enum.filter(&(&1.member_id == input.arguments.member_id))
              _ -> []
            end
          end)

        case List.first(results) do
          nil ->
            {:error, :invalid_credentials}

          user ->
            # Use Bcrypt for password verification (as configured in the user resource)
            case Bcrypt.verify_pass(input.arguments.password, user.hashed_password) do
            true ->
              # Generate token using the same method as the register action
              case AshAuthentication.Jwt.token_for_user(user) do
                {:ok, token, _} ->
                  {:ok, %{user | __metadata__: %{token: token}}}
                {:error, reason} ->
                  {:error, reason}
              end
            false ->
              {:error, :invalid_credentials}
          end
        end
      end
    end

    action :sign_in_tenant, :map do
      description "Sign in to a specific tenant by member_id and password."

      argument :member_id, :string do
        description "The user's member ID"
        allow_nil? false
      end

      argument :password, :string do
        description "The user's password"
        allow_nil? false
        sensitive? true
      end

      argument :tenant_id, :uuid do
        description "The tenant ID to sign in to"
        allow_nil? false
      end

      run fn input, context ->
        # Get the tenant schema
        case KgEdu.Accounts.Organization |> Ash.get(input.arguments.tenant_id) do
          {:ok, organization} ->
            # Search for user in the specific tenant by reading all and filtering
            case KgEdu.Accounts.User
                 |> Ash.read(tenant: organization.schema_name) do
              {:ok, users} ->
                users
                |> Enum.find(&(&1.member_id == input.arguments.member_id))
                |> case do
                  nil ->
                    {:error, :invalid_credentials}
                  user ->
                    # Use Bcrypt for password verification (as configured in the user resource)
                    case Bcrypt.verify_pass(input.arguments.password, user.hashed_password) do
                      true ->
                        # Generate token using the same method as the register action
                        case AshAuthentication.Jwt.token_for_user(user) do
                          {:ok, token, _} ->
                            {:ok, %{user | __metadata__: %{token: token}}}
                          {:error, reason} ->
                            {:error, reason}
                        end
                      false ->
                        {:error, :invalid_credentials}
                    end
                end
              {:error, reason} ->
                {:error, reason}
            end

          {:error, reason} ->
            {:error, :tenant_not_found}
        end
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
        constraints one_of: [:super_admin, :admin, :user, :teacher]
      end

      argument :job_title, :string do
        description "The user's job title (职称)"
        allow_nil? true
      end

      argument :bio, :string do
        description "The user's personal bio (个人简介)"
        allow_nil? true
      end

      # Sets the student_id from the argument
      change set_attribute(:member_id, arg(:member_id))
      change set_attribute(:name, arg(:name))

      # Sets the role from the argument
      change set_attribute(:role, arg(:role))

      # Sets optional profile fields
      change set_attribute(:job_title, arg(:job_title))
      change set_attribute(:bio, arg(:bio))

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

    action :register_user_in_tenant do
      description "Register a new user in a specific tenant."

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

      argument :job_title, :string do
        description "The user's job title (职称)"
        allow_nil? true
      end

      argument :bio, :string do
        description "The user's personal bio (个人简介)"
        allow_nil? true
      end

      argument :tenant_id, :uuid do
        description "The tenant (organization) ID to register the user in"
        allow_nil? false
      end

      run fn input, context ->
        # Get the tenant schema
        case KgEdu.Accounts.Organization |> Ash.get(input.arguments.tenant_id) do
          {:ok, organization} ->
            # Register user in the specific tenant
            case KgEdu.Accounts.User
                 |> Ash.Changeset.for_action(:register_with_password, %{
                   member_id: input.arguments.member_id,
                   name: input.arguments.name,
                   password: input.arguments.password,
                   password_confirmation: input.arguments.password_confirmation,
                   role: input.arguments.role,
                   job_title: input.arguments.job_title,
                   bio: input.arguments.bio
                 })
                 |> Ash.create(tenant: organization.schema_name) do
              {:ok, user} ->
                # Generate token using the same method as the register action
                token = AshAuthentication.Jwt.token_for_user(user)
                {:ok, %{user | __metadata__: %{token: token}}}
              error ->
                error
            end

          {:error, reason} ->
            {:error, :tenant_not_found}
        end
      end

      returns :map
    end

    action :register_super_admin do
      description "Register a new super admin (requires no tenant context)."

      argument :member_id, :string do
        allow_nil? false
      end

      argument :name, :string do
        allow_nil? true
      end

      argument :password, :string do
        description "The proposed password for the super admin, in plain text."
        allow_nil? false
        constraints min_length: 8
        sensitive? true
      end

      argument :password_confirmation, :string do
        description "The proposed password for the super admin (again), in plain text."
        allow_nil? false
        sensitive? true
      end

      run fn input, context ->
        # Find a default tenant or create one for super admin storage
        tenants = KgEdu.Repo.all_tenants()

        target_tenant = case tenants do
          [] ->
            # Create a default system tenant if none exists
            case KgEdu.Accounts.Organization |> Ash.Changeset.for_action(:create, %{name: "System"}) |> Ash.create() do
              {:ok, org} -> org.schema_name
              _ -> nil
            end
          [first_tenant | _] -> first_tenant
        end

        if target_tenant do
          case KgEdu.Accounts.User
               |> Ash.Changeset.for_action(:register_with_password, %{
                 member_id: input.arguments.member_id,
                 name: input.arguments.name,
                 password: input.arguments.password,
                 password_confirmation: input.arguments.password_confirmation,
                 role: :super_admin
               })
               |> Ash.create(tenant: target_tenant) do
            {:ok, user} ->
              # Generate token using the same method as the register action
              token = AshAuthentication.Jwt.token_for_user(user)
              {:ok, %{user | __metadata__: %{token: token}}}
            error ->
              error
          end
        else
          {:error, :no_tenant_available}
        end
      end

      returns :map
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

    action :import_users_from_excel do
      description "Import multiple users from an Excel file with Base64 encoding"

      argument :excel_file, :string do
        description "Base64 encoded Excel file containing user data"
        allow_nil? true
      end

      argument :excelFile, :string do
        description "Base64 encoded Excel file containing user data (camelCase version)"
        allow_nil? true
      end

      argument :attributes, {:array, :atom} do
        description "List of attributes in order: [:member_id, :name, :phone, :email, :password, :role]"
        allow_nil? true
        default [:member_id, :name, :phone, :email, :password, :role]
      end

      run fn input, context ->
        Logger.info("Starting user import")
        Logger.info("Current context tenant: #{inspect(context.tenant)}")
        Logger.info("All input arguments: #{inspect(input.arguments)}")

        # Extract arguments safely - the API call might be using different field names
        excel_file = Map.get(input.arguments, :excelFile) || Map.get(input.arguments, :excel_file)
        attributes = Map.get(input.arguments, :attributes)

        Logger.info("Excel file present: #{not is_nil(excel_file)}")
        Logger.info("Attributes: #{inspect(attributes)}")

        # Handle tenant logic - use context.tenant as primary source (from request)
        tenant_to_use = context.tenant

        if is_nil(tenant_to_use) do
          Logger.error("No tenant context found!")
          {:error, "Tenant context is required"}
        else
          Logger.info("Using tenant context: #{inspect(tenant_to_use)}")

          # Import users with tenant context
          import_result = try do
            KgEdu.Accounts.User.ImportFromExcel.parse_excel(
              excel_file,
              attributes || [:member_id, :name, :phone, :email, :password, :role],
              tenant_to_use
            )
          rescue
            e ->
              Logger.error("Exception during user import: #{Exception.message(e)}")
              Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
              Logger.error("Excel file length: #{if excel_file, do: byte_size(excel_file), else: nil}")
              {:error, {:import_exception, Exception.message(e)}}
          end

          case import_result do
            {:ok, users} ->
              Logger.info("Successfully imported #{length(users)} users")
              :ok

            {:error, reason} ->
              Logger.error("Failed to import users: #{inspect(reason)}")
              {:error, reason}
          end
        end
      end
    end


    read :get_users_from_tenant do
      description "Get users from a specific tenant (super admin only)"
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

    attribute :phone, :string do
      allow_nil? true
      public? true
    end

    attribute :class_name, :string do
      allow_nil? true
      public? true
    end

    attribute :major, :string do
      allow_nil? true
      public? true
    end

    attribute :colledge, :string do
      allow_nil? true
      public? true
    end

    attribute :class_id, :uuid do
      allow_nil? true
      public? true
      description "关联的班级ID (Related Class ID)"
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
      constraints one_of: [:super_admin, :admin, :user, :teacher]
      public? true
    end

    attribute :avatar_url, :string do
      allow_nil? true
      public? true
      description "头像地址 (Avatar URL)"
    end

    attribute :job_title, :string do
      allow_nil? true
      public? true
      description "职称 (Job Title)"
    end

    attribute :bio, :string do
      allow_nil? true
      public? true
      description "个人简介 (Personal Bio)"
    end
  end

  calculations do
    calculate :auth_token, :string do
      calculation expr(context[:token])
    end
  end

  relationships do
    belongs_to :class, KgEdu.Accounts.Class do
      allow_nil? true
    end
  end

  identities do
    identity :unique_member_id, [:member_id]
  end
end
