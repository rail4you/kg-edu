defmodule KgEdu.Courses.Discussion do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "discussions"
    repo KgEdu.Repo

    references do
      reference :course, on_delete: :delete
      reference :user, on_delete: :nilify
    end
  end

  json_api do
    type "discussion"
  end

  typescript do
    type_name "Discussion"
  end

  code_interface do
    define :create_discussion, action: :create
    define :update_discussion, action: :update
    define :delete_discussion, action: :destroy
    define :get_discussion, action: :read, get_by: [:id]
    define :list_discussions, action: :read
    define :list_discussions_by_course, action: :by_course
    define :increment_reply, action: :increment_reply
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true

      pagination do
        required? false
        offset? true
        keyset? true
        countable true
      end

      prepare build(sort: [inserted_at: :desc])
    end

    read :by_course do
      description "List discussions by course ID"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))

      pagination do
        required? false
        offset? true
        keyset? true
        countable true
      end

      prepare build(sort: [inserted_at: :desc], load: [:user])
    end

    create :create do
      accept [:title, :content, :course_id, :user_id, :rating]
    end

    update :update do
      accept [:title, :content, :rating]
    end

    update :increment_view do
      description "Increment view count"

      change atomic_update(:view_count, expr(view_count + 1))
    end

    update :increment_reply do
      description "Increment reply count"

      change atomic_update(:reply_count, expr(reply_count + 1))
    end
  end

  policies do
    # Default policy - allow all for now (can be refined later)
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

    attribute :title, :string do
      allow_nil? false
      public? true
      constraints max_length: 200
      description "Discussion title"
    end

    attribute :content, :string do
      allow_nil? false
      public? true
      constraints max_length: 5000
      description "Discussion content"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: [:active, :locked, :deleted]
      description "Discussion status"
    end

    attribute :reply_count, :integer do
      allow_nil? false
      public? true
      default 0
      description "Number of replies"
    end

    attribute :view_count, :integer do
      allow_nil? false
      public? true
      default 0
      description "Number of views"
    end

    attribute :rating, :integer do
      allow_nil? true
      public? true
      default 5
      constraints min: 1, max: 5
      description "Rating score (1-5)"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
      public? true
      description "The course this discussion belongs to"
    end

    belongs_to :user, KgEdu.Accounts.User do
      allow_nil? true
      public? true
      description "The user who created this discussion"
    end
  end
end
