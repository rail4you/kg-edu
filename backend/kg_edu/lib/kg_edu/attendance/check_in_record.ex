defmodule KgEdu.Attendance.CheckInRecord do
  @moduledoc """
  Represents a student's check-in record for a session.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Attendance,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "check_in_records"
    repo KgEdu.Repo
  end

  json_api do
    type "check_in_record"
  end

  typescript do
    type_name "CheckInRecord"
  end

  code_interface do
    define :check_in, action: :check_in
    define :get_records_by_session, action: :by_session
    define :get_records_by_user, action: :by_user
    define :get_record, action: :by_id
    define :list_records, action: :read
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_id do
      description "Get a check-in record by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_session do
      description "Get all check-in records for a specific session"

      argument :session_id, :uuid do
        allow_nil? false
      end

      filter expr(check_in_session_id == ^arg(:session_id))
    end

    read :by_user do
      description "Get all check-in records for a specific user"

      argument :user_id, :uuid do
        allow_nil? false
      end

      filter expr(user_id == ^arg(:user_id))
    end

    create :check_in do
      description "Record a user's check-in to a session"

      argument :user_id, :uuid do
        allow_nil? false
        description "ID of the user checking in"
      end

      argument :token, :string do
        allow_nil? false
        description "Token of the session to check into"
      end

      argument :location, :string do
        allow_nil? true
        description "Optional location information"
      end

      argument :metadata, :map do
        allow_nil? true
        default %{}
        description "Additional metadata"
      end

      change fn changeset, context ->
        # Get the session token from arguments
        session_token = Ash.Changeset.get_argument(changeset, :token)

        # Look up the session by token within the current tenant context
        # Tenant is now always provided from the request
        case KgEdu.Attendance.CheckInSession.get_by_token(%{token: session_token},
               tenant: context.tenant
             ) do
          {:ok, session} ->
            # Check if session is active
            if Map.get(session, :status) == :active do
              changeset
              |> Ash.Changeset.manage_relationship(
                :check_in_session,
                %{id: Map.get(session, :id)},
                on_lookup: :relate,
                on_match: :error
              )
              |> Ash.Changeset.change_attribute(
                :location,
                Ash.Changeset.get_argument(changeset, :location)
              )
              |> Ash.Changeset.change_attribute(
                :metadata,
                Ash.Changeset.get_argument(changeset, :metadata)
              )
            else
              Ash.Changeset.add_error(changeset, "Session is not active")
            end

          {:error, error} ->
            Ash.Changeset.add_error(changeset, "Invalid session token: #{inspect(error)}")
        end
      end

      change manage_relationship(:user_id, :user, type: :append)
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

    attribute :checked_in_at, :utc_datetime_usec do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
      description "When the user checked in"
    end

    attribute :location, :string do
      allow_nil? true
      public? true
      description "Optional location information (e.g., GPS coordinates)"
    end

    attribute :metadata, :map do
      allow_nil? true
      default %{}
      public? true
      description "Additional metadata about the check-in"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :user, KgEdu.Accounts.User do
      allow_nil? false
      public? true
      description "User who checked in"
    end

    belongs_to :check_in_session, KgEdu.Attendance.CheckInSession do
      allow_nil? false
      public? true
      description "The session being checked into"
    end
  end
end
