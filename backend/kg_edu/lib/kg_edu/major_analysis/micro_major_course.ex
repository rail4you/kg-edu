defmodule KgEdu.MajorAnalysis.MicroMajorCourse do
  @moduledoc """
  微专业与课程的关联。

  与普通专业的课程关联不同，微专业课程具有独立的学分、学时、学期属性。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_courses"
    repo KgEdu.Repo

    identity_index_names unique_micro_major_course: "micro_major_courses_unique"

    references do
      reference :micro_major, on_delete: :delete
      reference :course, on_delete: :delete
    end
  end

  typescript do
    type_name "MicroMajorCourse"
  end

  code_interface do
    define :create_micro_major_course, action: :create
    define :update_micro_major_course, action: :update
    define :delete_micro_major_course, action: :destroy
    define :list_micro_major_courses, action: :read
    define :list_courses_by_micro_major, action: :by_micro_major
    define :replace_micro_major_courses, action: :replace_for_micro_major
  end

  actions do
    defaults [:read, :destroy]

    read :by_micro_major do
      description "Get courses for a micro major"
      argument :micro_major_id, :uuid, allow_nil?: false
      filter expr(micro_major_id == ^arg(:micro_major_id))

      prepare fn query, _context ->
        query
        |> Ash.Query.load(:course)
        |> Ash.Query.sort(sort_order: :asc, inserted_at: :asc)
      end
    end

    create :create do
      primary? true

      accept [
        :micro_major_id,
        :course_id,
        :credit,
        :period,
        :semester,
        :course_type,
        :sort_order,
        :description
      ]

      upsert? true
      upsert_identity :unique_micro_major_course
      upsert_fields [:credit, :period, :semester, :course_type, :sort_order, :description]
    end

    update :update do
      accept [:credit, :period, :semester, :course_type, :sort_order, :description]
      require_atomic? false
    end

    action :replace_for_micro_major, :map do
      description "Replace all courses for a micro major"

      argument :micro_major_id, :uuid do
        allow_nil? false
      end

      argument :courses, {:array, :map} do
        allow_nil? false
      end

      run fn input, context ->
        micro_major_id = input.arguments.micro_major_id
        tenant = context.tenant

        existing_query =
          __MODULE__
          |> Ash.Query.filter(micro_major_id == ^micro_major_id)

        with {:ok, existing} <- Ash.read(existing_query, tenant: tenant, authorize?: false),
             :ok <- destroy_existing(existing, tenant),
             {:ok, records} <- create_replacements(micro_major_id, input.arguments.courses, tenant) do
          # Reload to get course info
          {:ok, reloaded} = Ash.read(existing_query, tenant: tenant, authorize?: false, load: [:course])
          {:ok, %{count: length(records), records: reloaded}}
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

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :credit, :float do
      allow_nil? true
      public? true
      description "课程学分"
    end

    attribute :period, :integer do
      allow_nil? true
      public? true
      description "课程学时"
    end

    attribute :semester, :string do
      allow_nil? true
      public? true
      description "学期（如：第一学期、第二学期）"
    end

    attribute :course_type, :atom do
      allow_nil? false
      public? true
      default :required
      constraints one_of: [:required, :elective]
      description "课程类型"
    end

    attribute :sort_order, :integer do
      allow_nil? false
      public? true
      default 0
      description "排序顺序"
    end

    attribute :description, :string do
      allow_nil? true
      public? true
      description "课程说明"
    end

    create_timestamp :inserted_at
    update_timestamp :updated_at
  end

  relationships do
    belongs_to :micro_major, KgEdu.MajorAnalysis.MicroMajor do
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
    identity :unique_micro_major_course, [:micro_major_id, :course_id]
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

  defp create_replacements(micro_major_id, courses, tenant) do
    records =
      courses
      |> Enum.with_index()
      |> Enum.map(fn {course, index} ->
        %{
          micro_major_id: micro_major_id,
          course_id: get_value(course, "course_id", :course_id),
          credit: get_float_value(course, "credit", :credit),
          period: get_int_value(course, "period", :period),
          semester: get_value(course, "semester", :semester),
          course_type: get_atom_value(course, "course_type", :course_type) || :required,
          sort_order: get_int_value(course, "sort_order", :sort_order) || index,
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

  defp get_value(map, string_key, atom_key) do
    Map.get(map, string_key) || Map.get(map, atom_key)
  end

  defp get_float_value(map, string_key, atom_key) do
    val = get_value(map, string_key, atom_key)
    case val do
      nil -> nil
      v when is_float(v) -> v
      v when is_integer(v) -> Float.round(v * 1.0, 1)
      v when is_binary(v) -> case Float.parse(v) do
        {f, _} -> f
        :error -> nil
      end
      _ -> nil
    end
  end

  defp get_int_value(map, string_key, atom_key) do
    val = get_value(map, string_key, atom_key)
    case val do
      nil -> nil
      v when is_integer(v) -> v
      v when is_binary(v) -> case Integer.parse(v) do
        {i, _} -> i
        :error -> nil
      end
      _ -> nil
    end
  end

  defp get_atom_value(map, string_key, atom_key) do
    val = get_value(map, string_key, atom_key)
    case val do
      nil -> nil
      v when is_atom(v) -> v
      v when is_binary(v) -> String.to_existing_atom(v)
      _ -> nil
    end
  rescue
    _ -> nil
  end
end