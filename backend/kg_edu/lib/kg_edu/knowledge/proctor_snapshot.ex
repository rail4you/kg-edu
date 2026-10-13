defmodule KgEdu.Knowledge.ProctorSnapshot do
  @moduledoc """
  考试监考抓拍记录 — 教师手动抓拍或按时间间隔自动抓拍得到的学生考试画面。

  每条记录包含抓拍图片（data URL）、抓拍时间、抓拍方式（手动/自动）等。
  存于租户 schema，policies 放开。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer]

  postgres do
    table "proctor_snapshots"
    repo KgEdu.Repo
  end

  code_interface do
    define :create_snapshot, action: :create
    define :get_snapshot, action: :read, get_by: [:id]
    define :list_snapshots, action: :read
    define :list_by_exam, action: :by_exam
    define :list_by_exam_student, action: :by_exam_student
  end

  preparations do
    prepare build(sort: [captured_at: :desc])
  end

  actions do
    defaults [:read, :destroy]

    read :by_exam do
      description "按考试读取抓拍记录"
      argument :exam_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id))
    end

    read :by_exam_student do
      description "按考试 + 学生读取抓拍记录"
      argument :exam_id, :uuid, allow_nil?: false
      argument :student_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id) and student_id == ^arg(:student_id))
    end

    create :create do
      accept [:exam_id, :student_id, :student_name, :image_url, :source, :captured_at]
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

    attribute :image_url, :string do
      allow_nil? true
      public? true
      description "抓拍图片（data URL）"
    end

    attribute :source, :atom do
      allow_nil? false
      public? true
      default :manual
      constraints one_of: [:manual, :auto]
      description "抓拍方式：手动 / 自动"
    end

    attribute :captured_at, :utc_datetime do
      allow_nil? false
      public? true
      description "抓拍时间"
    end

    create_timestamp :inserted_at
  end
end
