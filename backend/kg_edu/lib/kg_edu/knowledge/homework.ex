defmodule KgEdu.Knowledge.Homework do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "homeworks"
    repo KgEdu.Repo
  end

  json_api do
    type "homework"
  end

  typescript do
    type_name "Homework"
  end

  code_interface do
    define :create_homework, action: :create
    define :update_homework, action: :update_homework
    define :delete_homework, action: :destroy
    define :get_homework, action: :by_id
    define :list_homeworks, action: :read
    define :list_homeworks_by_course, action: :by_course
    define :list_homeworks_by_chapter, action: :by_chapter
    define :list_homeworks_by_knowledge_resource, action: :by_knowledge_resource
    define :list_homeworks_by_creator, action: :by_creator
    define :link_homework_to_knowledge, action: :link_homework_to_knowledge
    define :unlink_homework_from_knowledge, action: :unlink_homework_from_knowledge
    define :import_homework_from_xlsx, action: :import_homework_from_xlsx
    define :export_homework_template, action: :export_homework_template
  end

  actions do
    defaults [:read, :update, :destroy]

    read :by_id do
      description "Get a homework by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get homeworks for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    read :by_chapter do
      description "Get homeworks for a specific chapter"
      argument :chapter_id, :uuid, allow_nil?: false
      filter expr(chapter_id == ^arg(:chapter_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    read :by_knowledge_resource do
      description "Get homeworks for a specific knowledge resource"
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    read :by_creator do
      description "Get homeworks created by a specific user"
      argument :created_by_id, :uuid, allow_nil?: false
      filter expr(created_by_id == ^arg(:created_by_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    create :create do
      description "Create a new homework"
      accept [
        :title,
        :content,
        :score,
        :course_id,
        :chapter_id,
        :knowledge_resource_id,
        :created_by_id
      ]

      validate fn changeset, _context ->
        # At least one of course_id, chapter_id, or knowledge_resource_id must be provided
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)
        chapter_id = Ash.Changeset.get_attribute(changeset, :chapter_id)
        knowledge_resource_id = Ash.Changeset.get_attribute(changeset, :knowledge_resource_id)

        if is_nil(course_id) && is_nil(chapter_id) && is_nil(knowledge_resource_id) do
          {:error, "Homework must be associated with at least a course, chapter, or knowledge resource"}
        else
          :ok
        end
      end

      validate fn changeset, _context ->
        # If chapter_id is provided, validate it belongs to the same course
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)
        chapter_id = Ash.Changeset.get_attribute(changeset, :chapter_id)

        if course_id && chapter_id do
          case KgEdu.Courses.Chapter.get_chapter(chapter_id) do
            {:ok, chapter} ->
              if chapter.course_id == course_id do
                :ok
              else
                {:error, "Chapter must belong to the same course"}
              end
            {:error, _} ->
              {:error, "Chapter not found"}
          end
        else
          :ok
        end
      end

      validate fn changeset, _context ->
        # If knowledge_resource_id is provided, validate it belongs to the same course
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)
        knowledge_resource_id = Ash.Changeset.get_attribute(changeset, :knowledge_resource_id)

        if course_id && knowledge_resource_id do
          case KgEdu.Knowledge.Resource.get_knowledge_resource(knowledge_resource_id) do
            {:ok, resource} ->
              if resource.course_id == course_id do
                :ok
              else
                {:error, "Knowledge resource must belong to the same course"}
              end
            {:error, _} ->
              {:error, "Knowledge resource not found"}
          end
        else
          :ok
        end
      end
    end

    update :update_homework do
      description "Update a homework"
      accept [:title, :content, :score, :chapter_id, :knowledge_resource_id]
      require_atomic? false

      # validate fn changeset, _context ->
      #   # If chapter_id is being updated, validate it belongs to the same course
      #   course_id = Ash.Changeset.get_attribute(changeset, :course_id)
      #   chapter_id = Ash.Changeset.get_attribute(changeset, :chapter_id)

      #   if course_id && chapter_id do
      #     case KgEdu.Courses.Chapter.get_chapter(chapter_id) do
      #       {:ok, chapter} ->
      #         if chapter.course_id == course_id do
      #           :ok
      #         else
      #           {:error, "Chapter must belong to the same course"}
      #         end
      #       {:error, _} ->
      #         {:error, "Chapter not found"}
      #     end
      #   else
      #     :ok
      #   end
      # end

      # validate fn changeset, _context ->
      #   # If knowledge_resource_id is being updated, validate it belongs to the same course
      #   course_id = Ash.Changeset.get_attribute(changeset, :course_id)
      #   knowledge_resource_id = Ash.Changeset.get_attribute(changeset, :knowledge_resource_id)

      #   if course_id && knowledge_resource_id do
      #     case KgEdu.Knowledge.Resource.get_knowledge_resource(knowledge_resource_id) do
      #       {:ok, resource} ->
      #         if resource.course_id == course_id do
      #           :ok
      #         else
      #           {:error, "Knowledge resource must belong to the same course"}
      #         end
      #       {:error, _} ->
      #         {:error, "Knowledge resource not found"}
      #     end
      #   else
      #     :ok
      #   end
      # end
    end

    update :link_homework_to_knowledge do
      description "Link a homework to a knowledge resource"
      require_atomic? false

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "The knowledge resource ID to link to"
      end

      change manage_relationship(:knowledge_resource_id, :knowledge_resource, type: :append_and_remove)
    end

    update :unlink_homework_from_knowledge do
      description "Unlink a homework from its knowledge resource"
      require_atomic? false

      change set_attribute(:knowledge_resource_id, nil)
    end

    create :import_homework_from_xlsx do
      description "Import homework from XLSX file"

      argument :xlsx_base64, :string do
        allow_nil? false
        description "Base64 encoded XLSX file content"
      end

      argument :created_by_id, :uuid do
        allow_nil? false
        description "User ID who is importing the homework"
      end

      change {KgEdu.Knowledge.Changes.ImportHomeworkFromXlsx, []}
    end

    action :export_homework_template do
      description "Generate homework template XLSX as base64"

      argument :created_by_id, :uuid do
        allow_nil? false
        description "User ID requesting the template"
      end

      run {KgEdu.Knowledge.Changes.ExportHomeworkTemplate, []}
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 200
      public? true
      description "Homework title"
    end

    attribute :content, :string do
      allow_nil? false
      public? true
      description "Homework content or instructions"
    end

    attribute :score, :decimal do
      allow_nil? true
      public? true
      description "Maximum score for this homework"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
      description "The course this homework belongs to"
    end

    belongs_to :chapter, KgEdu.Courses.Chapter do
      public? true
      allow_nil? true
      description "The chapter this homework belongs to (optional)"
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? true
      description "The knowledge resource this homework is related to (optional)"
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "The user who created this homework"
    end
  end
end
