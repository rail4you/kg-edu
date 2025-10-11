defmodule KgEduWeb.ChatController do
  use KgEduWeb, :controller

  def stream_message(conn, %{"message" => message}) do
    conn
    |> put_resp_header("content-type", "text/event-stream")
    |> put_resp_header("cache-control", "no-cache")
    |> put_resp_header("connection", "keep-alive")
    |> send_chunked(200)
    |> stream_claude_response(message)
  end

  defp stream_claude_response(conn, message) do
    ReqLLM.put_key(:openai_api_key, "sk-3e910c05b96a49f9aa0ea064bef50ceb")
    {:ok, stream_response} = ReqLLM.stream_text("openai:gpt-4", message)

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
end
