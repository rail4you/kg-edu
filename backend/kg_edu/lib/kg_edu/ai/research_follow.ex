defmodule KgEdu.AI.ResearchFollow do
  @moduledoc """
  需求 12：研究追踪 — 兴趣 / 学者 / 期刊的关注列表。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.AI,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "research_follows"
    repo KgEdu.Repo
  end

  json_api do
    type "research_follow"
  end

  typescript do
    type_name "ResearchFollow"
  end

  code_interface do
    define :follow_research, action: :create
    define :unfollow_research, action: :destroy
    define :list_research_follows, action: :read
    define :list_follows_by_user, action: :by_user
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [:user_id, :kind, :ref_id, :label, :extra]
    end

    read :by_user do
      argument :user_id, :uuid, allow_nil?: false
      filter expr(user_id == ^arg(:user_id))
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

    attribute :kind, :atom do
      allow_nil? false
      public? true
      constraints one_of: [:interest, :scholar, :venue]
    end

    attribute :ref_id, :string do
      allow_nil? false
      public? true
      description "兴趣关键词 / OpenAlex 作者 ID / venue ID"
    end

    attribute :label, :string do
      allow_nil? false
      public? true
    end

    attribute :extra, :map do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end
end
