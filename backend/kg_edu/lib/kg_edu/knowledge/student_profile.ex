defmodule KgEdu.Knowledge.StudentProfile do
  @moduledoc """
  学生学情画像聚合服务。
  整合多维度学习数据，构建动态数字画像。
  
  数据源：
  - 知识点掌握度 (StudentKnowledgeMastery)
  - 考试成绩 (StudentExam)
  - 活动日志 (ActivityLog)
  - 能力维度 (MainAbility + SubAbility)
  - 签到记录 (CheckInRecord)
  """

  require Ash.Query
  require Logger

  @doc """
  获取学生画像总览数据
  """
  def get_student_profile_overview(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, masteries} <- get_student_masteries(student_id, course_id, tenant),
         {:ok, activity_stats} <- get_student_activity_stats(student_id, course_id, tenant),
         {:ok, exam_stats} <- get_student_exam_stats(student_id, course_id, tenant),
         {:ok, attendance_rate} <- get_attendance_rate(student_id, course_id, tenant) do
      
      total_knowledge = length(masteries)
      mastered_count = Enum.count(masteries, fn m -> (m.mastery_level || 0) >= 0.7 end)
      weak_count = Enum.count(masteries, fn m -> (m.mastery_level || 0) < 0.6 end)
      avg_mastery = if total_knowledge > 0 do
        Enum.sum(Enum.map(masteries, &(&1.mastery_level || 0))) / total_knowledge
      else
        0.0
      end

      {:ok, %{
        studentId: student_id,
        courseId: course_id,
        knowledge: %{
          total: total_knowledge,
          mastered: mastered_count,
          weak: weak_count,
          averageMastery: Float.round(avg_mastery * 100, 1)
        },
        activity: activity_stats,
        exam: exam_stats,
        attendanceRate: attendance_rate,
        overallScore: calculate_overall_score(avg_mastery, activity_stats, exam_stats, attendance_rate)
      }}
    end
  end

  @doc """
  获取知识掌握雷达图数据（按主能力维度聚合）
  """
  def get_knowledge_radar(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, abilities} <- get_main_abilities(course_id, tenant),
         {:ok, masteries} <- get_student_masteries(student_id, course_id, tenant),
         {:ok, class_avg} <- get_class_average_mastery(course_id, tenant) do
      
      # Group knowledge resources by main ability and calculate average
      radar_data = Enum.map(abilities, fn ability ->
        # Get knowledge resources linked to these sub-abilities
        related_mastery = masteries
        |> Enum.filter(fn m ->
          # Check if this knowledge resource belongs to this ability
          kr = m.knowledge_resource
          kr && kr.id in get_ability_knowledge_ids(ability, tenant)
        end)

        avg = if length(related_mastery) > 0 do
          Enum.sum(Enum.map(related_mastery, &(&1.mastery_level || 0))) / length(related_mastery)
        else
          0.0
        end

        class_avg_val = Map.get(class_avg, ability.id, 0.0)

        %{
          ability: ability.name,
          studentScore: Float.round(avg * 100, 1),
          classAverage: Float.round(class_avg_val * 100, 1)
        }
      end)

      {:ok, radar_data}
    end
  end

  @doc """
  获取学习趋势数据（按周聚合活动日志）
  """
  def get_learning_trend(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    logs = get_student_course_logs(student_id, course_id, tenant)

    # Group logs by week
    weekly_data = logs
    |> Enum.group_by(fn log ->
      date = log.inserted_at || DateTime.utc_now()
      week_start = Date.beginning_of_week(Date.new!(date.year, date.month, date.day))
      "#{week_start.year}-W#{String.pad_leading(to_string(Date.day_of_week(week_start)), 2, "0")}"
    end)
    |> Enum.map(fn {week, week_logs} ->
      video_count = Enum.count(week_logs, &(&1.action_type in [:video_view, :view]))
      file_count = Enum.count(week_logs, &(&1.action_type in [:file_view, :view, :download]))
      exercise_count = Enum.count(week_logs, &(&1.action_type in [:exercise_submit, :submit]))
      
      %{week: week, videos: video_count, files: file_count, exercises: exercise_count, total: length(week_logs)}
    end)
    |> Enum.sort_by(& &1.week)

    {:ok, weekly_data}
  end

  @doc """
  获取薄弱知识点列表
  """
  def get_weak_knowledge_points(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)
    threshold = Keyword.get(opts, :threshold, 0.6)

    case get_student_masteries(student_id, course_id, tenant) do
      {:ok, masteries} ->
        weak_points = masteries
        |> Enum.filter(fn m -> (m.mastery_level || 0) < threshold end)
        |> Enum.sort_by(&(&1.mastery_level || 0))
        |> Enum.map(fn m ->
          %{
            id: m.knowledge_resource_id,
            name: if(m.knowledge_resource, do: m.knowledge_resource.name, else: "未知知识点"),
            masteryLevel: Float.round((m.mastery_level || 0) * 100, 1),
            lastStudied: m.updated_at
          }
        end)

        {:ok, weak_points}

      error -> error
    end
  end

  @doc """
  获取学习行为分布（饼图数据）
  """
  def get_activity_distribution(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)
    logs = get_student_course_logs(student_id, course_id, tenant)

    video_count = Enum.count(logs, &(&1.action_type in [:video_view, :view] and &1.resource_type in ["KgEdu.Courses.Video", "Video"]))
    file_count = Enum.count(logs, &(&1.action_type in [:file_view, :view, :download] and &1.resource_type in ["KgEdu.Courses.File", "File"]))
    exercise_count = Enum.count(logs, &(&1.action_type in [:exercise_submit, :submit] and &1.resource_type in ["KgEdu.Knowledge.Exercise", "Exercise"]))
    homework_count = Enum.count(logs, &(&1.action_type in [:homework_submit, :submit] and &1.resource_type in ["KgEdu.Knowledge.Homework", "Homework"]))
    other = length(logs) - video_count - file_count - exercise_count - homework_count

    {:ok, [
      %{type: "视频学习", count: video_count},
      %{type: "资料阅读", count: file_count},
      %{type: "练习答题", count: exercise_count},
      %{type: "作业提交", count: homework_count},
      %{type: "其他", count: max(other, 0)}
    ]}
  end

  @doc """
  获取能力维度评估数据（柱状图）
  """
  def get_ability_assessment(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, abilities} <- get_main_abilities(course_id, tenant),
         {:ok, masteries} <- get_student_masteries(student_id, course_id, tenant),
         {:ok, class_avg} <- get_class_ability_average(course_id, tenant) do
      
      data = Enum.flat_map(abilities, fn ability ->
        sub_abilities = ability.sub_abilities || []
        if length(sub_abilities) == 0 do
          []
        else
          Enum.map(sub_abilities, fn sa ->
            # Calculate mastery for this sub-ability
            related_masteries = masteries
            |> Enum.filter(fn m ->
              kr = m.knowledge_resource
              kr && kr.sub_ability_id == sa.id
            end)

            avg = if length(related_masteries) > 0 do
              Enum.sum(Enum.map(related_masteries, &(&1.mastery_level || 0))) / length(related_masteries)
            else
              0.0
            end

            class_val = Map.get(class_avg, sa.id, 0.0)

            %{
              ability: sa.name,
              parentAbility: ability.name,
              studentScore: Float.round(avg * 100, 1),
              classAverage: Float.round(class_val * 100, 1)
            }
          end)
        end
      end)

      {:ok, data}
    end
  end

  # Private helpers

  defp get_student_masteries(student_id, course_id, tenant) do
    query = KgEdu.Knowledge.StudentKnowledgeMastery
    |> Ash.Query.filter(student_id == ^student_id)
    |> Ash.Query.load(:knowledge_resource)

    query = if course_id do
      Ash.Query.filter(query, knowledge_resource.course_id == ^course_id)
    else
      query
    end

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_student_activity_stats(student_id, course_id, tenant) do
    logs = get_student_course_logs(student_id, course_id, tenant)
    
    {:ok, %{
      totalActivities: length(logs),
      videoViews: Enum.count(logs, &(&1.action_type in [:video_view, :view])),
      fileViews: Enum.count(logs, &(&1.action_type in [:file_view, :view, :download])),
      exerciseSubmissions: Enum.count(logs, &(&1.action_type in [:exercise_submit, :submit])),
      homeworkSubmissions: Enum.count(logs, &(&1.action_type in [:homework_submit, :submit])),
      activityIndex: min(length(logs) * 2, 100)  # Simplified activity index
    }}
  end

  defp get_student_exam_stats(student_id, course_id, tenant) do
    query = KgEdu.Knowledge.StudentExam
    |> Ash.Query.filter(student_id == ^student_id)
    |> Ash.Query.filter(exam.course_id == ^course_id)
    |> Ash.Query.load(:exam)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, exams} ->
        scores = Enum.map(exams, &(&1.score || 0))
        {:ok, %{
          totalExams: length(exams),
          averageScore: if(length(scores) > 0, do: Float.round(Enum.sum(scores) / length(scores), 1), else: 0.0),
          highestScore: if(length(scores) > 0, do: Enum.max(scores), else: 0.0),
          lowestScore: if(length(scores) > 0, do: Enum.min(scores), else: 0.0)
        }}
      error -> error
    end
  end

  defp get_attendance_rate(student_id, _course_id, tenant) do
    query = KgEdu.Attendance.CheckInRecord
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, records} ->
        # Simple rate calculation
        {:ok, if(length(records) > 0, do: min(length(records) * 10, 100.0), else: 0.0)}
      _ -> {:ok, 0.0}
    end
  end

  defp get_student_course_logs(student_id, _course_id, tenant) do
    query = KgEdu.Activity.ActivityLog
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, logs} -> logs
      _ -> []
    end
  end

  defp get_main_abilities(course_id, tenant) do
    query = KgEdu.Knowledge.MainAbility
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.load(:sub_abilities)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_class_average_mastery(_course_id, _tenant) do
    # Simplified - would need to aggregate across all students
    {:ok, %{}}
  end

  defp get_class_ability_average(_course_id, _tenant) do
    {:ok, %{}}
  end

  defp get_ability_knowledge_ids(_ability, _tenant) do
    # Simplified - would need to query knowledge resources linked to abilities
    []
  end

  defp calculate_overall_score(avg_mastery, activity_stats, exam_stats, attendance_rate) do
    mastery_score = avg_mastery * 40
    activity_score = (activity_stats.activityIndex || 0) / 100 * 20
    exam_score = (exam_stats.averageScore || 0) / 100 * 30
    attendance_score = (attendance_rate || 0) / 100 * 10

    Float.round(mastery_score + activity_score + exam_score + attendance_score, 1)
  end
end
