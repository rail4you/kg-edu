defmodule KgEdu.Knowledge.Exercise.ImportFromExcel do
  @moduledoc """
  Change module for importing exercises from Excel file.
  Accepts Base64 encoded Excel file and imports exercises with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id, tenant \\ nil) do
    case import_exercise_from_excel(excel_file, attributes, course_id, tenant) do
      {:ok, exercises} ->
        {:ok, exercises}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_exercise_from_excel(nil, _attributes, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_exercise_from_excel(excel_file, attributes, course_id, tenant)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, exercise_data} ->
        Logger.info("exercise is #{inspect(exercise_data)}, course id is #{course_id}")
        create_exercise_from_data(exercise_data, course_id, tenant)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp create_exercise_from_data(exercise_data, course_id, tenant) when is_list(exercise_data) do
    exercises =
      exercise_data
      |> Enum.map(&process_single_exercise(&1, course_id, tenant))
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

  defp process_single_exercise(exercise_map, course_id, tenant) do
    try do
      # Transform all values to strings first, but preserve options as a special case
      exercise_map =
        exercise_map
        |> MapTransformer.transform_values_to_string()
        |> map_question_type()

      # Process options if present and add course_id directly
      processed_exercise =
        exercise_map
        |> process_options()
        |> Map.put("course_id", course_id)
        |> ensure_atom_question_type()

      create_single_exercise(processed_exercise, tenant)
    rescue
      error ->
        Logger.error("Error processing exercise: #{inspect(error)}")
        {:error, error}
    end
  end

  defp process_options(%{:options => options} = exercise_map) when is_binary(options) do
    # Split options by lines and create choices array
    choices =
      options
      |> String.split("\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    options_map = %{"choices" => choices}
    Map.put(exercise_map, :options, options_map)
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

  defp map_question_type(%{:question_type => "1"} = exercise_map) do
    Map.put(exercise_map, :question_type, :multiple_choice)
  end

  defp map_question_type(%{:question_type => "2"} = exercise_map) do
    Map.put(exercise_map, :question_type, :essay)
  end

  defp map_question_type(%{"question_type" => "1"} = exercise_map) do
    Map.put(exercise_map, "question_type", :multiple_choice)
  end

  defp map_question_type(%{"question_type" => "2"} = exercise_map) do
    Map.put(exercise_map, "question_type", :essay)
  end

  defp map_question_type(exercise_map), do: exercise_map

  # Ensure question_type is an atom, convert if it's a string
  defp ensure_atom_question_type(exercise_map) do
    case exercise_map do
      %{:question_type => type} when is_binary(type) ->
        atom_type = case type do
          "multiple_choice" -> :multiple_choice
          "essay" -> :essay
          "fill_in_blank" -> :fill_in_blank
          _ -> :multiple_choice  # default
        end
        Map.put(exercise_map, :question_type, atom_type)
      %{"question_type" => type} when is_binary(type) ->
        atom_type = case type do
          "multiple_choice" -> :multiple_choice
          "essay" -> :essay
          "fill_in_blank" -> :fill_in_blank
          _ -> :multiple_choice  # default
        end
        Map.put(exercise_map, "question_type", atom_type)
      _ ->
        exercise_map
    end
  end

  defp create_single_exercise(exercise_map, tenant) do
    Logger.info("exercise_map is #{inspect(exercise_map)}")

    case KgEdu.Knowledge.Exercise.create_exercise(exercise_map, tenant: tenant) do
      {:ok, exercise} ->
        {:ok, exercise}

      {:error, reason} ->
        Logger.error("Failed to create exercise: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
