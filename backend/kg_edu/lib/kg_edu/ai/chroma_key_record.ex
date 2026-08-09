defmodule KgEdu.AI.ChromaKeyRecord do
  @moduledoc """
  抠像历史记录。

  每次一键抠像成功后落库，前端「图片抠像」tab 以表格展示历史记录：
  输入图、抠像颜色、参数（similarity/blend/yuv/despill）、结果图、时间。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "chroma_key_records"
    repo KgEdu.Repo
  end

  json_api do
    type "chroma_key_record"
  end

  typescript do
    type_name "ChromaKeyRecord"
  end

  code_interface do
    define :get_chroma_key_record, action: :by_id
    define :list_chroma_key_records, action: :read
    define :create_chroma_key_record, action: :create
    define :delete_chroma_key_record, action: :destroy
  end

  actions do
    defaults [:destroy]

    read :read do
      description "List chroma key records (filtered by current user)"
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
      description "Get a chroma key record by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a chroma key record"
      accept [:source_image_url, :result_image_url, :color, :similarity, :blend, :yuv, :despill]
      change set_attribute(:created_by_id, actor(:id))
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
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :source_image_url, :string do
      allow_nil? false
      constraints max_length: 1000
      public? true
      description "输入原图 URL"
    end

    attribute :result_image_url, :string do
      allow_nil? true
      constraints max_length: 1000
      public? true
      description "抠像结果（透明 PNG）URL"
    end

    attribute :color, :string do
      allow_nil? false
      public? true
      default "green"
      constraints max_length: 20
      description "抠像颜色"
    end

    attribute :similarity, :float do
      allow_nil? false
      public? true
      default 0.4
      description "相似度"
    end

    attribute :blend, :float do
      allow_nil? false
      public? true
      default 0.1
      description "混合度"
    end

    attribute :yuv, :boolean do
      allow_nil? false
      public? true
      default true
      description "YUV 模式（true=chromakey false=colorkey）"
    end

    attribute :despill, :boolean do
      allow_nil? false
      public? true
      default false
      description "去溢色"
    end

    attribute :created_by_id, :uuid do
      allow_nil? true
      public? true
      description "创建者"
    end

    timestamps()
  end
end
