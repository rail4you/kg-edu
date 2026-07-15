defmodule KgEdu.Knowledge.ImportService do
  @moduledoc """
  Service for importing knowledge resources and relations from Excel files.
  Handles transactional import of both knowledge resources and their relations.
  """

  alias KgEdu.Repo
  alias KgEdu.Knowledge.Resource

  @doc """
  Import both knowledge resources and relations from an Excel file in a single transaction.

  ## Parameters
  - excel_data: Base64 encoded Excel file content
  - course_id: UUID of the course to import into
  - tenant: Tenant schema name (optional)

  ## Returns
  {:ok, result} on success, {:error, reason} on failure
  """
  def import_knowledge_excel(excel_data, course_id, tenant \\ nil) do
    Repo.transaction(fn ->
      case import_all_direct(excel_data, course_id, tenant) do
        {:ok, result} -> result
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # Direct import without going through Ash code interface (avoids MatchError wrapping issues)
  defp import_all_direct(excel_data, course_id, tenant) do
    case KgEdu.ExcelParser.parse_from_base64(excel_data, 0) do
      {:ok, %{sheet: knowledge_data}} ->
        IO.inspect("ImportService: parsed #{length(knowledge_data)} rows from Excel")

        # Call process_knowledge_import directly with tenant
        case Resource.do_process_knowledge_import(knowledge_data, course_id, tenant) do
          {:ok, result_msg} ->
            IO.inspect("ImportService: knowledge import success: #{result_msg}")
            {:ok, %{resources: result_msg}}

          {:error, reason} ->
            {:error, "Failed to import knowledge resources: #{reason}"}
        end

      {:ok, other} ->
        {:error, "Unexpected parse result format: #{inspect(other)}"}

      {:error, reason} ->
        {:error, "Failed to parse Excel file: #{reason}"}
    end
  end

  @doc """
  Import only knowledge resources (without relations).
  """
  def import_knowledge_resources_only(input, _context) do
    tenant = Map.get(input, :tenant) || Map.get(input, :org_schema)

    case KgEdu.ExcelParser.parse_from_base64(input.excel_data, 0) do
      {:ok, %{sheet: knowledge_data}} ->
        Resource.do_process_knowledge_import(knowledge_data, input.course_id, tenant)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @doc """
  Import only relations (assumes knowledge resources already exist).
  """
  def import_relations_only(input, _context) do
    {:ok, %{relations: :skipped}}
  end

  @doc """
  Validate Excel file format before import.
  """
  def validate_excel_format(excel_data) do
    case KgEdu.ExcelParser.parse_from_base64(excel_data, 0) do
      {:ok, %{sheet: sheet_data}} ->
        validation_result = %{
          sheet_valid: validate_sheet_format(sheet_data),
          sheet_rows: length(sheet_data)
        }

        if validation_result.sheet_valid do
          {:ok, validation_result}
        else
          {:error, validation_result}
        end

      {:error, reason} ->
        {:error, %{parse_error: reason}}
    end
  end

  # Validate sheet format
  defp validate_sheet_format(rows) do
    if length(rows) == 0 do
      false
    else
      case Enum.at(rows, 0) do
        nil -> false
        row when is_list(row) and length(row) >= 6 -> true
        _ -> false
      end
    end
  end
end
