defmodule KgEdu.Agent.Tools.GenerateCurriculum do
  @moduledoc """
  Agent tool: AI-powered curriculum/knowledge system generation.

  Generates a complete curriculum design for a major by:
  1. Fetching major info + existing courses + competency graph
  2. Calling LLM to generate structured curriculum design
  3. Creating CurriculumDesign record in DB
  4. Returning the result
  """

  require Ash.Query

  use Jido.Action,
    name: "GenerateCurriculum",
    description: "为专业AI生成课程体系方案。需要majorId参数。",
    schema:
      Zoi.object(%{
        majorId: Zoi.string(description: "专业ID"),
        customPrompt: Zoi.string(description: "自定义提示") |> Zoi.optional()
      })

  @system_prompt """
  你是高校课程体系设计专家。你需要为指定专业生成一份完整的课程体系设计方案。

  输出格式为Markdown，包含以下章节：
  # 课程体系设计方案

  ## 一、专业概述
  - 专业定位与培养目标
  - 核心能力要求
  - 就业方向

  ## 二、课程体系结构
  ### 2.1 通识教育课程
  ### 2.2 学科基础课程
  ### 2.3 专业核心课程
  ### 2.4 专业选修课程
  ### 2.5 实践教学环节

  ## 三、课程设置
  每门课程包含：课程名称、学分、学时、开课学期、课程描述

  ## 四、教学进程安排
  按学期列出课程安排

  ## 五、毕业要求
  总学分、必修学分、选修学分等

  要求：
  1. 内容详实，结构清晰
  2. 课程设置合理，符合专业培养规律
  3. 学分学时分配合理
  4. 包含具体的课程名称和描述
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
      请为以下专业生成课程体系设计方案：

      专业信息：
      #{context_text}

      #{if custom_prompt != "", do: "额外要求：#{custom_prompt}", else: ""}
      """

      case call_llm(user_prompt) do
        {:ok, markdown_content} ->
          # Extract title from markdown
          title = extract_title(markdown_content) || "课程体系设计方案"

          # Save to DB
          tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
          user_id = KgEdu.Agent.SessionContext.get(:user_id)

          case save_curriculum(tenant, major_id, title, markdown_content, user_id) do
            {:ok, design_id} ->
              {:ok, %{
                result: "课程体系「#{title}」已生成！",
                curriculumId: design_id,
                title: title,
                content: markdown_content
              }}

            {:error, reason} ->
              {:ok, %{
                result: "课程体系已生成（保存失败: #{reason}）",
                content: markdown_content
              }}
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
        |> Enum.map(fn c -> "#{c.title}（#{c.semester || "未知学期"}）" end)
      rescue
        _ -> []
      end

    """
    专业ID: #{major_id}
    已有课程 (#{length(courses)}门): #{Enum.join(courses, "、")}
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

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp extract_title(markdown) do
    case Regex.run(~r/^#\s+(.+)$/m, markdown) do
      [_, title] -> String.trim(title)
      nil -> nil
    end
  end

  defp save_curriculum(tenant, major_id, title, content, user_id) do
    try do
      {:ok, record} =
        KgEdu.MajorAnalysis.CurriculumDesign
        |> Ash.Changeset.for_create(:create, %{
          major_id: major_id,
          title: title,
          content: content,
          created_by_id: user_id
        })
        |> Ash.create!(tenant: tenant, authorize?: false)

      {:ok, record.id}
    rescue
      e ->
        Logger.warning("[GenerateCurriculum] Failed to save: #{Exception.message(e)}")
        {:error, Exception.message(e)}
    end
  end
end
