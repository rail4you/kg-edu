defmodule KgEdu.GroupTask.TaskGroup do
  @moduledoc """
  任务-小组关联资源。
  多对多关系：一个任务可以分配给多个小组，一个小组可以有多个任务。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.GroupTask,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "task_groups"
    repo KgEdu.Repo

    references do
      reference :task, on_delete: :delete
      reference :group, on_delete: :delete
    end
  end

  json_api do
    type "task_group"
  end

  typescript do
    type_name "TaskGroup"
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:task_id, :group_id]
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
    belongs_to :task, KgEdu.GroupTask.Task do
      allow_nil? false
      public? true
    end

    belongs_to :group, KgEdu.GroupTask.Group do
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_task_group, [:task_id, :group_id]
  end
end
