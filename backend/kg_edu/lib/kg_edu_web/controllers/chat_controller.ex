defmodule KgEduWeb.ChatController do
  use KgEduWeb, :controller

  def stream_message(conn, %{"message" => message} = params) do
    conn
    |> put_resp_header("content-type", "text/event-stream")
    |> put_resp_header("cache-control", "no-cache")
    |> put_resp_header("connection", "keep-alive")
    |> send_chunked(200)
    |> stream_claude_response(message, params["ai_command_id"])
  end

  defp stream_claude_response(conn, message, ai_command_id \\ nil) do
    # ReqLLM.put_key(:openai_api_key, "sk-3e910c05b96a49f9aa0ea064bef50ceb")
    ReqLLM.put_key(:openrouter_api_key, "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")
    context = build_context_from_ai_command(ai_command_id)

    # Build messages with context
    messages =
      case context do
        nil -> [%ReqLLM.Message{role: :user, content: [ReqLLM.ContentPart.text(message)]}]
        _ -> context.messages ++ [%ReqLLM.Message{role: :user, content: [ReqLLM.ContentPart.text(message)]}]
      end

    llm_context = ReqLLM.Context.new(messages)

    {:ok, stream_response} = ReqLLM.stream_text("openrouter:z-ai/glm-4.5", llm_context)
    result =
      stream_response
      |> ReqLLM.StreamResponse.tokens()
      |> Stream.each(fn token ->
        chunk(conn, "data: #{token}\n\n")
      end)
      |> Stream.run()

    chunk(conn, "data: [DONE]\n\n")
    conn
  end

  defp build_context_from_ai_command(nil), do: nil

  defp build_context_from_ai_command(ai_command_id) when is_binary(ai_command_id) do
    case get_ai_command_context(ai_command_id) do
      {:ok, context} -> context
      {:error, _} -> nil
    end
  end

  defp build_context_from_ai_command(_), do: nil

  defp get_ai_command_context(ai_command_id) do
    with {:ok, command} <- KgEdu.AI.get_command(ai_command_id) do
      # Build context from AI command
      messages = []

      # Add system message if present
      messages =
        if command.system do
          messages ++ [%ReqLLM.Message{role: :system, content: [ReqLLM.ContentPart.text(command.system)]}]
        else
          messages
        end

      # Add user message if present
      messages =
        if command.user do
          messages ++ [%ReqLLM.Message{role: :user, content: [ReqLLM.ContentPart.text(command.user)]}]
        else
          messages
        end

      # Add assistant message if present
      messages =
        if command.assistant do
          messages ++ [%ReqLLM.Message{role: :assistant, content: [ReqLLM.ContentPart.text(command.assistant)]}]
        else
          messages
        end

      # Create multimodal message if title is present
      messages =
        if command.title do
          # Example of creating a multimodal message with title context
          context_message = %ReqLLM.Message{
            role: :user,
            content: [
              ReqLLM.ContentPart.text("Context: #{command.title}"),
              ReqLLM.ContentPart.text("Using this context, please respond to my message.")
            ]
          }
          messages ++ [context_message]
        else
          messages
        end

      {:ok, ReqLLM.Context.new(messages)}
    else
      error -> error
    end
  end
end
