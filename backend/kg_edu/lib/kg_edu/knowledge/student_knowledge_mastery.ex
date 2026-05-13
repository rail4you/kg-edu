defmodule KgEdu.Knowledge.StudentKnowledgeMastery do
  @moduledoc """
  记录学生对知识点的掌握程度
  用于追踪学生在每个知识点上的学习进度和掌握情况
  """
  use Ash.Resource,
    otp_app: :kg_edu,
    domain: KgEdu.Knowledge,
    data_layer: AshPostgres.DataLayer,
    authorizers: [Ash.Policy.Authorizer],
    extensions: [AshJsonApi.Resource, AshTypescript.Resource]

  require Ash.Query
  require Logger

  postgres do
    table "student_knowledge_masteries"
    repo KgEdu.Repo

    references do
      reference :student, on_delete: :delete
      reference :knowledge_resource, on_delete: :delete
    end
  end

  json_api do
    type "student_knowledge_mastery"
  end

  typescript do
    type_name "StudentKnowledgeMastery"
  end

  code_interface do
    define :get_mastery, action: :by_id
    define :list_masteries, action: :read
    define :get_student_mastery_for_knowledge, action: :by_student_and_knowledge
    define :get_all_student_masteries, action: :by_student
    define :update_mastery_from_exam, action: :update_from_exam
    define :update_mastery_from_exercise, action: :update_from_exercise
    define :get_weak_knowledge_points, action: :get_weak_points
    define :recalculate_mastery, action: :recalculate_mastery
    define :get_class_weakness, action: :class_weakness
  end

  actions do
    defaults [:read, :destroy]

    read :by_id do
      description "Get a mastery record by ID"
      get? true
      argument :id, :uuid, allow_nil?: false
      filter expr(id == ^arg(:id))
    end

    read :by_student_and_knowledge do
      description "Get a student's mastery for a specific knowledge resource"
      get? true
      argument :student_id, :uuid, allow_nil?: false
      argument :knowledge_resource_id, :uuid, allow_nil?: false

      filter expr(
               student_id == ^arg(:student_id) and
                 knowledge_resource_id == ^arg(:knowledge_resource_id)
             )
    end

    read :by_student do
      description "Get all mastery records for a student"
      argument :student_id, :uuid, allow_nil?: false
      filter expr(student_id == ^arg(:student_id))

      prepare fn query, _context ->
        Ash.Query.sort(query, mastery_level: :asc)
      end
    end

    read :get_weak_points do
      description "Get a student's weak knowledge points (mastery_level below threshold)"
      argument :student_id, :uuid, allow_nil?: false
      argument :threshold, :float, allow_nil?: true, default: 0.6
      argument :course_id, :uuid, allow_nil?: true

      filter expr(
               student_id == ^arg(:student_id) and
                 mastery_level < ^arg(:threshold)
             )

      prepare fn query, _context ->
        course_id = Ash.Query.get_argument(query, :course_id)

        query
        |> Ash.Query.load(:knowledge_resource)
        |> then(fn q ->
          if course_id do
            # Filter by knowledge resources belonging to this course
            Ash.Query.filter(q, knowledge_resource.course_id == ^course_id)
          else
            q
          end
        end)
        |> Ash.Query.sort(mastery_level: :asc)
      end
    end

    read :class_weakness do
      description "Get class-wide weakness analysis for a course (for teachers)"
      argument :course_id, :uuid, allow_nil?: false
      argument :importance_level, :string, allow_nil?: true

      prepare fn query, _context ->
        course_id = Ash.Query.get_argument(query, :course_id)
        importance_level = Ash.Query.get_argument(query, :importance_level)

        # Get knowledge resources for this course
        knowledge_resources =
          case KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(
                 course_id: course_id,
                 tenant: query.context.tenant,
                 authorize?: false,
                 actor: nil
               ) do
            {:ok, resources} -> resources
            _ -> []
          end

        knowledge_resource_ids = Enum.map(knowledge_resources, & &1.id)

        # Get all mastery records for knowledge resources in this course
        query
        |> Ash.Query.filter(knowledge_resource_id in ^knowledge_resource_ids)
        |> then(fn q ->
          if importance_level do
            # Join with knowledge_resource to filter by importance_level
            Ash.Query.load(q, :knowledge_resource)
          else
            q
          end
        end)
      end
    end

    create :create do
      description "Create a new mastery record"

      accept [
        :student_id,
        :knowledge_resource_id,
        :mastery_level,
        :correct_count,
        :wrong_count,
        :practice_count
      ]

      change fn changeset, _context ->
        # Set initial values
        changeset
        |> Ash.Changeset.change_attribute(
          :mastery_level,
          Ash.Changeset.get_attribute(changeset, :mastery_level) || 0.0
        )
        |> Ash.Changeset.change_attribute(
          :correct_count,
          Ash.Changeset.get_attribute(changeset, :correct_count) || 0
        )
        |> Ash.Changeset.change_attribute(
          :wrong_count,
          Ash.Changeset.get_attribute(changeset, :wrong_count) || 0
        )
        |> Ash.Changeset.change_attribute(
          :practice_count,
          Ash.Changeset.get_attribute(changeset, :practice_count) || 0
        )
        |> Ash.Changeset.change_attribute(:last_practiced_at, DateTime.utc_now())
      end
    end

    update :update_mastery do
      description "Update mastery level and practice statistics"
      accept [:mastery_level, :correct_count, :wrong_count, :practice_count]

      change fn changeset, _context ->
        changeset
        |> Ash.Changeset.change_attribute(:last_practiced_at, DateTime.utc_now())
      end
    end

    action :update_from_exam do
      description "Update mastery based on exam performance"

      argument :student_id, :uuid do
        allow_nil? false
        description "Student ID"
      end

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
        description "Knowledge resource ID"
      end

      argument :exam_result, :map do
        allow_nil? false
        description "Map with :correct (integer) and :total (integer) questions"
      end

      run fn input, context ->
        student_id = input.arguments.student_id
        knowledge_resource_id = input.arguments.knowledge_resource_id
        correct = input.arguments.exam_result[:correct] || 0
        total = input.arguments.exam_result[:total] || 1

        # Calculate new mastery level using weighted average
        accuracy = if total > 0, do: correct / total, else: 0.0

        # Get or create mastery record
        case KgEdu.Knowledge.StudentKnowledgeMastery.get_student_mastery_for_knowledge(
               %{
                 student_id: student_id,
                 knowledge_resource_id: knowledge_resource_id
               },
               tenant: context.tenant,
               authorize?: false
             ) do
          {:ok, mastery} ->
            # Update existing record with weighted average
            old_mastery = mastery.mastery_level || 0.0
            new_mastery = (old_mastery * 0.7 + accuracy * 0.3) |> Float.round(3)

            update_attrs = %{
              mastery_level: new_mastery,
              correct_count: mastery.correct_count + correct,
              wrong_count: mastery.wrong_count + (total - correct),
              practice_count: mastery.practice_count + 1
            }

            Ash.update(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              mastery,
              update_attrs,
              tenant: context.tenant,
              authorize?: false
            )

          {:error, :not_found} ->
            # Create new mastery record
            create_attrs = %{
              student_id: student_id,
              knowledge_resource_id: knowledge_resource_id,
              mastery_level: accuracy,
              correct_count: correct,
              wrong_count: total - correct,
              practice_count: 1
            }

            Ash.create(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              %{attributes: create_attrs},
              tenant: context.tenant,
              authorize?: false
            )

          {:error, reason} ->
            {:error, reason}
        end
      end
    end

    action :update_from_exercise do
      description "Update mastery based on exercise practice (single question)"

      argument :student_id, :uuid do
        allow_nil? false
      end

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      argument :is_correct, :boolean do
        allow_nil? false
        description "Whether the student answered correctly"
      end

      run fn input, context ->
        student_id = input.arguments.student_id
        knowledge_resource_id = input.arguments.knowledge_resource_id
        is_correct = input.arguments.is_correct

        # Get or create mastery record
        case KgEdu.Knowledge.StudentKnowledgeMastery.get_student_mastery_for_knowledge(
               %{
                 student_id: student_id,
                 knowledge_resource_id: knowledge_resource_id
               },
               tenant: context.tenant,
               authorize?: false
             ) do
          {:ok, mastery} ->
            # Calculate new mastery level with small incremental updates
            correct_increment = if is_correct, do: 1, else: 0
            wrong_increment = if is_correct, do: 0, else: 1

            new_correct = mastery.correct_count + correct_increment
            new_wrong = mastery.wrong_count + wrong_increment
            total_attempts = new_correct + new_wrong

            new_mastery =
              if total_attempts > 0 do
                new_correct / total_attempts
              else
                mastery.mastery_level
              end

            update_attrs = %{
              mastery_level: Float.round(new_mastery, 3),
              correct_count: new_correct,
              wrong_count: new_wrong,
              practice_count: mastery.practice_count + 1
            }

            Ash.update(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              mastery,
              update_attrs,
              tenant: context.tenant,
              authorize?: false
            )

          {:error, :not_found} ->
            # Create new mastery record
            initial_mastery = if is_correct, do: 1.0, else: 0.0

            create_attrs = %{
              student_id: student_id,
              knowledge_resource_id: knowledge_resource_id,
              mastery_level: initial_mastery,
              correct_count: if(is_correct, do: 1, else: 0),
              wrong_count: if(is_correct, do: 0, else: 1),
              practice_count: 1
            }

            Ash.create(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              %{attributes: create_attrs},
              tenant: context.tenant,
              authorize?: false
            )

          {:error, reason} ->
            {:error, reason}
        end
      end
    end

    action :recalculate_mastery do
      description "Recalculate mastery level from scratch based on all exercise and exam data"

      argument :student_id, :uuid do
        allow_nil? false
      end

      argument :knowledge_resource_id, :uuid do
        allow_nil? false
      end

      run fn input, context ->
        student_id = input.arguments.student_id
        knowledge_resource_id = input.arguments.knowledge_resource_id
        tenant = context.tenant

        # Get all exercise attempts for this student and knowledge resource
        exercise_attempts =
          case get_exercise_attempts_for_knowledge(student_id, knowledge_resource_id, tenant) do
            {:ok, attempts} -> attempts
            _ -> []
          end

        # Get all exam results for this student and knowledge resource
        exam_results =
          case get_exam_results_for_knowledge(student_id, knowledge_resource_id, tenant) do
            {:ok, results} -> results
            _ -> []
          end

        # Calculate overall mastery
        total_correct = Enum.sum(exercise_attempts.correct ++ exam_results.correct)
        total_attempts = Enum.sum(exercise_attempts.total ++ exam_results.total)

        new_mastery =
          if total_attempts > 0 do
            total_correct / total_attempts
          else
            0.0
          end

        # Get or create mastery record
        case KgEdu.Knowledge.StudentKnowledgeMastery.get_student_mastery_for_knowledge(
               %{
                 student_id: student_id,
                 knowledge_resource_id: knowledge_resource_id
               },
               tenant: tenant,
               authorize?: false
             ) do
          {:ok, mastery} ->
            Ash.update(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              mastery,
              %{
                mastery_level: Float.round(new_mastery, 3),
                correct_count: total_correct,
                wrong_count: total_attempts - total_correct,
                practice_count: length(exercise_attempts.list) + length(exam_results.list)
              },
              tenant: tenant,
              authorize?: false
            )

          {:error, :not_found} ->
            Ash.create(
              KgEdu.Knowledge.StudentKnowledgeMastery,
              %{
                attributes: %{
                  student_id: student_id,
                  knowledge_resource_id: knowledge_resource_id,
                  mastery_level: Float.round(new_mastery, 3),
                  correct_count: total_correct,
                  wrong_count: total_attempts - total_correct,
                  practice_count: length(exercise_attempts.list) + length(exam_results.list)
                }
              },
              tenant: tenant,
              authorize?: false
            )

          {:error, reason} ->
            {:error, reason}
        end
      end
    end


    action :get_student_profile_overview, :map do
      description "Get comprehensive student learning profile overview"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_student_profile_overview(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant
        )
      end
    end

    action :get_knowledge_radar, :map do
      description "Get knowledge mastery radar chart data by ability dimensions"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_knowledge_radar(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant
        )
      end
    end

    action :get_learning_trend, :map do
      description "Get learning activity trend data grouped by week"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_learning_trend(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant
        )
      end
    end

    action :get_weak_knowledge_points, :map do
      description "Get student's weak knowledge points below threshold"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false
      argument :threshold, :float, allow_nil?: true, default: 0.6

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_weak_knowledge_points(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant,
          threshold: input.arguments.threshold
        )
      end
    end

    action :get_activity_distribution, :map do
      description "Get learning activity distribution (pie chart data)"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_activity_distribution(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant
        )
      end
    end

    action :get_ability_assessment, :map do
      description "Get ability dimension assessment data (bar chart)"
      argument :student_id, :uuid, allow_nil?: false
      argument :course_id, :uuid, allow_nil?: false

      run fn input, context ->
        KgEdu.Knowledge.StudentProfile.get_ability_assessment(
          input.arguments.student_id,
          input.arguments.course_id,
          tenant: context.tenant
        )
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

    attribute :mastery_level, :float do
      allow_nil? false
      default 0.0
      constraints min: 0.0, max: 1.0
      description "Mastery level from 0.0 to 1.0"
      public? true
    end

    attribute :correct_count, :integer do
      allow_nil? false
      default 0
      description "Total number of correct answers"
      public? true
    end

    attribute :wrong_count, :integer do
      allow_nil? false
      default 0
      description "Total number of wrong answers"
      public? true
    end

    attribute :practice_count, :integer do
      allow_nil? false
      default 0
      description "Total number of practice attempts"
      public? true
    end

    attribute :last_practiced_at, :utc_datetime do
      allow_nil? true
      description "Last time the student practiced this knowledge point"
      public? true
    end

    timestamps()
  end

  relationships do
    belongs_to :student, KgEdu.Accounts.User do
      public? true
      allow_nil? false
      description "The student whose mastery is being tracked"
    end

    belongs_to :knowledge_resource, KgEdu.Knowledge.Resource do
      public? true
      allow_nil? false
      description "The knowledge resource being mastered"
    end
  end

  # ============ Helper Functions ============

  defp get_exercise_attempts_for_knowledge(student_id, knowledge_resource_id, tenant) do
    # Query activity logs for exercise submissions
    case KgEdu.Activity.ActivityLog.list_activity_logs(
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, all_logs} ->
        # Get exercises associated with this knowledge resource
        case KgEdu.Knowledge.Resource.get_knowledge_resource(
               %{id: knowledge_resource_id},
               tenant: tenant,
               authorize?: false,
               load: [:exercises]
             ) do
          {:ok, resource} ->
            exercise_ids =
              case resource.exercises do
                %Ash.NotLoaded{} -> []
                exercises when is_list(exercises) -> Enum.map(exercises, & &1.id)
                _ -> []
              end

            # Filter logs for this student and these exercises
            student_exercise_logs =
              all_logs
              |> Enum.filter(&(&1.user_id == student_id))
              |> Enum.filter(&(&1.resource_type in ["Exercise", "KgEdu.Knowledge.Exercise"]))
              |> Enum.filter(&(&1.resource_id in exercise_ids))

            # Extract correct/wrong counts from metadata
            correct =
              student_exercise_logs
              |> Enum.count(fn log ->
                log.metadata["is_correct"] == true or log.metadata[:is_correct] == true
              end)

            total = length(student_exercise_logs)

            {:ok, %{correct: [correct], total: [total], list: student_exercise_logs}}

          {:error, _reason} ->
            {:ok, %{correct: [0], total: [0], list: []}}
        end

      {:error, _reason} ->
        {:ok, %{correct: [0], total: [0], list: []}}
    end
  end

  defp get_exam_results_for_knowledge(student_id, knowledge_resource_id, tenant) do
    # Get student exams with answers
    case KgEdu.Knowledge.StudentExam.list_student_exams(
           tenant: tenant,
           authorize?: false,
           actor: nil,
           filter: [student_id: student_id]
         ) do
      {:ok, student_exams} ->
        # Load exam answers with exercises
        results =
          student_exams
          |> Enum.flat_map(fn student_exam ->
            case KgEdu.Knowledge.StudentExamAnswer.get_answers_by_student_exam(
                   student_exam_id: student_exam.id,
                   tenant: tenant,
                   authorize?: false,
                   load: [:exercise]
                 ) do
              {:ok, answers} ->
                answers
                |> Enum.filter(fn answer ->
                  case answer.exercise do
                    %Ash.NotLoaded{} -> false
                    nil -> false
                    exercise -> exercise.knowledge_resource_id == knowledge_resource_id
                  end
                end)
                |> Enum.map(fn answer ->
                  %{
                    correct: if(answer.points_earned > 0, do: 1, else: 0),
                    total: 1,
                    answer: answer
                  }
                end)

              {:error, _} ->
                []
            end
          end)

        correct = Enum.sum(Enum.map(results, & &1.correct))
        total = Enum.sum(Enum.map(results, & &1.total))

        {:ok, %{correct: [correct], total: [total], list: results}}

      {:error, _reason} ->
        {:ok, %{correct: [0], total: [0], list: []}}
    end
  end
end
