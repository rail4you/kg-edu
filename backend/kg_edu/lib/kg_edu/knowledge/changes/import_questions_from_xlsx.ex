defmodule KgEdu.Knowledge.Question.ImportFromExcel do
  @moduledoc """
  Change module for importing questions from Excel file.
  Accepts Base64 encoded Excel file and imports questions with specified attributes.
  Expected order: member_id, name, phone, email, password, role
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id) do
    case import_question_from_excel(excel_file, attributes, course_id) do
      {:ok, questions} ->
        {:ok, questions}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_question_from_excel(nil, _attributes) do
    {:error, "Excel file is required"}
  end

  defp import_question_from_excel(excel_file, attributes, course_id)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, question_data} ->
        Logger.info("question is #{inspect(question_data)}, course id is #{course_id}")
        create_question_from_data(question_data, course_id)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_questions_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_question_from_data(question_data, course_id) when is_list(question_data) do
    questions =
      question_data
      |> Enum.map(&process_single_question(&1, course_id))
      |> Enum.filter(&match?({:ok, _}, &1))
      |> Enum.map(fn {:ok, question} -> question end)

    if length(questions) == length(question_data) do
      {:ok, questions}
    else
      failed_count = length(question_data) - length(questions)
      Logger.error("Failed to import #{failed_count} questions")
      {:ok, questions}
    end
  end

  defp process_single_question(question_map, course_id) do
    try do
      # Remove tags from question_map to avoid processing errors
      question_map = Map.delete(question_map, "tags")
      
      # Transform all values to strings first
      question_map =
        question_map
        |> MapTransformer.transform_values_to_string()

      # Add course_id directly
      processed_question =
        question_map
        |> Map.put("course_id", course_id)

      create_single_question(processed_question)
    rescue
      error ->
        Logger.error("Error processing question: #{inspect(error)}")
        {:error, error}
    end
  end

  defp create_single_question(question_map) do
    Logger.info("question_map is #{inspect(question_map)}")

    case KgEdu.Knowledge.Question.create_question(question_map) do
      {:ok, question} ->
        {:ok, question}

      {:error, reason} ->
        Logger.error("Failed to create question: #{inspect(reason)}")
        {:error, reason}
    end
  end
end
