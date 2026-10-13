defmodule KgEdu.Attendance.FaceCheckLog do
  @moduledoc """
  P3: 人脸识别抓拍记录 — 进入课程/视频起播/播中/暂停续播/结束 + 定时/随机抓拍。
  scene: entry/video_start/video_playing/video_resume/video_end/timed/random。
  result: pass/fail（fail 时按配置：记录并继续 / 不允许学习）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Attendance,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "face_check_logs"
    repo KgEdu.Repo
  end

  json_api do
    type "face_check_log"
  end

  typescript do
    type_name "FaceCheckLog"
  end

  code_interface do
    define :log_face_check, action: :create
    define :list_face_checks, action: :read
    define :list_face_checks_by_user, action: :by_user
    define :list_face_checks_by_course, action: :by_course
  end

  preparations do
    prepare build(sort: [inserted_at: :desc])
  end

  actions do
    defaults [:read, :destroy]
    create :create do
      accept [:user_id, :scene, :result, :snapshot_url, :course_id, :video_id, :video_title, :note]
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

    attribute :user_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :scene, :atom do
      allow_nil? false
      public? true

      constraints one_of: [
                    :entry,
                    :video_start,
                    :video_playing,
                    :video_resume,
                    :video_end,
                    :timed,
                    :random
                  ]
    end

    attribute :result, :atom do
      allow_nil? false
      public? true
      default :pass
      constraints one_of: [:pass, :fail]
    end

    attribute :snapshot_url, :string do
      allow_nil? true
      public? true
    end

    attribute :course_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :video_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :video_title, :string do
      allow_nil? true
      public? true
    end

    attribute :note, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
