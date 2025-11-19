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
        Logger.info("context is #{inspect(context)}")
        Logger.info("actor is #{inspect(context.actor)}")

        case context.actor do
          %{role: :user, id: user_id} ->
            # Students see only courses they're enrolled in and published
            query
            |> Ash.Query.filter(publish_status == true)
            |> Ash.Query.filter(course_enrollments.member_id == ^user_id)

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
      accept [:title, :description, :image_url, :teacher_id, :major, :semester, :semester_hours, :book_id, :publish_status, :subject_category]
      # change set_attribute(:teacher_id, actor(:id))
      # change relate_actor(:teacher_id)
    end

    update :update do
      accept [:title, :description, :image_url, :teacher_id, :major, :semester, :semester_hours, :book_id, :publish_status, :subject_category]
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

    read :get_all_courses do
      description "Get all courses from tenant"
      # No actor filtering - returns all courses in the tenant
    end

    read :get_course_by_guest do
      description "Get a course by ID for guest access (no authentication required)"
      get? true

      prepare fn query, _context ->
        # Bypass actor filtering - allow guest access to published courses only
        query
        |> Ash.Query.filter(publish_status == true)
      end
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

    attribute :subject_category, :string do
      allow_nil? true
      public? true
      description "学科分类 (Subject Category) - e.g., 理工, 文学, 医学, 经济"
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

    has_many :links, KgEdu.Courses.Link do
      public? true
      destination_attribute :course_id
      description "Course-related links"
    end



  end
end
