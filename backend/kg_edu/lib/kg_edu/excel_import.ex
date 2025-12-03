defmodule KgEdu.ExcelImport do
  @moduledoc """
  Module for importing Excel files according to PRD requirements.

  ## Input parameters:
  1. excel_file: Base64 encoded string of the Excel file
  2. attributes: List of attributes [attr1, attr2]

  ## Output:
  1. List of maps: [%{attr1: value1, attr2: value2}, ...]
  """

  @doc """
  Import Excel file and return data as list of maps.

  ## Parameters
  - excel_file: Base64 encoded string of the Excel file
  - attributes: List of attributes to map columns to

  ## Returns
  {:ok, [%{attr1: value1, attr2: value2}, ...]} or {:error, reason}

  ## Examples
      iex> ExcelImport.import_from_excel("base64_string", ["name", "age"])
      {:ok, [%{name: "Alice", age: 25}, %{name: "Bob", age: 30}]}
  """
  require Logger
  def import_file_from_excel(excel_file, attributes) do
    excel_file_data = File.read!(excel_file) |> Base.encode64()
    import_from_excel(excel_file_data, attributes)
  end

  def import_from_excel(excel_file, attributes) when is_binary(excel_file) and is_list(attributes) do
    with {:ok, binary_data} <- Base.decode64(excel_file),
         {:ok, temp_path} <- create_temp_file(binary_data),
         {:ok, result} <- parse_excel_file(temp_path, attributes) do
      cleanup_temp_file(temp_path)
      {:ok, result}
    else
      {:error, reason} = error ->
        Logger.info("error is #{inspect(reason)}")
        cleanup_temp_file_if_exists(get_temp_path())
        error
    end
  end

  @doc """
  Import Excel file from file path and attributes.

  ## Parameters
  - file_path: Path to the Excel file
  - attributes: List of attributes to map columns to

  ## Returns
  {:ok, [%{attr1: value1, attr2: value2}, ...]} or {:error, reason}

  ## Examples
      iex> ExcelImport.import_from_excel_file("path/to/file.xlsx", ["name", "age"])
      {:ok, [%{name: "Alice", age: 25}, %{name: "Bob", age: 30}]}
  """
  def import_from_excel_file(file_path, attributes) when is_binary(file_path) and is_list(attributes) do
    parse_excel_file(file_path, attributes)
  end

  @doc """
  Parse Excel file with given attributes.

  ## Parameters
  - file_path: Path to the Excel file
  - attributes: List of attributes to map columns to

  ## Returns
  {:ok, [%{attr1: value1, attr2: value2}, ...]} or {:error, reason}
  """
  def parse_excel_file(file_path, attributes) do
    try do
      case Xlsxir.multi_extract(file_path, 0) do
        {:ok, table_id} ->
          rows = Xlsxir.get_list(table_id)
          Logger.info("Extracted #{inspect(rows)} rows from Excel file")
          Xlsxir.close(table_id)

          process_rows(rows, attributes)

        {:error, reason} ->
          {:error, "Failed to extract Excel file: #{reason}"}
      end
    rescue
      e ->
        {:error, "Error parsing Excel file: #{Exception.message(e)}"}
    end
  end

  @doc """
  Process rows from Excel file.

  Ignores first two rows (comment row and header row) and maps remaining data rows to attributes.
  """
  defp process_rows(rows, attributes) do
    case rows do
      [_comment_row, _header_row | data_rows] ->
        try do
          Logger.info("data rows are #{inspect(data_rows)}")

          # Filter out empty rows and rows that look like headers
          filtered_rows = data_rows

          # Map each valid row to attributes
          result = Enum.map(filtered_rows, fn row ->
            map_row_to_attributes(row, attributes)
          end)

          # Filter out results that are nil (from invalid rows)
          result = Enum.filter(result, &(&1 != nil))

          Logger.info("processed #{length(result)} valid rows from #{length(data_rows)} data rows")
          {:ok, result}
        rescue
          e ->
            Logger.error("Error processing rows: #{Exception.message(e)}")
            {:error, "Error processing rows: #{Exception.message(e)}"}
        end

      [_comment_row | data_rows] ->
        # Fallback for files with only comment row, no separate header
        Logger.info("processing rows with only comment row")
        process_rows([nil, nil | data_rows], attributes)

      [] ->
        {:ok, []}

      _ ->
        {:error, "Excel file has insufficient rows (need at least comment and header rows)"}
    end
  end

  # Filter out invalid data rows
  @doc """
  Map a single row to the given attributes.

  ## Parameters
  - row: List of values from Excel row
  - attributes: List of attribute names

  ## Returns
  Map with attribute-value pairs or nil if row is invalid
  """
  defp map_row_to_attributes(row, attributes) when is_list(row) do
    # Skip rows that are too short (less than half the expected columns)
    if length(row) < div(length(attributes), 2) do
      Logger.warning("Skipping row with insufficient columns: #{inspect(row)}")
      nil
    else
      # Take only the first n columns where n is the number of attributes
      relevant_columns = Enum.take(row, length(attributes))

      # Pad with nil values if row has fewer columns than attributes
      padded_columns = case length(relevant_columns) < length(attributes) do
        true ->
          relevant_columns ++ List.duplicate(nil, length(attributes) - length(relevant_columns))
        false ->
          relevant_columns
      end

      # Create map by zipping attributes with values
      result = attributes
               |> Enum.zip(padded_columns)
               |> Enum.into(%{})
               |> clean_values()
      result
      # Validate that we have at least the required fields (member_id, name, password)
      # if has_required_basic_fields?(result) do
      #   result
      # else
      #   Logger.warning("Skipping row missing required fields: #{inspect(result)}")
      #   nil
      # end
    end
  end

  defp map_row_to_attributes(row, _attributes) do
    Logger.warning("Invalid row format: #{inspect(row)}")
    nil
  end

  # Check if the mapped row has the basic required fields
  # Generic validation that works for different data types
  defp has_required_basic_fields?(map) do
    # For exercises: title or question_content
    exercise_fields = not is_nil(map[:title]) and map[:title] != "" or
                     not is_nil(map[:question_content]) and map[:question_content] != ""

    # For homeworks: title or content
    homework_fields = not is_nil(map[:title]) and map[:title] != "" or
                     not is_nil(map[:content]) and map[:content] != ""

    # For questions: title
    question_fields = not is_nil(map[:title]) and map[:title] != ""

    # For users: member_id, name, password (legacy)
    user_fields = not is_nil(map[:member_id]) and map[:member_id] != "" and
                  not is_nil(map[:name]) and map[:name] != "" and
                  not is_nil(map[:password]) and map[:password] != ""

    # Accept any valid data type
    exercise_fields or homework_fields or question_fields or user_fields
  end

  @doc """
  Clean values in the map.
  - Convert empty strings to nil
  - Convert numbers from string format if needed
  - Clean Unicode escape sequences and normalize text
  """
  defp clean_values(map) do
    map
    |> Enum.map(fn {key, value} ->
      cleaned_value = case value do
        "" -> nil
        nil -> nil
        value when is_binary(value) ->
          # Clean Unicode escape sequences first
          cleaned_text = clean_text(value)

          # Try to convert to number if possible
          case Integer.parse(cleaned_text) do
            {int_val, ""} -> int_val
            :error ->
              case Float.parse(cleaned_text) do
                {float_val, ""} -> float_val
                :error -> cleaned_text
              end
          end
        value -> value
      end
      {key, cleaned_value}
    end)
    |> Enum.into(%{})
  end

  @doc """
  Clean text by removing Unicode escape sequences and normalizing whitespace.
  """
  defp clean_text(text) when is_binary(text) do
    text
    # Replace zero-width spaces and other problematic Unicode characters
    |> String.replace("\u200B", "")
    |> String.replace("\u200C", "")
    |> String.replace("\u200D", "")
    |> String.replace("\uFEFF", "")
    # Normalize line breaks
    |> String.replace("\\u200B\\n", "\n")
    |> String.replace("\\n", "\n")
    # Clean up excessive whitespace
    |> String.trim()
  end

  defp clean_text(value), do: value

  @doc """
  Create a temporary file for Excel processing.
  """
  defp create_temp_file(binary_data) do
    temp_path = get_temp_path()
    case File.write(temp_path, binary_data) do
      :ok -> {:ok, temp_path}
      {:error, reason} -> {:error, "Failed to create temporary file: #{reason}"}
    end
  end

  @doc """
  Get temporary file path.
  """
  defp get_temp_path do
    System.tmp_dir!() |> Path.join("excel_import_#{System.system_time()}.xlsx")
  end

  @doc """
  Clean up temporary file.
  """
  defp cleanup_temp_file(temp_path) do
    File.rm(temp_path)
  end

  @doc """
  Clean up temporary file if it exists.
  """
  defp cleanup_temp_file_if_exists(temp_path) do
    if File.exists?(temp_path) do
      File.rm(temp_path)
    end
  end
end
