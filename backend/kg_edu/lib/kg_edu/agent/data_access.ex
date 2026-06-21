defmodule KgEdu.Agent.DataAccess do
  @moduledoc """
  Direct Ash API data access for agent tools.

  Replaces the TypeScript `api-client.ts` RPC calls with native Ash queries.
  No HTTP round-trip — same BEAM process, same database connection pool.
  """

  require Ash.Query

  alias KgEdu.Courses.Course
  alias KgEdu.Knowledge.{Resource, Question, Exam}

  @doc "List all courses for a tenant."
  def list_courses(tenant) do
    Course
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&course_summary/1)
  end

  @doc "List courses filtered by major name."
  def list_courses_by_major(tenant, major) do
    list_courses(tenant)
    |> Enum.filter(&(&1.major && String.contains?(&1.major, major)))
  end

  @doc "List courses filtered by semester."
  def list_courses_by_semester(tenant, semester) do
    list_courses(tenant)
    |> Enum.filter(&(&1.semester == semester))
  end

  @doc "List knowledge resources, optionally filtered by course_id."
  def list_knowledge_resources(tenant, course_id \\ nil) do
    query =
      if course_id do
        Resource |> Ash.Query.filter(course_id == ^course_id)
      else
        Resource |> Ash.Query.new()
      end

    query
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&resource_summary/1)
  end

  @doc "List exercises, optionally filtered by course_id and/or knowledge_resource_id."
  def list_exercises(tenant, course_id \\ nil, knowledge_resource_id \\ nil) do
    query =
      cond do
        course_id && knowledge_resource_id ->
          Question |> Ash.Query.filter(course_id == ^course_id and knowledge_resource_id == ^knowledge_resource_id)

        course_id ->
          Question |> Ash.Query.filter(course_id == ^course_id)

        knowledge_resource_id ->
          Question |> Ash.Query.filter(knowledge_resource_id == ^knowledge_resource_id)

        true ->
          Question |> Ash.Query.new()
      end

    query
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&exercise_summary/1)
  end

  @doc "List exams, optionally filtered by course_id."
  def list_exams(tenant, course_id \\ nil) do
    query =
      if course_id do
        Exam |> Ash.Query.filter(course_id == ^course_id)
      else
        Exam |> Ash.Query.new()
      end

    query
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&exam_summary/1)
  end

  # ── summary helpers ─────────────────────────────────────────────────────

  defp course_summary(c) do
    %{
      id: c.id,
      title: c.title,
      major: c.major,
      semester: c.semester,
      publishStatus: c.publish_status,
      description: c.description
    }
  end

  defp resource_summary(r) do
    %{
      id: r.id,
      name: r.name,
      description: r.description,
      importance: r.importance,
      courseId: r.course_id,
      parentKnowledgeResourceId: r.parent_knowledge_resource_id
    }
  end

  defp exercise_summary(q) do
    %{
      id: q.id,
      title: q.title,
      questionContent: q.question_content,
      questionType: q.question_type,
      answer: q.answer,
      answerExplanation: q.answer_explanation,
      difficulty: q.difficulty,
      courseId: q.course_id,
      knowledgeResourceId: q.knowledge_resource_id
    }
  end

  defp exam_summary(e) do
    %{
      id: e.id,
      title: e.title,
      description: e.description,
      courseId: e.course_id,
      totalPoints: e.total_points,
      duration: e.duration_minutes
    }
  end
end
