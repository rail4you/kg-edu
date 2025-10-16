defmodule KgEdu.Knowledge.Changes.ImportExerciseFromXlsx do
  @moduledoc """
  Change module for importing exercises from XLSX files.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    xlsx_base64 = Ash.Changeset.get_argument(changeset, :xlsx_base64)
    created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)

    case decode_and_parse_xlsx(xlsx_base64) do
      {:ok, exercises_data} ->
        case create_exercises(exercises_data, created_by_id) do
          {:ok, exercises} ->
            Ash.Changeset.after_action(changeset, fn _resource, _record ->
              {:ok, %{imported_exercises: exercises, count: length(exercises)}}
            end)
          {:error, error} ->
            Ash.Changeset.add_error(changeset, error)
        end
      {:error, error} ->
        Ash.Changeset.add_error(changeset, error)
    end
  end

  defp decode_and_parse_xlsx(xlsx_base64) do
    case Base.decode64(xlsx_base64) do
      {:ok, binary} ->
        # Save binary to temp file and parse with Xlsxir
        case parse_xlsx_from_binary(binary) do
          {:ok, data} -> {:ok, data}
          {:error, error} -> {:error, error}
        end
      :error ->
        {:error, "Invalid base64 encoding"}
    end
  end

  defp parse_xlsx_from_binary(binary) do
    temp_file = System.tmp_dir!() |> Path.join("temp_exercise_#{:erlang.system_time()}.xlsx")
    
    try do
      File.write!(temp_file, binary)
      
      case Xlsxir.multi_extract(temp_file, 0) do
        {:ok, rows} when is_list(rows) and length(rows) > 0 ->
          # Skip header row and convert to map format
          exercise_data = 
            rows
            |> tl() # Skip header
            |> Enum.map(&row_to_exercise_map/1)
            |> Enum.filter(&(&1 != nil))
          
          {:ok, exercise_data}
        {:ok, _} ->
          {:error, "No data found in XLSX file"}
        {:error, reason} ->
          {:error, "Failed to parse XLSX: #{inspect(reason)}"}
      end
    after
      File.rm(temp_file)
    end
  end

  defp row_to_exercise_map(row) do
    # Expected columns: title, question_content, answer, question_type, options, course_id, knowledge_resource_id, ai_type
    case row do
      [title, question_content, answer, question_type, options, course_id, knowledge_resource_id, ai_type] ->
        %{
          title: to_string(title || ""),
          question_content: to_string(question_content || ""),
          answer: to_string(answer || ""),
          question_type: parse_question_type(question_type),
          options: parse_options(options),
          course_id: parse_uuid(course_id),
          knowledge_resource_id: parse_uuid(knowledge_resource_id),
          ai_type: parse_ai_type(ai_type)
        }
      _ ->
        nil # Skip invalid rows
    end
  end

  defp parse_question_type(nil), do: :essay
  defp parse_question_type(type) when is_binary(type) do
    case String.downcase(type) do
      "multiple_choice" -> :multiple_choice
      "multiple choice" -> :multiple_choice
      "mc" -> :multiple_choice
      "essay" -> :essay
      "fill_in_blank" -> :fill_in_blank
      "fill in blank" -> :fill_in_blank
      "fill_blank" -> :fill_in_blank
      "blank" -> :fill_in_blank
      _ -> :essay # Default to essay
    end
  end
  defp parse_question_type(_), do: :essay

  defp parse_options(nil), do: nil
  defp parse_options(options) when is_binary(options) do
    try do
      # Try to parse as JSON first
      Jason.decode!(options)
    rescue
      _ ->
        # If not JSON, try to parse as simple key-value pairs like "A: Option 1, B: Option 2"
        case String.split(options, ",") do
          [single] when is_binary(single) ->
            # Single option
            case String.split(single, ":") do
              [key, value] -> %{String.trim(key) => String.trim(value)}
              _ -> nil
            end
          multiple ->
            # Multiple options
            multiple
            |> Enum.map(fn option ->
              case String.split(option, ":") do
                [key, value] -> {String.trim(key), String.trim(value)}
                _ -> nil
              end
            end)
            |> Enum.filter(&(&1 != nil))
            |> Map.new()
        end
    end
  end
  defp parse_options(options) when is_map(options), do: options
  defp parse_options(_), do: nil

  defp parse_ai_type(nil), do: nil
  defp parse_ai_type(type) when is_binary(type) do
    case String.downcase(type) do
      "ai_generated" -> :ai_generated
      "ai generated" -> :ai_generated
      "ai" -> :ai_generated
      _ -> nil
    end
  end
  defp parse_ai_type(_), do: nil

  defp parse_uuid(nil), do: nil
  defp parse_uuid(uuid_str) when is_binary(uuid_str) do
    case Ecto.UUID.cast(uuid_str) do
      {:ok, uuid} -> uuid
      :error -> nil
    end
  end
  defp parse_uuid(_), do: nil

  defp create_exercises(exercises_data, created_by_id) do
    # Use Ash's bulk create functionality
    exercises_with_creator = 
      Enum.map(exercises_data, fn data ->
        Map.put(data, :created_by_id, created_by_id)
      end)

    # Create each exercise individually for better error handling
    results = 
      Enum.reduce_while(exercises_with_creator, [], fn exercise_data, acc ->
        case KgEdu.Knowledge.Exercise.create_exercise(exercise_data, []) do
          {:ok, exercise} ->
            {:cont, [exercise | acc]}
          {:error, error} ->
            {:halt, {:error, error}}
        end
      end)

    case results do
      {:error, error} -> {:error, error}
      exercises -> {:ok, Enum.reverse(exercises)}
    end
  end
end