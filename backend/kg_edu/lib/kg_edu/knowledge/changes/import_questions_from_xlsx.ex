defmodule KgEdu.Knowledge.Question.ImportFromExcel do
  @moduledoc """
  Change module for importing questions from Excel file.
  Accepts Base64 encoded Excel file and imports questions with specified attributes.
  Expected order: title, description, question_level, position
  """

  require Logger

  def parse_excel(excel_file, attributes, course_id, tenant \\ nil) do
    case import_question_from_excel(excel_file, attributes, course_id, tenant) do
      {:ok, questions} ->
        {:ok, questions}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp import_question_from_excel(nil, _attributes, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_question_from_excel(excel_file, attributes, course_id, tenant)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("attributes are #{inspect(attributes)}")

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, question_data} ->
        Logger.info("question is #{inspect(question_data)}, course id is #{course_id}")
        create_question_from_data(question_data, course_id, tenant)

      {:error, reason} ->
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_questions_from_excel(_, _) do
    {:error, "Invalid parameters"}
  end

  defp create_question_from_data(question_data, course_id, tenant) when is_list(question_data) do
    # 获取当前课程中现有问题的最大 position
    max_position = get_max_position(course_id, tenant)

    # 获取当前课程中已存在的问题标题列表（用于检查重复）
    existing_titles = get_existing_titles(course_id, tenant)

    # 处理每一行数据
    results =
      question_data
      |> Enum.with_index()
      |> Enum.reduce(
        %{success: [], skipped: [], errors: [], current_position: max_position},
        fn {question_map, _index}, acc ->
          title = Map.get(question_map, "title") || Map.get(question_map, :title)

          cond do
            # 标题为空，记录错误
            is_nil(title) or title == "" ->
              %{acc | errors: [%{title: "未知标题", reason: "标题不能为空"} | acc.errors]}

            # 标题已存在，跳过（忽略重复）
            MapSet.member?(existing_titles, title) ->
              %{acc | skipped: [%{title: title, reason: "标题已存在"} | acc.skipped]}

            true ->
              # 尝试创建问题
              case process_single_question(question_map, course_id, tenant, acc.current_position + 1) do
                {:ok, question} ->
                  %{
                    acc
                    | success: [question | acc.success],
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
      questions: Enum.reverse(results.success),
      skipped: Enum.reverse(results.skipped),
      errors: Enum.reverse(results.errors)
    }

    {:ok, result}
  end

  defp get_existing_titles(course_id, tenant) do
    require Ash.Query

    KgEdu.Knowledge.Question
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:title])
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(& &1.title)
    |> MapSet.new()
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

  defp process_single_question(question_map, course_id, tenant, position) do
    try do
      # Remove tags from question_map to avoid processing errors
      question_map = Map.delete(question_map, "tags")

      # Transform all values to strings first
      question_map =
        question_map
        |> MapTransformer.transform_values_to_string()

      # Add course_id and position directly
      processed_question =
        question_map
        |> Map.put("course_id", course_id)
        |> Map.put("position", position)

      create_single_question(processed_question, tenant)
    rescue
      error ->
        Logger.error("Error processing question: #{inspect(error)}")
        {:error, error}
    end
  end

  defp create_single_question(question_map, tenant) do
    Logger.info("question_map is #{inspect(question_map)}")

    case KgEdu.Knowledge.Question.create_question(question_map, tenant: tenant) do
      {:ok, question} ->
        {:ok, question}

      {:error, reason} ->
        # 提取简洁的错误信息
        error_msg =
          case reason do
            %Ash.Error.Invalid{errors: errors} ->
              errors
              |> Enum.map_join("; ", fn e ->
                msg = e.private_vars[:message] || e.message || "Unknown error"
                # 转换常见错误为中文
                cond do
                  String.contains?(msg, "has already been taken") ->
                    "该标题在当前课程和问题等级下已存在，不能重复"
                  true ->
                    msg
                end
              end)

            %Ash.Error.Invalid{} = error ->
              Exception.message(error)

            _ ->
              inspect(reason)
          end

        Logger.error("Failed to create question: #{error_msg}")
        {:error, error_msg}
    end
  end

  defp get_max_position(course_id, tenant) do
    require Ash.Query

    KgEdu.Knowledge.Question
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:position])
    |> Ash.Query.sort(position: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one(tenant: tenant, authorize?: false)
    |> case do
      {:ok, nil} -> 0
      {:ok, question} -> question.position || 0
      {:error, _} -> 0
    end
  end
end
