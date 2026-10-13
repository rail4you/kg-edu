defmodule KgEdu.Knowledge.ProctorSession do
  @moduledoc """
  考试监考会话 — 记录某一学生在某场考试中的摄像头监控状态。

  - 学生端点击「监控」后开启会话（active=true），周期性上报最新画面帧（last_frame_url）。
  - 教师端据此判断学生是否在线、并拉取最新画面做准实时预览。
  - 存于租户 schema，policies 放开（沿用 PracticeSession / DiscussionSession 模式）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "proctor_sessions"
    repo KgEdu.Repo
  end

  code_interface do
    define :create_session, action: :create
    define :get_session, action: :read, get_by: [:id]
    define :update_session, action: :update
    define :list_sessions, action: :read
    define :list_by_exam, action: :by_exam
    define :list_by_exam_student, action: :by_exam_student
  end

  actions do
    defaults [:read, :destroy]

    read :by_exam do
      description "按考试读取所有监考会话"
      argument :exam_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id))
    end

    read :by_exam_student do
      description "按考试 + 学生读取监考会话"
      argument :exam_id, :uuid, allow_nil?: false
      argument :student_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id) and student_id == ^arg(:student_id))
    end

    create :create do
      accept [:exam_id, :student_id, :student_name, :active, :started_at]
    end

    update :update do
      accept [:active, :student_name, :last_frame_url, :last_frame_at, :started_at]
      require_atomic? false
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

    attribute :exam_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :student_name, :string do
      allow_nil? true
      public? true
    end

    attribute :active, :boolean do
      allow_nil? false
      public? true
      default false
      description "监控是否开启中"
    end

    attribute :last_frame_url, :string do
      allow_nil? true
      public? true
      description "最新画面帧（data URL）"
    end

    attribute :last_frame_at, :utc_datetime do
      allow_nil? true
      public? true
    end

    attribute :started_at, :utc_datetime do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
