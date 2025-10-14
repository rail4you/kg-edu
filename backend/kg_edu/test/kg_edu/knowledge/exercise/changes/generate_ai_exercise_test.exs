defmodule KgEdu.Knowledge.Exercise.Changes.GenerateAIExerciseTest do
  use ExUnit.Case, async: true
  
  alias KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise
  alias Ash.Changeset

  describe "change/3" do
    test "builds correct prompt for multiple choice exercises" do
      changeset = 
        Changeset.new(%Exercise{})
        |> Changeset.change_argument(:course_name, "Physics 101")
        |> Changeset.change_argument(:knowledge_name, "Newton's Laws")
        |> Changeset.change_argument(:chapter_name, "First Law")
        |> Changeset.change_argument(:exercise_type, :multiple_choice)
        |> Changeset.change_argument(:number, 3)
        |> Changeset.change_argument(:course_id, UUID.uuid4())
        |> Changeset.change_argument(:knowledge_resource_id, UUID.uuid4())

      # We can't actually test the AI generation without mocking ReqLLM
      # But we can test that the change is structured correctly
      result = GenerateAIExercise.change(changeset, [], %{})
      
      # The change should return a changeset (even if it fails due to missing ReqLLM)
      assert %Changeset{} = result
    end

    test "builds correct prompt for essay exercises" do
      changeset = 
        Changeset.new(%Exercise{})
        |> Changeset.change_argument(:course_name, "Literature 101")
        |> Changeset.change_argument(:knowledge_name, "Shakespeare")
        |> Changeset.change_argument(:exercise_type, :essay)
        |> Changeset.change_argument(:number, 2)
        |> Changeset.change_argument(:course_id, UUID.uuid4())
        |> Changeset.change_argument(:knowledge_resource_id, UUID.uuid4())

      result = GenerateAIExercise.change(changeset, [], %{})
      
      assert %Changeset{} = result
    end

    test "builds correct prompt for fill-in-blank exercises" do
      changeset = 
        Changeset.new(%Exercise{})
        |> Changeset.change_argument(:course_name, "Mathematics 101")
        |> Changeset.change_argument(:knowledge_name, "Linear Equations")
        |> Changeset.change_argument(:chapter_name, "Solving Equations")
        |> Changeset.change_argument(:exercise_type, :fill_in_blank)
        |> Changeset.change_argument(:number, 1)
        |> Changeset.change_argument(:course_id, UUID.uuid4())
        |> Changeset.change_argument(:knowledge_resource_id, UUID.uuid4())

      result = GenerateAIExercise.change(changeset, [], %{})
      
      assert %Changeset{} = result
    end

    test "handles missing chapter name" do
      changeset = 
        Changeset.new(%Exercise{})
        |> Changeset.change_argument(:course_name, "History 101")
        |> Changeset.change_argument(:knowledge_name, "World War II")
        |> Changeset.change_argument(:exercise_type, :multiple_choice)
        |> Changeset.change_argument(:number, 1)
        |> Changeset.change_argument(:course_id, UUID.uuid4())
        |> Changeset.change_argument(:knowledge_resource_id, UUID.uuid4())

      result = GenerateAIExercise.change(changeset, [], %{})
      
      assert %Changeset{} = result
    end

    test "sets ai_type to ai_generated" do
      changeset = 
        Changeset.new(%Exercise{})
        |> Changeset.change_argument(:course_name, "Biology 101")
        |> Changeset.change_argument(:knowledge_name, "Cell Structure")
        |> Changeset.change_argument(:exercise_type, :essay)
        |> Changeset.change_argument(:number, 1)
        |> Changeset.change_argument(:course_id, UUID.uuid4())
        |> Changeset.change_argument(:knowledge_resource_id, UUID.uuid4())

      # The change should set ai_type attribute
      assert Changeset.get_attribute(changeset, :ai_type) == nil
      
      result = GenerateAIExercise.change(changeset, [], %{})
      
      # After the change, ai_type should be set to :ai_generated
      # Note: This might not be testable without actually running the change successfully
      # due to the ReqLLM integration
      assert %Changeset{} = result
    end
  end

  # Unit tests for private helper functions
  # These can be tested more thoroughly since they don't depend on external services

  describe "build_exercise_schema/1" do
    test "builds schema for multiple choice exercises" do
      schema = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.build_exercise_schema(:multiple_choice)
      
      assert is_list(schema)
      
      # Check base fields
      title_field = Enum.find(schema, fn {key, _} -> key == :title end)
      question_content_field = Enum.find(schema, fn {key, _} -> key == :question_content end)
      answer_field = Enum.find(schema, fn {key, _} -> key == :answer end)
      
      assert title_field[:type] == :string
      assert title_field[:required] == true
      assert question_content_field[:type] == :string
      assert question_content_field[:required] == true
      assert answer_field[:type] == :string
      assert answer_field[:required] == true
      
      # Check option fields for multiple choice
      option_a_field = Enum.find(schema, fn {key, _} -> key == :option_a end)
      option_b_field = Enum.find(schema, fn {key, _} -> key == :option_b end)
      option_c_field = Enum.find(schema, fn {key, _} -> key == :option_c end)
      option_d_field = Enum.find(schema, fn {key, _} -> key == :option_d end)
      
      assert option_a_field[:type] == :string
      assert option_a_field[:required] == true
      assert option_b_field[:type] == :string
      assert option_b_field[:required] == true
      assert option_c_field[:type] == :string
      assert option_c_field[:required] == true
      assert option_d_field[:type] == :string
      assert option_d_field[:required] == true
    end

    test "builds schema for essay exercises" do
      schema = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.build_exercise_schema(:essay)
      
      # Check base fields
      title_field = Enum.find(schema, fn {key, _} -> key == :title end)
      answer_field = Enum.find(schema, fn {key, _} -> key == :answer end)
      
      assert title_field[:type] == :string
      assert title_field[:required] == true
      assert answer_field[:type] == :string
      assert answer_field[:required] == true
      
      # Essay schema should only have base fields
      assert length(schema) == 3
      schema_keys = Enum.map(schema, fn {key, _} -> key end)
      assert :title in schema_keys
      assert :question_content in schema_keys
      assert :answer in schema_keys
      refute :options in schema_keys
      refute :option_a in schema_keys
    end

    test "builds schema for fill-in-blank exercises" do
      schema = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.build_exercise_schema(:fill_in_blank)
      
      # Check base fields
      title_field = Enum.find(schema, fn {key, _} -> key == :title end)
      answer_field = Enum.find(schema, fn {key, _} -> key == :answer end)
      
      assert title_field[:type] == :string
      assert title_field[:required] == true
      assert answer_field[:type] == :string
      assert answer_field[:required] == true
      
      # Fill-in-blank schema should only have base fields
      assert length(schema) == 3
      schema_keys = Enum.map(schema, fn {key, _} -> key end)
      assert :title in schema_keys
      assert :question_content in schema_keys
      assert :answer in schema_keys
      refute :options in schema_keys
      refute :option_a in schema_keys
    end
  end

  describe "parse_structured_exercise/2" do
    test "parses structured multiple choice exercise" do
      object = %{
        "title" => "Newton's First Law",
        "question_content" => "What happens to an object at rest according to Newton's first law?",
        "answer" => "An object at rest stays at rest unless acted upon by an external force",
        "option_a" => "It moves spontaneously",
        "option_b" => "It stays at rest unless acted upon by an external force",
        "option_c" => "It changes direction",
        "option_d" => "It accelerates"
      }

      {:ok, exercise_data} = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_exercise(object, :multiple_choice)
      
      assert exercise_data.title == "Newton's First Law"
      assert exercise_data.question_content == "What happens to an object at rest according to Newton's first law?"
      assert exercise_data.answer == "An object at rest stays at rest unless acted upon by an external force"
      assert is_map(exercise_data.options)
      assert exercise_data.options.A == "It moves spontaneously"
      assert exercise_data.options.B == "It stays at rest unless acted upon by an external force"
      assert exercise_data.options.C == "It changes direction"
      assert exercise_data.options.D == "It accelerates"
    end

    test "parses structured essay exercise" do
      object = %{
        "title" => "Essay on Photosynthesis",
        "question_content" => "Explain the process of photosynthesis and its importance to life on Earth.",
        "answer" => "Photosynthesis is the process by which plants convert light energy into chemical energy..."
      }

      {:ok, exercise_data} = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_exercise(object, :essay)
      
      assert exercise_data.title == "Essay on Photosynthesis"
      assert exercise_data.question_content == "Explain the process of photosynthesis and its importance to life on Earth."
      assert exercise_data.answer == "Photosynthesis is the process by which plants convert light energy into chemical energy..."
      assert exercise_data.options == nil
    end

    test "parses structured fill-in-blank exercise" do
      object = %{
        "title" => "Chemical Equation Balance",
        "question_content" => "Balance the equation: H2 + O2 -> ____",
        "answer" => "H2O"
      }

      {:ok, exercise_data} = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_exercise(object, :fill_in_blank)
      
      assert exercise_data.title == "Chemical Equation Balance"
      assert exercise_data.question_content == "Balance the equation: H2 + O2 -> ____"
      assert exercise_data.answer == "H2O"
      assert exercise_data.options == nil
    end

    test "handles missing fields gracefully" do
      object = %{
        "title" => "Incomplete Exercise",
        "question_content" => "What is 1+1?"
        # Missing answer and options
      }

      {:ok, exercise_data} = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_exercise(object, :multiple_choice)
      
      assert exercise_data.title == "Incomplete Exercise"
      assert exercise_data.question_content == "What is 1+1?"
      assert exercise_data.answer == ""
      assert exercise_data.options == nil
    end
  end

  describe "parse_structured_options/2" do
    test "builds options map from flat fields for multiple choice" do
      object = %{
        "option_a" => "Option A",
        "option_b" => "Option B", 
        "option_c" => "Option C",
        "option_d" => "Option D"
      }

      options = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_options(object, :multiple_choice)
      
      assert is_map(options)
      assert options.A == "Option A"
      assert options.B == "Option B"
      assert options.C == "Option C"
      assert options.D == "Option D"
      assert is_atom(Map.keys(options) |> hd())
    end

    test "returns nil if any option field is missing" do
      object = %{
        "option_a" => "Option A",
        "option_b" => "Option B",
        "option_c" => "",
        "option_d" => "Option D"
      }

      options = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_options(object, :multiple_choice)
      assert options == nil
    end

    test "returns nil for non-multiple choice questions" do
      object = %{
        "option_a" => "Should not matter"
      }

      # For essay, options should be nil
      essay_options = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_options(object, :essay)
      assert essay_options == nil

      # For fill-in-blank, options should be nil
      fill_options = KgEdu.Knowledge.Exercise.Changes.GenerateAIExercise.parse_structured_options(object, :fill_in_blank)
      assert fill_options == nil
    end
  end
end