defmodule KgEduWeb.ChatController do
  use KgEduWeb, :controller

  alias Jido.AI.Reasoning.ReAct

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
  def stream_message(conn, %{"message" => message} = params) do
    agent_type = Map.get(params, "agent", "edu")

    # Extract tenant from header or body
    tenant = extract_tenant(conn, params)

    conn =
      conn
      |> put_resp_header("content-type", "text/event-stream")
      |> put_resp_header("cache-control", "no-cache")
      |> put_resp_header("x-accel-buffering", "no")
      |> send_chunked(200)

    # Tenant is passed to tools via _tenant param, not set globally

    # Emit RUN_STARTED
    sse_write(conn, "RUN_STARTED", %{threadId: params["threadId"]})

    # Build config
    opts = build_opts(agent_type, tenant, params)

    # Stream ReAct events → Pi SDK SSE format
    events = KgEdu.Chat.stream_answer(message, opts)
    {conn, _} = stream_pi_sdk_events(conn, events)

    # Emit RUN_FINISHED
    sse_write(conn, "RUN_FINISHED", %{})

    conn
  end

  # ── Pi SDK SSE format adapter ───────────────────────────────────────────

  defp stream_pi_sdk_events(conn, events) do
    Enum.reduce(events, {conn, %{}}, fn event, {conn, state} ->
      case event.kind do
        :tool_started ->
          tool_name = Map.get(event.data, :tool_name) || "unknown"
          tool_call_id = Map.get(event.data, :tool_call_id) || generate_id()

          state = Map.put(state, :tool_name, tool_name)

          sse_write(conn, "TOOL_CALL_START", %{
            toolCallId: tool_call_id,
            toolCallName: tool_name
          })

          sse_write(conn, "TOOL_CALL_ARGS", %{
            toolCallId: tool_call_id,
            delta: Map.get(event.data, :arguments) |> inspect()
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
            # Emit TEXT_MESSAGE_START on first content
            unless Map.get(state, :text_started) do
              sse_write(conn, "TEXT_MESSAGE_START", %{})
              state = Map.put(state, :text_started, true)
            end

            sse_write(conn, "TEXT_MESSAGE_CONTENT", %{delta: delta})
            {conn, state}
          else
            {conn, state}
          end

        :request_completed ->
          # Emit TEXT_MESSAGE_END if we started text
          if Map.get(state, :text_started) do
            sse_write(conn, "TEXT_MESSAGE_END", %{})
          end

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

  defp extract_delta(data) do
    cond do
      is_binary(Map.get(data, :delta)) -> data.delta
      is_binary(Map.get(data, :content)) -> data.content
      true -> ""
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
    # Priority: body.orgSchema > forwardedProps.orgSchema > X-Org-Schema header > assigns
    params["orgSchema"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      params["tenant"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema] ||
      conn.assigns[:tenant]
  end
end
