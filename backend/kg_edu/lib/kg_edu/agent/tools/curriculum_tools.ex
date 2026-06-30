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
  require Logger

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
          # Extract title from markdown and add date suffix
          raw_title = extract_title(markdown_content) || "课程体系设计方案"
          tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
          title = unique_title(raw_title, tenant, major_id)
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
          {:error, format_llm_error(reason)}
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
    model = "qwen-plus"
    # Use fresh Req request instead of ReqLLM to avoid Finch pool issues
    ensure_key = fn ->
      KgEdu.Agent.ApiKeyProvider.ensure_key()
      System.get_env("DASHSCOPE_API_KEY") ||
        Application.get_env(:req_llm, :alibaba_cn_api_key) ||
        Application.get_env(:req_llm, :qwen_api_key)
    end

    api_key = ensure_key.()

    if is_nil(api_key) or api_key == "" do
      {:error, "API Key 未配置"}
    else
      url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
      body = %{
        model: model,
        messages: [
          %{role: "system", content: @system_prompt},
          %{role: "user", content: user_prompt}
        ],
        max_tokens: 16384,
        temperature: 0.7
      }

      Logger.info("[GenerateCurriculum] Calling DashScope API directly")
      start = System.monotonic_time(:millisecond)

      case Req.post(url,
        json: body,
        headers: %{"Authorization" => "Bearer #{api_key}"},
        connect_options: [timeout: 30_000],
        receive_timeout: 120_000
      ) do
        {:ok, %{status: 200, body: %{"choices" => [%{"message" => %{"content" => content}} | _]}}} ->
          elapsed = System.monotonic_time(:millisecond) - start
          Logger.info("[GenerateCurriculum] LLM call completed in #{elapsed}ms")
          {:ok, content}

        {:ok, %{status: status, body: body}} ->
          elapsed = System.monotonic_time(:millisecond) - start
          Logger.error("[GenerateCurriculum] API error #{status}: #{inspect(body)}")
          msg = get_in(body, ["error", "message"]) || get_in(body, ["message"]) || "HTTP #{status}"
          {:error, "AI 服务调用失败 (#{status}): #{msg}"}

        {:error, error} ->
          elapsed = System.monotonic_time(:millisecond) - start
          Logger.error("[GenerateCurriculum] Request error after #{elapsed}ms: #{inspect(error)}")
          {:error, "AI 服务调用失败: #{Exception.message(error)}"}
      end
    end
  rescue
    e ->
      Logger.error("[GenerateCurriculum] LLM call crashed: #{Exception.message(e)}")
      {:error, e}
  end

  defp ensure_qwen_key, do: KgEdu.Agent.ApiKeyProvider.ensure_key()

  defp format_llm_error(error) do
    Logger.error("[GenerateCurriculum] Raw LLM error: #{inspect(error)}")

    cond do
      is_struct(error, ReqLLM.Error.API.Request) ->
        status = error.status || "?"
        # DashScope errors may have "message" at top level or nested under "error"
        body = error.response_body
        msg =
          cond do
            is_map(body) ->
              Map.get(body, "message") ||
                get_in(body, ["error", "message"]) ||
                get_in(body, [:error, :message]) ||
                inspect(body)
            is_binary(body) and body != "" -> body
            true -> "请求失败"
          end
        "AI 服务调用失败 (#{status}): #{msg}"

      is_struct(error, ReqLLM.Error.API.Response) ->
        status = error.status || "?"
        body = error.response_body
        msg =
          cond do
            is_map(body) ->
              Map.get(body, "message") ||
                get_in(body, ["error", "message"]) ||
                inspect(body)
            is_binary(body) and body != "" -> body
            true -> "响应异常"
          end
        "AI 服务响应失败 (#{status}): #{msg}"

      is_binary(error) ->
        "AI 服务调用失败: #{error}"

      true ->
        "AI 服务调用失败，请检查 API Key 配置"
    end
  end

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp extract_title(markdown) do
    case Regex.run(~r/^#\s+(.+)$/m, markdown) do
      [_, title] -> String.trim(title)
      nil -> nil
    end
  end

  defp unique_title(base_title, tenant, major_id) do
    today = Date.utc_today() |> Date.to_iso8601()
    base = "#{base_title} (#{today})"

    # Count existing designs with same date prefix for this major
    count =
      try do
        KgEdu.MajorAnalysis.CurriculumDesign
        |> Ash.Query.filter(major_id == ^major_id)
        |> Ash.read!(tenant: tenant, authorize?: false)
        |> Enum.count(fn d -> String.starts_with?(d.title, base) end)
      rescue
        _ -> 0
      end

    if count > 0 do
      "#{base} ##{count + 1}"
    else
      base
    end
  end

  defp save_curriculum(tenant, major_id, title, content, user_id) do
    try do
      record =
        KgEdu.MajorAnalysis.CurriculumDesign
        |> Ash.Changeset.for_create(:create, %{
          major_id: major_id,
          title: title,
          markdown_content: content
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
