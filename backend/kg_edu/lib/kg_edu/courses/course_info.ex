defmodule KgEdu.Courses.CourseInfo do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "course_infos"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "course_info"
  end

  typescript do
    type_name "CourseInfo"
  end

  code_interface do
    define :create_course_info, action: :create
    define :update_course_info, action: :update
    define :delete_course_info, action: :destroy
    define :get_course_info, action: :read, get_by: [:id]
    define :list_course_infos, action: :read
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true
    end

    read :get do
      description "Get a course info by ID"
      get? true
    end

    create :create do
      accept [
        :course_id,
        :background,
        :objectives,
        :target,
        :course_highlights,
        :course_introduction,
        :course_structure
      ]
    end

    update :update do
      accept [
        :course_id,
        :background,
        :objectives,
        :target,
        :course_highlights,
        :course_introduction,
        :course_structure
      ]
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

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
      description "课程ID"
    end

    attribute :background, :string do
      allow_nil? false
      public? true
      description "课程背景"
    end

    attribute :objectives, :string do
      allow_nil? true
      public? true
      description "教学目标"
    end

    attribute :target, :string do
      allow_nil? true
      public? true
      description "课程定位"
    end

    attribute :course_highlights, :string do
      allow_nil? true
      public? true
      description "课程亮点"
    end

    attribute :course_introduction, :string do
      allow_nil? true
      public? true
      description "课程介绍"
    end

    attribute :course_structure, :string do
      allow_nil? true
      public? true
      description "课程知识逻辑结构"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
      public? true
    end
  end
end
