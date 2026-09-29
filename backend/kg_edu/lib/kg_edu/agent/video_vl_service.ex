defmodule KgEdu.Agent.VideoVlService do
  @moduledoc """
  P2: 视频内容理解 — Qwen VL 视觉模型按时间轴提取内容文本。

  替代原 DashScope ASR（录音文件识别，部分账号无权限返回
  "current user api does not support synchronous calls"）。
  Qwen VL 走 chat/completions（与对话共用 Key，已确认可用），
  对视频抽帧后由视觉模型输出时间轴事件列表。

  `transcribe_url/2` 返回与旧 ASR 相同的句子格式：
  `[%{begin_ms, end_ms, text}]`（毫秒），可直接喂给解析流水线。
  """

  require Logger

  @endpoint "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
  @model "qwen3-vl-flash"
  @fps 0.2

  @timeline_prompt """
  请详细分析这段视频的内容，按照时间轴输出事件列表。
  要求：
  1. 以 JSON 格式输出
  2. 包含 events 数组
  3. 每个事件包含 start_time（HH:mm:ss 格式）、end_time（HH:mm:ss 格式）、event（事件描述）
  4. 事件描述要详细，包含画面内容、讲解要点、可提取的文字/字幕
  5. 不要输出任何其他内容，只输出 JSON

  输出格式示例：
  {"events": [{"start_time": "00:00:00", "end_time": "00:00:05", "event": "场景与内容描述"}]}
  """

  @doc """
  提交公网可访问的视频 URL → Qwen VL 解析 → 返回句子列表。
  sentences: `[%{begin_ms: integer, end_ms: integer, text: string}]`（毫秒）。
  """
  def transcribe_url(video_url, opts \\ []) when is_binary(video_url) do
    with {:ok, api_key} <- fetch_key(),
         {:ok, events} <- analyze(video_url, api_key, opts) do
      {:ok, events_to_sentences(events)}
    end
  end

  # ── Private ────────────────────────────────────────────────────────

  defp fetch_key do
    case KgEdu.Agent.ApiKeyProvider.get_key(:qwen) do
      key when is_binary(key) and key != "" -> {:ok, key}
      _ -> {:error, "未配置 Qwen API Key（请在后台 api_key_configs 中配置 provider=qwen）"}
    end
  end

  defp analyze(video_url, api_key, opts) do
    model = Keyword.get(opts, :model, @model)
    fps = Keyword.get(opts, :fps, @fps)

    body = %{
      "model" => model,
      "messages" => [
        %{
          "role" => "user",
          "content" => [
            %{"type" => "video_url", "video_url" => %{"url" => video_url}, "fps" => fps},
            %{"type" => "text", "text" => @timeline_prompt}
          ]
        }
      ]
    }

    headers = [
      {"authorization", "Bearer #{api_key}"},
      {"content-type", "application/json"}
    ]

    Logger.info("[VideoVlService] 调用 Qwen VL model=#{model} fps=#{fps}")

    case Req.post(@endpoint, json: body, headers: headers, receive_timeout: 300_000) do
      {:ok, %{status: status, body: resp}} when status in 200..299 ->
        parse_events(resp)

      {:ok, %{status: status, body: resp}} ->
        {:error, "视频解析失败 (#{status}): #{truncate(resp)}"}

      {:error, error} ->
        {:error, "视频解析异常: #{inspect(error)}"}
    end
  end

  defp parse_events(%{"choices" => [%{"message" => %{"content" => content}} | _]}) do
    case content |> extract_json() |> Jason.decode() do
      {:ok, %{"events" => events}} when is_list(events) ->
        {:ok, events}

      {:ok, _} ->
        {:error, "视频解析结果缺少 events"}

      {:error, _} ->
        {:error, "视频解析返回非 JSON"}
    end
  end

  defp parse_events(_), do: {:error, "视频解析返回异常"}

  # 去掉 ```json 围栏，兜底截取第一个 { 到最后一个 }
  defp extract_json(content) when is_binary(content) do
    content =
      case Regex.run(~r/```(?:json)?\s*\n?(.*?)\n?```/s, content, capture: :all_but_first) do
        [inner] -> String.trim(inner)
        nil -> content
      end

    case Regex.run(~r/\{.*\}/s, content) do
      [json] -> json
      nil -> content
    end
  end

  defp events_to_sentences(events) do
    events
    |> Enum.map(fn evt ->
      %{
        begin_ms: hms_to_ms(evt["start_time"] || evt["begin_time"] || "00:00:00"),
        end_ms: hms_to_ms(evt["end_time"] || evt["end_ms"] || "00:00:00"),
        text: evt["event"] || evt["text"] || ""
      }
    end)
    |> Enum.reject(&(&1.text == ""))
    |> Enum.sort_by(& &1.begin_ms)
  end

  defp hms_to_ms(v) when is_integer(v), do: v
  defp hms_to_ms(v) when is_number(v), do: round(v * 1000)

  defp hms_to_ms(v) when is_binary(v) do
    case String.split(v, ":") do
      [h, m, s] ->
        to_int(h) * 3_600_000 + to_int(m) * 60_000 + round(to_float(s) * 1000)

      [m, s] ->
        to_int(m) * 60_000 + round(to_float(s) * 1000)

      _ ->
        case Integer.parse(String.trim(v)) do
          {n, _} -> n * 1000
          :error -> 0
        end
    end
  end

  defp hms_to_ms(_), do: 0

  defp to_int(s) do
    case Integer.parse(String.trim(s)) do
      {n, _} -> n
      :error -> 0
    end
  end

  defp to_float(s) do
    case Float.parse(String.trim(s)) do
      {f, _} -> f
      :error -> 0.0
    end
  end

  defp truncate(resp) when is_binary(resp), do: String.slice(resp, 0, 300)
  defp truncate(resp), do: resp |> inspect() |> String.slice(0, 300)
end