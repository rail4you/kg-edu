defmodule KgEdu.Knowledge.RelationType do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "relation_types"
    repo KgEdu.Repo
  end

  json_api do
    type "relation_type"
  end

  typescript do
    type_name "RelationType"
  end

  code_interface do
    define :get_relation_type, action: :by_id
    define :list_relation_types, action: :read
    define :get_relation_type_by_name, action: :by_name
    define :create_relation_type, action: :create
    define :update_relation_type, action: :update
    define :delete_relation_type, action: :destroy
    define :upsert_relation_type, action: :upsert_relation_type
  end

  actions do
    defaults [:read, :create, :update, :destroy]

    read :by_id do
      description "Get a relation type by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_name do
      description "Get a relation type by name"
      get? true
      argument :name, :string, allow_nil?: false
      filter expr(name == ^arg(:name))
    end

    create :upsert_relation_type do
      description "Create or update a relation type"
      accept [:name, :display_name, :description]

      argument :name, :string, allow_nil?: false
      argument :display_name, :string, allow_nil?: true
      argument :description, :string, allow_nil?: true

      change fn changeset, _context ->
        name = Ash.Changeset.get_argument(changeset, :name)
        display_name = Ash.Changeset.get_argument(changeset, :display_name) || String.capitalize(name) |> String.replace("_", " ")
        description = Ash.Changeset.get_argument(changeset, :description) || "Relation type: #{display_name}"

        changeset
        |> Ash.Changeset.change_attribute(:name, name)
        |> Ash.Changeset.change_attribute(:display_name, display_name)
        |> Ash.Changeset.change_attribute(:description, description)
      end

      # Handle upsert using Ash's built-in upsert capability
      upsert? true
      upsert_identity :unique_name
    end
  end

  policies do
    policy always() do
      authorize_if always()
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 50
      public? true
      description "Unique name of the relation type"
    end

    attribute :display_name, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 100
      public? true
      description "Human-readable display name"
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 500
      public? true
      description "Description of what this relation type means"
    end

    timestamps()
  end

  relationships do
    has_many :relations, KgEdu.Knowledge.Relation do
      public? true
      destination_attribute :relation_type_id
    end
  end

  identities do
    identity :unique_name, [:name]
  end
end
