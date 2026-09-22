defmodule KgEduWeb.PracticeController do
  @moduledoc """
  P3: AI 实践评估 — 按场景 rubric 对作答实录实时评分并生成报告。
  """
  use KgEduWeb, :controller
  require Logger

  plug KgEduWeb.Plugs.RequireEditable when action in [:evaluate]

  @rubrics %{
    "dialogue" => "情景对话：评估语言表达、情境贴合度、应变能力",
    "work_upload" => "上传作品：评估作品完整性、规范性、创新性",
    "thinking_ladder" => "思维阶梯：评估思维层层递进、逻辑严密性",
    "debate_arena" => "思辨擂台：评估论点鲜明度、论据充分性、反驳力度",
    "code_editor" => "代码编辑：评估代码正确性、规范性、运行效率",
    "interactive_story" => "互动故事：评估情节连贯性、创造力、参与度"
  }

  @doc """
  POST /api/practice/evaluate — body: { scenario, transcript, userId?, courseId? }。
  返回 { score, report, attempt_id }。
  """
  def evaluate(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    scenario = input["scenario"]
    transcript = input["transcript"] || []

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(scenario) or scenario == "" ->
        json(conn, %{success: false, error: "缺少场景 scenario"})

      true ->
        case do_evaluate(scenario, transcript, tenant) do
          {:ok, %{score: score, report: report}} ->
            attempt_id =
              case KgEdu.Knowledge.PracticeAttempt.create_practice_attempt(
                     %{
                       scenario: String.to_existing_atom(scenario),
                       user_id: input["userId"] || input["user_id"],
                       course_id: input["courseId"] || input["course_id"],
                       transcript: transcript,
                       score: score,
                       report: report,
                       status: :evaluated
                     },
                     tenant: tenant,
                     authorize?: false
                   ) do
                {:ok, attempt} -> attempt.id
                _ -> nil
              end

            json(conn, %{success: true, score: score, report: report, attempt_id: attempt_id})

          {:error, reason} ->
            json(conn, %{success: false, error: reason})
        end
    end
  end

  defp do_evaluate(scenario, transcript, _tenant) do
    rubric = Map.get(@rubrics, scenario, "综合实践：评估内容质量与完成度")
    text = transcript |> Enum.map_join("\n", &"[#{&1["role"] || &1[:role]}] #{&1["content"] || &1[:content]}")

    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [
             %{
               role: "system",
               content:
                 "#{rubric}。请对学生作答打分（0-100）并写 3-5 句评估报告，只输出 JSON：{\"score\": 85, \"report\": \"...\"}。"
             },
             %{role: "user", content: String.slice(text, 0, 6000)}
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

  defp extract_json(text) do
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, text, capture: :all_but_first) do
      [inner] -> String.trim(inner)
      nil -> String.trim(text)
    end
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
