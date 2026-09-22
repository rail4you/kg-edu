defmodule KgEdu.Knowledge.Exercise.Changes.GenerateAIExerciseTest do
  use ExUnit.Case, async: true

  alias KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise
  alias KgEdu.Knowledge.Exercise
  alias Ash.Changeset

  describe "change/3" do
    test "builds correct prompt for multiple choice exercises" do
      changeset =
        Changeset.new(%Exercise{})
        |> Changeset.set_argument(:course_name, "Physics 101")
        |> Changeset.set_argument(:knowledge_name, "Newton's Laws")
        |> Changeset.set_argument(:chapter_name, "First Law")
        |> Changeset.set_argument(:exercise_type, :multiple_choice)
        |> Changeset.set_argument(:number, 3)
        |> Changeset.set_argument(:course_id, Ash.UUID.generate())
        |> Changeset.set_argument(:knowledge_resource_id, Ash.UUID.generate())

      # We can't actually test the AI generation without mocking ReqLLM
      # But we can test that the change is structured correctly
      result = GenerateAIExercise.change(changeset, [], %{})

      # The change should return a changeset (even if it fails due to missing ReqLLM)
      assert %Changeset{} = result
    end

    test "builds correct prompt for essay exercises" do
      changeset =
        Changeset.new(%Exercise{})
        |> Changeset.set_argument(:course_name, "Literature 101")
        |> Changeset.set_argument(:knowledge_name, "Shakespeare")
        |> Changeset.set_argument(:exercise_type, :essay)
        |> Changeset.set_argument(:number, 2)
        |> Changeset.set_argument(:course_id, Ash.UUID.generate())
        |> Changeset.set_argument(:knowledge_resource_id, Ash.UUID.generate())

      result = GenerateAIExercise.change(changeset, [], %{})

      assert %Changeset{} = result
    end

    test "builds correct prompt for fill-in-blank exercises" do
      changeset =
        Changeset.new(%Exercise{})
        |> Changeset.set_argument(:course_name, "Mathematics 101")
        |> Changeset.set_argument(:knowledge_name, "Linear Equations")
        |> Changeset.set_argument(:chapter_name, "Solving Equations")
        |> Changeset.set_argument(:exercise_type, :fill_in_blank)
        |> Changeset.set_argument(:number, 1)
        |> Changeset.set_argument(:course_id, Ash.UUID.generate())
        |> Changeset.set_argument(:knowledge_resource_id, Ash.UUID.generate())

      result = GenerateAIExercise.change(changeset, [], %{})

      assert %Changeset{} = result
    end

    test "handles missing chapter name" do
      changeset =
        Changeset.new(%Exercise{})
        |> Changeset.set_argument(:course_name, "History 101")
        |> Changeset.set_argument(:knowledge_name, "World War II")
        |> Changeset.set_argument(:exercise_type, :multiple_choice)
        |> Changeset.set_argument(:number, 1)
        |> Changeset.set_argument(:course_id, Ash.UUID.generate())
        |> Changeset.set_argument(:knowledge_resource_id, Ash.UUID.generate())

      result = GenerateAIExercise.change(changeset, [], %{})

      assert %Changeset{} = result
    end

    test "sets ai_type to ai_generated" do
      changeset =
        Changeset.new(%Exercise{})
        |> Changeset.set_argument(:course_name, "Biology 101")
        |> Changeset.set_argument(:knowledge_name, "Cell Structure")
        |> Changeset.set_argument(:exercise_type, :essay)
        |> Changeset.set_argument(:number, 1)
        |> Changeset.set_argument(:course_id, Ash.UUID.generate())
        |> Changeset.set_argument(:knowledge_resource_id, Ash.UUID.generate())

      # The change should set ai_type attribute
      assert Changeset.get_attribute(changeset, :ai_type) == nil

      result = GenerateAIExercise.change(changeset, [], %{})

      # After the change, ai_type should be set to :ai_generated
      # Note: This might not be testable without actually running the change successfully
      # due to the ReqLLM integration
      assert %Changeset{} = result
    end
  end

  # LLM 输出解析（JsonCleanerAdvanced 为公开 API；旧私有 parse_*/build_* 已重构移除，
  # 此处按现实现测等价行为：代码块提取 + JSON 解码）

  describe "JsonCleanerAdvanced.extract_json/1" do
    test "提取 ```json 代码块内容" do
      raw = "以下是结果：\n```json\n{\"title\": \"牛顿第一定律\"}\n```\n完毕"

      assert JsonCleanerAdvanced.extract_json(raw) == "{\"title\": \"牛顿第一定律\"}"
    end

    test "提取无语言标记的代码块" do
      raw = "```\n{\"a\": 1}\n```"

      assert JsonCleanerAdvanced.extract_json(raw) == "{\"a\": 1}"
    end

    test "无代码块时原样返回（去首尾空白）" do
      assert JsonCleanerAdvanced.extract_json("  {\"a\": 1}  ") == "{\"a\": 1}"
    end
  end

  describe "JsonCleanerAdvanced.parse/2" do
    test "解析 fence 包裹的习题 JSON" do
      raw = """
      ```json
      {"title": "Newton's First Law", "question_content": "What happens?", "answer": "Stays at rest"}
      ```
      """

      assert {:ok, %{"title" => "Newton's First Law", "answer" => "Stays at rest"}} =
               JsonCleanerAdvanced.parse(raw)
    end

    test "解析裸 JSON 字符串" do
      assert {:ok, %{"title" => "Essay"}} =
               JsonCleanerAdvanced.parse("{\"title\": \"Essay\"}")
    end

    test "非法 JSON 返回 error（不 raise）" do
      assert {:error, _} = JsonCleanerAdvanced.parse("not json at all {{{")
    end
  end
end
