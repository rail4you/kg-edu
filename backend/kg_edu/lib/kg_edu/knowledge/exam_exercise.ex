defmodule KgEdu.Knowledge.ExamExercise do
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  postgres do
    table "exam_exercises"
    repo KgEdu.Repo

    references do
      reference :exam, on_delete: :delete
      reference :exercise, on_delete: :delete
    end
  end

  json_api do
    type "exam_exercise"
  end

  typescript do
    type_name "ExamExercise"
  end

  code_interface do
    define :get_exam_exercise, action: :by_id
    define :list_exam_exercises, action: :read
    define :get_exercises_by_exam, action: :by_exam
    define :create_exam_exercise, action: :create
    define :update_exam_exercise, action: :update
    define :delete_exam_exercise, action: :destroy
  end

  actions do
    defaults [:read, :update, :destroy]

    create :create do
      accept [:points, :order]
      primary? true

      argument :exam, :uuid do
        allow_nil? false
      end

      argument :exercise, :uuid do
        allow_nil? false
      end

      # Use a custom change to set the foreign keys directly
      change fn changeset, _context ->
        exam_id = Ash.Changeset.get_argument(changeset, :exam)
        exercise_id = Ash.Changeset.get_argument(changeset, :exercise)

        changeset
        |> Ash.Changeset.change_attribute(:exam_id, exam_id)
        |> Ash.Changeset.change_attribute(:exercise_id, exercise_id)
      end
    end

    read :by_id do
      description "Get an exam exercise by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_exam do
      description "Get all exercises for a specific exam"
      argument :exam_id, :uuid, allow_nil?: false
      filter expr(exam_id == ^arg(:exam_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, order: :asc)
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

    attribute :points, :integer do
      allow_nil? false
      default 1
      description "Points this exercise is worth in the exam"
      public? true
    end

    attribute :order, :integer do
      allow_nil? true
      description "Order of this exercise in the exam"
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :exam, KgEdu.Knowledge.Exam do
      public? true
      allow_nil? false
      description "The exam this exercise belongs to"
    end

    belongs_to :exercise, KgEdu.Knowledge.Exercise do
      public? true
      allow_nil? false
      description "The exercise in the exam"
    end
  end
end
