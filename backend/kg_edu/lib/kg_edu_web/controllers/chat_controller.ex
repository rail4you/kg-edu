defmodule KgEduWeb.ChatController do
  use KgEduWeb, :controller

  @doc """
  SSE streaming chat endpoint — Pi SDK compatible format.

  POST /api/chat or POST /api/assistant/ag-ui

  Accepts:
    - `message` — the user's message (required)
    - `agent` — "qa", "math", "edu" (default: "edu")
    - `threadId` — conversation thread ID
    - `orgSchema` / `X-Org-Schema` header — tenant context

  SSE event types (Pi SDK / CopilotKit format):
    - TEXT_MESSAGE_START / TEXT_MESSAGE_CONTENT / TEXT_MESSAGE_END
    - TOOL_CALL_START / TOOL_CALL_ARGS / TOOL_CALL_END
    - RUN_STARTED / RUN_FINISHED / RUN_ERROR
  """
  def stream_message(conn, params) do
    agent_type = Map.get(params, "agent", "edu")

    # Extract user message — supports both "message" (string) and "messages" (array)
    message = extract_user_message(params)

    if is_nil(message) or message == "" do
      conn
      |> put_status(400)
      |> json(%{error: "message is required"})
    else
      _stream_message(conn, params, message, agent_type)
    end
  end

  defp _stream_message(conn, params, message, agent_type) do
    # Extract tenant from header or body
    tenant = extract_tenant(conn, params)

    conn =
      conn
      |> put_resp_header("content-type", "text/event-stream")
      |> put_resp_header("cache-control", "no-cache")
      |> put_resp_header("x-accel-buffering", "no")
      |> send_chunked(200)

    sse_write(conn, "RUN_STARTED", %{threadId: params["threadId"]})

    # ── Pre-flight: knowledge point selection for doc generation ──────
    # If user asks for PPTX/docx but hasn't selected knowledge points yet,
    # and this is a new conversation (or the first doc gen request),
    # intercept and emit CUSTOM_UI instead of running the agent.
    if is_knowledge_selection_needed?(message, params, tenant) do
      course_id = params["courseId"] || extract_course_id_from_context(params, tenant)
      knowledge_list = fetch_knowledge_list(tenant, course_id, extract_search_term(message))

      if knowledge_list != [] do
        sse_write(conn, "CUSTOM_UI", %{
          uiType: "knowledge_selector",
          title: "📚 请选择要生成课件的知识点",
          description: "勾选需要包含的知识点（支持多选），确认后将自动生成PPT课件",
          items: knowledge_list,
          metadata: %{courseId: course_id}
        })

        sse_write(conn, "TEXT_MESSAGE_START", %{})
        sse_write(conn, "TEXT_MESSAGE_CONTENT", %{
          delta: "请在上方选择知识点后点击「确认生成」，我将为您生成包含所选知识点的PPT课件。"
        })
        sse_write(conn, "TEXT_MESSAGE_END", %{})
        sse_write(conn, "RUN_FINISHED", %{})

        conn
      else
        # No knowledge points found — fall through to normal agent flow
        _run_agent_stream(conn, params, message, agent_type, tenant)
      end
    else
      _run_agent_stream(conn, params, message, agent_type, tenant)
    end
  end

  # Check if this message needs knowledge point selection
  defp is_knowledge_selection_needed?(message, params, tenant) do
    is_doc_gen = is_document_generation_request?(message)
    has_kp = params["knowledgePointIds"] || params["selectedKnowledgeIds"]
    is_followup =
      is_binary(message) and
        String.match?(message, ~r/已选择知识点|确认生成|knowledgePointIds/)

    is_doc_gen and !is_followup and is_nil(has_kp) and tenant != nil
  end

  # Extract course_id from conversation context (forwardedProps, previous messages, etc.)
  defp extract_course_id_from_context(params, _tenant) do
    # Try forwardedProps first
    fp = params["forwardedProps"] || %{}
    fp["courseId"] ||
      # Try direct param
      params["courseId"] ||
      # Try last user message for course ID pattern
      extract_course_id_from_last_message(params)
  end

  defp extract_course_id_from_last_message(params) do
    messages = params["messages"] || []
    if is_list(messages) and messages != [] do
      last = List.last(messages)
      last["courseId"]
    end
  end

  # Extract potential knowledge point name from user message for fuzzy matching
  defp extract_search_term(message) when is_binary(message) do
    stripped =
      String.replace(message, ~r/(pptx|docx|PPT|课件|幻灯片|演示文稿|文档|教案|word|生成|创建|制作|给我|一份|一些|一个)/i, " ")
      |> String.trim()
      |> String.replace(~r/\s+/, " ")

    if stripped != "" and String.length(stripped) >= 2, do: stripped, else: nil
  end

  defp extract_search_term(_), do: nil

  defp _run_agent_stream(conn, params, message, agent_type, tenant) do
    # Build config
    opts = build_opts(agent_type, tenant, params)

    # Store user message in session context for tools to reference
    KgEdu.Agent.SessionContext.put(last_user_message: message)

    # Stream ReAct events → Pi SDK SSE format
    events = KgEdu.Chat.stream_answer(message, opts)
    {conn, final_state} = stream_pi_sdk_events(conn, events, tenant, message)

    # Flush any buffered text before finishing
    pending = Map.get(final_state, :pending_text, "")
    if pending != "" do
      if !Map.get(final_state, :text_started) do
        sse_write(conn, "TEXT_MESSAGE_START", %{})
      end
      sse_write(conn, "TEXT_MESSAGE_CONTENT", %{delta: pending})
      sse_write(conn, "TEXT_MESSAGE_END", %{})
    end

    # Emit RUN_FINISHED
    sse_write(conn, "RUN_FINISHED", %{})

    conn
  end

  # ── Pi SDK SSE format adapter ───────────────────────────────────────────

  defp stream_pi_sdk_events(conn, events, _tenant, _user_message) do
    Enum.reduce(events, {conn, %{text_buffer: "", text_started: false, has_tools: false, pending_text: ""}}, fn event, {conn, state} ->
      case event.kind do
        :tool_started ->
          # A tool call begins — discard any text the model produced so far: it
          # is narration/thinking ("我需要先获取课程列表...") and must never reach
          # the user. Only the text emitted after the LAST tool call (the final
          # answer) is kept and flushed when the run finishes.
          state =
            state
            |> Map.put(:has_tools, true)
            |> Map.put(:pending_text, "")

          tool_name = Map.get(event.data, :tool_name) || "unknown"
          tool_call_id = Map.get(event.data, :tool_call_id) || generate_id()
          args = Map.get(event.data, :arguments, %{})

          sse_write(conn, "TOOL_CALL_START", %{
            toolCallId: tool_call_id,
            toolCallName: tool_name
          })

          sse_write(conn, "TOOL_CALL_ARGS", %{
            toolCallId: tool_call_id,
            delta: args |> inspect()
          })

          {conn, state}

        :tool_completed ->
          tool_call_id = Map.get(event.data, :tool_call_id) || generate_id()

          sse_write(conn, "TOOL_CALL_END", %{
            toolCallId: tool_call_id
          })

          {conn, state}

        :llm_delta ->
          delta = extract_delta(event.data)

          if delta != "" do
            {clean_delta, state} = filter_tool_names(delta, state)

            if clean_delta != "" do
              # Buffer ALL text locally — the user only sees the final result.
              # Narration emitted before/between tool calls is discarded when the
              # next tool starts; whatever remains when the run finishes is the
              # final answer, flushed as a single TEXT_MESSAGE.* sequence.
              pending = Map.get(state, :pending_text, "") <> clean_delta
              {conn, Map.put(state, :pending_text, pending)}
            else
              {conn, state}
            end
          else
            {conn, state}
          end

        :request_completed ->
          # Text is only flushed once, in _run_agent_stream/4, after the whole
          # run completes — nothing to emit here.
          {conn, state}

        :request_failed ->
          error = Map.get(event.data, :error, "Unknown error")

          sse_write(conn, "RUN_ERROR", %{
            message: "Agent error: #{inspect(error)}"
          })

          {conn, state}

        _ ->
          {conn, state}
      end
    end)
  end

  # Extract user-visible text from an llm_delta event.
  #   - `:thinking` chunks are the model's internal reasoning (e.g. qwen
  #     reasoning_content) — never shown to the user.
  #   - `:tool_call` chunks are tool invocations — already surfaced as
  #     TOOL_CALL_START/ARGS/END events.
  #   - `:content` chunks are the actual answer text.
  defp extract_delta(data) do
    case Map.get(data, :chunk_type) do
      chunk_type when chunk_type in [:thinking, :tool_call] ->
        ""

      _ ->
        cond do
          is_binary(Map.get(data, :delta)) -> data.delta
          is_binary(Map.get(data, :content)) -> data.content
          true -> ""
        end
    end
  end

  # Tool names the LLM might accidentally output as text before calling
  @tool_names ~w(
    GetCourses GetCoursesByMajor GetCoursesBySemester
    GetChapters GetChapterById
    GetKnowledgeResources GetExercises GetExams
    GenerateExercises GenerateCompetencyGraph GenerateCurriculum
    GeneratePowerPointWithShapeCrawler SaveAsDocxAndUpload GenerateLessonPlan
  )

  # Filter out tool call names from text output.
  # Qwen sometimes outputs function names as text before making the tool call.
  # We suppress exact matches and only emit content that follows.
  defp filter_tool_names(delta, state) do
    buffer = Map.get(state, :text_buffer, "")
    combined = buffer <> delta

    # Find the longest matching tool name prefix
    match = Enum.find(@tool_names, fn name -> String.starts_with?(combined, name) end)

    if match do
      # Strip the tool name prefix from the combined text
      remaining = String.replace_prefix(combined, match, "")

      if remaining != "" do
        # Tool name followed by real text in same fragment — emit only the real text
        {remaining, Map.put(state, :text_buffer, "")}
      else
        # Exact or partial match on tool name — suppress entirely
        # (the tool call is already handled as TOOL_CALL_START event)
        {"", Map.put(state, :text_buffer, "")}
      end
    else
      # No tool name match
      if buffer != "" do
        # Previous buffer wasn't a tool name — emit all accumulated text
        {combined, Map.put(state, :text_buffer, "")}
      else
        # Normal text — emit as-is
        {delta, Map.put(state, :text_buffer, "")}
      end
    end
  end

  defp sse_write(conn, type, payload) when is_binary(type) do
    data = Jason.encode!(Map.put(payload, :type, type))
    {:ok, conn} = chunk(conn, "data: #{data}\n\n")
    conn
  end

  defp generate_id, do: "call_#{System.unique_integer([:positive])}"

  # ── config / tenant ─────────────────────────────────────────────────────

  defp build_opts("math", _tenant, _params) do
    KgEdu.Chat.math_config()
  end

  defp build_opts("qa", _tenant, _params) do
    KgEdu.Chat.qa_config()
  end

  defp build_opts(_agent_type, tenant, params) do
    opts = KgEdu.Chat.edu_config()

    if tenant do
      user_id = params["userId"] || (params["forwardedProps"] || %{})["userId"]
      KgEdu.Agent.SessionContext.put(tenant: tenant, user_id: user_id)

      original = Keyword.get(opts, :system_prompt, "")
      Keyword.put(opts, :system_prompt, original <> "\n\n当前租户: #{tenant}")
    else
      opts
    end
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      params["tenant"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema] ||
      conn.assigns[:tenant]
  end

  # Extract the last user message from either "message" string or "messages" array
  defp extract_user_message(params) do
    cond do
      is_binary(params["message"]) and params["message"] != "" ->
        params["message"]

      is_list(params["messages"]) ->
        params["messages"]
        |> Enum.reverse()
        |> Enum.find_value(fn m -> m["role"] == "user" && m["content"] end)

      true ->
        nil
    end
  end

  # ── CUSTOM_UI helpers ───────────────────────────────────────────────────

  # Detect if user message is a document generation request (PPTX/DOCX).
  defp is_document_generation_request?(nil), do: false

  defp is_document_generation_request?(message) when is_binary(message) do
    String.match?(message, ~r/ppt|pptx|课件|幻灯片|演示文稿|文档|docx|教案|word/i)
  end

  # Also handle messages array
  defp is_document_generation_request?(messages) when is_list(messages) do
    last_user = Enum.reverse(messages) |> Enum.find_value(fn m -> m["role"] == "user" && m["content"] end)
    is_document_generation_request?(last_user)
  end

  # Fetch relevant knowledge resources for document generation.
  defp fetch_knowledge_list(tenant, course_id, search_term) do
    if is_nil(tenant) do
      []
    else
      try do
        resources =
          KgEdu.Knowledge.Resource
          |> Ash.Query.new()
          |> Ash.Query.sort(name: :asc)
          |> Ash.read!(tenant: tenant, authorize?: false)

        # Filter by name (post-load) or course_id
        filtered =
          cond do
            search_term ->
              s = String.downcase(search_term)
              Enum.filter(resources, fn r ->
                String.contains?(String.downcase(r.name || ""), s)
              end)

            course_id ->
              Enum.filter(resources, fn r -> r.course_id == course_id end)

            true ->
              # No filter: show meaningful items only
              Enum.filter(resources, &is_relevant_item?/1)
          end

        # Determine the target course: from course_id, or by grouping search results
        target_course_id =
          course_id ||
            (filtered
             |> Enum.group_by(& &1.course_id)
             |> Enum.max_by(fn {_cid, items} -> length(items) end, fn -> {nil, []} end)
             |> elem(0))

        filtered
        |> Enum.filter(&(&1.course_id == target_course_id))
        |> Enum.sort_by(fn r ->
          order = case r.importance_level do
            "hard" -> 0
            "important" -> 1
            _ -> 2
          end
          {order, r.name}
        end)
        |> Enum.take(10)
        |> Enum.map(fn r ->
          %{
            id: r.id,
            name: r.name,
            description: r.description || "",
            importance_level: r.importance_level || "normal"
          }
        end)
      rescue
        _ -> []
      end
    end
  end

  defp is_relevant_item?(r) do
    (r.description && r.description != "") or r.importance_level in ["important", "hard"]
  end
end
