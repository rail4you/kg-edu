defmodule KgEdu.Knowledge.StudentExam do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger
  import Ash.Query


  postgres do
    table "student_exams"
    repo KgEdu.Repo

    references do
      reference :exam, on_delete: :delete
      reference :student, on_delete: :nilify
    end
  end

  json_api do
    type "student_exam"
  end

  typescript do
    type_name "StudentExam"
  end

  code_interface do
    define :get_student_exam, action: :by_id
    define :list_student_exams, action: :read
    define :get_student_exams_by_exam, action: :by_exam
    define :get_student_exams_by_student, action: :by_student
    define :get_student_exam_for_student, action: :for_student
    define :start_exam, action: :start_exam
    define :continue_or_start_exam, action: :continue_or_start_exam
    define :get_in_progress_exam, action: :get_in_progress_exam
    define :submit_exam, action: :submit_exam
    define :grade_exam, action: :grade_exam
  end

  actions do
    defaults [:read, :update, :destroy]

    update :submit_status do
      description "Update student exam status to submitted"
      accept [:status, :submitted_at]
    end

    update :grade_status do
      description "Update student exam score and passed status"
      accept [:score, :passed, :status]
      require_atomic? false
    end

    read :by_id do
      description "Get a student exam by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_exam do
      description "Get all student exams for a specific exam"
      argument :exam_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id))
    end

    read :by_student do
      description "Get all exams for a specific student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))
    end

    read :for_student do
      description "Get a specific exam for a specific student"
      argument :exam_id, :uuid, allow_nil?: false
      argument :student_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id) and student_id == ^arg(:student_id))
      get? true
    end

    create :start_exam do
      description "Start an exam for a student."

      accept [:exam_id, :student_id]

      change fn changeset, context ->
        exam_id = Ash.Changeset.get_attribute(changeset, :exam_id)
        tenant = context.tenant

        # Load the exam to verify it exists
        case Ash.get(KgEdu.Knowledge.Exam, exam_id, tenant: tenant) do
          {:ok, _exam} ->
            changeset
            |> Ash.Changeset.change_attribute(:status, :in_progress)
            |> Ash.Changeset.change_attribute(:score, 0)
            |> Ash.Changeset.change_attribute(:started_at, DateTime.utc_now())
            |> Ash.Changeset.after_action(fn _changeset, student_exam ->
              # Create empty answers for all exercises in the exam
              query = Ash.Query.filter(KgEdu.Knowledge.ExamExercise, exam_id == ^exam_id)
              query = if tenant, do: Ash.Query.set_context(query, %{tenant: tenant}), else: query

              case Ash.read(
                     query,
                     load: [:exercise],
                     tenant: tenant
                   ) do
                {:ok, exam_exercises} ->
                  results =
                    Enum.reduce_while(exam_exercises, [], fn exam_exercise, acc ->
                      case Ash.create(
                             KgEdu.Knowledge.StudentExamAnswer,
                             %{
                               student_exam_id: student_exam.id,
                               exam_exercise_id: exam_exercise.id,
                               exercise_id: exam_exercise.exercise_id,
                               points_earned: 0
                             },
                             tenant: tenant
                           ) do
                        {:ok, _answer} -> {:cont, acc}
                        {:error, reason} -> {:halt, {:error, reason}}
                      end
                    end)

                  case results do
                    {:error, _reason} ->
                      {:error, "Failed to create some exam answers"}

                    _ ->
                      {:ok, student_exam}
                  end

                {:error, reason} ->
                  {:error, "Failed to load exam exercises: #{inspect(reason)}"}
              end
            end)

          {:error, reason} ->
            Ash.Changeset.add_error(
              changeset,
              :exam_id,
              "Failed to load exam: #{inspect(reason)}"
            )
        end
      end
    end

    action :continue_or_start_exam do
      description "Continue an in-progress exam or start a new one. Returns the student exam record on success."

      argument :exam_id, :uuid do
        allow_nil? false
        description "ID of the exam to start or continue"
      end

      argument :student_id, :uuid do
        allow_nil? false
        description "ID of the student"
      end

      returns :struct

      run fn input, context ->
        exam_id = input.arguments.exam_id
        student_id = input.arguments.student_id
        tenant = context.tenant

        # Check if student has an in-progress exam for this specific exam
        existing_exam_query =
          Ash.Query.filter(
            KgEdu.Knowledge.StudentExam,
            student_id == ^student_id and exam_id == ^exam_id and status == :in_progress
          )

        existing_exam_query =
          if tenant,
            do: Ash.Query.set_context(existing_exam_query, %{tenant: tenant}),
            else: existing_exam_query

        case Ash.read_one(existing_exam_query, tenant: tenant) do
          {:ok, existing_student_exam} when not is_nil(existing_student_exam) ->
            # Student has an in-progress exam for this exam
            # Check if answers exist, create them if not
            case ensure_exam_answers(existing_student_exam, exam_id, tenant) do
              :ok ->
                {:ok,
                 %{
                   id: existing_student_exam.id,
                   exam_id: existing_student_exam.exam_id,
                   student_id: existing_student_exam.student_id,
                   status: existing_student_exam.status,
                   started_at: existing_student_exam.started_at
                 }}

              {:error, reason} ->
                {:error, "Failed to ensure exam answers: #{inspect(reason)}"}
            end

          {:ok, nil} ->
            # No in-progress exam for this exam, start a new one
            Logger.info("No in-progress exam found, starting new exam")

            case KgEdu.Knowledge.StudentExam.start_exam(
                   %{exam_id: exam_id, student_id: student_id},
                   tenant: tenant
                 ) do
              {:ok, new_student_exam} ->
                # Return just the essential fields as a map
                {:ok,
                 %{
                   id: new_student_exam.id,
                   exam_id: new_student_exam.exam_id,
                   student_id: new_student_exam.student_id,
                   status: new_student_exam.status,
                   started_at: new_student_exam.started_at
                 }}

              {:error, reason} ->
                {:error, "Failed to start exam: #{inspect(reason)}"}
            end

          {:error, reason} ->
            {:error, "Failed to check for existing exam: #{inspect(reason)}"}
        end
      end
    end

    read :get_in_progress_exam do
      description "Get the student's in-progress exam with all answers"

      argument :student_id, :uuid do
        allow_nil? false
        description "ID of the student"
      end

      argument :exam_id, :uuid do
        allow_nil? true

        description "Optional exam ID to filter by. If not provided and multiple exams exist, the first one is returned."
      end

      # Use prepare to handle optional exam_id filter and load relationships
      prepare fn query, _context ->
        student_id = Ash.Query.get_argument(query, :student_id)
        exam_id = Ash.Query.get_argument(query, :exam_id)

        query
        |> Ash.Query.filter(student_id == ^student_id and status == :in_progress)
        |> Ash.Query.load(:exam)
        |> Ash.Query.load(student_exam_answers: [:exam_exercise, :exercise])
        |> then(fn q ->
          # Only filter by exam_id if it's provided (not nil)
          if exam_id do
            Ash.Query.filter(q, exam_id == ^exam_id)
          else
            q
          end
        end)
        |> Ash.Query.limit(1)
      end
    end

    action :submit_exam do
      description "Submit a completed exam with all answers at once"

      argument :student_exam_id, :uuid do
        allow_nil? false
        description "ID of the student exam to submit"
      end

      argument :answers, :map do
        allow_nil? false
        description "Map of student_exam_answer_id to answer value"
      end

      run fn input, context ->
        student_exam_id = input.arguments.student_exam_id
        answers_map = input.arguments.answers
        tenant = context.tenant

        Logger.info("submit_exam called with student_exam_id: #{student_exam_id}")
        Logger.info("Answers count: #{map_size(answers_map)}")

        # Get the student exam to verify it exists and is in progress
        case Ash.get(KgEdu.Knowledge.StudentExam, student_exam_id, tenant: tenant) do
          {:ok, student_exam} ->
            # Verify exam is in progress
            if student_exam.status != :in_progress do
              {:error, "Exam is not in progress, current status: #{student_exam.status}"}
            else
              # Update all answers
              answers_result =
                Enum.reduce_while(answers_map, [], fn {answer_id, answer_value}, acc ->
                  Logger.info("Updating answer #{answer_id} with value: #{answer_value}")

                  case Ash.get(KgEdu.Knowledge.StudentExamAnswer, answer_id, tenant: tenant) do
                    {:ok, answer_record} ->
                      # Verify answer belongs to this student exam
                      if answer_record.student_exam_id != student_exam_id do
                        {:halt,
                         {:error,
                          "Answer #{answer_id} does not belong to student exam #{student_exam_id}"}}
                      else
                        # Update the answer using the update_answer action
                        answer_record
                        |> Ash.Changeset.for_update(:update_answer, %{
                          answer: answer_value,
                          answered_at: DateTime.utc_now()
                        })
                        |> Ash.update(tenant: tenant)
                        |> case do
                          {:ok, updated} -> {:cont, [updated | acc]}
                          {:error, reason} -> {:halt, {:error, reason}}
                        end
                      end

                    {:error, reason} ->
                      {:halt, {:error, reason}}
                  end
                end)

              case answers_result do
                {:error, reason} ->
                  {:error, "Failed to update some answers: #{inspect(reason)}"}

                _updated_answers ->
                  Logger.info("All answers updated successfully, submitting exam")

                  # Update student exam status to submitted using submit_status action
                  student_exam
                  |> Ash.Changeset.for_update(:submit_status, %{
                    status: :submitted,
                    submitted_at: DateTime.utc_now()
                  })
                  |> Ash.update(tenant: tenant)
                  |> case do
                    {:ok, _updated_exam} ->
                      Logger.info("Exam submitted successfully")
                      :ok

                    {:error, reason} ->
                      Logger.error("Failed to submit exam: #{inspect(reason)}")
                      {:error, "Failed to submit exam: #{inspect(reason)}"}
                  end
              end
            end

          {:error, reason} ->
            {:error, "Failed to load student exam: #{inspect(reason)}"}
        end
      end
    end

    action :grade_exam do
      description "Grade a student exam by calculating total score from answers"

      argument :student_exam_id, :uuid do
        allow_nil? false
        description "ID of the student exam to grade"
      end

      run fn input, context ->
        student_exam_id = input.arguments.student_exam_id

        # Get tenant from context
        tenant = context.tenant

        # Get all answers for this student exam with exercise details
        query =
          Ash.Query.filter(KgEdu.Knowledge.StudentExamAnswer, student_exam_id == ^student_exam_id)

        query = Ash.Query.load(query, [:exam_exercise, :exercise])
        query = Ash.Query.set_context(query, %{tenant: tenant})

        case Ash.read(query, tenant: tenant) do
          {:ok, answers} ->
            # Check if all answers are graded
            ungraded_answers =
              answers
              |> Enum.filter(fn ans -> !ans.graded end)
              |> Enum.map(fn ans ->
                %{
                  answer_id: ans.id,
                  exercise_title: ans.exercise.title,
                  exercise_order: ans.exam_exercise.order
                }
              end)

            if length(ungraded_answers) > 0 do
              # Build error message with ungraded questions info
              ungraded_info =
                ungraded_answers
                |> Enum.sort_by(fn ans -> ans.exercise_order end)
                |> Enum.map(fn ans ->
                  "第#{ans.exercise_order}题: #{ans.exercise_title}"
                end)
                |> Enum.join(", ")

              {:error, "还有题目未批改，请先完成以下题目的批改: #{ungraded_info}"}
            else
              # All answers are graded, calculate total score
              total_score =
                answers
                |> Enum.reduce(Decimal.new(0), fn ans, acc ->
                  Decimal.add(acc, Decimal.new(ans.points_earned))
                end)
                |> Decimal.to_integer()

              # Update student exam with total score and passed status
              case Ash.get(KgEdu.Knowledge.StudentExam, student_exam_id,
                     load: [:exam],
                     tenant: tenant
                   ) do
                {:ok, student_exam} ->
                  passing_score = student_exam.exam.passing_score

                  Logger.info(
                    "Grading exam #{student_exam_id}, total score: #{total_score}, passing score: #{passing_score}"
                  )

                  # Update student exam with score and status using grade_status action
                  student_exam
                  |> Ash.Changeset.for_update(:grade_status, %{
                    score: total_score || 0,
                    passed: (total_score || 0) >= passing_score,
                    status: :graded
                  })
                  |> Ash.update(tenant: tenant)
                  |> case do
                    {:ok, updated_exam} ->
                      Logger.info(
                        "Successfully graded exam #{student_exam_id}, new status: #{updated_exam.status}"
                      )

                      :ok

                    {:error, reason} ->
                      Logger.error("Failed to update exam grade: #{inspect(reason)}")
                      {:error, reason}
                  end

                {:error, reason} ->
                  Logger.error("Failed to get student exam for grading: #{inspect(reason)}")
                  {:error, reason}
              end
            end

          {:error, reason} ->
            {:error, reason}
        end
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

    attribute :exam_id, :uuid do
      allow_nil? false
      description "Foreign key reference to the exam"
      public? true
    end

    attribute :student_id, :uuid do
      allow_nil? false
      description "Foreign key reference to the student"
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      default :in_progress
      constraints one_of: [:in_progress, :submitted, :graded]
      description "Status of the student exam"
      public? true
    end

    attribute :score, :integer do
      allow_nil? false
      default 0
      description "Total score achieved by the student"
      public? true
    end

    attribute :passed, :boolean do
      allow_nil? false
      default false
      description "Whether the student passed the exam"
      public? true
    end

    attribute :started_at, :utc_datetime do
      allow_nil? true
      description "When the student started the exam"
      public? true
    end

    attribute :submitted_at, :utc_datetime do
      allow_nil? true
      description "When the student submitted the exam"
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :exam, KgEdu.Knowledge.Exam do
      public? true
      allow_nil? false
      description "The exam being taken"
    end

    belongs_to :student, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "The student taking the exam"
    end

    has_many :student_exam_answers, KgEdu.Knowledge.StudentExamAnswer do
      public? true
      description "Student's answers for each exercise in the exam"
    end
  end

  # Helper function to ensure exam answers exist for a student exam
  defp ensure_exam_answers(student_exam, exam_id, tenant) do
    # Check if answers already exist
    answer_query =
      Ash.Query.filter(KgEdu.Knowledge.StudentExamAnswer, student_exam_id == ^student_exam.id)

    answer_query =
      if tenant,
        do: Ash.Query.set_context(answer_query, %{tenant: tenant}),
        else: answer_query

    case Ash.read(answer_query, tenant: tenant) do
      {:ok, [_ | _]} ->
        # Answers already exist
        :ok

      {:ok, []} ->
        # No answers exist, create them
        create_exam_answers(student_exam.id, exam_id, tenant)

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Helper function to create exam answers for all exercises
  defp create_exam_answers(student_exam_id, exam_id, tenant) do
    query = Ash.Query.filter(KgEdu.Knowledge.ExamExercise, exam_id == ^exam_id)
    query = if tenant, do: Ash.Query.set_context(query, %{tenant: tenant}), else: query

    case Ash.read(query, load: [:exercise], tenant: tenant) do
      {:ok, [_ | _] = exam_exercises} ->
        results =
          Enum.reduce_while(exam_exercises, [], fn exam_exercise, acc ->
            case Ash.create(
                   KgEdu.Knowledge.StudentExamAnswer,
                   %{
                     student_exam_id: student_exam_id,
                     exam_exercise_id: exam_exercise.id,
                     exercise_id: exam_exercise.exercise_id,
                     points_earned: 0
                   },
                   tenant: tenant
                 ) do
              {:ok, _answer} -> {:cont, acc}
              {:error, reason} -> {:halt, {:error, reason}}
            end
          end)

        case results do
          {:error, _reason} -> {:error, "Failed to create some exam answers"}
          _ -> :ok
        end

      {:ok, []} ->
        # No exercises found for this exam
        :ok

      {:error, reason} ->
        {:error, "Failed to load exam exercises: #{inspect(reason)}"}
    end
  end
end
