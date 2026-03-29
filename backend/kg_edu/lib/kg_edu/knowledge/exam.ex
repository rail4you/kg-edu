defmodule KgEdu.Knowledge.Exam do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger
  import Ash.Query

  postgres do
    table "exams"
    repo KgEdu.Repo

    references do
      reference :course, on_delete: :delete
      reference :created_by, on_delete: :nilify
    end
  end

  json_api do
    type "exam"
  end

  typescript do
    type_name "Exam"
  end

  code_interface do
    define :get_exam, action: :by_id
    define :list_exams, action: :read
    define :get_exams_by_course, action: :by_course
    define :get_exams_by_creator, action: :by_creator
    define :create_exam, action: :create
    define :create_exam_with_exercises, action: :create_with_exercises
    define :get_exam_content, action: :get_exam_content
    define :update_exam, action: :update
    define :delete_exam, action: :destroy
    define :add_exercise_to_exam, action: :add_exercise
    define :remove_exercise_from_exam, action: :remove_exercise
  end

  preparations do
    prepare build(sort: [inserted_at: :desc])
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get an exam by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get exams for a specific course"
      argument :course_id, :uuid, allow_nil?: false
      filter expr(course_id == ^arg(:course_id))
    end

    read :by_creator do
      description "Get exams created by a specific user"
      argument :created_by_id, :uuid, allow_nil?: false
      filter expr(created_by_id == ^arg(:created_by_id))
    end

    create :create do
      description "Create a new exam"

      accept [
        :title,
        :description,
        :exam_type,
        :exam_date,
        :deadline_at,
        :duration_minutes,
        :passing_score,
        :course_id,
        :created_by_id
      ]

      # Calculate total_score automatically based on exercises

      change fn changeset, _context ->
        # Set default duration to 60 minutes if not provided
        Ash.Changeset.change_attribute(
          changeset,
          :duration_minutes,
          Ash.Changeset.get_attribute(changeset, :duration_minutes) || 60
        )
      end
    end

    update :update do
      description "Update an exam"

      accept [
        :title,
        :description,
        :exam_type,
        :exam_date,
        :deadline_at,
        :duration_minutes,
        :passing_score,
        :course_id
      ]

      require_atomic? false
    end

    update :add_exercise do
      description "Add an exercise to the exam"
      require_atomic? false

      argument :exercise_id, :uuid do
        allow_nil? false
        description "The exercise ID to add"
      end

      argument :points, :integer do
        allow_nil? false
        description "Points for this exercise in the exam"
      end

      argument :order, :integer do
        allow_nil? true
        description "Order of this exercise in the exam"
      end

      change fn changeset, context ->
        exam_id = Ash.Changeset.get_attribute(changeset, :id)
        exercise_id = changeset.arguments[:exercise_id]
        points = changeset.arguments[:points]
        order = changeset.arguments[:order]
        tenant = context.tenant

        Logger.info(
          "add_exercise: exam_id=#{inspect(exam_id)}, exercise_id=#{inspect(exercise_id)}, points=#{inspect(points)}, order=#{inspect(order)}, tenant=#{inspect(tenant)}"
        )

        # Validate that exam_id exists
        unless exam_id do
          Ash.Changeset.add_error(
            changeset,
            Ash.Error.Changes.InvalidRequired.exception(
              field: :id,
              value: exam_id,
              message: "Exam ID is required"
            )
          )
        else
          # First, validate that the exercise exists
          exercise_query =
            KgEdu.Knowledge.Exercise
            |> Ash.Query.filter(expr(id == ^exercise_id))

          case Ash.read_one(exercise_query, tenant: tenant) do
            {:ok, nil} ->
              Logger.error("Exercise #{exercise_id} does not exist")

              Ash.Changeset.add_error(
                changeset,
                Ash.Error.Changes.InvalidArgument.exception(
                  field: :exercise_id,
                  value: exercise_id,
                  message: "Exercise does not exist"
                )
              )

            {:ok, _exercise} ->
              Logger.info("Exercise #{exercise_id} exists, checking if already in exam")

              # Check if exercise is already in the exam
              exam_exercise_query =
                KgEdu.Knowledge.ExamExercise
                |> Ash.Query.filter(expr(exam_id == ^exam_id and exercise_id == ^exercise_id))

              case Ash.read_one(exam_exercise_query, tenant: tenant) do
                {:ok, nil} ->
                  # No existing record - create the ExamExercise directly with foreign keys
                  Logger.info("No existing exam_exercise found, creating new record")

                  # Use the arguments that the create action expects
                  create_attrs = %{
                    exam: exam_id,
                    exercise: exercise_id,
                    points: points
                  }

                  # Only add order if it's not nil
                  create_attrs =
                    if order, do: Map.put(create_attrs, :order, order), else: create_attrs

                  case KgEdu.Knowledge.ExamExercise
                       |> Ash.Changeset.for_create(:create, create_attrs)
                       |> Ash.create(tenant: tenant) do
                    {:ok, _exam_exercise} ->
                      Logger.info("Successfully created ExamExercise")
                      changeset

                    {:error, error} ->
                      Logger.error(
                        "Failed to create ExamExercise: #{inspect(error, pretty: true)}"
                      )

                      error_message =
                        case error do
                          %{message: msg} when is_binary(msg) ->
                            msg

                          %{errors: errs} when is_list(errs) ->
                            errs
                            |> Enum.map(fn
                              %{message: msg} -> msg
                              msg when is_binary(msg) -> msg
                              err -> inspect(err, pretty: true)
                            end)
                            |> Enum.join(", ")

                          _ when is_binary(error) ->
                            error

                          _ ->
                            "Failed to add exercise: #{inspect(error, pretty: true)}"
                        end

                      Ash.Changeset.add_error(
                        changeset,
                        Ash.Error.Changes.InvalidChanges.exception(message: error_message)
                      )
                  end

                {:ok, existing} when not is_nil(existing) ->
                  # Exercise already exists in this exam
                  Logger.warning("Exercise #{exercise_id} already exists in exam #{exam_id}")

                  Ash.Changeset.add_error(
                    changeset,
                    Ash.Error.Changes.InvalidArgument.exception(
                      field: :exercise_id,
                      value: exercise_id,
                      message: "Exercise already exists in this exam"
                    )
                  )

                {:error, reason} ->
                  Logger.error("Failed to check if exercise is in exam: #{inspect(reason)}")

                  Ash.Changeset.add_error(
                    changeset,
                    Ash.Error.Changes.InvalidChanges.exception(
                      message: "Failed to check if exercise is in exam: #{inspect(reason)}"
                    )
                  )
              end

            {:error, reason} ->
              Logger.error("Failed to validate exercise existence: #{inspect(reason)}")

              Ash.Changeset.add_error(
                changeset,
                Ash.Error.Changes.InvalidChanges.exception(
                  message: "Failed to validate exercise: #{inspect(reason)}"
                )
              )
          end
        end
      end
    end

    update :remove_exercise do
      description "Remove an exercise from the exam"
      require_atomic? false

      argument :exercise_id, :uuid do
        allow_nil? false
        description "The exercise ID to remove"
      end

      change fn changeset, context ->
        exam_id = Ash.Changeset.get_attribute(changeset, :id)
        exercise_id = changeset.arguments[:exercise_id]

        # Find and delete the ExamExercise join record using Ash.Query
        query = filter KgEdu.Knowledge.ExamExercise, exam_id: exam_id, exercise_id: exercise_id

        # Get tenant from context
        tenant = context.tenant

        case Ash.read_one(query, tenant: tenant) do
          {:ok, exam_exercise} ->
            case Ash.destroy(exam_exercise, tenant: tenant) do
              :ok ->
                changeset

              {:error, error} ->
                error_message =
                  case error do
                    %{message: msg} when is_binary(msg) -> msg
                    _ when is_binary(error) -> error
                    _ -> inspect(error)
                  end

                Ash.Changeset.add_error(
                  changeset,
                  Ash.Error.Changes.InvalidChanges.exception(
                    message: "Failed to remove exercise: #{error_message}"
                  )
                )
            end

          {:error, :not_found} ->
            # Exercise not in exam, that's ok
            changeset

          {:error, error} ->
            error_message =
              case error do
                %{message: msg} when is_binary(msg) -> msg
                _ when is_binary(error) -> error
                _ -> inspect(error)
              end

            Ash.Changeset.add_error(
              changeset,
              Ash.Error.Changes.InvalidChanges.exception(
                message: "Failed to find exercise: #{error_message}"
              )
            )
        end
      end
    end

    # 同步创建考试，包含基本信息和小练习
    create :create_with_exercises do
      description "Create an exam with exercises in one transaction"

      argument :title, :string do
        allow_nil? false
        constraints min_length: 3, max_length: 200
      end

      argument :description, :string do
        allow_nil? true
      end

      argument :exam_type, :atom do
        allow_nil? false
        constraints one_of: [:midterm, :final, :quiz, :assignment]
      end

      argument :exam_date, :utc_datetime do
        allow_nil? true
      end

      argument :deadline_at, :utc_datetime do
        allow_nil? true
      end

      argument :duration_minutes, :integer do
        allow_nil? true
      end

      argument :passing_score, :integer do
        allow_nil? false
      end

      argument :course_id, :uuid do
        allow_nil? true
      end

      argument :created_by_id, :uuid do
        allow_nil? false
      end

      argument :exercises, {:array, :map} do
        allow_nil? true
        description "List of exercises to add, each map should contain: exercise_id, points, order"
      end

      change fn changeset, context ->
        tenant = context.tenant

        # Build exam attributes from arguments
        exam_attrs = %{
          title: Ash.Changeset.get_argument(changeset, :title),
          description: Ash.Changeset.get_argument(changeset, :description),
          exam_type: Ash.Changeset.get_argument(changeset, :exam_type),
          exam_date: Ash.Changeset.get_argument(changeset, :exam_date),
          deadline_at: Ash.Changeset.get_argument(changeset, :deadline_at),
          duration_minutes: Ash.Changeset.get_argument(changeset, :duration_minutes) || 60,
          passing_score: Ash.Changeset.get_argument(changeset, :passing_score),
          course_id: Ash.Changeset.get_argument(changeset, :course_id),
          created_by_id: Ash.Changeset.get_argument(changeset, :created_by_id)
        }

        exercises = Ash.Changeset.get_argument(changeset, :exercises) || []

        # First create the exam
        case Exam
             |> Ash.Changeset.for_create(:create, exam_attrs)
             |> Ash.create(tenant: tenant) do
          {:ok, exam} ->
            Logger.info("Exam created successfully: #{exam.id}")

            # Then add each exercise
            results =
              exercises
              |> Enum.with_index()
              |> Enum.map(fn {exercise_map, index} ->
                exercise_id = Map.get(exercise_map, :exercise_id) || Map.get(exercise_map, "exercise_id")
                points = Map.get(exercise_map, :points) || Map.get(exercise_map, "points") || 1
                order = Map.get(exercise_map, :order) || Map.get(exercise_map, "order") || index + 1

                if exercise_id do
                  case Exam
                       |> Ash.Changeset.for_update(:add_exercise, %{
                         id: exam.id,
                         exercise_id: exercise_id,
                         points: points,
                         order: order
                       })
                       |> Ash.update(tenant: tenant) do
                    {:ok, _} ->
                      {:ok, exercise_id}

                    {:error, error} ->
                      Logger.error("Failed to add exercise #{exercise_id}: #{inspect(error)}")
                      {:error, exercise_id, error}
                  end
                else
                  {:error, nil, "exercise_id is required"}
                end
              end)

            # Check if any errors occurred
            errors = Enum.filter(results, &match?({:error, _, _}, &1))

            if Enum.empty?(errors) do
              # Return the created exam
              {:ok, exam}
            else
              error_messages =
                errors
                |> Enum.map(fn {:error, _id, msg} -> msg end)
                |> Enum.join(", ")

              Ash.Changeset.add_error(
                changeset,
                Ash.Error.Changes.InvalidChanges.exception(
                  message: "Failed to add some exercises: #{error_messages}"
                )
              )
            end

          {:error, error} ->
            Logger.error("Failed to create exam: #{inspect(error)}")

            error_message =
              case error do
                %{message: msg} when is_binary(msg) -> msg
                _ when is_binary(error) -> error
                _ -> inspect(error, pretty: true)
              end

            Ash.Changeset.add_error(
              changeset,
              Ash.Error.Changes.InvalidChanges.exception(
                message: "Failed to create exam: #{error_message}"
              )
            )
        end
      end
    end

    # 读取考试内容，包含关联的 exercises 详情
    read :get_exam_content do
      description "Get exam with its exercise details"
      get? true

      argument :id, :uuid do
        allow_nil? false
      end

      prepare fn query, _context ->
        Ash.Query.load(query, exam_exercises: [:exercise])
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
      constraints min_length: 3, max_length: 200
      description "Title of the exam"
      public? true
    end

    attribute :description, :string do
      allow_nil? true
      constraints max_length: 1000
      description "Description of the exam"
      public? true
    end

    attribute :exam_type, :atom do
      allow_nil? false
      constraints one_of: [:midterm, :final, :quiz, :assignment]
      default :quiz
      description "Type of exam"
      public? true
    end

    attribute :exam_date, :utc_datetime do
      allow_nil? true
      description "Scheduled date and time for the exam"
      public? true
    end

    attribute :deadline_at, :utc_datetime do
      allow_nil? true
      description "Deadline for submitting the exam"
      public? true
    end

    attribute :duration_minutes, :integer do
      allow_nil? false
      default 60
      description "Duration of the exam in minutes"
      public? true
    end

    attribute :passing_score, :integer do
      allow_nil? false
      description "Minimum score required to pass the exam"
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :course, KgEdu.Courses.Course do
      public? true
      allow_nil? true
      description "Course this exam belongs to"
    end

    belongs_to :created_by, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "User who created the exam (exam creator)"
    end

    has_many :exam_exercises, KgEdu.Knowledge.ExamExercise do
      public? true
      description "Exercises included in this exam"
    end

    has_many :student_exams, KgEdu.Knowledge.StudentExam do
      public? true
      description "Student exam records for this exam"
    end
  end

  aggregates do
    count :exercises_count, :exam_exercises do
      public? true
    end

    sum :total_score, :exam_exercises, :points do
      public? true
      description "Total score of the exam (sum of all exercise points)"
    end
  end
end
