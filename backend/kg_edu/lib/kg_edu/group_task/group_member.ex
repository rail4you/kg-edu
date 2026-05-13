defmodule KgEdu.GroupTask.GroupMember do
  @moduledoc """
  小组成员关联资源。
  记录学生与小组的关联关系，支持组长标记。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.GroupTask,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "group_members"
    repo KgEdu.Repo

    references do
      reference :group, on_delete: :delete
      reference :student, on_delete: :delete
    end
  end

  json_api do
    type "group_member"
  end

  typescript do
    type_name "GroupMember"
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:group_id, :student_id, :role]
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

    attribute :role, :atom do
      allow_nil? false
      public? true
      default :member
      constraints one_of: [:leader, :member]
      description "Member role in the group"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :group, KgEdu.GroupTask.Group do
      allow_nil? false
      public? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_group_student, [:group_id, :student_id]
  end
end
