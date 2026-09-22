defmodule KgEdu.Agent.AsrService do
  @moduledoc """
  P2: 语音识别（DashScope Paraformer 录音文件识别，异步任务模型）。

  - Key 复用 `ApiKeyConfig(provider="qwen")`。
  - `transcribe_url/1`: 提交 URL → 轮询 → 返回带时间戳的 sentences
    `[%{begin_ms, end_ms, text}]`。
  - 纯 HTTP（Req），无 SDK 依赖。
  """

  require Logger

  @submit_endpoint "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription"
  @task_endpoint "https://dashscope.aliyuncs.com/api/v1/tasks/"
  @model "paraformer-v2"

  @doc """
  转写公网可访问的音视频 URL。返回 `{:ok, sentences}` 或 `{:error, reason}`。
  sentences: `[%{begin_ms: integer, end_ms: integer, text: string}]`（毫秒）。
  """
  def transcribe_url(file_url, opts \\ []) when is_binary(file_url) do
    with {:ok, api_key} <- fetch_key(),
         {:ok, task_id} <- submit(file_url, api_key),
         {:ok, result_url} <- poll(task_id, api_key, opts),
         {:ok, sentences} <- fetch_transcript(result_url, api_key) do
      {:ok, sentences}
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp fetch_key do
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      key when is_binary(key) and key != "" -> {:ok, key}
      _ -> {:error, "未配置 Qwen API Key（请在后台 api_key_configs 中配置 provider=qwen）"}
    end
  end

  defp submit(file_url, api_key) do
    body = %{
      "model" => @model,
      "input" => %{"file_urls" => [file_url]},
      "parameters" => %{
        "channel_id" => [0],
        "language_hints" => ["zh", "en"]
      }
    }

    case Req.post(@submit_endpoint, json: body, headers: auth(api_key)) do
      {:ok, %{status: status, body: %{"output" => %{"task_id" => task_id}}}}
      when status in 200..299 ->
        Logger.info("[AsrService] 任务已提交 #{task_id}")
        {:ok, task_id}

      {:ok, %{status: status, body: resp}} ->
        {:error, "ASR 提交失败 (#{status}): #{truncate(resp)}"}

      {:error, error} ->
        {:error, "ASR 提交异常: #{inspect(error)}"}
    end
  end

  defp poll(task_id, api_key, opts) do
    timeout_ms = Keyword.get(opts, :timeout_ms, 600_000)
    interval_ms = Keyword.get(opts, :interval_ms, 5_000)
    deadline = System.monotonic_time(:millisecond) + timeout_ms
    do_poll(task_id, api_key, interval_ms, deadline)
  end

  defp do_poll(task_id, api_key, interval_ms, deadline) do
    case Req.get(@task_endpoint <> task_id, headers: auth(api_key)) do
      {:ok, %{status: 200, body: %{"output" => output}}} ->
        case output["task_status"] do
          "SUCCEEDED" ->
            case output["results"] do
              [%{"transcription_url" => url} | _] -> {:ok, url}
              _ -> {:error, "ASR 任务成功但无转写结果 URL"}
            end

          status when status in ["FAILED", "CANCELED", "UNKNOWN"] ->
            {:error, "ASR 任务#{status}: #{truncate(output)}"}

          _pending ->
            if System.monotonic_time(:millisecond) > deadline do
              {:error, "ASR 任务轮询超时"}
            else
              Process.sleep(interval_ms)
              do_poll(task_id, api_key, interval_ms, deadline)
            end
        end

      {:ok, %{status: status, body: resp}} ->
        {:error, "ASR 轮询失败 (#{status}): #{truncate(resp)}"}

      {:error, error} ->
        {:error, "ASR 轮询异常: #{inspect(error)}"}
    end
  end

  defp fetch_transcript(url, api_key) do
    case Req.get(url, headers: auth(api_key)) do
      {:ok, %{status: 200, body: body}} ->
        {:ok, normalize_sentences(body)}

      {:ok, %{status: status, body: resp}} ->
        {:error, "ASR 结果获取失败 (#{status}): #{truncate(resp)}"}

      {:error, error} ->
        {:error, "ASR 结果获取异常: #{inspect(error)}"}
    end
  end

  @doc false
  # 转写 JSON → 标准 sentences（毫秒时间戳）。纯函数，可单测。
  def normalize_sentences(%{"transcripts" => [%{"sentences" => sentences} | _]}) do
    Enum.map(sentences, fn s ->
      %{
        begin_ms: s["begin_time"] || 0,
        end_ms: s["end_time"] || 0,
        text: s["text"] || ""
      }
    end)
    |> Enum.reject(&(&1.text == ""))
  end

  def normalize_sentences(%{"transcripts" => [%{"text" => text} | _]}) when is_binary(text) do
    [%{begin_ms: 0, end_ms: 0, text: text}]
  end

  def normalize_sentences(_), do: []

  defp auth(api_key), do: %{"authorization" => "Bearer #{api_key}"}

  defp truncate(resp) when is_binary(resp), do: String.slice(resp, 0, 300)
  defp truncate(resp), do: resp |> inspect() |> String.slice(0, 300)
end
