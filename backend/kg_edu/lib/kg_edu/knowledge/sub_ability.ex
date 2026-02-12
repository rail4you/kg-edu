defmodule KgEdu.Knowledge.SubAbility do
  @moduledoc """
  Sub Ability resource (子能力).
  Represents a specific skill or capability within a main ability.
  Each sub-ability can be associated with multiple knowledge resources.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "sub_abilities"
    repo KgEdu.Repo
  end

  json_api do
    type "sub_ability"
  end

  typescript do
    type_name "SubAbility"
  end

  code_interface do
    define :create_sub_ability, action: :create
    define :update_sub_ability, action: :update
    define :destroy_sub_ability, action: :destroy
    define :get_sub_ability, action: :read, get_by: [:id]
    define :list_sub_abilities, action: :read
    define :get_sub_abilities_by_main_ability, action: :by_main_ability
    define :get_sub_ability_by_name, action: :by_name
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:name, :description, :main_ability_id]
    end

    update :update do
      primary? true
      accept [:name, :description]
    end

    read :by_main_ability do
      description "Get all sub-abilities for a specific main ability"

      argument :main_ability_id, :uuid do
        allow_nil? false
      end

      filter expr(main_ability_id == ^arg(:main_ability_id))
    end

    read :by_name do
      description "Get a sub-ability by name within a main ability"

      argument :name, :string do
        allow_nil? false
      end

      argument :main_ability_id, :uuid do
        allow_nil? false
      end

      get? true
      filter expr(name == ^arg(:name) and main_ability_id == ^arg(:main_ability_id))
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

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      description "The name of the sub-ability"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "The description of the sub-ability"
    end

    timestamps()
  end

  relationships do
    belongs_to :main_ability, KgEdu.Knowledge.MainAbility do
      public? true
      allow_nil? false
      description "The main ability this sub-ability belongs to"
    end

    many_to_many :knowledge_resources, KgEdu.Knowledge.Resource do
      public? true
      through KgEdu.Knowledge.SubAbilityKnowledgeResource
      destination_attribute_on_join_resource :knowledge_resource_id
      source_attribute_on_join_resource :sub_ability_id
      description "Knowledge resources associated with this sub-ability"
    end
  end

  aggregates do
    count :knowledge_resources_count, :knowledge_resources do
      public? true
      description "Count of knowledge resources for this sub-ability"
    end
  end
end
