defmodule KgEduWeb.PracticeController do
  @moduledoc """
  P3: AI 实践评估 — 按场景 rubric 对作答实录实时评分并生成报告。
  """
  use KgEduWeb, :controller
  require Logger

  plug KgEduWeb.Plugs.RequireEditable when action in [:evaluate]

  alias KgEdu.Agent.PracticeEvaluator

  @doc """
  POST /api/practice/evaluate — body: { scenario, transcript, userId?, courseId? }。
  仅依据学生的「作答内容」评分：问答型场景取 AI 提问之后的用户消息，
  作品/代码类场景取全部非空用户消息；若无作答则直接拒绝，不评分、不落库。
  返回 { score, report, attempt_id }。
  """
  def evaluate(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    scenario = input["scenario"]
    transcript = input["transcript"] || []
    answers = PracticeEvaluator.extract_answers(transcript, scenario, "user")

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(scenario) or scenario == "" ->
        json(conn, %{success: false, error: "缺少场景 scenario"})

      answers == [] ->
        json(conn, %{success: false, error: "尚无作答，无法评分：请先完成作答后再生成评估报告"})

      true ->
        case PracticeEvaluator.evaluate(scenario, answers) do
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

  @doc """
  GET /api/practice/attempts?tenant=&scenario=&userId= — 教师端查看 AI 实践记录。
  返回租户内学生的作答实录 + AI 评分报告，可按场景/学生过滤。
  """
  def list_attempts(conn, params) do
    tenant = extract_tenant(conn, params)
    scenario = params["scenario"]
    user_id = params["userId"] || params["user_id"]

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      case KgEdu.Knowledge.PracticeAttempt.list_practice_attempts(tenant: tenant, authorize?: false) do
        {:ok, list} ->
          filtered =
            list
            |> Enum.filter(fn a -> is_nil(scenario) or scenario == "" or to_string(a.scenario) == scenario end)
            |> Enum.filter(fn a -> is_nil(user_id) or user_id == "" or a.user_id == user_id end)
            |> Enum.sort_by(& &1.inserted_at, {:desc, DateTime})

          json(conn, %{success: true, data: Enum.map(filtered, &attempt_map/1)})

        {:error, e} ->
          json(conn, %{success: false, error: inspect(e)})
      end
    end
  end

  defp attempt_map(a) do
    %{
      id: a.id,
      scenario: to_string(a.scenario),
      user_id: a.user_id,
      course_id: a.course_id,
      transcript: a.transcript || [],
      score: a.score,
      report: a.report,
      status: to_string(a.status),
      inserted_at: a.inserted_at,
      updated_at: a.updated_at
    }
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end

