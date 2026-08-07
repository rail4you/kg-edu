defmodule KgEdu.AI.DigitalHumanTask do
  @moduledoc """
  数字人视频生成任务。

  通过 DashScope wan2.2-s2v 模型，基于单张图片 + 一段音频生成对口型数字人视频。
  任务由 Oban 后台 worker 处理（上传→检测→提交→轮询→下载），前端轮询任务状态。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "digital_human_tasks"
    repo KgEdu.Repo
  end

  json_api do
    type "digital_human_task"
  end

  typescript do
    type_name "DigitalHumanTask"
  end

  code_interface do
    define :get_digital_human_task, action: :by_id
    define :list_digital_human_tasks, action: :read
    define :create_digital_human_task, action: :create
    define :update_digital_human_task_status, action: :update_status
  end

  actions do
    defaults [:destroy]

    read :read do
      description "List digital human tasks (filtered by current user)"
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
      description "Get a digital human task by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a digital human video generation task"
      accept [:title, :image_url, :audio_url, :resolution]

      change set_attribute(:status, :queued)
      change set_attribute(:progress_message, "任务已创建，正在排队处理...")
      change set_attribute(:created_by_id, actor(:id))

      validate present(:image_url, at_least: 1)
      validate present(:audio_url, at_least: 1)
    end

    update :update_status do
      description "Update task status/progress from the background worker"
      accept [:status, :video_url, :dashscope_task_id, :error_message, :progress_message]
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
      description "任务标题"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :queued
      constraints one_of: [:queued, :running, :succeeded, :failed]
      description "任务状态：queued/running/succeeded/failed"
    end

    attribute :progress_message, :string do
      allow_nil? true
      constraints max_length: 500
      public? true
      description "进度提示信息（如：正在上传文件、正在检测图片等）"
    end

    attribute :image_url, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "人物图片 URL（OSS 或 http）"
    end

    attribute :audio_url, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "音频 URL"
    end

    attribute :video_url, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "生成的数字人视频 URL"
    end

    attribute :dashscope_task_id, :string do
      allow_nil? true
      constraints max_length: 200
      public? true
      description "DashScope 异步任务 ID（用于轮询）"
    end

    attribute :resolution, :string do
      allow_nil? true
      public? true
      default "480P"
      constraints max_length: 10
      description "视频分辨率：480P / 720P"
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
      description "创建任务的用户"
    end

    timestamps()
  end
end
