defmodule KgEdu.MajorAnalysis.MicroMajorVideo do
  @moduledoc """
  微专业课程视频。

  数据结构与智慧课程的 Video 一致，但数据独立，只关联微专业课程。
  支持从智慧课程视频导入（保留 source_video_id 用于追踪来源）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_videos"
    repo KgEdu.Repo

    references do
      reference :micro_major_course, on_delete: :delete
      reference :micro_major_chapter, on_delete: :nilify
    end
  end

  json_api do
    type "micro_major_video"
  end

  typescript do
    type_name "MicroMajorVideo"
  end

  code_interface do
    define :create_video, action: :create
    define :update_video, action: :update
    define :delete_video, action: :destroy
    define :get_video, action: :by_id
    define :list_videos, action: :read
    define :list_videos_by_course, action: :by_course
    define :list_videos_by_chapter, action: :by_chapter
    define :import_from_course, action: :import_from_course
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a video by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get all videos for a micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, title: :asc)
      end
    end

    read :by_chapter do
      description "Get all videos for a specific chapter"
      argument :micro_major_chapter_id, :uuid, allow_nil?: false
      filter expr(micro_major_chapter_id == ^arg(:micro_major_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, title: :asc)
      end
    end

    create :create do
      description "Create a new micro major video"

      accept [
        :micro_major_course_id,
        :micro_major_chapter_id,
        :title,
        :asset_id,
        :playback_id,
        :duration,
        :thumbnail,
        :source_video_id
      ]
    end

    update :update do
      description "Update a micro major video"

      accept [
        :title,
        :asset_id,
        :playback_id,
        :duration,
        :thumbnail,
        :micro_major_chapter_id
      ]

      require_atomic? false
    end

    action :import_from_course, :map do
      description "Import videos from a smart course into a micro major course"

      argument :micro_major_course_id, :uuid do
        allow_nil? false
        description "Target micro major course ID"
      end

      argument :video_ids, {:array, :uuid} do
        allow_nil? false
        description "Source video IDs from smart course to import"
      end

      run fn input, context ->
        tenant = context.tenant
        mm_course_id = input.arguments.micro_major_course_id
        video_ids = input.arguments.video_ids

        # Get source videos from smart course
        source_videos =
          KgEdu.Courses.Video
          |> Ash.Query.filter(id in ^video_ids)
          |> Ash.read!(tenant: tenant, authorize?: false)

        # Create copies in micro major video table
        records =
          Enum.map(source_videos, fn sv ->
            %{
              micro_major_course_id: mm_course_id,
              title: sv.title,
              asset_id: sv.asset_id,
              playback_id: sv.playback_id,
              duration: sv.duration,
              thumbnail: sv.thumbnail,
              source_video_id: sv.id
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
      allow_nil? true
      public? true
      description "视频标题"
    end

    attribute :asset_id, :string do
      allow_nil? false
      public? true
      description "视频资源ID"
    end

    attribute :playback_id, :string do
      allow_nil? false
      public? true
      description "视频播放ID"
    end

    attribute :duration, :float do
      allow_nil? true
      public? true
      description "视频时长（秒）"
    end

    attribute :thumbnail, :string do
      allow_nil? true
      public? true
      description "缩略图URL"
    end

    attribute :source_video_id, :uuid do
      allow_nil? true
      public? true
      description "导入来源视频ID（智慧课程视频ID）"
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
