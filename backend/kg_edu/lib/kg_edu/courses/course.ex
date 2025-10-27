defmodule KgEdu.Courses.Course do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]
  require Logger
  require Ash.Query
  postgres do
    table "courses"
    repo KgEdu.Repo
  end

  json_api do
    type "course"
  end

  typescript do
    # Choose appropriate name
    type_name "Course"
  end

  code_interface do
    define :create_course, action: :create
    define :update_course, action: :update
    define :delete_course, action: :destroy
    define :get_course, action: :read, get_by: [:id]
    define :list_courses, action: :read
    define :list_courses_by_teacher, action: :by_teacher
    define :list_courses_by_student, action: :by_student
    define :get_course_by_title, action: :by_title
  end

  actions do
    defaults [:destroy]
    read :read do
      primary? true

      prepare fn query, context ->
            # Teachers see only their courses, students see only enrolled courses
        Logger.info("context is #{inspect(context.actor)}")
        case context.actor do
          %{role: :user, id: user_id} ->
            # Students see only courses they're enrolled in
            Ash.Query.filter(query, course_enrollments.member_id == ^user_id)

          %{role: :teacher, id: teacher_id} ->
            Logger.info("teacher id is #{teacher_id}")
            Ash.Query.filter(query, teacher_id == ^teacher_id)

          _ ->
            Ash.Query.filter(query, false)
        end
      end
    end

    read :get do
      description "Get a course by ID"
      get? true
    end

    create :create do
      accept [:title, :description, :image_url, :teacher_id, :major, :semester, :book_id]
      change set_attribute(:teacher_id, actor(:id))
      # change relate_actor(:teacher_id)
    end

    update :update do
      accept [:title, :description, :image_url, :teacher_id, :major, :semester, :book_id]
      change set_attribute(:teacher_id, actor(:id))
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

    read :by_title do
      description "Get a course by title"
      get? true
      argument :title, :string, allow_nil?: false
      filter expr(title == ^arg(:title))
    end
  end

  policies do
    # Teachers can CRUD their own courses
    # policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #   description "Teachers can manage their own courses"
    #   authorize_if expr(:teacher == ^actor(:role) and teacher_id == ^actor(:id))
    # end

    # # Admin can CRUD all courses
    # policy [action(:read), action(:create), action(:update), action(:destroy)] do
    #   description "Admin can manage all courses"
    #   authorize_if expr(:admin == ^actor(:role))
    # end

    # # Students can read courses they're enrolled in
    # policy action(:read) do
    #   description "Students can read enrolled courses"
    #   authorize_if expr(:user == ^actor(:role) and exists(course_enrollments, member_id == ^actor(:id)))
    # end

    # Default policy - forbid everything else
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
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    attribute :image_url, :string do
      allow_nil? true
      public? true
    end

    attribute :teacher_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :major, :string do
      allow_nil? true
      public? true
      description "专业 (Major)"
    end

    attribute :semester, :string do
      allow_nil? true
      public? true
      description "学期 (Semester)"
    end

    attribute :book_id, :uuid do
      allow_nil? true
      public? true
      description "Associated book ID"
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
      public? true
      destination_attribute :course_id
    end

    has_many :knowledge_resources, KgEdu.Knowledge.Resource do
      public? true
      destination_attribute :course_id
    end

    has_many :chapters, KgEdu.Courses.Chapter do
      public? true
      destination_attribute :course_id
    end

    has_many :homeworks, KgEdu.Knowledge.Homework do
      public? true
      destination_attribute :course_id
      description "Homeworks for this course"
    end

    has_one :course_info, KgEdu.Courses.CourseInfo do
      public? true
      destination_attribute :course_id
      description "Course information"
    end

    belongs_to :book, KgEdu.Courses.Book do
      allow_nil? true
      public? true
      description "Associated textbook for this course"
    end
  end
end
