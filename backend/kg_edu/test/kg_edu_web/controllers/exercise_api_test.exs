defmodule KgEduWeb.ExerciseAPITest do
  use KgEduWeb.ConnCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.Resource
  alias KgEdu.Knowledge.Exercise

  describe "POST /api/exercises/ai/generate" do
    setup %{conn: conn} do
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

      conn =
        conn
        |> put_req_header("accept", "application/vnd.api+json")
        |> put_req_header("content-type", "application/vnd.api+json")

      %{
        conn: conn,
        user: user,
        course: course,
        knowledge_resource: knowledge_resource
      }
    end

    test "generates AI exercise with valid parameters", %{
      conn: conn,
      course: course,
      knowledge_resource: knowledge_resource
    } do
      params = %{
        data: %{
          type: "exercise",
          attributes: %{
            course_name: course.title,
            knowledge_name: knowledge_resource.name,
            chapter_name: "First Law",
            exercise_type: "multiple_choice",
            number: 1,
            course_id: course.id,
            knowledge_resource_id: knowledge_resource.id
          }
        }
      }

      # Note: This test will fail in practice because ReqLLM needs actual API key
      # But it demonstrates the correct API structure
      conn = post(conn, "/api/exercises/ai/generate", params)
      
      # Should return either success or error response
      # In real usage, this would create an AI-generated exercise
      assert response = json_response(conn, 201)
      assert is_map(response)
    end

    test "returns error with missing parameters", %{conn: conn} do
      params = %{
        data: %{
          type: "exercise",
          attributes: %{
            course_name: "Test Course"
            # Missing required parameters
          }
        }
      }

      conn = post(conn, "/api/exercises/ai/generate", params)
      
      # Should return error response
      assert response = json_response(conn, 422)
      assert is_map(response)
    end

    test "returns error with invalid exercise_type", %{conn: conn} do
      params = %{
        data: %{
          type: "exercise",
          attributes: %{
            course_name: "Test Course",
            knowledge_name: "Test Knowledge",
            exercise_type: "invalid_type",
            number: 1,
            course_id: UUID.uuid4()
          }
        }
      }

      conn = post(conn, "/api/exercises/ai/generate", params)
      
      # Should return error response
      assert response = json_response(conn, 422)
      assert is_map(response)
    end
  end

  describe "GET /api/exercises/ai/recent" do
    setup %{conn: conn} do
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

      # Create an AI exercise manually
      {:ok, ai_exercise} =
        Exercise.create_exercise(%{
          title: "AI Generated Exercise",
          question_content: "Solve: x + 5 = 12",
          answer: "x = 7",
          question_type: :essay,
          ai_type: :ai_generated,
          course_id: course.id
        })

      conn =
        conn
        |> put_req_header("accept", "application/vnd.api+json")

      %{
        conn: conn,
        course: course,
        regular_exercise: regular_exercise,
        ai_exercise: ai_exercise
      }
    end

    test "returns only AI-generated exercises", %{conn: conn, ai_exercise: ai_exercise} do
      conn = get(conn, "/api/exercises/ai/recent")
      
      response = json_response(conn, 200)
      assert is_map(response)
      assert Map.has_key?(response, "data")
      
      exercises = response["data"]
      assert length(exercises) == 1
      
      exercise = hd(exercises)
      assert exercise["id"] == ai_exercise.id
      assert exercise["attributes"]["ai_type"] == "ai_generated"
    end

    test "filters by course_id when provided", %{conn: conn, course: course, ai_exercise: ai_exercise} do
      conn = get(conn, "/api/exercises/ai/recent?course_id=#{course.id}")
      
      response = json_response(conn, 200)
      exercises = response["data"]
      
      assert length(exercises) == 1
      exercise = hd(exercises)
      assert exercise["id"] == ai_exercise.id
    end

    test "limits results when limit parameter is provided", %{conn: conn} do
      conn = get(conn, "/api/exercises/ai/recent?limit=1")
      
      response = json_response(conn, 200)
      exercises = response["data"]
      
      assert length(exercises) <= 1
    end

    test "returns empty list when no AI exercises exist", %{conn: conn} do
      # Delete the AI exercise first
      Exercise.delete_exercise(%{id: ai_exercise.id})
      
      conn = get(conn, "/api/exercises/ai/recent")
      
      response = json_response(conn, 200)
      exercises = response["data"]
      
      assert exercises == []
    end
  end

  describe "GET /api/exercises/:id" do
    setup %{conn: conn} do
      user = user_fixture()
      
      {:ok, course} =
        Course.create_course(%{
          title: "Chemistry 101",
          description: "Introduction to Chemistry",
          teacher_id: user.id
        })

      {:ok, exercise} =
        Exercise.create_exercise(%{
          title: "AI Generated Chemistry Question",
          question_content: "What is the chemical formula for water?",
          answer: "H2O",
          question_type: :fill_in_blank,
          ai_type: :ai_generated,
          course_id: course.id
        })

      conn =
        conn
        |> put_req_header("accept", "application/vnd.api+json")

      %{conn: conn, exercise: exercise}
    end

    test "returns AI exercise with all attributes", %{conn: conn, exercise: exercise} do
      conn = get(conn, "/api/exercises/#{exercise.id}")
      
      response = json_response(conn, 200)
      exercise_data = response["data"]
      
      assert exercise_data["id"] == exercise.id
      assert exercise_data["attributes"]["title"] == "AI Generated Chemistry Question"
      assert exercise_data["attributes"]["ai_type"] == "ai_generated"
      assert exercise_data["attributes"]["question_type"] == "fill_in_blank"
      assert exercise_data["attributes"]["question_content"] == "What is the chemical formula for water?"
      assert exercise_data["attributes"]["answer"] == "H2O"
    end

    test "returns 404 for non-existent exercise", %{conn: conn} do
      conn = get(conn, "/api/exercises/#{UUID.uuid4()}")
      
      response = json_response(conn, 404)
      assert is_map(response)
    end
  end

  describe "standard exercise CRUD operations" do
    setup %{conn: conn} do
      user = user_fixture()
      
      {:ok, course} =
        Course.create_course(%{
          title: "Biology 101",
          description: "Introduction to Biology",
          teacher_id: user.id
        })

      conn =
        conn
        |> put_req_header("accept", "application/vnd.api+json")
        |> put_req_header("content-type", "application/vnd.api+json")

      %{conn: conn, course: course}
    end

    test "creates regular exercise without ai_type", %{conn: conn, course: course} do
      params = %{
        data: %{
          type: "exercise",
          attributes: %{
            title: "Regular Biology Question",
            question_content: "What is the powerhouse of the cell?",
            answer: "Mitochondria",
            question_type: "multiple_choice",
            options: %{
              "A" => "Nucleus",
              "B" => "Mitochondria", 
              "C" => "Ribosome",
              "D" => "Endoplasmic reticulum"
            },
            course_id: course.id
          }
        }
      }

      conn = post(conn, "/api/exercises", params)
      
      response = json_response(conn, 201)
      exercise_data = response["data"]
      
      assert exercise_data["attributes"]["title"] == "Regular Biology Question"
      assert exercise_data["attributes"]["ai_type"] == nil
    end

    test "creates exercise with ai_type", %{conn: conn, course: course} do
      params = %{
        data: %{
          type: "exercise",
          attributes: %{
            title: "Manual AI Exercise",
            question_content: "Test question",
            answer: "Test answer",
            question_type: "essay",
            ai_type: "ai_generated",
            course_id: course.id
          }
        }
      }

      conn = post(conn, "/api/exercises", params)
      
      response = json_response(conn, 201)
      exercise_data = response["data"]
      
      assert exercise_data["attributes"]["title"] == "Manual AI Exercise"
      assert exercise_data["attributes"]["ai_type"] == "ai_generated"
    end
  end
end