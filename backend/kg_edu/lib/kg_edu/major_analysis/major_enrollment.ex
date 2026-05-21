defmodule KgEdu.MajorAnalysis.MajorEnrollment do
  @moduledoc """
  微专业学生关联资源。

  教师端负责为学生分配微专业；学生端只能通过 `my_enrollments` 读取自己的微专业数据。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  postgres do
    table "major_enrollments"
    repo KgEdu.Repo

    identity_index_names unique_major_student: "major_enrollments_major_student_unique"

    references do
      reference :major, on_delete: :delete
      reference :student, on_delete: :delete
      reference :assigned_by, on_delete: :nilify
    end
  end

  typescript do
    type_name "MajorEnrollment"
  end

  code_interface do
    define :assign_student, action: :create
    define :remove_student, action: :destroy
    define :list_enrollments, action: :read
    define :list_enrollments_by_major, action: :by_major
    define :list_enrollments_by_student, action: :by_student
    define :my_major_enrollments, action: :my_enrollments
    define :bulk_assign_students, action: :bulk_assign
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:major_id, :student_id, :assigned_by_id, :status, :notes, :assigned_at]

      change set_attribute(:assigned_at, &DateTime.utc_now/0)
      change set_attribute(:status, :active)
      change set_attribute(:assigned_by_id, actor(:id))
    end

    destroy :destroy do
      primary? true
    end

    read :by_major do
      description "Get student enrollments for a micro major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))
    end

    read :by_student do
      description "Get micro major enrollments for a student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))
    end

    read :my_enrollments do
      description "Get current student's micro major enrollments"
      filter expr(student_id == ^actor(:id) and status == :active)
    end

    action :bulk_assign do
      description "Assign multiple students to a micro major"

      argument :major_id, :uuid do
        allow_nil? false
      end

      argument :student_ids, {:array, :uuid} do
        allow_nil? false
      end

      argument :assigned_by_id, :uuid do
        allow_nil? true
      end

      run fn input, context ->
        now = DateTime.utc_now()

        records =
          input.arguments.student_ids
          |> Enum.uniq()
          |> Enum.map(fn student_id ->
            %{
              major_id: input.arguments.major_id,
              student_id: student_id,
              assigned_by_id: context.actor && context.actor.id,
              status: :active,
              assigned_at: now
            }
          end)

        case Ash.bulk_create(records, __MODULE__, :create,
               return_records?: true,
               upsert?: true,
               upsert_identity: :unique_major_student,
               upsert_fields: [:major_id, :student_id, :assigned_by_id, :status, :assigned_at],
               actor: context.actor,
               tenant: context.tenant
             ) do
          %Ash.BulkResult{records: records, errors: []} ->
            {:ok, %{assigned: length(records)}}

          %Ash.BulkResult{errors: errors} ->
            {:error, errors}
        end
      end
    end
  end

  policies do
    policy [action(:create), action(:bulk_assign)] do
      authorize_if expr(:teacher == ^actor(:role))
      authorize_if expr(:admin == ^actor(:role))
      authorize_if expr(:super_admin == ^actor(:role))
    end

    policy action(:my_enrollments) do
      authorize_if expr(student_id == ^actor(:id))
    end

    policy [action(:read), action(:by_major), action(:by_student), action(:destroy)] do
      authorize_if expr(:teacher == ^actor(:role))
      authorize_if expr(:admin == ^actor(:role))
      authorize_if expr(:super_admin == ^actor(:role))
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :major_id, :uuid do
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
    end

    attribute :progress, :float do
      allow_nil? false
      public? true
      default 0.0
      constraints min: 0.0, max: 100.0
    end

    attribute :notes, :string do
      allow_nil? true
      public? true
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
    belongs_to :major, KgEdu.MajorAnalysis.Major do
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
  end

  identities do
    identity :unique_major_student, [:major_id, :student_id]
  end
end
