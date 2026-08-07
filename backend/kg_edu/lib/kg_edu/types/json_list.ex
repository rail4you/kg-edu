defmodule KgEdu.Types.JsonList do
  @moduledoc """
  A custom Ash type for JSON lists (arrays) stored in the database.

  Handles:
  - Lists (native Elixir lists)
  - JSON strings that need to be decoded
  """
  use Ash.Type

  @impl true
  def storage_type, do: :jsonb

  @impl true
  def cast_input(nil, _constraints), do: {:ok, nil}
  def cast_input(value, _constraints) when is_list(value), do: {:ok, value}

  def cast_input(value, _constraints) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_list(decoded) ->
        {:ok, decoded}

      {:error, reason} ->
        {:error, "Invalid JSON: #{inspect(reason)}"}
    end
  end

  def cast_input(_value, _constraints) do
    {:error, "Must be a list or a JSON string"}
  end

  @impl true
  def cast_stored(nil, _constraints), do: {:ok, nil}
  def cast_stored(value, _constraints) when is_list(value), do: {:ok, value}

  def cast_stored(value, _constraints) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_list(decoded) ->
        {:ok, decoded}

      {:error, reason} ->
        {:error, "Invalid JSON in database: #{inspect(reason)}"}
    end
  end

  @impl true
  def dump_to_native(nil, _constraints), do: {:ok, nil}
  def dump_to_native(value, _constraints) when is_list(value), do: {:ok, value}

  def dump_to_native(_value, _constraints) do
    {:error, "Cannot dump non-list value"}
  end
end
