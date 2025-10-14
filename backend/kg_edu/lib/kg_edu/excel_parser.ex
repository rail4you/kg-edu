defmodule KgEdu.ExcelParser do
  @moduledoc """
  Module for parsing Excel files containing knowledge import data.
  Handles two sheets: "1" for knowledge resources and "2" for knowledge relations.
  """

  @doc """
  Parse Excel file from base64 encoded string.

  ## Parameters
  - base64_data: Base64 encoded Excel file content

  ## Returns
  {:ok, %{sheet1: knowledge_data, sheet2: relation_data}} or {:error, reason}
  """
  def parse_from_base64(base64_data) do
    case Base.decode64(base64_data) do
      {:ok, binary_data} ->
        parse_excel_binary(binary_data)

      :error ->
        {:error, "Invalid base64 data"}
    end
  end

  @doc """
  Parse Excel file from binary data.
  """
  def parse_excel_binary(binary_data) do
    try do
      # Create temporary file
      temp_path = System.tmp_dir!() |> Path.join("temp_import_#{System.system_time()}.xlsx")

      File.write!(temp_path, binary_data)
      result = parse_excel_file(temp_path)
      File.rm(temp_path)

      result
    rescue
      e ->
        {:error, "Failed to parse Excel file: #{Exception.message(e)}"}
    end
  end

  @doc """
  Parse Excel file and extract data from both sheets.
  """
  def parse_excel_file(file_path) do
    with {:ok, sheet1_data} <- parse_sheet(file_path,  0),
         {:ok, sheet2_data} <- parse_sheet(file_path,  1) do
      {:ok, %{sheet1: sheet1_data, sheet2: sheet2_data}}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc """
  Parse a specific sheet from the Excel file.
  """
  def parse_sheet(file_path, sheet_name) do
    try do
      IO.inspect("Parsing sheet #{sheet_name} from file #{file_path}")
      case Xlsxir.multi_extract(file_path, sheet_name) do
        {:ok, table_id} ->
          # Get all rows
          # IO.inspect("table id #{table_id}")
          rows = Xlsxir.get_list(table_id)
          Xlsxir.close(table_id)

          # Skip header row (first row) and process remaining rows
          case rows do
            [_header | data_rows] ->
              processed_rows = Enum.map(data_rows, &process_row/1)
              {:ok, processed_rows}

            [] ->
              {:ok, []}

            _ ->
              {:error, "Sheet '#{sheet_name}' has no header row"}
          end

        {:error, reason} ->
          {:error, "Failed to extract sheet '#{sheet_name}': #{reason}"}
      end
    rescue
      e ->
        {:error, "Error parsing sheet '#{sheet_name}': #{Exception.message(e)}"}
    end
  end

  @doc """
  Process a single row, converting empty strings to nil and cleaning data.
  """
  def process_row(row) when is_list(row) do
    row
    |> Enum.map(fn
      "" -> nil
      value -> value
    end)
  end
end
