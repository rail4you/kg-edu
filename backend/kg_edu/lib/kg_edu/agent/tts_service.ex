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
  """
  def voices do
    [
      %{voice: "longanyang", label: "男声-安阳（中文）", gender: "male", language: "zh"},
      %{voice: "longxiaochun", label: "女声-晓春（中文）", gender: "female", language: "zh"},
      %{voice: "longxiaoxia", label: "女声-晓晓（中文/英文）", gender: "female", language: "zh,en"},
      %{voice: "longyuanyuan", label: "女声-媛媛（多语言）", gender: "female", language: "zh,en,ja,es"},
      %{voice: "longtaotao", label: "男声-涛涛（多语言）", gender: "male", language: "zh,en,ja,es"}
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
      body = %{
        "model" => opts[:model] || opts["model"] || @default_model,
        "input" => %{"text" => text},
        "voice" => opts[:voice] || opts["voice"] || "longxiaochun",
        "parameters" => %{
          "speech_rate" => opts[:speech_rate] || opts["speech_rate"] || 1.0,
          "volume" => opts[:volume] || opts["volume"] || 50
        }
      }

      body =
        case opts[:instruction] || opts["instruction"] do
          nil -> body
          instruction -> put_in(body, ["parameters", "instruction"], instruction)
        end

      headers = %{
        "authorization" => "Bearer #{api_key}",
        "content-type" => "application/json"
      }

      case Req.post(@endpoint, json: body, headers: headers, decode_body: false) do
        {:ok, %{status: status, headers: resp_headers, body: resp_body}}
        when status in 200..299 ->
          handle_audio_response(resp_headers, resp_body, opts)

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

  defp handle_audio_response(headers, body, opts) do
    content_type =
      headers
      |> Map.new(fn {k, v} -> {String.downcase(k), List.first(List.wrap(v))} end)
      |> Map.get("content-type", "")

    cond do
      String.contains?(content_type, "audio") or audio_binary?(body) ->
        save_and_upload(body, opts)

      true ->
        {:error, "TTS 合成失败: #{truncate_resp(body)}"}
    end
  end

  defp audio_binary?(body) when is_binary(body) do
    # MP3 以 ID3 或 0xFFFB 同步字开头；WAV 以 RIFF 开头
    String.starts_with?(body, "ID3") or
      :binary.match(body, <<0xFF, 0xFB>>) == {0, 2} or
      String.starts_with?(body, "RIFF")
  end

  defp audio_binary?(_), do: false

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
