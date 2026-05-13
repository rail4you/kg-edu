defmodule KgEdu.MajorAnalysis.MajorCompetency do
  @moduledoc """
  专业能力素质资源。
  树形结构，支持层级能力体系（专业能力/通用能力/实践能力）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "major_competencies"
    repo KgEdu.Repo

    references do
      reference :major, on_delete: :delete
      reference :parent, on_delete: :delete
    end
  end

  json_api do
    type "major_competency"
  end

  typescript do
    type_name "MajorCompetency"
  end

  code_interface do
    define :create_competency, action: :create
    define :update_competency, action: :update_competency
    define :delete_competency, action: :destroy
    define :get_competency, action: :by_id
    define :list_competencies, action: :read
    define :get_competencies_by_major, action: :by_major
    define :get_root_competencies, action: :root_competencies
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a competency by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
      prepare fn query, _ ->
        Ash.Query.load(query, [:children])
      end
    end

    read :by_major do
      description "Get all competencies for a major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))
      prepare fn query, _ ->
        Ash.Query.load(query, [:children])
      end
    end

    read :root_competencies do
      description "Get root-level competencies for a major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id) and is_nil(parent_id))
      prepare fn query, _ ->
        Ash.Query.load(query, [:children])
      end
    end

    create :create do
      description "Create a new competency"
      accept [:name, :category, :level, :description, :weight, :major_id, :parent_id, :ai_generated]
      change fn changeset, _context ->
        if is_nil(Ash.Changeset.get_attribute(changeset, :ai_generated)) do
          Ash.Changeset.change_attribute(changeset, :ai_generated, false)
        else
          changeset
        end
      end
    end

    update :update_competency do
      description "Update a competency"
      accept [:name, :category, :level, :description, :weight, :ai_generated]
      require_atomic? false
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
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
      description "Competency name"
    end

    attribute :category, :atom do
      allow_nil? false
      public? true
      default :professional
      constraints one_of: [:professional, :general, :practical]
      description "Category: professional/general/practical"
    end

    attribute :level, :string do
      allow_nil? true
      public? true
      description "Required proficiency level"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Competency description"
    end

    attribute :weight, :float do
      allow_nil? true
      public? true
      default 1.0
      description "Weight/importance"
    end

    attribute :ai_generated, :boolean do
      allow_nil? false
      public? true
      default false
      description "Whether AI generated"
    end

    attribute :parent_id, :uuid do
      allow_nil? true
      public? true
      description "Parent competency ID for tree structure"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :major, KgEdu.MajorAnalysis.Major do
      allow_nil? false
      public? true
    end

    belongs_to :parent, __MODULE__ do
      allow_nil? true
      public? true
    end

    has_many :children, __MODULE__ do
      public? true
      destination_attribute :parent_id
    end
  end
end
