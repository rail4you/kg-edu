defmodule KgEdu.MajorAnalysis.MicroMajorHomeworkSubmission do
  @moduledoc """
  微专业作业提交与评分记录。

  记录学生的作业提交内容，以及教师的评分和评语。
  支持多次提交（覆盖更新），最终只有最新提交有效。
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.MajorAnalysis,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query

  postgres do
    table "micro_major_homework_submissions"
    repo KgEdu.Repo

    references do
      reference :micro_major_homework, on_delete: :delete
    end
  end

  json_api do
    type "micro_major_homework_submission"
  end

  typescript do
    type_name "MicroMajorHomeworkSubmission"
  end

  code_interface do
    define :submit_homework, action: :submit
    define :grade_homework, action: :grade
    define :get_submission, action: :by_id
    define :list_submissions, action: :read
    define :list_submissions_by_homework, action: :by_homework
    define :list_submissions_by_student, action: :by_student
    define :list_submissions_by_course, action: :by_course
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a submission by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:micro_major_homework, :student])
      end
    end

    read :by_homework do
      description "Get submissions for a specific homework"
      argument :micro_major_homework_id, :uuid, allow_nil?: false
      filter expr(micro_major_homework_id == ^arg(:micro_major_homework_id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:student])
        |> Ash.Query.sort(inserted_at: :desc)
      end
    end

    read :by_student do
      description "Get submissions by a specific student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))

      prepare fn query, _context ->
        Ash.Query.load(query, [:micro_major_homework])
        |> Ash.Query.sort(inserted_at: :desc)
      end
    end

    action :by_course, :map do
      description "Get all submissions for a micro major course (for teacher review)"

      argument :micro_major_course_id, :uuid do
        allow_nil? false
        description "The micro major course ID"
      end

      run fn input, context ->
        tenant = context.tenant
        course_id = input.arguments.micro_major_course_id

        # Get all homeworks for this course
        homeworks =
          KgEdu.MajorAnalysis.MicroMajorHomework
          |> Ash.Query.filter(micro_major_course_id == ^course_id)
          |> Ash.read!(tenant: tenant, authorize?: false)

        homework_ids = Enum.map(homeworks, & &1.id)

        if homework_ids == [] do
          {:ok, []}
        else
          KgEdu.MajorAnalysis.MicroMajorHomeworkSubmission
          |> Ash.Query.filter(micro_major_homework_id in ^homework_ids)
          |> Ash.Query.load([:micro_major_homework, :student])
          |> Ash.Query.sort(inserted_at: :desc)
          |> Ash.read(tenant: tenant, authorize?: false)
        end
      end
    end

    create :submit do
      description "Student submits homework (upserts: replaces previous submission)"

      accept [:submission_content]

      argument :micro_major_homework_id, :uuid do
        allow_nil? false
        description "The homework being submitted"
      end

      argument :student_id, :uuid do
        allow_nil? false
        description "The student submitting the homework"
      end

      change set_attribute(:status, :submitted)
      change set_attribute(:micro_major_homework_id, arg(:micro_major_homework_id))
      change set_attribute(:student_id, arg(:student_id))

      # Remove any existing submission by the same student for the same homework
      change fn changeset, context ->
        homework_id = Ash.Changeset.get_argument(changeset, :micro_major_homework_id)
        student_id = Ash.Changeset.get_argument(changeset, :student_id)
        tenant = context.tenant

        existing =
          __MODULE__
          |> Ash.Query.filter(
            micro_major_homework_id == ^homework_id and
            student_id == ^student_id
          )
          |> Ash.read(tenant: tenant, authorize?: false)

        case existing do
          {:ok, [prev | _]} ->
            Ash.destroy!(prev, tenant: tenant, authorize?: false)
            changeset

          _ ->
            changeset
        end
      end
    end

    update :grade do
      description "Teacher grades a homework submission"

      require_atomic? false

      argument :score, :decimal do
        allow_nil? false
        description "Score awarded by the teacher"
      end

      argument :teacher_comment, :string do
        allow_nil? true
        description "Teacher's comment on the submission"
      end

      argument :teacher_id, :uuid do
        allow_nil? false
        description "The teacher who graded the submission"
      end

      change set_attribute(:status, :graded)
      change set_attribute(:teacher_id, arg(:teacher_id))
      change set_attribute(:score, arg(:score))
      change set_attribute(:teacher_comment, arg(:teacher_comment))

      # Validate score does not exceed homework's max score
      validate fn changeset, _context ->
        score = Ash.Changeset.get_attribute(changeset, :score)
        submission_id = Ash.Changeset.get_attribute(changeset, :id) || changeset.data.id

        submission =
          if submission_id do
            Ash.get!(__MODULE__, submission_id,
              load: [:micro_major_homework],
              tenant: changeset.tenant,
              authorize?: false
            )
          end

        max_score =
          case submission do
            %{micro_major_homework: %{score: ms}} when not is_nil(ms) -> Decimal.to_integer(ms)
            _ -> nil
          end

        if score && max_score && Decimal.compare(score, Decimal.new(max_score)) == :gt do
          {:error, [field: :score, message: "评分不能超过满分 #{max_score}分"]}
        else
          :ok
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

    attribute :submission_content, :string do
      allow_nil? false
      public? true
      description "学生提交的作业内容"
    end

    attribute :score, :decimal do
      allow_nil? true
      public? true
      description "教师评分"
    end

    attribute :teacher_comment, :string do
      allow_nil? true
      constraints max_length: 2000
      public? true
      description "教师评语"
    end

    attribute :status, :atom do
      allow_nil? false
      default :submitted
      constraints one_of: [:submitted, :graded]
      public? true
      description "提交状态: submitted(已提交), graded(已评分)"
    end

    create_timestamp :inserted_at do
      public? true
    end

    update_timestamp :updated_at do
      public? true
    end
  end

  relationships do
    belongs_to :micro_major_homework, KgEdu.MajorAnalysis.MicroMajorHomework do
      public? true
      allow_nil? false
      description "提交的作业"
    end

    belongs_to :student, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "提交作业的学生"
    end

    belongs_to :teacher, KgEdu.Accounts.User do
      public? true
      allow_nil? true
      description "评分的教师"
    end
  end
end
