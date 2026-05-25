defmodule KgEdu.MajorAnalysis.MajorEnrollment do
  @moduledoc """
  微专业学生关联资源。

  教师端负责为学生分配微专业；学生端只能通过 `my_enrollments` 读取自己的微专业数据。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "major_enrollments"
    repo KgEdu.Repo

    identity_index_names unique_major_student: "major_enrollments_major_student_unique"

    references do
      reference :major, on_delete: :delete
      reference :student, on_delete: :delete
      reference :assigned_by, on_delete: :nilify
    end
  end

  typescript do
    type_name "MajorEnrollment"
  end

  code_interface do
    define :assign_student, action: :create
    define :remove_student, action: :destroy
    define :list_enrollments, action: :read
    define :list_enrollments_by_major, action: :by_major
    define :list_enrollments_by_student, action: :by_student
    define :my_major_enrollments, action: :my_enrollments
    define :bulk_assign_students, action: :bulk_assign
    define :select_micro_major, action: :select_micro_major
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:major_id, :student_id, :assigned_by_id, :status, :notes, :assigned_at]

      change set_attribute(:assigned_at, &DateTime.utc_now/0)
      change set_attribute(:status, :active)
      change set_attribute(:assigned_by_id, actor(:id))
    end

    destroy :destroy do
      primary? true
    end

    update :reactivate do
      accept [:status, :assigned_at]
      require_atomic? false
    end

    read :by_major do
      description "Get student enrollments for a micro major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))

      prepare fn query, _context ->
        Ash.Query.load(query, :student)
      end
    end

    read :by_student do
      description "Get micro major enrollments for a student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))

      prepare fn query, _context ->
        Ash.Query.load(query, :major)
      end
    end

    read :my_enrollments do
      description "Get current student's micro major enrollments"
      filter expr(student_id == ^actor(:id) and status == :active)

      prepare fn query, _context ->
        Ash.Query.load(query,
          major: [:major_courses, :courses, :competencies, :curriculum_designs, :reports]
        )
      end
    end

    action :select_micro_major, :map do
      description "Current student selects a published micro major"

      argument :major_id, :uuid do
        allow_nil? false
      end

      run fn input, context ->
        with {:ok, student_id} <- get_student_actor_id(context.actor),
             {:ok, major} <- get_active_major(input.arguments.major_id, context.tenant),
             {:ok, enrollment} <- upsert_student_enrollment(major.id, student_id, context.tenant),
             {:ok, enrolled_courses} <-
               enroll_required_courses(major.id, student_id, context.tenant) do
          {:ok, %{enrollment: enrollment, enrolledCourses: enrolled_courses}}
        end
      end
    end

    action :bulk_assign do
      description "Assign multiple students to a micro major"

      argument :major_id, :uuid do
        allow_nil? false
      end

      argument :student_ids, {:array, :uuid} do
        allow_nil? false
      end

      argument :assigned_by_id, :uuid do
        allow_nil? true
      end

      run fn input, context ->
        now = DateTime.utc_now()

        records =
          input.arguments.student_ids
          |> Enum.uniq()
          |> Enum.map(fn student_id ->
            %{
              major_id: input.arguments.major_id,
              student_id: student_id,
              assigned_by_id: context.actor && context.actor.id,
              status: :active,
              assigned_at: now
            }
          end)

        case Ash.bulk_create(records, __MODULE__, :create,
               return_records?: true,
               upsert?: true,
               upsert_identity: :unique_major_student,
               upsert_fields: [:major_id, :student_id, :assigned_by_id, :status, :assigned_at],
               tenant: context.tenant
             ) do
          %Ash.BulkResult{records: records, errors: []} ->
            :ok

          %Ash.BulkResult{errors: [error | _]} ->
            {:error, error}
        end
      end
    end
  end

  policies do
    # Bypass policies for now - teacher/admin/super_admin can access all actions
    policy always() do
      description "Temporary bypass for all actions"
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :major_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :assigned_by_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: [:active, :completed, :removed]
    end

    attribute :progress, :float do
      allow_nil? false
      public? true
      default 0.0
      constraints min: 0.0, max: 100.0
    end

    attribute :notes, :string do
      allow_nil? true
      public? true
    end

    attribute :assigned_at, :utc_datetime do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
    end

    attribute :completed_at, :utc_datetime do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :major, KgEdu.MajorAnalysis.Major do
      allow_nil? false
      public? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? false
      public? true
    end

    belongs_to :assigned_by, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? true
      public? true
    end
  end

  identities do
    identity :unique_major_student, [:major_id, :student_id]
  end

  defp get_student_actor_id(%{role: :user, id: id}) when not is_nil(id), do: {:ok, id}
  defp get_student_actor_id(_), do: {:error, "Only students can select micro majors"}

  defp get_active_major(major_id, tenant) do
    KgEdu.MajorAnalysis.Major
    |> Ash.Query.filter(id == ^major_id and status == :active)
    |> Ash.read_one(tenant: tenant, authorize?: false)
    |> case do
      {:ok, nil} -> {:error, "Micro major is not available"}
      {:ok, major} -> {:ok, major}
      error -> error
    end
  end

  defp upsert_student_enrollment(major_id, student_id, tenant) do
    query =
      __MODULE__
      |> Ash.Query.filter(major_id == ^major_id and student_id == ^student_id)

    case Ash.read_one(query, tenant: tenant, authorize?: false) do
      {:ok, %{status: :active} = enrollment} ->
        {:ok, enrollment}

      {:ok, %{status: status} = enrollment} when status in [:removed, :completed] ->
        enrollment
        |> Ash.Changeset.for_update(
          :reactivate,
          %{status: :active, assigned_at: DateTime.utc_now()},
          tenant: tenant,
          authorize?: false
        )
        |> Ash.update()

      {:ok, nil} ->
        __MODULE__
        |> Ash.Changeset.for_create(
          :create,
          %{
            major_id: major_id,
            student_id: student_id,
            status: :active,
            assigned_at: DateTime.utc_now()
          },
          tenant: tenant,
          authorize?: false
        )
        |> Ash.create()

      error ->
        error
    end
  end

  defp enroll_required_courses(major_id, student_id, tenant) do
    query =
      KgEdu.MajorAnalysis.MajorCourse
      |> Ash.Query.filter(major_id == ^major_id and course_type == :required)

    case Ash.read(query, tenant: tenant, authorize?: false) do
      {:ok, major_courses} ->
        results =
          Enum.map(major_courses, fn major_course ->
            ensure_course_enrollment(major_course.course_id, student_id, tenant)
          end)

        case Enum.find(results, &match?({:error, _}, &1)) do
          nil -> {:ok, Enum.map(results, fn {:ok, item} -> item end)}
          error -> error
        end

      error ->
        error
    end
  end

  defp ensure_course_enrollment(course_id, student_id, tenant) do
    query =
      KgEdu.Courses.CourseEnrollment
      |> Ash.Query.filter(course_id == ^course_id and member_id == ^student_id)

    case Ash.read_one(query, tenant: tenant, authorize?: false) do
      {:ok, nil} ->
        KgEdu.Courses.CourseEnrollment
        |> Ash.Changeset.for_create(:create, %{course_id: course_id, member_id: student_id},
          tenant: tenant,
          authorize?: false
        )
        |> Ash.create()

      {:ok, enrollment} ->
        {:ok, enrollment}

      error ->
        error
    end
  end
end
