defmodule KgEdu.GroupTask.TaskSubmission do
  @moduledoc """
  任务提交资源。
  学生提交分组任务的成果，教师可评分反馈。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.GroupTask,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]


  postgres do
    table "task_submissions"
    repo KgEdu.Repo

    references do
      reference :task, on_delete: :delete
      reference :group, on_delete: :delete
      reference :student, on_delete: :delete
    end
  end

  json_api do
    type "task_submission"
  end

  typescript do
    type_name "TaskSubmission"
  end

  code_interface do
    define :submit_task, action: :submit
    define :grade_submission, action: :grade
    define :get_submission, action: :by_id
    define :list_submissions, action: :read
    define :get_submissions_by_task, action: :by_task
    define :get_submissions_by_task_and_group, action: :by_task_and_group
    define :get_submission_stats, action: :get_submission_stats
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a submission by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_task do
      description "Get all submissions for a task"
      argument :task_id, :uuid, allow_nil?: false
      filter expr(task_id == ^arg(:task_id))
    end

    read :by_task_and_group do
      description "Get submissions for a specific task and group"
      argument :task_id, :uuid, allow_nil?: false
      argument :group_id, :uuid, allow_nil?: false
      filter expr(task_id == ^arg(:task_id) and group_id == ^arg(:group_id))
    end

    create :submit do
      description "Student submits a task"
      accept [:task_id, :group_id, :student_id, :content, :file_url]

      change fn changeset, context ->
        task_id = Ash.Changeset.get_attribute(changeset, :task_id)
        group_id = Ash.Changeset.get_attribute(changeset, :group_id)
        student_id = Ash.Changeset.get_attribute(changeset, :student_id)

        case KgEdu.GroupTask.Task.get_task(%{id: task_id},
               tenant: context.tenant,
               authorize?: false,
               load: [groups: [members: []]]
             ) do
          {:ok, task} ->
            assigned_group = Enum.find(task.groups || [], &(&1.id == group_id))

            cond do
              task.status != :active ->
                Ash.Changeset.add_error(changeset, message: "任务未发布或已结束")

              is_nil(assigned_group) ->
                Ash.Changeset.add_error(changeset, field: :group_id, message: "该任务未分配给当前分组")

              not Enum.any?(assigned_group.members || [], &(&1.id == student_id)) ->
                Ash.Changeset.add_error(changeset, field: :student_id, message: "只有分组内的学生才能参与该任务")

              true ->
                changeset
                |> Ash.Changeset.change_attribute(:status, :submitted)
                |> Ash.Changeset.change_attribute(:submitted_at, DateTime.utc_now())
            end

          {:error, _reason} ->
            Ash.Changeset.add_error(changeset, field: :task_id, message: "任务不存在")
        end
      end
    end

    update :grade do
      description "Teacher grades a submission"
      accept [:score, :feedback]
      require_atomic? false

      change fn changeset, _context ->
        Ash.Changeset.change_attribute(changeset, :status, :graded)
      end
    end

    read :get_submission_stats do
      description "Get submission statistics for a task"
      argument :task_id, :uuid, allow_nil?: false
      filter expr(task_id == ^arg(:task_id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:student, :group])
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

    attribute :content, :string do
      allow_nil? true
      public? true
      description "Text content of the submission"
    end

    attribute :file_url, :string do
      allow_nil? true
      public? true
      description "Attached file URL"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :pending
      constraints one_of: [:pending, :submitted, :graded]
      description "Submission status"
    end

    attribute :score, :float do
      allow_nil? true
      public? true
      description "Teacher's score"
    end

    attribute :feedback, :string do
      allow_nil? true
      public? true
      description "Teacher's feedback"
    end

    attribute :submitted_at, :utc_datetime_usec do
      allow_nil? true
      public? true
      description "When the submission was made"
    end

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

    belongs_to :student, KgEdu.Accounts.User do
      allow_nil? false
      public? true
    end
  end
end
