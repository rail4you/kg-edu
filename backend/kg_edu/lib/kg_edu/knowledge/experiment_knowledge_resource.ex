defmodule KgEdu.Knowledge.ExperimentKnowledgeResource do
  @moduledoc """
  ExperimentKnowledgeResource join resource (实验-知识点关联).
  Associates experiments with knowledge resources (knowledge points).
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "experiment_knowledge_resources"
    repo KgEdu.Repo

    references do
      reference :experiment, on_delete: :delete
      reference :knowledge_resource, on_delete: :delete
    end
  end

  json_api do
    type "experiment_knowledge_resource"
  end

  typescript do
    type_name "ExperimentKnowledgeResource"
  end

  code_interface do
    define :create_experiment_knowledge_resource, action: :create
    define :destroy_experiment_knowledge_resource, action: :destroy
    define :get_experiment_knowledge_resource, action: :read, get_by: [:id]
    define :list_experiment_knowledge_resources, action: :read
    define :get_by_experiment_and_resource, action: :by_experiment_and_resource
  end

  actions do
    defaults [:create, :read, :destroy]

    read :by_experiment_and_resource do
      description "Get the association record by experiment and knowledge resource"

      argument :experiment_id, :uuid do
        allow_nil? false
      end

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      get? true

      filter expr(
               experiment_id == ^arg(:experiment_id) and
                 knowledge_resource_id == ^arg(:knowledge_resource_id)
             )
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

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :experiment, KgEdu.Knowledge.Experiment do
      public? true
      allow_nil? false
      description "The experiment in this association"
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
      description "The knowledge resource in this association"
    end
  end
end
