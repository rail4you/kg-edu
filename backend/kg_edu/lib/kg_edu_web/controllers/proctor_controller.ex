defmodule KgEduWeb.ProctorController do
  @moduledoc """
  考试监考抓拍 — 基于真实摄像头画面（学生端上报）的监考。

  路由（scope "/api"）：
    GET  /proctor/exams                       — 老师创建的考试（带 student_count）
    GET  /proctor/exams/:id/students          — 该考试学生 + 监控状态 + 最新画面
    GET  /proctor/exams/:id/snapshots         — 该考试抓拍记录（真实数据）
    POST /proctor/session/start               — 学生开启监控
    POST /proctor/session/frame               — 学生上报最新画面帧
    POST /proctor/session/stop                — 学生关闭监控
    POST /proctor/snapshots                   — 教师抓拍（手动/自动）

  数据通路：
    header `x-org-schema` = tenant schema name，作为 tenant context 传给 Ash。
  """

  use KgEduWeb, :controller

  require Logger

  alias KgEdu.Knowledge.{Exam, ProctorSession, ProctorSnapshot}

  # ── 考试列表 ──────────────────────────────────────────────────────────────

  def exams(conn, params) do
    tenant = extract_tenant(conn, params)

    if blank?(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      exams =
        try do
          Exam
          |> Ash.Query.for_read(:read)
          |> Ash.Query.load(student_exams: [:student])
          |> Ash.Query.sort(inserted_at: :desc)
          |> Ash.read!(tenant: tenant)
          |> Enum.filter(fn e -> count_students(e) > 0 end)
          |> Enum.map(fn exam ->
            %{
              id: exam.id,
              title: exam.title,
              exam_type: exam.exam_type,
              started_at: format_datetime(exam.exam_date),
              duration_minutes: exam.duration_minutes,
              status: if(exam.deadline_at, do: "finished", else: "ongoing"),
              student_count: count_students(exam),
              room: "考场 #{room_code(exam.id)}"
            }
          end)
        rescue
          e ->
            Logger.error("[ProctorController] exams read failed: #{inspect(e)}")
            {:error, e}
        end

      case exams do
        {:error, _} -> json(conn, %{success: false, error: "考试数据读取失败"})
        list when is_list(list) -> json(conn, %{success: true, data: list})
      end
    end
  end

  # ── 学生监控状态 + 最新画面 ─────────────────────────────────────────────────

  def students(conn, %{"id" => exam_id} = params) do
    tenant = extract_tenant(conn, params)

    if blank?(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      try do
        exam = load_exam(exam_id, tenant)
        sessions = ProctorSession.list_by_exam(%{exam_id: exam.id}, tenant: tenant, authorize?: false)
        sessions = unwrap(sessions)
        snapshots = ProctorSnapshot.list_by_exam(%{exam_id: exam.id}, tenant: tenant, authorize?: false)
        snapshots = unwrap(snapshots)

        sessions_by_student =
          sessions
          |> Enum.group_by(& &1.student_id)
          |> Enum.map(fn {sid, list} -> {sid, hd(list)} end)
          |> Map.new()

        snapshot_counts =
          snapshots
          |> Enum.group_by(& &1.student_id)
          |> Enum.map(fn {sid, list} -> {sid, length(list)} end)
          |> Map.new()

        data =
          exam.student_exams
          |> Enum.uniq_by(& &1.student_id)
          |> Enum.with_index()
          |> Enum.map(fn {se, idx} ->
            session = Map.get(sessions_by_student, se.student_id)

            %{
              student_id: se.student_id,
              student_name: name_for(se),
              student_email: email_for(se),
              seat: "座位 #{String.pad_leading("#{idx + 1}", 2, "0")}",
              active: session != nil and session.active,
              last_frame_url: session && session.last_frame_url,
              last_frame_at: session && session.last_frame_at,
              snapshot_count: Map.get(snapshot_counts, se.student_id, 0)
            }
          end)

        json(conn, %{success: true, data: data})
      rescue
        e ->
          Logger.error("[ProctorController] students read failed: #{inspect(e)}")
          json(conn, %{success: false, error: "读取学生监控状态失败"})
      end
    end
  end

  # ── 学生上报：开启监控 ───────────────────────────────────────────────────────

  def start_session(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    with false <- blank?(tenant),
         {:ok, exam_id} <- fetch_uuid(input, "examId"),
         {:ok, student_id} <- fetch_uuid(input, "studentId") do
      now = DateTime.utc_now()

      result =
        case find_session(exam_id, student_id, tenant) do
          nil ->
            ProctorSession.create_session(
              %{
                exam_id: exam_id,
                student_id: student_id,
                student_name: input["studentName"] || input["student_name"],
                active: true,
                started_at: now
              },
              tenant: tenant,
              authorize?: false
            )

          session ->
            ProctorSession.update_session(
              session,
              %{active: true, started_at: now, student_name: input["studentName"] || session.student_name},
              tenant: tenant,
              authorize?: false
            )
        end

      case result do
        {:ok, session} -> json(conn, %{success: true, data: session_map(session)})
        {:error, e} -> json(conn, %{success: false, error: inspect(e)})
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: reason})
    end
  end

  # ── 学生上报：最新画面帧 ────────────────────────────────────────────────────

  def report_frame(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    with false <- blank?(tenant),
         {:ok, exam_id} <- fetch_uuid(input, "examId"),
         {:ok, student_id} <- fetch_uuid(input, "studentId") do
      image = input["image"] || input["frame"] || input["imageUrl"]
      now = DateTime.utc_now()

      cond do
        blank?(image) ->
          json(conn, %{success: false, error: "缺少画面数据"})

        true ->
          session =
            case find_session(exam_id, student_id, tenant) do
              nil ->
                case ProctorSession.create_session(
                       %{
                         exam_id: exam_id,
                         student_id: student_id,
                         student_name: input["studentName"] || input["student_name"],
                         active: true,
                         started_at: now
                       },
                       tenant: tenant,
                       authorize?: false
                     ) do
                  {:ok, s} -> s
                  {:error, _} -> nil
                end

              s ->
                s
            end

          case session do
            nil ->
              json(conn, %{success: false, error: "会话创建失败"})

            s ->
              case ProctorSession.update_session(
                     s,
                     %{active: true, last_frame_url: image, last_frame_at: now},
                     tenant: tenant,
                     authorize?: false
                   ) do
                {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
                {:error, e} -> json(conn, %{success: false, error: inspect(e)})
              end
          end
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: reason})
    end
  end

  # ── 学生上报：关闭监控 ───────────────────────────────────────────────────────

  def stop_session(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    with false <- blank?(tenant),
         {:ok, exam_id} <- fetch_uuid(input, "examId"),
         {:ok, student_id} <- fetch_uuid(input, "studentId") do
      case find_session(exam_id, student_id, tenant) do
        nil ->
          json(conn, %{success: true, data: nil})

        session ->
          case ProctorSession.update_session(session, %{active: false}, tenant: tenant, authorize?: false) do
            {:ok, updated} -> json(conn, %{success: true, data: session_map(updated)})
            {:error, e} -> json(conn, %{success: false, error: inspect(e)})
          end
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: reason})
    end
  end

  # ── 教师抓拍 ────────────────────────────────────────────────────────────────

  def capture(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    with false <- blank?(tenant),
         {:ok, exam_id} <- fetch_uuid(input, "examId"),
         {:ok, student_id} <- fetch_uuid(input, "studentId") do
      session = find_session(exam_id, student_id, tenant)
      image = input["image"] || (session && session.last_frame_url)

      cond do
        blank?(image) ->
          json(conn, %{success: false, error: "该学生尚未开启监控，暂无可抓拍画面"})

        true ->
          attrs = %{
            exam_id: exam_id,
            student_id: student_id,
            student_name: input["studentName"] || (session && session.student_name),
            image_url: image,
            source: to_source(input["source"]),
            captured_at: DateTime.utc_now()
          }

          case ProctorSnapshot.create_snapshot(attrs, tenant: tenant, authorize?: false) do
            {:ok, snap} -> json(conn, %{success: true, data: snapshot_map(snap)})
            {:error, e} -> json(conn, %{success: false, error: inspect(e)})
          end
      end
    else
      true -> json(conn, %{success: false, error: "未设置租户上下文"})
      {:error, reason} -> json(conn, %{success: false, error: reason})
    end
  end

  # ── 抓拍记录列表 ────────────────────────────────────────────────────────────

  def snapshots(conn, %{"id" => exam_id} = params) do
    tenant = extract_tenant(conn, params)

    if blank?(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      try do
        exam_id = String.replace_prefix(exam_id, "exam-", "")
        list = ProctorSnapshot.list_by_exam(%{exam_id: exam_id}, tenant: tenant, authorize?: false) |> unwrap()
        json(conn, %{success: true, data: Enum.map(list, &snapshot_map/1)})
      rescue
        e ->
          Logger.error("[ProctorController] snapshots read failed: #{inspect(e)}")
          json(conn, %{success: true, data: []})
      end
    end
  end

  # ── Private ────────────────────────────────────────────────────────────────

  defp find_session(exam_id, student_id, tenant) do
    case ProctorSession.list_by_exam_student(%{exam_id: exam_id, student_id: student_id}, tenant: tenant, authorize?: false) do
      {:ok, [session | _]} -> session
      _ -> nil
    end
  end

  defp load_exam(exam_id, tenant) do
    id = String.replace_prefix(exam_id, "exam-", "")
    Ash.get!(Exam, id, tenant: tenant, load: [student_exams: [:student]])
  end

  defp unwrap({:ok, list}) when is_list(list), do: list
  defp unwrap(list) when is_list(list), do: list
  defp unwrap(_), do: []

  defp count_students(exam) do
    exam.student_exams
    |> Enum.map(& &1.student_id)
    |> Enum.uniq()
    |> length()
  rescue
    _ -> 0
  end

  defp name_for(se) do
    student = se.student

    cond do
      student && student.name && student.name != "" -> student.name
      student && student.email -> student.email
      true -> "未知学生"
    end
  rescue
    _ -> "未知学生"
  end

  defp email_for(se) do
    se.student && se.student.email
  rescue
    _ -> nil
  end

  defp room_code(uuid) when is_binary(uuid) do
    Base.encode16(binary_part(<<0>> <> uuid, 0, 2), case: :lower)
  rescue
    _ -> "100"
  end

  defp room_code(_), do: "100"

  defp snapshot_map(s) do
    %{
      id: s.id,
      exam_id: s.exam_id,
      student_id: s.student_id,
      student_name: s.student_name,
      image_url: s.image_url,
      source: to_string(s.source),
      captured_at: format_datetime(s.captured_at)
    }
  end

  defp session_map(s) do
    %{
      id: s.id,
      exam_id: s.exam_id,
      student_id: s.student_id,
      student_name: s.student_name,
      active: s.active,
      last_frame_at: format_datetime(s.last_frame_at),
      started_at: format_datetime(s.started_at),
      updated_at: format_datetime(s.updated_at)
    }
  end

  defp to_source("auto"), do: :auto
  defp to_source(:auto), do: :auto
  defp to_source(_), do: :manual

  defp fetch_uuid(input, key) do
    v = input[key] || input[String.downcase(key)] || input[snake(key)]
    v = if is_binary(v), do: String.replace_prefix(v, "exam-", ""), else: v

    if blank?(v) do
      {:error, "缺少参数 #{key}"}
    else
      {:ok, v}
    end
  end

  defp snake(key) do
    key
    |> String.replace(~r/([A-Z])/, "_\\1")
    |> String.downcase()
  end

  defp blank?(nil), do: true
  defp blank?(""), do: true
  defp blank?(v) when is_binary(v), do: String.trim(v) == ""
  defp blank?(_), do: false

  defp format_datetime(nil), do: nil
  defp format_datetime(%DateTime{} = dt), do: DateTime.to_iso8601(dt)
  defp format_datetime(%NaiveDateTime{} = dt), do: NaiveDateTime.to_iso8601(dt)
  defp format_datetime(other) when is_binary(other), do: other
  defp format_datetime(_), do: nil

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
