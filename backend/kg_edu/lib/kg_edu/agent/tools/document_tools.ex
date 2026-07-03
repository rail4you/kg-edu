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
      description: "生成PPT课件。支持按课程/知识点/章节生成。传入chapterId时会自动获取章节内容构建PPT。",
      schema:
        Zoi.object(%{
          courseName: Zoi.string(description: "课程名称") |> Zoi.optional(),
          courseId: Zoi.string(description: "课程ID") |> Zoi.optional(),
          chapterId: Zoi.string(description: "章节ID — 传入后自动获取章节内容生成PPT") |> Zoi.optional(),
          knowledgeResourceId: Zoi.string(description: "知识资源ID") |> Zoi.optional(),
          knowledgeName: Zoi.string(description: "知识点名称") |> Zoi.optional(),
          userRequirements: Zoi.string(description: "用户自定义幻灯内容（可选），每段一页，空行分页。首行标题，后续行要点") |> Zoi.optional(),
          author: Zoi.string(description: "作者") |> Zoi.optional()
        })

    @impl true
    def run(params, _context) do
      course_name = params[:courseName] || "未命名课程"
      knowledge_id = params[:knowledgeResourceId]
      knowledge_name = params[:knowledgeName]
      chapter_id = params[:chapterId]
      author = params[:author] || "KgEdu"
      user_req = params[:userRequirements] || ""

      # Build slide content
      slides = build_slides(course_name, chapter_id, knowledge_name, knowledge_id, user_req)
      output_dir = System.tmp_dir!()

      # Build filename
      file_name =
        cond do
          knowledge_name -> "#{course_name}-#{knowledge_name}.pptx"
          chapter_id && course_name -> "#{course_name}-#{get_chapter_title(chapter_id) || "章节"}.pptx"
          true -> "#{course_name}.pptx"
        end

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
              save_record(params, file_name, url, file_size, "pptx")
              {:ok, %{result: "PPT课件「#{file_name}」已生成！\n下载链接: #{url}", fileUrl: url}}

            {:error, reason} ->
              {:ok, %{result: "PPT课件已生成（本地: #{file_path}）。上传失败: #{reason}", localPath: file_path}}
          end

        {:ok, raw} ->
          {:error, "PPT生成脚本返回异常: #{inspect(raw)}"}

        {:error, reason} ->
          {:error, "PPT生成失败: #{reason}"}
      end
    end

    # ── Slide builder ────────────────────────────────────────────────────────

    defp build_slides(course_name, chapter_id, knowledge_name, knowledge_id, user_req) do
      # If chapterId is provided, auto-fetch chapter content
      if chapter_id do
        build_slides_from_chapter(course_name, chapter_id, user_req)
      else
        # Original logic: from knowledge resource or user requirements
        build_slides_from_knowledge(course_name, knowledge_name, knowledge_id, user_req)
      end
    end

    # ── Build slides from chapter content ────────────────────────────────────

    defp build_slides_from_chapter(course_name, chapter_id, user_req) do
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)

      # Fetch chapter with knowledge resources
      chapter = KgEdu.Agent.DataAccess.get_chapter(chapter_id)

      if is_nil(chapter) do
        Logger.warning("[DocumentTools.PPTX] Chapter not found: #{chapter_id}")
        build_slides_from_knowledge(course_name, nil, nil, user_req)
      else
        chapter_title = chapter.title
        chapter_desc = chapter.description || ""

        # Fetch knowledge resources for this chapter
        resources = KgEdu.Agent.DataAccess.list_knowledge_resources(nil, chapter_id)

        # Build slides
        # 1. Title slide: course + chapter
        # 2. Chapter overview
        # 3. Per-knowledge-resource slides

        slides = [
          %{
            "title" => "#{course_name} · #{chapter_title}",
            "content" => "#{course_name} — #{chapter_title}",
            "bullets" => [chapter_desc] |> Enum.reject(&(&1 == ""))
          }
        ]

        # Knowledge resource slides
        resource_slides =
          resources
          |> Enum.map(fn r ->
            bullets = []
            bullets = if r.description, do: bullets ++ [r.description], else: bullets
            bullets = if r.teachingGoal, do: bullets ++ [r.teachingGoal], else: bullets

            %{
              "title" => r.name,
              "content" => r.name,
              "bullets" => Enum.take(bullets, 6)
            }
          end)

        slides = slides ++ resource_slides

        # If user also provided custom requirements, append as additional slides
        paragraphs = split_paragraphs(user_req)
        if paragraphs != [] do
          custom_slides = paragraphs_to_slides(paragraphs)
          slides = slides ++ custom_slides
        end

        slides
      end
    end

    # ── Build slides from knowledge resource data ────────────────────────────

    defp build_slides_from_knowledge(course_name, knowledge_name, knowledge_id, user_req) do
      paragraphs = split_paragraphs(user_req || "")

      Logger.debug("[DocumentTools.PPTX] paragraphs: #{length(paragraphs)}, knowledge_name=#{inspect(knowledge_name)}")

      knowledge_bullets = get_knowledge_content(knowledge_id)

      # Build overview slide
      slides = [
        %{
          "title" => "课程概览",
          "content" => "#{course_name}课程知识体系与教学目标",
          "bullets" => Enum.take(knowledge_bullets, 5)
        }
      ]

      # Build content slides from paragraphs
      slides =
        if paragraphs != [] do
          slides ++ paragraphs_to_slides(paragraphs)
        else
          # No paragraphs — add detail slide from knowledge data
          detail_slides = build_fallback_slides(knowledge_name, knowledge_bullets)
          slides ++ detail_slides
        end

      slides
    end

    defp paragraphs_to_slides(paragraphs) do
      paragraphs
      |> Enum.with_index()
      |> Enum.map(fn {para, _idx} ->
        lines = String.split(para, "\n") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))

        case lines do
          [title | body_lines] when body_lines != [] ->
            %{
              "title" => title,
              "content" => title,
              "bullets" => Enum.take(body_lines, 6)
            }

          [title] ->
            %{
              "title" => title,
              "content" => title,
              "bullets" => []
            }

          [] ->
            nil
        end
      end)
      |> Enum.reject(&is_nil/1)
    end

    defp build_fallback_slides(nil, _bullets), do: []

    defp build_fallback_slides(knowledge_name, knowledge_bullets) do
      detail_bullets =
        if knowledge_bullets != [] do
          Enum.take(knowledge_bullets, 8)
        else
          ["请参考课程资料获取详细内容"]
        end

      [
        %{
          "title" => knowledge_name,
          "content" => "知识点详解：#{knowledge_name}",
          "bullets" => detail_bullets
        }
      ]
    end

    defp split_paragraphs(text) do
      # Normalize \\n escape sequences to real newlines
      normalized = String.replace(text, "\\n", "\n")
      # Split by double-newline (paragraph boundaries)
      normalized
      |> String.split("\n\n")
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
    end

    defp get_knowledge_content(nil), do: []

    defp get_knowledge_content(knowledge_id) do
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
      if not tenant, do: []

      case Ash.get(KgEdu.Knowledge.Resource, knowledge_id, tenant: tenant, authorize?: false) do
        {:ok, resource} when not is_nil(resource) ->
          lines = []
          lines = if resource.description, do: lines ++ String.split(resource.description, "\n"), else: lines
          lines = if resource.teaching_goal, do: lines ++ String.split(resource.teaching_goal, "\n"), else: lines
          lines |> Enum.reject(&(&1 == ""))

        _ -> []
      end
    rescue
      _ -> []
    end

    defp get_chapter_title(chapter_id) do
      tenant = KgEdu.Agent.DataAccess.resolve_tenant(nil)
      chapter = KgEdu.Agent.DataAccess.get_chapter(chapter_id)
      chapter && chapter.title
    rescue
      _ -> nil
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

  # ── Script runners ────────────────────────────────────────────────────

  def safe_upload(file_path) do
    KgEdu.Agent.OssUpload.upload(file_path)
  rescue
    e -> {:error, Exception.message(e)}
  end

  def run_js_script(script_name, json_input) do
    tools_dir = Application.app_dir(:kg_edu, "priv/skills/document/tools")
    script = Path.join(tools_dir, script_name)

    if File.exists?(script) do
      # Build NODE_PATH for pptxgenjs resolution:
      # 1. System env NODE_PATH (Docker: /usr/local/lib/node_modules)
      # 2. agent-server/node_modules (dev env)
      # 3. Global npm prefix
      node_paths =
        [
          System.get_env("NODE_PATH"),
          # Dev: find agent-server/node_modules relative to the app
          (Application.app_dir(:kg_edu)
           |> Path.dirname()
           |> Path.dirname()
           |> Path.join("agent-server/node_modules")
           |> Path.expand()
           |> then(fn p -> if File.dir?(p), do: p, else: nil end)),
          # Global npm node_modules
          "/usr/local/lib/node_modules"
        ]
        |> Enum.reject(&is_nil/1)
        |> Enum.join(":")

      env = [{"NODE_PATH", node_paths}]

      case System.cmd("bun", [script, json_input], env: env, stderr_to_stdout: true) do
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
end
