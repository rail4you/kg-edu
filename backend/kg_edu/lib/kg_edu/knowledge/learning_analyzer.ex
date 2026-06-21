defmodule KgEdu.Knowledge.LearningAnalyzer do
  @moduledoc """
  学习数据分析器
  自动分析学生的学习数据，识别薄弱环节，并更新知识点掌握度

  主要功能：
  1. 分析考试结果，识别错题对应的知识点
  2. 更新学生对知识点的掌握度
  3. 生成个性化学习建议
  """

  require Logger
  import Ash.Query

  @doc """
  分析学生考试结果并更新知识点掌握度
  当考试完成后调用此函数
  """
  def analyze_exam_results(student_exam_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    auto_generate = Keyword.get(opts, :auto_generate_recommendations, true)

    Logger.info("Analyzing exam results for student_exam #{student_exam_id}")

    # Get the student exam with answers
    case Ash.get(
           KgEdu.Knowledge.StudentExam,
           student_exam_id,
           tenant: tenant,
           authorize?: false,
           load: [:student, :exam, student_exam_answers: [:exercise]]
         ) do
      {:ok, student_exam} ->
        student_id = student_exam.student.id

        # Analyze each answer to identify weak knowledge points
        knowledge_results = analyze_student_exam_answers(student_exam, tenant)

        # Update mastery levels for each knowledge resource
        update_mastery_from_exam(knowledge_results, student_id, tenant)

        # Generate recommendations if requested
        if auto_generate do
          case KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
                 student_id,
                 student_exam.exam.course_id,
                 tenant: tenant
               ) do
            {:ok, _result} ->
              :ok

            {:error, reason} ->
              Logger.error("Failed to generate recommendations: #{inspect(reason)}")
              {:error, reason}
          end
        else
          :ok
        end

      {:error, reason} ->
        Logger.error("Failed to get student exam: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  分析学生的练习数据并更新知识点掌握度
  当学生完成练习后调用此函数
  """
  def analyze_exercise_result(exercise_id, student_id, is_correct, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    auto_update = Keyword.get(opts, :auto_update_mastery, true)

    Logger.info(
      "Analyzing exercise result for exercise #{exercise_id}, student #{student_id}, correct: #{is_correct}"
    )

    # Get the exercise with its knowledge resource
    case Ash.get(
           KgEdu.Knowledge.Exercise,
           exercise_id,
           tenant: tenant,
           authorize?: false,
           load: [:knowledge_resource]
         ) do
      {:ok, exercise} ->
        if exercise.knowledge_resource_id do
          # Update mastery based on this single exercise
          if auto_update do
            case KgEdu.Knowledge.StudentKnowledgeMastery.update_mastery_from_exercise(
                   student_id: student_id,
                   knowledge_resource_id: exercise.knowledge_resource_id,
                   is_correct: is_correct,
                   tenant: tenant
                 ) do
              :ok ->
                # Check if we should update recommendations
                maybe_update_recommendations(student_id, exercise.knowledge_resource_id, tenant)

              {:error, reason} ->
                Logger.error("Failed to update mastery: #{inspect(reason)}")
                {:error, reason}
            end
          else
            :ok
          end
        else
          :ok
        end

      {:error, reason} ->
        Logger.error("Failed to get exercise: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  批量分析所有考试数据并更新掌握度
  用于系统初始化或数据迁移
  """
  def batch_analyze_all_exams(opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    course_id = Keyword.get(opts, :course_id)

    Logger.info("Batch analyzing all exams")

    # Get all graded student exams
    query =
      KgEdu.Knowledge.StudentExam
      |> filter(status: :graded)

    query =
      if course_id do
        Ash.Query.filter(
          query,
          exam_id in subquery(
            KgEdu.Knowledge.Exam
            |> filter(course_id: ^course_id)
            |> select([:id])
          )
        )
      else
        query
      end

    case Ash.read(query, tenant: tenant, authorize?: false) do
      {:ok, student_exams} ->
        results =
          Enum.map(student_exams, fn student_exam ->
            analyze_exam_results(student_exam.id,
              tenant: tenant,
              auto_generate_recommendations: false
            )
          end)

        success_count =
          Enum.count(results, fn
            :ok -> true
            _ -> false
          end)

        Logger.info(
          "Batch analysis completed: #{success_count}/#{length(student_exams)} successful"
        )

        {:ok, %{total: length(student_exams), successful: success_count}}

      {:error, reason} ->
        Logger.error("Failed to batch analyze: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  获取学生的知识点掌握报告
  """
  def get_mastery_report(student_id, course_id \\ nil, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    Logger.info("Generating mastery report for student #{student_id}")

    # Get all mastery records for the student
    case KgEdu.Knowledge.StudentKnowledgeMastery.get_all_student_masteries(
           student_id: student_id,
           tenant: tenant,
           authorize?: false,
           load: [:knowledge_resource]
         ) do
      {:ok, masteries} ->
        # Filter by course if specified
        filtered_masteries =
          if course_id do
            Enum.filter(masteries, fn mastery ->
              case mastery.knowledge_resource do
                %Ash.NotLoaded{} -> false
                nil -> false
                resource -> resource.course_id == course_id
              end
            end)
          else
            masteries
          end

        # Calculate statistics
        total_count = length(filtered_masteries)

        mastered_count = Enum.count(filtered_masteries, fn m -> m.mastery_level >= 0.8 end)

        learning_count =
          Enum.count(filtered_masteries, fn m ->
            m.mastery_level >= 0.4 and m.mastery_level < 0.8
          end)

        weak_count = Enum.count(filtered_masteries, fn m -> m.mastery_level < 0.4 end)

        avg_mastery =
          if total_count > 0 do
            Enum.sum(Enum.map(filtered_masteries, & &1.mastery_level)) / total_count
          else
            0.0
          end

        # Get weakest and strongest points
        weakest = get_extreme_points(filtered_masteries, :asc, 5)
        strongest = get_extreme_points(filtered_masteries, :desc, 5)

        report = %{
          student_id: student_id,
          course_id: course_id,
          total_knowledge_points: total_count,
          mastered_count: mastered_count,
          learning_count: learning_count,
          weak_count: weak_count,
          average_mastery_level: Float.round(avg_mastery, 3),
          weakest_points: weakest,
          strongest_points: strongest,
          mastery_distribution: %{
            mastered: mastered_count,
            learning: learning_count,
            weak: weak_count
          }
        }

        {:ok, report}

      {:error, reason} ->
        Logger.error("Failed to generate mastery report: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  获取班级知识点薄弱分析（教师端）
  聚合所有学生的知识点掌握情况，返回班级整体的薄弱知识点
  """
  def get_class_weakness(course_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    importance_level = Keyword.get(opts, :importance_level)

    Logger.info("Generating class weakness analysis for course #{course_id}")

    # Get all students in the course
    case KgEdu.Courses.CourseEnrollment.list_enrollments_by_course(
           course_id: course_id,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, enrollments} ->
        student_ids = Enum.map(enrollments, & &1.member_id)

        if length(student_ids) == 0 do
          {:ok, %{students_count: 0, knowledge_points: []}}
        else
          # Get all mastery records for knowledge resources in this course
          case get_course_masteries(course_id, tenant) do
            {:ok, all_masteries} ->
              # Group by knowledge resource and calculate aggregate statistics
              knowledge_stats =
                all_masteries
                |> Enum.group_by(& &1.knowledge_resource_id)
                |> Enum.map(fn {knowledge_id, masteries} ->
                  calculate_knowledge_point_stats(knowledge_id, masteries, all_masteries)
                end)
                |> Enum.filter(fn stats -> stats.student_count > 0 end)
                |> Enum.sort_by(fn stats -> stats.avg_mastery_level end, {:asc, Float})

              # Filter by importance level if specified
              filtered_stats =
                if importance_level do
                  Enum.filter(knowledge_stats, fn stats ->
                    stats.importance_level == importance_level
                  end)
                else
                  knowledge_stats
                end

              # Categorize by weakness level
              critical = Enum.filter(filtered_stats, &(&1.avg_mastery_level < 0.3))

              needs_review =
                Enum.filter(
                  filtered_stats,
                  &(&1.avg_mastery_level >= 0.3 and &1.avg_mastery_level < 0.6)
                )

              good = Enum.filter(filtered_stats, &(&1.avg_mastery_level >= 0.6))

              result = %{
                course_id: course_id,
                students_count: length(student_ids),
                knowledge_points: %{
                  total: length(filtered_stats),
                  critical_count: length(critical),
                  needs_review_count: length(needs_review),
                  good_count: length(good),
                  critical: Enum.take(critical, 10),
                  needs_review: Enum.take(needs_review, 10),
                  all: filtered_stats
                }
              }

              {:ok, result}

            {:error, reason} ->
              Logger.error("Failed to get course masteries: #{inspect(reason)}")
              {:error, reason}
          end
        end

      {:error, reason} ->
        Logger.error("Failed to get course enrollments: #{inspect(reason)}")
        {:error, reason}
    end
  end

  # Get all mastery records for a course
  defp get_course_masteries(course_id, tenant) do
    # Get knowledge resource IDs for the course
    case KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(
           course_id: course_id,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, resources} ->
        resource_ids = Enum.map(resources, & &1.id)

        # Get all mastery records for these resources
        KgEdu.Knowledge.StudentKnowledgeMastery.list_masteries!(
          tenant: tenant,
          authorize?: false,
          actor: nil,
          filter: [knowledge_resource_id: resource_ids],
          load: [:knowledge_resource]
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Calculate aggregate statistics for a knowledge point
  defp calculate_knowledge_point_stats(knowledge_id, student_masteries, _all_masteries) do
    knowledge_resource =
      case Enum.find(student_masteries, & &1.knowledge_resource) do
        %{knowledge_resource: res} when res != nil and res != %Ash.NotLoaded{} -> res
        _ -> nil
      end

    total_mastery = Enum.reduce(student_masteries, 0.0, &(&1.mastery_level + &2))
    count = length(student_masteries)
    avg_mastery = if count > 0, do: total_mastery / count, else: 0.0

    total_correct = Enum.reduce(student_masteries, 0, &(&1.correct_count + &2))
    total_wrong = Enum.reduce(student_masteries, 0, &(&1.wrong_count + &2))
    total_attempts = total_correct + total_wrong
    error_rate = if total_attempts > 0, do: total_wrong / total_attempts, else: 0.0

    %{
      knowledge_resource_id: knowledge_id,
      knowledge_resource_name:
        if(knowledge_resource, do: knowledge_resource.name, else: "Unknown"),
      importance_level:
        if(knowledge_resource,
          do: knowledge_resource.importance_level || "normal",
          else: "normal"
        ),
      student_count: count,
      avg_mastery_level: Float.round(avg_mastery, 3),
      mastery_percent: Float.round(avg_mastery * 100, 1),
      error_rate: Float.round(error_rate, 3),
      total_correct: total_correct,
      total_wrong: total_wrong,
      weakness_level: categorize_weakness(avg_mastery)
    }
  end

  defp categorize_weakness(mastery_level) when mastery_level < 0.3, do: :critical
  defp categorize_weakness(mastery_level) when mastery_level < 0.6, do: :needs_review
  defp categorize_weakness(_), do: :good

  # ============ Private Helper Functions ============

  # Analyze student exam answers and group by knowledge resource
  defp analyze_student_exam_answers(student_exam, _tenant) do
    knowledge_results =
      student_exam.student_exam_answers
      |> Enum.reduce(%{}, fn answer, acc ->
        case answer.exercise do
          %Ash.NotLoaded{} ->
            acc

          nil ->
            acc

          exercise ->
            knowledge_id = exercise.knowledge_resource_id

            if knowledge_id do
              # Check if answer was correct (points earned > 0)
              is_correct = answer.points_earned > 0

              Map.update(acc, knowledge_id, %{correct: 0, wrong: 0, total: 0}, fn stats ->
                %{
                  correct: stats.correct + if(is_correct, do: 1, else: 0),
                  wrong: stats.wrong + if(is_correct, do: 0, else: 1),
                  total: stats.total + 1
                }
              end)
            else
              acc
            end
        end
      end)

    knowledge_results
  end

  # Update mastery levels from exam results
  defp update_mastery_from_exam(knowledge_results, student_id, tenant) do
    Enum.each(knowledge_results, fn {knowledge_id, stats} ->
      case KgEdu.Knowledge.StudentKnowledgeMastery.update_mastery_from_exam(
             student_id: student_id,
             knowledge_resource_id: knowledge_id,
             exam_result: %{correct: stats.correct, total: stats.total},
             tenant: tenant
           ) do
        :ok ->
          Logger.debug(
            "Updated mastery for knowledge #{knowledge_id}: #{stats.correct}/#{stats.total}"
          )

        {:error, reason} ->
          Logger.error(
            "Failed to update mastery for knowledge #{knowledge_id}: #{inspect(reason)}"
          )
      end
    end)
  end

  # Conditionally update recommendations based on mastery change
  defp maybe_update_recommendations(student_id, knowledge_resource_id, tenant) do
    # Get current mastery level
    case KgEdu.Knowledge.StudentKnowledgeMastery.get_student_mastery_for_knowledge(
           student_id: student_id,
           knowledge_resource_id: knowledge_resource_id,
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, mastery} ->
        # If mastery is low, generate new recommendations
        if mastery.mastery_level < 0.6 do
          KgEdu.Knowledge.LearningRecommendation.generate_recommendations(
            student_id: student_id,
            course_id: nil,
            tenant: tenant
          )
        else
          :ok
        end

      {:error, _reason} ->
        :ok
    end
  end

  # Get extreme points (weakest or strongest)
  defp get_extreme_points(masteries, sort_order, count) do
    masteries
    |> Enum.sort(fn m1, m2 ->
      case sort_order do
        :asc -> m1.mastery_level < m2.mastery_level
        :desc -> m1.mastery_level > m2.mastery_level
      end
    end)
    |> Enum.take(count)
    |> Enum.map(fn mastery ->
      %{
        knowledge_resource_id: mastery.knowledge_resource_id,
        knowledge_resource_name: get_resource_name(mastery.knowledge_resource),
        mastery_level: mastery.mastery_level,
        correct_count: mastery.correct_count,
        wrong_count: mastery.wrong_count,
        practice_count: mastery.practice_count
      }
    end)
  end

  defp get_resource_name(%Ash.NotLoaded{}), do: "Unknown"
  defp get_resource_name(nil), do: "Unknown"
  defp get_resource_name(resource), do: resource.name
end
