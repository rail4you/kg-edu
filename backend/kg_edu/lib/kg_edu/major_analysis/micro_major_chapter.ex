defmodule KgEdu.MajorAnalysis.MicroMajorChapter do
  @moduledoc """
  微专业课程章节。

  支持多级嵌套结构（parent_chapter_id 自引用），
  数据结构与智慧课程的 Chapter 一致，但数据独立。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_chapters"
    repo KgEdu.Repo

    references do
      reference :micro_major_course, on_delete: :delete
      reference :parent_chapter, on_delete: :delete
    end
  end

  json_api do
    type "micro_major_chapter"
  end

  typescript do
    type_name "MicroMajorChapter"
  end

  code_interface do
    define :create_chapter, action: :create
    define :update_chapter, action: :update
    define :delete_chapter, action: :destroy
    define :get_chapter, action: :by_id
    define :list_chapters, action: :read
    define :list_chapters_by_course, action: :by_course
    define :list_root_chapters, action: :root_chapters
    define :list_subchapters, action: :subchapters
    define :get_course_full_hierarchy, action: :course_full_hierarchy
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a chapter by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get all chapters for a specific micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :root_chapters do
      description "Get root chapters (no parent) for a specific micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id) and is_nil(parent_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :subchapters do
      description "Get subchapters for a specific chapter"
      argument :parent_chapter_id, :uuid, allow_nil?: false
      filter expr(parent_chapter_id == ^arg(:parent_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, sort_order: :asc, title: :asc)
      end
    end

    read :course_full_hierarchy do
      description "Get the nested full hierarchy of chapters for a micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id) and is_nil(parent_chapter_id))

      prepare fn query, _context ->
        query
        |> Ash.Query.sort(sort_order: :asc, title: :asc)
        |> Ash.Query.load(subchapters: [:subchapters])
      end
    end

    create :create do
      description "Create a new chapter"
      accept [:title, :description, :micro_major_course_id, :parent_chapter_id, :sort_order]

      change fn changeset, _context ->
        # Set default sort_order if not provided
        case Ash.Changeset.get_argument(changeset, :sort_order) do
          nil ->
            Ash.Changeset.change_attribute(changeset, :sort_order, 0)
          _ ->
            changeset
        end
      end
    end

    update :update do
      description "Update a chapter"
      accept [:title, :description, :sort_order, :parent_chapter_id]
      require_atomic? false
    end
  end

  policies do
    policy always() do
      description "Allow all users full access"
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :title, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 200
      public? true
      description "章节标题"
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "章节描述"
    end

    attribute :sort_order, :integer do
      allow_nil? true
      default 0
      public? true
      description "排序顺序"
    end

    attribute :path, :string do
      allow_nil? true
      default nil
      public? true
      description "排序路径，用于层级排序"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :micro_major_course, KgEdu.MajorAnalysis.MicroMajorCourse do
      public? true
      allow_nil? false
      description "所属微专业课程"
    end

    belongs_to :parent_chapter, __MODULE__ do
      public? true
      allow_nil? true
      description "父章节（支持多级嵌套）"
    end

    has_many :subchapters, __MODULE__ do
      public? true
      destination_attribute :parent_chapter_id
      description "子章节"
    end

    has_many :videos, KgEdu.MajorAnalysis.MicroMajorVideo do
      public? true
      destination_attribute :micro_major_chapter_id
      description "章节下的视频"
    end

    has_many :exercises, KgEdu.MajorAnalysis.MicroMajorExercise do
      public? true
      destination_attribute :micro_major_chapter_id
      description "章节下的习题"
    end

    has_many :resources, KgEdu.MajorAnalysis.MicroMajorResource do
      public? true
      destination_attribute :micro_major_chapter_id
      description "章节下的资源"
    end
  end
end
