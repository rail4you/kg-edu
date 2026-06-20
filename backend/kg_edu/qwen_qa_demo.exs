# Usage:
#   mix run qwen_qa_demo.exs "你好，请用一句话介绍 Elixir 语言"
#
# Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
# (see Jido.AI.Examples.CalculatorAgent)

question =
  System.argv()
  |> List.first() ||
    "你好，请用一句话介绍 Elixir 语言"

{:ok, _} = Application.ensure_all_started(:kg_edu)
{:ok, _} = Jido.start()

jido_instance = Jido.default_instance()
{:ok, pid} = Jido.AgentServer.start(jido: jido_instance, agent: KgEdu.JidoAgents.QwenQaAgent)

case KgEdu.JidoAgents.QwenQaAgent.ask_sync(pid, question, timeout: 30_000) do
  {:ok, answer} when is_binary(answer) ->
    IO.puts("\n=== Qwen Answer ===\n#{answer}\n")

  {:ok, result} ->
    IO.puts(
      "\n=== Qwen Result ===\n#{inspect(result, limit: :infinity, printable_limit: 4096)}\n"
    )

  {:error, reason} ->
    IO.puts("\n=== Qwen Error ===\n#{inspect(reason, limit: :infinity, printable_limit: 4096)}\n")
    System.halt(1)
end
