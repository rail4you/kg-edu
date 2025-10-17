defmodule KgEdu.Knowledge.Changes.ImportQuestionsFromXlsx do
  @moduledoc """
  Change module for importing questions from XLSX files.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    xlsx_base64 = Ash.Changeset.get_argument(changeset, :xlsx_base64)
    created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)

    case decode_and_parse_xlsx(xlsx_base64) do
      {:ok, questions_data} ->
        case create_questions(questions_data, created_by_id) do
          {:ok, questions} ->
            Ash.Changeset.after_action(changeset, fn _resource, _record ->
              {:ok, %{imported_questions: questions, count: length(questions)}}
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
        case parse_xlsx_from_binary(binary) do
          {:ok, data} -> {:ok, data}
          {:error, error} -> {:error, error}
        end
      :error ->
        {:error, "Invalid base64 encoding"}
    end
  end

  defp parse_xlsx_from_binary(binary) do
    temp_file = System.tmp_dir!() |> Path.join("temp_questions_#{:erlang.system_time()}.xlsx")
    
    try do
      File.write!(temp_file, binary)
      
      case Xlsxir.multi_extract(temp_file, 0) do
        {:ok, rows} when is_list(rows) and length(rows) > 1 ->
          [headers | data_rows] = rows
          questions_data = 
            data_rows
            |> Enum.map(&row_to_question_map(&1, headers))
            |> Enum.filter(&(&1 != nil))
          
          {:ok, questions_data}
        {:ok, [_single_header]} ->
          {:error, "No data rows found in XLSX file"}
        {:ok, []} ->
          {:error, "No data found in XLSX file"}
        {:error, reason} ->
          {:error, "Failed to parse XLSX: #{inspect(reason)}"}
      end
    after
      File.rm(temp_file)
    end
  end

  defp row_to_question_map(row, headers) do
    # Create mapping from headers to column indices
    header_mapping = headers
      |> Enum.with_index()
      |> Enum.into(%{}, fn {header, index} -> 
        {String.downcase(String.trim(header)), index} 
      end)

    # Helper to get value by column name or index
    get_value = fn column_name_or_index ->
      get_with_default = fn default ->
        value = cond do
          is_binary(column_name_or_index) and is_map_key(header_mapping, String.downcase(column_name_or_index)) ->
            index = header_mapping[String.downcase(column_name_or_index)]
            if index < length(row), do: Enum.at(row, index), else: default
          
          is_number(column_name_or_index) and column_name_or_index < length(row) ->
            Enum.at(row, column_name_or_index, default)
          
          true -> default
        end
        
        if value == "" or value == nil, do: default, else: value
      end
      
      get_with_default
    end

    # Extract values using flexible column mapping
    title = get_value.("标题") || get_value.("title") || get_value.(0) || ""
    description = get_value.("描述") || get_value.("description") || get_value.(1)
    question_level = get_value.("级别") || get_value.("level") || get_value.(2)
    position = get_value.("位置") || get_value.("position") || get_value.(3)
    tags = get_value.("标签") || get_value.("tags") || get_value.(4)
    course_name = get_value.("课程名称") || get_value.("course") || get_value.(5)

    # Validate required fields
    if title == "" or course_name == nil do
      nil # Skip invalid rows
    else
      # Look up course by name
      course_id = find_course_id_by_name(course_name)
      
      if course_id == nil do
        nil # Skip rows with invalid course name
      else
        %{
          title: to_string(title),
          description: if(description != nil, do: to_string(description), else: nil),
          question_level: parse_question_level(question_level),
          position: parse_position(position),
          tags: parse_tags(tags),
          course_id: course_id
        }
      end
    end
  end

  defp parse_question_level(nil), do: :global
  defp parse_question_level(level_str) when is_binary(level_str) do
    case String.downcase(String.trim(level_str)) do
      "global" -> :global
      "概念" -> :concept
      "concept" -> :concept
      "方法" -> :method
      "method" -> :method
      _ -> :global
    end
  end
  defp parse_question_level(_), do: :global

  defp parse_position(nil), do: 0
  defp parse_position(pos) when is_binary(pos) do
    case Integer.parse(pos) do
      {int, ""} -> int
      _ -> 0
    end
  rescue
    _ -> 0
  end
  defp parse_position(pos) when is_number(pos), do: trunc(pos)
  defp parse_position(_), do: 0

  defp parse_tags(nil), do: []
  defp parse_tags(tags_str) when is_binary(tags_str) do
    tags_str
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.filter(&(&1 != ""))
  end
  defp parse_tags(tags) when is_list(tags), do: tags
  defp parse_tags(_), do: []

  defp find_course_id_by_name(course_name) do
    case KgEdu.Courses.Course.get_course_by_title(course_name) do
      {:ok, course} -> course.id
      {:error, _} -> nil
    end
  rescue
    _ -> nil
  end

  defp create_questions(questions_data, created_by_id) do
    questions_with_creator = 
      Enum.map(questions_data, fn data ->
        Map.put(data, :created_by_id, created_by_id)
      end)

    results = 
      Enum.reduce_while(questions_with_creator, [], fn question_data, acc ->
        case KgEdu.Knowledge.Question.create_question(question_data, []) do
          {:ok, question} ->
            {:cont, [question | acc]}
          {:error, error} ->
            {:halt, {:error, error}}
        end
      end)

    case results do
      {:error, error} -> {:error, error}
      questions -> {:ok, Enum.reverse(questions)}
    end
  end
end