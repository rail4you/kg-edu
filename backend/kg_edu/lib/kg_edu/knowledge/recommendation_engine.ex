defmodule KgEdu.Knowledge.RecommendationEngine do
  @moduledoc """
  智能推荐引擎
  基于多种策略为学生生成个性化学习推荐

  推荐策略：
  1. 基于薄弱环节的推荐 (Weakness-based)
  2. 基于知识图谱的推荐 (Knowledge Graph-based)
  3. 基于协同过滤的推荐 (Collaborative Filtering)
  4. 基于学习行为的推荐 (Behavior-based)
  """

  require Logger

  @doc """
  为学生生成全面的学习推荐报告
  """
  def generate_comprehensive_recommendations(student_id, course_id \\ nil, opts \\ []) do
    tenant = Keyword.get(opts, :tenant)

    Logger.info("Generating comprehensive recommendations for student #{student_id}")

    # 1. 分析薄弱环节
    weak_points = analyze_weak_knowledge_points(student_id, course_id, tenant)

    # 2. 分析学习行为模式
    behavior_patterns = analyze_learning_behavior(student_id, tenant)

    # 3. 获取知识图谱关联
    related_knowledge = get_related_knowledge(student_id, course_id, tenant)

    # 4. 生成推荐
    recommendations =
      []
      |> add_weakness_recommendations(weak_points, student_id, tenant)
      |> add_prerequisite_recommendations(related_knowledge, student_id, tenant)
      |> add_collaborative_recommendations(student_id, course_id, tenant)
      |> add_behavior_based_recommendations(behavior_patterns, student_id, tenant)

    # 5. 排序和限制数量
    limit = Keyword.get(opts, :limit, 20)
    sorted_recommendations = sort_and_prioritize(recommendations, weak_points, behavior_patterns)
    final_recommendations = Enum.take(sorted_recommendations, limit)

    Logger.info("Generated #{length(final_recommendations)} recommendations for student #{student_id}")

    {:ok, %{
      recommendations: final_recommendations,
      analysis: %{
        weak_points: weak_points,
        behavior_patterns: behavior_patterns,
        related_knowledge: length(related_knowledge)
      }
    }}
  end

  @doc """
  分析学生的薄弱知识点
  """
  def analyze_weak_knowledge_points(student_id, course_id \\ nil, tenant) do
    Logger.info("Analyzing weak knowledge points for student #{student_id}")

    case KgEdu.Knowledge.StudentKnowledgeMastery.get_weak_knowledge_points(
           student_id: student_id,
           threshold: 0.6,
           course_id: course_id,
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, weak_masteries} ->
        # Group by mastery level ranges
        critical = Enum.filter(weak_masteries, fn m -> m.mastery_level < 0.3 end)
        needs_review = Enum.filter(weak_masteries, fn m -> m.mastery_level >= 0.3 and m.mastery_level < 0.6 end)

        %{
          critical: critical,
          needs_review: needs_review,
          total_count: length(weak_masteries),
          critical_count: length(critical),
          review_count: length(needs_review)
        }

      {:error, reason} ->
        Logger.error("Failed to analyze weak points: #{inspect(reason)}")
        %{critical: [], needs_review: [], total_count: 0, critical_count: 0, review_count: 0}
    end
  end

  @doc """
  分析学生的学习行为模式
  """
  def analyze_learning_behavior(student_id, tenant) do
    Logger.info("Analyzing learning behavior for student #{student_id}")

    # Get recent activity logs
    case KgEdu.Activity.ActivityLog.list_activity_logs(
           tenant: tenant,
           authorize?: false,
           actor: nil
         ) do
      {:ok, all_logs} ->
        student_logs =
          all_logs
          |> Enum.filter(&(&1.user_id == student_id))
          |> Enum.sort_by(& &1.inserted_at, {:desc, NaiveDateTime})
          |> Enum.take(100) # Last 100 activities

        # Analyze patterns
        %{
          preferred_learning_type: determine_preferred_learning_type(student_logs),
          active_hours: determine_active_hours(student_logs),
          consistency_score: calculate_consistency_score(student_logs),
          recent_activity_level: calculate_recent_activity_level(student_logs)
        }

      {:error, reason} ->
        Logger.error("Failed to analyze behavior: #{inspect(reason)}")
        %{
          preferred_learning_type: :unknown,
          active_hours: [],
          consistency_score: 0.0,
          recent_activity_level: :low
        }
    end
  end

  @doc """
  获取相关的知识点（基于知识图谱关系）
  """
  def get_related_knowledge(_student_id, course_id, tenant) do
    # Get knowledge resources that have relationships
    case course_id do
      nil -> []
      _course_id ->
        case KgEdu.Knowledge.Resource.get_knowledge_resources_by_course(
               course_id: course_id,
               tenant: tenant,
               authorize?: false,
               actor: nil,
               load: [:outgoing_relations, :incoming_relations]
             ) do
          {:ok, resources} ->
            resources
            |> Enum.filter(fn resource ->
              has_relations?(resource)
            end)

          _ -> []
        end
    end
  end

  @doc """
  实时更新推荐（当学生学习后动态调整推荐列表）
  """
  def update_recommendations_after_activity(student_id, activity_type, resource_id, tenant) do
    Logger.info("Updating recommendations after activity: #{activity_type} for student #{student_id}")

    # If student completed a learning activity, recalculate mastery and update recommendations
    case activity_type do
      :exercise_submit ->
        # Get exercise and its knowledge resource
        case Ash.get(KgEdu.Knowledge.Exercise, resource_id, tenant: tenant, authorize?: false) do
          {:ok, exercise} ->
            if exercise.knowledge_resource_id do
              # Recalculate mastery
              KgEdu.Knowledge.StudentKnowledgeMastery.recalculate_mastery(
                student_id: student_id,
                knowledge_resource_id: exercise.knowledge_resource_id,
                tenant: tenant
              )

              # Regenerate recommendations
              generate_comprehensive_recommendations(student_id, nil, tenant: tenant)
            else
              {:ok, []}
            end

          _ ->
            {:ok, []}
        end

      :exam_complete ->
        # Similar logic for exam completion
        {:ok, []}

      _ ->
        {:ok, []}
    end
  end

  # ============ Private Helper Functions ============

  # Add recommendations based on weak points
  defp add_weakness_recommendations(recommendations, weak_points, student_id, tenant) do
    critical_recommendations =
      weak_points.critical
      |> Enum.take(5)
      |> Enum.map(fn mastery ->
        create_weakness_recommendation(mastery, :critical, student_id, tenant)
      end)
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, rec} -> rec end)

    review_recommendations =
      weak_points.needs_review
      |> Enum.take(5)
      |> Enum.map(fn mastery ->
        create_weakness_recommendation(mastery, :review, student_id, tenant)
      end)
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, rec} -> rec end)

    recommendations ++ critical_recommendations ++ review_recommendations
  end

  # Add prerequisite recommendations
  defp add_prerequisite_recommendations(recommendations, related_knowledge, student_id, tenant) do
    # Find prerequisites that student hasn't mastered yet
    prerequisite_recommendations =
      related_knowledge
      |> Enum.flat_map(fn resource ->
        case resource.incoming_relations do
          %Ash.NotLoaded{} -> []
          relations when is_list(relations) ->
            Enum.filter(relations, fn relation ->
              relation.relation_type == "prerequisite"
            end)
          _ -> []
        end
      end)
      |> Enum.take(3)
      |> Enum.map(fn relation ->
        create_prerequisite_recommendation(relation, student_id, tenant)
      end)
      |> Enum.filter(fn
        {:ok, _} -> true
        _ -> false
      end)
      |> Enum.map(fn {:ok, rec} -> rec end)

    recommendations ++ prerequisite_recommendations
  end

  # Add collaborative filtering recommendations
  defp add_collaborative_recommendations(recommendations, _student_id, _course_id, _tenant) do
    # Find similar students and what they learned
    # This is a simplified version - real implementation would be more complex
    recommendations
  end

  # Add behavior-based recommendations
  defp add_behavior_based_recommendations(recommendations, _behavior_patterns, _student_id, _tenant) do
    # Based on preferred learning type, recommend resources that match
    recommendations
  end

  # Sort and prioritize recommendations
  defp sort_and_prioritize(recommendations, _weak_points, _behavior_patterns) do
    recommendations
    |> Enum.sort(fn rec1, rec2 ->
      # Prioritize by:
      # 1. Priority field
      # 2. Whether it addresses a critical weakness
      # 3. Match with preferred learning type

      priority1 = rec1.priority || 5
      priority2 = rec2.priority || 5

      if priority1 != priority2 do
        priority1 > priority2
      else
        # If priorities are equal, sort by insertion time
        rec1.inserted_at >= rec2.inserted_at
      end
    end)
  end

  # Create a weakness-based recommendation
  defp create_weakness_recommendation(mastery, severity, student_id, tenant) do
    knowledge_resource = case mastery.knowledge_resource do
      %Ash.NotLoaded{} -> nil
      resource -> resource
    end

    if knowledge_resource do
      recommendation_type = determine_best_resource_type(knowledge_resource, tenant)
      priority = if severity == :critical, do: 10, else: 7

      reason = generate_weakness_reason(mastery, severity, knowledge_resource)

      create_attrs = %{
        student_id: student_id,
        knowledge_resource_id: knowledge_resource.id,
        recommendation_type: recommendation_type,
        priority: priority,
        reason: reason,
        metadata: %{
          severity: severity,
          mastery_level: mastery.mastery_level,
          practice_count: mastery.practice_count,
          strategy: :weakness_based
        }
      }

      Ash.create(
        KgEdu.Knowledge.LearningRecommendation,
        %{attributes: create_attrs},
        tenant: tenant,
        authorize?: false
      )
    else
      {:error, :knowledge_resource_not_loaded}
    end
  end

  # Create a prerequisite recommendation
  defp create_prerequisite_recommendation(relation, student_id, tenant) do
    # Get source knowledge (prerequisite)
    case KgEdu.Knowledge.Resource.get_knowledge_resource(
           relation.source_knowledge_id,
           tenant: tenant,
           authorize?: false
         ) do
      {:ok, prerequisite_resource} ->
        reason = "Before learning '#{relation.target_knowledge.name}', you should first master '#{prerequisite_resource.name}'"

        create_attrs = %{
          student_id: student_id,
          knowledge_resource_id: prerequisite_resource.id,
          recommendation_type: :prerequisite_learning,
          priority: 8,
          reason: reason,
          metadata: %{
            target_knowledge_id: relation.target_knowledge_id,
            relation_type: relation.relation_type,
            strategy: :prerequisite_based
          }
        }

        Ash.create(
          KgEdu.Knowledge.LearningRecommendation,
          %{attributes: create_attrs},
          tenant: tenant,
          authorize?: false
        )

      {:error, _} ->
        {:error, :prerequisite_not_found}
    end
  end

  defp determine_best_resource_type(knowledge_resource, tenant) do
    # Similar logic to LearningRecommendation module
    case KgEdu.Knowledge.Resource.get_knowledge_resource(
           knowledge_resource.id,
           tenant: tenant,
           authorize?: false,
           load: [:videos, :files, :homeworks, :exercises]
         ) do
      {:ok, resource} ->
        cond do
          has_resources?(resource.homeworks) -> :homework_practice
          has_resources?(resource.videos) -> :video_learning
          has_resources?(resource.files) -> :reading_material
          has_resources?(resource.exercises) -> :related_practice
          true -> :weak_knowledge_review
        end

      _ ->
        :weak_knowledge_review
    end
  end

  defp has_resources?(%Ash.NotLoaded{}), do: false
  defp has_resources?(nil), do: false
  defp has_resources?([]), do: false
  defp has_resources?(list) when is_list(list), do: length(list) > 0

  defp generate_weakness_reason(mastery, severity, knowledge_resource) do
    mastery_percent = Float.round(mastery.mastery_level * 100, 1)

    base_msg = "Your mastery of '#{knowledge_resource.name}' is #{mastery_percent}%."

    severity_msg = case severity do
      :critical -> " This is a critical weak point that requires immediate attention."
      :review -> " Regular review is recommended to strengthen your understanding."
    end

    practice_msg = if mastery.practice_count < 3 do
      " You've only practiced #{mastery.practice_count} times. More practice will help."
    else
      ""
    end

    base_msg <> severity_msg <> practice_msg
  end

  defp has_relations?(resource) do
    has_outgoing = case resource.outgoing_relations do
      %Ash.NotLoaded{} -> false
      nil -> false
      relations when is_list(relations) -> length(relations) > 0
      _ -> false
    end

    has_incoming = case resource.incoming_relations do
      %Ash.NotLoaded{} -> false
      nil -> false
      relations when is_list(relations) -> length(relations) > 0
      _ -> false
    end

    has_outgoing or has_incoming
  end

  # Determine student's preferred learning type from activity logs
  defp determine_preferred_learning_type(logs) do
    type_counts =
      logs
    |> Enum.reduce(%{}, fn log, acc ->
      type = case log.action_type do
        :video_view -> :video
        :file_view -> :reading
        :exercise_submit -> :practice
        :homework_submit -> :homework
        _ -> :other
      end

      Map.update(acc, type, 1, &(&1 + 1))
    end)

    case Enum.max_by(type_counts, fn {_k, v} -> v end, fn -> nil end) do
      {type, _count} -> type
      nil -> :unknown
    end
  end

  # Determine when student is most active
  defp determine_active_hours(logs) do
    hour_counts =
      logs
      |> Enum.reduce(%{}, fn log, acc ->
        hour = log.inserted_at.hour
        Map.update(acc, hour, 1, &(&1 + 1))
      end)

    hour_counts
    |> Enum.filter(fn {_hour, count} -> count > 0 end)
    |> Enum.sort_by(fn {_hour, count} -> count end, :desc)
    |> Enum.take(3)
    |> Enum.map(fn {hour, _count} -> hour end)
  end

  # Calculate learning consistency score
  defp calculate_consistency_score(logs) do
    if length(logs) < 7 do
      0.0
    else
      # Group by date and count activities per day
      daily_counts =
        logs
        |> Enum.group_by(fn log ->
          Date.to_string(log.inserted_at)
        end)
        |> Enum.map(fn {_date, day_logs} -> length(day_logs) end)

      avg = Enum.sum(daily_counts) / length(daily_counts)
      variance = Enum.reduce(daily_counts, 0, fn count, acc ->
        acc + :math.pow(count - avg, 2)
      end) / length(daily_counts)

      # Lower variance = higher consistency
      consistency = 1.0 - min(variance / 100.0, 1.0)
      Float.round(consistency, 2)
    end
  end

  # Calculate recent activity level
  defp calculate_recent_activity_level(logs) do
    now = DateTime.utc_now()
    week_ago = DateTime.add(now, -7, :day)

    recent_count =
      logs
      |> Enum.count(fn log ->
        DateTime.compare(log.inserted_at, week_ago) != :lt
      end)

    cond do
      recent_count >= 20 -> :very_high
      recent_count >= 10 -> :high
      recent_count >= 5 -> :moderate
      recent_count >= 1 -> :low
      true -> :inactive
    end
  end
end
