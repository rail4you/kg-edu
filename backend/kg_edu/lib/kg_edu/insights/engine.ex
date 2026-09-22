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

  @datasets ["signin", "upload", "activity"]

  def datasets, do: @datasets

  # ── 问答 ───────────────────────────────────────────────────────────

  def ask(question, tenant, opts \\ []) do
    days = Keyword.get(opts, :days, 30) || 30
    q = question || ""

    cond do
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
           rows: Enum.map(data.rows, &[&1.type, &1.count]),
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
    if contains_any?(theme, ["活动", "课堂"]) do
      [
        %{title: "签到与出勤概况", dataset: "signin", description: "近1个月签到率"},
        %{title: "活动类型分布", dataset: "activity", description: "各类课堂活动次数"},
        %{title: "结论与建议", dataset: "activity", description: "基于数据的教学建议"}
      ]
    else
      [
        %{title: "数据概览", dataset: "upload", description: "资源上传总体情况"},
        %{title: "院系对比", dataset: "upload", description: "各院系上传量对比"},
        %{title: "结论与建议", dataset: "upload", description: "基于数据的建议"}
      ]
    end
  end

  defp section_data(dataset, tenant, days) do
    %{columns: columns, rows: rows} = dataset_table(dataset, tenant, days)
    table = %{columns: columns, rows: Enum.map(rows, &Map.values/1)}
    chart = bar_chart(columns, rows)
    {table, chart}
  end

  defp dataset_table("signin", tenant, days) do
    data = signin_rate(tenant, days: days)
    %{columns: ["姓名", "院系", "签到次数"], rows: Enum.map(data.rows, &%{"姓名" => &1.name, "院系" => &1.department, "签到次数" => &1.checkins})}
  end

  defp dataset_table("upload", tenant, days) do
    data = upload_stats(tenant, days: days)
    %{columns: ["院系", "上传量"], rows: Enum.map(data.rows, &%{"院系" => &1.department, "上传量" => &1.count})}
  end

  defp dataset_table(_, tenant, days) do
    data = activity_stats(tenant, days: days)
    %{columns: ["活动类型", "次数"], rows: Enum.map(data.rows, &%{"活动类型" => &1.type, "次数" => &1.count})}
  end

  defp section_text(theme, dataset, table) do
    "本节围绕「#{theme}」分析#{dataset}数据，共 #{length(table.rows)} 条记录。" <>
      "详见下方统计图与数据表。"
  end

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
