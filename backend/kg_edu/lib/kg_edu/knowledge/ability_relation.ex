defmodule KgEdu.Knowledge.AbilityRelation do
  @moduledoc """
  Ability Relation resource (能力关联).

  Represents a polymorphic many-to-many relationship between abilities.
  Both MainAbility and SubAbility can be related to each other
  (main↔main, main↔sub, sub↔sub).

  The relation name is fixed as "关联" - i.e. all relations share the same label.
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  postgres do
    table "ability_relations"
    repo KgEdu.Repo
  end

  typescript do
    type_name "AbilityRelation"
  end

  code_interface do
    define :create_ability_relation, action: :create
    define :update_ability_relation, action: :update
    define :destroy_ability_relation, action: :destroy
    define :list_ability_relations, action: :read
    define :get_ability_relation, action: :read, get_by: [:id]
    define :get_ability_relations_by_course, action: :by_course
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true

      accept [
        :source_type,
        :source_id,
        :target_type,
        :target_id,
        :course_id,
        :description
      ]

      validate fn changeset, _context ->
        source_id = Ash.Changeset.get_attribute(changeset, :source_id)
        target_id = Ash.Changeset.get_attribute(changeset, :target_id)
        source_type = Ash.Changeset.get_attribute(changeset, :source_type)
        target_type = Ash.Changeset.get_attribute(changeset, :target_type)
        course_id = Ash.Changeset.get_attribute(changeset, :course_id)

        cond do
          is_nil(source_id) ->
            {:error, field: :source_id, message: "源能力 ID 不能为空"}

          is_nil(target_id) ->
            {:error, field: :target_id, message: "目标能力 ID 不能为空"}

          is_nil(course_id) ->
            {:error, field: :course_id, message: "课程 ID 不能为空"}

          source_type == target_type and source_id == target_id ->
            {:error, field: :target_id, message: "源能力和目标能力不能相同"}

          true ->
            :ok
        end
      end
    end

    update :update do
      primary? true
      accept [:description]
      require_atomic? false
    end

    read :by_course do
      description "Get all ability relations for a specific course"

      argument :course_id, :uuid do
        allow_nil? false
      end

      filter expr(course_id == ^arg(:course_id))
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

    attribute :source_type, :atom do
      allow_nil? false
      public? true
      constraints one_of: [:main_ability, :sub_ability]
      description "源能力类型: 主能力 / 子能力"
    end

    attribute :source_id, :uuid do
      allow_nil? false
      public? true
      description "源能力 ID"
    end

    attribute :target_type, :atom do
      allow_nil? false
      public? true
      constraints one_of: [:main_ability, :sub_ability]
      description "目标能力类型: 主能力 / 子能力"
    end

    attribute :target_id, :uuid do
      allow_nil? false
      public? true
      description "目标能力 ID"
    end

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
      description "所属课程 ID"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "关联备注（可选）"
    end

    timestamps(public?: true)
  end

  identities do
    identity :unique_ability_relation, [
      :source_type,
      :source_id,
      :target_type,
      :target_id
    ]
  end
end