defmodule KgEdu.Knowledge.PracticeAttempt do
  @moduledoc """
  P3: AI 实践记录 — 6 类场景（情景对话/上传作品/思维阶梯/思辨擂台/代码编辑/互动故事）
  的作答实录 + AI 实时评估分数与报告。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "practice_attempts"
    repo KgEdu.Repo
  end

  json_api do
    type "practice_attempt"
  end

  typescript do
    type_name "PracticeAttempt"
  end

  code_interface do
    define :create_practice_attempt, action: :create
    define :update_practice_attempt, action: :update
    define :delete_practice_attempt, action: :destroy
    define :get_practice_attempt, action: :read, get_by: [:id]
    define :list_practice_attempts, action: :read
    define :list_attempts_by_user, action: :by_user
    define :list_attempts_by_course, action: :by_course
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:scenario, :user_id, :course_id, :transcript, :score, :report, :status]
    end

    update :update do
      accept [:transcript, :score, :report, :status]
      require_atomic? false
    end

    read :by_user do
      argument :user_id, :uuid, allow_nil?: false
      filter expr(user_id == ^arg(:user_id))
    end

    read :by_course do
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

    attribute :scenario, :atom do
      allow_nil? false
      public? true

      constraints one_of: [
                    :dialogue,
                    :work_upload,
                    :thinking_ladder,
                    :debate_arena,
                    :code_editor,
                    :interactive_story
                  ]
    end

    attribute :user_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :course_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :transcript, {:array, :map} do
      allow_nil? true
      public? true
      description "对话/操作实录 [{role, content}]"
    end

    attribute :score, :integer do
      allow_nil? true
      public? true
      description "AI 评估分数（0-100）"
    end

    attribute :report, :string do
      allow_nil? true
      public? true
      description "AI 评估报告"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :evaluated]
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
