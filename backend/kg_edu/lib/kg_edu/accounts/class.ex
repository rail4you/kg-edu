defmodule KgEdu.Accounts.Class do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Accounts,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table("classes")
    repo(KgEdu.Repo)
  end

  json_api do
    type("class")
  end

  typescript do
    type_name("Class")
  end

  code_interface do
    define(:create_class, action: :create)
    define(:update_class, action: :update)
    define(:delete_class, action: :destroy)
    define(:get_class, action: :read, get_by: [:id])
    define(:list_classes, action: :read)
    define(:get_classes_by_college, action: :get_classes_by_college)
    define(:get_classes_by_major, action: :get_classes_by_major)
    define(:create_class_with_students, action: :create_class_with_students)
    define(:get_students_in_class, action: :get_students_in_class)
  end

  actions do
    defaults([:read, :destroy])

    update :update do
      accept([:name, :college, :major])
    end

    create :create do
      accept([:name, :college, :major])
    end

    read :get_classes_by_college do
      description("Get classes filtered by college")

      argument :college, :string do
        description("The college to filter classes by")
        allow_nil?(false)
      end

      filter(expr(college == ^arg(:college)))
    end

    read :get_classes_by_major do
      description("Get classes filtered by major")

      argument :major, :string do
        description("The major to filter classes by")
        allow_nil?(false)
      end

      filter(expr(major == ^arg(:major)))
    end

    action :create_class_with_students, :map do
      description("Create a class with associated students")

      argument :name, :string do
        description("Class name")
        allow_nil?(false)
      end

      argument :college, :string do
        description("College name (optional)")
        allow_nil?(true)
      end

      argument :major, :string do
        description("Major name (optional)")
        allow_nil?(true)
      end

      argument :students, {:array, :map} do
        description("List of student maps with member_id, name, phone, email, password")
        allow_nil?(true)
      end

      run(fn input, context ->
        # Create the class
        class_attrs = %{
          name: input.arguments.name,
          college: input.arguments.college,
          major: input.arguments.major
        }

        case KgEdu.Accounts.Class
             |> Ash.Changeset.for_action(:create, class_attrs)
             |> Ash.create(tenant: context.tenant) do
          {:ok, class} ->
            # Create students if provided
            students_result =
              case input.arguments.students do
                nil ->
                  {:ok, []}

                [] ->
                  {:ok, []}

                students ->
                  results =
                    Enum.map(students, fn student_attrs ->
                      student_with_class = Map.put(student_attrs, :class_id, class.id)

                      case KgEdu.Accounts.User
                           |> Ash.Changeset.for_action(:create_student, student_with_class)
                           |> Ash.create(tenant: context.tenant) do
                        {:ok, student} ->
                          {:ok, student}

                        {:error, error} ->
                          {:error,
                           "Failed to create student #{student_attrs[:member_id]}: #{inspect(error)}"}
                      end
                    end)

                  # Separate successful and failed results
                  {successful, failed} =
                    Enum.split_with(results, fn
                      {:ok, _} -> true
                      {:error, _} -> false
                    end)

                  {:ok,
                   %{
                     created: length(successful),
                     failed: length(failed),
                     errors: Enum.map(failed, &elem(&1, 1)),
                     students: Enum.map(successful, &elem(&1, 1))
                   }}
              end

            {:ok,
             %{
               class: class,
               students: students_result
             }}

          {:error, error} ->
            {:error, error}
        end
      end)
    end

    read :get_students_in_class do
      description("Get all students in a specific class")

      argument :class_id, :uuid do
        description("The class ID to get students for")
        allow_nil?(false)
      end

      filter(expr(role == :user and class_id == ^arg(:class_id)))
    end
  end

  policies do
    policy always() do
      authorize_if(always())
    end
  end

  multitenancy do
    strategy(:context)
  end

  attributes do
    uuid_primary_key(:id)

    attribute :name, :string do
      allow_nil?(false)
      description("班级名称 (Class Name)")
      public?(true)
    end

    attribute :college, :string do
      allow_nil?(true)
      description("学院 (College) - Optional")
      public?(true)
    end

    attribute :major, :string do
      allow_nil?(true)
      description("专业 (Major) - Optional")
      public?(true)
    end

    create_timestamp(:inserted_at)
    update_timestamp(:updated_at)
  end

  relationships do
    has_many(:users, KgEdu.Accounts.User)

    has_many :students, KgEdu.Accounts.User do
      filter(expr(role == :user))
    end
  end

  identities do
    identity(:unique_class_name, [:name, :college, :major])
  end
end
