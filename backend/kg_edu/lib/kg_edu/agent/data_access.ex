defmodule KgEdu.Agent.DataAccess do
  @moduledoc """
  Direct Ash API data access for agent tools.

  Replaces the TypeScript `api-client.ts` RPC calls with native Ash queries.
  No HTTP round-trip — same BEAM process, same database connection pool.
  """

  require Ash.Query

  alias KgEdu.Courses.{Course, Chapter}
  alias KgEdu.Knowledge.{Resource, Question, Exam}

  @doc "Resolve tenant from explicit param or SessionContext."
  def resolve_tenant(tenant) do
    tenant || KgEdu.Agent.SessionContext.get(:tenant)
  end

  @doc "List all courses for a tenant. Tenant auto-detected from ETS if nil."
  def list_courses(tenant \\ nil) do
    tenant = resolve_tenant(tenant)

    Course
    |> Ash.Query.for_read(:get_all_courses)
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&course_summary/1)
  end

  @doc "List courses filtered by major name."
  def list_courses_by_major(major, tenant \\ nil) do
    list_courses(tenant)
    |> Enum.filter(&(&1.major && String.contains?(&1.major, major)))
  end

  @doc "List courses filtered by semester."
  def list_courses_by_semester(semester, tenant \\ nil) do
    list_courses(tenant)
    |> Enum.filter(&(&1.semester == semester))
  end

  @doc "List knowledge resources, optionally filtered by course_id and/or chapter_id."
  def list_knowledge_resources(course_id \\ nil, chapter_id \\ nil, opts \\ []) do
    tenant = resolve_tenant(opts[:tenant])

    query = Resource |> Ash.Query.new()

    query =
      cond do
        course_id && chapter_id ->
          query |> Ash.Query.filter(course_id == ^course_id and chapter_id == ^chapter_id)

        course_id ->
          query |> Ash.Query.filter(course_id == ^course_id)

        chapter_id ->
          query |> Ash.Query.filter(chapter_id == ^chapter_id)

        true ->
          query
      end

    query
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&resource_summary/1)
  end

  @doc "List exercises, optionally filtered by course_id and/or knowledge_resource_id."
  def list_exercises(course_id \\ nil, knowledge_resource_id \\ nil, tenant \\ nil) do
    tenant = resolve_tenant(tenant)

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
  def list_exams(course_id \\ nil, tenant \\ nil) do
    tenant = resolve_tenant(tenant)

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

  @doc "List chapters for a course."
  def list_chapters(course_id, tenant \\ nil) do
    tenant = resolve_tenant(tenant)

    Chapter
    |> Ash.Query.for_read(:by_course, %{course_id: course_id})
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> Enum.map(&chapter_summary/1)
  end

  @doc "Get a single chapter by ID, including its subchapters and knowledge resources."
  def get_chapter(chapter_id, tenant \\ nil) do
    tenant = resolve_tenant(tenant)

    Chapter
    |> Ash.Query.filter(id == ^chapter_id)
    |> Ash.Query.load([:subchapters, :knowledge_resources])
    |> Ash.read!(tenant: tenant, authorize?: false)
    |> List.first()
    |> then(fn
      nil -> nil
      chapter -> chapter_summary(chapter) |> Map.put(:subchapters, (chapter.subchapters || []) |> Enum.map(&chapter_summary/1))
    end)
  end

  defp chapter_summary(ch) do
    %{
      id: ch.id,
      title: ch.title,
      description: ch.description,
      sortOrder: ch.sort_order,
      courseId: ch.course_id,
      parentChapterId: ch.parent_chapter_id
    }
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
      importance: r.importance_level,
      courseId: r.course_id,
      chapterId: r.chapter_id,
      teachingGoal: r.teaching_goal,
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
