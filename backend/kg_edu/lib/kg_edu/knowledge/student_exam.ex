defmodule KgEdu.Knowledge.StudentExam do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger
  import Ash.Query
  import Ash.Changeset

  typescript do
    type_name "StudentExam"
  end

  postgres do
    table "student_exams"
    repo KgEdu.Repo

    references do
      reference :exam, on_delete: :delete
      reference :student, on_delete: :nilify
    end
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "student_exam"
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
                  Enum.each(exam_exercises, fn exam_exercise ->
                    Ash.create(
                      KgEdu.Knowledge.StudentExamAnswer,
                      %{
                        student_exam_id: student_exam.id,
                        exam_exercise_id: exam_exercise.id,
                        exercise_id: exam_exercise.exercise_id,
                        points_earned: 0
                      },
                      tenant: tenant
                    )
                  end)

                  {:ok, student_exam}

                {:error, reason} ->
                  {:error, "Failed to load exam exercises: #{inspect(reason)}"}
              end
            end)

          {:error, reason} ->
            Ash.Changeset.add_error(changeset, :exam_id, "Failed to load exam: #{inspect(reason)}")
        end
      end
    end

    action :continue_or_start_exam do
      description "Continue an in-progress exam or start a new one. Returns the student exam ID on success."

      argument :exam_id, :uuid do
        allow_nil? false
        description "ID of the exam to start or continue"
      end

      argument :student_id, :uuid do
        allow_nil? false
        description "ID of the student"
      end

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
          if tenant, do: Ash.Query.set_context(existing_exam_query, %{tenant: tenant}), else: existing_exam_query

        case Ash.read_one(existing_exam_query, tenant: tenant) do
          {:ok, existing_student_exam} when not is_nil(existing_student_exam) ->
            # Student has an in-progress exam for this exam
            Logger.info("Found existing in-progress exam #{existing_student_exam.id}")
            :ok

          {:ok, nil} ->
            # No in-progress exam for this exam, start a new one
            Logger.info("No in-progress exam found, starting new exam")

            case KgEdu.Knowledge.StudentExam.start_exam(
                   %{exam_id: exam_id, student_id: student_id},
                   tenant: tenant
                 ) do
              {:ok, _new_student_exam} ->
                :ok

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
      get? true

      argument :student_id, :uuid do
        allow_nil? false
        description "ID of the student"
      end

      filter expr(student_id == ^arg(:student_id) and status == :in_progress)

      prepare fn query, _context ->
        query
        |> Ash.Query.load(:exam)
        |> Ash.Query.load(student_exam_answers: [:exam_exercise, :exercise])
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

        # Calculate total score from all answers
        query = Ash.Query.filter(KgEdu.Knowledge.StudentExamAnswer, student_exam_id == ^student_exam_id)

        # Get tenant from context
        tenant = context.tenant
        query = Ash.Query.set_context(query, %{tenant: tenant})

        case Ash.read(query, tenant: tenant) do
          {:ok, answers} ->
            total_score = Enum.reduce(answers, 0, fn ans, acc -> acc + ans.points_earned end)

            # Update student exam with total score and passed status
            case Ash.get(KgEdu.Knowledge.StudentExam, student_exam_id,
                   load: [:exam],
                   tenant: tenant
                 ) do
              {:ok, student_exam} ->
                passing_score = student_exam.exam.passing_score

                # Update student exam with score and status using grade_status action
                student_exam
                |> Ash.Changeset.for_update(:grade_status, %{
                  score: total_score || 0,
                  passed: (total_score || 0) >= passing_score,
                  status: :graded
                })
                |> Ash.update(tenant: tenant)
                |> case do
                  {:ok, _updated_exam} -> :ok
                  {:error, reason} -> {:error, reason}
                end

              {:error, reason} ->
                {:error, reason}
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
end
