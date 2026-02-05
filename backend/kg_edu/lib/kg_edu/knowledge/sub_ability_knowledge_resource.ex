defmodule KgEdu.Knowledge.SubAbilityKnowledgeResource do
  @moduledoc """
  Join resource for the many-to-many relationship between SubAbilities and Knowledge Resources.
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  postgres do
    table "sub_ability_knowledge_resources"
    repo KgEdu.Repo

    identity_index_names unique_sub_ability_knowledge_resource: "sub_ability_knowledge_unique"

    references do
      reference :knowledge_resource, on_delete: :delete
    end
  end

  multitenancy do
    strategy :context
  end

  typescript do
    type_name "SubAbilityKnowledgeResource"
  end

  code_interface do
    define :create_join, action: :create
    define :destroy_join, action: :destroy
    define :get_joins_by_sub_ability, action: :by_sub_ability
    define :get_joins_by_knowledge_resource, action: :by_knowledge_resource
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:sub_ability_id, :knowledge_resource_id]
    end

    read :by_sub_ability do
      description "Get all join records for a specific sub-ability"
      argument :sub_ability_id, :uuid do
        allow_nil? false
      end

      filter expr(sub_ability_id == ^arg(:sub_ability_id))
    end

    read :by_knowledge_resource do
      description "Get all join records for a specific knowledge resource"
      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    timestamps()
  end

  relationships do
    belongs_to :sub_ability, KgEdu.Knowledge.SubAbility do
      public? true
      allow_nil? false
      description "The sub-ability in this relationship"
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
      description "The knowledge resource in this relationship"
    end
  end

  identities do
    identity :unique_sub_ability_knowledge_resource, [:sub_ability_id, :knowledge_resource_id]
  end
end
