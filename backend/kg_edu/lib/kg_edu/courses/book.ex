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
    define :get_book_by_course, action: :by_course
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

    read :by_course do
      description "Get a book by course ID"
      get? true
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    create :create do
      accept [:title, :publish, :cover_image, :course_id]
      
      argument :course_id, :uuid, allow_nil?: false
      change set_attribute(:course_id, arg(:course_id))
      
      validate fn changeset, _context ->
        # Check if course already has a book
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)
        
        if course_id do
          case KgEdu.Courses.Book.list_books(
            authorize?: false,
            query: [
              filter: [course_id: course_id],
              limit: 1
            ]
          ) do
            {:ok, [_existing_book]} ->
              {:error, "Course already has a book"}
            {:ok, []} ->
              :ok
            {:error, _reason} ->
              :ok
          end
        else
          :ok
        end
      end
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
      allow_nil? true
      public? true
      description "Course ID this book belongs to"
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
  end

  identities do
    identity :unique_course_book, [:course_id]
  end
end
