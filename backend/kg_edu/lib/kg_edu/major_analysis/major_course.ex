defmodule KgEdu.MajorAnalysis.MajorCourse do
  @moduledoc """
  微专业与课程的显式关联。

  一个微专业可以包含多门课程，课程也可以被多个微专业复用。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "major_courses"
    repo KgEdu.Repo

    identity_index_names unique_major_course: "major_courses_major_course_unique"

    references do
      reference :major, on_delete: :delete
      reference :course, on_delete: :delete
    end
  end

  typescript do
    type_name "MajorCourse"
  end

  code_interface do
    define :create_major_course, action: :create
    define :update_major_course, action: :update_major_course
    define :delete_major_course, action: :destroy
    define :list_major_courses, action: :read
    define :list_major_courses_by_major, action: :by_major
    define :replace_major_courses, action: :replace_for_major
  end

  actions do
    defaults [:read, :destroy]

    read :by_major do
      description "Get course links for a micro major"
      argument :major_id, :uuid, allow_nil?: false
      filter expr(major_id == ^arg(:major_id))

      prepare fn query, _context ->
        query
        |> Ash.Query.load(:course)
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    create :create do
      primary? true

      accept [
        :major_id,
        :course_id,
        :course_type,
        :support_role,
        :sort_order,
        :credit,
        :period,
        :description
      ]

      upsert? true
      upsert_identity :unique_major_course
      upsert_fields [:course_type, :support_role, :sort_order, :credit, :period, :description]
    end

    update :update_major_course do
      accept [:course_type, :support_role, :sort_order, :credit, :period, :description]
      require_atomic? false
    end

    action :replace_for_major, :map do
      description "Replace all course links for a micro major"

      argument :major_id, :uuid do
        allow_nil? false
      end

      argument :courses, {:array, :map} do
        allow_nil? false
      end

      run fn input, context ->
        major_id = input.arguments.major_id
        tenant = context.tenant

        existing_query =
          __MODULE__
          |> Ash.Query.filter(major_id == ^major_id)

        with {:ok, existing} <- Ash.read(existing_query, tenant: tenant, authorize?: false),
             :ok <- destroy_existing(existing, tenant),
             {:ok, records} <- create_replacements(major_id, input.arguments.courses, tenant) do
          {:ok, %{count: length(records), records: records}}
        end
      end
    end
  end

  policies do
    policy [action(:read), action(:by_major)] do
      authorize_if always()
    end

    policy [
      action(:create),
      action(:update_major_course),
      action(:destroy),
      action(:replace_for_major)
    ] do
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

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :course_type, :atom do
      allow_nil? false
      public? true
      default :required
      constraints one_of: [:required, :elective]
    end

    attribute :support_role, :atom do
      allow_nil? false
      public? true
      default :core
      constraints one_of: [:core, :supporting, :practice]
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
    end

    attribute :credit, :float do
      allow_nil? true
      public? true
    end

    attribute :period, :integer do
      allow_nil? true
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :major, KgEdu.MajorAnalysis.Major do
      allow_nil? false
      public? true
    end

    belongs_to :course, KgEdu.Courses.Course do
      domain KgEdu.Courses
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_major_course, [:major_id, :course_id]
  end

  defp destroy_existing(records, tenant) do
    records
    |> Enum.reduce_while(:ok, fn record, :ok ->
      case Ash.destroy(record, tenant: tenant, authorize?: false) do
        :ok -> {:cont, :ok}
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp create_replacements(major_id, courses, tenant) do
    records =
      courses
      |> Enum.with_index()
      |> Enum.map(fn {course, index} ->
        %{
          major_id: major_id,
          course_id: get_value(course, "course_id", :course_id),
          course_type: get_value(course, "course_type", :course_type) || :required,
          support_role: get_value(course, "support_role", :support_role) || :core,
          sort_order: get_value(course, "sort_order", :sort_order) || index,
          credit: get_value(course, "credit", :credit),
          period: get_value(course, "period", :period),
          description: get_value(course, "description", :description)
        }
      end)
      |> Enum.reject(&is_nil(&1.course_id))

    case Ash.bulk_create(records, __MODULE__, :create,
           return_records?: true,
           tenant: tenant,
           authorize?: false
         ) do
      %Ash.BulkResult{records: records, errors: []} -> {:ok, records}
      %Ash.BulkResult{errors: [error | _]} -> {:error, error}
      %Ash.BulkResult{errors: errors} -> {:error, errors}
    end
  end

  defp get_value(map, string_key, atom_key) when is_map(map) do
    Map.get(map, string_key) || Map.get(map, atom_key)
  end
end
