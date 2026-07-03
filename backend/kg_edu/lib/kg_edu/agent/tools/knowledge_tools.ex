defmodule KgEdu.Agent.Tools.GetKnowledgeResources do
  @moduledoc "Agent tool: list knowledge resources."

  use Jido.Action,
    name: "GetKnowledgeResources",
    description: "获取知识资源（知识点/课时），可按课程ID或章节ID筛选",
    schema:
      Zoi.object(%{
        courseId: Zoi.string(description: "课程ID") |> Zoi.optional(),
        chapterId: Zoi.string(description: "章节ID") |> Zoi.optional()
      })

  @impl true
  def run(params, _context) do
    resources = KgEdu.Agent.DataAccess.list_knowledge_resources(params[:courseId], params[:chapterId])
    text = "共 #{length(resources)} 个知识资源:\n" <>
      (resources |> Enum.map(fn r ->
        importance = if r.importance, do: " [重要度: #{r.importance}]", else: ""
        "  • #{r.name}#{importance}"
      end) |> Enum.join("\n"))
    {:ok, %{result: text, resources: resources}}
  end
end

defmodule KgEdu.Agent.Tools.GetExercises do
  @moduledoc "Agent tool: list exercises."

  use Jido.Action,
    name: "GetExercises",
    description: "获取练习题，可按课程ID或知识资源ID筛选",
    schema:
      Zoi.object(%{
        courseId: Zoi.string(description: "课程ID") |> Zoi.optional(),
        knowledgeResourceId: Zoi.string(description: "知识资源ID") |> Zoi.optional()
      })

  @impl true
  def run(params, _context) do
    exercises = KgEdu.Agent.DataAccess.list_exercises(params[:courseId], params[:knowledgeResourceId])
    text = "共 #{length(exercises)} 道练习题:\n" <>
      (exercises |> Enum.map(fn e ->
        type = if e.questionType, do: "[#{e.questionType}] ", else: ""
        "  • #{type}#{e.title}"
      end) |> Enum.join("\n"))
    {:ok, %{result: text, exercises: exercises}}
  end
end

defmodule KgEdu.Agent.Tools.GetExams do
  @moduledoc "Agent tool: list exams."

  use Jido.Action,
    name: "GetExams",
    description: "获取试卷列表，可按课程ID筛选",
    schema:
      Zoi.object(%{
        courseId: Zoi.string(description: "课程ID") |> Zoi.optional()
      })

  @impl true
  def run(params, _context) do
    exams = KgEdu.Agent.DataAccess.list_exams(params[:courseId])
    text = "共 #{length(exams)} 份试卷:\n" <>
      (exams |> Enum.map(fn e ->
        points = if e.totalPoints, do: " [#{e.totalPoints}分]", else: ""
        "  • #{e.title}#{points}"
      end) |> Enum.join("\n"))
    {:ok, %{result: text, exams: exams}}
  end
end
