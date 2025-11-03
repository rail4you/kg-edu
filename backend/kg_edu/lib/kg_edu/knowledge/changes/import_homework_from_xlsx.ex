defmodule KgEdu.Knowledge.Homework.ImportFromExcel do
  @moduledoc """
  Change module for importing homeworks from Excel file.
  Accepts Base64 encoded Excel file and imports homeworks with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id, tenant \\ nil) do
    case import_homework_from_excel(excel_file, attributes, course_id, tenant) do
      {:ok, homeworks} ->
        {:ok, homeworks}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_homework_from_excel(nil, _attributes, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_homework_from_excel(excel_file, attributes, course_id, tenant)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, homework_data} ->
        Logger.info("homework is #{inspect(homework_data)}, course id is #{course_id}")
        create_homework_from_data(homework_data, course_id, tenant)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_homeworks_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_homework_from_data(homework_data, course_id, tenant) when is_list(homework_data) do
    homeworks =
      homework_data
      |> Enum.map(&process_single_homework(&1, course_id, tenant))
      |> Enum.filter(&match?({:ok, _}, &1))
      |> Enum.map(fn {:ok, homework} -> homework end)

    if length(homeworks) == length(homework_data) do
      {:ok, homeworks}
    else
      failed_count = length(homework_data) - length(homeworks)
      Logger.error("Failed to import #{failed_count} homeworks")
      {:ok, homeworks}
    end
  end

  defp process_single_homework(homework_map, course_id, tenant) do
    try do
      # Remove tags from homework_map to avoid processing errors
      homework_map = Map.delete(homework_map, "tags")

      # Ensure score is treated as a number if present
      homework_map = case Map.get(homework_map, "score") do
        score when is_binary(score) ->
          case Float.parse(score) do
            {float_val, ""} -> Map.put(homework_map, "score", float_val)
            _ -> homework_map
          end
        _ -> homework_map
      end

      # Transform description field to content field
      homework_map = case Map.get(homework_map, "description") do
        nil -> homework_map
        description ->
          homework_map
          |> Map.delete("description")
          |> Map.put("content", description)
      end

      # Transform remaining values to strings, except score
      homework_map =
        homework_map
        |> Map.delete("score")  # Remove score temporarily
        |> MapTransformer.transform_values_to_string()
        |> Map.put("course_id", course_id)
        |> then(fn map ->  # Add back score if it existed
          case Map.get(homework_map, "score") do
            nil -> map
            score -> Map.put(map, "score", score)
          end
        end)

      create_single_homework(homework_map, tenant)
    rescue
      error ->
        Logger.error("Error processing homework: #{inspect(error)}")
        {:error, error}
    end
  end

  defp create_single_homework(homework_map, tenant) do
    Logger.info("homework_map is #{inspect(homework_map)}")

    case KgEdu.Knowledge.Homework.create_homework(homework_map, tenant: tenant) do
      {:ok, homework} ->
        {:ok, homework}

      {:error, reason} ->
        Logger.error("Failed to create homework: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
