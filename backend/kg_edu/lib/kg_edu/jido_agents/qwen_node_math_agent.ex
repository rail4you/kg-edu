defmodule KgEdu.JidoAgents.QwenNodeMathAgent do
  @moduledoc """
  Q&A agent backed by Qwen Plus whose tool implementations run in Node.js.

  The skill metadata can be loaded at runtime from
  `priv/skills/math/SKILL.md` via `Jido.AI.Skill.Loader`. The actions
  `AddNode` and `MultiplyNode` are thin Elixir wrappers that invoke the
  Node.js scripts under the same `priv/skills/math/tools/` directory.

  ## Usage

      {:ok, pid} = Jido.AgentServer.start(agent: KgEdu.JidoAgents.QwenNodeMathAgent)
      {:ok, result} = KgEdu.JidoAgents.QwenNodeMathAgent.ask_sync(pid, "计算 (12 + 7) * 3")

  Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
  """

  use Jido.AI.Agent,
    name: "qwen_node_math_agent",
    description: "Q&A agent with Node.js-backed arithmetic tools (Qwen Plus via DashScope)",
    model: :qwen,
    system_prompt: """
    You are a helpful calculator assistant. You MUST use tool calls for all arithmetic operations.
    Never attempt mental math - always use the provided tools.
    Call tools one at a time - do NOT call multiple arithmetic tools in parallel.
    Show your work step by step and provide clear answers.
    """,
    streaming: false,
    tools: [
      KgEdu.JidoAgents.Actions.AddNode,
      KgEdu.JidoAgents.Actions.MultiplyNode
    ],
    max_iterations: 10
end
