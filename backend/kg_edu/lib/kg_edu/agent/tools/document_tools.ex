defmodule KgEdu.Agent.Tools.DocumentTools do
  @moduledoc """
  Agent tools for document generation (PPTX, DOCX).

  Stage 1: Wired to existing Python generation via ScriptToolFactory.
  Uses priv/skills/document/tools/*.py scripts.
  """

  # ── GeneratePowerPointWithShapeCrawler ──────────────────────────────────

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
          author: Zoi.string(description: "作者") |> Zoi.optional(),
          _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
        })

    @impl true
    def run(params, _context) do
      tenant = params[:_tenant] || Ash.get_tenant()

      if is_nil(tenant) do
        {:error, "未设置租户上下文"}
      else
        # Stage 1: Placeholder — wire to Python script in Stage 2
        course = params[:courseName] || "未命名课程"
        text = "PPT课件生成功能正在迁移到 Elixir/Jido 平台。课程: #{course}。Stage 2 将接入 Python 生成管道。"

        {:ok, %{result: text, status: "migrating"}}
      end
    end
  end

  # ── SaveAsDocxAndUpload ─────────────────────────────────────────────────

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
          knowledgeResourceId: Zoi.string(description: "知识资源ID") |> Zoi.optional(),
          _tenant: Zoi.string(description: "租户标识") |> Zoi.optional()
        })

    @impl true
    def run(params, _context) do
      tenant = params[:_tenant] || Ash.get_tenant()

      if is_nil(tenant) do
        {:error, "未设置租户上下文"}
      else
        # Stage 1: Placeholder
        text = "DOCX文档生成功能正在迁移到 Elixir/Jido 平台。Stage 2 将接入 Python 生成管道。"

        {:ok, %{result: text, status: "migrating"}}
      end
    end
  end
end
