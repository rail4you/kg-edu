defmodule KgEdu.JidoAgents.Skills.Math do
  @moduledoc """
  Math skill that bundles arithmetic tools for the Jido agent.

  The skill exposes a manifest, a body that is injected into the agent's
  context, and the list of `Jido.Action` modules it provides. The agent
  registers the actions directly in `tools:`.

  ## Usage

      # In an agent module:
      tools: [KgEdu.JidoAgents.Actions.Add, KgEdu.JidoAgents.Actions.Multiply]

      # Inject skill prompt into system prompt:
      skill_prompt = Jido.AI.Skill.Prompt.render([KgEdu.JidoAgents.Skills.Math])

  Pattern from: https://github.com/agentjido/jido_ai/tree/main/examples
  (see Jido.AI.Examples.Skills.Calculator)
  """

  use Jido.AI.Skill,
    name: "math",
    description: "Performs precise arithmetic calculations using tool calls instead of mental math.",
    license: "MIT",
    allowed_tools: ~w(add multiply),
    actions: [
      KgEdu.JidoAgents.Actions.Add,
      KgEdu.JidoAgents.Actions.Multiply
    ],
    tags: ["math", "arithmetic", "utility"],
    body: """
    # Math Skill

    Use this skill when users need help with arithmetic or mathematical expressions.
    ALWAYS use tool calls for calculations - never attempt mental math.

    ## Available Operations
    - `add(a, b)` - Adds two integers and returns their sum
    - `multiply(a, b)` - Multiplies two integers and returns their product

    ## Workflow
    1. Parse the mathematical expression into individual operations
    2. Execute operations in the correct order (respect operator precedence)
    3. Chain results: use the result of one operation as input to the next
    4. Call tools one at a time - do NOT make parallel tool calls
    5. Present the final answer with a clear explanation

    ## Examples

    For "(12 + 7) * 3":
    1. First add: add(12, 7) => 19
    2. Then multiply: multiply(19, 3) => 57
    3. Answer: "(12 + 7) × 3 = 57"

    For "12 + 7 * 3":
    1. First multiply: multiply(7, 3) => 21
    2. Then add: add(12, 21) => 33
    3. Answer: "12 + 7 × 3 = 33"
    """
end
