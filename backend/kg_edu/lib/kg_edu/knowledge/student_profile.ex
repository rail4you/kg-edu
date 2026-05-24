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
  获取学生分组任务评分统计
  返回该学生在指定课程中参与的所有分组任务的提交和评分信息。
  """
  def get_group_task_stats(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    # 1. 找到该学生在该课程中所在的小组
    groups = get_student_groups_in_course(student_id, course_id, tenant)

    # 2. 获取该课程的所有分组任务
    tasks = get_course_group_tasks(course_id, tenant)

    # 3. 获取该学生的所有提交记录
    submissions = get_student_submissions(student_id, course_id, tenant)

    # 4. 获取该课程所有学生的提交记录（用于计算班级平均）
    all_submissions = get_all_course_submissions(course_id, tenant)

    # 6. 汇总统计 - 使用每个任务的最好提交记录来计算分数
    task_stats = build_task_stats(tasks, submissions, all_submissions)

    scored_tasks = task_stats |> Enum.filter(fn t -> t.score != nil end)
    total_scored = length(scored_tasks)
    avg_score = if total_scored > 0 do
      Float.round(Enum.sum(Enum.map(scored_tasks, & &1.score)) / total_scored, 1)
    else
      nil
    end

    # 班级平均分 - 按学生+任务去重，每个学生每个任务取最佳提交
    best_by_student_task = all_submissions
    |> Enum.group_by(fn s -> {s.student_id, s.task_id} end)
    |> Enum.map(fn {_key, subs} -> pick_best_submission(subs) end)
    |> Enum.filter(fn s -> s != nil and s.score != nil end)

    class_avg = if length(best_by_student_task) > 0 do
      Float.round(Enum.sum(Enum.map(best_by_student_task, &(&1.score || 0))) / length(best_by_student_task), 1)
    else
      nil
    end

    # 小组信息
    group_info = case groups do
      [g | _] -> %{groupId: g.id, groupName: g.name}
      [] -> nil
    end

    # 任务类型分布
    type_distribution = tasks
    |> Enum.group_by(&(&1.task_type))
    |> Enum.map(fn {type, ts} -> %{type: task_type_label(type), count: length(ts)} end)

    summary = %{
      totalTasks: length(tasks),
      submittedCount: length(Enum.filter(task_stats, fn t -> t.submissionStatus in [:submitted, :graded] end)),
      gradedCount: total_scored,
      averageScore: avg_score,
      classAverageScore: class_avg,
      group: group_info,
      typeDistribution: type_distribution
    }

    {:ok, %{summary: summary, tasks: task_stats}}
  end

  defp get_student_groups_in_course(student_id, course_id, tenant) do
    query = KgEdu.GroupTask.Group
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.load(:members)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, groups} ->
        Enum.filter(groups, fn g ->
          Enum.any?(g.members || [], &(&1.id == student_id))
        end)
      _ -> []
    end
  end

  defp get_course_group_tasks(course_id, tenant) do
    query = KgEdu.GroupTask.Task
    |> Ash.Query.filter(course_id == ^course_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, tasks} -> tasks
      _ -> []
    end
  end

  defp get_student_submissions(student_id, course_id, tenant) do
    # Get all task submissions for this student in this course
    query = KgEdu.GroupTask.TaskSubmission
    |> Ash.Query.filter(student_id == ^student_id)
    |> Ash.Query.load(:task)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, submissions} ->
        # Filter to only those whose task belongs to the course
        Enum.filter(submissions, fn s ->
          s.task && s.task.course_id == course_id
        end)
      _ -> []
    end
  end

  defp get_all_course_submissions(course_id, tenant) do
    # Get all submissions for tasks in this course
    task_ids = get_course_group_tasks(course_id, tenant)
    |> Enum.map(& &1.id)

    if length(task_ids) == 0 do
      []
    else
      query = KgEdu.GroupTask.TaskSubmission
      |> Ash.Query.filter(task_id in ^task_ids)

      query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

      case Ash.read(query, authorize?: false) do
        {:ok, submissions} -> submissions
        _ -> []
      end
    end
  end

  defp build_task_stats(tasks, student_submissions, all_submissions) do
    # Group student's submissions by task_id, pick best per task
    submission_by_task = student_submissions
    |> Enum.group_by(& &1.task_id)

    # For class average: group ALL submissions by {student_id, task_id}, pick best per pair
    best_by_student_task = all_submissions
    |> Enum.group_by(fn s -> {s.student_id, s.task_id} end)
    |> Enum.map(fn {_key, subs} -> pick_best_submission(subs) end)
    |> Enum.filter(fn s -> s != nil end)
    |> Enum.group_by(& &1.task_id)

    tasks
    |> Enum.map(fn task ->
      task_subs = Map.get(submission_by_task, task.id, [])

      # Pick the student's best (latest graded) submission for this task
      my_sub = pick_best_submission(task_subs)

      # Class average: use only the best submission per student per task
      class_subs = Map.get(best_by_student_task, task.id, [])
      scored_class = Enum.filter(class_subs, fn s -> s.score != nil end)
      class_avg = if length(scored_class) > 0 do
        Float.round(Enum.sum(Enum.map(scored_class, &(&1.score || 0))) / length(scored_class), 1)
      else
        nil
      end

      %{
        taskId: task.id,
        taskTitle: task.title,
        taskType: task_type_label(task.task_type),
        status: task.status,
        dueDate: task.due_date,
        submissionStatus: if(my_sub, do: my_sub.status, else: :not_submitted),
        score: if(my_sub, do: my_sub.score),
        classAverage: class_avg,
        feedback: if(my_sub, do: my_sub.feedback),
        submittedAt: if(my_sub, do: my_sub.submitted_at)
      }
    end)
  end

  # Pick the best submission: prefer latest graded, then latest submitted, then latest
  # When a student submits multiple times, we want the most recent scored one.
  defp pick_best_submission([]), do: nil
  defp pick_best_submission([sub]), do: sub
  defp pick_best_submission(subs) do
    # Sort by updated_at descending to get the most recent first
    sorted = Enum.sort_by(subs, &(&1.updated_at || &1.inserted_at), {:desc, DateTime})
    Enum.find(sorted, & &1.status == :graded) ||
    Enum.find(sorted, & &1.status == :submitted) ||
    List.first(sorted)
  end

  defp task_type_label(:submission), do: "提交任务"
  defp task_type_label(:discussion), do: "讨论任务"
  defp task_type_label(:survey), do: "调查任务"
  defp task_type_label(:file_upload), do: "文件上传"
  defp task_type_label(other), do: to_string(other)

  @doc """
  获取能力维度评估数据（柱状图）
  """
  def get_ability_assessment(student_id, course_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, abilities} <- get_main_abilities(course_id, tenant),
         {:ok, masteries} <- get_student_masteries(student_id, course_id, tenant),
         {:ok, class_avg} <- get_class_ability_average(course_id, tenant) do
      
      data = Enum.flat_map(abilities, fn ability ->
        sub_abilities = case ability do
          %{sub_abilities: subs} when is_list(subs) -> subs
          _ -> []
        end

        if length(sub_abilities) == 0 do
          []
        else
          # Build a map from knowledge_resource_id to sub_ability for quick lookup
          sub_kr_map = sub_abilities
          |> Enum.flat_map(fn sa ->
            case Ash.load(sa, :knowledge_resources, tenant: tenant, authorize?: false) do
              {:ok, loaded} ->
                (loaded.knowledge_resources || [])
                |> Enum.map(fn kr -> {kr.id, sa} end)
              _ -> []
            end
          end)
          |> Map.new()

          # Group masteries by sub_ability
          mastery_by_sa = masteries
          |> Enum.filter(fn m ->
            Map.has_key?(sub_kr_map, m.knowledge_resource_id)
          end)
          |> Enum.group_by(fn m ->
            case Map.get(sub_kr_map, m.knowledge_resource_id) do
              nil -> nil
              sa -> sa.id
            end
          end)

          sub_abilities
          |> Enum.flat_map(fn sa ->
            related_masteries = Map.get(mastery_by_sa, sa.id, [])

            if length(related_masteries) == 0 do
              []
            else
              avg = Enum.sum(Enum.map(related_masteries, &(&1.mastery_level || 0))) / length(related_masteries)
              class_val = Map.get(class_avg, sa.id, 0.0)

              [%{
                ability: sa.name,
                parentAbility: ability.name,
                studentScore: Float.round(avg * 100, 1),
                classAverage: Float.round(class_val * 100, 1)
              }]
            end
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

  defp get_student_course_logs(student_id, course_id, tenant) do
    # Get activity logs for this student
    # We join with knowledge resource / file / video to filter by course
    # For now, get all student logs and filter by related resources
    query = KgEdu.Activity.ActivityLog
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, logs} ->
        # Filter logs to only those related to this course
        # by checking if the resource belongs to the course
        filter_logs_by_course(logs, course_id, tenant)
      _ -> []
    end
  end

  defp filter_logs_by_course(logs, nil, _tenant), do: logs
  defp filter_logs_by_course(logs, course_id, tenant) do
    # Get all knowledge resource IDs for this course
    kr_ids = case KgEdu.Knowledge.Resource
    |> Ash.Query.filter(course_id == ^course_id)
    |> (fn q -> if tenant, do: Ash.Query.set_tenant(q, tenant), else: q end).()
    |> Ash.read(authorize?: false) do
      {:ok, resources} -> Enum.map(resources, & &1.id)
      _ -> []
    end

    # Get file IDs for this course
    file_ids = case KgEdu.Courses.File
    |> Ash.Query.filter(course_id == ^course_id)
    |> (fn q -> if tenant, do: Ash.Query.set_tenant(q, tenant), else: q end).()
    |> Ash.read(authorize?: false) do
      {:ok, files} -> Enum.map(files, & &1.id)
      _ -> []
    end

    # Get video IDs for this course
    video_ids = case KgEdu.Courses.Video
    |> Ash.Query.filter(course_id == ^course_id)
    |> (fn q -> if tenant, do: Ash.Query.set_tenant(q, tenant), else: q end).()
    |> Ash.read(authorize?: false) do
      {:ok, videos} -> Enum.map(videos, & &1.id)
      _ -> []
    end

    course_resource_ids = MapSet.new(kr_ids ++ file_ids ++ video_ids)

    Enum.filter(logs, fn log ->
      MapSet.member?(course_resource_ids, log.resource_id)
    end)
  end

  defp get_main_abilities(course_id, tenant) do
    query = KgEdu.Knowledge.MainAbility
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.load(:sub_abilities)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_class_average_mastery(course_id, tenant) do
    # Get all student masteries for this course and compute per-knowledge-resource average
    query = KgEdu.Knowledge.StudentKnowledgeMastery
    |> Ash.Query.filter(knowledge_resource.course_id == ^course_id)
    |> Ash.Query.load(:knowledge_resource)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, masteries} ->
        averages = masteries
        |> Enum.group_by(& &1.knowledge_resource_id)
        |> Enum.map(fn {kr_id, ms} ->
          avg = Enum.sum(Enum.map(ms, &(&1.mastery_level || 0))) / length(ms)
          {kr_id, avg}
        end)
        |> Map.new()

        {:ok, averages}

      _ -> {:ok, %{}}
    end
  end

  defp get_class_ability_average(course_id, tenant) do
    with {:ok, abilities} <- get_main_abilities(course_id, tenant),
         {:ok, all_masteries} <- get_all_course_masteries(course_id, tenant) do
      sub_ability_kr_map = build_sub_ability_kr_map(abilities, tenant)

      averages = sub_ability_kr_map
      |> Enum.flat_map(fn {sub_ability_id, kr_ids} ->
        related = all_masteries |> Enum.filter(&(&1.knowledge_resource_id in kr_ids))
        if length(related) > 0 do
          avg = Enum.sum(Enum.map(related, &(&1.mastery_level || 0))) / length(related)
          [{sub_ability_id, avg}]
        else
          []
        end
      end)
      |> Map.new()

      {:ok, averages}
    else
      _ -> {:ok, %{}}
    end
  end

  defp get_ability_knowledge_ids(ability, tenant) do
    sub_abilities = case ability do
      %{sub_abilities: subs} when is_list(subs) -> subs
      _ ->
        case Ash.load(ability, :sub_abilities, tenant: tenant, authorize?: false) do
          {:ok, loaded} -> loaded.sub_abilities || []
          _ -> []
        end
    end

    sub_abilities
    |> Enum.flat_map(fn sa ->
      case Ash.load(sa, :knowledge_resources, tenant: tenant, authorize?: false) do
        {:ok, loaded} -> (loaded.knowledge_resources || []) |> Enum.map(& &1.id)
        _ -> []
      end
    end)
    |> Enum.uniq()
  end

  defp get_all_course_masteries(course_id, tenant) do
    query = KgEdu.Knowledge.StudentKnowledgeMastery
    |> Ash.Query.filter(knowledge_resource.course_id == ^course_id)
    |> Ash.Query.load(:knowledge_resource)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp build_sub_ability_kr_map(abilities, tenant) do
    abilities
    |> Enum.flat_map(fn ability ->
      sub_abilities = case ability do
        %{sub_abilities: subs} when is_list(subs) -> subs
        _ -> []
      end

      Enum.map(sub_abilities, fn sa ->
        kr_ids = case Ash.load(sa, :knowledge_resources, tenant: tenant, authorize?: false) do
          {:ok, loaded} -> (loaded.knowledge_resources || []) |> Enum.map(& &1.id)
          _ -> []
        end
        {sa.id, kr_ids}
      end)
    end)
  end

  defp calculate_overall_score(avg_mastery, activity_stats, exam_stats, attendance_rate) do
    mastery_score = avg_mastery * 40
    activity_score = (activity_stats.activityIndex || 0) / 100 * 20
    exam_score = (exam_stats.averageScore || 0) / 100 * 30
    attendance_score = (attendance_rate || 0) / 100 * 10

    Float.round(mastery_score + activity_score + exam_score + attendance_score, 1)
  end

  # ============================================================
  # 微专业维度学习统计
  # ============================================================

  @doc """
  获取学生在微专业维度的学习总览
  聚合该学生在其微专业所有关联课程中的学习数据
  """
  def get_micro_major_profile_overview(student_id, major_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, enrollments} <- get_student_major_enrollment(student_id, major_id, tenant),
         {:ok, course_ids} <- get_major_course_ids(major_id, tenant),
         {:ok, activity_stats} <- get_micro_major_activity_stats(student_id, course_ids, tenant),
         {:ok, mastery_stats} <- get_micro_major_mastery_stats(student_id, course_ids, tenant) do
      
      total_courses = length(course_ids)
      enrolled_courses = enrollments
      |> Enum.map(& &1.major_id)
      |> Enum.uniq()
      |> length()

      {:ok, %{
        studentId: student_id,
        majorId: major_id,
        totalCourses: total_courses,
        enrolledCourses: enrolled_courses,
        activity: activity_stats,
        knowledge: mastery_stats,
        completionRate: calculate_completion_rate(enrolled_courses, total_courses)
      }}
    end
  end

  @doc """
  获取微专业学习趋势数据
  聚合该学生在微专业所有关联课程中的活动日志，按周统计
  """
  def get_micro_major_learning_trend(student_id, major_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, course_ids} <- get_major_course_ids(major_id, tenant),
         {:ok, logs} <- get_micro_major_logs(student_id, course_ids, tenant) do
      
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
        
        # 按课程分组统计
        by_course = week_logs
        |> Enum.group_by(& &1.metadata["course_id"])
        |> Enum.map(fn {course_id, logs} ->
          %{courseId: course_id, count: length(logs)}
        end)
        
        %{week: week, videos: video_count, files: file_count, exercises: exercise_count, 
          total: length(week_logs), byCourse: by_course}
      end)
      |> Enum.sort_by(& &1.week)

      {:ok, weekly_data}
    end
  end

  @doc """
  获取微专业学生在各课程的进度
  """
  def get_micro_major_student_progress(major_id, opts) do
    tenant = Keyword.get(opts, :tenant)

    with {:ok, course_ids} <- get_major_course_ids(major_id, tenant),
         {:ok, enrollments} <- get_major_enrollments(major_id, tenant) do
      
      student_progress = Enum.map(enrollments, fn enrollment ->
        student_id = enrollment.student_id
        
        # 获取该学生在各课程的学习进度
        course_progress = course_ids
        |> Enum.map(fn course_id ->
          case get_course_progress(student_id, course_id, tenant) do
            {:ok, progress} -> %{courseId: course_id, progress: progress}
            _ -> %{courseId: course_id, progress: 0}
          end
        end)
        
        avg_progress = if length(course_progress) > 0 do
          Enum.sum(Enum.map(course_progress, & &1.progress)) / length(course_progress)
        else
          0
        end
        
        # 获取学生信息（只返回必要字段）
        student_info = case KgEdu.Accounts.User
        |> Ash.Query.filter(id == ^student_id)
        |> (fn q -> if tenant, do: Ash.Query.set_tenant(q, tenant), else: q end).()
        |> Ash.read_one(authorize?: false) do
          {:ok, user} when user != nil -> %{id: user.id, name: user.name, avatarUrl: user.avatar_url}
          _ -> %{id: student_id, name: nil}
        end
        
        Map.put(enrollment, :student, student_info)
        |> Map.put(:courseProgress, course_progress)
        |> Map.put(:avgProgress, Float.round(avg_progress, 1))
        |> Map.take([:id, :student_id, :status, :assigned_at, :student, :courseProgress, :avgProgress])
      end)

      {:ok, student_progress}
    end
  end

  # 私有辅助函数

  defp get_student_major_enrollment(student_id, major_id, tenant) do
    query = KgEdu.MajorAnalysis.MajorEnrollment
    |> Ash.Query.filter(student_id == ^student_id and major_id == ^major_id and status == :active)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_major_enrollments(major_id, tenant) do
    query = KgEdu.MajorAnalysis.MajorEnrollment
    |> Ash.Query.filter(major_id == ^major_id and status == :active)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_major_course_ids(major_id, tenant) do
    query = KgEdu.MajorAnalysis.MajorCourse
    |> Ash.Query.filter(major_id == ^major_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, courses} -> {:ok, Enum.map(courses, & &1.course_id)}
      error -> error
    end
  end

  defp get_micro_major_activity_stats(student_id, course_ids, tenant) when is_list(course_ids) do
    # 获取活动日志并按 course_id 过滤
    query = KgEdu.Activity.ActivityLog
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, logs} ->
        # 过滤出属于微专业课程的日志
        filtered_logs = Enum.filter(logs, fn log ->
          metadata_course_id = log.metadata && log.metadata["course_id"]
          metadata_course_id in course_ids or log.resource_id in course_ids
        end)
        
        video_count = Enum.count(filtered_logs, &(&1.action_type in [:video_view, :view]))
        file_count = Enum.count(filtered_logs, &(&1.action_type in [:file_view, :view, :download]))
        exercise_count = Enum.count(filtered_logs, &(&1.action_type in [:exercise_submit, :submit]))
        
        # 计算活动指数（简化计算）
        activity_index = min((video_count * 1 + file_count * 0.5 + exercise_count * 2) / 10 * 100, 100)
        
        {:ok, %{
          videoViews: video_count,
          fileViews: file_count,
          exercises: exercise_count,
          activityIndex: Float.round(activity_index, 1)
        }}
      
      _ -> {:ok, %{videoViews: 0, fileViews: 0, exercises: 0, activityIndex: 0}}
    end
  end

  defp get_micro_major_mastery_stats(student_id, course_ids, tenant) when is_list(course_ids) do
    query = KgEdu.Knowledge.StudentKnowledgeMastery
    |> Ash.Query.filter(student_id == ^student_id)
    |> Ash.Query.load(:knowledge_resource)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, masteries} ->
        # 只统计属于微专业课程的知识点
        relevant_masteries = Enum.filter(masteries, fn m ->
          m.knowledge_resource && m.knowledge_resource.course_id in course_ids
        end)
        
        total = length(relevant_masteries)
        mastered = Enum.count(relevant_masteries, &((&1.mastery_level || 0) >= 0.7))
        weak = Enum.count(relevant_masteries, &((&1.mastery_level || 0) < 0.6))
        avg = if total > 0 do
          Enum.sum(Enum.map(relevant_masteries, &(&1.mastery_level || 0))) / total
        else
          0
        end
        
        {:ok, %{
          total: total,
          mastered: mastered,
          weak: weak,
          averageMastery: Float.round(avg * 100, 1)
        }}
      
      _ -> {:ok, %{total: 0, mastered: 0, weak: 0, averageMastery: 0}}
    end
  end

  defp get_micro_major_logs(student_id, course_ids, tenant) when is_list(course_ids) do
    query = KgEdu.Activity.ActivityLog
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    Ash.read(query, authorize?: false)
  end

  defp get_course_progress(student_id, course_id, tenant) do
    # 计算单门课程的学习进度
    # 优先使用 metadata 中的 major_id 识别，否则按 course_id 匹配
    query = KgEdu.Activity.ActivityLog
    |> Ash.Query.filter(user_id == ^student_id)

    query = if tenant, do: Ash.Query.set_tenant(query, tenant), else: query

    case Ash.read(query, authorize?: false) do
      {:ok, logs} ->
        # 获取课程知识点总数
        kr_count = case KgEdu.Knowledge.Resource
        |> Ash.Query.filter(course_id == ^course_id)
        |> (fn q -> if tenant, do: Ash.Query.set_tenant(q, tenant), else: q end).()
        |> Ash.read(authorize?: false) do
          {:ok, resources} -> length(resources)
          _ -> 0
        end
        
        # 过滤出该课程的活动
        relevant_logs = Enum.filter(logs, fn log ->
          metadata_course_id = log.metadata && log.metadata["course_id"]
          metadata_course_id == course_id or log.resource_id == course_id
        end)
        
        # 简单进度计算：已学习的知识点 / 总知识点
        progress = if kr_count > 0 do
          min(length(relevant_logs) / kr_count * 50, 100)
        else
          # 如果没有知识点数据，按活动数估算
          min(length(relevant_logs) * 2, 100)
        end
        
        {:ok, Float.round(progress, 1)}
      
      _ -> {:ok, 0}
    end
  end

  defp calculate_completion_rate(enrolled, total) do
    if total > 0 do
      Float.round(enrolled / total * 100, 1)
    else
      0
    end
  end
end
