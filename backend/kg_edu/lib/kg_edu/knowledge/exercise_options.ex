defmodule KgEdu.Knowledge.ExerciseOptions do
  @moduledoc """
  Struct for exercise options with A, B, C, D choices.
  Supports single or multiple selection.
  """
  defstruct [:a, :b, :c, :d, :selected]

  @type t :: %__MODULE__{
    a: String.t() | nil,
    b: String.t() | nil,
    c: String.t() | nil,
    d: String.t() | nil,
    selected: list(String.t()) | String.t() | nil
  }

  @doc """
  Creates a new ExerciseOptions struct.
  """
  def new(opts \\ []) do
    struct(__MODULE__, opts)
  end

  @doc """
  Creates options from a map.
  """
  def from_map(map) when is_map(map) do
    %__MODULE__{
      a: Map.get(map, "A") || Map.get(map, :a),
      b: Map.get(map, "B") || Map.get(map, :b),
      c: Map.get(map, "C") || Map.get(map, :c),
      d: Map.get(map, "D") || Map.get(map, :d),
      selected: Map.get(map, "selected") || Map.get(map, :selected)
    }
  end

  @doc """
  Converts options to a map for storage.
  """
  def to_map(%__MODULE__{} = options) do
    %{
      "A" => options.a,
      "B" => options.b,
      "C" => options.c,
      "D" => options.d,
      "selected" => options.selected
    }
    |> Enum.filter(fn {_key, value} -> value != nil end)
    |> Enum.into(%{})
  end

  @doc """
  Validates that options are properly configured.
  """
  def valid?(%__MODULE__{} = options) do
    with true <- has_enough_options?(options),
         true <- valid_selection?(options) do
      true
    else
      _ -> false
    end
  end

  defp has_enough_options?(options) do
    filled_options = [options.a, options.b, options.c, options.d]
                    |> Enum.filter(&(&1 != nil))
    length(filled_options) >= 2
  end

  defp valid_selection?(options) do
    case options.selected do
      nil -> true
      selected when is_list(selected) ->
        Enum.all?(selected, fn selection ->
          selection in ["A", "B", "C", "D"] and 
          Map.get(options, String.downcase(selection)) != nil
        end)
      selected when is_binary(selected) ->
        selected in ["A", "B", "C", "D"] and 
        Map.get(options, String.downcase(selected)) != nil
      _ -> false
    end
  end
end