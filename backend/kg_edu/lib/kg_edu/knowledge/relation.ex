defmodule KgEdu.Knowledge.Relation do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "knowledge_relations"
    repo KgEdu.Repo
  end

  json_api do
    type "knowledge_relation"
  end

  code_interface do
    define :get_knowledge_relation, action: :by_id
    define :list_knowledge_relations, action: :read
    define :get_relations_by_knowledge, action: :by_knowledge
    define :get_outgoing_relations, action: :outgoing_relations
    define :get_incoming_relations, action: :incoming_relations
    define :create_knowledge_relation, action: :create_knowledge_relation
    define :update_knowledge_relation, action: :update_knowledge_relation
    define :delete_knowledge_relation, action: :destroy
  end

  actions do
    defaults [:read, :create, :update, :destroy]

    read :by_id do
      description "Get a knowledge relation by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_knowledge do
      description "Get relations for a specific knowledge resource"
      argument :knowledge_id, :uuid, allow_nil?: false

      filter expr(
               source_knowledge_id == ^arg(:knowledge_id) or
                 target_knowledge_id == ^arg(:knowledge_id)
             )
    end

    read :outgoing_relations do
      description "Get outgoing relations from a knowledge resource"
      argument :source_knowledge_id, :uuid, allow_nil?: false
      filter expr(source_knowledge_id == ^arg(:source_knowledge_id))
    end

    read :incoming_relations do
      description "Get incoming relations to a knowledge resource"
      argument :target_knowledge_id, :uuid, allow_nil?: false
      filter expr(target_knowledge_id == ^arg(:target_knowledge_id))
    end

    create :create_knowledge_relation do
      description "Create a new knowledge relation"
      accept [:relation_type_id, :source_knowledge_id, :target_knowledge_id]

      change relate_actor(:created_by)

      validate fn changeset, _context ->
        # Prevent self-references
        source_id = Ash.Changeset.get_attribute(changeset, :source_knowledge_id)
        target_id = Ash.Changeset.get_attribute(changeset, :target_knowledge_id)

        if source_id == target_id do
          Ash.Changeset.add_error(changeset, "Source and target knowledge cannot be the same")
        else
          changeset
        end
      end
    end

    update :update_knowledge_relation do
      description "Update a knowledge relation"
      accept [:relation_type_id]
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
    belongs_to :relation_type, KgEdu.Knowledge.RelationType do
      public? true
      allow_nil? false
    end

    belongs_to :source_knowledge, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
    end

    belongs_to :target_knowledge, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
    end
  end

  identities do
    identity :unique_relation, [:source_knowledge_id, :target_knowledge_id, :relation_type_id]
  end
end
