defmodule KgEdu.Knowledge.StudentExam do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger
  import Ash.Query

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
    define :submit_exam, action: :submit_exam
    define :grade_exam, action: :grade_exam
  end

  actions do
    defaults [:read, :destroy]

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
      description "Start an exam for a student"

      accept [:exam_id, :student_id]

      change fn changeset, context ->
        exam_id = changeset.arguments[:exam_id]
        student_id = changeset.arguments[:student_id]
        tenant = context.tenant

        # Get the exam to set initial values
        case Ash.get(KgEdu.Knowledge.Exam, exam_id, tenant: tenant) do
          {:ok, exam} ->
            changeset
            |> Ash.Changeset.change_attribute(:status, :in_progress)
            |> Ash.Changeset.change_attribute(:score, 0)
            |> Ash.Changeset.change_attribute(:started_at, DateTime.utc_now())
            |> Ash.Changeset.after_action(fn _changeset, student_exam ->
              # Create empty answers for all exercises in the exam
              query = filter(KgEdu.Knowledge.ExamExercise, exam_id: exam_id)
              query = if tenant, do: Ash.Query.set_context(query, %{tenant: tenant}), else: query

              case Ash.read(
                     query,
                     load: [:exercise]
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
              end
            end)

          {:error, reason} ->
            Ash.Changeset.add_error(changeset, :exam, "Failed to load exam: #{inspect(reason)}")
        end
      end
    end

    update :submit_exam do
      description "Submit a completed exam"

      accept []

      change fn changeset, _context ->
        changeset
        |> Ash.Changeset.change_attribute(:status, :submitted)
        |> Ash.Changeset.change_attribute(:submitted_at, DateTime.utc_now())
      end
    end

    action :grade_exam do
      description "Grade a student exam by calculating total score from answers"

      argument :student_exam_id, :uuid do
        allow_nil? false
        description "ID of the student exam to grade"
      end

      run fn input, _context ->
        student_exam_id = input.arguments.student_exam_id

        # Calculate total score from all answers
        query = filter(KgEdu.Knowledge.StudentExamAnswer, student_exam_id: student_exam_id)

        # Get tenant from context
        tenant = input.context.tenant
        query = if tenant, do: Ash.Query.set_context(query, %{tenant: tenant}), else: query

        case Ash.read(query) do
          {:ok, answers} ->
            total_score = Enum.reduce(answers, 0, fn ans, acc -> acc + ans.points_earned end)

            # Update student exam with total score and passed status
            case Ash.get(KgEdu.Knowledge.StudentExam, student_exam_id,
                   load: [:exam],
                   tenant: tenant
                 ) do
              {:ok, student_exam} ->
                passing_score = student_exam.exam.passing_score

                update_attrs = %{
                  score: total_score || 0,
                  passed: (total_score || 0) >= passing_score,
                  status: :graded
                }

                case Ash.update(
                       KgEdu.Knowledge.StudentExam,
                       student_exam,
                       update_attrs,
                       tenant: tenant
                     ) do
                  {:ok, updated_exam} -> {:ok, updated_exam}
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
