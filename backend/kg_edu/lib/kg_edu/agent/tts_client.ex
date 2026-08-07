defmodule KgEdu.Agent.TTSClient do
  @moduledoc """
  CosyVoice / Qwen-Audio-TTS 非实时语音合成客户端（DashScope）。

  API: POST /api/v1/services/audio/tts/SpeechSynthesizer
  参考: https://help.aliyun.com/zh/model-studio/cosyvoice-tts-http-api
  """

  require Logger

  @base "https://dashscope.aliyuncs.com"
  @endpoint "/api/v1/services/audio/tts/SpeechSynthesizer"

  @doc """
  文字转语音。返回 `{:ok, audio_url}`（DashScope 临时 URL，24h 有效）。

  opts:
    - voice: 音色，默认 "longanyang"
    - format: mp3/wav/pcm/opus，默认 wav
    - sample_rate: 默认 24000
    - volume: 0-100，默认 50
    - rate: 0.5-2.0，默认 1.0
  """
  def synthesize(text, opts \\ []) when is_binary(text) do
    with {:ok, api_key} <- api_key() do
      body = %{
        "model" => Keyword.get(opts, :model, "cosyvoice-v3-flash"),
        "input" => %{
          "text" => text,
          "voice" => Keyword.get(opts, :voice, "longanyang"),
          "format" => Keyword.get(opts, :format, "wav"),
          "sample_rate" => Keyword.get(opts, :sample_rate, 24000),
          "volume" => Keyword.get(opts, :volume, 50),
          "rate" => Keyword.get(opts, :rate, 1.0)
        }
      }

      case Req.post(@base <> @endpoint,
             headers: %{"authorization" => "Bearer #{api_key}"},
             json: body,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000
           ) do
        {:ok, %Req.Response{status: 200, body: %{"output" => %{"audio" => %{"url" => url}}}}}
        when is_binary(url) ->
          {:ok, url}

        {:ok, %Req.Response{status: 200, body: %{"message" => msg}}} ->
          {:error, "TTS 失败: #{msg}"}

        {:ok, %Req.Response{status: 200, body: %{"code" => code, "message" => msg}}} ->
          {:error, "TTS 失败 (#{code}): #{msg}"}

        {:ok, %Req.Response{status: status, body: body}} ->
          {:error, "TTS 请求失败 (#{status}): #{inspect(body)}"}

        {:error, reason} ->
          {:error, "TTS 请求异常: #{inspect(reason)}"}
      end
    end
  end

  @doc """
  文字转语音并持久化到 OSS，返回可长期使用的 URL。
  """
  def synthesize_and_store(text, opts \\ []) do
    with {:ok, url} <- synthesize(text, opts) do
      download_and_store(url, opts)
    end
  end

  defp download_and_store(url, _opts) do
    ext = Path.extname(URI.parse(url).path || "") |> case do
      "" -> ".wav"
      e -> e
    end

    tmp_path =
      Path.join(System.tmp_dir!(), "tts_#{System.unique_integer([:positive])}#{ext}")

    with {:ok, %Req.Response{status: 200, body: body}} <-
           Req.get(url,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000,
             follow_redirects: true
           ) do
      File.write!(tmp_path, body)
      result = KgEdu.Agent.OssUpload.upload(tmp_path)

      case result do
        {:ok, stored_url} -> {:ok, stored_url}
        {:error, reason} -> {:error, "音频存储失败: #{reason}"}
      end
    else
      {:ok, %Req.Response{status: status}} -> {:error, "音频下载失败 (#{status})"}
      {:error, reason} -> {:error, "音频下载失败: #{inspect(reason)}"}
    end
  end

  defp api_key do
    key = KgEdu.Agent.ApiKeyProvider.get_key(:qwen) || System.get_env("DASHSCOPE_API_KEY")

    if is_binary(key) and key != "" do
      {:ok, key}
    else
      {:error, "未配置 DashScope API Key"}
    end
  end
end
