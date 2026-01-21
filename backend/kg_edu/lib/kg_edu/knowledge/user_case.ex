defmodule KgEdu.Knowledge.UserCase do
  @moduledoc """
  User Case resource (案例).
  Represents practical examples or cases that illustrate knowledge points.
  A knowledge resource can have multiple user cases.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "user_cases"
    repo KgEdu.Repo
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "user_case"
  end

  typescript do
    type_name "UserCase"
  end

  code_interface do
    define :create_user_case, action: :create
    define :update_user_case, action: :update
    define :destroy_user_case, action: :destroy
    define :get_user_case, action: :read, get_by: [:id]
    define :list_user_cases, action: :read
    define :get_user_cases_by_knowledge_resource, action: :by_knowledge_resource
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:title, :description, :content, :knowledge_resource_id]
    end

    update :update do
      primary? true
      accept [:title, :description, :content]
    end

    read :by_knowledge_resource do
      description "Get all user cases for a specific knowledge resource"
      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
    end
  end

  policies do
    policy action_type(:read) do
      authorize_if always()
    end

    policy action_type(:create) do
      authorize_if always()
    end

    policy action_type(:update) do
      authorize_if always()
    end

    policy action_type(:destroy) do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
      description "The title of the user case"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "A brief description of the case"
    end

    attribute :content, :string do
      allow_nil? true
      public? true
      description "The detailed content of the case"
    end

    timestamps()
  end

  relationships do
    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
      description "The knowledge resource this case illustrates"
    end
  end
end
