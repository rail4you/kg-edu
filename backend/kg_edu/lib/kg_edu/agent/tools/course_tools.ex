defmodule KgEdu.Agent.Tools.GetCourses do
  @moduledoc "Agent tool: list all courses."

  use Jido.Action,
    name: "GetCourses",
    description: "获取所有课程列表。当用户询问任何关于课程的内容时，必须首先调用此工具。",
    schema:
      Zoi.object(%{
        _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
      })

  @impl true
  def run(params, _context) do
    tenant = params[:_tenant]
    courses = KgEdu.Agent.DataAccess.list_courses(tenant)
    text = "共 #{length(courses)} 门课程:\n" <> format_courses(courses)
    {:ok, %{result: text, courses: courses}}
  end

  defp format_courses(courses) do
    courses
    |> Enum.map(fn c ->
      major = if c.major, do: " (#{c.major})", else: ""
      semester = if c.semester, do: " - #{c.semester}", else: ""
      "  • #{c.title}#{major}#{semester}"
    end)
    |> Enum.join("\n")
  end
end

defmodule KgEdu.Agent.Tools.GetCoursesByMajor do
  @moduledoc "Agent tool: filter courses by major."

  use Jido.Action,
    name: "GetCoursesByMajor",
    description: "按专业/学科获取课程列表",
    schema:
      Zoi.object(%{
        major: Zoi.string(description: "专业名称"),
        _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
      })

  @impl true
  def run(%{major: major} = params, _context) do
    tenant = params[:_tenant]
    courses = KgEdu.Agent.DataAccess.list_courses_by_major(tenant, major)
    text = "专业 '#{major}' 下共 #{length(courses)} 门课程"
    {:ok, %{result: text, courses: courses}}
  end
end

defmodule KgEdu.Agent.Tools.GetCoursesBySemester do
  @moduledoc "Agent tool: filter courses by semester."

  use Jido.Action,
    name: "GetCoursesBySemester",
    description: "按学期获取课程列表",
    schema:
      Zoi.object(%{
        semester: Zoi.string(description: "学期"),
        _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
      })

  @impl true
  def run(%{semester: semester} = params, _context) do
    tenant = params[:_tenant]
    courses = KgEdu.Agent.DataAccess.list_courses_by_semester(tenant, semester)
    text = "学期 '#{semester}' 共 #{length(courses)} 门课程"
    {:ok, %{result: text, courses: courses}}
  end
end
