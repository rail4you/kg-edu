defmodule KgEdu.Knowledge.Exercise.ImportFromExcel do
  @moduledoc """
  Module for importing exercises from Excel files.
  Returns a summary with successful, failed, and skipped exercises.
  """

  require Logger

  @doc """
  Import exercises from Excel file with Base64 encoding.

  ## Parameters
  - excel_file: Base64 encoded string of the Excel file
  - attributes: List of attributes to map columns to
  - course_id: Course ID to associate exercises with
  - created_by_id: User ID who is importing the exercises
  - tenant: Tenant schema name

  ## Returns
  {:ok, %{summary: %{total: int, success: int, failed: int, skipped: int}, successful: [], failed: [], skipped: []}}
  """
  def parse_excel(excel_file, attributes, course_id, created_by_id, tenant) do
    import_exercises_from_excel(excel_file, attributes, course_id, created_by_id, tenant)
  end

  defp import_exercises_from_excel(nil, _attributes, _course_id, _created_by_id, _tenant) do
    {:error, "Excel file is required"}
  end

  defp import_exercises_from_excel(excel_file, attributes, course_id, created_by_id, tenant)
       when is_binary(excel_file) and is_list(attributes) do
    Logger.info("Starting Excel import for exercises with attributes: #{inspect(attributes)}")

    Logger.info(
      "Course ID: #{inspect(course_id)}, Created By: #{inspect(created_by_id)}, Tenant: #{inspect(tenant)}"
    )

    case KgEdu.ExcelImport.import_from_excel(excel_file, attributes) do
      {:ok, exercise_data} ->
        Logger.info(
          "Successfully parsed Excel file, got #{length(exercise_data)} exercise records"
        )

        if length(exercise_data) > 0 do
          Logger.info("Sample exercise data: #{inspect(hd(exercise_data))}")
        end

        process_and_create_exercises(exercise_data, course_id, created_by_id, tenant)

      {:error, reason} ->
        Logger.error("Failed to import Excel file: #{inspect(reason)}")
        {:error, "Failed to import Excel file: #{reason}"}
    end
  end

  defp import_exercises_from_excel(_, _, _, _, _) do
    {:error, "Invalid parameters"}
  end

  defp process_and_create_exercises(exercise_data, course_id, created_by_id, tenant)
       when is_list(exercise_data) do
    # First, get all existing exercise titles in the same course to detect duplicates
    existing_titles = get_existing_exercise_titles(course_id, tenant)

    # Get current max position for this course
    max_position = get_max_position(course_id, tenant)

    # Process each exercise and track results
    results =
      exercise_data
      |> Enum.with_index()
      |> Enum.map(fn {exercise_map, index} ->
        # 计算新习题的 position：max_position + index + 1
        position = max_position + index + 1

        process_single_exercise(
          exercise_map,
          index,
          course_id,
          created_by_id,
          tenant,
          existing_titles,
          position
        )
      end)

    # Categorize results
    {successful, rest} = Enum.split_with(results, &match?({:ok, %{status: :success}}, &1))
    {skipped, failed} = Enum.split_with(rest, &match?({:ok, %{status: :skipped}}, &1))

    # Build summary
    successful_exercises = Enum.map(successful, fn {:ok, result} -> result.exercise end)
    skipped_exercises = Enum.map(skipped, fn {:ok, result} -> result.exercise end)
    failed_exercises = Enum.map(failed, fn {:error, result} -> result end)

    summary = %{
      total: length(exercise_data),
      success: length(successful_exercises),
      failed: length(failed_exercises),
      skipped: length(skipped_exercises)
    }

    Logger.info(
      "Import completed: #{summary.success} successful, #{summary.failed} failed, #{summary.skipped} skipped"
    )

    {:ok,
     %{
       summary: summary,
       successful: successful_exercises,
       failed: failed_exercises,
       skipped: skipped_exercises
     }}
  end

  defp get_existing_exercise_titles(course_id, tenant) do
    case Ash.read(KgEdu.Knowledge.Exercise, tenant: tenant) do
      {:ok, exercises} ->
        # Filter by course_id and create a map of title -> true for O(1) lookup
        exercises
        |> Enum.filter(fn e -> e.course_id == course_id end)
        |> Enum.map(fn e -> {String.downcase(e.title), true} end)
        |> Map.new()

      {:error, reason} ->
        Logger.warning("Failed to read existing exercises: #{inspect(reason)}")
        %{}
    end
  end

  defp process_single_exercise(
         exercise_map,
         index,
         course_id,
         created_by_id,
         tenant,
         existing_titles,
         position
       ) do
    # Transform values to strings
    exercise_map = transform_values_to_string(exercise_map)

    # Validate required fields
    case validate_exercise_fields(exercise_map) do
      :ok ->
        # Check for duplicate title
        title = exercise_map[:title]
        title_key = String.downcase(title)

        if Map.has_key?(existing_titles, title_key) do
          Logger.info("Skipping exercise with duplicate title: #{title}")
          {:ok, %{status: :skipped, exercise: %{title: title, reason: "标题重复"}}}
        else
          # Create the exercise
          create_exercise(
            exercise_map,
            course_id,
            created_by_id,
            tenant,
            title,
            title_key,
            existing_titles,
            position
          )
        end

      {:error, error_message} ->
        Logger.warning("Exercise validation failed: #{error_message}")

        {:error,
         %{
           index: index + 1,
           title: exercise_map[:title] || "未知",
           reason: error_message
         }}
    end
  end

  defp create_exercise(
         exercise_map,
         course_id,
         created_by_id,
         tenant,
         title,
         title_key,
         existing_titles,
         position
       ) do
    # Process exercise data
    processed_map =
      exercise_map
      |> Map.put(:course_id, course_id)
      |> Map.put(:created_by_id, created_by_id)
      |> Map.put(:ai_type, :manual_import)
      |> Map.put(:position, position)
      |> process_question_type()
      |> process_options()
      |> process_difficulty()

    # Debug: Log the processed map to check if answer_explanation is present
    Logger.info("Creating exercise with processed_map: #{inspect(processed_map, pretty: true)}")

    # Add to existing_titles to prevent duplicates within the same import
    _updated_titles = Map.put(existing_titles, title_key, true)

    case KgEdu.Knowledge.Exercise.create_exercise(processed_map, tenant: tenant) do
      {:ok, exercise} ->
        Logger.info("Successfully created exercise: #{title}")
        {:ok, %{status: :success, exercise: %{id: exercise.id, title: exercise.title}}}

      {:error, reason} ->
        Logger.error("Failed to create exercise #{title}: #{inspect(reason)}")

        {:error,
         %{
           index: 0,
           title: title,
           reason: format_error(reason)
         }}
    end
  end

  defp validate_exercise_fields(exercise_map) do
    errors = []

    # Validate title
    errors =
      case exercise_map[:title] do
        title when is_binary(title) and byte_size(title) >= 3 ->
          errors

        title when is_binary(title) ->
          ["标题长度至少3个字符" | errors]

        _ ->
          ["标题是必填字段" | errors]
      end

    # Validate question_content
    errors =
      case exercise_map[:question_content] do
        content when is_binary(content) and byte_size(content) > 0 ->
          errors

        _ ->
          ["题目内容是必填字段" | errors]
      end

    # Validate answer
    errors =
      case exercise_map[:answer] do
        answer when is_binary(answer) and byte_size(answer) > 0 ->
          errors

        _ ->
          ["答案是必填字段" | errors]
      end

    case errors do
      [] -> :ok
      _ -> {:error, Enum.join(errors, "; ")}
    end
  end

  defp process_question_type(exercise_map) do
    question_type =
      case exercise_map[:question_type] do
        type
        when type in ["multiple_choice", :multiple_choice, "multiple choice", "选择题", "1", 1] ->
          :multiple_choice

        type when type in ["essay", :essay, "essay", "简答题", "论述题", "问答题", "2", 2] ->
          :essay

        type
        when type in ["fill_in_blank", :fill_in_blank, "fill in blank", "填空题", "填空", "3", 3] ->
          :fill_in_blank

        _ ->
          :essay
      end

    Map.put(exercise_map, :question_type, question_type)
  end

  defp process_options(exercise_map) do
    # 只有选择题才需要处理 options，其他题型的 options 应该为空
    question_type = exercise_map[:question_type]
    answer = exercise_map[:answer]

    processed_options =
      if question_type == :multiple_choice do
        options = exercise_map[:options]

        case options do
          nil ->
            nil

          opts when is_binary(opts) ->
            # 空字符串或纯空白字符串返回 nil
            if String.trim(opts) == "" do
              nil
            else
              try do
                decoded = Jason.decode!(opts)
                # 如果是 JSON 格式，确保有 choices 和 correctAnswer
                ensure_choices_format(decoded, answer)
              rescue
                _ ->
                  # Try to parse as text format: "A. Option 1\nB. Option 2"
                  parse_options_to_choices_format(opts, answer)
              end
            end

          opts when is_map(opts) ->
            ensure_choices_format(opts, answer)

          _ ->
            nil
        end
      else
        # 非选择题，options 应该为空
        nil
      end

    Map.put(exercise_map, :options, processed_options)
  end

  # 确保 options 是正确的 choices 格式，并从 answer 解析正确答案
  defp ensure_choices_format(opts, answer) when is_map(opts) do
    # 如果已经有 choices 格式，只需要更新 correctAnswer
    if Map.has_key?(opts, "choices") and is_list(opts["choices"]) do
      correct_answer = parse_answer_index(answer)
      Map.put(opts, "correctAnswer", correct_answer)
    else
      # 可能是 {"A": "内容", "B": "内容"} 格式，转换为 choices 格式
      choices =
        ["A", "B", "C", "D"]
        |> Enum.map(fn key -> Map.get(opts, key, "") end)

      correct_answer = parse_answer_index(answer)
      %{"choices" => choices, "correctAnswer" => correct_answer}
    end
  end

  defp ensure_choices_format(opts, _answer), do: opts

  # 从 answer 字段解析正确答案索引
  defp parse_answer_index(answer) do
    case answer do
      a when a in ["A", "a", "1", 1] -> 0
      a when a in ["B", "b", "2", 2] -> 1
      a when a in ["C", "c", "3", 3] -> 2
      a when a in ["D", "d", "4", 4] -> 3
      # 默认第一个
      _ -> 0
    end
  end

  # 解析文本格式的选项，支持多行
  # 格式示例：
  # A. 选项A内容
  # B. 选项B内容（可以
  # 跨行）
  # C. 选项C内容
  # D. 选项D内容
  #
  # 输出格式：{"choices": ["选项A", "选项B", "选项C", "选项D"], "correctAnswer": 0}
  # 从 answer 字段解析正确答案索引（如 "A" -> 0, "B" -> 1, "C" -> 2, "D" -> 3）
  defp parse_options_to_choices_format(opts_string, answer) do
    # 正则匹配：行首（可能有空格）+ 字母 + 点号 + 可能有空格 + 内容
    pattern = ~r/^\s*([A-Za-z])\.\s*(.*)$/

    lines = String.split(opts_string, "\n")

    {options_map, current_key, current_content} =
      Enum.reduce(lines, {%{}, nil, ""}, fn line, {acc, key, content} ->
        case Regex.run(pattern, line) do
          [_, new_key, new_content] ->
            # 新选项开始，先保存之前的选项
            new_acc =
              if key do
                Map.put(acc, String.upcase(key), String.trim(content))
              else
                acc
              end

            {new_acc, String.upcase(new_key), new_content}

          nil ->
            # 非选项行，追加到当前选项（支持多行）
            if key do
              new_content =
                if content == "" do
                  line
                else
                  "#{content}\n#{line}"
                end

              {acc, key, new_content}
            else
              # 还没有遇到任何选项标识，忽略
              {acc, key, content}
            end
        end
      end)

    # 保存最后一个选项
    options_map =
      if current_key && current_content != "" do
        Map.put(options_map, String.upcase(current_key), String.trim(current_content))
      else
        options_map
      end

    # 转换为 choices 格式
    choices =
      ["A", "B", "C", "D"]
      |> Enum.map(fn key -> Map.get(options_map, key, "") end)

    # 从 answer 字段解析正确答案索引
    correct_answer = parse_answer_index(answer)

    %{"choices" => choices, "correctAnswer" => correct_answer}
  end

  defp process_difficulty(exercise_map) do
    difficulty =
      case exercise_map[:difficulty] do
        d when d in [1, "1", "简单", "easy"] ->
          1

        d when d in [2, "2", "中等", "medium"] ->
          2

        d when d in [3, "3", "困难", "hard"] ->
          3

        _ ->
          nil
      end

    Map.put(exercise_map, :difficulty, difficulty)
  end

  defp format_error(reason) when is_binary(reason), do: reason

  defp format_error(%Ash.Error.Changes.InvalidAttribute{
         field: field,
         message: message,
         vars: vars
       }) do
    formatted_message = interpolate_message(message, vars)
    "#{field}: #{formatted_message}"
  end

  defp format_error(%Ash.Error.Invalid{errors: errors}) when is_list(errors) do
    errors
    |> Enum.map(&format_error/1)
    |> Enum.join("; ")
  end

  defp format_error(reason) do
    # Extract first error message if it's a changeset-like error
    case reason do
      %{errors: errors} when is_list(errors) ->
        errors
        |> Enum.map(fn
          {field, {message, _}} -> "#{field}: #{message}"
          %Ash.Error.Changes.InvalidAttribute{} = e -> format_error(e)
          e -> inspect(e)
        end)
        |> Enum.join("; ")

      _ ->
        inspect(reason)
    end
  end

  defp interpolate_message(message, vars) do
    Enum.reduce(vars || [], message, fn {key, value}, acc ->
      String.replace(acc, "%{#{key}}", to_string(value))
    end)
  end

  defp transform_values_to_string(map) when is_map(map) do
    map
    |> Enum.map(fn {key, value} ->
      transformed_value =
        if is_map(value) do
          transform_values_to_string(value)
        else
          to_string(value || "")
        end

      {key, transformed_value}
    end)
    |> Enum.into(%{})
  end

  defp get_max_position(course_id, tenant) do
    require Ash.Query

    KgEdu.Knowledge.Exercise
    |> Ash.Query.filter(course_id == ^course_id)
    |> Ash.Query.select([:position])
    |> Ash.Query.sort(position: :desc)
    |> Ash.Query.limit(1)
    |> Ash.read_one(tenant: tenant, authorize?: false)
    |> case do
      {:ok, nil} -> 0
      {:ok, exercise} -> exercise.position || 0
      {:error, _} -> 0
    end
  end
end
