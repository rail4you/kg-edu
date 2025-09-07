defmodule KgEdu.Chat.Conversation do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Chat,
    extensions: [AshOban],
    data_layer: AshPostgres.DataLayer,
    notifiers: [Ash.Notifier.PubSub]

  oban do
    triggers do
      trigger :name_conversation do
        action :generate_name
        queue :conversations
        lock_for_update? false
        worker_module_name KgEdu.Chat.Message.Workers.NameConversation
        scheduler_module_name KgEdu.Chat.Message.Schedulers.NameConversation
        where expr(needs_title)
      end
    end
  end

  postgres do
    table "conversations"
    repo KgEdu.Repo
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:title]
      change relate_actor(:user)
    end

    update :generate_name do
      accept []
      transaction? false
      require_atomic? false
      change KgEdu.Chat.Conversation.Changes.GenerateName
    end

    read :my_conversations do
      filter expr(user_id == ^actor(:id))
    end
  end

  pub_sub do
    module KgEduWeb.Endpoint
    prefix "chat"

    publish_all :create, ["conversations", :user_id] do
      transform & &1.data
    end

    publish_all :update, ["conversations", :user_id] do
      transform & &1.data
    end
  end

  attributes do
    uuid_v7_primary_key :id

    attribute :title, :string do
      public? true
    end

    timestamps()
  end

  relationships do
    has_many :messages, KgEdu.Chat.Message do
      public? true
    end

    belongs_to :user, KgEdu.Accounts.User do
      public? true
      allow_nil? false
    end
  end

  calculations do
    calculate :needs_title, :boolean do
      calculation expr(
                    is_nil(title) and
                      (count(messages) > 3 or
                         (count(messages) > 1 and inserted_at < ago(10, :minute)))
                  )
    end
  end
end
