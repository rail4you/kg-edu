defmodule KgEdu.Agent.Tools.GenerateJobCompetencyGraph do
  @moduledoc """
  Agent tool: AI-powered job competency graph generation.

  Analyzes a job position, generates core tasks + abilities, and tries to
  associate existing knowledge resources. Flags mismatches when the job
  deviates too far from available course knowledge.
  """

  require Ash.Query
  require Logger

  use Jido.Action,
    name: "GenerateJobCompetencyGraph",
    description: "为岗位AI生成能力图谱（核心任务+能力点+知识点关联）",
    schema:
      Zoi.object(%{
        jobPositionId: Zoi.string(description: "岗位ID"),
        graphId: Zoi.string(description: "能力图谱ID"),
        taskCount: Zoi.integer(description: "生成任务数量") |> Zoi.optional()
      })

  @system_prompt """
  你是岗位能力图谱构建专家。你需要分析一个岗位，为其生成核心任务、能力点，并关联已有课程的知识点。

  你的输出必须是一个合法的 JSON 对象，格式如下：
  {
    "tasks": [
      {
        "title": "核心任务名称",
        "description": "任务描述（30-60字）",
        "abilities": [
          {
            "name": "能力名称",
            "description": "能力描述（20-40字）",
            "level": "beginner | intermediate | advanced"
          }
        ]
      }
    ],
    "knowledgeMatches": [
      {
        "taskTitle": "任务名称",
        "abilityName": "能力名称",
        "matchedKnowledgeName": "匹配的知识点名称",
        "relevance": 0.8,
        "note": "匹配说明"
      }
    ],
    "mismatchWarnings": [
      "如果岗位与已有课程知识点偏差较大，在此说明具体偏差。"
    ],
    "overallAssessment": "对岗位课程匹配度的整体评估（50-100字）"
  }
  """

  def run(params, _context) do
    job_position_id = params[:jobPositionId]
    graph_id = params[:graphId]
    task_count = params[:taskCount] || 5

    if is_nil(job_position_id) or is_nil(graph_id) do
      {:error, "jobPositionId 和 graphId 是必需参数"}
    else
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
      KgEdu.Agent.SessionContext.put(tenant: tenant)

      with {:ok, context} <- fetch_context(job_position_id, tenant),
           user_prompt <- build_user_prompt(context, task_count),
           {:ok, json_text} <- call_llm(user_prompt),
           {:ok, data} <- parse_json(json_text),
           :ok <- validate_data(data),
           saved <- save_to_db(data, graph_id, job_position_id, tenant) do
        {:ok,
         %{
           result: build_summary(data, saved),
           mismatchWarnings: Map.get(data, "mismatchWarnings", []),
           overallAssessment: Map.get(data, "overallAssessment", ""),
           taskCount: length(saved.tasks),
           abilityCount: saved.abilityCount,
           linkCount: saved.linkCount
         }}
      end
    end
  end

  # ── Context ─────────────────────────────────────────────────────────────

  defp fetch_context(job_position_id, tenant) do
    job = fetch_job_position(job_position_id, tenant)

    if is_nil(job) do
      {:error, "岗位不存在"}
    else
      courses = fetch_courses(tenant)
      knowledge_resources = fetch_knowledge_resources(tenant)

      {:ok, %{
        job: job,
        courses: courses,
        knowledge_resources: knowledge_resources
      }}
    end
  end

  defp fetch_job_position(id, tenant) do
    try do
      KgEdu.MajorAnalysis.JobPosition
      |> Ash.get!(id, tenant: tenant, authorize?: false, load: [:major])
    rescue
      _ -> nil
    end
  end

  defp fetch_courses(tenant) do
    try do
      KgEdu.Courses.Course
      |> Ash.read!(tenant: tenant, authorize?: false)
    rescue
      _ -> []
    end
  end

  defp fetch_knowledge_resources(tenant) do
    try do
      KgEdu.Knowledge.Resource
      |> Ash.read!(tenant: tenant, authorize?: false, load: [:course])
    rescue
      _ -> []
    end
  end

  # ── Prompt ──────────────────────────────────────────────────────────────

  defp build_user_prompt(context, task_count) do
    job = context.job
    major_name = if job.major, do: job.major.name, else: "未设置"
    courses = context.courses
    knowledge_resources = context.knowledge_resources

    course_text =
      if courses == [] do
        "（暂无课程数据）"
      else
        courses
        |> Enum.map(fn c ->
          related_krs = Enum.filter(knowledge_resources, &(&1.course_id == c.id))
          kr_text =
            if related_krs == [] do
              "（暂无知识点）"
            else
              related_krs
              |> Enum.map(fn kr -> "  - #{kr.name}#{kr.description && "：#{kr.description}"}" end)
              |> Enum.join("\n")
            end
          "课程：#{c.title}\n知识点：\n#{kr_text}"
        end)
        |> Enum.join("\n\n")
      end

    """
    请分析以下岗位，生成 #{task_count} 个核心任务及其能力点，并尝试关联已有课程知识点。

    【岗位信息】
    - 岗位名称：#{job.title}
    - 岗位描述：#{job.description || "无描述"}
    - 所属专业：#{major_name}

    【已有课程与知识点】
    #{course_text}

    要求：
    1. 生成 #{task_count} 个核心任务，覆盖岗位的主要工作领域
    2. 每个任务下生成 2-4 个能力点，标注等级（beginner/intermediate/advanced）
    3. 从已有知识点中寻找匹配项（knowledgeMatches），匹配度评分 0-1
    4. 如果岗位技能方向与已有课程知识点差异较大，在 mismatchWarnings 中说明
    5. knowledgeMatches 是可选字段，匹配不到时返回空数组
    6. overallAssessment 给予整体匹配度评估

    请只返回 JSON 格式的响应，不要包含任何其他文字。
    """
  end

  # ── LLM ─────────────────────────────────────────────────────────────────

  defp call_llm(user_prompt) do
    model = Application.get_env(:kg_edu, :reqllm)[:model] || "alibaba_cn:qwen-plus"
    ensure_qwen_key()

    case ReqLLM.Generation.generate_text(model, [
           %{role: "system", content: @system_prompt},
           %{role: "user", content: user_prompt}
         ], max_tokens: 16384, temperature: 0.7) do
      {:ok, response} ->
        {:ok, ReqLLM.Response.text(response)}
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp ensure_qwen_key, do: KgEdu.Agent.ApiKeyProvider.ensure_key()

  # ── Parsing ─────────────────────────────────────────────────────────────

  defp parse_json(text) do
    case Jason.decode(text) do
      {:ok, data} -> {:ok, data}
      {:error, _} ->
        case extract_json(text) do
          {:ok, data} -> {:ok, data}
          _ -> {:error, "无法解析LLM返回的JSON数据"}
        end
    end
  end

  defp extract_json(text) do
    case Regex.run(~r/\{[\s\S]*\}/, text) do
      [match] -> Jason.decode(match)
      nil -> :error
    end
  end

  defp validate_data(data) do
    tasks = Map.get(data, "tasks", [])
    if tasks == [] do
      {:error, "LLM未返回任何任务数据"}
    else
      :ok
    end
  end

  # ── Persistence ─────────────────────────────────────────────────────────

  defp save_to_db(data, graph_id, job_position_id, tenant) do
    tasks = Map.get(data, "tasks", [])
    saved_tasks = []
    total_abilities = 0
    total_links = 0

    {saved_tasks, total_abilities, total_links} =
      Enum.reduce(tasks, {[], 0, 0}, fn task, {acc_tasks, acc_abilities, acc_links} ->
        # Create core task
        task_attrs = %{
          title: task["title"] || "未命名任务",
          description: task["description"] || "",
          graph_id: graph_id,
          job_position_id: job_position_id
        }

        case Ash.create(KgEdu.MajorAnalysis.JobCoreTask, task_attrs, tenant: tenant, authorize?: false) do
          {:ok, new_task} ->
            abilities = Map.get(task, "abilities", [])
            {ability_count, link_count} = save_abilities_and_links(new_task, graph_id, abilities, data, tenant)
            {acc_tasks ++ [new_task], acc_abilities + ability_count, acc_links + link_count}

          {:error, reason} ->
            Logger.warning("[GenerateJobGraph] Failed to create task '#{task["title"]}': #{inspect(reason)}")
            {acc_tasks, acc_abilities, acc_links}
        end
      end)

    %{
      tasks: saved_tasks,
      abilityCount: total_abilities,
      linkCount: total_links
    }
  end

  defp save_abilities_and_links(task, graph_id, abilities, data, tenant) do
    matches = Map.get(data, "knowledgeMatches", [])

    Enum.reduce(abilities, {0, 0}, fn ability, {a_count, l_count} ->
      ability_attrs = %{
        name: ability["name"] || "未命名能力",
        description: ability["description"] || "",
        level: ability["level"] || "beginner",
        core_task_id: task.id,
        graph_id: graph_id
      }

      case Ash.create(KgEdu.MajorAnalysis.JobTaskAbility, ability_attrs, tenant: tenant, authorize?: false) do
        {:ok, new_ability} ->
          link_count =
            matches
            |> Enum.filter(fn m ->
              m["taskTitle"] == task.title && m["abilityName"] == ability["name"]
            end)
            |> Enum.reduce(0, fn match, ln_acc ->
              kr_name = match["matchedKnowledgeName"]
              if kr_name do
                case find_knowledge_resource(kr_name, tenant) do
                  {:ok, kr} ->
                    link_attrs = %{
                      ability_id: new_ability.id,
                      knowledge_resource_id: kr.id,
                      graph_id: graph_id,
                      support_level: :primary,
                      description: match["note"] || ""
                    }
                    case Ash.create(KgEdu.MajorAnalysis.AbilityKnowledgeLink, link_attrs,
                           tenant: tenant, authorize?: false,
                           upsert?: true,
                           upsert_identity: :unique_ability_knowledge,
                           upsert_fields: [:support_level, :description]
                         ) do
                      {:ok, _} -> ln_acc + 1
                      _ -> ln_acc
                    end
                  _ -> ln_acc
                end
              else
                ln_acc
              end
            end)
          {a_count + 1, l_count + link_count}

        {:error, _} ->
          {a_count, l_count}
      end
    end)
  end

  defp find_knowledge_resource(name, tenant) do
    # Try exact match first
    query =
      KgEdu.Knowledge.Resource
      |> Ash.Query.filter(name == ^name)

    case Ash.read(query, tenant: tenant, authorize?: false) do
      {:ok, [kr | _]} -> {:ok, kr}
      _ ->
        # Try fuzzy match
        fuzzy_query =
          KgEdu.Knowledge.Resource
          |> Ash.Query.filter(fragment("name ILIKE ?", "%#{name}%"))

        case Ash.read(fuzzy_query, tenant: tenant, authorize?: false) do
          {:ok, [kr | _]} -> {:ok, kr}
          _ -> :error
        end
    end
  end

  # ── Summary ─────────────────────────────────────────────────────────────

  defp build_summary(data, saved) do
    warnings = Map.get(data, "mismatchWarnings", [])
    has_no_links = saved.linkCount == 0

    link_text =
      if has_no_links do
        "\n\n💡 暂未自动匹配到知识点，您可以在能力点的「配置知识点」中手动关联对应知识点。"
      else
        ""
      end

    warning_text =
      if warnings != [] and not has_no_links do
        "\n\n⚠️ #{Enum.at(warnings, 0)}"
      else
        ""
      end

    "AI 已成功生成 #{length(saved.tasks)} 个核心任务、#{saved.abilityCount} 个能力点。#{link_text}#{warning_text}"
  end
end
