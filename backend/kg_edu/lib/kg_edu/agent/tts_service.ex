defmodule KgEdu.Agent.TtsService do
  @moduledoc """
  P0: AI 语音合成（Qwen DashScope CosyVoice / Qwen-TTS）。

  - Key 复用 `ApiKeyConfig(provider="qwen")`，经 `ApiKeyProvider.get_key(:qwen)` 读取。
  - 支持多音色（男女声/情感 instruction）、语速、音量、多语言（中/英/日/西等，
    通过选择对应 voice 实现）。
  - 合成产物经 `OssUpload` 落盘，返回公网 URL，供听力题/口语测评题直接播放。
  """

  require Logger

  @endpoint "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"

  @default_model "cosyvoice-v3-flash"

  @doc """
  curated 音色表（前端下拉用；`synthesize/1` 实际透传 voice 字符串，
  也支持直接填 DashScope 官方 voice 名/复刻音色）。

  注意：这些为 `cosyvoice-v3-flash` / `cosyvoice-v3-plus` 的 v3 系统音色。
  v1/v2 音色（如 longxiaochun、longxiaoxia、longyuanyuan、longtaotao）与
  v3 模型不匹配，会返回引擎 418 错误，故不可混用。
  """
  def voices do
    [
      %{voice: "longanyang", label: "男声-龙安洋（男·标杆）", gender: "male", language: "zh,en"},
      %{voice: "longshuo_v3", label: "男声-龙硕（男·干练）", gender: "male", language: "zh,en"},
      %{voice: "longtian_v3", label: "男声-龙天（男·磁性）", gender: "male", language: "zh,en"},
      %{voice: "longcheng_v3", label: "男声-龙橙（男·智慧）", gender: "male", language: "zh,en"},
      %{voice: "longanhuan_v3", label: "女声-龙安欢（女·欢脱）", gender: "female", language: "zh,en"},
      %{voice: "longxiaoxia_v3", label: "女声-龙小夏（女·沉稳）", gender: "female", language: "zh,en"},
      %{voice: "longhua_v3", label: "女声-龙华（女·元气）", gender: "female", language: "zh,en"},
      %{voice: "longwan_v3", label: "女声-龙婉（女·柔声）", gender: "female", language: "zh,en"},
      %{voice: "longyan_v3", label: "女声-龙颜（女·温暖）", gender: "female", language: "zh,en"}
    ]
  end

  @doc """
  合成语音。

  opts:
  - `:text` (必填) 合成文本
  - `:voice` 默认 "longxiaochun"
  - `:model` 默认 "cosyvoice-v3-flash"（情感音色可用 "cosyvoice-v3-plus" / "qwen3-tts-flash"）
  - `:speech_rate` 语速 0.5~2.0，默认 1.0
  - `:volume` 音量 0~100，默认 50
  - `:language` 语言标记（zh/en/ja/es，仅透传记录+instruction 提示）
  - `:instruction` 情感/风格指令（如"用温柔的语气，适合听力考试"；部分模型支持）
  - `:tenant` / `:user_id` / `:course_id` 用于落 `File` 记录

  成功返回 `{:ok, %{url: url, file_id: id | nil}}`，失败 `{:error, reason}`。
  """
  def synthesize(opts) when is_list(opts) or is_map(opts) do
    opts = Map.new(opts)
    text = opts[:text] || opts["text"]

    cond do
      is_nil(text) or text == "" ->
        {:error, "合成文本不能为空"}

      String.length(text) > 2000 ->
        {:error, "合成文本过长（最多2000字符）"}

      true ->
        do_synthesize(text, opts)
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp do_synthesize(text, opts) do
    with {:ok, api_key} <- fetch_key() do
      voice = opts[:voice] || opts["voice"] || "longanyang"

      # DashScope HTTP NRT：voice / format / volume / rate / pitch 均放在 input 内，
      # 用 rate（非 speech_rate）。若按顶层 voice + parameters.speech_rate 传，
      # 引擎会返回 418。参考数字人项目的 TTS 客户端。
      input =
        %{
          "text" => text,
          "voice" => voice,
          "format" => "mp3",
          "sample_rate" => 24000,
          "volume" => opts[:volume] || opts["volume"] || 50,
          "rate" => opts[:speech_rate] || opts["speech_rate"] || 1.0,
          "pitch" => 1.0
        }

      input =
        case opts[:instruction] || opts["instruction"] do
          nil -> input
          instruction -> Map.put(input, "instruction", instruction)
        end

      body = %{
        "model" => opts[:model] || opts["model"] || @default_model,
        "input" => input
      }

      headers = %{
        "authorization" => "Bearer #{api_key}",
        "content-type" => "application/json"
      }

      case Req.post(@endpoint, json: body, headers: headers, receive_timeout: 60_000) do
        {:ok, %{status: status, body: resp_body}} when status in 200..299 ->
          handle_json_response(resp_body, opts)

        {:ok, %{status: status, body: resp_body}} ->
          {:error, "TTS 合成失败 (#{status}): #{truncate_resp(resp_body)}"}

        {:error, error} ->
          {:error, "TTS 请求异常: #{inspect(error)}"}
      end
    end
  end

  defp fetch_key do
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      key when is_binary(key) and key != "" -> {:ok, key}
      _ -> {:error, "未配置 Qwen API Key（请在后台 api_key_configs 中配置 provider=qwen）"}
    end
  end

  # 解析 DashScope JSON 响应，取出 output.audio.url 后下载音频并落盘。
  defp handle_json_response(resp_body, opts) when is_map(resp_body) do
    with url when is_binary(url) and url != "" <- get_in(resp_body, ["output", "audio", "url"]),
         {:ok, audio} <- download_audio(url) do
      save_and_upload(audio, opts)
    else
      _ -> {:error, "TTS 合成失败: #{truncate_resp(resp_body)}"}
    end
  end

  defp handle_json_response(resp_body, opts) do
    {:error, "TTS 响应解析失败: #{truncate_resp(resp_body)}"}
  end

  defp download_audio(url) do
    case Req.get(url, connect_options: [timeout: 10_000], receive_timeout: 60_000, redirect: true) do
      {:ok, %Req.Response{status: 200, body: body}} when is_binary(body) ->
        {:ok, body}

      {:ok, %Req.Response{status: status}} ->
        {:error, "音频下载失败 (#{status})"}

      {:error, reason} ->
        {:error, "音频下载失败: #{inspect(reason)}"}
    end
  end

  defp save_and_upload(audio_binary, opts) do
    tmp = Path.join(System.tmp_dir!(), "tts_#{System.unique_integer([:positive])}.mp3")
    File.write!(tmp, audio_binary)
    size = byte_size(audio_binary)

    case KgEdu.Agent.OssUpload.upload(tmp) do
      {:ok, url} ->
        file_id =
          if opts[:tenant] do
            KgEdu.Agent.OssUpload.save_file_record(
              opts[:tenant],
              "tts_#{DateTime.utc_now() |> Calendar.strftime("%Y%m%d%H%M%S")}.mp3",
              url,
              size,
              "audio",
              user_id: opts[:user_id],
              course_id: opts[:course_id]
            )
          end

        Logger.info("[TtsService] 合成成功 #{size}B → #{url}")
        {:ok, %{url: url, file_id: file_id, size: size}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp truncate_resp(body) when is_binary(body), do: String.slice(body, 0, 300)
  defp truncate_resp(body), do: body |> inspect() |> String.slice(0, 300)
end
