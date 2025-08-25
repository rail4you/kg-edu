defmodule KgEdu.Chat do
  alias LangChain.Message
  alias LangChain.ChatModels.ChatOpenAI
  alias LangChain.Chains.LLMChain

  def chat(messages, opts \\ []) do
    model =
      ChatOpenAI.new!(%{
        endpoint: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
        api_key: "sk-3e910c05b96a49f9aa0ea064bef50ceb",
        model: "qwen-plus-latest",
        max_tokens: 2048
      })

    try do
      chain =
        LLMChain.new!(%{llm: model, verbose: true})
        |> LLMChain.add_message(Message.new_user!(messages))
        |> LLMChain.run()

      chain
    rescue
      e in LangChain.LangChainError ->
        IO.inspect(e, label: "LangChain Error")
        {:error, e}
    end
  end
end

defmodule KgEdu.ApiTest do
  require Logger

  def test_dashscope_api do
    api_key = "sk-3e910c05b96a49f9aa0ea064bef50ceb"

    headers = [
      {"Content-Type", "application/json"},
      {"Authorization", "Bearer #{api_key}"}
    ]

    body =
      Jason.encode!(%{
        "model" => "qwen-plus-latest",
        "messages" => [
          %{
            "role" => "user",
            "content" => "Hello, how are you?"
          }
        ],
        "temperature" => 0.1
      })

    req =
      Req.new(
        url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
        headers: headers
      )

    case Req.post(req, json: body) do
      {:ok, response_body} ->
        Logger.info("API test successful:}")
        {:ok, response_body}

      {:error, reason} ->
        Logger.error("HTTP request failed: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
