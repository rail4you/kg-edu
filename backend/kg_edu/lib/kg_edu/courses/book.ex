defmodule KgEdu.Courses.Book do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "books"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "book"
  end

  typescript do
    type_name "Book"
  end

  code_interface do
    define :create_book, action: :create
    define :update_book, action: :update
    define :delete_book, action: :destroy
    define :get_book, action: :read, get_by: [:id]
    define :get_book_by_course, action: :by_course
    define :list_books, action: :read
    define :list_books_by_creator, action: :by_creator
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true
    end

    read :get do
      description "Get a book by ID"
      get? true
    end

    read :by_course do
      description "Get a book by course ID"
      get? true
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :by_creator do
      description "Get books created by a specific user"
      argument :created_by_id, :uuid, allow_nil?: false
      filter expr(created_by_id == ^arg(:created_by_id))
    end

    create :create do
      accept [:title, :publish, :cover_image, :attachment, :author, :publisher, :course_id, :created_by_id]

      argument :course_id, :uuid, allow_nil?: false
      change set_attribute(:course_id, arg(:course_id))
      change set_attribute(:created_by_id, actor(:id))
    end

    update :update do
      accept [:title, :publish, :cover_image, :attachment, :author, :publisher, :course_id]
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :publish, :boolean do
      allow_nil? false
      public? true
      default false
    end

    attribute :cover_image, :string do
      allow_nil? true
      public? true
    end

    attribute :attachment, :string do
      allow_nil? true
      public? true
      description "Path to the book attachment file"
    end

    attribute :author, :string do
      allow_nil? true
      public? true
      description "Author of the book"
    end

    attribute :publisher, :string do
      allow_nil? true
      public? true
      description "Publisher of the book"
    end

    attribute :course_id, :uuid do
      allow_nil? true
      public? true
      description "Course ID this book belongs to"
    end

    attribute :created_by_id, :uuid do
      allow_nil? true
      public? true
      description "ID of the user who created this book"
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
      public? true
      allow_nil? true
      description "Course this book belongs to"
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? true
      description "The user who created this book"
    end
  end

  # identities removed to allow multiple books per course
end
