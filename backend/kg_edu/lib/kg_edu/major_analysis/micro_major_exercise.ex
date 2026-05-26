defmodule KgEdu.MajorAnalysis.MicroMajorExercise do
  @moduledoc """
  微专业课程习题。

  数据结构与智慧课程的 Exercise 一致，但数据独立，只关联微专业课程。
  支持从智慧课程习题导入（保留 source_exercise_id 用于追踪来源）。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_exercises"
    repo KgEdu.Repo

    references do
      reference :micro_major_course, on_delete: :delete
      reference :micro_major_chapter, on_delete: :nilify
    end
  end

  json_api do
    type "micro_major_exercise"
  end

  typescript do
    type_name "MicroMajorExercise"
  end

  code_interface do
    define :create_exercise, action: :create
    define :update_exercise, action: :update
    define :delete_exercise, action: :destroy
    define :get_exercise, action: :by_id
    define :list_exercises, action: :read
    define :list_exercises_by_course, action: :by_course
    define :list_exercises_by_chapter, action: :by_chapter
    define :import_from_course, action: :import_from_course
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get an exercise by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_course do
      description "Get exercises for a micro major course"
      argument :micro_major_course_id, :uuid, allow_nil?: false
      filter expr(micro_major_course_id == ^arg(:micro_major_course_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, inserted_at: :asc)
      end
    end

    read :by_chapter do
      description "Get exercises for a specific chapter"
      argument :micro_major_chapter_id, :uuid, allow_nil?: false
      filter expr(micro_major_chapter_id == ^arg(:micro_major_chapter_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, position: :asc, inserted_at: :asc)
      end
    end

    create :create do
      description "Create a new micro major exercise"

      accept [
        :micro_major_course_id,
        :micro_major_chapter_id,
        :title,
        :question_content,
        :answer,
        :question_type,
        :options,
        :difficulty,
        :position,
        :answer_explanation,
        :source_exercise_id
      ]
    end

    update :update do
      description "Update a micro major exercise"

      accept [
        :title,
        :question_content,
        :answer,
        :question_type,
        :options,
        :difficulty,
        :position,
        :answer_explanation,
        :micro_major_chapter_id
      ]

      require_atomic? false
    end

    action :import_from_course, :map do
      description "Import exercises from a smart course into a micro major course"

      argument :micro_major_course_id, :uuid do
        allow_nil? false
        description "Target micro major course ID"
      end

      argument :exercise_ids, {:array, :uuid} do
        allow_nil? false
        description "Source exercise IDs from smart course to import"
      end

      run fn input, context ->
        tenant = context.tenant
        mm_course_id = input.arguments.micro_major_course_id
        exercise_ids = input.arguments.exercise_ids

        # Get source exercises from smart course
        source_exercises =
          KgEdu.Knowledge.Exercise
          |> Ash.Query.filter(id in ^exercise_ids)
          |> Ash.read!(tenant: tenant, authorize?: false)

        # Create copies in micro major exercise table
        records =
          Enum.map(source_exercises, fn se ->
            %{
              micro_major_course_id: mm_course_id,
              title: se.title,
              question_content: se.question_content,
              answer: se.answer,
              question_type: se.question_type,
              options: se.options,
              difficulty: se.difficulty,
              position: se.position,
              answer_explanation: se.answer_explanation,
              source_exercise_id: se.id
            }
          end)

        case Ash.bulk_create(records, __MODULE__, :create,
               return_records?: true,
               tenant: tenant,
               authorize?: false
             ) do
          %Ash.BulkResult{records: records, errors: []} ->
            {:ok, %{count: length(records), records: records}}

          %Ash.BulkResult{errors: [error | _]} ->
            {:error, error}
        end
      end
    end
  end

  policies do
    policy always() do
      description "Allow all users full access"
      authorize_if always()
    end
  end

  multitenancy do
    strategy :context
  end

  attributes do
    uuid_primary_key :id do
      public? true
    end

    attribute :title, :string do
      allow_nil? false
      constraints min_length: 1, max_length: 200
      public? true
      description "习题标题"
    end

    attribute :question_content, :string do
      allow_nil? false
      public? true
      description "题目内容"
    end

    attribute :answer, :string do
      allow_nil? true
      public? true
      description "答案"
    end

    attribute :question_type, :atom do
      allow_nil? false
      constraints one_of: [
        :multiple_choice,
        :essay,
        :fill_in_blank,
        :true_false,
        :multiple_response,
        :term_definition,
        :case_study
      ]
      public? true
      description "题目类型"
    end

    attribute :options, :map do
      allow_nil? true
      public? true
      description "选择题选项（choices 数组 + correctAnswer/correctAnswers）"
    end

    attribute :difficulty, :integer do
      allow_nil? true
      constraints min: 1, max: 3
      public? true
      description "难度: 1(简单), 2(中等), 3(困难)"
    end

    attribute :position, :integer do
      allow_nil? true
      public? true
      description "排序位置"
    end

    attribute :answer_explanation, :string do
      allow_nil? true
      constraints max_length: 10000
      public? true
      description "答案解析"
    end

    attribute :source_exercise_id, :uuid do
      allow_nil? true
      public? true
      description "导入来源习题ID（智慧课程习题ID）"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :micro_major_course, KgEdu.MajorAnalysis.MicroMajorCourse do
      public? true
      allow_nil? false
      description "所属微专业课程"
    end

    belongs_to :micro_major_chapter, KgEdu.MajorAnalysis.MicroMajorChapter do
      public? true
      allow_nil? true
      description "所属章节（可选）"
    end
  end
end
