defmodule KgEdu.Agent.Tools.GetChapters do
  @moduledoc "Agent tool: list chapters for a course."

  use Jido.Action,
    name: "GetChapters",
    description: "获取课程的所有章节列表。用户提到课程的章节、课时、第几课时时，必须先调用此工具获取章节列表。",
    schema:
      Zoi.object(%{
        courseId: Zoi.string(description: "课程ID")
      })

  @impl true
  def run(%{courseId: course_id}, _context) when is_binary(course_id) do
    chapters = KgEdu.Agent.DataAccess.list_chapters(course_id)
    total = length(chapters)
    root_chapters = Enum.filter(chapters, &is_nil(&1.parentChapterId))

    text =
      if root_chapters == [] do
        "课程 (ID: #{course_id}) 下暂无章节"
      else
        "共 #{total} 个章节（#{length(root_chapters)} 个一级章节）:\n" <>
          format_chapter_tree(root_chapters, chapters, 0)
      end

    {:ok, %{result: text, chapters: chapters}}
  end

  defp format_chapter_tree(root_chapters, all_chapters, depth) do
    root_chapters
    |> Enum.map(fn ch ->
      prefix = String.duplicate("  ", depth)
      line = "#{prefix}• #{ch.title}"
      subchapters = Enum.filter(all_chapters, &(&1.parentChapterId == ch.id))
      children =
        if subchapters != [] do
          "\n" <> format_chapter_tree(subchapters, all_chapters, depth + 1)
        else
          ""
        end
      line <> children
    end)
    |> Enum.join("\n")
  end
end

defmodule KgEdu.Agent.Tools.GetChapterById do
  @moduledoc "Agent tool: get chapter details with subchapters and knowledge resources."

  use Jido.Action,
    name: "GetChapterById",
    description: "获取章节详情，包含子章节列表和关联的知识资源（知识点）。生成章节PPT前应先调用此工具获取内容。",
    schema:
      Zoi.object(%{
        chapterId: Zoi.string(description: "章节ID")
      })

  @impl true
  def run(%{chapterId: chapter_id}, _context) when is_binary(chapter_id) do
    case KgEdu.Agent.DataAccess.get_chapter(chapter_id) do
      nil ->
        {:error, "章节未找到: #{chapter_id}"}

      chapter ->
        # Get knowledge resources for this chapter
        resources =
          KgEdu.Agent.DataAccess.list_knowledge_resources(nil, chapter_id)
          |> Enum.map(fn r ->
            importance = if r.importance, do: " [重要度: #{r.importance}]", else: ""
            desc = if r.description, do: ": #{r.description}", else: ""
            "  • #{r.name}#{importance}#{desc}"
          end)

        resource_text =
          if resources == [] do
            "（暂无关联知识点）"
          else
            "\n知识点:\n" <> Enum.join(resources, "\n")
          end

        subchapters = chapter.subchapters || []
        sub_text =
          if subchapters == [] do
            ""
          else
            "\n子章节:\n" <>
              (subchapters |> Enum.map(fn s -> "  • #{s.title}" end) |> Enum.join("\n"))
          end

        text = """
        章节: #{chapter.title}
        描述: #{chapter.description || "无"}
        #{sub_text}
        #{resource_text}
        """

        {:ok, %{result: text, chapter: chapter, resources: resources}}
    end
  end
end
