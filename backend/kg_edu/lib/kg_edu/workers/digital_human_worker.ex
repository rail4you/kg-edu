defmodule KgEdu.Workers.DigitalHumanWorker do
  @moduledoc """
  Oban worker that generates a digital human talking-head video via DashScope
  `wan2.2-s2v` (image + audio → lip-synced video).

  The DashScope task itself is async and can take several minutes, so this
  worker uses Oban's `{:snooze, secs}` to re-queue itself between polls
  instead of blocking a queue slot for the whole duration.

  Flow (per run):
    - read the `KgEdu.AI.DigitalHumanTask` record
    - if no `dashscope_task_id` yet → face-detect image + submit synthesis task
    - else → poll the DashScope task; on SUCCEEDED download the video to OSS
  """

  use Oban.Worker, queue: :digital_human, max_attempts: 5

  require Logger

  @base "https://dashscope.aliyuncs.com"
  @detect_model "wan2.2-s2v-detect"
  @video_model "wan2.2-s2v"
  @poll_interval 15
  @detect_endpoint "/api/v1/services/aigc/image2video/face-detect"
  @submit_endpoint "/api/v1/services/aigc/image2video/video-synthesis/"
  @task_endpoint "/api/v1/tasks/"

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"task_id" => task_id, "tenant" => tenant}}) do
    with {:ok, task} <- load_task(task_id, tenant) do
      cond do
        task.status in [:succeeded, :failed] ->
          Logger.info("[DigitalHuman] task #{task_id} already finished (#{task.status})")
          :ok

        is_nil(task.dashscope_task_id) ->
          submit_and_poll(task, tenant)

        true ->
          poll_and_finish(task, tenant)
      end
    else
      {:error, reason} ->
        Logger.error("[DigitalHuman] failed to load task #{task_id}: #{inspect(reason)}")
        :ok
    end
  end

  # ── Stage 1: detect + submit ─────────────────────────────────────────

  defp submit_and_poll(task, tenant) do
    with {:ok, api_key} <- api_key() do
      case detect_image(task, api_key) do
        :ok ->
          case submit_video_task(task, api_key) do
            {:ok, dashscope_task_id} ->
              update_task(task, tenant, %{
                status: :running,
                dashscope_task_id: dashscope_task_id,
                progress_message: "视频任务已提交，正在排队生成..."
              })

              {:snooze, @poll_interval}

            {:error, reason} ->
              mark_failed(task, tenant, reason)
              :ok
          end

        {:error, reason} ->
          mark_failed(task, tenant, reason)
          :ok
      end
    end
  end

  # ── Stage 2: poll DashScope and finalize ─────────────────────────────

  defp poll_and_finish(task, tenant) do
    with {:ok, api_key} <- api_key() do
      case poll_task(task, api_key) do
        %{"task_status" => "SUCCEEDED"} ->
          finish_succeeded(task, tenant)

        %{"task_status" => "FAILED"} = body ->
          reason =
            body["output"]["message"] ||
              body["output"]["code"] ||
              "DashScope 视频生成失败"

          mark_failed(task, tenant, reason)
          :ok

        _running ->
          update_task(task, tenant, %{
            progress_message: "正在生成视频，通常需要 1-10 分钟，请耐心等待..."
          })

          {:snooze, @poll_interval}
      end
    end
  end

  defp finish_succeeded(task, tenant) do
    with {:ok, api_key} <- api_key(),
         %{"results" => %{"video_url" => video_url}} <-
           poll_task(task, api_key) do
      case download_and_store(video_url) do
        {:ok, stored_url} ->
          update_task(task, tenant, %{
            status: :succeeded,
            video_url: stored_url,
            progress_message: "视频生成完成"
          })

          :ok

        {:error, reason} ->
          mark_failed(task, tenant, "视频下载失败: #{reason}")
          :ok
      end
    else
      {:error, reason} -> mark_failed(task, tenant, reason) && :ok
      other -> mark_failed(task, tenant, "无法解析生成结果: #{inspect(other)}") && :ok
    end
  end

  # ── DashScope helpers ────────────────────────────────────────────────

  defp api_key do
    key = KgEdu.Agent.ApiKeyProvider.get_key(:qwen) || System.get_env("DASHSCOPE_API_KEY")

    if is_binary(key) and key != "" do
      {:ok, key}
    else
      {:error, "未配置 DashScope API Key"}
    end
  end

  defp detect_image(task, api_key) do
    body = %{model: @detect_model, input: %{image_url: task.image_url}}

    with {:ok, %Req.Response{status: 200, body: resp}} <-
           post_json(@detect_endpoint, api_key, body, []),
         %{"output" => %{"check_pass" => true}} <- resp do
      :ok
    else
      %{"output" => %{"check_pass" => false}} ->
        {:error, "图片检测未通过，请使用清晰、单人的正面人物图片"}

      %{"message" => msg} ->
        {:error, "图片检测失败: #{msg}"}

      {:ok, %Req.Response{body: %{"message" => msg}}} ->
        {:error, "图片检测失败: #{msg}"}

      other ->
        {:error, "图片检测异常: #{inspect(other)}"}
    end
  end

  defp submit_video_task(task, api_key) do
    body = %{
      model: @video_model,
      input: %{image_url: task.image_url, audio_url: task.audio_url},
      parameters: %{resolution: task.resolution || "480P"}
    }

    headers = [{"x-dashscope-async", "enable"}]

    with {:ok, %Req.Response{status: 200, body: resp}} <- post_json(@submit_endpoint, api_key, body, headers),
         %{"output" => %{"task_id" => task_id}} <- resp do
      {:ok, task_id}
    else
      {:ok, %Req.Response{body: %{"message" => msg}}} -> {:error, "任务提交失败: #{msg}"}
      {:ok, %Req.Response{status: status, body: body}} -> {:error, "任务提交失败 (#{status}): #{inspect(body)}"}
      other -> {:error, "任务提交异常: #{inspect(other)}"}
    end
  end

  defp poll_task(task, api_key) do
    url = @base <> @task_endpoint <> task.dashscope_task_id

    case Req.get(url,
           headers: %{"authorization" => "Bearer #{api_key}"},
           connect_options: [timeout: 10_000],
           receive_timeout: 30_000
         ) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        body["output"] || body

      {:ok, %Req.Response{status: status, body: body}} ->
        %{"task_status" => "FAILED", "output" => %{"message" => "查询任务失败 (#{status}): #{inspect(body)}"}}

      {:error, reason} ->
        %{"task_status" => "FAILED", "output" => %{"message" => "查询任务失败: #{inspect(reason)}"}}
    end
  end

  defp post_json(endpoint, api_key, body, extra_headers) do
    headers =
      %{"authorization" => "Bearer #{api_key}"}
      |> Map.merge(Map.new(extra_headers))

    result =
      Req.post(@base <> endpoint,
        headers: headers,
        json: body,
        connect_options: [timeout: 10_000],
        receive_timeout: 60_000
      )

    case result do
      {:ok, %Req.Response{status: 200, body: body}} when is_map(body) ->
        # DashScope sometimes returns 200 with an error body (message/code, no output)
        if Map.has_key?(body, "message") or Map.has_key?(body, "code") do
          {:ok, %Req.Response{status: 400, body: body}}
        else
          result
        end

      _ ->
        result
    end
  end

  # ── Download + persist video ─────────────────────────────────────────

  defp download_and_store(video_url) do
    tmp_path = Path.join(System.tmp_dir!(), "digital_human_#{System.unique_integer([:positive])}.mp4")

    with {:ok, %Req.Response{status: 200, body: body}} <-
           Req.get(video_url,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000,
             follow_redirects: true
           ) do
      File.write!(tmp_path, body)
      KgEdu.Agent.OssUpload.upload_video(tmp_path)
    else
      {:ok, %Req.Response{status: status}} -> {:error, "视频下载失败 (#{status})"}
      {:error, reason} -> {:error, "视频下载失败: #{inspect(reason)}"}
    end
  end

  # ── Ash task helpers ─────────────────────────────────────────────────

  defp load_task(task_id, tenant) do
    task = KgEdu.AI.DigitalHumanTask.get_digital_human_task!(%{id: task_id}, tenant: tenant, authorize?: false)
    {:ok, task}
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp update_task(task, tenant, attrs) do
    task
    |> Ash.Changeset.for_update(:update_status, attrs)
    |> Ash.update!(tenant: tenant, authorize?: false)
  rescue
    e -> Logger.error("[DigitalHuman] update task failed: #{Exception.message(e)}")
  end

  defp mark_failed(task, tenant, reason) do
    reason = to_string(reason)

    update_task(task, tenant, %{
      status: :failed,
      error_message: String.slice(reason, 0, 2000),
      progress_message: "生成失败"
    })

    Logger.error("[DigitalHuman] task #{task.id} failed: #{reason}")
  end
end
