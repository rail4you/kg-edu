defmodule KgEdu.MajorAnalysis.MicroMajorResource do
  @moduledoc """
  微专业课程资源/文件。

  数据结构与智慧课程的 File 一致，但数据独立，只关联微专业课程。
  支持从智慧课程文件导入（保留 source_file_id 用于追踪来源）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_resources"
    repo KgEdu.Repo

    references do
      reference :micro_major_course, on_delete: :delete
      reference :micro_major_chapter, on_delete: :nilify
    end
  end

  json_api do
    type "micro_major_resource"
  end

  typescript do
    type_name "MicroMajorResource"
  end

  code_interface do
    define :create_resource, action: :create
    define :update_resource, action: :update
    define :delete_resource, action: :destroy
    define :get_resource, action: :by_id
    define :list_resources, action: :read
    define :list_resources_by_course, action: :by_course
    define :list_resources_by_chapter, action: :by_chapter
    define :import_from_course, action: :import_from_course
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a resource by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get resources for a micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    read :by_chapter do
      description "Get resources for a specific chapter"
      argument :micro_major_chapter_id, :uuid, allow_nil?: false
      filter expr(micro_major_chapter_id == ^arg(:micro_major_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, inserted_at: :desc)
      end
    end

    create :create do
      description "Create a new micro major resource"

      accept [
        :micro_major_course_id,
        :micro_major_chapter_id,
        :filename,
        :path,
        :size,
        :file_type,
        :description,
        :source_file_id
      ]
    end

    update :update do
      description "Update a micro major resource"

      accept [
        :filename,
        :path,
        :size,
        :file_type,
        :description,
        :micro_major_chapter_id
      ]

      require_atomic? false
    end

    action :import_from_course, :map do
      description "Import resources from a smart course into a micro major course"

      argument :micro_major_course_id, :uuid do
        allow_nil? false
        description "Target micro major course ID"
      end

      argument :file_ids, {:array, :uuid} do
        allow_nil? false
        description "Source file IDs from smart course to import"
      end

      run fn input, context ->
        tenant = context.tenant
        mm_course_id = input.arguments.micro_major_course_id
        file_ids = input.arguments.file_ids

        # Get source files from smart course
        source_files =
          KgEdu.Courses.File
          |> Ash.Query.filter(id in ^file_ids)
          |> Ash.read!(tenant: tenant, authorize?: false)

        # Create copies in micro major resource table
        records =
          Enum.map(source_files, fn sf ->
            %{
              micro_major_course_id: mm_course_id,
              filename: sf.filename,
              path: sf.path,
              size: sf.size,
              file_type: sf.file_type,
              description: nil,
              source_file_id: sf.id
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

    attribute :filename, :string do
      allow_nil? false
      public? true
      description "文件名"
    end

    attribute :path, :string do
      allow_nil? false
      public? true
      description "文件路径/URL"
    end

    attribute :size, :integer do
      allow_nil? false
      public? true
      description "文件大小（字节）"
    end

    attribute :file_type, :string do
      allow_nil? false
      public? true
      description "文件类型"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "资源描述"
    end

    attribute :source_file_id, :uuid do
      allow_nil? true
      public? true
      description "导入来源文件ID（智慧课程文件ID）"
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
