defmodule KgEdu.Courses.CourseEnrollment do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource, AshTypescript.Rpc]

  require Ash.Query
  postgres do
    table "course_enrollments"
    repo KgEdu.Repo
  end

  json_api do
    type "course_enrollment"
  end

  typescript do
    type_name "CourseEnrollment"
  end

  code_interface do
    define :enroll_student, action: :create
    define :unenroll_student, action: :destroy
    define :get_enrollment, action: :read, get_by: [:id]
    define :list_enrollments, action: :read
    define :list_enrollments_by_course, action: :by_course
    define :list_enrollments_by_student, action: :by_student
    define :bulk_enroll_students, action: :bulk_enroll
    define :bulk_unenroll_students, action: :bulk_unenroll_students
    define :check_enrollment_status, action: :enrollment_status
  end

  actions do
    defaults [:read, :update]

    create :create do
      accept [:course_id, :member_id]
      primary? true

      changes([
        set_attribute(:enrolled_at, &DateTime.utc_now/0)
      ])
    end

    destroy :destroy do
      primary? true
    end


    action :bulk_enroll do
      description "Enroll multiple students in a course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      argument :member_ids, {:array, :uuid} do
        allow_nil? false
        description "List of student IDs to enroll"
      end

      run fn input, _context ->
        input =
          input.arguments.member_ids
          |> Enum.map(fn member_id ->
            %{member_id: member_id, course_id: input.arguments.course_id}
          end)

        case Ash.bulk_create(input, __MODULE__, :create, return_records?: true) do
          %Ash.BulkResult{records: records, errors: []} ->
            :ok

          %Ash.BulkResult{records: records, errors: errors} ->
            {:error, errors}
        end
      end
    end

    # change {KgEdu.Courses.Changes.BulkEnrollStudents, []}

    read :by_course do
      description "Get enrollments for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
    end

    read :by_student do
      description "Get enrollments for a specific student"

      argument :member_id, :uuid do
        allow_nil? false
      end

      filter expr(member_id == ^arg(:member_id))
    end

    read :enrollment_status do
      description "Check if a student is enrolled in a course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      argument :member_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id) and member_id == ^arg(:member_id))
      get? true
    end

    action :bulk_unenroll_students do
      description "Unenroll multiple students from a course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      argument :member_ids, {:array, :uuid} do
        allow_nil? false
        description "List of student IDs to unenroll"
      end

      run fn input, _context ->
        query = __MODULE__
        |> Ash.Query.filter(course_id == ^input.arguments.course_id and member_id in ^input.arguments.member_ids)

        case Ash.bulk_destroy(query, :destroy, %{}, return_errors?: true) do
          _ -> :ok
          # %Ash.BulkResult{records: records, errors: []} ->
          #   :ok

          # %Ash.BulkResult{records: records, errors: errors} ->
          #   {:error, errors}
        end
      end
    end
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
    #   authorize_if expr(:user == ^actor(:role) and member_id == ^actor(:id))
    # end

    # Default policy - forbid everything else
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :member_id, :uuid do
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
      allow_nil? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? true
      define_attribute? false
      source_attribute :member_id
    end
  end

  identities do
    identity :unique_course_student, [:course_id, :member_id]
  end
end
