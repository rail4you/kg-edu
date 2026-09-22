defmodule KgEdu.Forms.FormDef do
  @moduledoc """
  P3: 自定义表单定义 — schema 为字段数组：
  `[%{key, label, type, required, options}]`，
  type: text/textarea/radio/checkbox/select/image/attachment/number/date/formula。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Forms,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "form_defs"
    repo KgEdu.Repo
  end

  json_api do
    type "form_def"
  end

  typescript do
    type_name "FormDef"
  end

  code_interface do
    define :create_form_def, action: :create
    define :update_form_def, action: :update
    define :delete_form_def, action: :destroy
    define :get_form_def, action: :read, get_by: [:id]
    define :list_form_defs, action: :read
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:title, :description, :category, :schema, :created_by_id]
    end

    update :update do
      accept [:title, :description, :category, :schema]
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

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    attribute :category, :string do
      allow_nil? true
      public? true
      description "请假/报销/申请/报修/信息采集等"
    end

    attribute :schema, {:array, :map} do
      allow_nil? false
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :created_by, KgEdu.Accounts.User do
      allow_nil? true
      public? true
    end

    has_many :submissions, KgEdu.Forms.FormSubmission do
      destination_attribute :form_id
      public? true
    end
  end
end
