defmodule KgEdu.JidoAgents.Actions.MultiplyNode do
  @moduledoc """
  Jido.Action tool: multiply two integers by shelling out to a Node.js script.

  Delegates to `KgEdu.JidoAgents.NodeScriptHelper.run_script/3`.
  The actual computation runs in `priv/skills/math/tools/multiply.js`.
  """

  use Jido.Action,
    name: "multiply",
    description: "Multiply two integers by invoking a Node.js multiply tool.",
    schema:
      Zoi.object(%{
        a: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0),
        b: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0)
      })

  @impl true
  def run(params, _context) do
    KgEdu.JidoAgents.NodeScriptHelper.run_script("multiply", params, fn output ->
      %{product: String.to_integer(output)}
    end)
  end
end
