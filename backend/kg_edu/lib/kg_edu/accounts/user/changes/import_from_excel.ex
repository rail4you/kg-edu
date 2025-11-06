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
  - tenant_schema: Tenant schema name string or nil for current tenant context

  ## Returns
  {:ok, users} or {:error, reason}
  """
  def parse_excel(excel_file, attributes, tenant_schema \\ nil) do
    case import_users_from_excel(excel_file, attributes, tenant_schema) do
      {:ok, users} ->
        {:ok, users}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_users_from_excel(nil, _attributes, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_users_from_excel(excel_file, attributes, tenant_schema)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("Starting Excel import with attributes: #{inspect(attributes)}")
    Logger.info("Using tenant schema: #{inspect(tenant_schema)}")
    Logger.info("Excel file length: #{byte_size(excel_file)} bytes")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, user_data} ->
        Logger.info("Successfully parsed Excel file, got #{length(user_data)} user records")
        if length(user_data) > 0 do
          Logger.info("Sample user data: #{inspect(hd(user_data))}")
        end
        create_users_from_data(user_data, tenant_schema)

      {:error, reason} ->
        Logger.error("Failed to import Excel file: #{inspect(reason)}")
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_users_from_excel(_, _, _) do
    {:error, "Invalid parameters"}
  end

  defp create_users_from_data(user_data, tenant_schema) when is_list(user_data) do
    results =
      Enum.map(user_data, fn user_map ->
        create_single_user(user_map, tenant_schema)
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

  defp create_single_user(user_map, tenant_schema) do
    user_map = MapTransformer.transform_values_to_string(user_map)
    Logger.info("user_map is #{inspect(user_map)}")

    # Validate required fields first
    required_fields = [:member_id, :name, :password]

    case validate_required_fields(user_map, required_fields) do
      :ok ->
        # Process and validate user data
        case process_user_data(user_map, tenant_schema) do
          {:ok, processed_user_map} ->
            create_user_in_tenant(processed_user_map, tenant_schema)

          {:error, processing_error} ->
            {:error, processing_error}
        end

      {:error, missing_fields} ->
        {:error, "Missing required fields for user: #{inspect(missing_fields)}"}
    end
  end

  # Process user data to validate and transform fields
  defp process_user_data(user_map, tenant_schema) do
    errors = []

    # Validate password length
    errors = case user_map[:password] do
      password when is_binary(password) and byte_size(password) >= 8 ->
        errors
      password when is_binary(password) ->
        ["Password must be at least 8 characters long" | errors]
      _ ->
        ["Password is required" | errors]
    end

    # Validate and normalize role
    {role, errors} = case user_map[:role] do
      role when role in ["super_admin", :super_admin, "超级管理员"] ->
        {:super_admin, errors}
      role when role in ["admin", :admin, "管理员"] ->
        {:admin, errors}
      role when role in ["teacher", :teacher, "教师", "老师"] ->
        {:teacher, errors}
      role when role in ["user", :user, "用户", "学生"] ->
        {:user, errors}
      nil ->
        {:user, errors}
      _ ->
        {nil, ["Invalid role: #{user_map[:role]}" | errors]}
    end

    # Validate email format
    errors = case user_map[:email] do
      email when is_binary(email) ->
        if String.contains?(email, "@") do
          errors
        else
          ["Invalid email format: #{email}" | errors]
        end
      _ ->
        errors  # Email is optional
    end

    # Check for super admin role with tenant context
    errors = if role == :super_admin and not is_nil(tenant_schema) do
      ["Super admin users cannot be created in specific tenants" | errors]
    else
      errors
    end

    if errors == [] do
      processed_map = user_map
        |> Map.put(:role, role)

      {:ok, processed_map}
    else
      {:error, Enum.join(errors, "; ")}
    end
  end

  # Create user in appropriate tenant context
  defp create_user_in_tenant(user_map, nil) do
    # No tenant specified - use current tenant context
    KgEdu.Accounts.User.create_user(user_map)
  end

  defp create_user_in_tenant(user_map, tenant_schema) when is_binary(tenant_schema) do
    # Create user using tenant context directly (like knowledge resource import)
    Logger.info("Creating user #{user_map[:member_id]} in tenant schema: #{tenant_schema}")

    try do
      # Create user within tenant context
      create_result = KgEdu.Accounts.User
                    |> Ash.Changeset.for_create(:create_user, user_map)
                    |> Ash.create(tenant: tenant_schema)

      case create_result do
        {:ok, user} ->
          Logger.info("Successfully created user: #{user_map[:member_id]}")
          {:ok, user}

        {:error, reason} ->
          Logger.error("Failed to create user #{user_map[:member_id]}: #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      e ->
        Logger.error("Failed to create user #{user_map[:member_id]} in tenant context: #{Exception.message(e)}")
        Logger.error("User data that failed: #{inspect(user_map)}")
        Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
        {:error, "Failed to create user in tenant context: #{Exception.message(e)}"}
    end
  end

  # Format Ash errors to readable strings
  defp format_ash_error(error) when is_struct(error, Ash.Error.Invalid) do
    case error.errors do
      [%{field: field, message: message} | _] ->
        "#{field}: #{message}"
      _ ->
        "Validation error"
    end
  end

  defp format_ash_error(error), do: to_string(error)

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
