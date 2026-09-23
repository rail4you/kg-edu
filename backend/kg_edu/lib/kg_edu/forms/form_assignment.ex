defmodule KgEdu.Forms.FormAssignment do
  @moduledoc """
  P3: 表单分配 — 每条记录把一个 `FormDef` 分配给租户内的一个学生。

  status: :pending（待填写）/ :submitted（已提交，等待教师审核）。
  """

  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Forms,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Rpc, AshTypescript.Resource]

  postgres do
    table "form_assignments"
    repo KgEdu.Repo
  end

  json_api do
    type "form_assignment"
  end

  typescript do
    type_name "FormAssignment"
  end

  code_interface do
    define :assign_form_to_students, action: :assign_to_students
    define :mark_form_submitted, action: :mark_submitted
    define :revoke_form_assignment, action: :revoke
    define :get_form_assignment, action: :read, get_by: [:id]
    define :list_form_assignments, action: :list
    define :list_form_assignments_by_form, action: :by_form
    define :list_form_assignments_by_student, action: :by_student
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :form_id,
        :student_id,
        :assigned_by_id,
        :submission_id,
        :due_at,
        :status
      ]
    end

    read :list do
      description "列出全部表单分配（支持分页）"

      pagination do
        required? false
        offset? true
        keyset? true
        countable true
      end
    end

    action :assign_to_students, :map do
      description """
      把一个表单批量分配给多个学生。为每个学生创建一条记录，
      已存在 pending 记录的学生不会重复创建。
      """

      argument :form_id, :uuid do
        allow_nil? false
      end

      argument :student_ids, {:array, :uuid} do
        allow_nil? false
      end

      argument :due_at, :utc_datetime do
        allow_nil? true
      end

      argument :assigned_by_id, :uuid do
        allow_nil? true
      end

      run(fn input, context ->
        form_id = input.arguments.form_id
        student_ids = input.arguments.student_ids
        due_at = Map.get(input.arguments, :due_at)
        assigned_by_id = Map.get(input.arguments, :assigned_by_id)
        tenant = context.tenant

        existing_ids =
          KgEdu.Forms.FormAssignment
          |> Ash.Query.for_read(:by_form, %{form_id: form_id}, tenant: tenant)
          |> Ash.read!(tenant: tenant)
          |> Enum.filter(&(&1.status == :pending))
          |> Enum.map(& &1.student_id)
          |> MapSet.new()

        to_create = Enum.reject(student_ids, &MapSet.member?(existing_ids, &1))

        created =
          Enum.map(to_create, fn sid ->
            attrs = %{
              form_id: form_id,
              student_id: sid,
              status: :pending,
              due_at: due_at,
              assigned_by_id: assigned_by_id
            }

            case KgEdu.Forms.FormAssignment
                 |> Ash.Changeset.for_action(:create, attrs)
                 |> Ash.create(tenant: tenant, authorize?: false) do
              {:ok, a} -> {:ok, a}
              {:error, e} -> {:error, Exception.message(e)}
            end
          end)

        successes = Enum.filter(created, &match?({:ok, _}, &1))
        failures = Enum.filter(created, &match?({:error, _}, &1))

        {:ok,
         %{
           created: length(successes),
           skipped: length(student_ids) - length(to_create),
           failed: length(failures),
           errors: Enum.map(failures, &elem(&1, 1)),
           assignments: Enum.map(successes, &elem(&1, 1))
         }}
      end)
    end

    update :mark_submitted do
      description "学生提交后调用：把 status 改成 :submitted 并绑定 submission_id"
      accept [:submission_id]

      validate(fn changeset, _ ->
        id_present? = Ash.Changeset.get_attribute(changeset, :submission_id) != nil

        if id_present? do
          :ok
        else
          {:error, field: :submission_id, message: "缺少 submission_id"}
        end
      end)

      change(set_attribute(:status, :submitted))
      require_atomic?(false)
    end

    destroy :revoke do
      description "教师撤回一条 pending 分配（已 submitted 的拒绝执行）"

      validate(fn changeset, _ ->
        status = Ash.Changeset.get_attribute(changeset, :status)

        if status == :pending do
          :ok
        else
          {:error, field: :status, message: "已提交的分配不能撤回"}
        end
      end)
    end

    read :by_form do
      argument :form_id, :uuid, allow_nil?: false
      filter(expr(form_id == ^arg(:form_id)))
    end

    read :by_student do
      argument :student_id, :uuid, allow_nil?: false
      filter(expr(student_id == ^arg(:student_id)))
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
    uuid_primary_key :id do
      public? true
    end

    attribute :form_id, :uuid do
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

    attribute :submission_id, :uuid do
      allow_nil? true
      public? true
      description "学生提交后写入对应 FormSubmission.id"
    end

    attribute :due_at, :utc_datetime do
      allow_nil? true
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :pending
      constraints one_of: [:pending, :submitted]
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :form, KgEdu.Forms.FormDef do
      allow_nil? false
      public? true
    end

    belongs_to :student, KgEdu.Accounts.User do
      allow_nil? false
      public? true
    end

    # assigned_by 不做 belongs_to：教师可能跨租户做分配，
    # Ash 的 belongs_to 在多租户下会去当前 schema 校验 users 行是否存在，会误判。
    # 保留裸 uuid 属性 assigned_by_id 供查询展示即可。
  end
end
