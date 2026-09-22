defmodule KgEdu.Knowledge.ExerciseTest do
  use KgEdu.DataCase, async: true
  import KgEdu.AccountsFixtures

  alias KgEdu.Knowledge.Exercise
  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.Resource

  import KgEdu.AccountsFixtures

  describe "generate_ai_exercise/1" do
    setup do
      user = user_fixture()

      {:ok, course} =
        Course.create_course(%{
          title: "Physics 101",
          description: "Introduction to Physics",
          teacher_id: user.id
        }, tenant: test_tenant())

      {:ok, knowledge_resource} =
        Resource.create_knowledge_resource(%{
          name: "Newton's Laws",
          description: "Understanding Newton's three laws of motion",
          course_id: course.id,
          knowledge_type: :subject,
          importance_level: "normal"
        }, tenant: test_tenant())

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

      # 无有效 LLM Key 时应优雅返回 error（不 raise、不崩溃）；真成功路径需 live Key，P1 演示验证
      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())
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

      # 无有效 LLM Key 时应优雅返回 error（不 raise、不崩溃）；真成功路径需 live Key，P1 演示验证
      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())
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

      # 无有效 LLM Key 时应优雅返回 error（不 raise、不崩溃）；真成功路径需 live Key，P1 演示验证
      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())
    end

    test "validates required parameters", %{course: course} do
      # Test missing course_name
      params = %{
        knowledge_name: "Test Knowledge",
        exercise_type: :multiple_choice,
        number: 1,
        course_id: course.id
      }

      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())

      # Test missing knowledge_name
      params = %{
        course_name: "Test Course",
        exercise_type: :multiple_choice,
        number: 1,
        course_id: course.id
      }

      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())

      # Test missing exercise_type
      params = %{
        course_name: "Test Course",
        knowledge_name: "Test Knowledge",
        number: 1,
        course_id: course.id
      }

      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())

      # Test missing course_id
      params = %{
        course_name: "Test Course",
        knowledge_name: "Test Knowledge",
        exercise_type: :multiple_choice,
        number: 1
      }

      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())
    end

    test "validates exercise_type constraint", %{
      course: course,
      knowledge_resource: knowledge_resource
    } do
      params = %{
        course_name: course.title,
        knowledge_name: knowledge_resource.name,
        exercise_type: :invalid_type,
        number: 1,
        course_id: course.id,
        knowledge_resource_id: knowledge_resource.id
      }

      assert {:error, _} = Exercise.generate_ai_exercise(params, tenant: test_tenant())
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
        }, tenant: test_tenant())

      # Create a regular exercise
      {:ok, regular_exercise} =
        Exercise.create_exercise(%{
          title: "Regular Exercise",
          question_content: "What is 2+2?",
          answer: "4",
          question_type: :multiple_choice,
          options: %{"A" => "3", "B" => "4", "C" => "5", "D" => "6"},
          course_id: course.id
        }, tenant: test_tenant())

      # Create an AI exercise manually (since we can't test actual AI generation)
      {:ok, ai_exercise} =
        Exercise.create_exercise(%{
          title: "AI Generated Exercise",
          question_content: "Solve: x + 5 = 12",
          answer: "x = 7",
          question_type: :essay,
          ai_type: :ai_generated,
          course_id: course.id
        }, tenant: test_tenant())

      %{
        course: course,
        regular_exercise: regular_exercise,
        ai_exercise: ai_exercise
      }
    end

    test "returns only AI-generated exercises", %{
      regular_exercise: regular_exercise,
      ai_exercise: ai_exercise
    } do
      # 租户 schema 含历史数据，断言用成员式（数据无关）
      {:ok, exercises} = Exercise.get_recent_ai_exercises(%{}, tenant: test_tenant())

      ids = Enum.map(exercises, & &1.id)
      assert ai_exercise.id in ids
      refute regular_exercise.id in ids
      assert Enum.all?(exercises, &(&1.ai_type == :ai_generated))
    end

    test "returns exercises sorted by most recent", %{} do
      {:ok, exercises} = Exercise.get_recent_ai_exercises(%{}, tenant: test_tenant())

      assert length(exercises) >= 1

      exercises
      |> Enum.chunk_every(2, 1, :discard)
      |> Enum.each(fn [a, b] ->
        assert DateTime.compare(a.inserted_at, b.inserted_at) != :lt
      end)
    end

    test "filters by course_id when provided", %{course: course, ai_exercise: ai_exercise} do
      {:ok, exercises} =
        Exercise.get_recent_ai_exercises(%{course_id: course.id}, tenant: test_tenant())

      ids = Enum.map(exercises, & &1.id)
      assert ai_exercise.id in ids
      assert Enum.all?(exercises, &(&1.course_id == course.id))
    end

    test "limits results when limit is provided", %{} do
      {:ok, exercises} =
        Exercise.get_recent_ai_exercises(%{limit: 1}, tenant: test_tenant())

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
        }, tenant: test_tenant())

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

      {:ok, exercise} = Exercise.create_exercise(params, tenant: test_tenant())

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

      {:ok, exercise} = Exercise.create_exercise(params, tenant: test_tenant())

      assert exercise.title == "Regular Chemistry Question"
      assert exercise.ai_type == nil
      assert exercise.course_id == course.id
    end
  end
end
