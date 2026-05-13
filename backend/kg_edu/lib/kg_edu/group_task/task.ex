defmodule KgEdu.GroupTask.Task do
  @moduledoc """
  分组任务资源。
  教师创建任务，通过二维码（token）分发给学生参与。
  支持多种任务类型：提交、讨论、投票、文件上传。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.GroupTask,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]


  postgres do
    table "group_tasks"
    repo KgEdu.Repo
  end

  json_api do
    type "group_task"
  end

  typescript do
    type_name "GroupTask"
  end

  code_interface do
    define :create_task, action: :create
    define :update_task, action: :update_task
    define :delete_task, action: :destroy
    define :get_task, action: :by_id
    define :list_tasks, action: :read
    define :get_tasks_by_course, action: :by_course
    define :get_tasks_by_status, action: :by_status
    define :get_task_by_token, action: :by_token
    define :publish_task, action: :publish
    define :close_task, action: :close
    define :get_task_progress, action: :get_progress
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a task by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get all tasks for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :by_status do
      description "Get tasks by status"
      argument :status, :atom, allow_nil?: false
      filter expr(status == ^arg(:status))
    end

    read :by_token do
      description "Get a task by its token (for student QR code access)"
      argument :token, :string, allow_nil?: false
      get? true
      filter expr(token == ^arg(:token))
    end

    create :create do
      description "Create a new group task"
      accept [:title, :description, :course_id, :task_type, :due_date]

      argument :group_ids, {:array, :uuid} do
        allow_nil? true
        default []
        description "Groups assigned to this task"
      end

      argument :created_by_id, :uuid do
        allow_nil? true
      end

      change fn changeset, _context ->
        token = generate_unique_token()
        changeset
        |> Ash.Changeset.change_attribute(:token, token)
        |> Ash.Changeset.change_attribute(:status, :draft)
      end

      change manage_relationship(:group_ids, :groups, type: :append)
      change manage_relationship(:created_by_id, :created_by, type: :append)
    end

    update :update_task do
      description "Update a task"
      require_atomic? false
      accept [:title, :description, :task_type, :due_date]

      argument :group_ids, {:array, :uuid} do
        allow_nil? true
      end

      change manage_relationship(:group_ids, :groups, type: :append_and_remove)
    end

    update :publish do
      description "Publish a task"
      require_atomic? false
      accept []

      change fn changeset, _context ->
        changeset
        |> Ash.Changeset.change_attribute(:status, :active)
        |> Ash.Changeset.change_attribute(:publish_at, DateTime.utc_now())
      end
    end

    update :close do
      description "Close a task"
      require_atomic? false
      accept []

      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :closed)
      end
    end

    read :get_progress do
      description "Get task completion progress statistics"
      get? true

      argument :id, :uuid, allow_nil?: false

      filter expr(id == ^arg(:id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:groups, groups: [members: []], submissions: []])
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

    attribute :title, :string do
      allow_nil? false
      public? true
      description "Task title"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "Task description"
    end

    attribute :task_type, :atom do
      allow_nil? false
      public? true
      default :submission
      constraints one_of: [:submission, :discussion, :survey, :file_upload]
      description "Type of the task"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :draft
      constraints one_of: [:draft, :active, :closed]
      description "Task status"
    end

    attribute :token, :string do
      allow_nil? true
      public? true
      description "Unique token for QR code distribution"
    end

    attribute :due_date, :utc_datetime_usec do
      allow_nil? true
      public? true
      description "Task due date"
    end

    attribute :publish_at, :utc_datetime_usec do
      allow_nil? true
      public? true
      description "When the task was published"
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

    many_to_many :groups, KgEdu.GroupTask.Group do
      through KgEdu.GroupTask.TaskGroup
      source_attribute_on_join_resource :task_id
      destination_attribute_on_join_resource :group_id
      public? true
    end

    has_many :submissions, KgEdu.GroupTask.TaskSubmission do
      public? true
    end
  end

  defp generate_unique_token do
    :crypto.strong_rand_bytes(16)
    |> Base.url_encode64(padding: false)
  end
end
