defmodule KgEdu.Knowledge.Resource.ImportFromExcel do
  @moduledoc """
  Change module for importing resources from Excel file.
  Accepts Base64 encoded Excel file and imports resources with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id) do
    case import_resource_from_excel(excel_file, attributes, course_id) do
      {:ok, resource} ->
        {:ok, resource}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_resource_from_excel(nil, _attributes) do
    {:error, "Excel file is required"}
  end

  defp import_resource_from_excel(excel_file, attributes, course_id)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, resource_data} ->
        Logger.info("resource is #{inspect(resource_data)}, course id is #{course_id}")
        create_resource_from_data(resource_data, course_id)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_resources_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_resource_from_data(resource_data, course_id) when is_list(resource_data) do
    resources =
      resource_data
      |> Enum.map(&process_single_resource(&1, course_id))
      |> Enum.filter(&match?({:ok, _}, &1))
      |> Enum.map(fn {:ok, resource} -> resource end)

    if length(resources) == length(resource_data) do
      {:ok, resources}
    else
      failed_count = length(resource_data) - length(resources)
      Logger.error("Failed to import #{failed_count} resources")
      {:ok, resources}
    end
  end

  defp process_single_resource(resource_map, course_id) do
    try do
      # Remove tags from resource_map to avoid processing errors
      # resource_map = Map.delete(resource_map, "tags")

      # # Ensure score is treated as a number if present
      # resource_map = case Map.get(resource_map, "score") do
      #   score when is_binary(score) ->
      #     case Float.parse(score) do
      #       {float_val, ""} -> Map.put(resource_map, "score", float_val)
      #       _ -> resource_map
      #     end
      #   _ -> resource_map
      # end

      # # Transform remaining values to strings, except score
      # resource_map =
      #   resource_map
      #   |> Map.delete("score")  # Remove score temporarily
      #   |> MapTransformer.transform_values_to_string()
      #   |> Map.put("course_id", course_id)
      #   |> then(fn map ->  # Add back score if it existed
      #     case Map.get(resource_map, "score") do
      #       nil -> map
      #       score -> Map.put(map, "score", score)
      #     end
      #   end)

      resource_map =
        resource_map
        |> Map.put("course_id", course_id)

      create_single_resource(resource_map)
    rescue
      error ->
        Logger.error("Error processing resource: #{inspect(error)}")
        {:error, error}
    end
  end

  defp create_single_resource(resource_map) do
    Logger.info("resource_map is #{inspect(resource_map)}")

    case KgEdu.Knowledge.Resource.create_knowledge_resource(resource_map) do
      {:ok, resource} ->
        {:ok, resource}

      {:error, reason} ->
        Logger.error("Failed to create resource: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
