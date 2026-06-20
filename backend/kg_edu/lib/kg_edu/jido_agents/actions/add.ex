defmodule KgEdu.JidoAgents.Actions.Add do
  @moduledoc """
  Jido.Action tool: add two integers.
  """
  use Jido.Action,
    name: "add",
    description: "Add two integers and return their sum.",
    schema:
      Zoi.object(%{
        a: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0),
        b: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0)
      })

  @impl true
  def run(%{a: a, b: b}, _context), do: {:ok, %{sum: a + b}}
end
