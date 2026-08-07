defmodule KgEdu.Agent.VideoProcessor do
  @moduledoc """
  ffmpeg/ffprobe 封装：数字人视频处理核心。

  能力：
    - probe/1        读取媒体信息（时长/分辨率/编码/码率/帧率）
    - chroma_key/2   一键抠像（绿/蓝/白/黑/红/自定义色，多参数可调）
    - compose/3      背景图 + 人像透明 PNG 合成场景图
    - concat/2       多段视频拼接
    - transcode/2    格式/编码/码率/帧率转换（MP4/MOV/TS/MKV × H264/H265/MPEG-4/MPEG-2）
    - extract_frame/2 视频抽帧

  所有函数均基于 `ffmpeg` / `ffprobe` CLI。
  """

  require Logger

  @ffmpeg System.get_env("FFMPEG_PATH", "ffmpeg")
  @ffprobe System.get_env("FFPROBE_PATH", "ffprobe")

  # ── 媒体信息 ─────────────────────────────────────────────────────────

  @doc """
  读取媒体文件信息。返回 `{:ok, map}` 或 `{:error, reason}`。

  map 字段：format, duration, width, height, video_codec, audio_codec, bit_rate, fps
  """
  def probe(path) when is_binary(path) do
    if not File.exists?(path) do
      {:error, "文件不存在: #{path}"}
    else
      cmd = [
        @ffprobe,
        "-v", "error",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        path
      ]

      case System.cmd(@ffprobe, List.delete_at(cmd, 0), stderr_to_stdout: true) do
        {output, 0} ->
          case Jason.decode(output) do
            {:ok, data} ->
              {:ok, parse_probe(data)}

            {:error, e} ->
              {:error, "解析媒体信息失败: #{inspect(e)}"}
          end

        {output, code} ->
          {:error, "ffprobe 失败 (#{code}): #{String.slice(output, 0, 500)}"}
      end
    end
  end

  defp parse_probe(%{"format" => format, "streams" => streams}) do
    video = Enum.find(streams, &(&1["codec_type"] == "video"))
    audio = Enum.find(streams, &(&1["codec_type"] == "audio"))

    %{
      format: format["format_name"],
      duration: parse_float(format["duration"]),
      width: video && video["width"],
      height: video && video["height"],
      video_codec: video && video["codec_name"],
      audio_codec: audio && audio["codec_name"],
      bit_rate: parse_int(format["bit_rate"]),
      fps: video && parse_fps(video["avg_frame_rate"] || video["r_frame_rate"])
    }
  end

  defp parse_float(nil), do: nil
  defp parse_float(v) when is_number(v), do: v
  defp parse_float(v) when is_binary(v), do: Float.parse(v) |> elem(0)
  defp parse_float(_), do: nil

  defp parse_int(nil), do: nil
  defp parse_int(v) when is_integer(v), do: v
  defp parse_int(v) when is_binary(v), do: v |> Integer.parse() |> elem(0)
  defp parse_int(_), do: nil

  defp parse_fps(nil), do: nil

  defp parse_fps(rate) do
    case String.split(to_string(rate), "/") do
      [a, b] ->
        x = Integer.parse(a) |> elem(0)
        y = Integer.parse(b) |> elem(0)
        if x && y && y != 0, do: round(x / y * 100) / 100, else: nil

      [a] ->
        Integer.parse(a) |> elem(0)

      _ ->
        nil
    end
  end

  # ── 一键抠像 ─────────────────────────────────────────────────────────

  @doc """
  一键抠像（广播级）。

  opts:
    - color:      目标颜色，green/blue/white/black/red 或 0xRRGGBB，默认 green
    - similarity: 相似度 0.00~1.00，默认 0.4
    - blend:      混合度 0.00~1.00，默认 0.1
    - yuv:        1=chromakey(YUV) 0=colorkey(RGB)，默认 1
    - despill:    去溢色 0/1，默认 0

  返回 `{:ok, output_path}`（透明 PNG），或 `{:error, reason}`。
  """
  def chroma_key(input_path, opts \\ []) do
    color = Keyword.get(opts, :color, "green") |> normalize_color()
    similarity = Keyword.get(opts, :similarity, 0.4)
    blend = Keyword.get(opts, :blend, 0.1)
    yuv = Keyword.get(opts, :yuv, 1)
    despill = Keyword.get(opts, :despill, 0)

    output = tmp_output(input_path, "png")

    filter =
      if yuv == 1 do
        "chromakey=#{color}:similarity=#{similarity}:blend=#{blend}:yuv=1"
      else
        "colorkey=#{color}:#{similarity}:#{blend}"
      end

    filter =
      if despill == 1 and yuv == 1 do
        # 去溢色：先 chromakey，再 despill 去除边缘绿色
        "#{filter},despill=green"
      else
        filter
      end

    run_ffmpeg([
      "-y",
      "-i", input_path,
      "-vf", filter,
      "-c:v", "png",
      output
    ], output)
  end

  @doc """
  背景 + 人像透明 PNG 合成场景图。

  opts:
    - x / y:  人像位置，默认居中
    - scale:  人像缩放（如 "0.8" 或 "400:-1"）
  """
  def compose(bg_path, person_path, opts \\ []) do
    x = Keyword.get(opts, :x)
    y = Keyword.get(opts, :y)
    scale = Keyword.get(opts, :scale)

    output = tmp_output(bg_path, "jpg")

    overlay =
      if x && y, do: "overlay=x=#{x}:y=#{y}", else: "overlay=x=(W-w)/2:y=(H-h)/2"

    # 人像按高度适配：默认占背景高度 85%，保证人物主体完整可被检测
    person_scale =
      scale ||
        case probe_dimensions(bg_path) do
          {:ok, {_w, h}} -> "scale=-1:#{max(round(h * 0.85), 200)}"
          _ -> "scale=-1:612"
        end

    person_chain = "format=rgba,#{person_scale}"
    filter_complex = "[1:v]#{person_chain}[fg];[0:v][fg]#{overlay}"

    run_ffmpeg([
      "-y",
      "-i", bg_path,
      "-i", person_path,
      "-filter_complex", filter_complex,
      "-frames:v", "1",
      "-q:v", "2",
      output
    ], output)
  end

  defp probe_dimensions(path) do
    case System.cmd(@ffprobe,
           ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
            "-of", "csv=s=x:p=0", path],
           stderr_to_stdout: true
         ) do
      {out, 0} ->
        case String.trim(out) |> String.split("x") |> Enum.map(&String.to_integer/1) do
          [w, h] when w > 0 and h > 0 -> {:ok, {w, h}}
          _ -> :error
        end

      _ ->
        :error
    end
  end

  # ── 拼接 ─────────────────────────────────────────────────────────────

  @doc """
  多段视频拼接。`paths` 为视频文件路径列表，要求编码一致（建议同源生成）。

  返回 `{:ok, output_path}`。
  """
  def concat(paths, opts \\ []) when is_list(paths) do
    output = Keyword.get(opts, :output) || tmp_output(List.first(paths) || "concat", "mp4")

    # 先统一转码为相同编码/参数，避免 concat demuxer 失败
    {_uniform, tmp_paths} =
      paths
      |> Enum.map_reduce([], fn p, acc ->
        uniform_path = tmp_output(p, "ts")
        {:ok, _} = transcode(p, uniform_path, format: "mpegts", codec: "h264", audio_codec: "aac")
        {uniform_path, [uniform_path | acc]}
      end)

    list_file = tmp_output("concat_list_#{System.unique_integer([:positive])}", "txt")
    content = Enum.map_join(tmp_paths, "\n", &"file '#{&1}'")
    File.write!(list_file, content)

    result =
      run_ffmpeg([
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file,
        "-c", "copy",
        output
      ], output)

    Enum.each(tmp_paths, &File.rm/1)
    File.rm(list_file)
    result
  end

  # ── 转码/导出 ────────────────────────────────────────────────────────

  @doc """
  视频转码导出。

  opts:
    - format:  mp4/mov/ts/mkv，默认 mp4
    - codec:   h264/h265/mpeg4/mpeg2，默认 h264
    - bitrate: 码率字符串或 Mbps 数字（1~100），如 "8M"
    - fps:     帧率，如 30
    - audio_codec: 默认 aac
  """
  def transcode(input_path, opts \\ []) when is_list(opts) do
    output = Keyword.fetch!(opts, :output) || tmp_output(input_path, export_ext(Keyword.get(opts, :format, "mp4")))
    do_transcode(input_path, output, opts)
  end

  def transcode(input_path, output, opts) when is_binary(output) do
    do_transcode(input_path, output, opts)
  end

  defp do_transcode(input_path, output, opts) do
    format = Keyword.get(opts, :format, "mp4")
    codec = Keyword.get(opts, :codec, "h264")
    bitrate = normalize_bitrate(Keyword.get(opts, :bitrate))
    fps = Keyword.get(opts, :fps)
    audio_codec = Keyword.get(opts, :audio_codec, "aac")

    vcodec =
      case codec do
        "h265" -> "libx265"
        "hevc" -> "libx265"
        "mpeg4" -> "mpeg4"
        "mpeg2" -> "mpeg2video"
        _ -> "libx264"
      end

    args = ["-y", "-i", input_path, "-c:v", vcodec]

    args =
      if format == "mp4" and codec in ["h265", "hevc"] do
        args ++ ["-tag:v", "hvc1"]
      else
        args
      end

    args =
      if bitrate do
        args ++ ["-b:v", bitrate, "-maxrate", bitrate, "-bufsize", "#{2 * parse_bitrate_mb(bitrate)}M"]
      else
        args
      end

    args = if fps, do: args ++ ["-r", to_string(fps)], else: args
    args = args ++ ["-c:a", audio_codec, "-b:a", "128k"]
    args = args ++ ["-f", format, output]

    run_ffmpeg(args, output)
  end

  # ── 抽帧 ─────────────────────────────────────────────────────────────

  @doc """
  从视频/图片提取一帧为 jpg（PPT 页面作为画面时可用）。
  """
  def extract_frame(input_path, opts \\ []) do
    ss = Keyword.get(opts, :ss, 0)
    output = Keyword.get(opts, :output) || tmp_output(input_path, "jpg")

    run_ffmpeg([
      "-y",
      "-i", input_path,
      "-ss", to_string(ss),
      "-frames:v", "1",
      "-q:v", "2",
      output
    ], output)
  end

  # ── 内部工具 ─────────────────────────────────────────────────────────

  defp run_ffmpeg(args, output) do
    case System.cmd(@ffmpeg, args, stderr_to_stdout: true) do
      {_output, 0} ->
        {:ok, output}

      {output, code} ->
        File.rm(output)
        {:error, "ffmpeg 失败 (#{code}): #{String.slice(output, -500, 500)}"}
    end
  end

  defp normalize_color(color) when is_binary(color) do
    case String.downcase(color) do
      "green" -> "green"
      "blue" -> "blue"
      "white" -> "white"
      "black" -> "black"
      "red" -> "red"
      "0x" <> _ -> color
      "#" <> hex -> "0x" <> hex
      other -> other
    end
  end

  defp normalize_color(color), do: to_string(color)

  defp normalize_bitrate(nil), do: nil
  defp normalize_bitrate(b) when is_binary(b), do: b
  defp normalize_bitrate(mbps) when is_number(mbps), do: "#{round(mbps)}M"

  defp parse_bitrate_mb(bitrate) do
    case bitrate do
      b when is_binary(b) ->
        case Integer.parse(b) do
          {n, _} -> n
          _ -> 8
        end

      _ ->
        8
    end
  end

  defp export_ext("mov"), do: "mov"
  defp export_ext("ts"), do: "ts"
  defp export_ext("mkv"), do: "mkv"
  defp export_ext(_), do: "mp4"

  defp tmp_output(input, ext) do
    name = Path.basename(input, Path.extname(input))
    Path.join(System.tmp_dir!(), "#{name}_#{System.unique_integer([:positive])}.#{ext}")
  end
end
