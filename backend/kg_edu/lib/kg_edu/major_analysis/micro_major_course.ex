defmodule KgEdu.MajorAnalysis.MicroMajorCourse do
  @moduledoc """
  微专业课程。

  微专业拥有独立的课程实体，数据与智慧课程完全独立。
  每门微专业课程有自己的章节、视频、习题和资源。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_courses"
    repo KgEdu.Repo

    references do
      reference :micro_major, on_delete: :delete
    end
  end

  json_api do
    type "micro_major_course"
  end

  typescript do
    type_name "MicroMajorCourse"
  end

  code_interface do
    define :create_micro_major_course, action: :create
    define :update_micro_major_course, action: :update
    define :delete_micro_major_course, action: :destroy
    define :get_micro_major_course, action: :by_id
    define :list_micro_major_courses, action: :read
    define :list_courses_by_micro_major, action: :by_micro_major
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a micro major course by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _context ->
        Ash.Query.load(query, [
          :micro_major,
          :chapters,
          :videos,
          :exercises,
          :resources
        ])
      end
    end

    read :by_micro_major do
      description "Get courses for a micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id))

      prepare fn query, _context ->
        query
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    create :create do
      description "Create a new micro major course"

      accept [
        :micro_major_id,
        :title,
        :description,
        :image_url,
        :teacher_id,
        :semester,
        :semester_hours,
        :credits,
        :major,
        :publish_status,
        :sort_order,
        :source_course_id
      ]
    end

    update :update do
      description "Update a micro major course"

      accept [
        :title,
        :description,
        :image_url,
        :teacher_id,
        :semester,
        :semester_hours,
        :credits,
        :major,
        :publish_status,
        :sort_order,
        :source_course_id
      ]

      require_atomic? false
    end

    update :publish do
      description "Publish a micro major course"
      change set_attribute(:status, :active)
    end

    update :unpublish do
      description "Unpublish a micro major course"
      change set_attribute(:status, :draft)
    end
  end

  policies do
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

    attribute :micro_major_id, :uuid do
      allow_nil? false
      public? true
      description "所属微专业ID"
    end

    attribute :title, :string do
      allow_nil? false
      public? true
      description "课程名称"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "课程描述"
    end

    attribute :image_url, :string do
      allow_nil? true
      public? true
      description "封面图片URL"
    end

    attribute :teacher_id, :uuid do
      allow_nil? true
      public? true
      description "授课教师ID"
    end

    attribute :semester, :string do
      allow_nil? true
      public? true
      description "学期"
    end

    attribute :semester_hours, :integer do
      allow_nil? true
      public? true
      description "学时"
    end

    attribute :credits, :integer do
      allow_nil? true
      public? true
      description "学分"
    end

    attribute :major, :string do
      allow_nil? true
      public? true
      description "专业"
    end

    attribute :publish_status, :boolean do
      allow_nil? false
      public? true
      default false
      description "是否发布"
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
      description "排序顺序"
    end

    attribute :source_course_id, :uuid do
      allow_nil? true
      public? true
      description "导入来源的智慧课程ID（可选，用于追踪导入来源）"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :micro_major, KgEdu.MajorAnalysis.MicroMajor do
      allow_nil? false
      public? true
      description "所属微专业"
    end

    has_many :chapters, KgEdu.MajorAnalysis.MicroMajorChapter do
      public? true
      destination_attribute :micro_major_course_id
      description "课程章节"
    end

    has_many :videos, KgEdu.MajorAnalysis.MicroMajorVideo do
      public? true
      destination_attribute :micro_major_course_id
      description "课程视频"
    end

    has_many :exercises, KgEdu.MajorAnalysis.MicroMajorExercise do
      public? true
      destination_attribute :micro_major_course_id
      description "课程习题"
    end

    has_many :resources, KgEdu.MajorAnalysis.MicroMajorResource do
      public? true
      destination_attribute :micro_major_course_id
      description "课程资源"
    end
  end
end
