defmodule KgEdu.Agent.Tools.DocumentTools do
  @moduledoc """
  Agent tools for PPTX and DOCX generation.

  Uses Python scripts via ScriptToolFactory for actual file generation,
  then uploads to OSS and returns the public URL.
  """

  require Logger

  # ── GeneratePowerPointWithShapeCrawler ──────────────────────────────────

  defmodule PPTX do
    @moduledoc "Generate PPTX presentation from structured content."

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
      course_name = params[:courseName] || "未命名课程"
      author = params[:author] || "KgEdu"
      user_req = params[:userRequirements] || ""

      # Build slide content from params
      slides = build_slides(course_name, params[:knowledgeName], user_req)
      output_dir = System.tmp_dir!()

      input = %{
        courseName: course_name,
        slides: Jason.encode!(slides),
        author: author,
        outputDir: output_dir
      }

      Logger.info("[DocumentTools] Generating PPTX for '#{course_name}' with #{length(slides)} slides")

      case KgEdu.Agent.Tools.DocumentTools.run_js_script("generate_pptx.js", Jason.encode!(input)) do
        {:ok, %{"filePath" => file_path}} ->
          file_size = get_file_size(file_path)

          case KgEdu.Agent.Tools.DocumentTools.safe_upload(file_path) do
            {:ok, url} ->
              save_record(params, Path.basename(file_path), url, file_size, "pptx")
              {:ok, %{result: "PPT课件「#{course_name}」已生成！\n下载链接: #{url}", fileUrl: url}}

            {:error, reason} ->
              # Return file path on upload failure (still useful for debugging)
              {:ok, %{result: "PPT课件已生成（本地: #{file_path}）。上传失败: #{reason}", localPath: file_path}}
          end

        {:ok, raw} ->
          {:error, "PPT生成脚本返回异常: #{inspect(raw)}"}

        {:error, reason} ->
          {:error, "PPT生成失败: #{reason}"}
      end
    end

    defp build_slides(course_name, knowledge_name, user_req) do
      bullets = String.split(user_req || "", "\n") |> Enum.reject(&(&1 == ""))

      slides = [
        %{
          "title" => "课程概览",
          "content" => "#{course_name}课程知识体系与教学目标",
          "bullets" => Enum.take(bullets, 5)
        }
      ]

      if knowledge_name do
        slides = slides ++ [
          %{
            "title" => knowledge_name,
            "content" => user_req || "知识点详解",
            "bullets" => Enum.drop(bullets, 5) |> Enum.take(6)
          }
        ]
      end

      slides
    end

    defp get_file_size(path) do
      case File.stat(path) do
        {:ok, stat} -> stat.size
        _ -> 0
      end
    end

    defp save_record(params, file_name, url, size, type) do
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)

      if tenant do
        KgEdu.Agent.OssUpload.save_file_record(tenant, file_name, url, size, type,
          user_id: KgEdu.Agent.SessionContext.get(:user_id),
          course_id: params[:courseId],
          knowledge_resource_id: params[:knowledgeResourceId]
        )
      end
    end
  end

  # ── SaveAsDocxAndUpload ─────────────────────────────────────────────────

  defmodule DOCX do
    @moduledoc "Generate DOCX document from Markdown content."

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
      content = params[:content] || ""
      course_id = params[:courseId]
      file_name = params[:fileName] || "document"
      output_dir = System.tmp_dir!()

      if content == "" or is_nil(course_id) do
        {:error, "content 和 courseId 是必需参数"}
      else
        input = %{
          content: content,
          fileName: file_name,
          outputDir: output_dir
        }

        Logger.info("[DocumentTools] Generating DOCX '#{file_name}' (#{String.length(content)} chars)")

        case KgEdu.Agent.Tools.DocumentTools.run_js_script("generate_docx.js", Jason.encode!(input)) do
          {:ok, %{"filePath" => file_path}} ->
            file_size = get_file_size(file_path)

            case KgEdu.Agent.Tools.DocumentTools.safe_upload(file_path) do
              {:ok, url} ->
                save_record(params, Path.basename(file_path), url, file_size, "docx")
                {:ok, %{result: "文档已生成！\n下载链接: #{url}", fileUrl: url}}

              {:error, _reason} ->
                {:ok, %{result: "文档已生成（本地: #{file_path}）", localPath: file_path}}
            end

          {:ok, raw} ->
            {:error, "DOCX生成脚本返回异常: #{inspect(raw)}"}

          {:error, reason} ->
            {:error, "DOCX生成失败: #{reason}"}
        end
      end
    end

    defp get_file_size(path) do
      case File.stat(path) do
        {:ok, stat} -> stat.size
        _ -> 0
      end
    end

    defp save_record(params, file_name, url, size, type) do
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)

      if tenant do
        KgEdu.Agent.OssUpload.save_file_record(tenant, file_name, url, size, type,
          user_id: KgEdu.Agent.SessionContext.get(:user_id),
          course_id: params[:courseId],
          knowledge_resource_id: params[:knowledgeResourceId]
        )
      end
    end
  end

  # ── Python script runner ────────────────────────────────────────────────

  def safe_upload(file_path) do
    KgEdu.Agent.OssUpload.upload(file_path)
  rescue
    e -> {:error, Exception.message(e)}
  end

  def run_js_script(script_name, json_input) do
    tools_dir = Application.app_dir(:kg_edu, "priv/skills/document/tools")
    script = Path.join(tools_dir, script_name)

    if File.exists?(script) do
      # Set NODE_PATH to include agent-server/node_modules for pptxgenjs
      agent_node_modules =
        :kg_edu
        |> Application.app_dir()
        |> Path.dirname()
        |> Path.dirname()
        |> Path.join("agent-server/node_modules")
        |> Path.expand()

      env = [{"NODE_PATH", agent_node_modules}]

      case System.cmd("node", [script, json_input], env: env, stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, result} -> {:ok, result}
            {:error, _} -> {:ok, %{"raw" => String.trim(output)}}
          end

        {output, exit_code} ->
          error_msg =
            case Jason.decode(output) do
              {:ok, %{"error" => msg}} -> msg
              _ -> String.trim(output)
            end

          {:error, "JS script '#{script_name}' failed (exit #{exit_code}): #{error_msg}"}
      end
    else
      {:error, "JS script not found: #{script}"}
    end
  end

  def run_python_script(script_name, json_input) do
    tools_dir = Application.app_dir(:kg_edu, "priv/skills/document/tools")
    script = Path.join(tools_dir, script_name)

    if File.exists?(script) do
      case System.cmd("python3", [script, json_input], stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, result} -> {:ok, result}
            {:error, _} -> {:ok, %{"raw" => String.trim(output)}}
          end

        {output, exit_code} ->
          error_msg =
            case Jason.decode(output) do
              {:ok, %{"error" => msg}} -> msg
              _ -> String.trim(output)
            end

          {:error, "Python script '#{script_name}' failed (exit #{exit_code}): #{error_msg}"}
      end
    else
      {:error, "Python script not found: #{script}"}
    end
  end
end
