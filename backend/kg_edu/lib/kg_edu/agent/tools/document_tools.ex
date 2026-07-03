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
      course_name = Map.get(params, "courseName") || params[:courseName]
      course_id = Map.get(params, "courseId") || params[:courseId]
      chapter_id = Map.get(params, "chapterId") || params[:chapterId]
      knowledge_id = Map.get(params, "knowledgeResourceId") || params[:knowledgeResourceId]
      knowledge_name = Map.get(params, "knowledgeName") || params[:knowledgeName]
      author = (Map.get(params, "author") || params[:author]) || "KgEdu"
      user_req = (Map.get(params, "userRequirements") || params[:userRequirements]) || ""

      # Fallback: auto-fill from previous tool calls when Qwen passes empty args
      course_id = if blank?(course_id), do: KgEdu.Agent.SessionContext.get(:last_course_id), else: course_id
      course_name = if blank?(course_name), do: KgEdu.Agent.SessionContext.get(:last_course_name), else: course_name
      
      # Try chapterId from context, but only if GetChapters was called and there's exactly one plausible chapter
      chapter_id = if blank?(chapter_id) do
        chapters = KgEdu.Agent.SessionContext.get(:last_chapters) || []
        # Only auto-pick if there's exactly one top-level chapter (avoids guessing wrong)
        roots = Enum.filter(chapters, &is_nil(&1.parentChapterId))
        if length(roots) == 1, do: hd(roots).id, else: chapter_id
      else
        chapter_id
      end

      if blank?(chapter_id) && blank?(knowledge_id) && blank?(knowledge_name) && user_req == "" do
        # List available chapters to help LLM retry with correct args
        chapters = KgEdu.Agent.SessionContext.get(:last_chapters) || []
        roots = Enum.filter(chapters, &is_nil(&1.parentChapterId))
        hint = if roots != [] do
          "\n可用章节: " <> (roots |> Enum.map(fn c -> "#{c.title}(ID:#{c.id})" end) |> Enum.join(", "))
        else
          ""
        end
        {:ok, %{result: "请传入 chapterId 参数。可调用 GetChapters 获取章节列表。#{hint}"}}
      else
        do_generate(course_name, course_id, chapter_id, knowledge_name, knowledge_id, user_req, author, params)
      end
    end

    defp blank?(nil), do: true
    defp blank?(""), do: true
    defp blank?(_), do: false

    defp do_generate(course_name, course_id, chapter_id, knowledge_name, knowledge_id, user_req, author, params) do
      # Build slide content
      slides = build_slides(course_name, chapter_id, knowledge_name, knowledge_id, user_req)
      output_dir = System.tmp_dir!()

      # Build filename
      file_name =
        cond do
          knowledge_name -> "#{course_name}-#{knowledge_name}.pptx"
          chapter_id && course_name != "未命名课程" -> "#{course_name}-#{get_chapter_title(chapter_id) || "章节"}.pptx"
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

      chapter = KgEdu.Agent.DataAccess.get_chapter(chapter_id)

      if is_nil(chapter) do
        Logger.warning("[DocumentTools.PPTX] Chapter not found: #{chapter_id}")
        build_slides_from_knowledge(course_name, nil, nil, user_req)
      else
        # Enrich subchapters with their own subchapters (2 levels deep)
        chapter = enrich_subchapters(chapter)

        chapter_title = chapter.title
        chapter_desc = chapter.description || ""
        subchapters = Map.get(chapter, :subchapters) || []

        # Try LLM enrichment for richer slide content
        llm_slides = try_llm_enrichment(course_name, chapter_title, subchapters)

        slides = []

        # 1. Title slide
        slides = slides ++ [
          %{
            "title" => "#{course_name}",
            "content" => "#{course_name}\n#{chapter_title}",
            "bullets" => ["课程章节教学课件"]
          }
        ]

        # 2. Chapter overview
        desc_lines =
          if chapter_desc != "" do
            String.split(chapter_desc, "\n") |> Enum.reject(&(&1 == ""))
          else
            []
          end

        overview_bullets =
          if desc_lines != [] do
            Enum.take(desc_lines, 6)
          else
            ["本章节为「#{chapter_title}」，包含 #{length(subchapters)} 个子章节"] ++
              Enum.map(subchapters, fn s -> s.title end)
          end

        slides = slides ++ [
          %{
            "title" => chapter_title,
            "content" => "#{chapter_title} — 章节概述",
            "bullets" => overview_bullets
          }
        ]

        # 3. Subchapter detail slides — LLM enriched or fallback
        sub_slides =
          if llm_slides != [] do
            llm_slides
          else
            build_fallback_subchapter_slides(chapter_title, subchapters)
          end

        slides = slides ++ sub_slides

        # 4. Summary slide
        slides = slides ++ [
          %{
            "title" => "本章小结",
            "content" => "#{chapter_title} · 内容回顾",
            "bullets" =>
              ["本章「#{chapter_title}」主要内容："] ++
                Enum.map(subchapters, fn s ->
                  sub_count = length(Map.get(s, :subchapters) || [])
                  suffix = if sub_count > 0, do: "（含 #{sub_count} 个知识点）", else: ""
                  "#{s.title}#{suffix}"
                end)
          }
        ]

        # 5. Custom user requirements
        paragraphs = split_paragraphs(user_req)
        if paragraphs != [] do
          slides = slides ++ paragraphs_to_slides(paragraphs)
        end

        slides
      end
    end

    # ── LLM enrichment ───────────────────────────────────────────────────────

    defp try_llm_enrichment(course_name, chapter_title, subchapters) do
      if subchapters == [] or !api_key_available?() do
        Logger.info("[PPTX] LLM enrichment skipped: subs=#{length(subchapters)}, key=#{api_key_available?() != nil}")
        []
      else
        Logger.info("[PPTX] Starting LLM enrichment for #{length(subchapters)} subchapters")
        prompt = build_enrichment_prompt(course_name, chapter_title, subchapters)
        Logger.info("[PPTX] Enrichment prompt: #{String.length(prompt)} chars")
        case call_llm_for_content(prompt) do
          {:ok, text} ->
            Logger.info("[PPTX] LLM response: #{String.length(text)} chars")
            slides = parse_llm_slides(text, chapter_title)
            Logger.info("[PPTX] Parsed #{length(slides)} slides from LLM")
            slides
          err ->
            Logger.warning("[PPTX] LLM enrichment failed: #{inspect(err)}")
            []
        end
      end
    end

    defp api_key_available? do
      System.get_env("DASHSCOPE_API_KEY") || System.get_env("QWEN_API_KEY")
    end

    defp build_enrichment_prompt(course_name, chapter_title, subchapters) do
      structure = format_chapter_tree_for_prompt(subchapters, 0)
      sub_count = length(subchapters)
      total_leaves = count_leaf_subchapters(subchapters)

      """
      你是课程PPT课件内容生成专家。请根据以下课程信息，为每个子章节生成教学PPT内容。

      课程名称：#{course_name}
      章节名称：#{chapter_title}
      子章节数量：#{sub_count} 个（共 #{total_leaves} 个知识点）

      章节结构：
      #{structure}

      请为每个子章节生成PPT内容。要求：
      1. 用 "## 子章节名" 标记每个子章节
      2. 用 "### PPT标题" 给每一页PPT命名，内容较多的子章节用多个 ### 分页，每页3-5条要点
      3. 用 "- " 列出每页的内容要点
      4. 结构深、知识点多的子章节拆成2-3页，简单子章节1页即可
      5. 要点要结合课程#{course_name}和章节#{chapter_title}的上下文展开，不要空洞
      6. 语言专业、适合教学使用

      示例格式：
      ## 平面构成中的点
      ### 基础概念：点的形态与性格
      - 点是最基本的造型元素...
      - 点的分类与视觉特征...
      ### 专业应用：点在设计实践中的运用
      - 版式设计中的点...
      - 品牌视觉中的点...

      直接输出内容，不要输出"好的"、"以下是"等开头语，不要输出代码块标记。
      """
    end

    defp format_chapter_tree_for_prompt(subchapters, depth) do
      indent = String.duplicate("  ", depth)
      subchapters
      |> Enum.map(fn s ->
        line = "#{indent}- #{s.title}"
        subs = Map.get(s, :subchapters) || []
        if subs != [] do
          line <> "\n" <> format_chapter_tree_for_prompt(subs, depth + 1)
        else
          line
        end
      end)
      |> Enum.join("\n")
    end

    defp count_leaf_subchapters(subchapters) do
      subchapters
      |> Enum.map(fn s ->
        subs = Map.get(s, :subchapters) || []
        if subs == [], do: 1, else: count_leaf_subchapters(subs)
      end)
      |> Enum.sum()
    end

    defp call_llm_for_content(prompt) do
      try do
        result = KgEdu.Chat.run_answer(prompt,
          KgEdu.Chat.qa_config(
            model: :qwen,
            system_prompt: "你是课程PPT课件内容生成专家。根据课程章节结构生成专业的教学PPT内容。直接输出内容，不添加额外说明。",
            max_iterations: 1
          )
        )
        text = result.result || ""
        if text != "", do: {:ok, text}, else: :empty
      rescue
        e ->
          Logger.warning("[DocumentTools.PPTX] LLM enrichment failed: #{inspect(e)}")
          :error
      end
    end

    defp parse_llm_slides(text, chapter_title) do
      text
      |> String.split(~r/\n## /)
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.flat_map(fn section ->
        lines = String.split(section, "\n") |> Enum.map(&String.trim/1) |> Enum.reject(&(&1 == ""))
        case lines do
          [] -> []
          [title | rest] ->
            # title = subchapter name (from "## ")
            # Parse multiple ### blocks within this subchapter
            slides = parse_sub_sections(title, rest, chapter_title)
            slides
        end
      end)
      |> split_overflow_slides()
    end

    # Parse multiple ### sections within a ## subchapter
    defp parse_sub_sections(subchapter_name, lines, chapter_title) do
      # Group lines by ### markers
      {groups, _current} =
        lines
        |> Enum.reduce({[], nil}, fn line, {groups, current} ->
          if String.starts_with?(line, "### ") do
            # New ### section — flush current, start new
            ppt_title = String.replace_leading(line, "### ", "")
            new_current = %{title: ppt_title, bullets: []}
            if current, do: {[current | groups], new_current}, else: {groups, new_current}
          else
            if String.starts_with?(line, "- ") do
              bullet = String.replace_leading(line, "- ", "") |> String.trim()
              if current do
                {groups, %{current | bullets: current.bullets ++ [bullet]}}
              else
                {groups, %{title: subchapter_name, bullets: [bullet]}}
              end
            else
              {groups, current}
            end
          end
        end)

      # Flush last group
      all_groups = if _current, do: [_current | groups], else: groups
      all_groups = Enum.reverse(all_groups)

      # If no ### markers at all, treat all bullets as one slide
      if all_groups == [] do
        bullets = lines |> Enum.filter(&String.starts_with?(&1, "- ")) |> Enum.map(fn l -> String.replace_leading(l, "- ", "") |> String.trim() end)
        if bullets != [] do
          [%{"title" => subchapter_name, "content" => "#{chapter_title} · #{subchapter_name}", "bullets" => bullets}]
        else
          []
        end
      else
        # Convert groups to slides
        Enum.map(all_groups, fn g ->
          %{
            "title" => g.title,
            "content" => "#{chapter_title} · #{g.title}",
            "bullets" => g.bullets
          }
        end)
      end
    end

    # ── Fallback split: any slide with >5 bullets gets split ──────────────────

    defp split_overflow_slides(slides) do
      slides
      |> Enum.flat_map(fn slide ->
        bullets = slide["bullets"] || []
        if length(bullets) > 5 do
          chunks = Enum.chunk_every(bullets, 5)
          chunks
          |> Enum.with_index(1)
          |> Enum.map(fn {chunk, idx} ->
            suffix = if length(chunks) > 1, do: "（#{idx}/#{length(chunks)}）", else: ""
            %{
              "title" => "#{slide["title"]}#{suffix}",
              "content" => "#{slide["content"]}#{suffix}",
              "bullets" => chunk
            }
          end)
        else
          [slide]
        end
      end)
    end

    # ── Fallback: basic slides from structure (no LLM) ────────────────────────

    defp build_fallback_subchapter_slides(chapter_title, subchapters) do
      subchapters
      |> Enum.map(fn s ->
        bullets = []
        bullets = if s.description, do: bullets ++ String.split(s.description, "\n"), else: bullets

        sub_subs = Map.get(s, :subchapters) || []
        bullets =
          if sub_subs != [] do
            bullets ++ (sub_subs |> Enum.map(fn ss ->
              desc_suffix = if ss.description, do: "：#{String.slice(ss.description, 0, 80)}", else: ""
              "#{ss.title}#{desc_suffix}"
            end))
          else
            bullets
          end

        if bullets == [] do
          bullets = ["#{chapter_title} — #{s.title}"]
        end

        %{
          "title" => s.title,
          "content" => "#{chapter_title} · #{s.title}",
          "bullets" => Enum.take(bullets, 8)
        }
      end)
    end

    # Load sub-subchapters for richer slide content
    defp enrich_subchapters(chapter) do
      subs = Map.get(chapter, :subchapters) || []
      enriched = Enum.map(subs, fn s ->
        full = KgEdu.Agent.DataAccess.get_chapter(s.id)
        if full, do: full, else: s
      end)
      Map.put(chapter, :subchapters, enriched)
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
