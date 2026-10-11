defmodule KgEdu.Research.ResearchRoomMessage do
  @moduledoc """
  虚拟教研室消息：教师在虚拟教研室中发布的讨论与提醒。

  对应「易课程-完整交互原型」教师端 虚拟教研室 页面：
  - 全部消息 / 未读消息 / 我参与的
  - 每条消息包含标题、正文、发布方与发布时间
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Research,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "research_room_messages"
    repo KgEdu.Repo

    references do
      reference :course, on_delete: :nilify
      reference :author, on_delete: :nilify
    end
  end

  json_api do
    type "research_room_message"
  end

  typescript do
    type_name "ResearchRoomMessage"
  end

  code_interface do
    define :list_research_room_messages, action: :read
    define :get_research_room_message, action: :by_id
    define :create_research_room_message, action: :create
    define :mark_research_room_message_read, action: :mark_read
    define :delete_research_room_message, action: :destroy
  end

  actions do
    defaults [:destroy]

    read :read do
      primary? true

      pagination do
        required? false
        offset? true
        keyset? true
        countable true
      end

      prepare build(sort: [posted_at: :desc], load: [:author, :course])
    end

    read :by_id do
      description "Get a research room message by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    create :create do
      description "Create a research room message"
      accept [:title, :content, :author_label, :author_id, :course_id, :posted_at, :participated]
      change set_attribute(:read_status, :unread)
    end

    update :mark_read do
      description "Mark a research room message as read"
      accept []
      change set_attribute(:read_status, :read)
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
      constraints max_length: 200
      description "消息标题"
    end

    attribute :content, :string do
      allow_nil? false
      public? true
      constraints max_length: 5000
      description "消息正文"
    end

    attribute :author_label, :string do
      allow_nil? true
      public? true
      description "发布方展示名称，如「课程教学团队」"
    end

    attribute :read_status, :atom do
      allow_nil? false
      public? true
      default :unread
      constraints one_of: [:unread, :read]
      description "已读状态"
    end

    attribute :participated, :boolean do
      allow_nil? false
      public? true
      default false
      description "当前用户是否参与过"
    end

    attribute :posted_at, :utc_datetime do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
      description "发布时间"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :author, KgEdu.Accounts.User do
      allow_nil? true
      public? true
      description "发布人"
    end

    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? true
      public? true
      description "关联课程"
    end
  end
end
