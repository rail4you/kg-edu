defmodule KgEdu.Agent.Tools.DocumentTools do
  @moduledoc """
  Agent tools for document generation (PPTX, DOCX).

  Stage 1: Placeholder stubs — full Python pipeline in Stage 2.
  """

  defmodule PPTX do
    @moduledoc false

    use Jido.Action,
      name: "GeneratePowerPointWithShapeCrawler",
      description: "生成PPT/PPTX演示文稿课件。用户提到PPT、课件、幻灯片时必须调用。",
      schema:
        Zoi.object(%{
          courseName: Zoi.string(description: "课程名称"),
          knowledgeName: Zoi.string(description: "知识点名称") |> Zoi.optional(),
          courseId: Zoi.string(description: "课程ID") |> Zoi.optional(),
          knowledgeResourceId: Zoi.string(description: "知识资源ID") |> Zoi.optional(),
          userRequirements: Zoi.string(description: "用户额外需求") |> Zoi.optional(),
          author: Zoi.string(description: "作者") |> Zoi.optional()
        })

    @impl true
    def run(params, _context) do
      course = params[:courseName] || "未命名课程"
      {:ok, %{result: "PPT课件「#{course}」生成请求已接收。Stage 2 将接入 Python 生成管道。"}}
    end
  end

  defmodule DOCX do
    @moduledoc false

    use Jido.Action,
      name: "SaveAsDocxAndUpload",
      description: "创建DOCX文档（如教案）并上传到云存储。必需：content、courseId。",
      schema:
        Zoi.object(%{
          content: Zoi.string(description: "Markdown 格式的文档内容"),
          courseId: Zoi.string(description: "课程ID（必需）"),
          fileName: Zoi.string(description: "文件名") |> Zoi.optional(),
          knowledgeResourceId: Zoi.string(description: "知识资源ID") |> Zoi.optional()
        })

    @impl true
    def run(params, _context) do
      {:ok, %{result: "DOCX文档生成请求已接收。Stage 2 将接入 Python 生成管道。"}}
    end
  end
end
