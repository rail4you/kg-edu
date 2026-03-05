defmodule KgEdu.Knowledge.StudentExamAnswer do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Logger

  postgres do
    table("student_exam_answers")
    repo(KgEdu.Repo)

    references do
      reference(:student_exam, on_delete: :delete)
      reference(:exam_exercise, on_delete: :delete)
      reference(:exercise, on_delete: :delete)
    end
  end

  json_api do
    type("student_exam_answer")
  end

  typescript do
    type_name("StudentExamAnswer")
  end

  code_interface do
    define(:get_student_exam_answer, action: :by_id)
    define(:list_student_exam_answers, action: :read)
    define(:get_answers_by_student_exam, action: :by_student_exam)
    define(:grade_answer, action: :grade_answer)
  end

  actions do
    defaults([:read, :update, :destroy])

    update :grade do
      description("Update the grade-related fields for a student exam answer")
      accept([:points_earned, :graded, :feedback, :graded_at])
      require_atomic?(false)
    end

    update :update_answer do
      description("Update answer for a student exam answer")
      accept([:answer, :answered_at])
      require_atomic?(false)
    end

    create :create do
      accept([
        :answer,
        :points_earned,
        :graded,
        :feedback,
        :answered_at,
        :graded_at
      ])

      primary?(true)

      argument :student_exam_id, :uuid do
        allow_nil?(false)
      end

      argument :exam_exercise_id, :uuid do
        allow_nil?(false)
      end

      argument :exercise_id, :uuid do
        allow_nil?(false)
      end

      change(fn changeset, _context ->
        student_exam_id = Ash.Changeset.get_argument(changeset, :student_exam_id)
        exam_exercise_id = Ash.Changeset.get_argument(changeset, :exam_exercise_id)
        exercise_id = Ash.Changeset.get_argument(changeset, :exercise_id)

        changeset
        |> Ash.Changeset.change_attribute(:student_exam_id, student_exam_id)
        |> Ash.Changeset.change_attribute(:exam_exercise_id, exam_exercise_id)
        |> Ash.Changeset.change_attribute(:exercise_id, exercise_id)
      end)
    end

    read :by_id do
      description("Get a student exam answer by ID")
      get?(true)
      argument(:id, :uuid, allow_nil?: false)
      filter(expr(id == ^arg(:id)))
    end

    read :by_student_exam do
      description("Get all answers for a specific student exam")
      argument(:student_exam_id, :uuid, allow_nil?: false)
      filter(expr(student_exam_id == ^arg(:student_exam_id)))
    end

    read :get_exam_questions do
      description("Get all questions for a student exam with exercise details")
      argument(:student_exam_id, :uuid, allow_nil?: false)

      filter(expr(student_exam_id == ^arg(:student_exam_id)))

      prepare(fn query, _context ->
        query
        |> Ash.Query.load(:exam_exercise)
        |> Ash.Query.load(:exercise)
      end)
    end

    action :grade_answer do
      description("Grade a student's answer and award points")

      argument :student_exam_answer_id, :uuid do
        allow_nil?(false)
        description("ID of the student exam answer to grade")
      end

      argument :awarded_points, :integer do
        allow_nil?(true)
        description("Points awarded for this answer (optional, auto-calculated if not provided)")
      end

      argument :feedback, :string do
        allow_nil?(true)
        description("Feedback for the student's answer")
      end

      run(fn input, _context ->
        student_exam_answer_id = input.arguments.student_exam_answer_id
        awarded_points = input.arguments.awarded_points
        feedback = Map.get(input.arguments, :feedback)
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
                # Normalize strings by trimming whitespace and converting to lowercase for comparison
                student_answer =
                  (answer_record.answer || "") |> String.trim() |> String.downcase()

                correct_answer =
                  (answer_record.exercise.answer || "") |> String.trim() |> String.downcase()

                if student_answer == correct_answer do
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
                   answer_record,
                   update_attrs,
                   action: :grade,
                   tenant: tenant
                 ) do
              {:ok, _updated_record} -> :ok
              {:error, reason} -> {:error, reason}
            end

          {:error, reason} ->
            {:error, reason}
        end
      end)
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

    attribute :answer, :string do
      allow_nil?(true)
      description("The student's answer to the exercise")
      public?(true)
    end

    attribute :points_earned, :integer do
      allow_nil?(false)
      default(0)
      description("Points earned for this answer")
      public?(true)
    end

    attribute :graded, :boolean do
      allow_nil?(false)
      default(false)
      description("Whether this answer has been graded")
      public?(true)
    end

    attribute :feedback, :string do
      allow_nil?(true)
      description("Feedback from the grader")
      public?(true)
    end

    attribute :answered_at, :utc_datetime do
      allow_nil?(true)
      description("When the student submitted this answer")
      public?(true)
    end

    attribute :graded_at, :utc_datetime do
      allow_nil?(true)
      description("When this answer was graded")
      public?(true)
    end

    timestamps()
  end

  relationships do
    belongs_to :student_exam, KgEdu.Knowledge.StudentExam do
      public?(true)
      allow_nil?(false)
      description("The student exam this answer belongs to")
    end

    belongs_to :exam_exercise, KgEdu.Knowledge.ExamExercise do
      public?(true)
      allow_nil?(false)
      description("The exam exercise being answered")
    end

    belongs_to :exercise, KgEdu.Knowledge.Exercise do
      public?(true)
      allow_nil?(false)
      description("The exercise being answered")
    end
  end
end
