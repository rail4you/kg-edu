defmodule KgEdu.Knowledge.Exam do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger
  import Ash.Query

  typescript do
    type_name "Exam"
  end

  postgres do
    table "exams"
    repo KgEdu.Repo

    references do
      reference :course, on_delete: :delete
      reference :created_by, on_delete: :nilify
    end
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "exam"
  end

  code_interface do
    define :get_exam, action: :by_id
    define :list_exams, action: :read
    define :get_exams_by_course, action: :by_course
    define :get_exams_by_creator, action: :by_creator
    define :create_exam, action: :create
    define :update_exam, action: :update
    define :delete_exam, action: :destroy
    define :add_exercise_to_exam, action: :add_exercise
    define :remove_exercise_from_exam, action: :remove_exercise
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
        query = filter(KgEdu.Knowledge.ExamExercise, exam_id: exam_id, exercise_id: exercise_id)

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
  end

  policies do
    policy always() do
      authorize_if always()
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
end
