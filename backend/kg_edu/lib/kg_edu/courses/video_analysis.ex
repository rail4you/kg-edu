defmodule KgEdu.Courses.VideoAnalysis do
  @moduledoc """
  P2: 章节视频 AI 解析结果 — 摘要、分段总结、全文转写、知识点词云。
  `video_type`: "course_video"（课程视频）或 "video"（章节视频）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "video_analyses"
    repo KgEdu.Repo
  end

  json_api do
    type "video_analysis"
  end

  typescript do
    type_name "VideoAnalysis"
  end

  code_interface do
    define :create_video_analysis, action: :create
    define :update_video_analysis, action: :update
    define :delete_video_analysis, action: :destroy
    define :get_video_analysis, action: :read, get_by: [:id]
    define :list_video_analyses, action: :read
    define :get_analysis_by_video, action: :by_video
    define :list_analyses_by_course, action: :by_course
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:video_type, :video_id, :course_id]
    end

    update :update do
      accept [:status, :summary, :segments, :transcript, :wordcloud, :error_message]
      require_atomic? false
    end

    read :by_video do
      description "Get analyses for a specific video"

      argument :video_type, :string, allow_nil?: false
      argument :video_id, :uuid, allow_nil?: false
      filter expr(video_type == ^arg(:video_type) and video_id == ^arg(:video_id))
    end

    read :by_course do
      description "Get analyses for a course"

      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
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
    end

    attribute :video_type, :string do
      allow_nil? false
      public? true
      default "course_video"
      description "course_video 或 video"
    end

    attribute :video_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :pending
      constraints one_of: [:pending, :processing, :done, :failed]
    end

    attribute :summary, :string do
      allow_nil? true
      public? true
      description "视频摘要"
    end

    attribute :segments, {:array, :map} do
      allow_nil? true
      public? true
      description "分段总结 [{start_sec, end_sec, title, summary}]"
    end

    attribute :transcript, :string do
      allow_nil? true
      public? false
      description "全文转写"
    end

    attribute :wordcloud, {:array, :map} do
      allow_nil? true
      public? true
      description "知识点词云 [{word, weight}]"
    end

    attribute :error_message, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? true
      public? true
    end
  end
end
