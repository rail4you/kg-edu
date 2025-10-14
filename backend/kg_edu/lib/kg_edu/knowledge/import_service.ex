defmodule KgEdu.Knowledge.ImportService do
  @moduledoc """
  Service for importing knowledge resources and relations from Excel files.
  Handles transactional import of both knowledge resources and their relations.
  """

  alias KgEdu.Repo
  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.Relation

  @doc """
  Import both knowledge resources and relations from an Excel file in a single transaction.
  
  ## Parameters
  - excel_data: Base64 encoded Excel file content
  - course_id: UUID of the course to import into
  
  ## Returns
  {:ok, result} on success, {:error, reason} on failure
  """
  def import_knowledge_excel(excel_data, course_id) do
    Repo.transaction(fn ->
      case import_all(excel_data, course_id) do
        {:ok, result} -> result
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  # Import knowledge resources and relations sequentially.
  defp import_all(excel_data, course_id) do
    # First import knowledge resources
    case Resource.import_knowledge_from_excel(%{excel_data: excel_data, course_id: course_id}) do
      {:ok, resource_result} ->
        # Then import relations
        case Relation.import_relations_from_excel(%{excel_data: excel_data, course_id: course_id}) do
          {:ok, relation_result} ->
            {:ok, %{
              resources: resource_result,
              relations: relation_result
            }}
          {:error, reason} ->
            {:error, "Failed to import relations: #{reason}"}
        end
      {:error, reason} ->
        {:error, "Failed to import knowledge resources: #{reason}"}
    end
  end

  @doc """
  Import only knowledge resources (without relations).
  """
  def import_knowledge_resources_only(input, _context) do
    Resource.import_knowledge_from_excel(%{excel_data: input.excel_data, course_id: input.course_id})
  end

  @doc """
  Import only relations (assumes knowledge resources already exist).
  """
  def import_relations_only(input, _context) do
    Relation.import_relations_from_excel(%{excel_data: input.excel_data, course_id: input.course_id})
  end

  @doc """
  Validate Excel file format before import.
  """
  def validate_excel_format(excel_data) do
    case KgEdu.ExcelParser.parse_from_base64(excel_data) do
      {:ok, %{sheet1: sheet1_data, sheet2: sheet2_data}} ->
        validation_result = %{
          sheet1_valid: validate_sheet1_format(sheet1_data),
          sheet2_valid: validate_sheet2_format(sheet2_data),
          sheet1_rows: length(sheet1_data),
          sheet2_rows: length(sheet2_data)
        }
        
        if validation_result.sheet1_valid and validation_result.sheet2_valid do
          {:ok, validation_result}
        else
          {:error, validation_result}
        end
      
      {:error, reason} ->
        {:error, %{parse_error: reason}}
    end
  end

  # Validate Sheet 1 format (knowledge resources)
  defp validate_sheet1_format(rows) do
    if length(rows) == 0 do
      false
    else
      # Check if first row has at least 6 columns (course, subject, unit, name, description, importance_level)
      case Enum.at(rows, 0) do
        nil -> false
        row when is_list(row) and length(row) >= 6 -> true
        _ -> false
      end
    end
  end

  # Validate Sheet 2 format (relations)
  defp validate_sheet2_format(rows) do
    if length(rows) == 0 do
      false
    else
      # Check if first row has at least 3 columns (knowledge1, relation_type, knowledge2)
      case Enum.at(rows, 0) do
        nil -> false
        row when is_list(row) and length(row) >= 3 -> true
        _ -> false
      end
    end
  end

  # Ash action run functions
  def run_resource_import(input, _context) do
    import_knowledge_resources_only(input, nil)
  end

  def run_relation_import(input, _context) do
    import_relations_only(input, nil)
  end
end