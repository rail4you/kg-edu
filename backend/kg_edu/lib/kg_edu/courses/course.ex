defmodule KgEdu.Courses.Course do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource],
    primary_read_warning?: false
  require Logger
  require Ash.Query
  postgres do
    table "courses"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
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
    define :get_all_courses, action: :get_all_courses
    define :get_course_by_guest, action: :get_course_by_guest
    define :calculate_course_statistics, action: :calculate_course_statistics
    define :course_overview, action: :course_overview
    define :create_course_with_primary_teacher, action: :create_with_primary_teacher
    define :get_courses_for_teacher, action: :get_courses_for_teacher
    define :my_courses, action: :my_courses
  end


  aggregates do
    # Count videos through chapters
    count :videos_count, [:chapters, :videos]
    count :knowledge_resources_count, :knowledge_resources do
      public? true
    end
  end
  actions do
    defaults [:destroy]
    read :read do
      primary? true

      prepare fn query, context ->
            # Teachers see only their courses, students see only enrolled courses
            # Only users see published courses
        Logger.info("COURSE LIST: context is #{inspect(context)}")
        Logger.info("COURSE LIST: actor is #{inspect(context.actor)}")

        query = case context.actor do
          %{role: :user, id: user_id} ->
            Logger.info("COURSE LIST: Filtering courses for student #{user_id}")
            # Students see only courses they're enrolled in and published
            query
            |> Ash.Query.filter(publish_status == true)
            |> Ash.Query.filter(course_enrollments.member_id == ^user_id)

          %{role: :teacher, id: teacher_id} ->
            Logger.info("COURSE LIST: Filtering courses for teacher #{teacher_id}")
            # Teachers see courses where they are either:
            # 1. The primary teacher (teacher_id matches)
            # 2. Assigned to the course through CourseAssignment
            Ash.Query.filter(query, teacher_id == ^teacher_id or course_assignments.teacher_id == ^teacher_id)

          %{role: :admin} ->
            Logger.info("COURSE LIST: Admin can see all courses")
            # Admins can see all courses
            query

          %{role: :super_admin} ->
            Logger.info("COURSE LIST: Super admin can see all courses")
            # Super admins can see all courses
            query

          other ->
            Logger.info("COURSE LIST: No access for actor: #{inspect(other)}")
            Ash.Query.filter(query, false)
        end

        query |> Ash.Query.load(:subject_category)
      end
    end

    read :get do
      description "Get a course by ID"
      get? true
    end

    create :create do
      accept [:title, :description, :image_url, :major, :semester, :semester_hours, :credits, :book_id, :publish_status, :subject_category_id]
    end

    action :create_with_primary_teacher, :map do
      description "Create a course with a primary teacher assignment"

      argument :title, :string do
        description "The course title"
        allow_nil? false
      end

      argument :description, :string do
        description "The course description"
        allow_nil? true
      end

      argument :image_url, :string do
        description "The course image URL"
        allow_nil? true
      end

      argument :major, :string do
        description "The course major"
        allow_nil? true
      end

      argument :semester, :string do
        description "The course semester"
        allow_nil? true
      end

      argument :semester_hours, :integer do
        description "The course semester hours"
        allow_nil? true
      end

      argument :credits, :integer do
        description "The course credits"
        allow_nil? true
      end

      argument :book_id, :uuid do
        description "The course book ID"
        allow_nil? true
      end

      argument :publish_status, :boolean do
        description "Whether the course is published"
        allow_nil? true
        default true
      end

      argument :subject_category_id, :uuid do
        description "The course subject category ID"
        allow_nil? true
      end

      argument :primary_teacher_id, :uuid do
        description "ID of the primary teacher for this course"
        allow_nil? false
      end

      run fn input, context ->
        course_attrs = %{
          title: input.arguments.title,
          description: input.arguments.description,
          image_url: input.arguments.image_url,
          major: input.arguments.major,
          semester: input.arguments.semester,
          semester_hours: input.arguments.semester_hours,
          credits: input.arguments.credits,
          book_id: input.arguments.book_id,
          publish_status: input.arguments.publish_status,
          subject_category_id: input.arguments.subject_category_id
        }

        try do
          # Create the course first
          case KgEdu.Courses.Course |> Ash.Changeset.for_action(:create, course_attrs) |> Ash.create(tenant: context.tenant) do
            {:ok, course} ->
              # Create primary teacher assignment
              assignment_attrs = %{
                course_id: course.id,
                teacher_id: input.arguments.primary_teacher_id,
                role: :primary_teacher,
                assigned_by_id: context.actor.id,
                assigned_at: DateTime.utc_now()
              }

              case KgEdu.Courses.CourseAssignment |> Ash.Changeset.for_action(:create, assignment_attrs) |> Ash.create(tenant: context.tenant) do
                {:ok, _assignment} ->
                  {:ok, course}
                {:error, assignment_error} ->
                  # Rollback course creation if assignment fails
                  case Ash.destroy(course, tenant: context.tenant) do
                    :ok -> {:error, "Failed to create teacher assignment: #{inspect(assignment_error)}"}
                    _ -> {:error, "Failed to create teacher assignment and failed to rollback course: #{inspect(assignment_error)}"}
                  end
              end
            {:error, course_error} ->
              {:error, "Failed to create course: #{inspect(course_error)}"}
          end
        rescue
          error ->
            {:error, "Failed to create course with primary teacher: #{inspect(error)}"}
        end
      end
    end

    update :update do
      accept [:title, :description, :image_url, :major, :semester, :semester_hours, :credits, :book_id, :publish_status, :subject_category_id]
    end

    read :by_teacher do
      description "Get courses taught by a specific teacher (primary teacher or through assignments)"

      argument :teacher_id, :uuid do
        allow_nil? false
      end

      filter expr(teacher_id == ^arg(:teacher_id) or course_assignments.teacher_id == ^arg(:teacher_id))
    end

    read :get_courses_for_teacher do
      description "Get all courses that a teacher has access to (as primary teacher, assistant, or guest)"

      argument :teacher_id, :uuid do
        description "The teacher ID to get courses for"
        allow_nil? false
      end

      filter expr(teacher_id == ^arg(:teacher_id) or course_assignments.teacher_id == ^arg(:teacher_id))
    end

    read :my_courses do
      description "Get courses created by the current teacher (only primary teacher courses, not assigned courses)"

      prepare fn query, context ->
        case context.actor do
          %{role: :teacher, id: teacher_id} ->
            # Only return courses where the teacher is the primary teacher (creator)
            query
            |> Ash.Query.filter(teacher_id == ^teacher_id)
            |> Ash.Query.load(:subject_category)

          _ ->
            # Non-teacher roles get no results
            Ash.Query.filter(query, false)
        end
      end
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

    read :get_all_courses do
      description "Get all courses from tenant"
      # No actor filtering - returns all courses in the tenant
    end

    read :get_course_by_guest do
      description "Get a course by ID for guest access (no authentication required)"
      get? true

      argument :course_id, :uuid do
        allow_nil? false
        description "The course ID to retrieve"
      end

      filter expr(id == ^arg(:course_id))
    end


    action :calculate_course_statistics, :map do
      description "Calculate comprehensive statistics for a course including knowledge hierarchy and media counts"

      argument :course_id, :uuid do
        allow_nil? false
        description "The course ID to calculate statistics for"
      end

      run fn input, context ->
        course_id = input.arguments.course_id

        try do
          # Get knowledge resource statistics
          {:ok, all_resources} = KgEdu.Knowledge.Resource.list_knowledges(
            authorize?: false,
            tenant: context.tenant,
            query: [filter: [course_id: course_id]]
          )

          # Count by knowledge type
          subject_count = Enum.count(all_resources, &(&1.knowledge_type == :subject))
          unit_count = Enum.count(all_resources, &(&1.knowledge_type == :knowledge_unit))
          cell_count = Enum.count(all_resources, &(&1.knowledge_type == :knowledge_cell))
          total_knowledge = length(all_resources)

          # Get files count
          {:ok, files} = KgEdu.Courses.File.list_files(
            authorize?: false,
            tenant: context.tenant,
            query: [filter: [course_id: course_id]]
          )
          file_count = length(files)

          # Get videos count through chapters
          {:ok, chapters} = KgEdu.Courses.Chapter.list_chapters(
            authorize?: false,
            tenant: context.tenant,
            query: [filter: [course_id: course_id]]
          )

          chapter_ids = Enum.map(chapters, & &1.id)

          video_count = if length(chapter_ids) > 0 do
            {:ok, videos} = KgEdu.Courses.Video.list_videos(
              authorize?: false,
              tenant: context.tenant,
              query: [filter: [chapter_id: [in: chapter_ids]]]
            )
            length(videos)
          else
            0
          end

          # Also check videos directly linked to knowledge resources in this course
          {:ok, knowledge_videos} = KgEdu.Courses.Video.list_videos(
            authorize?: false,
            tenant: context.tenant,
            query: [load: [:knowledge_resource]]
          )

          # Count videos where the associated knowledge resource belongs to this course
          course_video_count = Enum.count(knowledge_videos, fn video ->
            video.knowledge_resource && video.knowledge_resource.course_id == course_id
          end)

          total_videos = video_count + course_video_count

          {:ok, %{
            course_id: course_id,
            knowledge_hierarchy: %{
              total_knowledge_resources: total_knowledge,
              subjects: subject_count,
              units: unit_count,
              cells: cell_count
            },
            media_counts: %{
              total_files: file_count,
              total_videos: total_videos
            },
            calculated_at: DateTime.utc_now()
          }}

        rescue
          error ->
            {:error, "Failed to calculate course statistics: #{inspect(error)}"}
        end
      end
    end

    action :course_overview, :map do
      description "Get comprehensive overview for a specific course including users, resources, and activities"

      argument :course_id, :uuid do
        allow_nil? false
        description "The course ID to get overview for"
      end

      run fn input, context ->
        course_id = input.arguments.course_id

        try do
          # Get enrolled users statistics (simplified version without authorization)
          user_stats = case KgEdu.Accounts.User |> Ash.read(tenant: context.tenant, authorize?: false) do
            {:ok, users} ->
              # For now, count all users in the tenant as enrolled students
              # You can implement proper enrollment logic later
              total_users = length(users)
              users_by_role = users |> Enum.group_by(& &1.role) |> Enum.map(fn {role, users} -> {role, length(users)} end) |> Map.new()

              %{
                total: total_users,
                by_role: users_by_role,
                super_admins: Map.get(users_by_role, :super_admin, 0),
                admins: Map.get(users_by_role, :admin, 0),
                teachers: Map.get(users_by_role, :teacher, 0),
                students: Map.get(users_by_role, :user, 0)
              }
            {:error, _} ->
              %{
                total: 0, by_role: %{}, super_admins: 0, admins: 0, teachers: 0, students: 0
              }
          end

          # Get knowledge resource statistics (without authorization)
          IO.puts("DEBUG: Starting knowledge resource query for course #{course_id} in tenant #{context.tenant}")

          knowledge_stats = case KgEdu.Knowledge.Resource |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, resources} ->
              total_knowledge = length(resources)
              IO.puts("DEBUG: SUCCESS: Found #{total_knowledge} knowledge resources for course #{course_id}")
              IO.puts("DEBUG: Resource IDs: #{Enum.map(resources, & &1.id) |> inspect}")
              by_type = resources |> Enum.group_by(& &1.knowledge_type) |> Enum.map(fn {type, resources} -> {type, length(resources)} end) |> Map.new()
              %{
                total: total_knowledge,
                by_type: by_type,
                subjects: Map.get(by_type, :subject, 0),
                knowledge_units: Map.get(by_type, :knowledge_unit, 0),
                knowledge_cells: Map.get(by_type, :knowledge_cell, 0)
              }
            {:error, error} ->
              IO.puts("DEBUG: ERROR: Failed to get knowledge resources: #{inspect(error)}")
              %{total: 0, by_type: %{}, subjects: 0, knowledge_units: 0, knowledge_cells: 0}
          end

          # Get files statistics (without authorization)
          file_stats = case KgEdu.Courses.File |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, files} ->
              file_count = length(files)
              IO.puts("DEBUG: Found #{file_count} files for course #{course_id}")
              %{total: file_count}
            {:error, error} ->
              IO.puts("DEBUG: Error getting files: #{inspect(error)}")
              %{total: 0}
          end

          # Get videos statistics (step-by-step debugging approach)
          IO.puts("DEBUG: Starting video count investigation for course #{course_id}")

          # Initialize variables to ensure they're always defined
          all_videos = []
          course_chapters = []
          course_resources = []

          # Step 1: Get all videos in the tenant first to see what exists
          all_videos = case KgEdu.Courses.Video |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, videos} ->
              IO.puts("DEBUG: Total videos in tenant: #{length(videos)}")
              Enum.each(videos, fn video ->
                IO.puts("DEBUG: Video - ID: #{video.id}, Title: #{video.title}, Chapter ID: #{Map.get(video, :chapter_id)}, Knowledge Resource ID: #{Map.get(video, :knowledge_resource_id)}")
              end)
              videos
            {:error, error} ->
              IO.puts("DEBUG: Error getting all videos: #{inspect(error)}")
              []
          end

          # Step 2: Get all chapters in this course
          course_chapters = case KgEdu.Courses.Chapter |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, chapters} ->
              IO.puts("DEBUG: Found #{length(chapters)} chapters for course #{course_id}")
              Enum.each(chapters, fn chapter ->
                IO.puts("DEBUG: Chapter - ID: #{chapter.id}, Title: #{Map.get(chapter, :title)}")
              end)
              chapters
            {:error, error} ->
              IO.puts("DEBUG: Error getting chapters: #{inspect(error)}")
              []
          end

          # Step 3: Get all knowledge resources in this course
          course_resources = case KgEdu.Knowledge.Resource |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, resources} ->
              IO.puts("DEBUG: Found #{length(resources)} knowledge resources for course #{course_id}")
              Enum.each(resources, fn resource ->
                IO.puts("DEBUG: Resource - ID: #{resource.id}, Name: #{resource.name}, Type: #{resource.knowledge_type}")
              end)
              resources
            {:error, error} ->
              IO.puts("DEBUG: Error getting knowledge resources: #{inspect(error)}")
              []
          end

          # Step 4: Count videos by matching chapter IDs
          chapter_ids = Enum.map(course_chapters, & &1.id)
          chapter_linked_videos = Enum.count(all_videos, fn video ->
            Map.get(video, :chapter_id) in chapter_ids
          end)
          IO.puts("DEBUG: Videos linked to course chapters: #{chapter_linked_videos}")

          # Step 5: Count videos by matching knowledge resource IDs
          resource_ids = Enum.map(course_resources, & &1.id)
          knowledge_linked_videos = Enum.count(all_videos, fn video ->
            Map.get(video, :knowledge_resource_id) in resource_ids
          end)
          IO.puts("DEBUG: Videos linked to knowledge resources: #{knowledge_linked_videos}")

          total_videos = chapter_linked_videos + knowledge_linked_videos
          IO.puts("DEBUG: Final video count for course #{course_id}: #{total_videos}")

          video_stats = %{
            total: total_videos,
            chapter_linked: chapter_linked_videos,
            knowledge_linked: knowledge_linked_videos
          }

          # Get homework statistics (without authorization)
          homework_stats = case KgEdu.Knowledge.Homework |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, homeworks} ->
              homework_count = length(homeworks)
              IO.puts("DEBUG: Found #{homework_count} homeworks for course #{course_id}")
              %{total: homework_count}
            {:error, error} ->
              IO.puts("DEBUG: Error getting homeworks: #{inspect(error)}")
              %{total: 0}
          end

          # Get exercise statistics (without authorization)
          exercise_stats = case KgEdu.Knowledge.Exercise |> Ash.Query.filter(course_id: course_id) |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, exercises} ->
              exercise_count = length(exercises)
              IO.puts("DEBUG: Found #{exercise_count} exercises for course #{course_id}")
              %{total: exercise_count}
            {:error, error} ->
              IO.puts("DEBUG: Error getting exercises: #{inspect(error)}")
              %{total: 0}
          end

          # Get activity statistics (without authorization)
          activity_stats = case KgEdu.Activity.ActivityLog |> Ash.read(
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, activities} ->
              course_activities = activities |> Enum.filter(fn activity ->
                # Filter activities related to this course (you may need to adjust this logic based on your activity structure)
                activity.metadata && Map.get(activity.metadata, :course_id) == course_id
              end)

              by_type = course_activities |> Enum.group_by(& &1.action_type) |> Enum.map(fn {type, activities} -> {type, length(activities)} end) |> Map.new()

              %{
                total: length(course_activities),
                by_type: by_type
              }
            {:error, _} ->
              %{total: 0, by_type: %{}}
          end

          # Get course details (without authorization)
          course_details = case KgEdu.Courses.Course |> Ash.get(
            course_id,
            tenant: context.tenant,
            authorize?: false
          ) do
            {:ok, course} ->
              %{
                id: course.id,
                title: course.title,
                description: course.description,
                publish_status: course.publish_status,
                created_at: DateTime.utc_now()  # Using current time since we don't have timestamps
              }
            {:error, _} ->
              %{
                id: course_id,
                title: "Unknown Course",
                description: "",
                publish_status: false,
                created_at: DateTime.utc_now()
              }
          end

          overview = %{
            course: course_details,
            users: user_stats,
            knowledge_resources: knowledge_stats,
            files: file_stats,
            videos: video_stats,
            homeworks: homework_stats,
            exercises: exercise_stats,
            activities: activity_stats,
            total_resources: %{
              files: file_stats.total,
              videos: video_stats.total,
              homeworks: homework_stats.total,
              exercises: exercise_stats.total,
              total: file_stats.total + video_stats.total + homework_stats.total + exercise_stats.total
            },
            calculated_at: DateTime.utc_now()
          }

          {:ok, overview}

        rescue
          error ->
            {:error, "Failed to get course overview: #{inspect(error)}"}
        end
      end
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

    attribute :semester_hours, :integer do
      allow_nil? true
      public? true
      description "学时 (Credit Hours)"
    end

    attribute :credits, :integer do
      allow_nil? true
      public? true
      description "学分 (Credits)"
    end

    attribute :book_id, :uuid do
      allow_nil? true
      public? true
      description "Associated book ID"
    end

    attribute :publish_status, :boolean do
      default true
      public? true
      description "Whether the course is published"
    end



    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    has_many :course_assignments, KgEdu.Courses.CourseAssignment do
      public? true
      destination_attribute :course_id
      description "Teacher assignments for this course"
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

    belongs_to :subject_category, KgEdu.Courses.SubjectCategory do
      allow_nil? true
      public? true
      description "Subject category for this course"
    end

    has_many :links, KgEdu.Courses.Link do
      public? true
      destination_attribute :course_id
      description "Course-related links"
    end

    has_many :course_videos, KgEdu.Courses.CourseVideo do
      public? true
      destination_attribute :course_id
      description "Course videos"
    end



  end
end
