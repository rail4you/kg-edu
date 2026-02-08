defmodule KgEdu.Types.JsonMap do
  @moduledoc """
  A custom Ash type that handles JSON strings stored in the database.

  This type can handle:
  - Maps (native Elixir maps)
  - JSON strings that need to be decoded

  This is useful when data might be stored as JSON strings due to
  various import processes but you want to work with them as maps.
  """
  use Ash.Type

  @impl true
  def storage_type, do: :map

  @impl true
  def cast_input(nil, _constraints), do: {:ok, nil}
  def cast_input(value, _constraints) when is_map(value), do: {:ok, value}

  def cast_input(value, _constraints) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_map(decoded) ->
        {:ok, decoded}

      {:error, reason} ->
        {:error, "Invalid JSON string: #{inspect(reason)}"}
    end
  end

  def cast_input(_value, _constraints) do
    {:error, "Must be a map or a JSON string"}
  end

  @impl true
  def cast_stored(nil, _constraints), do: {:ok, nil}
  def cast_stored(value, _constraints) when is_map(value), do: {:ok, value}

  def cast_stored(value, _constraints) when is_binary(value) do
    case Jason.decode(value) do
      {:ok, decoded} when is_map(decoded) ->
        {:ok, decoded}

      {:error, reason} ->
        {:error, "Invalid JSON in database: #{inspect(reason)}"}
    end
  end

  @impl true
  def dump_to_native(nil, _constraints), do: {:ok, nil}
  def dump_to_native(value, _constraints) when is_map(value), do: {:ok, value}

  def dump_to_native(_value, _constraints) do
    {:error, "Cannot dump non-map value"}
  end
end
