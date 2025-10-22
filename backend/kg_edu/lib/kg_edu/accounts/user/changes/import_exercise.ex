defmodule KgEdu.Knowledge.Exercise.ImportFromExcel do
  @moduledoc """
  Change module for importing exercises from Excel file.
  Accepts Base64 encoded Excel file and imports exercises with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id) do
    case import_exercise_from_excel(excel_file, attributes,course_id) do
      {:ok, exercises} ->
        {:ok, exercises}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_exercise_from_excel(nil, _attributes) do
    {:error, "Excel file is required"}
  end

  defp import_exercise_from_excel(excel_file, attributes, course_id)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, exercise_data} ->
        Logger.info("exercise is #{inspect(exercise_data)}, course id is #{course_id}")
        create_exercise_from_data(exercise_data, course_id)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_exercises_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_exercise_from_data(exercise_data, course_id) when is_list(exercise_data) do
    exercises =
      exercise_data
      |> Enum.map(&process_single_exercise(&1, course_id))
      |> Enum.filter(&match?({:ok, _}, &1))
      |> Enum.map(fn {:ok, exercise} -> exercise end)

    if length(exercises) == length(exercise_data) do
      {:ok, exercises}
    else
      failed_count = length(exercise_data) - length(exercises)
      Logger.error("Failed to import #{failed_count} exercises")
      {:ok, exercises}
    end
  end

  defp process_single_exercise(exercise_map, course_id) do
    try do
      # Transform all values to strings first
      exercise_map = MapTransformer.transform_values_to_string(exercise_map)

      # Process options if present and add course_id directly
      processed_exercise =
        exercise_map
        |> process_options()
        |> Map.put("course_id", course_id)

      create_single_exercise(processed_exercise)
    rescue
      error ->
        Logger.error("Error processing exercise: #{inspect(error)}")
        {:error, error}
    end
  end

  defp process_options(%{"options" => options} = exercise_map) when is_binary(options) do
    # Split options by lines and create choices array
    choices =
      options
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    options_map = %{"choices" => choices}
    Map.put(exercise_map, "options", options_map)
  end

  defp process_options(exercise_map), do: exercise_map

  defp create_single_exercise(exercise_map) do
    exercise_map = MapTransformer.transform_values_to_string(exercise_map)
    Logger.info("exercise_map is #{inspect(exercise_map)}")

    case KgEdu.Knowledge.Exercise.create_exercise(exercise_map) do
      {:ok, exercise} ->
        {:ok, exercise}

      {:error, reason} ->
        {:error, reason}
    end
  end
end
