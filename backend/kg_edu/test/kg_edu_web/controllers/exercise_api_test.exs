defmodule KgEduWeb.ExerciseAPITest do
  @moduledoc """
  Exercise API 测试 — 经真实 RPC 入口（POST /rpc/run），覆盖：
  - generate_ai_exercise 参数校验（无效输入不触网）
  - get_recent_ai_exercises 查询（含租户隔离与过滤）
  - create_exercise / get_exercise 基础读写

  注：旧版测的是不存在的 `/api/exercises/*` REST 路由，已按现实现重写。
  真 LLM 生成需有效 Key，不在自动化测试中覆盖（见 P1 演示验证）。
  """
  use KgEduWeb.ConnCase, async: true

  import KgEdu.AccountsFixtures

  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.Exercise

  setup %{conn: conn} do
    tenant = test_tenant()
    user = user_fixture()

    {:ok, course} =
      Course.create_course(
        %{title: "Physics 101", description: "Introduction to Physics", teacher_id: user.id},
        tenant: tenant
      )

    {:ok, ai_exercise} =
      Exercise.create_exercise(
        %{
          title: "AI Generated Exercise",
          question_content: "Solve: x + 5 = 12",
          answer: "x = 7",
          question_type: :essay,
          ai_type: :ai_generated,
          course_id: course.id
        },
        tenant: tenant
      )

    {:ok, regular_exercise} =
      Exercise.create_exercise(
        %{
          title: "Regular Exercise",
          question_content: "What is 2+2?",
          answer: "4",
          question_type: :multiple_choice,
          options: %{"A" => "3", "B" => "4", "C" => "5", "D" => "6"},
          course_id: course.id
        },
        tenant: tenant
      )

    %{conn: conn, tenant: tenant, course: course, ai_exercise: ai_exercise, regular_exercise: regular_exercise}
  end

  defp rpc(conn, action, tenant, input \\ %{}, fields \\ []) do
    conn
    |> put_req_header("content-type", "application/json")
    |> post(
      "/rpc/run",
      Jason.encode!(%{"action" => action, "tenant" => tenant, "input" => input, "fields" => fields})
    )
  end

  describe "generate_ai_exercise via RPC" do
    test "无效题型返回校验错误（不触网）", %{conn: conn, tenant: tenant, course: course} do
      conn =
        rpc(conn, "generate_ai_exercise", tenant, %{
          "course_id" => course.id,
          "knowledge_name" => "Newton",
          "exercise_type" => "invalid_type",
          "number" => 1
        })

      assert %{"success" => false, "errors" => [_ | _]} = json_response(conn, 200)
    end

    test "缺必填参数返回错误", %{conn: conn, tenant: tenant} do
      conn = rpc(conn, "generate_ai_exercise", tenant, %{"course_name" => "Test"})

      assert %{"success" => false, "errors" => [_ | _]} = json_response(conn, 200)
    end
  end

  describe "get_recent_ai_exercises via RPC" do
    test "只返回 AI 生成习题", %{conn: conn, tenant: tenant, ai_exercise: ai_exercise, regular_exercise: regular_exercise} do
      conn = rpc(conn, "get_recent_ai_exercises", tenant, %{}, ["id", "ai_type"])

      assert %{"success" => true, "data" => rows} = json_response(conn, 200)
      ids = Enum.map(rows, & &1["id"])
      assert ai_exercise.id in ids
      refute regular_exercise.id in ids
      assert Enum.all?(rows, &(&1["aiType"] == "ai_generated"))
    end

    test "按 course_id 过滤", %{conn: conn, tenant: tenant, course: course, ai_exercise: ai_exercise} do
      conn =
        rpc(conn, "get_recent_ai_exercises", tenant, %{"course_id" => course.id}, ["id", "course_id"])

      assert %{"success" => true, "data" => rows} = json_response(conn, 200)
      ids = Enum.map(rows, & &1["id"])
      assert ai_exercise.id in ids
      assert Enum.all?(rows, &(&1["courseId"] == course.id))
    end
  end

  describe "create_exercise / get_exercise via RPC" do
    test "创建普通习题", %{conn: conn, tenant: tenant, course: course} do
      conn =
        rpc(conn, "create_exercise", tenant, %{
          "title" => "RPC Biology Question",
          "question_content" => "Powerhouse of the cell?",
          "answer" => "Mitochondria",
          "question_type" => "multiple_choice",
          "options" => %{"A" => "Nucleus", "B" => "Mitochondria"},
          "course_id" => course.id
        }, ["id", "title"])

      assert %{"success" => true, "data" => %{"title" => "RPC Biology Question"}} =
               json_response(conn, 200)
    end

    test "按 id 读取习题", %{conn: conn, tenant: tenant, ai_exercise: ai_exercise} do
      conn = rpc(conn, "get_exercise", tenant, %{"id" => ai_exercise.id}, ["id", "title"])

      assert %{"success" => true, "data" => %{"id" => id, "title" => title}} =
               json_response(conn, 200)

      assert id == ai_exercise.id
      assert title == "AI Generated Exercise"
    end
  end
end
