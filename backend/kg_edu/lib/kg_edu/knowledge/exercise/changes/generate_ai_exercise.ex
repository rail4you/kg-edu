defmodule JsonCleanerAdvanced do
  @doc """
  更健壮的 JSON 提取，处理各种边界情况
  """
  def extract_json(raw_string) do
    # 匹配 ```json 或 ``` 开始，到 ``` 结束之间的内容
    case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, raw_string, capture: :all_but_first) do
      [json_content] -> String.trim(json_content)
      nil -> String.trim(raw_string)  # 如果没有代码块标记，返回原字符串
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

        # Generate the exercise prompt
        prompt = build_exercise_prompt(course_name, knowledge_name, chapter_name, exercise_type, number)

        case generate_exercise_content(prompt, exercise_type) do
          {:ok, exercise_data} ->
            # Set the generated content
            changeset
            |> Ash.Changeset.change_attribute(:title, exercise_data.title)
            |> Ash.Changeset.change_attribute(:question_content, exercise_data.question_content)
            |> Ash.Changeset.change_attribute(:answer, exercise_data.answer)
            |> Ash.Changeset.change_attribute(:question_type, exercise_type)
            |> Ash.Changeset.change_attribute(:options, exercise_data.options)

          {:error, reason} ->
            Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
              field: :question_content,
              message: "Failed to generate exercise: #{inspect(reason)}"
            })
        end

      {:error, _reason} ->
        Ash.Changeset.add_error(changeset, %Ash.Error.Changes.InvalidAttribute{
          field: :course_name,
          message: "Course not found: #{course_name}"
        })
    end
  end

  defp build_exercise_prompt(course_name, knowledge_name, chapter_name, exercise_type, number) do
    context_parts = [
      "Course: #{course_name}",
      "Knowledge topic: #{knowledge_name}"
    ]

    context_parts = if chapter_name do
      context_parts ++ ["Chapter: #{chapter_name}"]
    else
      context_parts
    end

    context = Enum.join(context_parts, ", ")

    exercise_type_description = case exercise_type do
      :multiple_choice -> "multiple choice questions with 4 options (A, B, C, D) and indicate the correct answer"
      :essay -> "essay questions with detailed answer guidelines"
      :fill_in_blank -> "fill-in-the-blank questions with the correct answers"
    end

    """
    You are an educational content expert. Please create #{number} #{exercise_type_description} based on the following context:

    #{context}

    Please ensure the exercises are:
    - Age-appropriate and challenging
    - Relevant to the topic
    - Clear and well-structured
    - For multiple choice: provide 4 distinct options with only one correct answer
    - For essays: provide comprehensive answer guidelines
    - For fill-in-blank: provide clear sentences with specific blanks to fill

    Please respond with a JSON object with these fields:
    {
      "title": "A descriptive title for the exercise",
      "question_content": "The question text",
      "answer": "The correct answer or answer guidelines"
    }

    For multiple choice questions, also include these fields:
    {
      "option_a": "Text for option A",
      "option_b": "Text for option B",
      "option_c": "Text for option C",
      "option_d": "Text for option D"
    }

    For essay and fill-in-blank questions, only provide the title, question_content, and answer fields.
    use chinese for the content.
    您应该始终遵循指令并输出一个有效的JSON对象。请根据指令使用指定的JSON对象结构。确保始终以 "```" 结束代码块，以指示JSON对象的结束。
    """
  end

  defp generate_exercise_content(prompt, exercise_type) do
    # Get ReqLLM configuration
    config = Application.get_env(:kg_edu, :reqllm)
    model = config[:model] || "openrouter:z-ai/glm-4.5"

    # Define schema for structured output
    schema = build_exercise_schema(exercise_type)
    Logger.info("Using schema: #{inspect(schema)}, prompt: #{prompt}")
    # Generate structured object
    case ReqLLM.generate_text(model, prompt) do
      {:ok, response} ->
        {:ok, object} = ReqLLM.Response.text(response) |> JsonCleanerAdvanced.parse(keys: :atoms)
        Logger.info("Generated exercise object: #{inspect(object)}")
        case parse_structured_exercise(object, exercise_type) do

          {:ok, exercise_data} -> {:ok, exercise_data}
          {:error, reason} -> {:error, reason}
        end

      {:error, reason} ->
        {:error, reason}

      _ ->
        {:error, "Unexpected error during exercise generation"}
    end
  end

  defp build_exercise_schema(exercise_type) do
    case exercise_type do
      :multiple_choice ->
        [
          title: [type: :string, required: true],
          question_content: [type: :string, required: true],
          answer: [type: :string, required: true],
          option_a: [type: :string, required: true],
          option_b: [type: :string, required: true],
          option_c: [type: :string, required: true],
          option_d: [type: :string, required: true]
        ]

      :essay ->
        [
          title: [type: :string, required: true],
          question_content: [type: :string, required: true],
          answer: [type: :string, required: true]
        ]

      :fill_in_blank ->
        [
          title: [type: :string, required: true],
          question_content: [type: :string, required: true],
          answer: [type: :string, required: true]
        ]
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
        # Build options map from flat fields
        options = %{
          A: object.option_a,
          B: object.option_b,
          C: object.option_c,
          D: object.option_d
        }

        # Only return options if all are non-empty
        if Enum.all?(options, fn {_key, value} -> value != "" end) do
          options
        else
          nil
        end

      _ ->
        # For essay and fill-in-blank, options should be null
        nil
    end
  end
end
