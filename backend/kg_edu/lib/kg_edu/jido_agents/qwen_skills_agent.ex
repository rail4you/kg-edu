defmodule KgEdu.JidoAgents.QwenSkillsAgent do
  @moduledoc """
  Agent that uses tools declared in `priv/skills/math/SKILL.md`.

  This agent demonstrates the file-based skill pattern:
  - The SKILL.md defines `allowed-tools: [add, multiply]`
  - This agent declares the corresponding action modules
  - At runtime, the skill is loaded, registered, and its body is
    injected into the system prompt via `Jido.AI.Skill.Prompt.render/1`

  ## Usage

      # 1. Load and register the skill
      {:ok, spec} = Jido.AI.Skill.Loader.load("priv/skills/math/SKILL.md")
      :ok = Jido.AI.Skill.Registry.register(spec)

      # 2. Start the agent
      {:ok, pid} = Jido.AgentServer.start(agent: __MODULE__)

      # 3. Query
      {:ok, answer} = __MODULE__.ask_sync(pid, "计算 (12 + 7) * 3")

  Pattern from: https://jido-ai.hexdocs.pm/skills_system.html
  """

  use Jido.AI.Agent,
    name: "qwen_skills_agent",
    description: "Skills-driven agent with file-based skill instructions",
    model: :qwen,
    system_prompt: """
    You are a helpful calculator assistant.
    You MUST use tool calls for all arithmetic operations.
    Never attempt mental math.
    Call tools one at a time.
    Show your work step by step.
    """,
    streaming: false,
    tools: [
      # These map to `allowed-tools: [add, multiply]` in SKILL.md
      KgEdu.JidoAgents.Actions.AddNode,
      KgEdu.JidoAgents.Actions.MultiplyNode
    ],
    max_iterations: 10

  @doc """
  Builds a system prompt that includes the skill's body instructions.
  Call this after the skill is registered in the registry.
  """
  def build_system_prompt(skill_name \\ "math") do
    base = """
    You are a helpful calculator assistant.
    You MUST use tool calls for all arithmetic operations.
    Never attempt mental math.
    Call tools one at a time.
    Show your work step by step.
    """

    skill_prompt =
      [skill_name]
      |> Jido.AI.Skill.Prompt.render(
        include_body: true,
        header: "## Skill Instructions"
      )

    base <> "\n" <> skill_prompt
  end
end
