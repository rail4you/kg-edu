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

  @doc """
  Convert all atom keys in a map to string keys.
  """
  def atom_keys_to_string(map) when is_map(map) do
    map
    |> Enum.map(fn {key, value} ->
      new_key = if is_atom(key), do: Atom.to_string(key), else: key
      new_value = if is_map(value), do: atom_keys_to_string(value), else: value
      {new_key, new_value}
    end)
    |> Map.new()
  end
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
  def parse_excel(excel_file, attributes, tenant_schema \\ nil, role_override \\ nil) do
    case import_users_from_excel(excel_file, attributes, tenant_schema, role_override) do
      {:ok, users} ->
        {:ok, users}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_users_from_excel(nil, _attributes, _tenant, _role_override) do
    {:error, "Excel file is required"}
  end

  defp import_users_from_excel(excel_file, attributes, tenant_schema, role_override)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("Starting Excel import with attributes: #{inspect(attributes)}")
    Logger.info("Using tenant schema: #{inspect(tenant_schema)}")
    Logger.info("Role override: #{inspect(role_override)}")
    Logger.info("Excel file length: #{byte_size(excel_file)} bytes")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, user_data} ->
        Logger.info("Successfully parsed Excel file, got #{length(user_data)} user records")

        # Apply role override if provided
        user_data =
          if role_override do
            Enum.map(user_data, fn user_map ->
              Map.put(user_map, :role, role_override)
            end)
          else
            user_data
          end

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
        # Return users with their action type (:created or :updated)
        {:ok, users}

      {successful, failed} ->
        error_messages = Enum.map(failed, fn {:error, reason} -> reason end)

        if length(successful) > 0 do
          users = Enum.map(successful, fn {:ok, user} -> user end)

          Logger.warning(
            "Partial import successful: #{length(successful)} users processed, #{length(failed)} failed. Errors: #{inspect(error_messages)}"
          )

          {:ok, users}
        else
          {:error, "Failed to process any users: #{inspect(error_messages)}"}
        end
    end
  end

  defp create_single_user(user_map, tenant_schema) do
    user_map = MapTransformer.transform_values_to_string(user_map)
    Logger.info("user_map is #{inspect(user_map)}")

    # Auto-generate member_id if missing: use phone, email, or auto-generate
    user_map =
      case Map.get(user_map, :member_id) do
        nil ->
          generated_id = generate_member_id(user_map)
          Map.put(user_map, :member_id, generated_id)

        "" ->
          generated_id = generate_member_id(user_map)
          Map.put(user_map, :member_id, generated_id)

        _ ->
          user_map
      end

    # Validate required fields: member_id and name are required
    required_fields = [:member_id, :name]

    case validate_required_fields(user_map, required_fields) do
      :ok ->
        # Auto-generate password if missing
        user_map =
          case Map.get(user_map, :password) do
            nil -> Map.put(user_map, :password, "123456")
            "" -> Map.put(user_map, :password, "123456")
            _ -> user_map
          end

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

  # Generate member_id from phone, email, or auto-generate
  defp generate_member_id(user_map) do
    phone = Map.get(user_map, :phone)
    email = Map.get(user_map, :email)

    cond do
      is_binary(phone) and phone != "" ->
        phone

      is_binary(email) and email != "" ->
        email

      true ->
        "user_#{System.system_time(:millisecond)}_#{:rand.uniform(10000)}"
    end
  end

  # Process user data to validate and transform fields
  defp process_user_data(user_map, tenant_schema) do
    errors = []

    # Validate password length
    errors =
      case user_map[:password] do
        password when is_binary(password) and byte_size(password) >= 6 ->
          errors

        password when is_binary(password) ->
          ["Password must be at least 6 characters long" | errors]

        _ ->
          ["Password is required" | errors]
      end

    # Validate and normalize role
    {role, errors} =
      case user_map[:role] do
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
    errors =
      case user_map[:email] do
        email when is_binary(email) ->
          if String.contains?(email, "@") do
            errors
          else
            ["Invalid email format: #{email}" | errors]
          end

        email when is_integer(email) ->
          ["Invalid email format: #{email}" | errors]

        _ ->
          # Email is optional
          errors
      end

    # Check for super admin role with tenant context
    errors =
      if role == :super_admin and not is_nil(tenant_schema) do
        ["Super admin users cannot be created in specific tenants" | errors]
      else
        errors
      end

    # Handle class assignment for user role only
    {class_id, errors} =
      if role == :user and not is_nil(user_map[:class]) and user_map[:class] != "" do
        case find_or_create_class(user_map[:class], tenant_schema, user_map) do
          {:ok, class_id} ->
            {class_id, errors}

          {:error, reason} ->
            {nil, ["Failed to assign class: #{reason}" | errors]}
        end
      else
        {nil, errors}
      end

    if errors == [] do
      # Start with the user_map
      processed_map =
        user_map
        |> Map.put(:role, role)

      # Only add class fields for user role, remove :class key for all roles
      processed_map =
        processed_map
        |> Map.delete(:class)

      processed_map =
        if role == :user do
          processed_map
          |> Map.put(:class_id, class_id)
        else
          # Remove class-related fields for non-user roles
          processed_map
          |> Map.delete(:class_id)
        end

      {:ok, processed_map}
    else
      {:error, Enum.join(errors, "; ")}
    end
  end

  # Find or create a class based on class name and optional college/major
  defp find_or_create_class(class_name, tenant_schema, user_map) do
    Logger.info("Looking for class: #{class_name}")

    # Extract optional college and major from user_map if available
    college = Map.get(user_map, :college)
    major = Map.get(user_map, :major)

    # Try to find existing class by name first
    find_result =
      try do
        # Read all classes and filter manually (simpler approach)
        case Ash.read(KgEdu.Accounts.Class, tenant: tenant_schema) do
          {:ok, classes} ->
            # Find matching class by name (and college/major if provided)
            matching_class =
              Enum.find(classes, fn class ->
                name_match = class.name == class_name

                # Handle nil values properly in comparisons
                college_match =
                  case {college, class.college} do
                    # No college filter specified, match all
                    {nil, _} -> true
                    # Empty college filter, match all
                    {"", _} -> true
                    # User has college but class doesn't
                    {_user_college, nil} -> false
                    # Both have values, compare
                    {user_college, class_college} -> user_college == class_college
                  end

                major_match =
                  case {major, class.major} do
                    # No major filter specified, match all
                    {nil, _} -> true
                    # Empty major filter, match all
                    {"", _} -> true
                    # User has major but class doesn't
                    {_user_major, nil} -> false
                    # Both have values, compare
                    {user_major, class_major} -> user_major == class_major
                  end

                name_match and college_match and major_match
              end)

            case matching_class do
              nil ->
                Logger.info("Class not found, creating new class")
                create_new_class(class_name, tenant_schema, college, major)

              class ->
                Logger.info("Found existing class: #{class.id}")
                {:ok, class.id}
            end

          {:error, reason} ->
            Logger.error("Error reading classes: #{inspect(reason)}")
            {:error, "Failed to read classes: #{inspect(reason)}"}
        end
      rescue
        e ->
          Logger.error("Exception while finding class: #{Exception.message(e)}")
          Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
          {:error, Exception.message(e)}
      end

    find_result
  end

  # Create a new class with the given name and optional college/major
  defp create_new_class(class_name, tenant_schema, college, major) do
    Logger.info("Creating new class: #{class_name}")

    class_attrs = %{
      name: class_name,
      college: college,
      major: major
    }

    try do
      case KgEdu.Accounts.Class
           |> Ash.Changeset.for_create(:create, class_attrs)
           |> Ash.create(tenant: tenant_schema) do
        {:ok, class} ->
          Logger.info("Successfully created class with ID: #{class.id}")
          {:ok, class.id}

        {:error, reason} ->
          Logger.error("Failed to create class: #{inspect(reason)}")
          {:error, "Failed to create class: #{inspect(reason)}"}
      end
    rescue
      e ->
        Logger.error("Exception while creating class: #{Exception.message(e)}")
        {:error, Exception.message(e)}
    end
  end

  # Create user in appropriate tenant context (with upsert logic)
  defp create_user_in_tenant(user_map, nil) do
    # No tenant specified - use current tenant context
    upsert_user(user_map, nil)
  end

  defp create_user_in_tenant(user_map, tenant_schema) when is_binary(tenant_schema) do
    # Create user using tenant context directly (like knowledge resource import)
    Logger.info("Creating user #{user_map[:member_id]} in tenant schema: #{tenant_schema}")
    upsert_user(user_map, tenant_schema)
  end

  # Upsert user: check if exists, update if so, create if not
  defp upsert_user(user_map, tenant_schema) do
    member_id = user_map[:member_id]

    try do
      # First, try to find existing user by member_id
      find_result = Ash.read(KgEdu.Accounts.User, tenant: tenant_schema)

      case find_result do
        {:ok, users} ->
          existing_user = Enum.find(users, fn u -> u.member_id == member_id end)

          case existing_user do
            nil ->
              # User doesn't exist, create new user
              Logger.info("User #{member_id} not found, creating new user")
              create_new_user(user_map, tenant_schema)

            user ->
              # User exists, update the user
              Logger.info(
                "User #{member_id} exists (ID: #{user.id}), updating user and class association"
              )

              update_existing_user(user, user_map, tenant_schema)
          end

        {:error, reason} ->
          Logger.error("Failed to read users for upsert: #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      e ->
        Logger.error("Exception during upsert for user #{member_id}: #{Exception.message(e)}")
        Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
        {:error, "Upsert failed: #{Exception.message(e)}"}
    end
  end

  # Create a new user
  defp create_new_user(user_map, tenant_schema) do
    try do
      create_result =
        KgEdu.Accounts.User
        |> Ash.Changeset.for_create(:create_user, user_map)
        |> Ash.create(tenant: tenant_schema)

      case create_result do
        {:ok, user} ->
          Logger.info("Successfully created user: #{user_map[:member_id]}")
          {:ok, Map.put(user, :_action, :created)}

        {:error, reason} ->
          Logger.error("Failed to create user #{user_map[:member_id]}: #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      e ->
        Logger.error(
          "Failed to create user #{user_map[:member_id]} in tenant context: #{Exception.message(e)}"
        )

        Logger.error("User data that failed: #{inspect(user_map)}")
        Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
        {:error, "Failed to create user in tenant context: #{Exception.message(e)}"}
    end
  end

  # Update an existing user
  defp update_existing_user(user, user_map, tenant_schema) do
    try do
      # Prepare update attributes (exclude password and member_id from update)
      update_attrs =
        user_map
        |> Map.drop([:password, :member_id])

      # Update user using the update action
      update_result =
        user
        |> Ash.Changeset.for_update(:update, update_attrs)
        |> Ash.update(tenant: tenant_schema)

      case update_result do
        {:ok, updated_user} ->
          Logger.info("Successfully updated user: #{user_map[:member_id]}")
          {:ok, Map.put(updated_user, :_action, :updated)}

        {:error, reason} ->
          Logger.error("Failed to update user #{user_map[:member_id]}: #{inspect(reason)}")
          {:error, reason}
      end
    rescue
      e ->
        Logger.error("Failed to update user #{user_map[:member_id]}: #{Exception.message(e)}")
        Logger.error("User data that failed: #{inspect(user_map)}")
        Logger.error("Stacktrace: #{inspect(__STACKTRACE__)}")
        {:error, "Failed to update user in tenant context: #{Exception.message(e)}"}
    end
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
