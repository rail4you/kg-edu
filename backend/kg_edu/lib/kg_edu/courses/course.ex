defmodule KgEdu.Courses.Course do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  postgres do
    table "courses"
    repo KgEdu.Repo
  end

  json_api do
    type "course"
  end

  code_interface do
    define :create_course, action: :create
    define :update_course, action: :update
    define :delete_course, action: :destroy
    define :get_course, action: :read, get_by: [:id]
    define :list_courses, action: :read
    define :list_courses_by_teacher, action: :by_teacher
    define :list_courses_by_student, action: :by_student
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:title, :description, :teacher_id]
    end

    update :update do
      accept [:title, :description, :teacher_id]
    end

    read :by_teacher do
      description "Get courses taught by a specific teacher"

      argument :teacher_id, :uuid do
        allow_nil? false
      end

      filter expr(teacher_id == ^arg(:teacher_id))
    end

    read :by_student do
      description "Get courses assigned to a specific student"

      argument :member_id, :uuid do
        allow_nil? false
      end

      filter expr(course_enrollments.member_id == ^arg(:member_id))
    end
  end

  policies do
    #   # Teachers can CRUD their own courses
    #   policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #     description "Teachers can manage their own courses"
    #     authorize_if expr(:teacher == ^actor(:role) and teacher_id == ^actor(:id))
    #   end

    #   # Admin can CRUD all courses
    #   policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #     description "Admin can manage all courses"
    #     authorize_if expr(actor.role == :admin)
    #   end

    #   # Students can read courses they're enrolled in
    #   policy action(:read) do
    #     description "Students can read enrolled courses"
    #     authorize_if expr(actor.role == :user and exists(course_enrollments, member_id == ^actor(:id)))
    #   end

    #   # Students can read any course (but not modify)
    #   policy action(:read) do
    #     description "Students can read any course"
    #     authorize_if expr(actor.role == :user)
    #   end

    #   # Default policy - forbid everything else
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    attribute :teacher_id, :uuid do
      allow_nil? false
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :teacher, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? false
    end

    has_many :course_enrollments, KgEdu.Courses.CourseEnrollment do
      destination_attribute :course_id
    end

    has_many :knowledge_resources, KgEdu.Knowledge.Resource do
      destination_attribute :course_id
    end
  end
end
