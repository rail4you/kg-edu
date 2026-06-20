defmodule KgEdu.JidoAgents.Actions.AddNode do
  @moduledoc """
  Jido.Action tool: add two integers by shelling out to a Node.js script.

  Delegates to `KgEdu.JidoAgents.NodeScriptHelper.run_script/3`.
  The actual computation runs in `priv/skills/math/tools/add.js`.
  """

  use Jido.Action,
    name: "add",
    description: "Add two integers by invoking a Node.js add tool.",
    schema:
      Zoi.object(%{
        a: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0),
        b: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0)
      })

  @impl true
  def run(params, _context) do
    KgEdu.JidoAgents.NodeScriptHelper.run_script("add", params, fn output ->
      %{sum: String.to_integer(output)}
    end)
  end
end
