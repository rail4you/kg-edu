# Usage:
#   mix run qwen_node_math_demo.exs "请使用 Node.js 工具计算 (12 + 7) * 3 的结果，并解释你的推理过程。"
#
# Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
# (see Jido.AI.Examples.CalculatorAgent)

question =
  System.argv()
  |> List.first() ||
    "请使用 Node.js 工具计算 (12 + 7) * 3 的结果，并解释你的推理过程。"

{:ok, _} = Application.ensure_all_started(:kg_edu)
{:ok, _} = Jido.start()

jido_instance = Jido.default_instance()
{:ok, pid} = Jido.AgentServer.start(jido: jido_instance, agent: KgEdu.JidoAgents.QwenNodeMathAgent)

case KgEdu.JidoAgents.QwenNodeMathAgent.ask_sync(pid, question, timeout: 60_000) do
  {:ok, answer} when is_binary(answer) ->
    IO.puts("\n=== Qwen Answer ===\n#{answer}\n")

    # Get the full agent state to extract tool results from __strategy__
    {:ok, server_state} = GenServer.call(pid, :get_state)
    tool_results = server_state.agent.state[:__strategy__][:tool_results] || []

    if tool_results != [] do
      IO.puts("=== Tool Calls (Node.js) ===")

      Enum.each(tool_results, fn entry ->
        name = entry[:name] || entry["name"] || "unknown"
        result = entry[:result] || entry["result"]

        IO.puts(
          "- #{inspect(name)} -> #{inspect(result, limit: 5, printable_limit: 200)}"
        )
      end)
    end

  {:ok, result} ->
    IO.puts(
      "\n=== Qwen Result ===\n#{inspect(result, limit: :infinity, printable_limit: 4096)}\n"
    )

  {:error, reason} ->
    IO.puts("\n=== Qwen Error ===\n#{inspect(reason, limit: :infinity, printable_limit: 4096)}\n")
    System.halt(1)
end
