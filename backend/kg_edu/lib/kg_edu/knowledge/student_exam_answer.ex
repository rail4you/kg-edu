defmodule KgEdu.Knowledge.StudentExamAnswer do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  typescript do
    type_name "StudentExamAnswer"
  end

  postgres do
    table "student_exam_answers"
    repo KgEdu.Repo

    references do
      reference :student_exam, on_delete: :delete
      reference :exam_exercise, on_delete: :delete
      reference :exercise, on_delete: :delete
    end
  end

  multitenancy do
    strategy :context
  end

  json_api do
    type "student_exam_answer"
  end

  code_interface do
    define :get_student_exam_answer, action: :by_id
    define :list_student_exam_answers, action: :read
    define :get_answers_by_student_exam, action: :by_student_exam
    define :submit_answer, action: :submit_answer
    define :grade_answer, action: :grade_answer
  end

  actions do
    defaults [:read, :create, :update, :destroy]

    read :by_id do
      description "Get a student exam answer by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_student_exam do
      description "Get all answers for a specific student exam"
      argument :student_exam_id, :uuid, allow_nil?: false
      filter expr(student_exam_id == ^arg(:student_exam_id))
    end

    update :submit_answer do
      description "Submit an answer for an exercise"

      accept [:answer]

      change fn changeset, _context ->
        answer = changeset.arguments[:answer]

        changeset
        |> Ash.Changeset.change_attribute(:answer, answer)
        |> Ash.Changeset.change_attribute(:answered_at, DateTime.utc_now())
      end
    end

    action :grade_answer do
      description "Grade a student's answer and award points"

      argument :student_exam_answer_id, :uuid do
        allow_nil? false
        description "ID of the student exam answer to grade"
      end

      argument :awarded_points, :integer do
        allow_nil? true
        description "Points awarded for this answer (optional, auto-calculated if not provided)"
      end

      argument :feedback, :string do
        allow_nil? true
        description "Feedback for the student's answer"
      end

      run fn input, _context ->
        student_exam_answer_id = input.arguments.student_exam_answer_id
        awarded_points = input.arguments.awarded_points
        feedback = input.arguments.feedback
        tenant = input.context.tenant

        case Ash.get(
               KgEdu.Knowledge.StudentExamAnswer,
               student_exam_answer_id,
               load: [:exam_exercise, :exercise],
               tenant: tenant
             ) do
          {:ok, answer_record} ->
            # If no points provided, auto-calculate based on correct/incorrect
            points_to_award =
              if is_nil(awarded_points) do
                # Auto-grade: check if answer is correct
                if answer_record.answer == answer_record.exercise.answer do
                  answer_record.exam_exercise.points
                else
                  0
                end
              else
                awarded_points
              end

            update_attrs = %{
              points_earned: points_to_award,
              graded: true,
              graded_at: DateTime.utc_now()
            }

            update_attrs =
              if feedback do
                Map.put(update_attrs, :feedback, feedback)
              else
                update_attrs
              end

            case Ash.update(
                   KgEdu.Knowledge.StudentExamAnswer,
                   answer_record,
                   update_attrs,
                   tenant: tenant
                 ) do
              {:ok, updated} -> {:ok, updated}
              {:error, reason} -> {:error, reason}
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

    attribute :answer, :string do
      allow_nil? true
      description "The student's answer to the exercise"
      public? true
    end

    attribute :points_earned, :integer do
      allow_nil? false
      default 0
      description "Points earned for this answer"
      public? true
    end

    attribute :graded, :boolean do
      allow_nil? false
      default false
      description "Whether this answer has been graded"
      public? true
    end

    attribute :feedback, :string do
      allow_nil? true
      description "Feedback from the grader"
      public? true
    end

    attribute :answered_at, :utc_datetime do
      allow_nil? true
      description "When the student submitted this answer"
      public? true
    end

    attribute :graded_at, :utc_datetime do
      allow_nil? true
      description "When this answer was graded"
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :student_exam, KgEdu.Knowledge.StudentExam do
      public? true
      allow_nil? false
      description "The student exam this answer belongs to"
    end

    belongs_to :exam_exercise, KgEdu.Knowledge.ExamExercise do
      public? true
      allow_nil? false
      description "The exam exercise being answered"
    end

    belongs_to :exercise, KgEdu.Knowledge.Exercise do
      public? true
      allow_nil? false
      description "The exercise being answered"
    end
  end
end
