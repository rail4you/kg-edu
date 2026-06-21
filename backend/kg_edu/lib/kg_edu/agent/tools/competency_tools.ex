defmodule KgEdu.Agent.Tools.GenerateCompetencyGraph do
  @moduledoc """
  Agent tool: AI-powered competency/ability graph generation.

  Generates a structured competency graph for a major by:
  1. Fetching existing major info + positions + ability nodes
  2. Calling LLM to generate tree-structured competency JSON
  3. Writing nodes to DB
  4. Returning the result
  """

  require Ash.Query
  require Logger

  use Jido.Action,
    name: "GenerateCompetencyGraph",
    description: "为专业AI生成能力素质图谱。需要majorId参数。",
    schema:
      Zoi.object(%{
        majorId: Zoi.string(description: "专业ID"),
        customPrompt: Zoi.string(description: "自定义提示") |> Zoi.optional()
      })

  @system_prompt """
  你是专业能力素质图谱构建专家。你需要为指定专业生成一个树形结构的能力素质图谱。

  输出格式为JSON，结构如下：
  {
    "categories": [
      {
        "name": "大类名称",
        "abilities": [
          {
            "name": "能力名称",
            "description": "能力描述",
            "level": 1,
            "children": [
              {
                "name": "子能力名称",
                "description": "子能力描述",
                "level": 2
              }
            ]
          }
        ]
      }
    ]
  }

  要求：
  1. 每个大类(category)有清晰的领域划分
  2. 能力层级2-3层，名称简洁准确
  3. 描述要具体，说明该能力的内涵
  4. 覆盖专业核心能力 + 通用素质能力
  5. 总能力节点数控制在20-50个之间
  6. 只返回JSON，不要任何其他文字
  """

  @impl true
  def run(params, _context) do
    major_id = params[:majorId]

    if is_nil(major_id) or major_id == "" do
      {:error, "majorId 是必需参数"}
    else
      custom_prompt = params[:customPrompt] || ""

      # Fetch major context data
      context_text = fetch_major_context(major_id)

      user_prompt = """
      请为以下专业生成能力素质图谱：

      专业信息：
      #{context_text}

      #{if custom_prompt != "", do: "额外要求：#{custom_prompt}", else: ""}
      """

      case call_llm(user_prompt) do
        {:ok, json_text} ->
          case Jason.decode(json_text) do
            {:ok, %{"categories" => categories}} ->
              count = save_competencies(major_id, categories)
              {:ok, %{result: "能力图谱已生成！共 #{count} 个能力节点，分布在 #{length(categories)} 个大类中。", nodeCount: count, categories: categories}}

            {:ok, _} ->
              {:error, "LLM返回的图谱格式不正确"}

            {:error, _} ->
              # Try extracting JSON from text
              case extract_json(json_text) do
                {:ok, %{"categories" => categories}} ->
                  count = save_competencies(major_id, categories)
                  {:ok, %{result: "能力图谱已生成！共 #{count} 个能力节点。", nodeCount: count}}

                _ ->
                  {:error, "无法解析LLM返回的图谱数据"}
              end
          end

        {:error, reason} ->
          {:error, "LLM调用失败: #{reason}"}
      end
    end
  end

  # ── Context fetching ────────────────────────────────────────────────────

  defp fetch_major_context(major_id) do
    tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)

    courses =
      try do
        KgEdu.Courses.Course
        |> Ash.Query.filter(major == ^major_id)
        |> Ash.read!(tenant: tenant, authorize?: false)
        |> Enum.map(& &1.title)
      rescue
        _ -> []
      end

    """
    专业ID: #{major_id}
    关联课程: #{Enum.join(courses, "、")}
    """
  end

  # ── LLM call ────────────────────────────────────────────────────────────

  defp call_llm(user_prompt) do
    model = Application.get_env(:kg_edu, :reqllm)[:model] || "alibaba_cn:qwen-plus"

    case ReqLLM.Generation.generate_text(model, [
           %{role: "system", content: @system_prompt},
           %{role: "user", content: user_prompt}
         ], max_tokens: 16384, temperature: 0.7) do
      {:ok, response} ->
        {:ok, ReqLLM.Response.text(response)}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  # ── JSON parsing ────────────────────────────────────────────────────────

  defp extract_json(text) do
    case Regex.run(~r/\{[\s\S]*\}/, text) do
      [match] -> Jason.decode(match)
      nil -> :error
    end
  end

  # ── DB persistence ──────────────────────────────────────────────────────

  defp save_competencies(major_id, categories) do
    tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
    count = 0

    Enum.reduce(categories, count, fn category, acc ->
      abilities = Map.get(category, "abilities", [])

      Enum.reduce(abilities, acc, fn ability, inner_acc ->
        save_ability(tenant, major_id, nil, ability, inner_acc)
      end)
    end)
  end

  defp save_ability(tenant, major_id, parent_id, ability, count) do
    # Create the ability node
    try do
      {:ok, record} =
        KgEdu.Knowledge.SubAbilityKnowledgeResource
        |> Ash.Changeset.for_create(:create, %{
          major_id: major_id,
          name: ability["name"] || "未命名能力",
          description: ability["description"] || "",
          level: ability["level"] || 1,
          parent_id: parent_id
        })
        |> Ash.create!(tenant: tenant, authorize?: false)

      new_count = count + 1

      # Recursively create children
      children = ability["children"] || []
      Enum.reduce(children, new_count, fn child, acc ->
        save_ability(tenant, major_id, record.id, child, acc)
      end)
    rescue
      e ->
        Logger.warning("[CompetencyGraph] Failed to save ability '#{ability["name"]}': #{Exception.message(e)}")
        count
    end
  end
end
