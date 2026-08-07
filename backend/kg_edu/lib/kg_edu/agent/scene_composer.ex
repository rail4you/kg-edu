defmodule KgEdu.Agent.SceneComposer do
  @moduledoc """
  场景图合成：背景（纯色+文字 或 页面图片）+ 人像 → 场景图。

  流程：
    1. 背景图：
       - 有 bg_image_url（PPT 页面图）→ 直接下载
       - 否则用 render_text_bg.py 渲染「纯色 + 页面文字」背景
    2. 人像叠加：VideoProcessor.compose（居中 overlay）
  """

  require Logger

  @doc """
  合成场景图，返回 `{:ok, output_path}`。

  opts:
    - text: 背景文字（无 bg_image_url 时渲染）
    - bg_color: 背景色，默认 #1e3a5f
    - bg_image_url: 背景图片（优先于 text）
    - person_image_url: 人像图（必选）
    - width / height: 背景尺寸，默认 1280x720
    - scale: 人像缩放，默认 "0.55:-1"（按比例缩到宽度 55%）
  """
  def compose(opts) do
    person_url = Keyword.fetch!(opts, :person_image_url)

    with {:ok, bg_path} <- build_background(opts),
         {:ok, person_path} <- download(person_url) do
      result =
        KgEdu.Agent.VideoProcessor.compose(bg_path, person_path,
          scale: Keyword.get(opts, :scale, "0.55:-1")
        )

      File.rm(bg_path)
      File.rm(person_path)
      result
    end
  end

  # ── 背景 ─────────────────────────────────────────────────────────────

  defp build_background(opts) do
    case Keyword.get(opts, :bg_image_url) do
      url when is_binary(url) and url != "" ->
        download(url)

      _ ->
        render_text_background(opts)
    end
  end

  defp render_text_background(opts) do
    text = Keyword.get(opts, :text, "")
    bg_color = Keyword.get(opts, :bg_color, "#1e3a5f")
    width = Keyword.get(opts, :width, 1280)
    height = Keyword.get(opts, :height, 720)

    text_file = Path.join(System.tmp_dir!(), "scene_text_#{System.unique_integer([:positive])}.txt")
    output = Path.join(System.tmp_dir!(), "scene_bg_#{System.unique_integer([:positive])}.png")

    File.write!(text_file, text)

    args = [
      "priv/scripts/render_text_bg.py",
      bg_color,
      to_string(width),
      to_string(height),
      text_file,
      output
    ]

    case System.cmd("python3", args, cd: Path.expand("../../..", __DIR__), stderr_to_stdout: true) do
      {_out, 0} ->
        File.rm(text_file)
        {:ok, output}

      {out, code} ->
        File.rm(text_file)
        File.rm(output)
        {:error, "文字背景渲染失败 (#{code}): #{String.slice(out, -300, 300)}"}
    end
  end

  # ── 工具 ─────────────────────────────────────────────────────────────

  defp download(url) do
    tmp_path = Path.join(System.tmp_dir!(), "scene_#{System.unique_integer([:positive])}")

    case Req.get(url,
           connect_options: [timeout: 10_000],
           receive_timeout: 60_000,
           follow_redirects: true
         ) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        File.write!(tmp_path, body)
        {:ok, tmp_path}

      {:ok, %Req.Response{status: status}} ->
        {:error, "下载失败 (#{status})"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end
end
