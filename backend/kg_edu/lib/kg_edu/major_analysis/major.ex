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

    read :public_list do
      description "List published micro majors for public portal"
      filter expr(status == :active)

      pagination do
        required? false
        offset? true
        countable true
      end

      prepare fn query, _context ->
        query
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :desc)
        |> Ash.Query.load([:major_courses, :courses])
      end
    end

    read :public_detail do
      description "Get a published micro major detail for public portal"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id) and status == :active)

      prepare fn query, _context ->
        Ash.Query.load(query, [
          :major_courses,
          :courses,
          :competencies,
          :curriculum_designs,
          :reports
        ])
      end
    end

    create :create do
      description "Create a new major"

      accept [
        :name,
        :code,
        :description,
        :college,
        :degree_type,
        :duration,
        :status,
        :cover_url,
        :intro,
        :target_audience,
        :talent_direction,
        :school_name,
        :credit,
        :period,
        :sort_order,
        :published_at
      ]

      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :draft)
      end
    end

    update :update_major do
      description "Update a major"

      accept [
        :name,
        :code,
        :description,
        :college,
        :degree_type,
        :duration,
        :status,
        :cover_url,
        :intro,
        :target_audience,
        :talent_direction,
        :school_name,
        :credit,
        :period,
        :sort_order,
        :published_at
      ]

      require_atomic? false
    end
  end

  policies do
    # 公开读取已发布的微专业列表和详情
    bypass action(:public_list) do
      authorize_if always()
    end

    bypass action(:public_detail) do
      authorize_if always()
    end

    # 其他读取操作 - bypass actor 检查
    bypass action(:read) do
      authorize_if always()
    end

    bypass action(:by_id) do
      authorize_if always()
    end

    bypass action(:by_college) do
      authorize_if always()
    end

    # 教师/管理员可管理专业 - bypass actor 检查
    bypass [action(:create), action(:update_major), action(:destroy)] do
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

    attribute :cover_url, :string do
      allow_nil? true
      public? true
      description "Micro major cover image URL"
    end

    attribute :intro, :string do
      allow_nil? true
      public? true
      description "Short introduction for public cards"
    end

    attribute :target_audience, :string do
      allow_nil? true
      public? true
      description "Target learners"
    end

    attribute :talent_direction, :atom do
      allow_nil? true
      public? true
      constraints one_of: [:urgent_needed, :applied_skill, :interdisciplinary, :other]
      description "Industry talent direction"
    end

    attribute :school_name, :string do
      allow_nil? true
      public? true
      description "School name displayed on public portal"
    end

    attribute :credit, :float do
      allow_nil? true
      public? true
      description "Total credits"
    end

    attribute :period, :integer do
      allow_nil? true
      public? true
      description "Total course hours"
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
      description "Public display order"
    end

    attribute :published_at, :utc_datetime do
      allow_nil? true
      public? true
      description "Published time"
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

    has_many :major_courses, KgEdu.MajorAnalysis.MajorCourse do
      public? true
      destination_attribute :major_id
    end

    many_to_many :courses, KgEdu.Courses.Course do
      through KgEdu.MajorAnalysis.MajorCourse
      source_attribute_on_join_resource :major_id
      destination_attribute_on_join_resource :course_id
      public? true
    end
  end
end
