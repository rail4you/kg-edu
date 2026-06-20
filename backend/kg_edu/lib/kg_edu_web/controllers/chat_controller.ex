defmodule KgEduWeb.ChatController do
  use KgEduWeb, :controller

  alias Jido.AI.Reasoning.ReAct

  @doc """
  SSE streaming chat endpoint.

  Accepts:
    - `message` (required) — the user's message
    - `agent` (optional, default "qa") — agent type: "qa", "math", "node_math"
    - `ai_command_id` (optional) — AI command context ID

  Returns a text/event-stream of ReAct events:
    - `data: {"event":"llm_delta","content":"..."}`
    - `data: {"event":"tool_start","tool":"add","call_id":"..."}`
    - `data: {"event":"tool_complete","tool":"add","call_id":"..."}`
    - `data: {"event":"done"}`
    - `data: {"event":"error","message":"..."}`
  """
  def stream_message(conn, %{"message" => message} = params) do
    agent_type = Map.get(params, "agent", "qa")
    ai_command_id = params["ai_command_id"]

    conn =
      conn
      |> put_resp_header("content-type", "text/event-stream")
      |> put_resp_header("cache-control", "no-cache")
      |> put_resp_header("x-accel-buffering", "no")
      |> send_chunked(200)

    # Build system prompt with AI command context if provided
    context_prompt = build_context_prompt(ai_command_id)
    system_prompt = if context_prompt, do: context_prompt, else: nil

    # Build agent config
    opts = [system_prompt: system_prompt]

    config =
      case agent_type do
        "math" -> KgEdu.Chat.math_config(opts)
        "node_math" -> KgEdu.Chat.node_math_config(opts)
        _ -> KgEdu.Chat.qa_config(opts)
      end

    # Stream ReAct events as SSE
    events = KgEdu.Chat.stream_answer(message, config)
    stream_react_events(conn, events)
  end

  # ── SSE streaming ───────────────────────────────────────────────────────

  defp stream_react_events(conn, events) do
    {conn, _final_text} =
      Enum.reduce(events, {conn, ""}, fn event, {conn, text} ->
        case event.kind do
          :tool_started ->
            {sse_event(conn, "tool_start", %{
              tool: event.tool_name || "unknown",
              call_id: event.tool_call_id
            }), text}

          :tool_completed ->
            {sse_event(conn, "tool_complete", %{
              tool: event.tool_name || "unknown",
              call_id: event.tool_call_id
            }), text}

          :llm_delta ->
            content = extract_delta(event.data)
            if content != "" do
              {sse_event(conn, "llm_delta", %{content: content}), text <> content}
            else
              {conn, text}
            end

          :request_completed ->
            {sse_event(conn, "done", %{}), text}

          :request_failed ->
            error = Map.get(event.data, :error, "Unknown error")
            {sse_event(conn, "error", %{message: inspect(error)}), text}

          _ ->
            {conn, text}
        end
      end)

    sse_event(conn, "done", %{})
  end

  defp extract_delta(data) do
    cond do
      is_binary(Map.get(data, :delta)) -> data.delta
      is_binary(Map.get(data, :content)) -> data.content
      true -> ""
    end
  end

  defp sse_event(conn, event, payload) do
    data = Jason.encode!(Map.put(payload, :event, event))
    {:ok, conn} = chunk(conn, "data: #{data}\n\n")
    conn
  end

  # ── AI command context ──────────────────────────────────────────────────

  defp build_context_prompt(nil), do: nil

  defp build_context_prompt(ai_command_id) when is_binary(ai_command_id) do
    case get_ai_command_context(ai_command_id) do
      {:ok, prompt} -> prompt
      {:error, _} -> nil
    end
  end

  defp build_context_prompt(_), do: nil

  defp get_ai_command_context(ai_command_id) do
    with {:ok, command} <- KgEdu.AI.get_command(ai_command_id) do
      parts =
        []
        |> maybe_add("System", command.system)
        |> maybe_add("User", command.user)
        |> maybe_add("Assistant", command.assistant)

      prompt =
        if parts == [] do
          nil
        else
          "## AI Command Context\n\n" <> Enum.join(parts, "\n\n")
        end

      {:ok, prompt}
    end
  end

  defp maybe_add(acc, _label, nil), do: acc
  defp maybe_add(acc, _label, ""), do: acc

  defp maybe_add(acc, label, value) do
    acc ++ ["**#{label}:**\n\n#{value}"]
  end
end
