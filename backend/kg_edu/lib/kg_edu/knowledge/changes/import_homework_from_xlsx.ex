defmodule KgEdu.Knowledge.Changes.ImportHomeworkFromXlsx do
  @moduledoc """
  Change module for importing homework from XLSX files.
  """
  use Ash.Resource.Change

  def change(changeset, _opts, _context) do
    xlsx_base64 = Ash.Changeset.get_argument(changeset, :xlsx_base64)
    created_by_id = Ash.Changeset.get_argument(changeset, :created_by_id)

    case decode_and_parse_xlsx(xlsx_base64) do
      {:ok, homeworks_data} ->
        case create_homeworks(homeworks_data, created_by_id) do
          {:ok, homeworks} ->
            Ash.Changeset.after_action(changeset, fn _resource, _record ->
              {:ok, %{imported_homeworks: homeworks, count: length(homeworks)}}
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
    temp_file = System.tmp_dir!() |> Path.join("temp_homework_#{:erlang.system_time()}.xlsx")
    
    try do
      File.write!(temp_file, binary)
      
      case Xlsxir.multi_extract(temp_file, 0) do
        {:ok, rows} when is_list(rows) and length(rows) > 0 ->
          # Skip header row and convert to map format
          homework_data = 
            rows
            |> tl() # Skip header
            |> Enum.map(&row_to_homework_map/1)
            |> Enum.filter(&(&1 != nil))
          
          {:ok, homework_data}
        {:ok, _} ->
          {:error, "No data found in XLSX file"}
        {:error, reason} ->
          {:error, "Failed to parse XLSX: #{inspect(reason)}"}
      end
    after
      File.rm(temp_file)
    end
  end

  defp row_to_homework_map(row) do
    # Expected columns: title, content, score, course_id, chapter_id, knowledge_resource_id
    case row do
      [title, content, score, course_id, chapter_id, knowledge_resource_id] ->
        %{
          title: to_string(title || ""),
          content: to_string(content || ""),
          score: parse_score(score),
          course_id: parse_uuid(course_id),
          chapter_id: parse_uuid(chapter_id),
          knowledge_resource_id: parse_uuid(knowledge_resource_id)
        }
      _ ->
        nil # Skip invalid rows
    end
  end

  defp parse_score(nil), do: nil
  defp parse_score(score) when is_binary(score) do
    case Decimal.parse(score) do
      {decimal, ""} -> decimal
      _ -> nil
    end
  rescue
    _ -> nil
  end
  defp parse_score(score) when is_number(score), do: Decimal.from_float(score / 1)
  defp parse_score(%Decimal{} = decimal), do: decimal
  defp parse_score(_), do: nil

  defp parse_uuid(nil), do: nil
  defp parse_uuid(uuid_str) when is_binary(uuid_str) do
    case Ecto.UUID.cast(uuid_str) do
      {:ok, uuid} -> uuid
      :error -> nil
    end
  end
  defp parse_uuid(_), do: nil

  defp create_homeworks(homeworks_data, created_by_id) do
    # Use Ash's bulk create functionality
    homeworks_with_creator = 
      Enum.map(homeworks_data, fn data ->
        Map.put(data, :created_by_id, created_by_id)
      end)

    # Create each homework individually for better error handling
    results = 
      Enum.reduce_while(homeworks_with_creator, [], fn homework_data, acc ->
        case KgEdu.Knowledge.Homework.create_homework(homework_data, []) do
          {:ok, homework} ->
            {:cont, [homework | acc]}
          {:error, error} ->
            {:halt, {:error, error}}
        end
      end)

    case results do
      {:error, error} -> {:error, error}
      homeworks -> {:ok, Enum.reverse(homeworks)}
    end
  end
end