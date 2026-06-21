defmodule KgEdu.Courses.DiscussionSession do
  @moduledoc """
  Represents a discussion session that students can join via QR code.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table("discussion_sessions")
    repo(KgEdu.Repo)
  end

  json_api do
    type("discussion_session")
  end

  typescript do
    type_name("DiscussionSession")
  end

  code_interface do
    define(:create, action: :create)
    define(:close, action: :close)
    define(:list_sessions, action: :read)
    define(:get_by_token, action: :by_token)
    define(:get_session, action: :by_id)
    define(:destroy, action: :destroy)
  end

  actions do
    defaults([:read, :destroy])

    read :by_id do
      description("Get a discussion session by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    read :by_token do
      description("Get a discussion session by its token")

      argument :token, :string do
        allow_nil?(false)
      end

      get?(true)

      filter(expr(token == ^arg(:token)))
    end

    create :create do
      description("Create a new discussion session")
      accept([:title, :description, :course_id])

      argument :created_by_id, :uuid do
        allow_nil?(false)
        description("ID of the user creating the session")
      end

      change(fn changeset, _context ->
        # Generate a unique token for this session
        token = generate_unique_token()
        Ash.Changeset.change_attribute(changeset, :token, token)
      end)

      change(manage_relationship(:created_by_id, :created_by, type: :append))
    end

    update :close do
      description("Close an active discussion session")
      accept([])
      require_atomic?(false)

      change(fn changeset, _context ->
        changeset
        |> Ash.Changeset.change_attribute(:status, :closed)
        |> Ash.Changeset.change_attribute(:ended_at, DateTime.utc_now())
      end)
    end
  end

  policies do
    policy always() do
      authorize_if(always())
    end
  end

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    attribute :title, :string do
      allow_nil?(false)
      public?(true)
      description("Title of the discussion session")
    end

    attribute :description, :string do
      allow_nil?(true)
      public?(true)
      description("Optional description of the discussion session")
    end

    attribute :token, :string do
      allow_nil?(false)
      public?(true)
      description("Unique token for the discussion session")
    end

    attribute :status, :atom do
      allow_nil?(false)
      public?(true)
      default(:active)
      constraints(one_of: [:active, :closed])
      description("Status of the discussion session")
    end

    attribute :started_at, :utc_datetime_usec do
      allow_nil?(false)
      public?(true)
      default(&DateTime.utc_now/0)
      description("When the session started")
    end

    attribute :ended_at, :utc_datetime_usec do
      allow_nil?(true)
      public?(true)
      description("When the session ended (null if still active)")
    end

    create_timestamp(:inserted_at)
    update_timestamp(:updated_at)
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil?(false)
      public?(true)
      description("The course this discussion session belongs to")
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      allow_nil?(false)
      public?(true)
      description("User who created the session")
    end
  end

  defp generate_unique_token do
    :crypto.strong_rand_bytes(4)
    |> Base.url_encode64(padding: false)
    |> String.upcase()
  end
end
