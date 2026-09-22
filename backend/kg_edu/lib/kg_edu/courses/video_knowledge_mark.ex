defmodule KgEdu.Courses.VideoKnowledgeMark do
  @moduledoc """
  P2: 视频知识点打点 — 视频时间点 ↔ 知识点关联，前端点击定位播放。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "video_knowledge_marks"
    repo KgEdu.Repo
  end

  json_api do
    type "video_knowledge_mark"
  end

  typescript do
    type_name "VideoKnowledgeMark"
  end

  code_interface do
    define :create_mark, action: :create
    define :delete_mark, action: :destroy
    define :list_marks, action: :read
    define :get_marks_by_video, action: :by_video
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:video_type, :video_id, :knowledge_resource_id, :point_sec, :label]
    end

    read :by_video do
      description "Get knowledge marks for a video, ordered by time"

      argument :video_type, :string, allow_nil?: false
      argument :video_id, :uuid, allow_nil?: false

      filter expr(video_type == ^arg(:video_type) and video_id == ^arg(:video_id))
      prepare build(sort: [point_sec: :asc])
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
    end

    attribute :video_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :point_sec, :integer do
      allow_nil? false
      public? true
      description "时间点（秒）"
    end

    attribute :label, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      allow_nil? false
      public? true
    end
  end
end
