defmodule KgEdu.Agent.ScriptParser do
  @moduledoc """
  镜头脚本解析：
    - parse_txt/1：按空行分段 → 每段一个镜头（台词 + 页面文字）
    - parse_pptx/2：解包 pptx → 每页一个镜头（页面文字 = 画面背景，
      备注文字 = 台词）；页面渲染为 PNG 作为背景图
  """

  require Logger

  @doc """
  解析 TXT 文稿。按空行（`\n\n`）或 `---` 分隔线分段。

  返回 `{:ok, scenes}`，每项：
    %{title, text, page_text, bg_color, person_image_url, voice, status}
  """
  def parse_txt(content) when is_binary(content) do
    segments =
      content
      |> String.replace("\r\n", "\n")
      |> String.split(~r/\n\s*\n|\n-{3,}\n/)
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))

    scenes =
      segments
      |> Enum.with_index(1)
      |> Enum.map(fn {seg, i} ->
        %{
          "id" => Ecto.UUID.generate(),
          "title" => "镜头#{i}",
          "text" => seg,
          "page_text" => seg,
          "bg_color" => "#1e3a5f",
          "person_image_url" => nil,
          "voice" => "longanyang",
          "status" => "pending",
          "audio_url" => nil,
          "scene_image_url" => nil,
          "video_url" => nil,
          "dashscope_task_id" => nil,
          "error" => nil
        }
      end)

    {:ok, scenes}
  end

  @doc """
  解析 PPTX 文件。

  pptx_path: 本地文件路径
  opts:
    - upload_page_images: 是否将页面渲染为 PNG 并上传 OSS（默认 true）

  每页：page_text = 页面文字（画面背景），text = 备注文字（台词，若无备注则用页面文字）。
  """
  def parse_pptx(pptx_path, opts \\ []) do
    with {:ok, files} <- read_zip(pptx_path) do
      slides = extract_slides(files)
      notes = extract_notes(files)

      render_images? = Keyword.get(opts, :upload_page_images, true)

      scenes =
        Enum.with_index(slides, 1)
        |> Enum.map(fn {{num, text}, i} ->
          page_text = text |> Enum.join("\n") |> String.trim()
          note_text = Map.get(notes, num, "") |> String.trim()

          scene = %{
            "id" => Ecto.UUID.generate(),
            "title" => "镜头#{i}",
            "text" => if(note_text != "", do: note_text, else: page_text),
            "page_text" => page_text,
            "bg_color" => "#1e3a5f",
            "person_image_url" => nil,
            "voice" => "longanyang",
            "status" => "pending",
            "audio_url" => nil,
            "scene_image_url" => nil,
            "video_url" => nil,
            "dashscope_task_id" => nil,
            "error" => nil
          }

          if render_images? do
            case render_page_image(pptx_path, i) do
              {:ok, url} -> Map.put(scene, "bg_image_url", url)
              _ -> scene
            end
          else
            scene
          end
        end)

      {:ok, scenes}
    end
  end

  # ── pptx 解包 ────────────────────────────────────────────────────────

  defp read_zip(path) do
    case File.read(path) do
      {:ok, binary} ->
        case :zip.extract(binary, [:memory]) do
          {:ok, files} ->
            files =
              Enum.map(files, fn {name, content} ->
                {to_string(name), content}
              end)

            {:ok, files}

          {:error, reason} ->
            {:error, "PPTX 解压失败: #{inspect(reason)}"}
        end

      {:error, reason} ->
        {:error, "读取文件失败: #{inspect(reason)}"}
    end
  end

  defp extract_slides(files) do
    files
    |> Enum.filter(fn {name, _} -> Regex.match?(~r/^ppt\/slides\/slide(\d+)\.xml$/, name) end)
    |> Enum.map(fn {name, xml} ->
      num = Regex.run(~r/slide(\d+)\.xml/, name) |> List.last() |> String.to_integer()
      {num, extract_texts(xml)}
    end)
    |> Enum.sort_by(&elem(&1, 0))
  end

  defp extract_notes(files) do
    files
    |> Enum.filter(fn {name, _} -> Regex.match?(~r/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/, name) end)
    |> Enum.reduce(%{}, fn {name, xml}, acc ->
      num = Regex.run(~r/notesSlide(\d+)\.xml/, name) |> List.last() |> String.to_integer()
      Map.put(acc, num, extract_texts(xml) |> Enum.join("\n"))
    end)
  end

  defp extract_texts(xml) do
    Regex.scan(~r/<a:t>([^<]*)<\/a:t>/, to_string(xml), capture: :all_but_first)
    |> List.flatten()
  end

  # ── 页面渲染（soffice → pdf → pymupdf → png → OSS）────────────────

  defp render_page_image(pptx_path, page_num) do
    workdir = Path.join(System.tmp_dir!(), "ppt_render_#{System.unique_integer([:positive])}")
    File.mkdir_p!(workdir)
    base = Path.basename(pptx_path, Path.extname(pptx_path))

    pdf_path = Path.join(workdir, "#{base}.pdf")

    soffice_result =
      System.cmd("soffice",
        ["--headless", "--convert-to", "pdf", "--outdir", workdir, pptx_path],
        stderr_to_stdout: true
      )

    case soffice_result do
      {_out, 0} ->
        png_path = Path.join(workdir, "page_#{page_num}.png")

        py_args = [
          "-c",
          """
          import fitz, sys
          doc = fitz.open(sys.argv[1])
          page = doc[#{page_num - 1}]
          pix = page.get_pixmap(dpi=110)
          pix.save(sys.argv[2])
          """,
          pdf_path,
          png_path
        ]

        case System.cmd("python3", py_args, stderr_to_stdout: true) do
          {_out, 0} ->
            result = KgEdu.Agent.OssUpload.upload(png_path)
            cleanup_dir(workdir)
            result

          {out, code} ->
            cleanup_dir(workdir)
            {:error, "页面渲染失败 (#{code}): #{String.slice(out, -300, 300)}"}
        end

      {out, code} ->
        cleanup_dir(workdir)
        {:error, "PPT 转 PDF 失败 (#{code}): #{String.slice(out, -300, 300)}"}
    end
  end

  defp cleanup_dir(dir) do
    File.rm_rf(dir)
  rescue
    _ -> :ok
  end
end
