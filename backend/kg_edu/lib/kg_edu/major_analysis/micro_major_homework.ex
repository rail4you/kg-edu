defmodule KgEdu.MajorAnalysis.MicroMajorHomework do
  @moduledoc """
  微专业课程作业。

  数据结构与智慧课程的 Homework 一致，但数据独立，只关联微专业课程。
  支持从智慧课程作业导入（保留 source_homework_id 用于追踪来源）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_homeworks"
    repo KgEdu.Repo

    references do
      reference :micro_major_course, on_delete: :delete
    end
  end

  json_api do
    type "micro_major_homework"
  end

  typescript do
    type_name "MicroMajorHomework"
  end

  code_interface do
    define :create_homework, action: :create
    define :update_homework, action: :update
    define :delete_homework, action: :destroy
    define :get_homework, action: :by_id
    define :list_homeworks, action: :read
    define :list_homeworks_by_course, action: :by_course
    define :list_homeworks_by_chapter, action: :by_chapter
    define :import_from_course, action: :import_from_course
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a homework by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get homeworks for a micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, inserted_at: :asc)
      end
    end

    read :by_chapter do
      description "Get homeworks for a specific chapter"
      argument :micro_major_chapter_id, :uuid, allow_nil?: false
      filter expr(micro_major_chapter_id == ^arg(:micro_major_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, inserted_at: :asc)
      end
    end

    create :create do
      description "Create a new micro major homework"

      accept [
        :micro_major_course_id,
        :micro_major_chapter_id,
        :title,
        :content,
        :score,
        :answer,
        :position,
        :source_homework_id
      ]
    end

    update :update do
      description "Update a micro major homework"

      accept [
        :title,
        :content,
        :score,
        :answer,
        :position,
        :micro_major_chapter_id
      ]

      require_atomic? false
    end

    action :import_from_course, :map do
      description "Import homeworks from a smart course into a micro major course"

      argument :micro_major_course_id, :uuid do
        allow_nil? false
        description "Target micro major course ID"
      end

      argument :homework_ids, {:array, :uuid} do
        allow_nil? false
        description "Source homework IDs from smart course to import"
      end

      run fn input, context ->
        tenant = context.tenant
        mm_course_id = input.arguments.micro_major_course_id
        homework_ids = input.arguments.homework_ids

        # Get source homeworks from smart course
        source_homeworks =
          KgEdu.Knowledge.Homework
          |> Ash.Query.filter(id in ^homework_ids)
          |> Ash.read!(tenant: tenant, authorize?: false)

        # Create copies in micro major homework table
        records =
          Enum.map(source_homeworks, fn sh ->
            %{
              micro_major_course_id: mm_course_id,
              title: sh.title,
              content: sh.content,
              score: sh.score,
              answer: sh.answer,
              position: sh.position,
              source_homework_id: sh.id
            }
          end)

        case Ash.bulk_create(records, __MODULE__, :create,
               return_records?: true,
               tenant: tenant,
               authorize?: false
             ) do
          %Ash.BulkResult{records: records, errors: []} ->
            {:ok, %{count: length(records), records: records}}

          %Ash.BulkResult{errors: [error | _]} ->
            {:error, error}
        end
      end
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
      description "作业标题"
    end

    attribute :content, :string do
      allow_nil? true
      default ""
      public? true
      description "作业内容或说明"
    end

    attribute :score, :decimal do
      allow_nil? true
      public? true
      description "作业满分"
    end

    attribute :answer, :string do
      allow_nil? true
      public? true
      description "参考答案"
    end

    attribute :position, :integer do
      allow_nil? false
      default 0
      public? true
      description "排序位置"
    end

    attribute :source_homework_id, :uuid do
      allow_nil? true
      public? true
      description "导入来源作业ID（智慧课程作业ID）"
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

    belongs_to :micro_major_chapter, KgEdu.MajorAnalysis.MicroMajorChapter do
      public? true
      allow_nil? true
      description "所属章节（可选）"
    end
  end
end
