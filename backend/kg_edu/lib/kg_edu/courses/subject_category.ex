defmodule KgEdu.Courses.SubjectCategory do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "subject_categories"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "subject_category"
  end

  typescript do
    type_name "SubjectCategory"
  end

  code_interface do
    define :create_subject_category, action: :create
    define :update_subject_category, action: :update
    define :delete_subject_category, action: :destroy
    define :get_subject_category, action: :read, get_by: [:id]
    define :list_subject_categories, action: :read
    define :get_subject_category_by_name, action: :by_name
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:name, :description]
    end

    update :update do
      accept [:name, :description]
    end

    read :by_name do
      description "Get a subject category by name"
      get? true
      argument :name, :string, allow_nil?: false
      filter expr(name == ^arg(:name))
    end
  end

  policies do
    # Default policy - allow everything for now
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :name, :string do
      allow_nil? false
      public? true
      description "学科分类名称 (Subject Category Name) - e.g., 理工, 文学, 医学, 经济"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "学科分类描述 (Subject Category Description)"
    end

    attribute :code, :string do
      allow_nil? true
      public? true
      description "学科分类代码 (Subject Category Code) - Standardized code"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    has_many :courses, KgEdu.Courses.Course do
      public? true
      destination_attribute :subject_category_id
      description "Courses in this subject category"
    end
  end
end
