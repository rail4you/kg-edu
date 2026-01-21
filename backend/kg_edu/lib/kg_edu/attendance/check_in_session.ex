defmodule KgEdu.Attendance.CheckInSession do
  @moduledoc """
  Represents a check-in session that students can join.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Attendance,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  typescript do
    type_name "CheckInSession"
  end

  postgres do
    table "check_in_sessions"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "check_in_session"
  end

  code_interface do
    define :create, action: :create
    define :close, action: :close
    define :get_active_sessions, action: :active_sessions
    define :get_by_token, action: :by_token
    define :get_session, action: :by_id
    define :list_sessions, action: :read
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      description "Title of the check-in session"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Optional description of the check-in session"
    end

    attribute :token, :string do
      allow_nil? false
      public? true
      description "Unique token for the check-in session"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: [:active, :closed]
      description "Status of the check-in session"
    end

    attribute :started_at, :utc_datetime_usec do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
      description "When the session started"
    end

    attribute :ended_at, :utc_datetime_usec do
      allow_nil? true
      public? true
      description "When the session ended (null if still active)"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :created_by, KgEdu.Accounts.User do
      allow_nil? false
      public? true
      description "User who created the session"
    end

    has_many :check_in_records, KgEdu.Attendance.CheckInRecord do
      public? true
      description "Check-in records for this session"
    end
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_id do
      description "Get a check-in session by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :active_sessions do
      description "Get all active check-in sessions"
      filter expr(status == :active)
    end

    read :by_token do
      description "Get a check-in session by its token"
      argument :token, :string do
        allow_nil? false
      end

      filter expr(token == ^arg(:token))
    end

    create :create do
      description "Create a new check-in session"
      accept [:title, :description]

      argument :created_by_id, :uuid do
        allow_nil? false
        description "ID of the user creating the session"
      end

      change fn changeset, _context ->
        # Generate a unique token for this session
        token = generate_unique_token()
        Ash.Changeset.change_attribute(changeset, :token, token)
      end

      change manage_relationship(:created_by_id, :created_by, type: :append)
    end

    update :close do
      description "Close an active check-in session"
      accept []
      require_atomic? false

      change fn changeset, _context ->
        changeset
        |> Ash.Changeset.change_attribute(:status, :closed)
        |> Ash.Changeset.change_attribute(:ended_at, DateTime.utc_now())
      end
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  defp generate_unique_token do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end
end
