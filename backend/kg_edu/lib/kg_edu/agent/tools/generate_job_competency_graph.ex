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

  ## 任务去重要求（严格遵守）

  每个核心任务必须聚焦**不同的职能方向**，覆盖岗位价值链上的独立环节。常见的职能方向（按需选择 5 类左右，不要重复）：

  - **用户与市场调研**：面向用户的发现性工作（用户访谈、问卷、竞品分析、画像与场景地图等）。产出：调研报告、用户画像、需求清单。
  - **方案与体验设计**：面向产品的创造性工作（功能设计、交互设计、原型、PRD）。产出：设计方案、原型、PRD 文档。
  - **工程与实现落地**：面向系统的构建性工作（编码、单元测试、技术评审、代码重构）。产出：可运行代码、技术文档、测试用例。
  - **质量与效果验证**：面向结果的验证性工作（数据分析、AB 实验、可用性测试、效果评估）。产出：数据看板、实验报告、可用性报告。
  - **运营与协作交付**：面向协作的传递性工作（上线发布、培训、跨部门沟通、文档沉淀）。产出：上线方案、培训材料、运营 SOP。
  - **学习与持续精进**：面向个人的成长性工作（技术调研、知识分享、读书复盘）。产出：调研笔记、分享记录、知识库条目。

  ### 标题唯一性强制约束

  1. **标题语义绝对互斥**：任意两个任务的 title **必须使用完全不同的动词和宾语**，禁止出现同义/近义表达。例如「理解用户需求」和「挖掘用户真实需求」=> 只保留一个，「需求分析」和「需求调研」=> 只保留一个。
  2. **与已有任务区分**：如果已有核心任务列表不为空，您生成的新任务标题必须与已有任务**语义上明显不同**，不能是同义词改写。
  3. **禁止重叠**：description 中出现的手段/方法/产出物在所有任务中**只能出现一次**。
  4. **维度互斥**：同一任务只能属于上述【一个】职能方向，不能横跨多个方向。description 中不要堆砌"既要…又要…"的并列表达。
  5. **方法独有**：每个任务只能使用自己方向下的方法集。用户研究类不要写"方案设计"、工程类不要写"用户访谈"。
  6. **粒度一致**：标题统一为 6-12 字动宾短语，描述统一为 30-60 字"做什么 + 怎么交付"。
  7. **数量控制**：先在心里列出方向分配（如调研1+设计1+工程1+验证1+运营1），再为每个方向只生成 1 个任务；用户指定的 taskCount 会作为最终数量约束。

  ## 输出格式

  你的输出必须是一个合法的 JSON 对象，格式如下：
  {
    "tasks": [
      {
        "title": "核心任务名称",
        "description": "任务描述（30-60字，仅含本方向独有的方法和产出）",
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

      existing_tasks = fetch_existing_tasks(job_position_id, tenant)

      {:ok, %{
        job: job,
        courses: courses,
        knowledge_resources: knowledge_resources,
        existing_tasks: existing_tasks
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

  defp fetch_existing_tasks(job_position_id, tenant) do
    try do
      KgEdu.MajorAnalysis.JobCoreTask
      |> Ash.read!(tenant: tenant, authorize?: false,
        filter: [job_position_id: job_position_id],
        select: [:title])
      |> Enum.map(& &1.title)
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

    existing_task_text =
      if context.existing_tasks == [] do
        "（暂无已有核心任务）"
      else
        context.existing_tasks
        |> Enum.map(&"  - #{&1}")
        |> Enum.join("\n")
      end

    """
    请分析以下岗位，生成 #{task_count} 个核心任务及其能力点，并尝试关联已有课程知识点。

    【岗位信息】
    - 岗位名称：#{job.title}
    - 岗位描述：#{job.description || "无描述"}
    - 所属专业：#{major_name}

    【已有课程与知识点】
    #{course_text}

    【已有核心任务（请避免生成标题相近的任务）】
    #{existing_task_text}

    要求：
    1. 生成 #{task_count} 个核心任务，先按"调研/设计/工程/验证/运营/学习"等不同职能方向各分配 1 个，方向之间**不得重复**；每个任务的标题动词与方法必须区别于其他任务。生成的标题必须与【已有核心任务】列表中的标题**语义上明显不同**，不能使用同义词改写已有任务。
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
    deduped_tasks = deduplicate_tasks(tasks)

    {saved_tasks, total_abilities, total_links} =
      Enum.reduce(deduped_tasks, {[], 0, 0}, fn task, {acc_tasks, acc_abilities, acc_links} ->
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

  # 去重策略：
  # 1. 标题/规范化后的标题完全相同 -> 丢弃后续重复项
  # 2. 标题在分词后 jaccard 相似度 > 0.6（视为同义改写）-> 保留首个，丢弃后续
  # 3. 描述文本与任何已保留任务的描述 jaccard > 0.5 -> 丢弃
  defp deduplicate_tasks(tasks) do
    initial_state = %{
      kept: [],
      seen_titles: MapSet.new(),
      kept_title_token_sets: [],
      kept_desc_token_sets: []
    }

    tasks
    |> Enum.with_index()
    |> Enum.reduce(initial_state, fn {task, idx}, state ->
      title = (task["title"] || "") |> to_string() |> String.trim()
      desc = (task["description"] || "") |> to_string() |> String.trim()

      title_tokens = tokenize(title)
      desc_tokens = tokenize(desc)
      norm_title = normalize_title(title)

      is_dup =
        MapSet.member?(state.seen_titles, norm_title) or
          overlap_with_any_list?(title_tokens, state.kept_title_token_sets, 0.6) or
          overlap_with_any_list?(desc_tokens, state.kept_desc_token_sets, 0.5)

      if is_dup do
        Logger.warning(
          "[GenerateJobGraph] Dropping duplicate/overlapping task ##{idx}: '#{title}'"
        )
        state
      else
        %{
          state
          | kept: state.kept ++ [task],
            seen_titles: MapSet.put(state.seen_titles, norm_title),
            kept_title_token_sets: [title_tokens | state.kept_title_token_sets],
            kept_desc_token_sets: [desc_tokens | state.kept_desc_token_sets]
        }
      end
    end)
    |> Map.get(:kept)
  end

  defp normalize_title(title) do
    title
    |> String.replace(~r/[[:punct:][:space:]]/, "")
    |> String.downcase()
  end

  # 中文友好的分词：单字粒度 + bigram
  defp tokenize(text) do
    text = String.replace(text, ~r/[[:punct:][:space:]]/, "")
    chars = String.graphemes(text)
    chars_set = MapSet.new(chars)

    bigrams =
      chars
      |> Enum.chunk_every(2, 1, :discard)
      |> MapSet.new()

    MapSet.union(chars_set, bigrams)
  end

  defp overlap_with_any_list?(tokens, kept_token_sets, threshold) do
    Enum.any?(kept_token_sets, fn other_tokens ->
      jaccard(tokens, other_tokens) > threshold
    end)
  end

  defp jaccard(a, b) do
    inter = MapSet.intersection(a, b) |> MapSet.size()
    union = MapSet.union(a, b) |> MapSet.size()

    if union == 0 do
      0.0
    else
      inter / union
    end
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
