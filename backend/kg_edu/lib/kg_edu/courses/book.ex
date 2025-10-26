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
    define :list_books, action: :read
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

    create :create do
      accept [:title, :publish, :cover_image, :course_id]
    end

    update :update do
      accept [:title, :publish, :cover_image]
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

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
      description "course_id"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    has_one :course, KgEdu.Courses.Course do
      public? true
      destination_attribute :book_id
      description "Course that uses this book"
    end
  end
end
