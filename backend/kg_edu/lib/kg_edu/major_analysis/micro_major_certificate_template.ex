defmodule KgEdu.MajorAnalysis.MicroMajorCertificateTemplate do
  @moduledoc """
  微专业结业证书模板。

  每个微专业可以有零个或一个证书模板，由教师端设计：
  - 模板风格 (simple / classic / modern)
  - 证书字段占位配置（签发人、附加说明等）
  - 素材图片（logo、印章、签名）
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_certificate_templates"
    repo KgEdu.Repo

    references do
      reference :micro_major, on_delete: :delete
    end
  end

  json_api do
    type "micro_major_certificate_template"
  end

  typescript do
    type_name "MicroMajorCertificateTemplate"
  end

  code_interface do
    define :create_template, action: :create
    define :update_template, action: :update
    define :delete_template, action: :destroy
    define :get_template, action: :by_id
    define :list_templates, action: :read
    define :get_template_by_micro_major, action: :by_micro_major
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a certificate template by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_micro_major do
      description "Get a certificate template by micro major ID"
      get? true
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id))
    end

    create :create do
      description "Create a certificate template"
      accept [
        :micro_major_id,
        :style,
        :issuer_name,
        :extra_text,
        :logo_url,
        :seal_url,
        :signature_url,
        :title_color,
        :title_font,
        :border_color,
        :background_image_url,
        :name_field_x,
        :name_field_y,
        :name_field_width,
        :name_field_height,
        :name_font_family,
        :name_font_size,
        :name_font_weight,
        :name_color,
        :name_letter_spacing,
        :name_text_align,
      ]
    end

    update :update do
      description "Update a certificate template"
      accept [
        :style,
        :issuer_name,
        :extra_text,
        :logo_url,
        :seal_url,
        :signature_url,
        :title_color,
        :title_font,
        :border_color,
        :background_image_url,
        :name_field_x,
        :name_field_y,
        :name_field_width,
        :name_field_height,
        :name_font_family,
        :name_font_size,
        :name_font_weight,
        :name_color,
        :name_letter_spacing,
        :name_text_align,
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

    attribute :style, :atom do
      allow_nil? false
      public? true
      default :simple
      constraints one_of: [:simple, :classic, :modern, :scanned]
      description "证书风格：simple(简约风), classic(学院经典), modern(现代风), scanned(扫描件模板)"
    end

    attribute :issuer_name, :string do
      allow_nil? true
      public? true
      description "签发人/机构名称"
    end

    attribute :extra_text, :string do
      allow_nil? true
      public? true
      description "附加说明文字（如：累计学时120小时）"
    end

    attribute :logo_url, :string do
      allow_nil? true
      public? true
      description "机构 logo 图片 URL"
    end

    attribute :seal_url, :string do
      allow_nil? true
      public? true
      description "印章图片 URL"
    end

    attribute :signature_url, :string do
      allow_nil? true
      public? true
      description "签名图片 URL"
    end

    attribute :title_color, :string do
      allow_nil? true
      public? true
      default "#2b2b28"
      description "标题颜色（十六进制）"
    end

    attribute :title_font, :string do
      allow_nil? true
      public? true
      default "ui-sans-serif, system-ui, sans-serif"
      description "标题字体"
    end

    attribute :border_color, :string do
      allow_nil? true
      public? true
      default "#8a8a86"
      description "边框颜色（十六进制）"
    end

    attribute :background_image_url, :string do
      allow_nil? true
      public? true
      description "扫描件背景图 URL（scanned 风格使用）"
    end

    attribute :name_field_x, :decimal do
      allow_nil? true
      public? true
      default Decimal.new("0.2")
      description "姓名框归一化 X 坐标（0~1）"
    end

    attribute :name_field_y, :decimal do
      allow_nil? true
      public? true
      default Decimal.new("0.45")
      description "姓名框归一化 Y 坐标（0~1）"
    end

    attribute :name_field_width, :decimal do
      allow_nil? true
      public? true
      default Decimal.new("0.6")
      description "姓名框归一化宽度（0~1）"
    end

    attribute :name_field_height, :decimal do
      allow_nil? true
      public? true
      default Decimal.new("0.08")
      description "姓名框归一化高度（0~1）"
    end

    attribute :name_font_family, :string do
      allow_nil? true
      public? true
      default "serif"
      description "姓名字体族"
    end

    attribute :name_font_size, :integer do
      allow_nil? true
      public? true
      default 36
      description "姓名字号（相对图片高度的 px）"
    end

    attribute :name_font_weight, :atom do
      allow_nil? true
      public? true
      default :normal
      constraints one_of: [:normal, :bold]
      description "姓名字重：normal / bold"
    end

    attribute :name_color, :string do
      allow_nil? true
      public? true
      default "#000000"
      description "姓名颜色（十六进制）"
    end

    attribute :name_letter_spacing, :integer do
      allow_nil? true
      public? true
      default 4
      description "姓名字间距 px"
    end

    attribute :name_text_align, :atom do
      allow_nil? true
      public? true
      default :center
      constraints one_of: [:left, :center, :right]
      description "姓名对齐方式：left / center / right"
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
      description "关联的微专业"
    end
  end
end
