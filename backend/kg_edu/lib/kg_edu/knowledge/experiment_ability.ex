defmodule KgEdu.Knowledge.ExperimentAbility do
  @moduledoc """
  ExperimentAbility join resource (实验-能力目标关联).
  Associates experiments with ability targets (main abilities or sub-abilities).
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "experiment_abilities"
    repo KgEdu.Repo

    references do
      reference :experiment, on_delete: :delete
      reference :main_ability, on_delete: :delete
      reference :sub_ability, on_delete: :delete
    end
  end

  json_api do
    type "experiment_ability"
  end

  typescript do
    type_name "ExperimentAbility"
  end

  code_interface do
    define :create_experiment_ability, action: :create
    define :destroy_experiment_ability, action: :destroy
    define :get_experiment_ability, action: :read, get_by: [:id]
    define :list_experiment_abilities, action: :read
    define :get_abilities_by_experiment, action: :by_experiment
  end

  actions do
    create :create do
      primary? true

      accept [
        :ability_type,
        :experiment_id,
        :main_ability_id,
        :sub_ability_id
      ]
    end

    defaults [:read, :destroy]

    read :by_experiment do
      description "Get all ability associations for a specific experiment"

      argument :experiment_id, :uuid do
        allow_nil? false
      end

      filter expr(experiment_id == ^arg(:experiment_id))
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

    attribute :ability_type, :atom do
      allow_nil? false
      constraints one_of: [:main_ability, :sub_ability]
      public? true
      description "Type of ability: main_ability or sub_ability"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :experiment, KgEdu.Knowledge.Experiment do
      public? true
      allow_nil? false
      description "The experiment in this association"
    end

    belongs_to :main_ability, KgEdu.Knowledge.MainAbility do
      public? true
      allow_nil? true
      description "The main ability (when ability_type is :main_ability)"
    end

    belongs_to :sub_ability, KgEdu.Knowledge.SubAbility do
      public? true
      allow_nil? true
      description "The sub ability (when ability_type is :sub_ability)"
    end
  end
end
