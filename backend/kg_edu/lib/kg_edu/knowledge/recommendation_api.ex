defmodule KgEdu.Knowledge.RecommendationAPI do
  @moduledoc """
  推荐系统 API 接口
  为前端提供统一的推荐系统调用接口

  主要功能：
  1. 获取学生个性化推荐
  2. 获取学习分析报告
  3. 触发推荐更新
  """

  require Logger
  import Ash.Query

  @doc """
  获取学生的个性化学习推荐列表
  """
  def get_student_recommendations(student_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    course_id = Keyword.get(opts, :course_id)
    status = Keyword.get(opts, :status)
    limit = Keyword.get(opts, :limit, 20)
    force_refresh = Keyword.get(opts, :force_refresh, false)

    Logger.info(
      "Getting recommendations for student #{student_id}, force_refresh: #{force_refresh}"
    )

    # Check if we need to generate new recommendations
    if force_refresh or should_refresh_recommendations?(student_id, tenant) do
      Logger.info("Refreshing recommendations for student #{student_id}")

      KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
        student_id,
        course_id,
        tenant: tenant
      )
    end

    # Get recommendations from database
    case KgEdu.Knowledge.LearningRecommendation.get_student_recommendations(
           student_id: student_id,
           status: status,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, recommendations} ->
        # Load knowledge resources for each recommendation
        enriched_recommendations =
          recommendations
          |> Enum.take(limit)
          |> Enum.map(fn recommendation ->
            enrich_recommendation(recommendation, tenant)
          end)

        {:ok, enriched_recommendations}

      {:error, reason} ->
        Logger.error("Failed to get recommendations: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  获取学生的完整学习分析报告
  """
  def get_learning_analysis(student_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    course_id = Keyword.get(opts, :course_id)

    Logger.info("Getting learning analysis for student #{student_id}")

    # Get mastery report
    case KgEdu.Knowledge.LearningAnalyzer.get_mastery_report(
           student_id,
           course_id,
           tenant: tenant
         ) do
      {:ok, mastery_report} ->
        # Get behavior analysis
        behavior_patterns =
          KgEdu.Knowledge.RecommendationEngine.analyze_learning_behavior(
            student_id,
            tenant
          )

        # Get weak points
        {:ok, weak_points} =
          KgEdu.Knowledge.RecommendationEngine.analyze_weak_knowledge_points(
            student_id,
            course_id,
            tenant
          )

        # Combine into comprehensive report
        analysis = %{
          student_id: student_id,
          course_id: course_id,
          generated_at: DateTime.utc_now() |> DateTime.to_iso8601(),
          mastery_report: mastery_report,
          behavior_patterns: behavior_patterns,
          weak_points: %{
            critical: length(weak_points.critical),
            needs_review: length(weak_points.needs_review),
            total: weak_points.total_count
          },
          recommendations: %{
            total_pending: count_pending_recommendations(student_id, tenant),
            last_generated_at: get_last_recommendation_time(student_id, tenant)
          }
        }

        {:ok, analysis}

      {:error, reason} ->
        Logger.error("Failed to get learning analysis: #{inspect(reason)}")
        {:error, reason}
    end
  end

  @doc """
  标记推荐为已查看
  """
  def mark_recommendation_viewed(recommendation_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case Ash.get(
           KgEdu.Knowledge.LearningRecommendation,
           recommendation_id,
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, recommendation} ->
        KgEdu.Knowledge.LearningRecommendation.mark_as_viewed(
          recommendation,
          tenant: tenant,
          authorize?: false
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  标记推荐为已完成
  """
  def mark_recommendation_completed(recommendation_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case Ash.get(
           KgEdu.Knowledge.LearningRecommendation,
           recommendation_id,
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, recommendation} ->
        case KgEdu.Knowledge.LearningRecommendation.mark_as_completed(
               recommendation,
               tenant: tenant,
               authorize?: false
             ) do
          {:ok, _completed} ->
            # After completing, trigger recommendation refresh
            student_id = recommendation.student_id

            KgEdu.Knowledge.RecommendationEngine.generate_comprehensive_recommendations(
              student_id,
              nil,
              tenant: tenant
            )

          {:error, reason} ->
            {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  忽略推荐
  """
  def dismiss_recommendation(recommendation_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case Ash.get(
           KgEdu.Knowledge.LearningRecommendation,
           recommendation_id,
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, recommendation} ->
        KgEdu.Knowledge.LearningRecommendation.dismiss_recommendation(
          recommendation,
          tenant: tenant,
          authorize?: false
        )

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  触发考试结果分析并更新推荐
  """
  def analyze_exam_and_update(student_exam_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case KgEdu.Knowledge.LearningAnalyzer.analyze_exam_results(
           student_exam_id,
           tenant: tenant,
           auto_generate_recommendations: true
         ) do
      :ok ->
        {:ok, %{message: "Exam analyzed and recommendations updated"}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  触发练习结果分析并更新推荐
  """
  def analyze_exercise_and_update(exercise_id, student_id, is_correct, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case KgEdu.Knowledge.LearningAnalyzer.analyze_exercise_result(
           exercise_id,
           student_id,
           is_correct,
           tenant: tenant,
           auto_update_mastery: true
         ) do
      :ok ->
        {:ok, %{message: "Exercise analyzed and mastery updated"}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  获取知识点掌握详情
  """
  def get_knowledge_mastery(student_id, knowledge_resource_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    case KgEdu.Knowledge.StudentKnowledgeMastery.get_student_mastery_for_knowledge(
           student_id: student_id,
           knowledge_resource_id: knowledge_resource_id,
           tenant: tenant,
           authorize?: false,
           load: [:knowledge_resource]
         ) do
      {:ok, mastery} ->
        # Enrich with additional info
        enriched_mastery = %{
          id: mastery.id,
          knowledge_resource_id: mastery.knowledge_resource_id,
          knowledge_resource_name: get_resource_name(mastery.knowledge_resource),
          mastery_level: mastery.mastery_level,
          mastery_percent: Float.round(mastery.mastery_level * 100, 1),
          correct_count: mastery.correct_count,
          wrong_count: mastery.wrong_count,
          practice_count: mastery.practice_count,
          last_practiced_at: mastery.last_practiced_at,
          status: determine_mastery_status(mastery.mastery_level)
        }

        {:ok, enriched_mastery}

      {:error, :not_found} ->
        # No mastery record exists yet
        {:ok,
         %{
           knowledge_resource_id: knowledge_resource_id,
           mastery_level: 0.0,
           mastery_percent: 0.0,
           correct_count: 0,
           wrong_count: 0,
           practice_count: 0,
           status: :not_started
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # ============ Private Helper Functions ============

  defp should_refresh_recommendations?(student_id, tenant) do
    # Check if recommendations exist and are recent enough
    case KgEdu.Knowledge.LearningRecommendation.get_student_recommendations(
           student_id: student_id,
           status: :pending,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, recommendations} when is_list(recommendations) ->
        # If no recommendations, need to refresh
        if length(recommendations) == 0 do
          true
        else
          # Check if recommendations are older than 24 hours
          oldest = List.last(recommendations)

          if oldest do
            hours_ago = DateTime.diff(DateTime.utc_now(), oldest.inserted_at) / 3600
            hours_ago > 24
          else
            true
          end
        end

      _ ->
        true
    end
  end

  defp enrich_recommendation(recommendation, tenant) do
    knowledge_resource =
      case recommendation.knowledge_resource do
        %Ash.NotLoaded{} ->
          case Ash.get(KgEdu.Knowledge.Resource, recommendation.knowledge_resource_id,
                 tenant: tenant,
                 authorize?: false
               ) do
            {:ok, resource} -> resource
            _ -> nil
          end

        nil ->
          nil

        resource ->
          resource
      end

    %{
      id: recommendation.id,
      recommendation_type: recommendation.recommendation_type,
      priority: recommendation.priority,
      reason: recommendation.reason,
      status: recommendation.status,
      created_at: recommendation.inserted_at,
      viewed_at: recommendation.viewed_at,
      completed_at: recommendation.completed_at,
      knowledge_resource: %{
        id: recommendation.knowledge_resource_id,
        name: if(knowledge_resource, do: knowledge_resource.name, else: "Unknown"),
        importance_level:
          if(knowledge_resource, do: knowledge_resource.importance_level, else: "normal"),
        description: if(knowledge_resource, do: knowledge_resource.description, else: nil),
        course_id: if(knowledge_resource, do: knowledge_resource.course_id, else: nil)
      },
      metadata: recommendation.metadata || %{}
    }
  end

  defp count_pending_recommendations(student_id, tenant) do
    case KgEdu.Knowledge.LearningRecommendation.get_student_recommendations(
           student_id: student_id,
           status: :pending,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, recommendations} -> length(recommendations)
      _ -> 0
    end
  end

  defp get_last_recommendation_time(student_id, tenant) do
    case KgEdu.Knowledge.LearningRecommendation.get_student_recommendations(
           student_id: student_id,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, recommendations} when is_list(recommendations) and length(recommendations) > 0 ->
        latest =
          recommendations
          |> Enum.sort_by(& &1.inserted_at, {:desc, DateTime})
          |> List.first()

        if latest, do: latest.inserted_at, else: nil

      _ ->
        nil
    end
  end

  @doc """
  获取学生学习进度摘要
  返回推荐资源的三种状态统计：待学习、进行中、已完成
  """
  def get_learning_progress_summary(student_id, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)
    course_id = Keyword.get(opts, :course_id)

    Logger.info("Getting learning progress summary for student #{student_id}")

    # Get all recommendations for the student - use Ash.Query directly
    query =
      KgEdu.Knowledge.LearningRecommendation
      |> Ash.Query.filter(student_id == ^student_id)

    query =
      if course_id do
        Ash.Query.filter(query, knowledge_resource.course_id == ^course_id)
      else
        query
      end

    case Ash.read(query, tenant: tenant, authorize?: false, page: %{limit: 100}) do
      {:ok, %{results: recommendations}} when is_list(recommendations) ->
        # Filter by course if specified
        filtered_recommendations =
          if course_id do
            Enum.filter(recommendations, fn rec ->
              case rec.knowledge_resource do
                %Ash.NotLoaded{} ->
                  false

                kr when is_struct(kr, KgEdu.Knowledge.Resource) ->
                  kr.course_id == course_id

                _ ->
                  false
              end
            end)
          else
            recommendations
          end

        # Count by status
        pending = Enum.filter(filtered_recommendations, &(&1.status == :pending))

        in_progress =
          Enum.filter(filtered_recommendations, &(&1.status in [:viewed, :in_progress]))

        completed = Enum.filter(filtered_recommendations, &(&1.status == :completed))
        dismissed = Enum.filter(filtered_recommendations, &(&1.status == :dismissed))

        # Calculate completion percentage
        total_active = length(pending) + length(in_progress) + length(completed)

        completion_rate =
          if total_active > 0 do
            Float.round(length(completed) / total_active * 100, 1)
          else
            0.0
          end

        summary = %{
          student_id: student_id,
          course_id: course_id,
          total_recommendations: length(filtered_recommendations),
          pending: %{
            count: length(pending),
            status: "待学习"
          },
          in_progress: %{
            count: length(in_progress),
            status: "进行中"
          },
          completed: %{
            count: length(completed),
            status: "已完成"
          },
          dismissed: %{
            count: length(dismissed)
          },
          completion_rate: completion_rate
        }

        {:ok, summary}

      {:error, reason} ->
        Logger.error("Failed to get learning progress: #{inspect(reason)}")
        {:error, reason}
    end
  end

  defp get_resource_name(%Ash.NotLoaded{}), do: nil
  defp get_resource_name(nil), do: nil
  defp get_resource_name(resource), do: resource.name

  defp determine_mastery_status(mastery_level) when mastery_level >= 0.8, do: :mastered
  defp determine_mastery_status(mastery_level) when mastery_level >= 0.4, do: :learning
  defp determine_mastery_status(mastery_level) when mastery_level > 0, do: :weak
  defp determine_mastery_status(_), do: :not_started
end
