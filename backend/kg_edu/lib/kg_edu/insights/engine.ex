defmodule KgEdu.Insights.Engine do
  @moduledoc """
  P4: 数据智能引擎 — 规则意图识别 + Ash 直读教学运行数据。

  数据集：
  - "signin": 院系课程签到率（用户院系 × 近 N 天签到记录）
  - "upload": 各院系资源上传量（文件 × 创建人院系 × 时间范围）
  - "activity": 课堂活动开展（行为日志按类型聚合 + 签到场次）
  """

  require Logger
  require Ash.Query

  @datasets ["signin", "upload", "activity", "course", "knowledge", "homework", "exam", "user"]

  @activity_labels %{
    "file_view" => "文件查看",
    "video_view" => "视频观看",
    "exercise_submit" => "习题提交",
    "homework_submit" => "作业提交",
    "mm_video_view" => "微专业视频观看",
    "mm_exercise_submit" => "微专业习题提交",
    "mm_resource_download" => "微专业资源下载",
    "notice" => "通知",
    "view" => "浏览",
    "download" => "下载"
  }

  defp action_label(type), do: Map.get(@activity_labels, to_string(type), to_string(type))

  def datasets, do: @datasets

  # ── 问答 ───────────────────────────────────────────────────────────

  def ask(question, tenant, opts \\ []) do
    days = Keyword.get(opts, :days, 30) || 30
    q = question || ""

    cond do
      contains_any?(q, ["概览", "总览", "整体", "统计", "KPI", "kpi"]) ->
        {:ok, overview_answer(kpi(tenant))}

      contains_any?(q, ["知识点", "知识"]) ->
        data = knowledge_stats(tenant)

        {:ok,
         %{
           intent: "knowledge",
           question: question,
           summary: "共 #{data.stats.total} 个知识点，覆盖 #{data.stats.categories} 个分类",
           columns: ["分类", "知识点数"],
           rows: Enum.map(data.rows, &[&1.category, &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("知识点分布", data.stats)
         }}

      contains_any?(q, ["作业", "任务"]) ->
        data = homework_stats(tenant)

        {:ok,
         %{
           intent: "homework",
           question: question,
           summary: "共 #{data.stats.total} 份作业",
           columns: ["课程", "作业数"],
           rows: Enum.map(data.rows, &[&1.course, &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("作业分布", data.stats)
         }}

      contains_any?(q, ["考试", "试卷"]) ->
        data = exam_stats(tenant)

        {:ok,
         %{
           intent: "exam",
           question: question,
           summary: "共 #{data.stats.total} 场考试/试卷",
           columns: ["课程", "考试数"],
           rows: Enum.map(data.rows, &[&1.course, &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("考试分布", data.stats)
         }}

      contains_any?(q, ["课程", "教学"]) ->
        data = course_stats(tenant)

        {:ok,
         %{
           intent: "course",
           question: question,
           summary: "共 #{data.stats.courses} 门课程，关联 #{data.stats.knowledge} 个知识点",
           columns: ["课程", "知识点数"],
           rows: Enum.map(data.rows, &[&1.course, &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("课程知识点分布", data.stats)
         }}

      contains_any?(q, ["签到", "考勤", "出勤"]) ->
        department = extract_department(q)
        data = signin_rate(tenant, department: department, days: days)

        {:ok,
         %{
           intent: "signin",
           question: question,
           summary: signin_summary(data),
           columns: ["姓名", "院系", "签到次数"],
           rows: Enum.map(data.rows, &[&1.name, &1.department, &1.checkins]),
           stats: data.stats,
           ai_insight: ai_insight("签到率", data.stats)
         }}

      contains_any?(q, ["上传", "资源"]) ->
        data = upload_stats(tenant, days: days)

        {:ok,
         %{
           intent: "upload",
           question: question,
           summary: upload_summary(data),
           columns: ["院系", "上传量"],
           rows: Enum.map(data.rows, &[&1.department, &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("资源上传", data.stats)
         }}

      contains_any?(q, ["活动", "课堂"]) ->
        data = activity_stats(tenant, days: days)

        {:ok,
         %{
           intent: "activity",
           question: question,
           summary: activity_summary(data),
           columns: ["活动类型", "次数"],
           rows: Enum.map(data.rows, &[action_label(&1.type), &1.count]),
           stats: data.stats,
           ai_insight: ai_insight("课堂活动", data.stats)
         }}

      true ->
        {:ok,
         %{
           intent: "unknown",
           question: question,
           summary: "暂不支持该问题。试试：某院系近1个月课程签到率 / 各院系资源上传量统计 / 本学期课堂活动开展情况",
           columns: [],
           rows: [],
           stats: %{},
           ai_insight: nil
         }}
    end
  end

  # ── 报告 ───────────────────────────────────────────────────────────

  def build_report(theme, tenant, opts \\ []) do
    days = Keyword.get(opts, :days, 30) || 30
    outline = Keyword.get(opts, :outline) || default_outline(theme)

    sections =
      Enum.map(outline, fn item ->
        dataset = item["dataset"] || item[:dataset] || "activity"
        {table, chart} = section_data(dataset, tenant, days)

        %{
          title: item["title"] || item[:title] || dataset,
          description: item["description"] || item[:description] || "",
          text: section_text(theme, dataset, table),
          chart: chart,
          table: table
        }
      end)

    {:ok, %{title: theme, outline: outline, sections: sections}}
  end

  # ── 报表 ───────────────────────────────────────────────────────────

  def build_table(dataset, tenant, opts \\ []) do
    days = Keyword.get(opts, :days, 30) || 30
    fields = Keyword.get(opts, :fields)
    sort_by = Keyword.get(opts, :sort_by)
    sort_dir = Keyword.get(opts, :sort_dir, "desc")

    if dataset in @datasets do
      %{columns: columns, rows: rows} = dataset_table(dataset, tenant, days)
      rows = project_fields(rows, columns, fields)
      rows = sort_rows(rows, sort_by || default_sort(dataset), sort_dir)
      cols = if fields, do: fields, else: columns
      {:ok, %{dataset: dataset, columns: cols, rows: rows, total: length(rows)}}
    else
      {:error, "未知数据集 #{dataset}，可选：#{Enum.join(@datasets, "/")}"}
    end
  end

  # ── 数据集实现 ─────────────────────────────────────────────────────

  defp signin_rate(tenant, opts) do
    days = Keyword.get(opts, :days, 30)
    department = Keyword.get(opts, :department)
    cutoff = DateTime.add(DateTime.utc_now(), -days * 86_400, :second)
    base = [tenant: tenant, authorize?: false]

    users =
      case KgEdu.Accounts.User.get_users(base) do
        {:ok, list} -> list
        _ -> []
      end
      |> Enum.filter(&(&1.role in [:user, nil, "user"]))
      |> Enum.filter(fn u -> is_nil(department) or dept_of(u) =~ department end)

    records =
      case KgEdu.Attendance.CheckInRecord.list_records(base) do
        {:ok, list} -> list
        _ -> []
      end
      |> Enum.filter(fn r ->
        r.checked_in_at && DateTime.compare(r.checked_in_at, cutoff) != :lt
      end)

    by_user = Enum.group_by(records, & &1.user_id)

    rows =
      Enum.map(users, fn u ->
        %{name: u.name || u.member_id, department: dept_of(u), checkins: length(Map.get(by_user, u.id, []))}
      end)

    active = Enum.count(rows, &(&1.checkins > 0))
    total = length(rows)

    %{
      rows: rows,
      stats: %{
        department: department || "全部院系",
        days: days,
        total_users: total,
        active_users: active,
        rate: if(total > 0, do: Float.round(active / total * 100, 1), else: 0.0)
      }
    }
  end

  defp upload_stats(tenant, opts) do
    days = Keyword.get(opts, :days, 30)
    cutoff = DateTime.add(DateTime.utc_now(), -days * 86_400, :second)
    base = [tenant: tenant, authorize?: false]

    files =
      case KgEdu.Courses.File.list_files(base) do
        {:ok, list} -> list
        _ -> []
      end
      |> Enum.filter(fn f -> f.inserted_at && DateTime.compare(f.inserted_at, cutoff) != :lt end)

    users =
      case KgEdu.Accounts.User.get_users(base) do
        {:ok, list} -> Map.new(list, &{&1.id, &1})
        _ -> %{}
      end

    rows =
      files
      |> Enum.group_by(fn f ->
        case Map.get(users, f.created_by_id) do
          nil -> "未归属"
          u -> dept_of(u)
        end
      end)
      |> Enum.map(fn {dept, fs} -> %{department: dept, count: length(fs)} end)
      |> Enum.sort_by(& &1.count, :desc)

    %{rows: rows, stats: %{days: days, total: length(files), departments: length(rows)}}
  end

  defp activity_stats(tenant, opts) do
    days = Keyword.get(opts, :days, 30)
    base = [tenant: tenant, authorize?: false]

    logs =
      try do
        case KgEdu.Activity.ActivityLog |> Ash.Query.new() |> Ash.read(base) do
          {:ok, list} -> list
          _ -> []
        end
      rescue
        _ -> []
      end

    rows =
      logs
      |> Enum.group_by(&(to_string(&1.action_type) || "未知"))
      |> Enum.map(fn {type, ls} -> %{type: type, count: length(ls)} end)
      |> Enum.sort_by(& &1.count, :desc)

    sessions =
      case KgEdu.Attendance.CheckInSession.list_sessions(base) do
        {:ok, list} -> length(list)
        _ -> 0
      end

    %{rows: rows, stats: %{days: days, total: length(logs), sessions: sessions}}
  end

  # ── 报告组装 ───────────────────────────────────────────────────────

  defp default_outline(theme) do
    if contains_any?(theme, ["课程"]) do
      [
        %{title: "课程与知识点概览", dataset: "course", description: "各课程关联知识点数"},
        %{title: "知识点分类分布", dataset: "knowledge", description: "知识点按分类分布"},
        %{title: "结论与建议", dataset: "course", description: "基于数据的教学建议"}
      ]
    else
      [
        %{title: "课堂活动类型分布", dataset: "activity", description: "各类课堂活动次数"},
        %{title: "课程与知识点概览", dataset: "course", description: "各课程关联知识点数"},
        %{title: "结论与建议", dataset: "activity", description: "基于数据的建议"}
      ]
    end
  end

  defp section_data(dataset, tenant, days) do
    %{columns: columns, rows: rows} = dataset_table(dataset, tenant, days)
    table = %{columns: columns, rows: rows}
    chart = bar_chart(columns, rows)
    {table, chart}
  end

  defp dataset_table("signin", tenant, _days) do
    base = [tenant: tenant, authorize?: false]
    courses = all_courses(tenant)

    enrollments =
      case KgEdu.Courses.CourseEnrollment.list_enrollments(base) do
        {:ok, list} -> list
        _ -> []
      end

    by_course = Enum.group_by(enrollments, & &1.course_id)

    rows =
      courses
      |> Enum.map(fn c ->
        %{"课程" => c.title || "未命名课程", "签到次数" => length(Map.get(by_course, c.id, []))}
      end)
      |> Enum.sort_by(& &1["签到次数"], :desc)

    %{columns: ["课程", "签到次数"], rows: rows}
  end

  defp dataset_table("upload", tenant, days) do
    data = upload_stats(tenant, days: days)
    %{columns: ["院系", "上传量"], rows: Enum.map(data.rows, &%{"院系" => &1.department, "上传量" => &1.count})}
  end

  defp dataset_table("course", tenant, _days) do
    data = course_stats(tenant)
    %{columns: ["课程", "知识点数"], rows: Enum.map(data.rows, &%{"课程" => &1.course, "知识点数" => &1.count})}
  end

  defp dataset_table("knowledge", tenant, _days) do
    data = knowledge_stats(tenant)
    %{columns: ["分类", "知识点数"], rows: Enum.map(data.rows, &%{"分类" => &1.category, "知识点数" => &1.count})}
  end

  defp dataset_table("homework", tenant, _days) do
    data = homework_stats(tenant)
    %{columns: ["课程", "作业数"], rows: Enum.map(data.rows, &%{"课程" => &1.course, "作业数" => &1.count})}
  end

  defp dataset_table("exam", tenant, _days) do
    data = exam_stats(tenant)
    %{columns: ["课程", "考试数"], rows: Enum.map(data.rows, &%{"课程" => &1.course, "考试数" => &1.count})}
  end

  defp dataset_table(_, tenant, days) do
    data = activity_stats(tenant, days: days)
    %{columns: ["活动类型", "次数"], rows: Enum.map(data.rows, &%{"活动类型" => action_label(&1.type), "次数" => &1.count})}
  end

  defp section_text(theme, dataset, table) do
    "本节围绕「#{theme}」分析#{dataset_label(dataset)}数据，共 #{length(table.rows)} 条记录。" <>
      "详见下方统计图与数据表。"
  end

  @dataset_labels %{
    "signin" => "课程签到",
    "upload" => "资源上传",
    "activity" => "课堂活动",
    "course" => "课程知识点",
    "knowledge" => "知识点分类",
    "homework" => "作业",
    "exam" => "考试",
    "user" => "用户"
  }

  defp dataset_label(dataset), do: Map.get(@dataset_labels, to_string(dataset), to_string(dataset))

  defp bar_chart(columns, rows) do
    if length(columns) >= 2 do
      [label_col, value_col | _] = columns

      %{
        "title" => %{"text" => label_col, "left" => "center"},
        "tooltip" => %{},
        "xAxis" => %{"type" => "category", "data" => Enum.map(rows, &to_string(&1[label_col]))},
        "yAxis" => %{"type" => "value"},
        "series" => [%{"type" => "bar", "data" => Enum.map(rows, & &1[value_col])}]
      }
    else
      nil
    end
  end

  # ── 数据总览 (KPI) ────────────────────────────────────────────────

  def kpi(tenant) do
    base = [tenant: tenant, authorize?: false]

    %{
      courses: length(all_courses(tenant)),
      knowledge: count_of(KgEdu.Knowledge.Resource, tenant),
      homeworks: count_of(KgEdu.Knowledge.Homework, tenant),
      exams: count_of(KgEdu.Knowledge.Exam, tenant),
      files: count_of(KgEdu.Courses.File, tenant),
      classes: count_of(KgEdu.Accounts.Class, tenant),
      activity_logs: count_of(KgEdu.Activity.ActivityLog, tenant),
      users: user_role_counts(tenant)
    }
  end

  defp all_courses(tenant) do
    base = [tenant: tenant, authorize?: false]

    case KgEdu.Courses.Course.get_all_courses(base) do
      {:ok, list} -> list
      _ -> []
    end
  end

  defp overview_answer(k) do
    %{
      intent: "overview",
      question: "数据总览",
      summary:
        "系统当前共 #{k.courses} 门课程、#{k.knowledge} 个知识点、#{k.homeworks} 份作业、#{k.exams} 场考试、#{k.files} 个资源文件、#{k.activity_logs} 条课堂活动记录；用户 #{k.users.total} 人（学生 #{k.users.students}、教师/管理员 #{k.users.staff}），共 #{k.classes} 个班级。",
      kpis: [
        %{label: "课程", value: k.courses, suffix: "门"},
        %{label: "知识点", value: k.knowledge, suffix: "个"},
        %{label: "作业", value: k.homeworks, suffix: "份"},
        %{label: "考试", value: k.exams, suffix: "场"},
        %{label: "资源文件", value: k.files, suffix: "个"},
        %{label: "学生", value: k.users.students, suffix: "人"},
        %{label: "教师/管理员", value: k.users.staff, suffix: "人"},
        %{label: "班级", value: k.classes, suffix: "个"},
        %{label: "课堂活动", value: k.activity_logs, suffix: "条"}
      ],
      columns: ["指标", "数值"],
      rows: [
        ["课程", k.courses],
        ["知识点", k.knowledge],
        ["作业", k.homeworks],
        ["考试", k.exams],
        ["资源文件", k.files],
        ["学生", k.users.students],
        ["教师/管理员", k.users.staff],
        ["班级", k.classes],
        ["课堂活动", k.activity_logs]
      ],
      stats: %{},
      ai_insight: ai_insight("整体教学运行", k)
    }
  end

  defp count_of(resource, tenant) do
    base = [tenant: tenant, authorize?: false]

    case resource |> Ash.Query.new() |> Ash.count(base) do
      {:ok, n} -> n
      _ -> 0
    end
  end

  defp user_role_counts(tenant) do
    base = [tenant: tenant, authorize?: false]

    case KgEdu.Accounts.User.get_users(base) do
      {:ok, list} ->
        %{
          students: Enum.count(list, &(&1.role in [:user, "user"])),
          staff: Enum.count(list, &(&1.role in [:teacher, "teacher", :admin, "admin"])),
          total: length(list)
        }

      _ ->
        %{students: 0, staff: 0, total: 0}
    end
  end

  defp read_all(resource, base) do
    case resource |> Ash.Query.new() |> Ash.read(base) do
      {:ok, list} -> list
      _ -> []
    end
  end

  defp course_stats(tenant) do
    base = [tenant: tenant, authorize?: false]
    courses = all_courses(tenant)
    knowledge = read_all(KgEdu.Knowledge.Resource, base)
    by_course = Enum.group_by(knowledge, & &1.course_id)

    rows =
      Enum.map(courses, fn c ->
        %{course: c.title || "未命名课程", count: length(Map.get(by_course, c.id, []))}
      end)
      |> Enum.sort_by(& &1.count, :desc)

    %{rows: rows, stats: %{courses: length(courses), knowledge: length(knowledge)}}
  end

  defp knowledge_stats(tenant) do
    base = [tenant: tenant, authorize?: false]
    ks = read_all(KgEdu.Knowledge.Resource, base)

    rows =
      ks
      |> Enum.group_by(&(&1.category || "未分类"))
      |> Enum.map(fn {cat, list} -> %{category: cat, count: length(list)} end)
      |> Enum.sort_by(& &1.count, :desc)

    %{rows: rows, stats: %{total: length(ks), categories: length(rows)}}
  end

  defp homework_stats(tenant) do
    base = [tenant: tenant, authorize?: false]
    hs = read_all(KgEdu.Knowledge.Homework, base)
    courses = Map.new(all_courses(tenant), &{&1.id, &1.title || &1.name})

    rows =
      hs
      |> Enum.group_by(&Map.get(courses, &1.course_id, "未归属课程"))
      |> Enum.map(fn {c, list} -> %{course: c, count: length(list)} end)
      |> Enum.sort_by(& &1.count, :desc)

    %{rows: rows, stats: %{total: length(hs)}}
  end

  defp exam_stats(tenant) do
    base = [tenant: tenant, authorize?: false]
    es = read_all(KgEdu.Knowledge.Exam, base)
    courses = Map.new(all_courses(tenant), &{&1.id, &1.title || &1.name})

    rows =
      es
      |> Enum.group_by(&Map.get(courses, &1.course_id, "未归属课程"))
      |> Enum.map(fn {c, list} -> %{course: c, count: length(list)} end)
      |> Enum.sort_by(& &1.count, :desc)

    %{rows: rows, stats: %{total: length(es)}}
  end

  # ── 小工具 ─────────────────────────────────────────────────────────

  defp contains_any?(text, keywords), do: Enum.any?(keywords, &String.contains?(text || "", &1))

  defp dept_of(user) do
    user.colledge || user.school || user.major || "未归属"
  end

  defp extract_department(q) do
    case Regex.run(~r/(.+?)(近\d+个?月|课程签到率|签到率|的)/u, q) do
      [_, dept, _] ->
        dept = String.trim(dept)
        if dept == "", do: nil, else: dept

      _ ->
        nil
    end
  end

  defp signin_summary(data) do
    s = data.stats
    "#{s.department}近#{s.days}天：#{s.active_users}/#{s.total_users} 人参与签到，签到率 #{s.rate}%"
  end

  defp upload_summary(data) do
    s = data.stats
    "近#{s.days}天共上传 #{s.total} 个资源，覆盖 #{s.departments} 个院系"
  end

  defp activity_summary(data) do
    s = data.stats
    "近#{s.days}天共 #{s.total} 条课堂活动记录，签到场次 #{s.sessions} 场"
  end

  defp project_fields(rows, _columns, nil), do: rows

  defp project_fields(rows, _columns, fields) do
    Enum.map(rows, &Map.take(&1, fields))
  end

  defp default_sort("signin"), do: "签到次数"
  defp default_sort("upload"), do: "上传量"
  defp default_sort("course"), do: "知识点数"
  defp default_sort("knowledge"), do: "知识点数"
  defp default_sort("homework"), do: "作业数"
  defp default_sort("exam"), do: "考试数"
  defp default_sort(_), do: "次数"

  defp sort_rows(rows, nil, _), do: rows

  defp sort_rows(rows, key, dir) do
    sorted = Enum.sort_by(rows, &Map.get(&1, key, 0))
    if dir == "asc", do: sorted, else: Enum.reverse(sorted)
  end

  defp ai_insight(topic, stats) do
    prompt = "你是教学数据分析师。用2句话解读以下#{topic}数据：#{inspect(stats, limit: :infinity)}"

    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [%{role: "user", content: prompt}],
           max_tokens: 512,
           temperature: 0.3,
           receive_timeout: 60_000
         ) do
      {:ok, resp} -> resp |> ReqLLM.Response.text() |> String.trim()
      {:error, _} -> nil
    end
  end
end
