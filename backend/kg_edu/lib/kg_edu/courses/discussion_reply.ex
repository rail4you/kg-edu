defmodule KgEdu.Courses.DiscussionReply do
  require Logger
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Courses,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "discussion_replies"
    repo KgEdu.Repo

    references do
      reference :discussion, on_delete: :delete
      reference :user, on_delete: :nilify
    end
  end

  json_api do
    type "discussion_reply"
  end

  typescript do
    type_name "DiscussionReply"
  end

  code_interface do
    define :create_reply, action: :create
    define :list_replies_by_discussion, action: :by_discussion
  end

  actions do
    defaults [:read]

    read :by_discussion do
      description "List replies by discussion ID"

      argument :discussion_id, :uuid do
        allow_nil? false
      end

      filter expr(discussion_id == ^arg(:discussion_id))

      pagination do
        required? false
        offset? true
        keyset? true
        countable true
      end

      prepare build(sort: [inserted_at: :asc], load: [:user])
    end

    create :create do
      accept [:content, :discussion_id, :user_id]

      after_action(fn changeset, record ->
        Logger.info("=== after_action called for discussion_reply ===")
        Logger.info("discussion_id: #{record.discussion_id}")

        # 从 changeset 获取 tenant - Ash 3.x 使用 changeset.tenant
        tenant = changeset.tenant
        Logger.info("tenant: #{inspect(tenant)}")

        # 获取 discussion record 并原子性增加 reply_count
        case KgEdu.Courses.Discussion.get_discussion(record.discussion_id, authorize?: false, tenant: tenant) do
          {:ok, discussion} ->
            Logger.info("Found discussion, incrementing reply count")
            KgEdu.Courses.Discussion.increment_reply(discussion, authorize?: false, tenant: tenant)

          error ->
            Logger.error("Failed to get discussion: #{inspect(error)}")
        end

        {:ok, record}
      end)
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

    attribute :content, :string do
      allow_nil? false
      public? true
      constraints max_length: 2000
      description "Reply content"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :discussion, KgEdu.Courses.Discussion do
      allow_nil? false
      public? true
      description "The discussion this reply belongs to"
    end

    belongs_to :user, KgEdu.Accounts.User do
      allow_nil? true
      public? true
      description "The user who created this reply"
    end
  end
end
