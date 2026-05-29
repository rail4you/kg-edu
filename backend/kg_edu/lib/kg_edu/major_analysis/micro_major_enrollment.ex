defmodule KgEdu.MajorAnalysis.MicroMajorEnrollment do
  @moduledoc """
  学生微专业选课记录。

  教师端负责为学生分配微专业或审批学生自主报名；
  学生端可通过 `my_enrollments` / `my_applications` 查看自己的微专业数据和报名记录。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_enrollments"
    repo KgEdu.Repo

    identity_index_names unique_micro_major_student: "micro_major_enrollments_unique"

    references do
      reference :micro_major, on_delete: :delete
      reference :student, on_delete: :delete
      reference :assigned_by, on_delete: :nilify
    end
  end

  typescript do
    type_name "MicroMajorEnrollment"
  end

  code_interface do
    define :assign_student, action: :create
    define :remove_student, action: :destroy
    define :list_enrollments, action: :read
    define :list_enrollments_by_micro_major, action: :by_micro_major
    define :list_enrollments_by_student, action: :by_student
    define :my_micro_major_enrollments, action: :my_enrollments
    define :bulk_assign_students, action: :bulk_assign
    define :update_enrollment, action: :update
    # 学生报名审批
    define :apply_to_micro_major, action: :apply
    define :approve_enrollment, action: :approve
    define :reject_enrollment, action: :reject
    define :reapply_to_micro_major, action: :reapply
    define :list_pending_enrollments, action: :list_pending
    define :my_applications, action: :my_applications
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:micro_major_id, :student_id, :assigned_by_id, :status, :notes]

      change set_attribute(:assigned_at, &DateTime.utc_now/0)
      change set_attribute(:status, :active)
      change set_attribute(:assigned_by_id, actor(:id))
    end

    update :update do
      accept [:status, :notes]
      require_atomic? false
    end

    destroy :destroy do
      primary? true
    end

    read :by_micro_major do
      description "Get student enrollments for a micro major, optionally filtered by status"
      argument :micro_major_id, :uuid, allow_nil?: false
      argument :status, :atom, allow_nil?: true
      filter expr(
        micro_major_id == ^arg(:micro_major_id) and
        (is_nil(^arg(:status)) or status == ^arg(:status))
      )

      prepare fn query, _context ->
        Ash.Query.load(query, :student)
      end
    end

    read :by_student do
      description "Get enrollments for a student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))

      prepare fn query, _context ->
        Ash.Query.load(query, :micro_major)
      end
    end

    read :my_enrollments do
      description "Get current student's micro major enrollments"

      prepare fn query, context ->
        actor_id = context.actor && context.actor.id
        query = if actor_id do
          Ash.Query.filter(query, student_id == ^actor_id)
        else
          query
        end

        Ash.Query.load(query, [
          :micro_major,
          :micro_major_courses
        ])
      end
    end

    # ── 学生报名 ──
    create :apply do
      description "Student applies to a micro major (micro_major must be :active)"
      accept [:micro_major_id]

      change set_attribute(:student_id, actor(:id))
      change set_attribute(:status, :pending)
      change set_attribute(:assigned_at, &DateTime.utc_now/0)

      # 验证微专业状态为 active，禁止报名 draft/archived 微专业
      change fn changeset, context ->
        mm_id = Ash.Changeset.get_attribute(changeset, :micro_major_id)
        tenant = changeset.tenant

        mm = if mm_id do
          Ash.get!(KgEdu.MajorAnalysis.MicroMajor, mm_id,
            tenant: tenant,
            actor: Map.get(context, :actor)
          )
        else
          nil
        end

        if mm == nil || mm.status != :active do
          Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidAttribute.exception(
            field: :micro_major_id,
            message: "该微专业暂未开放报名"
          ))
        else
          changeset
        end
      end
    end

    # ── 审核通过 ──
    update :approve do
      description "Approve a student's micro major application"
      accept [:notes]
      require_atomic? false

      change set_attribute(:status, :active)
      change set_attribute(:reviewed_by_id, actor(:id))
      change set_attribute(:reviewed_at, &DateTime.utc_now/0)
    end

    # ── 审核拒绝 ──
    update :reject do
      description "Reject a student's micro major application"
      accept [:rejected_reason, :notes]
      require_atomic? false

      change set_attribute(:status, :rejected)
      change set_attribute(:reviewed_by_id, actor(:id))
      change set_attribute(:reviewed_at, &DateTime.utc_now/0)
    end

    # ── 重新报名（被拒后）──
    update :reapply do
      description "Re-apply after rejection"
      accept []
      require_atomic? false

      change set_attribute(:status, :pending)
      change set_attribute(:rejected_reason, nil)
      change set_attribute(:assigned_at, &DateTime.utc_now/0)

      # 验证当前状态必须是 rejected（使用 changeset.data 获取原始值，而非 changeset 中即将设置的新值）
      change fn changeset, _ ->
        original_status = changeset.data.status

        if original_status == :rejected do
          changeset
        else
          Ash.Changeset.add_error(changeset, Ash.Error.Changes.InvalidAttribute.exception(
            field: :status,
            message: "只能对已拒绝的报名重新申请"
          ))
        end
      end
    end

    # ── 教师端待审批列表 ──
    read :list_pending do
      description "List pending enrollments for a micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id) and status == :pending)

      prepare fn query, _context ->
        Ash.Query.load(query, :student)
      end
    end

    # ── 学生端查看报名记录 ──
    read :my_applications do
      description "Get current student's application history"

      prepare fn query, context ->
        actor_id = context.actor && context.actor.id
        query = if actor_id do
          Ash.Query.filter(query, student_id == ^actor_id)
        else
          query
        end

        Ash.Query.load(query, :micro_major)
      end
    end

    action :bulk_assign do
      description "Assign multiple students to a micro major"

      argument :micro_major_id, :uuid do
        allow_nil? false
      end

      argument :student_ids, {:array, :uuid} do
        allow_nil? false
      end

      run fn input, context ->
        records =
          input.arguments.student_ids
          |> Enum.uniq()
          |> Enum.map(fn student_id ->
            %{
              micro_major_id: input.arguments.micro_major_id,
              student_id: student_id,
              assigned_by_id: context.actor && context.actor.id,
              status: :active
            }
          end)

        case Ash.bulk_create(records, __MODULE__, :create,
               return_records?: true,
               upsert?: true,
               upsert_identity: :unique_micro_major_student,
               upsert_fields: [:micro_major_id, :student_id, :assigned_by_id, :status],
               tenant: context.tenant
             ) do
          %Ash.BulkResult{records: _records, errors: []} ->
            :ok

          %Ash.BulkResult{errors: [error | _]} ->
            {:error, error}
        end
      end
    end
  end

  policies do
    policy always() do
      description "Allow all users full access"
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :micro_major_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :assigned_by_id, :uuid do
      allow_nil? true
      public? true
    end

    attribute :reviewed_by_id, :uuid do
      allow_nil? true
      public? true
      description "审核人 ID"
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: [:pending, :active, :rejected, :completed, :removed]
      description "状态：pending(报名待审), active(已批准/已分配), rejected(已拒绝), completed(已完成), removed(已移除)"
    end

    attribute :rejected_reason, :string do
      allow_nil? true
      public? true
      description "审批拒绝原因"
    end

    attribute :reviewed_at, :utc_datetime do
      allow_nil? true
      public? true
      description "审核时间（批准或拒绝时置为当前时间）"
    end

    attribute :progress, :float do
      allow_nil? false
      public? true
      default 0.0
      constraints min: 0.0, max: 100.0
      description "学习进度"
    end

    attribute :notes, :string do
      allow_nil? true
      public? true
      description "备注（可用于记录审核备注等）"
    end

    attribute :assigned_at, :utc_datetime do
      allow_nil? false
      public? true
      default &DateTime.utc_now/0
    end

    attribute :completed_at, :utc_datetime do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :micro_major, KgEdu.MajorAnalysis.MicroMajor do
      allow_nil? false
      public? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? false
      public? true
    end

    belongs_to :assigned_by, KgEdu.Accounts.User do
      domain KgEdu.Accounts
      allow_nil? true
      public? true
    end

    has_many :micro_major_courses, KgEdu.MajorAnalysis.MicroMajorCourse do
      source_attribute :micro_major_id
      destination_attribute :micro_major_id
      public? true
    end
  end

  identities do
    identity :unique_micro_major_student, [:micro_major_id, :student_id]
  end
end