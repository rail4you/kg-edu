defmodule KgEdu.MajorAnalysis.AbilityKnowledgeLink do
  @moduledoc """
  能力点 ↔ 知识点 关联资源。

  描述某个能力点由哪些知识点支撑，并标注支撑层级（主支撑 / 次支撑 / 实践）。
  课程信息通过 `knowledge_resource.course_id` 外键自动获得，不在此处冗余存储。

  支持同一 ability 下批量替换所有 link（`replace_for_ability`）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "ability_knowledge_links"
    repo KgEdu.Repo

    identity_index_names unique_ability_knowledge: "ability_knowledge_links_unique"

    references do
      reference :ability, on_delete: :delete
      reference :knowledge_resource, on_delete: :delete
      reference :graph, on_delete: :delete
    end
  end

  typescript do
    type_name "AbilityKnowledgeLink"
  end

  code_interface do
    define :create_ability_knowledge_link, action: :create
    define :update_ability_knowledge_link, action: :update_link
    define :delete_ability_knowledge_link, action: :destroy
    define :list_ability_knowledge_links, action: :read
    define :list_links_by_ability, action: :by_ability
    define :list_links_by_graph, action: :by_graph
    define :list_links_by_knowledge_resource, action: :by_knowledge_resource
    define :replace_ability_knowledge_links, action: :replace_for_ability
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a link by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _ ->
        Ash.Query.load(query, knowledge_resource: :course)
      end
    end

    read :by_ability do
      description "List links belonging to an ability"
      argument :ability_id, :uuid, allow_nil?: false
      filter expr(ability_id == ^arg(:ability_id))

      prepare fn query, _ ->
        Ash.Query.load(query, knowledge_resource: :course)
      end
    end

    read :by_graph do
      description "List links belonging to a graph"
      argument :graph_id, :uuid, allow_nil?: false
      filter expr(graph_id == ^arg(:graph_id))

      prepare fn query, _ ->
        Ash.Query.load(query, knowledge_resource: :course)
      end
    end

    read :by_knowledge_resource do
      description "List links pointing at a knowledge resource"
      argument :knowledge_resource_id, :uuid, allow_nil?: false
      filter expr(knowledge_resource_id == ^arg(:knowledge_resource_id))

      prepare fn query, _ ->
        Ash.Query.load(query, :ability)
      end
    end

    create :create do
      description "Create a new ability-knowledge link (upsert by identity)"
      primary? true
      accept [:ability_id, :knowledge_resource_id, :graph_id, :support_level, :weight, :description]

      upsert? true
      upsert_identity :unique_ability_knowledge
      upsert_fields [:support_level, :weight, :description]
    end

    update :update_link do
      description "Update an ability-knowledge link"
      accept [:support_level, :weight, :description]
      require_atomic? false
    end

    action :replace_for_ability, :map do
      description "Replace all knowledge links for an ability"
      argument :ability_id, :uuid do
        allow_nil? false
      end

      argument :graph_id, :uuid do
        allow_nil? false
      end

      argument :links, {:array, :map} do
        allow_nil? false
      end

      run fn input, context ->
        ability_id = input.arguments.ability_id
        graph_id = input.arguments.graph_id
        tenant = context.tenant

        query =
          __MODULE__
          |> Ash.Query.filter(ability_id == ^ability_id)

        with {:ok, existing} <- Ash.read(query, tenant: tenant, authorize?: false),
             :ok <- destroy_existing(existing, tenant),
             {:ok, records} <-
               create_replacements(ability_id, graph_id, input.arguments.links, tenant) do
          {:ok, %{count: length(records), records: records}}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_id)
      authorize_if action(:by_ability)
      authorize_if action(:by_graph)
      authorize_if action(:by_knowledge_resource)
      authorize_if action(:create)
      authorize_if action(:update_link)
      authorize_if action(:destroy)
      authorize_if action(:replace_for_ability)
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :ability_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :knowledge_resource_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :graph_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :support_level, :atom do
      allow_nil? false
      public? true
      default :primary
      constraints one_of: [:primary, :secondary, :practice]
      description "Support level: primary / secondary / practice"
    end

    attribute :weight, :float do
      allow_nil? false
      public? true
      default 1.0
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :ability, KgEdu.MajorAnalysis.JobTaskAbility do
      allow_nil? false
      public? true
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      domain KgEdu.Knowledge
      allow_nil? false
      public? true
    end

    belongs_to :graph, KgEdu.MajorAnalysis.JobCompetencyGraph do
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_ability_knowledge, [:ability_id, :knowledge_resource_id]
  end

  defp destroy_existing(records, tenant) do
    records
    |> Enum.reduce_while(:ok, fn record, :ok ->
      case Ash.destroy(record, tenant: tenant, authorize?: false) do
        :ok -> {:cont, :ok}
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp create_replacements(ability_id, graph_id, links, tenant) do
    records =
      links
      |> Enum.map(fn link ->
        %{
          ability_id: ability_id,
          graph_id: graph_id,
          knowledge_resource_id: get_value(link, "knowledge_resource_id", :knowledge_resource_id),
          support_level: get_value(link, "support_level", :support_level) || :primary,
          weight: get_value(link, "weight", :weight) || 1.0,
          description: get_value(link, "description", :description)
        }
      end)
      |> Enum.reject(&is_nil(&1.knowledge_resource_id))

    case Ash.bulk_create(records, __MODULE__, :create,
           return_records?: true,
           tenant: tenant,
           authorize?: false
         ) do
      %Ash.BulkResult{records: records, errors: []} -> {:ok, records}
      %Ash.BulkResult{errors: [error | _]} -> {:error, error}
      %Ash.BulkResult{errors: errors} -> {:error, errors}
    end
  end

  defp get_value(map, string_key, atom_key) when is_map(map) do
    Map.get(map, string_key) || Map.get(map, atom_key)
  end
end
