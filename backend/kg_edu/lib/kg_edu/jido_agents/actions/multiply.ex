defmodule KgEdu.JidoAgents.Actions.Multiply do
  @moduledoc """
  Jido.Action tool: multiply two integers.
  """
  use Jido.Action,
    name: "multiply",
    description: "Multiply two integers and return their product.",
    schema:
      Zoi.object(%{
        a: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0),
        b: Zoi.integer() |> Zoi.nullish() |> Zoi.default(0)
      })

  @impl true
  def run(%{a: a, b: b}, _context), do: {:ok, %{product: a * b}}
end
