defmodule KgEdu.AI.CameraScript do
  @moduledoc """
  镜头脚本（数字人演播）。

  支持无限镜头：每镜头包含台词（TTS 输入）、页面文字（背景画面）、
  人像图、音色等。可一键渲染：逐镜头 TTS → 场景图合成 → wan2.2-s2v
  生成片段 → 全部完成后拼接为完整视频。

  scenes 为 JSON 数组，每项：
    %{
      "id" => uuid,
      "title" => "镜头1",
      "text" => "台词（TTS 输入）",
      "page_text" => "页面文字（渲染为背景）",
      "bg_color" => "#1e3a5f",
      "bg_image_url" => "页面图片（PPT 导入时）",
      "person_image_url" => "人像图",
      "voice" => "longanyang",
      "status" => "pending|tts_done|image_done|submitted|done|failed",
      "audio_url" => ...,
      "scene_image_url" => ...,
      "video_url" => ...,
      "dashscope_task_id" => ...,
      "error" => ...
    }
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "camera_scripts"
    repo KgEdu.Repo
  end

  json_api do
    type "camera_script"
  end

  typescript do
    type_name "CameraScript"
  end

  code_interface do
    define :get_camera_script, action: :by_id
    define :list_camera_scripts, action: :read
    define :create_camera_script, action: :create
    define :update_camera_script, action: :update
    define :update_camera_script_status, action: :update_status
    define :delete_camera_script, action: :destroy
  end

  actions do
    defaults [:destroy]

    read :read do
      description "List camera scripts (filtered by current user)"
      pagination offset?: true, keyset?: true, required?: false
      primary? true

      prepare build(filter: [
        created_by_id: actor(:id)
      ])

      prepare fn query, _context ->
        Ash.Query.sort(query, updated_at: :desc)
      end
    end

    read :by_id do
      description "Get a camera script by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a camera script"
      accept [:title, :scenes]
      change set_attribute(:status, :draft)
      change set_attribute(:created_by_id, actor(:id))
    end

    update :update do
      description "Update camera script (title / scenes)"
      accept [:title, :scenes]
      require_atomic? false
    end

    update :update_status do
      description "Update status/progress from the render worker"
      accept [:status, :scenes, :video_url, :error_message]
      require_atomic? false
    end
  end

  policies do
    policy action_type([:read, :destroy]) do
      authorize_if expr(created_by_id == ^actor(:id))
    end

    policy action(:by_id) do
      authorize_if expr(created_by_id == ^actor(:id))
    end

    policy action(:create) do
      authorize_if always()
    end

    policy action(:update) do
      authorize_if expr(created_by_id == ^actor(:id))
    end

    policy action(:update_status) do
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? true
      constraints max_length: 200
      public? true
      description "脚本标题"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :rendering, :succeeded, :failed]
      description "脚本状态：draft/rendering/succeeded/failed"
    end

    attribute :scenes, KgEdu.Types.JsonList do
      allow_nil? true
      public? true
      description "镜头列表（JSON）"
    end

    attribute :video_url, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "最终拼接视频 URL"
    end

    attribute :error_message, :string do
      allow_nil? true
      constraints max_length: 2000
      public? true
      description "失败原因"
    end

    attribute :created_by_id, :uuid do
      allow_nil? true
      public? true
      description "创建者"
    end

    timestamps()
  end
end
