defmodule MapTransformer do
  def transform_values_to_string(map) when is_map(map) do
    map
    |> Enum.map(fn {key, value} ->
      transformed_value =
        if is_map(value) do
          # Recursively call the function for nested maps
          transform_values_to_string(value)
        else
          # Convert other values to string
          to_string(value)
        end

      {key, transformed_value}
    end)
    |> Map.new()
  end

  # Handle non-map values if you call this function directly with them
  def transform_values_to_string(value), do: to_string(value)
end

defmodule KgEdu.Accounts.User.ImportFromExcel do
  @moduledoc """
  Change module for importing users from Excel file.
  Accepts Base64 encoded Excel file and imports users with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  @doc """
  Import users from Excel file with Base64 encoding.

  ## Parameters
  - excel_file: Base64 encoded string of the Excel file
  - attributes: List of attributes in order [member_id, name, phone, email, password, role]

  ## Returns
  {:ok, users} or {:error, reason}
  """
  def parse_excel(excel_file, attributes) do
    case import_users_from_excel(excel_file, attributes) do
      {:ok, users} ->
        {:ok, users}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_users_from_excel(nil, _attributes) do
    {:error, "Excel file is required"}
  end

  defp import_users_from_excel(excel_file, attributes)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, user_data} ->
        Logger.info("user is #{inspect(user_data)}")
        create_users_from_data(user_data)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_users_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_users_from_data(user_data) when is_list(user_data) do
    results =
      Enum.map(user_data, fn user_map ->
        create_single_user(user_map)
      end)

    case Enum.split_with(results, &match?({:ok, _}, &1)) do
      {successful, []} ->
        users = Enum.map(successful, fn {:ok, user} -> user end)
        {:ok, users}

      {successful, failed} ->
        error_messages = Enum.map(failed, fn {:error, reason} -> reason end)

        if length(successful) > 0 do
          users = Enum.map(successful, fn {:ok, user} -> user end)

          Logger.warning(
            "Partial import successful: #{length(successful)} users created, #{length(failed)} failed. Errors: #{inspect(error_messages)}"
          )

          {:ok, users}
        else
          {:error, "Failed to create any users: #{inspect(error_messages)}"}
        end
    end
  end

  defp create_single_user(user_map) do
    user_map = MapTransformer.transform_values_to_string(user_map)
    Logger.info("user_map is #{inspect(user_map)}")
    # required_fields = [:member_id, :name, :password]

    # case validate_required_fields(user_map, required_fields) do
    #   :ok ->
    #     user_params = Map.merge(%{
    #       role: user_map[:role] || :user,
    #       phone: user_map[:phone]
    #     }, user_map)

    case KgEdu.Accounts.User.create_user(user_map) do
      {:ok, user} ->
        Logger.info("Successfully created user: #{user.email}")
        {:ok, user}

      {:error, reason} ->
        Logger.error("Failed to create user #{user_map[:email]}: #{inspect(reason)}")
        {:error, "Failed to create user #{user_map[:email]}: #{reason}"}
    end

    # {:error, missing_fields} ->
    #   {:error, "Missing required fields for user: #{inspect(missing_fields)}"}
    # end
  end

  defp validate_required_fields(user_map, required_fields) do
    missing_fields =
      Enum.filter(required_fields, fn field ->
        is_nil(Map.get(user_map, field)) or Map.get(user_map, field) == ""
      end)

    case missing_fields do
      [] -> :ok
      _ -> {:error, missing_fields}
    end
  end
end
