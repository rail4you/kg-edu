defmodule KgEdu.MajorAnalysis.MicroMajorEnrollment do
  @moduledoc """
  学生微专业选课记录。

  教师端负责为学生分配微专业；学生端只能通过 `my_enrollments` 读取自己的微专业数据。
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
      description "Get student enrollments for a micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id))

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
        Ash.Query.filter(query, student_id == ^actor(:id))
        |> Ash.Query.load([
          :micro_major,
          :micro_major_courses,
          courses: [:micro_major_courses]
        ])
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

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :active
      constraints one_of: [:active, :completed, :removed]
      description "状态"
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
      description "备注"
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