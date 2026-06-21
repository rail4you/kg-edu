defmodule KgEdu.Agent.Tools.GenerateExercises do
  @moduledoc """
  Agent tool: AI-powered exercise generation.

  Calls Qwen via ReqLLM to generate exercises based on knowledge points,
  then writes them to the database via Ash API.
  """

  require Ash.Query

  use Jido.Action,
    name: "GenerateExercises",
    description: "使用AI生成多个练习题。需要指定知识点、题型、数量和难度。",
    schema:
      Zoi.object(%{
        courseId: Zoi.string(description: "课程ID（必需）"),
        knowledgeName: Zoi.string(description: "知识点名称"),
        exerciseType: Zoi.string(description: "题目类型"),
        number: Zoi.integer() |> Zoi.default(5) |> Zoi.nullish(),
        difficulty: Zoi.integer() |> Zoi.default(3) |> Zoi.nullish(),
        _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
      })

  @exercise_system_prompt """
  你是一位练习题生成专家，专门根据知识点和练习题类型生成高质量的练习题。

  ## 你的任务
  1. 理解知识点：理解用户提供的知识点名称
  2. 生成练习题：根据练习题类型生成相应数量的练习题
  3. 设置难度：根据难度级别（1-5）调整题目难度
  4. 设置选项：对于选择题，生成合理的选项
  5. 提供答案：为每道题提供正确答案
  6. 答案解析：为每道题提供详细的答案解析

  ## 练习题类型
  - multiple_choice: 单选题，4个选项，1个正确答案
  - multiple_response: 多选题，4个选项，2+正确答案，answer用逗号分隔字母
  - true_false: 判断题，选项固定 "A. 正确\\nB. 错误"，answer为A或B
  - fill_in_blank: 填空题
  - essay: 问答题
  - term_definition: 名词解释

  ## 输出格式
  直接返回JSON数组，不要包裹在代码块中。每道题包含:
  - title: 题目标题
  - questionContent: 题目内容
  - answer: 正确答案
  - answerExplanation: 答案解析
  - questionType: 题目类型
  - options: 选项（选择题/多选题/判断题，其他类型可为null）
  - difficulty: 难度级别(1-5)
  """

  @impl true
  def run(params, _context) do
    tenant = params[:_tenant]

    if is_nil(tenant) do
      {:error, "未设置租户上下文"}
    else
      course_id = params[:courseId]
      knowledge = params[:knowledgeName] || "未指定"
      type = params[:exerciseType] || "multiple_choice"
      number = params[:number] || 5
      difficulty = params[:difficulty] || 3

      # Get existing titles to avoid duplicates
      existing_titles = get_existing_titles(tenant, course_id)
      titles_hint = build_titles_hint(existing_titles)

      user_prompt = """
      请根据以下信息生成#{number}道练习题：

      知识点名称：#{knowledge}
      练习题类型：#{type}
      难度级别：#{difficulty}（1=简单，5=困难）
      #{titles_hint}

      要求：
      1. 生成的题目要与知识点紧密相关
      2. 题目难度符合指定的难度级别
      3. 选择题的选项要合理且有迷惑性
      4. 多选题(multiple_response)必须有2个或以上正确答案，answer用逗号分隔字母
      5. 判断题(true_false)选项固定为"A. 正确\\nB. 错误"，answer为A或B
      6. 每道题都有明确的正确答案和详细的答案解析
      7. 题目标题必须唯一且有意义
      8. 直接返回JSON数组
      """

      case call_llm(@exercise_system_prompt, user_prompt) do
        {:ok, response_text} ->
          case parse_exercise_json(response_text) do
            {:ok, exercises} ->
              created = save_exercises(exercises, tenant, course_id, existing_titles, type, difficulty)
              text = "练习题生成成功！共创建 #{length(created)} 道题。"
              {:ok, %{result: text, exercises: created}}

            {:error, reason} ->
              {:error, "解析LLM响应失败: #{reason}"}
          end

        {:error, reason} ->
          {:error, "LLM调用失败: #{reason}"}
      end
    end
  end

  # ── helpers ─────────────────────────────────────────────────────────────

  defp get_existing_titles(tenant, course_id) do
    try do
      KgEdu.Knowledge.Question
      |> Ash.Query.new()
      |> Ash.Query.filter(course_id == ^course_id)
      |> Ash.read!(tenant: tenant, authorize?: false)
      |> Enum.map(& &1.title)
      |> Enum.filter(&(not is_nil(&1)))
      |> MapSet.new()
    rescue
      _ -> MapSet.new()
    end
  end

  defp build_titles_hint(titles) do
    if MapSet.size(titles) > 0 do
      list = titles |> Enum.take(20) |> Enum.map_join("\n", &"  - #{&1}")
      hint = if MapSet.size(titles) > 20, do: "\n  ... 还有更多", else: ""
      "\n已存在的题目标题（禁止重复）：\n#{list}#{hint}"
    else
      ""
    end
  end

  defp call_llm(system, user) do
    model = Application.get_env(:kg_edu, :reqllm)[:model] || "alibaba_cn:qwen-plus"

    case ReqLLM.Generation.generate_text(model, [
           %{role: "system", content: system},
           %{role: "user", content: user}
         ], max_tokens: 16384, temperature: 0.7) do
      {:ok, response} ->
        {:ok, ReqLLM.Response.text(response)}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  defp parse_exercise_json(text) do
    # Try direct parse first
    case Jason.decode(text) do
      {:ok, list} when is_list(list) -> {:ok, list}
      _ ->
        # Try extracting JSON array from markdown code blocks
        case Regex.run(~r/\[.*\]/s, text) do
          [match] ->
            case Jason.decode(match) do
              {:ok, list} when is_list(list) -> {:ok, list}
              _ -> {:error, "无法解析LLM响应为JSON数组"}
            end
          nil ->
            {:error, "LLM响应中未找到JSON数组"}
        end
    end
  end

  defp save_exercises(exercises, tenant, course_id, existing_titles, type, difficulty) do
    existing = existing_titles

    exercises
    |> Enum.reduce({[], existing}, fn data, {acc, titles} ->
      title = data["title"] || "#{type}_#{System.os_time(:millisecond)}"

      # Deduplicate title
      {final_title, new_titles} =
        if MapSet.member?(titles, title) do
          deduped = deduplicate_title(title, titles)
          {deduped, MapSet.put(titles, deduped)}
        else
          {title, MapSet.put(titles, title)}
        end

      # Build options JSON
      options = build_options(data)

      # Create via Ash
      try do
        {:ok, record} =
          KgEdu.Knowledge.Question
          |> Ash.Changeset.for_create(:create, %{
            title: final_title,
            question_content: data["questionContent"] || "",
            question_type: data["questionType"] || type,
            answer: data["answer"] || "",
            answer_explanation: data["answerExplanation"] || "",
            options: options,
            course_id: course_id,
            difficulty: data["difficulty"] || difficulty
          })
          |> Ash.create!(tenant: tenant, authorize?: false)

        {[record | acc], new_titles}
      rescue
        e ->
          IO.puts("[GenerateExercises] Failed to create '#{final_title}': #{Exception.message(e)}")
          {acc, new_titles}
      end
    end)
    |> elem(0)
    |> Enum.reverse()
  end

  defp deduplicate_title(title, titles) do
    2..100
    |> Enum.reduce_while(title, fn i, _ ->
      candidate = "#{title} (#{i})"
      if MapSet.member?(titles, candidate), do: {:cont, candidate}, else: {:halt, candidate}
    end)
  end

  defp build_options(data) do
    type = (data["questionType"] || "")

    case data["options"] do
      nil -> nil
      options when is_binary(options) ->
        choices =
          options
          |> String.split(~r/[\n\\]/, trim: true)
          |> Enum.map(&String.trim/1)
          |> Enum.reject(&(&1 == ""))

        if choices == [] do
          nil
        else
          if type == "multiple_response" do
            correct =
              (data["answer"] || "")
              |> String.split(~r/[,，\s;]+/, trim: true)
              |> Enum.map(&String.upcase(String.trim(&1)))
              |> Enum.filter(&(byte_size(&1) == 1 and &1 >= "A" and &1 <= "D"))
              |> Enum.map(fn letter -> :binary.first(letter) - 65 end)

            Jason.encode!(%{choices: choices, correctAnswers: correct})
          else
            Jason.encode!(%{choices: choices})
          end
        end

      _ -> nil
    end
  end
end
