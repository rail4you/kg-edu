defmodule KgEduWeb.PracticeSessionController do
  @moduledoc """
  互动实践共享会话 — 教师创建、学生凭 token 加入；师生共享 transcript 与 AI 评分。

  路由（scope "/api"）：
    POST /practice-session                 创建会话（教师）
    GET  /practice-session/mine            我的会话列表（?role=teacher|student&userId=）
    GET  /practice-session/:token          按 token 读取会话
    POST /practice-session/:token/join     学生加入
    POST /practice-session/:token/messages 追加消息（师生/AI）
    POST /practice-session/:token/evaluate 触发 AI 评分并写入会话
  """
  use KgEduWeb, :controller
  require Logger

  alias KgEdu.Agent.PracticeEvaluator
  alias KgEdu.Knowledge.PracticeSession

  @allowed_roles ~w(teacher student ai)

  # GET /api/practice-session/mine?role=teacher&userId=...
  def mine(conn, params) do
    tenant = extract_tenant(conn, params)
    role = params["role"]
    user_id = params["userId"] || params["user_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(user_id) ->
        json(conn, %{success: false, error: "缺少 userId"})

      true ->
        result =
          case role do
            "student" -> PracticeSession.list_by_student(%{student_id: user_id}, tenant: tenant, authorize?: false)
            _ -> PracticeSession.list_by_teacher(%{teacher_id: user_id}, tenant: tenant, authorize?: false)
          end

        case result do
          {:ok, list} ->
            sorted = Enum.sort_by(list, & &1.updated_at, {:desc, DateTime})
            json(conn, %{success: true, data: Enum.map(sorted, &session_map/1)})

          {:error, e} ->
            json(conn, %{success: false, error: inspect(e)})
        end
    end
  end

  # GET /api/practice-session/tenant — 租户内所有互动故事会话（学生可加入）
  def list_tenant(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      case PracticeSession.list_sessions(tenant: tenant, authorize?: false) do
        {:ok, list} ->
          open = Enum.reject(list, &(&1.status == :closed))
          sorted = Enum.sort_by(open, & &1.updated_at, {:desc, DateTime})
          json(conn, %{success: true, data: Enum.map(sorted, &session_map/1)})

        {:error, e} ->
          json(conn, %{success: false, error: inspect(e)})
      end
    end
  end

  # POST /api/practice-session
  def create(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      true ->
        attrs = %{
          title: input["title"] || "互动故事课堂",
          course_id: input["courseId"] || input["course_id"],
          teacher_id: input["teacherId"] || input["teacher_id"],
          scenario: to_scenario(input["scenario"])
        }

        case PracticeSession.create_session(attrs, tenant: tenant, authorize?: false) do
          {:ok, session} -> json(conn, %{success: true, data: session_map(session)})
          {:error, e} -> json(conn, %{success: false, error: inspect(e)})
        end
    end
  end

  # GET /api/practice-session/:token
  def show(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)

    with false <- is_nil(tenant),
         {:ok, session} <- fetch(token, tenant) do
      json(conn, %{success: true, data: session_map(session)})
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, _} -> json(conn, %{success: false, error: "会话不存在或已失效"})
    end
  end

  # POST /api/practice-session/:token/join
  def join(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    student_id = input["studentId"] || input["student_id"]

    with false <- is_nil(tenant),
         {:ok, session} <- fetch(token, tenant),
         {:ok, updated} <- maybe_join(session, student_id, tenant) do
      json(conn, %{success: true, data: session_map(updated)})
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: to_string(reason)})
    end
  end

  # POST /api/practice-session/:token/messages — body { messages: [{role, content}] }
  def messages(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    incoming = input["messages"] || []

    with false <- is_nil(tenant),
         {:ok, session} <- fetch(token, tenant) do
      new_msgs = incoming |> Enum.map(&sanitize_msg/1) |> Enum.reject(&is_nil/1)

      if new_msgs == [] do
        json(conn, %{success: false, error: "没有可写入的消息"})
      else
        merged = (session.transcript || []) ++ new_msgs

        case PracticeSession.update_session(session, %{transcript: merged}, tenant: tenant, authorize?: false) do
          {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
          {:error, e} -> json(conn, %{success: false, error: inspect(e)})
        end
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: to_string(reason)})
    end
  end

  # POST /api/practice-session/:token/evaluate — 评分学生作答并写入会话
  def evaluate(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)

    with false <- is_nil(tenant),
         {:ok, session} <- fetch(token, tenant) do
      answers = PracticeEvaluator.extract_answers(session.transcript || [], "interactive_story", "student")

      if answers == [] do
        json(conn, %{success: false, error: "学生尚无作答，无法评分"})
      else
        case PracticeEvaluator.evaluate("interactive_story", answers) do
          {:ok, %{score: score, report: report}} ->
            case PracticeSession.evaluate_session(session, %{score: score, report: report}, tenant: tenant, authorize?: false) do
              {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end

          {:error, reason} ->
            json(conn, %{success: false, error: reason})
        end
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: to_string(reason)})
    end
  end

  # POST /api/practice-session/:token/start — 空会话时生成 AI 开场白（幂等）
  def start(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)

    with false <- is_nil(tenant),
         {:ok, session} <- fetch(token, tenant) do
      if (session.transcript || []) == [] do
        opening = PracticeEvaluator.generate_opening(session.scenario, session.title)
        merged = [%{"role" => "ai", "content" => opening}]

        case PracticeSession.update_session(session, %{transcript: merged}, tenant: tenant, authorize?: false) do
          {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
          {:error, e} -> json(conn, %{success: false, error: inspect(e)})
        end
      else
        json(conn, %{success: true, data: session_map(session)})
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: to_string(reason)})
    end
  end

  # POST /api/practice-session/:token/grade — 教师手动改分/覆盖报告
  def grade(conn, %{"token" => token} = params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    raw_score = input["score"]
    score = to_int(raw_score)

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(score) or score < 0 or score > 100 ->
        json(conn, %{success: false, error: "请提供 0-100 的有效分数"})

      true ->
        case fetch(token, tenant) do
          {:ok, session} ->
            report = input["report"] || session.report || "教师手动评分"

            case PracticeSession.evaluate_session(session, %{score: score, report: report}, tenant: tenant, authorize?: false) do
              {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
              {:error, e} -> json(conn, %{success: false, error: inspect(e)})
            end

          {:error, reason} ->
            json(conn, %{success: false, error: to_string(reason)})
        end
    end
  end

  # --- helpers ---

  defp to_int(v) when is_integer(v), do: v
  defp to_int(v) when is_float(v), do: trunc(v)
  defp to_int(v) when is_binary(v) do
    case Integer.parse(v) do
      {n, _} -> n
      _ -> nil
    end
  end
  defp to_int(_), do: nil

  defp fetch(token, tenant) do
    PracticeSession.get_by_token(%{token: token}, tenant: tenant, authorize?: false)
  end

  defp maybe_join(session, student_id, tenant) do
    cond do
      is_nil(student_id) -> {:error, "缺少 studentId"}
      # 租户内学生均可加入；仅在尚无学生时记录加入者，其余保持原样
      is_nil(session.student_id) -> PracticeSession.join_session(session, %{student_id: student_id}, tenant: tenant, authorize?: false)
      true -> {:ok, session}
    end
  end

  defp sanitize_msg(m) when is_map(m) do
    role = m["role"] || m[:role]
    content = m["content"] || m[:content]

    if role in @allowed_roles and is_binary(content) and String.trim(content) != "" do
      %{"role" => role, "content" => content}
    else
      nil
    end
  end

  defp sanitize_msg(_), do: nil

  defp to_scenario(nil), do: :interactive_story
  defp to_scenario(s) when is_atom(s), do: s
  defp to_scenario("dialogue"), do: :dialogue
  defp to_scenario("work_upload"), do: :work_upload
  defp to_scenario("thinking_ladder"), do: :thinking_ladder
  defp to_scenario("debate_arena"), do: :debate_arena
  defp to_scenario("code_editor"), do: :code_editor
  defp to_scenario(_), do: :interactive_story

  defp session_map(s) do
    %{
      id: s.id,
      token: s.token,
      scenario: to_string(s.scenario),
      title: s.title,
      course_id: s.course_id,
      teacher_id: s.teacher_id,
      student_id: s.student_id,
      transcript: s.transcript || [],
      score: s.score,
      report: s.report,
      status: to_string(s.status),
      inserted_at: s.inserted_at,
      updated_at: s.updated_at
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
