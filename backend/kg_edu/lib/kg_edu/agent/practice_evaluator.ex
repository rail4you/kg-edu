defmodule KgEdu.Agent.PracticeEvaluator do
  @moduledoc """
  AI 实践评分器 — 供 solo 实践（PracticeController）与共享会话（PracticeSessionController）复用。

  - 只依据「作答内容」评分；问答型场景剔除 AI 提问前的开场设定。
  - 无作答时调用方应先拒绝，本模块不处理空答案文案。
  """
  require Logger

  @rubrics %{
    "dialogue" => "情景对话：评估语言表达、情境贴合度、应变能力",
    "work_upload" => "上传作品：评估作品完整性、规范性、创新性",
    "thinking_ladder" => "思维阶梯：评估思维层层递进、逻辑严密性",
    "debate_arena" => "思辨擂台：评估论点鲜明度、论据充分性、反驳力度",
    "code_editor" => "代码编辑：评估代码正确性、规范性、运行效率",
    "interactive_story" => "互动故事：评估情节连贯性、创造力、参与度"
  }

  # 问答型场景：AI 提问前的用户消息是「开场设定」，不算作答。
  @qa_scenarios ~w(dialogue thinking_ladder debate_arena interactive_story)

  def qa_scenarios, do: @qa_scenarios

  @doc """
  从 transcript 提取作答内容。
  `answer_role` 指定被视为「作答者」的角色（solo 实践为 "user"；共享会话为学生 "student"）。
  """
  def extract_answers(transcript, scenario, answer_role \\ "user") do
    entries =
      Enum.map(transcript || [], fn m ->
        {m["role"] || m[:role] || "", m["content"] || m[:content] || ""}
      end)

    valid? = fn {role, content} ->
      role == answer_role and is_binary(content) and String.trim(content) != ""
    end

    if scenario in @qa_scenarios do
      case Enum.find_index(entries, fn {role, _} -> role == "ai" end) do
        nil -> []
        idx -> entries |> Enum.drop(idx + 1) |> Enum.filter(valid?) |> Enum.map(&elem(&1, 1))
      end
    else
      entries |> Enum.filter(valid?) |> Enum.map(&elem(&1, 1))
    end
  end

  @doc "调用模型评分，返回 {:ok, %{score, report}} | {:error, reason}"
  def evaluate(scenario, answers) do
    rubric = Map.get(@rubrics, scenario, "综合实践：评估内容质量与完成度")

    text =
      answers
      |> Enum.join("\n\n---\n\n")
      |> String.slice(0, 6000)

    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [
             %{
               role: "system",
               content:
                 "#{rubric}。请仅依据学生的作答内容打分（0-100）并写 3-5 句评估报告；" <>
                   "若作答内容明显不足或与题意无关，请给出与实际相符的较低分数。" <>
                   "只输出 JSON：{\"score\": 85, \"report\": \"...\"}。"
             },
             %{role: "user", content: "以下为学生的作答内容：\n#{text}"}
           ],
           max_tokens: 1024,
           temperature: 0.3,
           receive_timeout: 120_000
         ) do
      {:ok, resp} ->
        content = resp |> ReqLLM.Response.text() |> String.trim()

        case content |> extract_json() |> Jason.decode() do
          {:ok, %{"score" => score, "report" => report}} ->
            {:ok, %{score: score, report: report}}

          _ ->
            {:error, "评估结果解析失败"}
        end

      {:error, error} ->
        {:error, "AI 评估失败: #{inspect(error) |> String.slice(0, 200)}"}
    end
  end

  @doc "生成互动故事 AI 开场白（失败时回退为静态开场）"
  def generate_opening(_scenario, title) do
    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    system =
      "你是互动故事讲述者。请用中文热情地开场：简要设定一个引人入胜的场景，" <>
        "并请学生选择题材（科幻/历史/悬疑）或直接说“开始”。只输出开场白正文，不要额外说明。"

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [
             %{role: "system", content: system},
             %{role: "user", content: "故事标题：#{title || "互动故事"}。请开场。"}
           ],
           max_tokens: 512,
           temperature: 0.7,
           receive_timeout: 60_000
         ) do
      {:ok, resp} ->
        case resp |> ReqLLM.Response.text() |> String.trim() do
          "" -> default_opening()
          text -> text
        end

      _ ->
        default_opening()
    end
  end

  defp default_opening do
    "欢迎来到互动故事！请选择题材：科幻 / 历史 / 悬疑，或直接说“开始”，我们一起推进这段冒险。"
  end

  defp extract_json(text) do
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [inner] -> String.trim(inner)
      nil -> String.trim(text)
    end
  end
end
