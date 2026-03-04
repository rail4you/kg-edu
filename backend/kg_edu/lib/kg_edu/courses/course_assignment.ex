defmodule KgEdu.Courses.CourseAssignment do
  @moduledoc """
  Represents the assignment of a teacher to a specific course.

  This model allows multiple teachers to be associated with a course:
  - Primary teachers (responsible for the course)
  - Assistant teachers (supporting roles)
  - Guest teachers (temporary/specialized)

  This is different from the `teacher_id` field on the Course model, which
  represents the primary teacher responsible for the course.
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Rpc, AshTypescript.Resource]

  require Logger
  require Ash.Query

  # policies do
  #   # Admins can do everything
  #   policy always() do
  #     description "Admins can manage all course assignments"
  #     authorize_if expr({:_actor, :role} == :admin)
  #   end

  #   # Allow course assignment (custom action) - fallback for non-admins
  #   policy always() do
  #     description "Allow course assignment for all users"
  #     authorize_if expr({:_ash_bindings, :action} == :assign_course_to_teacher)
  #   end

  #   # Teachers can view assignments they created
  #   policy action(:read) do
  #     description "Teachers can view assignments they created"
  #     authorize_if expr(assigned_by_id == ^actor(:id))
  #   end

  #   # Users can create assignments
  #   policy action(:create) do
  #     description "Users can create assignments"
  #     authorize_if always()
  #   end

  #   # Teachers can remove themselves from courses
  #   policy action(:destroy) do
  #     description "Teachers can remove themselves from courses"
  #     authorize_if expr(teacher_id == ^actor(:id))
  #   end

  #   # Primary teachers can manage assignments for their courses
  #   policy [action(:update), action(:destroy)] do
  #     description "Primary teachers can manage all assignments for their courses"
  #     authorize_if expr(
  #                    exists(KgEdu.Courses.Course, id == course_id and teacher_id == ^actor(:id))
  #                  )
  #   end
  # end

  postgres do
    table "course_assignments"
    repo KgEdu.Repo
  end

  typescript do
    type_name "CourseAssignment"
  end

  actions do
    defaults [:read, :update, :destroy]

    create :create do
      primary? true
      accept [:course_id, :teacher_id, :role]

      argument :assigned_by, :uuid do
        description "The user who is making this assignment (will be set as assigned_by_id)"
        allow_nil? true
      end

      change set_attribute(:assigned_at, &DateTime.utc_now/0)

      change fn changeset, context ->
        dbg(context)
        # Extract actor ID from the context - access directly from struct
        assigned_by_id =
          cond do
            # Try to get actor from context struct
            context.actor && context.actor.id -> context.actor.id
            # Fallback to argument
            assigned_by = Ash.Changeset.get_argument(changeset, :assigned_by) -> assigned_by
            # Default to nil
            true -> nil
          end

        # Debug: Log what we found
        Logger.info("COURSE ASSIGNMENT: Context actor: #{inspect(context.actor)}")
        Logger.info("COURSE ASSIGNMENT: Found actor ID: #{inspect(assigned_by_id)}")

        if assigned_by_id do
          Ash.Changeset.change_attribute(changeset, :assigned_by_id, assigned_by_id)
        else
          changeset
        end
      end
    end

    read :by_teacher do
      description "Get all course assignments created by the current user (who they assigned to courses)"
      # prepare fn query, context ->
      #   IO.inspect(context.actor, label: "Actor")
      #   IO.inspect(context.tenant, label: "Tenant")
      #   IO.inspect(context, label: "Full Context")

      #   query
      # end
      filter expr(assigned_by_id == ^actor(:id))
    end

    read :assignments_for_teacher do
      description "Get all course assignments where the teacher is assigned (as assistant, guest, etc.)"

      argument :teacher_id, :uuid do
        description "The teacher ID to get assignments for"
        allow_nil? false
      end

      filter expr(teacher_id == ^arg(:teacher_id))
    end

    read :by_course do
      description "Get all course assignments for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
    end

    read :get_assignment do
      description "Get a specific assignment for a teacher and course"
      get? true

      argument :teacher_id, :uuid do
        allow_nil? false
      end

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(teacher_id == ^arg(:teacher_id) and course_id == ^arg(:course_id))
    end

    action :assign_course_to_teacher do
      description "Assign a teacher to a course (simplified version)"

      argument :course_id, :uuid do
        description "The course ID to assign the teacher to"
        allow_nil? false
        public? true
      end

      argument :teacher_id, :uuid do
        description "The teacher ID to assign to the course"
        allow_nil? false
        public? true
      end

      argument :role, :atom do
        description "The role of the teacher in this course"
        allow_nil? false
        public? true
        constraints one_of: [:primary_teacher, :assistant_teacher, :guest_teacher]
        default :assistant_teacher
      end

      returns :map

      run fn input, context ->
        course_id = input.arguments.course_id
        teacher_id = input.arguments.teacher_id
        role = input.arguments.role

        # The create action will handle setting assigned_by_id and assigned_at automatically
        case KgEdu.Courses.CourseAssignment
             |> Ash.Changeset.for_action(:create, %{
               course_id: course_id,
               teacher_id: teacher_id,
               role: role
             })
             |> Ash.create(tenant: context.tenant, actor: context.actor) do
          {:ok, assignment} ->
            {:ok, %{message: "Course assigned successfully", assignment: assignment}}

          {:error, error} ->
            {:error, "Failed to assign course: #{inspect(error)}"}
        end
      end
    end

    action :remove_course_from_teacher do
      description "Remove a course assignment from a teacher (simplified version)"

      argument :course_id, :uuid do
        description "The course ID to remove assignment from"
        allow_nil? false
        public? true
      end

      argument :teacher_id, :uuid do
        description "The teacher ID to remove the assignment from"
        allow_nil? false
        public? true
      end

      returns :map

      run fn input, context ->
        course_id = input.arguments.course_id
        teacher_id = input.arguments.teacher_id

        # Find existing assignment using Ash query
        case KgEdu.Courses.CourseAssignment
             |> Ash.Query.filter(teacher_id: teacher_id, course_id: course_id)
             |> Ash.read(tenant: context.tenant, actor: context.actor) do
          # No assignments found
          {:ok, []} ->
            {:error, "No assignment found for this teacher and course"}

          # Found one or more assignments - delete all of them
          {:ok, assignments} ->
            results =
              Enum.map(assignments, fn assignment ->
                Ash.destroy(assignment, tenant: context.tenant, actor: context.actor)
              end)

            errors = Enum.filter(results, fn result -> result != :ok end)

            if Enum.empty?(errors) do
              {:ok, %{message: "Assignment removed successfully", count: length(assignments)}}
            else
              {:error, "Failed to remove some assignments: #{inspect(errors)}"}
            end

          {:error, error} ->
            {:error, "Failed to find assignment: #{inspect(error)}"}
        end
      end
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
    uuid_primary_key :id do
      public? true
      writable? false
    end

    attribute :role, :atom do
      description "The role of the teacher in this course"
      public? true
      writable? true
      constraints one_of: [:primary_teacher, :assistant_teacher, :guest_teacher]
      default :assistant_teacher
      allow_nil? false
    end

    attribute :assigned_at, :utc_datetime do
      description "When the teacher was assigned to the course"
      public? true
      writable? false
      default &DateTime.utc_now/0
    end

    attribute :assigned_by_id, :uuid do
      description "ID of the user who made this assignment"
      public? false
      writable? true
      allow_nil? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      description "The course this teacher is assigned to"
      public? true
      allow_nil? false
    end

    belongs_to :teacher, KgEdu.Accounts.User do
      description "The teacher assigned to the course"
      public? true
      allow_nil? false
    end

    belongs_to :assigned_by, KgEdu.Accounts.User do
      description "The user who made this assignment"
      public? true
      allow_nil? true
    end
  end
end
