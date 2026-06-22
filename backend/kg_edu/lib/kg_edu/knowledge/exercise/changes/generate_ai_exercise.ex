defmodule JsonCleanerAdvanced do
  @doc """
  更健壮的 JSON 提取，处理各种边界情况
  """
  def extract_json(raw_string) do
    # 匹配 ```json 或 ``` 开始，到 ``` 结束之间的内容
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, raw_string, capture: :all_but_first) do
      [json_content] -> String.trim(json_content)
      # 如果没有代码块标记，返回原字符串
      nil -> String.trim(raw_string)
    end
  end

  def parse(raw_string, opts \\ []) do
    raw_string
    |> extract_json()
    |> Jason.decode(opts)
  end
end

defmodule KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise do
  @moduledoc """
  Generate AI exercises using ReqLLM based on course, knowledge, chapter, and exercise type.
  """
  use Ash.Resource.Change
  require Logger

  def change(changeset, _opts, _context) do
    course_name = Ash.Changeset.get_argument(changeset, :course_name)
    knowledge_name = Ash.Changeset.get_argument(changeset, :knowledge_name)
    chapter_name = Ash.Changeset.get_argument(changeset, :chapter_name)
    exercise_type = Ash.Changeset.get_argument(changeset, :exercise_type)
    number = Ash.Changeset.get_argument(changeset, :number)

    # Find course by name and set course_id
    case KgEdu.Courses.Course.get_course_by_title(%{title: course_name}) do
      {:ok, course} ->
        # Set the course_id
        changeset = Ash.Changeset.change_attribute(changeset, :course_id, course.id)

        # Generate multiple exercises
        case generate_multiple_exercises(
               course_name,
               knowledge_name,
               chapter_name,
               exercise_type,
               number
             ) do
          {:ok, exercises_data} ->
            # Create database records for all generated exercises
            exercises_with_metadata =
              Enum.map(exercises_data, fn exercise_data ->
                Map.merge(exercise_data, %{
                  course_id: course.id,
                  question_type: exercise_type
                })
              end)

            # Store exercises in changeset metadata for later processing
            changeset
            |> Ash.Changeset.put_context(:generated_exercises, exercises_with_metadata)

          {:error, reason} ->
            Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
              field: :question_content,
              message: "Failed to generate exercises: #{inspect(reason)}"
            })
        end

      {:error, _reason} ->
        Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
          field: :course_name,
          message: "Course not found: #{course_name}"
        })
    end
  end

  defp build_exercise_prompt(course_name, knowledge_name, chapter_name, exercise_type) do
    context_parts = [
      "Course: #{course_name}",
      "Knowledge topic: #{knowledge_name}"
    ]

    context_parts =
      if chapter_name do
        context_parts ++ ["Chapter: #{chapter_name}"]
      else
        context_parts
      end

    context = Enum.join(context_parts, ", ")

    exercise_type_description =
      case exercise_type do
        :multiple_choice ->
          "multiple choice questions with 4 options (A, B, C, D) and indicate the correct answer"

        :multiple_response ->
          "multiple response questions with 4 options (A, B, C, D) where 2 or more answers are correct"

        :true_false ->
          "true/false questions with a statement to judge as correct or incorrect"

        :fill_in_blank ->
          "fill-in-the-blank questions with the correct answers"

        :essay ->
          "essay questions with detailed answer guidelines"

        :term_definition ->
          "term definition questions: given a term, provide its definition and explanation"

        :case_study ->
          "case study questions: given a scenario, provide comprehensive analysis"
      end

    """
    You are an educational content expert. Please create one #{exercise_type_description} based on the following context:

    #{context}

    Please ensure the exercise is:
    - Age-appropriate and challenging
    - Relevant to the topic
    - Clear and well-structured
    - For multiple choice: provide 4 distinct options with only one correct answer
    - For multiple response: provide 4 options with 2 or more correct answers
    - For true/false: provide a clear statement that is either correct or incorrect
    - For essays: provide comprehensive answer guidelines
    - For fill-in-blank: provide clear sentences with specific blanks to fill
    - For term definition: provide a professional term and its complete definition
    - For case study: provide a realistic scenario and analysis requirements

    Please respond with a JSON object with these fields:
    {
      "title": "A descriptive title for the exercise",
      "question_content": "The question text",
      "answer": "The correct answer or answer guidelines"
    }

    For multiple choice and multiple response questions, also include these fields:
    {
      "option_a": "Text for option A",
      "option_b": "Text for option B",
      "option_c": "Text for option C",
      "option_d": "Text for option D"
    }

    For multiple response questions, the answer field should list all correct option letters (e.g., "A,C" or "A,B,D").

    For true/false questions, the answer should be "A" for correct (正确) or "B" for incorrect (错误).

    For essay, fill-in-blank, term definition, and case study questions, only provide the title, question_content, and answer fields.
    use chinese for the content.
    您应该始终遵循指令并输出一个有效的JSON对象。请根据指令使用指定的JSON对象结构。确保始终以 "```" 结束代码块，以指示JSON对象的结束。
    """
  end

  def generate_multiple_exercises(
        course_name,
        knowledge_name,
        chapter_name,
        exercise_type,
        number
      ) do
    Logger.info("Generating #{number} exercises of type #{exercise_type}")

    try do
      exercises =
        Enum.map(1..number, fn _index ->
          prompt = build_exercise_prompt(course_name, knowledge_name, chapter_name, exercise_type)

          case generate_exercise_content(prompt, exercise_type) do
            {:ok, exercise_data} ->
              exercise_data

            {:error, reason} ->
              Logger.error("Failed to generate exercise: #{inspect(reason)}")
              nil
          end
        end)
        |> Enum.filter(&(&1 != nil))

      if length(exercises) > 0 do
        {:ok, exercises}
      else
        {:error, "Failed to generate any exercises"}
      end
    rescue
      e ->
        {:error, "Error generating exercises: #{inspect(e)}"}
    end
  end

  defp generate_exercise_content(prompt, exercise_type) do
    config = Application.get_env(:kg_edu, :reqllm)
    model = config[:model] || "alibaba_cn:qwen-plus"

    # Load Qwen API key from database before every call
    KgEdu.Agent.ApiKeyProvider.ensure_key()

    case ReqLLM.generate_text(model, prompt) do
      {:ok, response} ->
        {:ok, object} = ReqLLM.Response.text(response) |> JsonCleanerAdvanced.parse(keys: :atoms)
        Logger.info("Generated exercise object: #{inspect(object)}")

        case parse_structured_exercise(object, exercise_type) do
          {:ok, exercise_data} -> {:ok, exercise_data}
          {:error, reason} -> {:error, reason}
        end

      {:error, %ReqLLM.Error.API.Request{} = err} ->
        msg = get_in(err.response_body, ["error", "message"]) || "请求失败"
        {:error, "AI 服务调用失败 (#{err.status}): #{msg}"}

      {:error, %ReqLLM.Error.API.Response{} = err} ->
        msg = get_in(err.response_body, ["error", "message"]) || "响应异常"
        {:error, "AI 服务响应失败 (#{err.status}): #{msg}"}

      {:error, reason} ->
        {:error, "AI 服务调用失败: #{inspect(reason)}"}

      _ ->
        {:error, "AI 服务调用失败，请检查 API Key 配置"}
    end
  end

  defp build_exercise_schema(exercise_type) do
    base_schema = [
      title: [type: :string, required: true],
      question_content: [type: :string, required: true],
      answer: [type: :string, required: true]
    ]

    case exercise_type do
      type when type in [:multiple_choice, :multiple_response] ->
        base_schema ++
          [
            option_a: [type: :string, required: true],
            option_b: [type: :string, required: true],
            option_c: [type: :string, required: true],
            option_d: [type: :string, required: true]
          ]

      :true_false ->
        base_schema

      _ ->
        base_schema
    end
  end

  defp parse_structured_exercise(object, exercise_type) do
    try do
      exercise_data = %{
        title: object.title,
        question_content: object.question_content,
        answer: object.answer,
        options: parse_structured_options(object, exercise_type)
      }

      Logger.info("exercise_data is #{inspect(exercise_data)}")
      {:ok, exercise_data}
    rescue
      e ->
        {:error, "Failed to parse structured exercise: #{inspect(e)}"}
    end
  end

  defp parse_structured_options(object, exercise_type) do
    case exercise_type do
      :multiple_choice ->
        options = %{
          A: object.option_a,
          B: object.option_b,
          C: object.option_c,
          D: object.option_d
        }

        if Enum.all?(options, fn {_key, value} -> value != "" end) do
          options
        else
          nil
        end

      :multiple_response ->
        options = %{
          A: object.option_a,
          B: object.option_b,
          C: object.option_c,
          D: object.option_d
        }

        if Enum.all?(options, fn {_key, value} -> value != "" end) do
          answer_str = object.answer || ""

          correct_letters =
            answer_str
            |> String.split(~r/[,，\s]+/, trim: true)
            |> Enum.map(&String.trim/1)
            |> Enum.map(&String.upcase/1)
            |> Enum.filter(&(&1 in ["A", "B", "C", "D"]))

          correct_indices =
            correct_letters
            |> Enum.map(fn l -> (l |> String.to_charlist() |> hd()) - 65 end)

          Map.put(options, :correctAnswers, correct_indices)
        else
          nil
        end

      :true_false ->
        %{
          choices: ["A. 正确", "B. 错误"]
        }

      _ ->
        nil
    end
  end

  def create_exercise_records(changeset) do
    case Map.get(changeset.context || %{}, :generated_exercises) do
      exercises when is_list(exercises) ->
        # Create exercise records in the database
        case create_multiple_exercises(exercises) do
          {:ok, created_exercises} ->
            Ash.Changeset.put_context(changeset, :created_exercises, created_exercises)

          {:error, reason} ->
            Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
              field: :question_content,
              message: "Failed to create exercise records: #{inspect(reason)}"
            })
        end

      :error ->
        changeset
    end
  end

  defp create_multiple_exercises(exercises) do
    # This would typically be called from a domain action or service
    # For now, we'll return the exercises data to be processed by the caller
    {:ok, exercises}
  end
end
