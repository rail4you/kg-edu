defmodule KgEdu.MajorAnalysis.MicroMajorCertificate do
  @moduledoc """
  微专业结业证书。

  当教师标记学生结业后，可以：
  1. 基于模板在线设计生成 PDF 证书
  2. 直接上传图片/PDF 证书文件
  学生端可在「我的微专业」中查看和下载。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_certificates"
    repo KgEdu.Repo

    references do
      reference :micro_major, on_delete: :delete
      reference :student, on_delete: :delete
      reference :enrollment, on_delete: :delete
      reference :template, on_delete: :nilify
    end
  end

  json_api do
    type "micro_major_certificate"
  end

  typescript do
    type_name "MicroMajorCertificate"
  end

  code_interface do
    define :create_certificate, action: :create
    define :update_certificate, action: :update
    define :delete_certificate, action: :destroy
    define :get_certificate, action: :by_id
    define :list_certificates, action: :read
    define :list_certificates_by_micro_major, action: :by_micro_major
    define :my_certificates, action: :my_certs
    define :get_student_certificate, action: :by_student_and_major
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a certificate by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:micro_major, :student, :template, :enrollment])
      end
    end

    read :by_micro_major do
      description "List certificates for a micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:student, :template, :enrollment])
        |> Ash.Query.sort(inserted_at: :desc)
      end
    end

    read :my_certs do
      description "Get current student's certificates"

      prepare fn query, context ->
        actor_id = context.actor && context.actor.id
        query = if actor_id do
          Ash.Query.filter(query, student_id == ^actor_id)
        else
          query
        end

        Ash.Query.load(query, [:micro_major, :template])
        |> Ash.Query.sort(inserted_at: :desc)
      end
    end

    read :by_student_and_major do
      description "Get a student's certificate for a specific micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      argument :student_id, :uuid, allow_nil?: true
      get? true

      prepare fn query, context ->
        student_id = arg(:student_id) || (context.actor && context.actor.id)

        query
        |> Ash.Query.filter(
          micro_major_id == ^arg(:micro_major_id) and
          student_id == ^student_id
        )
      end

      prepare fn query, _context ->
        Ash.Query.load(query, [:micro_major, :student, :template, :enrollment])
      end
    end

    create :create do
      description "Create/issue a certificate for a student"
      accept [
        :micro_major_id,
        :student_id,
        :enrollment_id,
        :template_id,
        :certificate_type,
        :file_url,
        :file_name,
        :cert_no,
        :issue_date,
        :status,
      ]

      change set_attribute(:issue_date, &DateTime.utc_now/0)
    end

    update :update do
      description "Update a certificate"
      accept [
        :file_url,
        :file_name,
        :cert_no,
        :issue_date,
        :template_id,
        :certificate_type,
        :status,
      ]
      require_atomic? false
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
    uuid_primary_key :id

    attribute :micro_major_id, :uuid do
      allow_nil? false
      public? true
      description "关联的微专业 ID"
    end

    attribute :student_id, :uuid do
      allow_nil? false
      public? true
      description "学生 ID"
    end

    attribute :enrollment_id, :uuid do
      allow_nil? true
      public? true
      description "关联的 enrollment ID"
    end

    attribute :template_id, :uuid do
      allow_nil? true
      public? true
      description "使用的证书模板 ID"
    end

    attribute :certificate_type, :atom do
      allow_nil? false
      public? true
      default :generated_pdf
      constraints one_of: [:generated_pdf, :image, :uploaded_pdf, :uploaded_image]
      description "证书类型：generated_pdf(模板生成), image(图片), uploaded_pdf(上传PDF), uploaded_image(上传图片)"
    end

    attribute :file_url, :string do
      allow_nil? true
      public? true
      description "证书文件 URL（OSS 存储路径）"
    end

    attribute :file_name, :string do
      allow_nil? true
      public? true
      description "证书文件名"
    end

    attribute :cert_no, :string do
      allow_nil? true
      public? true
      description "证书编号"
    end

    attribute :issue_date, :utc_datetime do
      allow_nil? true
      public? true
      description "颁发日期"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :active, :revoked]
      description "状态：draft(草稿), active(已颁发), revoked(已撤回)"
    end

    create_timestamp :inserted_at do
      public? true
    end
    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :micro_major, KgEdu.MajorAnalysis.MicroMajor do
      allow_nil? false
      public? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? false
      public? true
    end

    belongs_to :enrollment, KgEdu.MajorAnalysis.MicroMajorEnrollment do
      allow_nil? true
      public? true
    end

    belongs_to :template, KgEdu.MajorAnalysis.MicroMajorCertificateTemplate do
      allow_nil? true
      public? true
    end
  end
end
