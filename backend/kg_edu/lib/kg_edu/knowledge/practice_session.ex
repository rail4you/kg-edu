defmodule KgEdu.Knowledge.PracticeSession do
  @moduledoc """
  互动实践共享会话 — 教师创建、学生凭 token/链接加入的「互动故事」房间。

  - 师生在同一 transcript 中轮流与 AI 推进剧情；
  - 教师（或任意参与者）触发 AI 评估后写入 score/report，双方均可查看。
  - 存于租户 schema，policies 放开（沿用 DiscussionSession / PracticeAttempt 模式）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "practice_sessions"
    repo KgEdu.Repo
  end

  json_api do
    type "practice_session"
  end

  typescript do
    type_name "PracticeSession"
  end

  code_interface do
    define :create_session, action: :create
    define :get_by_token, action: :by_token
    define :get_session, action: :read, get_by: [:id]
    define :list_sessions, action: :read
    define :update_session, action: :update
    define :join_session, action: :join
    define :evaluate_session, action: :evaluate
    define :list_by_teacher, action: :by_teacher
    define :list_by_student, action: :by_student
  end

  actions do
    defaults [:read, :destroy]

    read :by_token do
      description "按 token 读取会话"
      get? true
      argument :token, :string, allow_nil?: false
      filter expr(token == ^arg(:token))
    end

    read :by_teacher do
      argument :teacher_id, :uuid, allow_nil?: false
      filter expr(teacher_id == ^arg(:teacher_id))
    end

    read :by_student do
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))
    end

    create :create do
      accept [:scenario, :title, :course_id, :teacher_id]

      change fn changeset, _ctx ->
        Ash.Changeset.change_attribute(changeset, :token, generate_unique_token())
      end
    end

    update :update do
      accept [:transcript, :student_id, :status, :score, :report]
      require_atomic? false
    end

    update :join do
      description "学生加入会话"
      accept []
      argument :student_id, :uuid, allow_nil?: false
      require_atomic? false

      change fn changeset, _ctx ->
        Ash.Changeset.change_attribute(changeset, :student_id, Ash.Changeset.get_argument(changeset, :student_id))
      end
    end

    update :evaluate do
      description "写入 AI 评估分数与报告"
      accept []
      argument :score, :integer, allow_nil?: false
      argument :report, :string, allow_nil?: false
      require_atomic? false

      change fn changeset, _ctx ->
        changeset
        |> Ash.Changeset.change_attribute(:score, Ash.Changeset.get_argument(changeset, :score))
        |> Ash.Changeset.change_attribute(:report, Ash.Changeset.get_argument(changeset, :report))
        |> Ash.Changeset.change_attribute(:status, :evaluated)
      end
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

    attribute :token, :string do
      allow_nil? false
      public? true
      description "6 位加入 token"
    end

    attribute :scenario, :atom do
      allow_nil? false
      public? true
      default :interactive_story

      constraints one_of: [
                    :dialogue,
                    :work_upload,
                    :thinking_ladder,
                    :debate_arena,
                    :code_editor,
                    :interactive_story
                  ]
    end

    attribute :title, :string do
      allow_nil? true
      public? true
    end

    attribute :course_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :teacher_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :transcript, {:array, :map} do
      allow_nil? true
      public? true
      default []
      description "共享对话实录 [{role: \"teacher\"|\"student\"|\"ai\", content}]"
    end

    attribute :score, :integer do
      allow_nil? true
      public? true
    end

    attribute :report, :string do
      allow_nil? true
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :open
      constraints one_of: [:open, :evaluated, :closed]
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  defp generate_unique_token do
    :crypto.strong_rand_bytes(4)
    |> Base.url_encode64(padding: false)
    |> String.upcase()
    |> String.replace(~r/[^A-Z0-9]/, "0")
    |> String.slice(0, 6)
    |> String.pad_leading(6, "0")
  end
end
