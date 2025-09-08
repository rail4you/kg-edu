defmodule KgEdu.Knowledge.Resource do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  postgres do
    table "knowledge_resources"
    repo KgEdu.Repo
  end

  json_api do
    type "knowledge_resource"
  end

  code_interface do
    define :get_knowledge_resource, action: :by_id
    define :list_knowledge_resources, action: :read
    define :get_knowledge_resources_by_course, action: :by_course
    define :search_knowledge_resources, action: :search
    define :create_knowledge_resource, action: :create
    define :update_knowledge_resource, action: :update_knowledge_resource
    define :delete_knowledge_resource, action: :destroy
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_id do
      description "Get a knowledge resource by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get knowledge resources for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :search do
      description "Search knowledge resources by name"
      argument :query, :string, allow_nil?: false
      filter expr(contains(name, ^arg(:query)))
    end

    create :create do
      description "Create a new knowledge resource"
      accept [:name, :description, :course_id]

      # change relate_actor(:created_by)
    end

    update :update_knowledge_resource do
      description "Update a knowledge resource"
      accept [:name, :description]
    end
  end

  policies do
    # policy always() do
    #   authorize_if always()
    # end
    # bypass AshAuthentication.Checks.AshAuthenticationInteraction do
    #   authorize_if always()
    # end



    # All authenticated users can read knowledge resources
    policy action_type([:read, :create, :update]) do
      description "All authenticated users can read knowledge resources"
      authorize_if actor_present()
    end

    # # Admin can create, update, and delete any knowledge resource
    # policy [action(:create), action(:update), action(:destroy)] do
    #   description "Admin can manage all knowledge resources"
    #   authorize_if actor_attribute_equals(:role, :admin)
    # end

    # # Teacher can create knowledge resources in courses they teach
    # policy action(:create) do
    #   description "Teachers can create knowledge resources in courses they teach"
    #   authorize_if actor_attribute_equals(:role, :teacher)
    #   # TODO: Add course enrollment check when actor/arg references are resolved
    #   authorize_if always()
    # end

    # # Teacher can update their own knowledge resources in courses they teach
    # policy action(:update) do
    #   description "Teachers can update their own knowledge resources in courses they teach"
    #   authorize_if actor_attribute_equals(:role, :teacher)
    #   authorize_if expr(created_by_id == ^actor(:id))
    #   # TODO: Add course enrollment check when context references are resolved
    #   authorize_if always()
    # end

    # # Teacher can delete their own knowledge resources in courses they teach
    # policy action(:destroy) do
    #   description "Teachers can delete their own knowledge resources in courses they teach"
    #   authorize_if actor_attribute_equals(:role, :teacher)
    #   authorize_if expr(created_by_id == ^actor(:id))
    #   # TODO: Add course enrollment check when context references are resolved
    #   authorize_if always()
    # end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      constraints min_length: 3, max_length: 100
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
    end

    has_many :outgoing_relations, KgEdu.Knowledge.Relation do
      public? true
      destination_attribute :source_knowledge_id
    end

    has_many :incoming_relations, KgEdu.Knowledge.Relation do
      public? true
      destination_attribute :target_knowledge_id
    end
  end

  identities do
    identity :unique_name_per_course, [:name, :course_id]
  end
end
