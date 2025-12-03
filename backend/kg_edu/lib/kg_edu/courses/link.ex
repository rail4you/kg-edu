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

  multitenancy do
    strategy :context
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
    define :link_to_knowledge, action: :link_to_knowledge
    define :unlink_from_knowledge, action: :unlink_from_knowledge
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

    update :link_to_knowledge do
      description "Link a knowledge resource to this link"

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "Knowledge resource ID to link"
      end

      change set_attribute(:knowledge_resource_id, arg(:knowledge_resource_id))
    end

    update :unlink_from_knowledge do
      description "Unlink knowledge resource from this link"

      change set_attribute(:knowledge_resource_id, nil)
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

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? true
      description "The knowledge resource this link belongs to"
    end

  end
end
