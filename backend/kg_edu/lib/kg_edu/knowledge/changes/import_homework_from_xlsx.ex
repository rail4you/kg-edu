defmodule KgEdu.Knowledge.Homework.ImportFromExcel do
  @moduledoc """
  Change module for importing homeworks from Excel file.
  Accepts Base64 encoded Excel file and imports homeworks with specified attributes.
  Expected order: title, content, score, answer
  """

  require Logger
  require Ash.Query

  def parse_excel(excel_file, attributes, course_id, tenant \\ nil) do
    case import_homework_from_excel(excel_file, attributes, course_id, tenant) do
      {:ok, result} ->
        {:ok, result}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_homework_from_excel(nil, _attributes, _course_id, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_homework_from_excel(excel_file, attributes, course_id, tenant)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, homework_data} ->
        Logger.info("homework data count: #{length(homework_data)}, course id is #{course_id}")
        create_homework_from_data(homework_data, course_id, tenant)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_homework_from_excel(_, _, _, _) do
    {:error, "Invalid parameters"}
  end

  defp create_homework_from_data(homework_data, course_id, tenant) when is_list(homework_data) do
    # 获取当前课程中现有作业的最大 position
    max_position = get_max_position(course_id, tenant)

    # 获取当前课程中已存在的作业标题列表
    existing_titles = get_existing_titles(course_id, tenant)

    # 处理每一行数据
    results =
      homework_data
      |> Enum.with_index()
      |> Enum.reduce(
        %{success: [], skipped: [], errors: [], current_position: max_position},
        fn {homework_map, _index}, acc ->
          title = Map.get(homework_map, "title") || Map.get(homework_map, :title)

          cond do
            # 标题为空，跳过
            is_nil(title) or title == "" ->
              %{acc | errors: [%{title: "未知标题", reason: "标题不能为空"} | acc.errors]}

            # 标题已存在，跳过（忽略重复）
            MapSet.member?(existing_titles, title) ->
              %{acc | skipped: [%{title: title, reason: "标题已存在"} | acc.skipped]}

            true ->
              # 尝试创建作业
              case create_single_homework_with_position(homework_map, course_id, tenant, acc.current_position + 1) do
                {:ok, homework} ->
                  %{
                    acc
                    | success: [homework | acc.success],
                      current_position: acc.current_position + 1
                  }

                {:error, reason} ->
                  error_msg = format_error_reason(reason)
                  %{acc | errors: [%{title: title, reason: error_msg} | acc.errors]}
              end
          end
        end
      )

    # 构建返回结果
    result = %{
      success_count: length(results.success),
      skipped_count: length(results.skipped),
      error_count: length(results.errors),
      homeworks: Enum.reverse(results.success),
      skipped: Enum.reverse(results.skipped),
      errors: Enum.reverse(results.errors)
    }

    {:ok, result}
  end

  defp get_existing_titles(course_id, tenant) do
    KgEdu.Knowledge.Homework
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:title])
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(& &1.title)
    |> MapSet.new()
  end

  defp create_single_homework_with_position(homework_map, course_id, tenant, position) do
    try do
      # Remove tags from homework_map to avoid processing errors
      homework_map = Map.delete(homework_map, "tags")

      # Ensure score is treated as a number if present
      homework_map =
        case Map.get(homework_map, "score") do
          score when is_binary(score) ->
            case Float.parse(score) do
              {float_val, ""} -> Map.put(homework_map, "score", float_val)
              _ -> homework_map
            end

          _ ->
            homework_map
        end

      # Transform description field to content field
      homework_map =
        case Map.get(homework_map, "description") do
          nil ->
            homework_map

          description ->
            homework_map
            |> Map.delete("description")
            |> Map.put("content", description)
        end

      # Transform remaining values to strings, except score and position
      original_score = Map.get(homework_map, "score")

      homework_map =
        homework_map
        # Remove score temporarily
        |> Map.delete("score")
        # Remove position temporarily (if exists)
        |> Map.delete("position")
        |> MapTransformer.transform_values_to_string()
        |> Map.put("course_id", course_id)
        |> Map.put("position", position)
        # Add back score if it existed
        |> then(fn map ->
          case original_score do
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

  defp format_error_reason(reason) when is_binary(reason), do: reason

  defp format_error_reason(%{errors: errors}) when is_list(errors) do
    errors
    |> Enum.map(fn error ->
      cond do
        is_binary(error) -> error
        is_map(error) -> error[:message] || inspect(error)
        true -> inspect(error)
      end
    end)
    |> Enum.join(", ")
  end

  defp format_error_reason(reason) when is_map(reason) do
    reason[:message] || inspect(reason)
  end

  defp format_error_reason(reason), do: inspect(reason)

  defp get_max_position(course_id, tenant) do
    KgEdu.Knowledge.Homework
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:position])
    |> Ash.Query.sort(position: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one(tenant: tenant, authorize?: false)
    |> case do
      {:ok, nil} -> 0
      {:ok, homework} -> homework.position || 0
      {:error, _} -> 0
    end
  end
end
