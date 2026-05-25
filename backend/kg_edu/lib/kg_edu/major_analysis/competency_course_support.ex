defmodule KgEdu.MajorAnalysis.CompetencyCourseSupport do
  @moduledoc """
  微专业能力节点与课程的支撑关系。

  用于描述课程如何支撑某个能力节点，并为能力图谱、文档和画像统计提供结构化依据。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "competency_course_supports"
    repo KgEdu.Repo

    identity_index_names unique_competency_course: "competency_course_supports_unique"

    references do
      reference :major_competency, on_delete: :delete
      reference :course, on_delete: :delete
    end
  end

  typescript do
    type_name "CompetencyCourseSupport"
  end

  code_interface do
    define :create_competency_course_support, action: :create
    define :update_competency_course_support, action: :update_support
    define :delete_competency_course_support, action: :destroy
    define :list_competency_course_supports, action: :read
    define :list_supports_by_competency, action: :by_competency
    define :replace_competency_course_supports, action: :replace_for_competency
  end

  actions do
    defaults [:read, :destroy]

    read :by_competency do
      description "Get course supports for a competency"
      argument :major_competency_id, :uuid, allow_nil?: false
      filter expr(major_competency_id == ^arg(:major_competency_id))

      prepare fn query, _context ->
        Ash.Query.load(query, :course)
      end
    end

    read :by_course do
      description "Get competency supports for a course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))

      prepare fn query, _context ->
        Ash.Query.load(query, :major_competency)
      end
    end

    create :create do
      primary? true
      accept [:major_competency_id, :course_id, :support_level, :description, :weight]

      upsert? true
      upsert_identity :unique_competency_course
      upsert_fields [:support_level, :description, :weight]
    end

    update :update_support do
      accept [:support_level, :description, :weight]
      require_atomic? false
    end

    action :replace_for_competency, :map do
      description "Replace all course supports for a competency"

      argument :major_competency_id, :uuid do
        allow_nil? false
      end

      argument :supports, {:array, :map} do
        allow_nil? false
      end

      run fn input, context ->
        competency_id = input.arguments.major_competency_id
        tenant = context.tenant

        query =
          __MODULE__
          |> Ash.Query.filter(major_competency_id == ^competency_id)

        with {:ok, existing} <- Ash.read(query, tenant: tenant, authorize?: false),
             :ok <- destroy_existing(existing, tenant),
             {:ok, records} <-
               create_replacements(competency_id, input.arguments.supports, tenant) do
          {:ok, %{count: length(records), records: records}}
        end
      end
    end
  end

  policies do
    policy always() do
      authorize_if action(:read)
      authorize_if action(:by_competency)
      authorize_if action(:by_course)
      authorize_if action(:create)
      authorize_if action(:update_support)
      authorize_if action(:destroy)
      authorize_if action(:replace_for_competency)
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id

    attribute :major_competency_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :course_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :support_level, :atom do
      allow_nil? false
      public? true
      default :primary
      constraints one_of: [:primary, :secondary, :practice]
    end

    attribute :description, :string do
      allow_nil? true
      public? true
    end

    attribute :weight, :float do
      allow_nil? false
      public? true
      default 1.0
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :major_competency, KgEdu.MajorAnalysis.MajorCompetency do
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
    identity :unique_competency_course, [:major_competency_id, :course_id]
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

  defp create_replacements(competency_id, supports, tenant) do
    records =
      supports
      |> Enum.map(fn support ->
        %{
          major_competency_id: competency_id,
          course_id: get_value(support, "course_id", :course_id),
          support_level: get_value(support, "support_level", :support_level) || :primary,
          description: get_value(support, "description", :description),
          weight: get_value(support, "weight", :weight) || 1.0
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
