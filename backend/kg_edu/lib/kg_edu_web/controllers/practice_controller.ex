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
  返回 { score, report, attempt_id }。若存在进行中的草稿会话则复用同一条记录。
  """
  def evaluate(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    scenario = input["scenario"]
    transcript = input["transcript"] || []
    user_id = input["userId"] || input["user_id"]
    course_id = input["courseId"] || input["course_id"]
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
              case find_session(tenant, scenario, user_id, course_id) do
                nil ->
                  case KgEdu.Knowledge.PracticeAttempt.create_practice_attempt(
                         %{
                           scenario: String.to_existing_atom(scenario),
                           user_id: user_id,
                           course_id: course_id,
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

                existing ->
                  case KgEdu.Knowledge.PracticeAttempt.update_practice_attempt(
                         existing,
                         %{transcript: transcript, score: score, report: report, status: :evaluated},
                         tenant: tenant,
                         authorize?: false
                       ) do
                    {:ok, attempt} -> attempt.id
                    _ -> existing.id
                  end
              end

            json(conn, %{success: true, score: score, report: report, attempt_id: attempt_id})

          {:error, reason} ->
            json(conn, %{success: false, error: reason})
        end
    end
  end

  @doc """
  GET /api/practice/session?tenant=&scenario=&userId=&courseId= — 读取进行中的实践会话。
  返回该学生在指定场景 / 课程下最近的一条记录（transcript / status / score / report）。
  若不存在则返回 { success: true, data: nil }。
  """
  def session(conn, params) do
    tenant = extract_tenant(conn, params)
    scenario = params["scenario"]
    user_id = params["userId"] || params["user_id"]
    course_id = params["courseId"] || params["course_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(scenario) or scenario == "" ->
        json(conn, %{success: false, error: "缺少场景 scenario"})

      true ->
        case find_session(tenant, scenario, user_id, course_id) do
          nil -> json(conn, %{success: true, data: nil})
          attempt -> json(conn, %{success: true, data: attempt_map(attempt)})
        end
    end
  end

  @doc """
  POST /api/practice/session — 增量保存实践会话（草稿）。
  body: { scenario, userId?, courseId?, transcript }。存在则更新，不存在则创建。
  返回 { success: true, attempt_id }。
  """
  def save_session(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    scenario = input["scenario"]
    user_id = input["userId"] || input["user_id"]
    course_id = input["courseId"] || input["course_id"]
    transcript = input["transcript"] || []

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(scenario) or scenario == "" ->
        json(conn, %{success: false, error: "缺少场景 scenario"})

      true ->
        case find_session(tenant, scenario, user_id, course_id) do
          nil ->
            case KgEdu.Knowledge.PracticeAttempt.create_practice_attempt(
                   %{
                     scenario: String.to_existing_atom(scenario),
                     user_id: user_id,
                     course_id: course_id,
                     transcript: transcript,
                     status: :draft
                   },
                   tenant: tenant,
                   authorize?: false
                 ) do
              {:ok, attempt} -> json(conn, %{success: true, attempt_id: attempt.id})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end

          existing ->
            # 已评估的记录再次继续练习时，保留原分数但回到草稿状态
            case KgEdu.Knowledge.PracticeAttempt.update_practice_attempt(
                   existing,
                   %{transcript: transcript, status: :draft},
                   tenant: tenant,
                   authorize?: false
                 ) do
              {:ok, attempt} -> json(conn, %{success: true, attempt_id: attempt.id})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end
        end
    end
  end

  @doc """
  POST /api/practice/session/reset — 重置实践会话（清空对话记录、分数与报告，回到草稿）。
  body: { scenario, userId?, courseId? }。
  """
  def reset_session(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    scenario = input["scenario"]
    user_id = input["userId"] || input["user_id"]
    course_id = input["courseId"] || input["course_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(scenario) or scenario == "" ->
        json(conn, %{success: false, error: "缺少场景 scenario"})

      true ->
        case find_session(tenant, scenario, user_id, course_id) do
          nil ->
            json(conn, %{success: true})

          existing ->
            case KgEdu.Knowledge.PracticeAttempt.update_practice_attempt(
                   existing,
                   %{transcript: [], score: nil, report: nil, status: :draft},
                   tenant: tenant,
                   authorize?: false
                 ) do
              {:ok, _attempt} -> json(conn, %{success: true})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end
        end
    end
  end

  defp find_session(tenant, scenario, user_id, course_id) do
    case KgEdu.Knowledge.PracticeAttempt.list_practice_attempts(tenant: tenant, authorize?: false) do
      {:ok, list} ->
        list
        |> Enum.filter(fn a -> to_string(a.scenario) == to_string(scenario) end)
        |> Enum.filter(fn a -> blank?(user_id) or a.user_id == user_id end)
        |> Enum.filter(fn a -> blank?(course_id) or a.course_id == course_id end)
        |> Enum.sort_by(& &1.inserted_at, {:desc, DateTime})
        |> List.first()

      _ ->
        nil
    end
  end

  defp blank?(nil), do: true
  defp blank?(""), do: true
  defp blank?(_), do: false

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

