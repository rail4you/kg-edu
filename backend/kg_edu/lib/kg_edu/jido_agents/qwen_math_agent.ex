defmodule KgEdu.JidoAgents.QwenMathAgent do
  @moduledoc """
  Q&A agent backed by Qwen Plus that can call arithmetic tools (add / multiply).

  Uses `Jido.AI.Agent`. The skill's body can be injected into the system prompt
  via `Jido.AI.Skill.Prompt.render/1`.

  ## Usage

      {:ok, pid} = Jido.AgentServer.start(agent: KgEdu.JidoAgents.QwenMathAgent)
      {:ok, result} = KgEdu.JidoAgents.QwenMathAgent.ask_sync(pid, "计算 (12 + 7) * 3")

  Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
  """

  @skills [KgEdu.JidoAgents.Skills.Math]

  use Jido.AI.Agent,
    name: "qwen_math_agent",
    description: "Q&A agent with arithmetic tools (Qwen Plus via DashScope)",
    model: :capable,
    system_prompt: """
    You are a helpful calculator assistant. You MUST use tool calls for all arithmetic operations.
    Never attempt mental math - always use the provided tools.
    Call tools one at a time - do NOT call multiple arithmetic tools in parallel.
    Show your work step by step and provide clear answers.
    """,
    streaming: false,
    tools: [
      KgEdu.JidoAgents.Actions.Add,
      KgEdu.JidoAgents.Actions.Multiply
    ],
    max_iterations: 10

  @doc false
  def skills, do: @skills

  @doc """
  Builds a system prompt that includes skill instructions via `Jido.AI.Skill.Prompt.render/1`.
  """
  def build_system_prompt do
    base = """
    You are a helpful calculator assistant. You MUST use tool calls for all arithmetic operations.
    Never attempt mental math - always use the provided tools.
    Call tools one at a time - do NOT call multiple arithmetic tools in parallel.
    Show your work step by step and provide clear answers.
    """

    skill_prompt = Jido.AI.Skill.Prompt.render(@skills)
    base <> "\n\n" <> skill_prompt
  end
end
