defmodule KgEdu.MajorAnalysis.MicroMajor do
  @moduledoc """
  微专业资源。

  与普通专业(Major)不同，微专业是面向职业或兴趣方向的短期学习项目，
  具有项目背景、培养目标、项目特色等独特属性。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_majors"
    repo KgEdu.Repo
  end

  json_api do
    type "micro_major"
  end

  typescript do
    type_name "MicroMajor"
  end

  code_interface do
    define :create_micro_major, action: :create
    define :update_micro_major, action: :update
    define :delete_micro_major, action: :destroy
    define :get_micro_major, action: :by_id
    define :list_micro_majors, action: :read
    define :list_micro_majors_by_teacher, action: :by_teacher
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a micro major by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _context ->
        Ash.Query.load(query, [
          :responsible_teacher,
          :consultant_teacher,
          :micro_major_courses
        ])
      end
    end

    read :by_teacher do
      description "Get micro majors by teacher (as responsible or consultant)"
      argument :teacher_id, :uuid, allow_nil?: false
      filter expr(
        responsible_teacher_id == ^arg(:teacher_id) or
        consultant_teacher_id == ^arg(:teacher_id)
      )

      prepare fn query, _context ->
        Ash.Query.load(query, [
          :responsible_teacher,
          :consultant_teacher,
          :micro_major_courses
        ])
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :desc)
      end
    end

    create :create do
      description "Create a new micro major"

      accept [
        :name,
        :project_background,
        :knowledge_objective,
        :ability_objective,
        :quality_objective,
        :project_features,
        :learning_cycle,
        :assessment_method,
        :tuition_fee,
        :cover_url,
        :intro,
        :responsible_teacher_id,
        :consultant_teacher_id,
        :status,
        :sort_order
      ]

      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :draft)
      end
    end

    update :update do
      description "Update a micro major"

      accept [
        :name,
        :project_background,
        :knowledge_objective,
        :ability_objective,
        :quality_objective,
        :project_features,
        :learning_cycle,
        :assessment_method,
        :tuition_fee,
        :cover_url,
        :intro,
        :responsible_teacher_id,
        :consultant_teacher_id,
        :status,
        :sort_order
      ]

      require_atomic? false
    end

    update :publish do
      description "Publish a micro major"
      accept [:status]

      change set_attribute(:status, :active)
      change set_attribute(:published_at, &DateTime.utc_now/0)
    end

    update :unpublish do
      description "Unpublish a micro major"
      accept [:status]

      change set_attribute(:status, :draft)
    end
  end

  policies do
    # Allow all users full access for now
    policy always() do
      description "Allow all users full access"
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
      description "微专业名称"
    end

    attribute :project_background, :string do
      allow_nil? true
      public? true
      description "项目背景"
    end

    attribute :knowledge_objective, :string do
      allow_nil? true
      public? true
      description "知识目标"
    end

    attribute :ability_objective, :string do
      allow_nil? true
      public? true
      description "能力目标"
    end

    attribute :quality_objective, :string do
      allow_nil? true
      public? true
      description "素养目标"
    end

    attribute :project_features, :string do
      allow_nil? true
      public? true
      description "项目特色"
    end

    attribute :learning_cycle, :string do
      allow_nil? true
      public? true
      description "学习周期"
    end

    attribute :assessment_method, :string do
      allow_nil? true
      public? true
      description "考核方式"
    end

    attribute :tuition_fee, :string do
      allow_nil? true
      public? true
      description "学费标准"
    end

    attribute :cover_url, :string do
      allow_nil? true
      public? true
      description "封面图片URL"
    end

    attribute :intro, :string do
      allow_nil? true
      public? true
      description "简短介绍"
    end

    attribute :responsible_teacher_id, :uuid do
      allow_nil? true
      public? true
      description "微专业负责人（教师）"
    end

    attribute :consultant_teacher_id, :uuid do
      allow_nil? true
      public? true
      description "微专业顾问（教师）"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :active, :archived]
      description "状态"
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
      description "排序顺序"
    end

    attribute :published_at, :utc_datetime do
      allow_nil? true
      public? true
      description "发布时间"
    end

    create_timestamp :inserted_at do
      public? true
    end
    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :responsible_teacher, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? true
      public? true
      description "微专业负责人"
    end

    belongs_to :consultant_teacher, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? true
      public? true
      description "微专业顾问"
    end

    has_many :micro_major_courses, KgEdu.MajorAnalysis.MicroMajorCourse do
      public? true
      destination_attribute :micro_major_id
    end

    has_many :enrollments, KgEdu.MajorAnalysis.MicroMajorEnrollment do
      public? true
      destination_attribute :micro_major_id
    end
  end
end