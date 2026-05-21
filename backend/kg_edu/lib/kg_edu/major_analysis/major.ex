defmodule KgEdu.MajorAnalysis.Major do
  @moduledoc """
  专业资源。
  管理学校开设的专业信息。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "majors"
    repo KgEdu.Repo
  end

  json_api do
    type "major"
  end

  typescript do
    type_name "Major"
  end

  code_interface do
    define :create_major, action: :create
    define :update_major, action: :update_major
    define :delete_major, action: :destroy
    define :get_major, action: :by_id
    define :list_majors, action: :read
    define :get_majors_by_college, action: :by_college
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a major by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_college do
      description "Get majors by college"
      argument :college, :string, allow_nil?: false
      filter expr(college == ^arg(:college))
    end

    create :create do
      description "Create a new major"
      accept [:name, :code, :description, :college, :degree_type, :duration, :status]
      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :draft)
      end
    end

    update :update_major do
      description "Update a major"
      accept [:name, :code, :description, :college, :degree_type, :duration, :status]
      require_atomic? false
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

    attribute :name, :string do
      allow_nil? false
      public? true
      description "Major name"
    end

    attribute :code, :string do
      allow_nil? true
      public? true
      description "Major code"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Major description"
    end

    attribute :college, :string do
      allow_nil? true
      public? true
      description "College/department"
    end

    attribute :degree_type, :string do
      allow_nil? true
      public? true
      description "Degree type (bachelor/master/doctoral)"
    end

    attribute :duration, :integer do
      allow_nil? true
      public? true
      description "Duration in years"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :active, :archived]
      description "Major status"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    has_many :job_positions, KgEdu.MajorAnalysis.JobPosition do
      public? true
    end

    has_many :competencies, KgEdu.MajorAnalysis.MajorCompetency do
      public? true
    end

    has_many :curriculum_designs, KgEdu.MajorAnalysis.CurriculumDesign do
      public? true
    end

    has_many :reports, KgEdu.MajorAnalysis.AnalysisReport do
      public? true
    end

    has_many :enrollments, KgEdu.MajorAnalysis.MajorEnrollment do
      public? true
    end
  end
end
