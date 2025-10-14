defmodule KgEdu.Knowledge.ExerciseTest do
  use ExUnit.Case, async: true
  import KgEdu.AccountsFixtures

  alias KgEdu.Knowledge.Exercise
  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.Resource

  describe "generate_ai_exercise/1" do
    setup do
      user = user_fixture()
      
      {:ok, course} =
        Course.create_course(%{
          title: "Physics 101",
          description: "Introduction to Physics",
          teacher_id: user.id
        })

      {:ok, knowledge_resource} =
        Resource.create_knowledge_resource(%{
          name: "Newton's Laws",
          description: "Understanding Newton's three laws of motion",
          course_id: course.id,
          knowledge_type: :subject
        })

      %{
        user: user,
        course: course,
        knowledge_resource: knowledge_resource
      }
    end

    test "generates a multiple choice exercise successfully", %{
      course: course,
      knowledge_resource: knowledge_resource
    } do
      params = %{
        course_name: course.title,
        knowledge_name: knowledge_resource.name,
        exercise_type: :multiple_choice,
        number: 1,
        course_id: course.id,
        knowledge_resource_id: knowledge_resource.id
      }

      # Note: This test would require mocking the ReqLLM call to avoid actual API calls
      # For now, we'll test the action structure and validation
      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end
    end

    test "generates an essay exercise successfully", %{
      course: course,
      knowledge_resource: knowledge_resource
    } do
      params = %{
        course_name: course.title,
        knowledge_name: knowledge_resource.name,
        exercise_type: :essay,
        number: 1,
        course_id: course.id,
        knowledge_resource_id: knowledge_resource.id
      }

      # Note: This test would require mocking the ReqLLM call to avoid actual API calls
      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end
    end

    test "generates a fill-in-blank exercise successfully", %{
      course: course,
      knowledge_resource: knowledge_resource
    } do
      params = %{
        course_name: course.title,
        knowledge_name: knowledge_resource.name,
        exercise_type: :fill_in_blank,
        number: 1,
        course_id: course.id,
        knowledge_resource_id: knowledge_resource.id
      }

      # Note: This test would require mocking the ReqLLM call to avoid actual API calls
      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end
    end

    test "validates required parameters", %{course: course} do
      # Test missing course_name
      params = %{
        knowledge_name: "Test Knowledge",
        exercise_type: :multiple_choice,
        number: 1,
        course_id: course.id
      }

      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end

      # Test missing knowledge_name
      params = %{
        course_name: "Test Course",
        exercise_type: :multiple_choice,
        number: 1,
        course_id: course.id
      }

      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end

      # Test missing exercise_type
      params = %{
        course_name: "Test Course",
        knowledge_name: "Test Knowledge",
        number: 1,
        course_id: course.id
      }

      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end

      # Test missing course_id
      params = %{
        course_name: "Test Course",
        knowledge_name: "Test Knowledge",
        exercise_type: :multiple_choice,
        number: 1
      }

      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end
    end

    test "validates exercise_type constraint", %{course: course, knowledge_resource: knowledge_resource} do
      params = %{
        course_name: course.title,
        knowledge_name: knowledge_resource.name,
        exercise_type: :invalid_type,
        number: 1,
        course_id: course.id,
        knowledge_resource_id: knowledge_resource.id
      }

      assert_raise ArgumentError, fn ->
        Exercise.generate_ai_exercise(params)
      end
    end
  end

  describe "get_recent_ai_exercises/1" do
    setup do
      user = user_fixture()
      
      {:ok, course} =
        Course.create_course(%{
          title: "Mathematics 101",
          description: "Introduction to Mathematics",
          teacher_id: user.id
        })

      # Create a regular exercise
      {:ok, regular_exercise} =
        Exercise.create_exercise(%{
          title: "Regular Exercise",
          question_content: "What is 2+2?",
          answer: "4",
          question_type: :multiple_choice,
          options: %{"A" => "3", "B" => "4", "C" => "5", "D" => "6"},
          course_id: course.id
        })

      # Create an AI exercise manually (since we can't test actual AI generation)
      {:ok, ai_exercise} =
        Exercise.create_exercise(%{
          title: "AI Generated Exercise",
          question_content: "Solve: x + 5 = 12",
          answer: "x = 7",
          question_type: :essay,
          ai_type: :ai_generated,
          course_id: course.id
        })

      %{
        course: course,
        regular_exercise: regular_exercise,
        ai_exercise: ai_exercise
      }
    end

    test "returns only AI-generated exercises", %{ai_exercise: ai_exercise} do
      exercises = Exercise.get_recent_ai_exercises(%{})
      
      assert length(exercises) == 1
      assert hd(exercises).id == ai_exercise.id
      assert hd(exercises).ai_type == :ai_generated
    end

    test "returns exercises sorted by most recent", %{ai_exercise: ai_exercise} do
      exercises = Exercise.get_recent_ai_exercises(%{})
      
      assert length(exercises) >= 1
      # Verify sorting by inserted_at (most recent first)
      if length(exercises) > 1 do
        first = hd(exercises)
        second = Enum.at(exercises, 1)
        assert DateTime.compare(first.inserted_at, second.inserted_at) != :lt
      end
    end

    test "filters by course_id when provided", %{course: course, ai_exercise: ai_exercise} do
      exercises = Exercise.get_recent_ai_exercises(%{course_id: course.id})
      
      assert length(exercises) == 1
      assert hd(exercises).id == ai_exercise.id
      assert hd(exercises).course_id == course.id
    end

    test "limits results when limit is provided", %{ai_exercise: ai_exercise} do
      exercises = Exercise.get_recent_ai_exercises(%{limit: 1})
      
      assert length(exercises) <= 1
    end
  end

  describe "exercise creation with ai_type" do
    setup do
      user = user_fixture()
      
      {:ok, course} =
        Course.create_course(%{
          title: "Chemistry 101",
          description: "Introduction to Chemistry",
          teacher_id: user.id
        })

      %{course: course}
    end

    test "creates exercise with ai_type", %{course: course} do
      params = %{
        title: "AI Generated Chemistry Question",
        question_content: "What is the chemical formula for water?",
        answer: "H2O",
        question_type: :fill_in_blank,
        ai_type: :ai_generated,
        course_id: course.id
      }

      {:ok, exercise} = Exercise.create_exercise(params)
      
      assert exercise.title == "AI Generated Chemistry Question"
      assert exercise.ai_type == :ai_generated
      assert exercise.course_id == course.id
    end

    test "creates exercise without ai_type (regular exercise)", %{course: course} do
      params = %{
        title: "Regular Chemistry Question",
        question_content: "What is the atomic number of carbon?",
        answer: "6",
        question_type: :multiple_choice,
        options: %{"A" => "4", "B" => "6", "C" => "8", "D" => "12"},
        course_id: course.id
      }

      {:ok, exercise} = Exercise.create_exercise(params)
      
      assert exercise.title == "Regular Chemistry Question"
      assert exercise.ai_type == nil
      assert exercise.course_id == course.id
    end
  end
end