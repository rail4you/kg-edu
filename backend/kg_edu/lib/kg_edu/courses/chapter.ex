defmodule KgEdu.Courses.Chapter do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "chapters"
    repo KgEdu.Repo
  end

  typescript do
    # Choose appropriate name
    type_name "Chapter"
  end

  json_api do
    type "chapter"
  end

  typescript_rpc do
    resource KgEdu.Courses.Chapter do
      rpc_action :list_chapters, :read
      rpc_action :create_chapter, :create
      rpc_action :get_chapter, :read
      rpc_action :update_chapter, :update
      rpc_action :delete_chapter, :destroy
    end
  end

  code_interface do
    define :create_chapter, action: :create
    define :update_chapter, action: :update
    define :delete_chapter, action: :destroy
    define :get_chapter, action: :read, get_by: [:id]
    define :list_chapters, action: :read
    define :list_chapters_by_course, action: :by_course
    define :list_root_chapters, action: :root_chapters
    define :list_subchapters, action: :subchapters
    define :get_chapter_with_subchapters, action: :get_with_subchapters
    define :get_course_full_hierarchy, action: :course_full_hierarchy
  end

  actions do
    defaults [:read, :destroy]

    update :update do
      accept [:title, :description, :sort_order, :parent_chapter_id, :course_id]
    end

    read :by_course do
      description "Get all chapters for a specific course"
      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :root_chapters do
      description "Get root chapters (chapters without a parent) for a specific course"
      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id) and is_nil(parent_chapter_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :subchapters do
      description "Get subchapters for a specific chapter"
      argument :parent_chapter_id, :uuid do
        allow_nil? false
      end

      filter expr(parent_chapter_id == ^arg(:parent_chapter_id))
      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :get_with_subchapters do
      description "Get a chapter with all its subchapters loaded recursively"
      get? true
      argument :id, :uuid do
        allow_nil? false
      end

      filter expr(id == ^arg(:id))
      prepare fn query, _context ->
        Ash.Query.load(query, subchapters: [:subchapters])
      end
    end

    read :course_full_hierarchy do
      description "Get the nested full hierarchy of chapters for a course (include chapters and subchapters)"
      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id) and is_nil(parent_chapter_id))
      prepare fn query, _context ->
        query
        |> Ash.Query.sort(sort_order: :asc, title: :asc)
        |> Ash.Query.load(subchapters: [:subchapters])
      end
    end

    create :create do
      description "Create a new chapter"
      accept [:title, :description, :course_id, :parent_chapter_id, :sort_order]

      validate fn changeset, _context ->
        parent_id = Ash.Changeset.get_attribute(changeset, :parent_chapter_id)
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)

        if parent_id && course_id do
          # If there's a parent, ensure it belongs to the same course
          case KgEdu.Courses.Chapter.get_chapter(parent_id) do
            {:ok, parent} ->
              if parent.course_id == course_id do
                :ok
              else
                {:error, "Parent chapter must belong to the same course"}
              end
            {:error, _} ->
              {:error, "Parent chapter not found"}
          end
        else
          :ok
        end
      end
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

    attribute :title, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 200
      public? true
      description "Chapter title"
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "Chapter description"
    end

    attribute :sort_order, :integer do
      allow_nil? true
      default 0
      public? true
      description "Order for sorting chapters within the same level"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? false
      description "The course this chapter belongs to"
    end

    belongs_to :parent_chapter, __MODULE__ do
      public? true
      allow_nil? true
      description "Parent chapter for nested chapters"
    end

    has_many :subchapters, __MODULE__ do
      public? true
      destination_attribute :parent_chapter_id
      description "Subchapters (nested chapters)"
    end

    has_many :knowledge_resources, KgEdu.Knowledge.Resource do
      public? true
      destination_attribute :chapter_id
      description "Knowledge resources associated with this chapter"
    end

    has_many :videos, KgEdu.Courses.Video do
      public? true
      destination_attribute :chapter_id
      description "Videos associated with this chapter"
    end

    has_many :homeworks, KgEdu.Knowledge.Homework do
      public? true
      destination_attribute :chapter_id
      description "Homeworks associated with this chapter"
    end
  end

  identities do
    identity :unique_title_per_course_parent, [:title, :course_id, :parent_chapter_id]
  end
end
