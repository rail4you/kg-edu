defmodule KgEdu.Agent.Tools.GetCourses do
  @moduledoc "Agent tool: list all courses."

  use Jido.Action,
    name: "GetCourses",
    description: "获取所有课程列表。当用户询问任何关于课程的内容时，必须首先调用此工具。",
    schema:
      Zoi.object(%{
      })

  @impl true
  def run(_params, _context) do
    courses = KgEdu.Agent.DataAccess.list_courses()
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
        major: Zoi.string(description: "专业名称")
      })

  @impl true
  def run(%{major: major}, _context) do
    courses = KgEdu.Agent.DataAccess.list_courses_by_major(major)
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
        semester: Zoi.string(description: "学期")
      })

  @impl true
  def run(%{semester: semester}, _context) do
    courses = KgEdu.Agent.DataAccess.list_courses_by_semester(semester)
    text = "学期 '#{semester}' 共 #{length(courses)} 门课程"
    {:ok, %{result: text, courses: courses}}
  end
end
