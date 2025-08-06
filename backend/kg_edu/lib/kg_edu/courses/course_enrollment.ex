defmodule KgEdu.Courses.CourseEnrollment do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource]

  postgres do
    table "course_enrollments"
    repo KgEdu.Repo
  end

  json_api do
    type "course_enrollment"
  end

  actions do
    defaults [:read, :update, :destroy]

    create :create do
      accept [:course_id, :student_id]
      primary? true
      changes [
        set_attribute(:enrolled_at, &DateTime.utc_now/0)
      ]
    end
    read :by_course do
      description "Get enrollments for a specific course"
      argument :course_id, :uuid do
        allow_nil? false
      end
      filter expr(course_id == ^arg(:course_id))
    end

    read :by_student do
      description "Get enrollments for a specific student"
      argument :student_id, :uuid do
        allow_nil? false
      end
      filter expr(student_id == ^arg(:student_id))
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :enrolled_at, :utc_datetime do
      allow_nil? false
      default &DateTime.utc_now/0
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
    end

    belongs_to :student, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? false
    end
  end

  identities do
    identity :unique_course_student, [:course_id, :student_id]
  end

  policies do
    # Teachers can manage enrollments for their courses
    policy [action(:read), action(:create), action(:update), action(:destroy)] do
      description "Teachers can manage enrollments for their courses"
      authorize_if expr(:teacher == ^actor(:role) and course.teacher_id == ^actor(:id))
    end

    # Admin can manage all enrollments
    policy [action(:read), action(:create), action(:update), action(:destroy)] do
      description "Admin can manage all enrollments"
      authorize_if expr(:admin == ^actor(:role))
    end

    # Students can read their own enrollments
    # policy action(:read) do
    #   description "Students can read their own enrollments"
    #   authorize_if expr(:user == ^actor(:role) and student_id == ^actor(:id))
    # end

    # Default policy - forbid everything else
    policy always() do
      authorize_if always()
    end
  end

  code_interface do
    define :enroll_student, action: :create
    define :unenroll_student, action: :destroy
    define :get_enrollment, action: :read, get_by: [:id]
    define :list_enrollments, action: :read
    define :list_enrollments_by_course, action: :by_course
    define :list_enrollments_by_student, action: :by_student
  end
end
