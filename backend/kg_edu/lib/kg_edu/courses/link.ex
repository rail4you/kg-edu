defmodule KgEdu.Courses.Link do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "links"
    repo KgEdu.Repo
  end

  json_api do
    type "link"
  end

  typescript do
    type_name "Link"
  end

  code_interface do
    define :create_link, action: :create
    define :update_link, action: :update
    define :delete_link, action: :destroy
    define :get_link, action: :read, get_by: [:id]
    define :list_links, action: :read
    define :list_links_by_course, action: :by_course
  end

  actions do
    defaults [:destroy]
    read :read do
      primary? true
    end

    read :get do
      description "Get a link by ID"
      get? true
    end

    create :create do
      accept [:title, :url, :category, :course_id]
    end

    update :update do
      accept [:title, :url, :category, :course_id]
    end

    read :by_course do
      description "Get links for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
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
      description "Title of the link"
    end

    attribute :url, :string do
      allow_nil? false
      public? true
      description "URL of the link"
    end

    attribute :category, :string do
      allow_nil? true
      public? true
      description "Category of the link (e.g., resource, reference, tool)"
    end

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
      description "Associated course ID"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
      public? true
      description "Course this link belongs to"
    end
  end
end
