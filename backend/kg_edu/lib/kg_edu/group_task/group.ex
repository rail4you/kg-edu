defmodule KgEdu.GroupTask.Group do
  @moduledoc """
  学习小组资源。
  教师可创建小组并分配学生成员，支持手动分组和随机分组。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.GroupTask,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "groups"
    repo KgEdu.Repo
  end

  json_api do
    type "group"
  end

  typescript do
    type_name "Group"
  end

  code_interface do
    define :create_group, action: :create
    define :update_group, action: :update_group
    define :delete_group, action: :destroy
    define :get_group, action: :by_id
    define :list_groups, action: :read
    define :get_groups_by_course, action: :by_course
    define :add_members, action: :add_members
    define :remove_member, action: :remove_member
    define :random_grouping, action: :random_grouping
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a group by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get all groups for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    create :create do
      description "Create a new learning group"
      accept [:name, :description, :course_id, :max_members]

      argument :member_ids, {:array, :uuid} do
        allow_nil? true
        default []
        description "Initial member student IDs"
      end

      change manage_relationship(:member_ids, :members, type: :append)
    end

    update :update_group do
      description "Update a group"
      accept [:name, :description, :max_members]
      require_atomic? false
    end

    update :add_members do
      description "Add members to a group"
      require_atomic? false
      accept []

      argument :member_ids, {:array, :uuid} do
        allow_nil? false
        description "Student IDs to add"
      end

      change manage_relationship(:member_ids, :members, type: :append)
    end

    update :remove_member do
      description "Remove a member from a group"
      require_atomic? false
      accept []

      argument :member_id, :uuid do
        allow_nil? false
        description "Student ID to remove"
      end

      change manage_relationship(:member_id, :members, type: :remove)
    end

    action :random_grouping, :map do
      description "Randomly group students in a course into N groups"
      argument :course_id, :uuid, allow_nil?: false
      argument :group_count, :integer, allow_nil?: false

      run fn input, context ->
        tenant = context.tenant
        course_id = input.arguments.course_id

        enrollments =
          KgEdu.Courses.CourseEnrollment
          |> Ash.Query.filter(course_id == ^course_id)
          |> then(fn q ->
            if tenant, do: Ash.Query.set_tenant(q, tenant), else: q
          end)
          |> Ash.read!(authorize?: false)

        student_ids = Enum.map(enrollments, & &1.student_id)

        shuffled = Enum.shuffle(student_ids)
        group_size = max(div(length(shuffled), input.arguments.group_count), 1)

        groups =
          shuffled
          |> Enum.chunk_every(group_size)
          |> Enum.with_index()
          |> Enum.map(fn {chunk, idx} ->
            {:ok, group} =
              __MODULE__
              |> Ash.Changeset.for_create(:create, %{
                name: "小组 #{idx + 1}",
                course_id: course_id,
                member_ids: chunk
              }, tenant: tenant, authorize?: false)
              |> Ash.create()

            group
          end)

        {:ok, %{groups: groups, total_students: length(student_ids)}}
      end
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
      description "Group name"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Group description"
    end

    attribute :max_members, :integer do
      allow_nil? true
      public? true
      description "Maximum number of members"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      allow_nil? false
      public? true
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      allow_nil? true
      public? true
    end

    many_to_many :members, KgEdu.Accounts.User do
      through KgEdu.GroupTask.GroupMember
      source_attribute_on_join_resource :group_id
      destination_attribute_on_join_resource :student_id
      public? true
    end
  end
end
