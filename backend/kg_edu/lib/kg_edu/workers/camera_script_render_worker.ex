defmodule KgEdu.Workers.CameraScriptRenderWorker do
  @moduledoc """
  镜头脚本渲染 worker（Oban）。

  逐镜头处理（每轮 snooze 推进一个阶段）：
    1. TTS：镜头台词 → 语音（CosyVoice）→ OSS audio_url
    2. 场景图：背景（文字/PPT 页面）+ 人像 → scene_image_url
    3. wan2.2-s2v 提交 → dashscope_task_id（snooze 轮询）
    4. 片段完成 → 下载 → OSS video_url
  全部镜头完成后：拼接片段 → 完整视频 → 更新脚本。

  状态推进记录在 script.scenes 每项的 "status" 字段：
    pending → tts_done → submitted → video_done（或 failed）
  """

  use Oban.Worker, queue: :digital_human, max_attempts: 5

  require Logger

  @poll_interval 15
  # DashScope 服务端对卡住的任务 60 分钟才超时；这里本地提前兜底，
  # 超过该时长未完成即标记失败，避免长时间干等（可配，默认 5 分钟）
  @submit_timeout_seconds System.get_env("DASH_SCOPE_TASK_TIMEOUT", "300")
                          |> String.to_integer()

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"script_id" => script_id, "tenant" => tenant}}) do
    with {:ok, script} <- load_script(script_id, tenant) do
      cond do
        script.status in [:succeeded, :failed] ->
          :ok

        true ->
          scenes = normalize_scenes(script.scenes)

          case first_incomplete(scenes) do
            nil ->
              # 全部完成 → 拼接
              finish_concat(script, scenes, tenant)

            scene ->
              advance_scene(script, scenes, scene, tenant)
          end
      end
    else
      {:error, reason} ->
        Logger.error("[CameraScript] load script #{script_id} failed: #{inspect(reason)}")
        :ok
    end
  end

  # ── 场景阶段推进 ─────────────────────────────────────────────────────

  defp advance_scene(script, scenes, scene, tenant) do
    status = scene["status"] || "pending"

    result =
      case status do
        "pending" ->
          # 1. TTS → audio；2. 合成场景图；3. 提交 s2v
          prepare_and_submit(script, scenes, scene, tenant)

        "tts_done" ->
          prepare_and_submit(script, scenes, scene, tenant)

        "submitted" ->
          poll_scene(script, scenes, scene, tenant)
      end

    case result do
      :snooze -> {:snooze, @poll_interval}
      :ok -> {:snooze, 5}
      {:error, reason} -> mark_scene_failed(script, scenes, scene, tenant, reason) && :ok
    end
  end

  # TTS → 合成 → 提交 s2v
  defp prepare_and_submit(script, scenes, scene, tenant) do
    with {:ok, audio_url} <- ensure_audio(scene),
         {:ok, scene_image_url} <- ensure_scene_image(scene),
         {:ok, dashscope_task_id} <- submit_s2v(scene, scene_image_url, audio_url) do
      scene = scene |> Map.put("audio_url", audio_url) |> Map.put("scene_image_url", scene_image_url)
      scene = scene |> Map.put("dashscope_task_id", dashscope_task_id) |> Map.put("status", "submitted")
      scene = scene |> Map.put("submitted_at", DateTime.utc_now() |> DateTime.to_iso8601())

      update_scenes(script, scenes, scene, tenant)
      :snooze
    end
  end

  defp ensure_audio(scene) do
    case scene["audio_url"] do
      url when is_binary(url) and url != "" ->
        {:ok, url}

      _ ->
        text = scene["text"] || ""
        voice = scene["voice"] || "longanyang"

        if String.trim(text) == "" do
          {:error, "镜头缺少台词文字"}
        else
          case KgEdu.Agent.TTSClient.synthesize_and_store(text, voice: voice, format: "wav") do
            {:ok, url} -> {:ok, url}
            {:error, reason} -> {:error, "TTS 失败: #{reason}"}
          end
        end
    end
  end

  defp ensure_scene_image(scene) do
    case scene["scene_image_url"] do
      url when is_binary(url) and url != "" ->
        {:ok, url}

      _ ->
        person_url = scene["person_image_url"]

        if is_nil(person_url) or person_url == "" do
          {:error, "镜头缺少人像图，请为每个镜头选择人物图片"}
        else
          opts = [
            text: scene["page_text"] || "",
            bg_color: scene["bg_color"] || "#1e3a5f",
            bg_image_url: scene["bg_image_url"],
            person_image_url: person_url
          ]

          case KgEdu.Agent.SceneComposer.compose(opts) do
            {:ok, output_path} ->
              case KgEdu.Agent.OssUpload.upload(output_path) do
                {:ok, url} -> {:ok, url}
                {:error, reason} -> {:error, "场景图上传失败: #{reason}"}
              end

            {:error, reason} ->
              {:error, "场景图合成失败: #{reason}"}
          end
        end
    end
  end

  defp submit_s2v(_scene, image_url, audio_url) do
    with {:ok, api_key} <- api_key() do
      body = %{
        model: "wan2.2-s2v",
        input: %{image_url: image_url, audio_url: audio_url},
        parameters: %{resolution: "480P"}
      }

      case Req.post("https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/",
             headers: %{
               "authorization" => "Bearer #{api_key}",
               "x-dashscope-async" => "enable"
             },
             json: body,
             connect_options: [timeout: 10_000],
             receive_timeout: 60_000
           ) do
        {:ok, %Req.Response{status: 200, body: %{"output" => %{"task_id" => tid}}}} ->
          {:ok, tid}

        {:ok, %Req.Response{body: %{"message" => msg}}} ->
          {:error, "任务提交失败: #{msg}"}

        {:ok, %Req.Response{status: s, body: b}} ->
          {:error, "任务提交失败 (#{s}): #{inspect(b)}"}

        {:error, reason} ->
          {:error, "任务提交异常: #{inspect(reason)}"}
      end
    end
  end

  # 轮询 DashScope 任务
  defp poll_scene(script, scenes, scene, tenant) do
    task_id = scene["dashscope_task_id"]

    case submitted_elapsed(scene) do
      {:ok, seconds} when seconds > @submit_timeout_seconds ->
        {:error,
         "生成超时（已等待 #{div(seconds, 60)} 分钟，超过 #{div(@submit_timeout_seconds, 60)} 分钟限制），" <>
           "请稍后重新渲染。任务 ID: #{task_id}"}

      _ ->
        with {:ok, api_key} <- api_key() do
          case Req.get("https://dashscope.aliyuncs.com/api/v1/tasks/#{task_id}",
                 headers: %{"authorization" => "Bearer #{api_key}"},
                 connect_options: [timeout: 10_000],
                 receive_timeout: 30_000
               ) do
            {:ok, %Req.Response{status: 200, body: body}} ->
              output = body["output"] || %{}

              case output["task_status"] do
                "SUCCEEDED" ->
                  video_url = get_in(output, ["results", "video_url"])

                  case download_video(video_url) do
                    {:ok, stored_url} ->
                      scene = scene |> Map.put("video_url", stored_url) |> Map.put("status", "video_done")
                      update_scenes(script, scenes, scene, tenant)
                      :ok

                    {:error, reason} ->
                      {:error, "片段下载失败: #{reason}"}
                  end

                "FAILED" ->
                  reason = output["message"] || output["code"] || "DashScope 生成失败"
                  {:error, "视频生成失败: #{reason}"}

                _ ->
                  update_scenes(script, scenes, scene, tenant)
                  :snooze
              end

            {:ok, %Req.Response{status: s, body: b}} ->
              {:error, "任务查询失败 (#{s}): #{inspect(b)}"}

            {:error, reason} ->
              {:error, "任务查询异常: #{inspect(reason)}"}
          end
        end
    end
  end

  defp submitted_elapsed(scene) do
    case scene["submitted_at"] do
      iso when is_binary(iso) ->
        case DateTime.from_iso8601(iso) do
          {:ok, dt, _} ->
            {:ok, DateTime.diff(DateTime.utc_now(), dt)}

          _ ->
            {:error, :invalid}
        end

      _ ->
        {:error, :missing}
    end
  end

  # ── 拼接 ─────────────────────────────────────────────────────────────

  defp finish_concat(script, scenes, tenant) do
    video_urls =
      scenes
      |> Enum.map(& &1["video_url"])
      |> Enum.reject(&is_nil/1)

    if length(video_urls) < 1 do
      update_script(script, tenant, %{
        status: :failed,
        error_message: "没有可拼接的视频片段"
      })

      :ok
    else
      with {:ok, paths} <- download_all(video_urls),
           {:ok, output} <- KgEdu.Agent.VideoProcessor.concat(paths),
           {:ok, final_url} <- KgEdu.Agent.OssUpload.upload_video(output) do
        Enum.each(paths, &File.rm/1)
        File.rm(output)

        update_script(script, tenant, %{
          status: :succeeded,
          video_url: final_url,
          error_message: nil
        })

        Logger.info("[CameraScript] script #{script.id} rendered -> #{final_url}")
        :ok
      else
        {:error, reason} ->
          update_script(script, tenant, %{status: :failed, error_message: "拼接失败: #{to_string(reason)}"})
          :ok
      end
    end
  end

  defp download_all(urls) do
    Enum.reduce_while(urls, {:ok, []}, fn url, {:ok, acc} ->
      tmp = Path.join(System.tmp_dir!(), "seg_#{System.unique_integer([:positive])}.mp4")

      case Req.get(url,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000,
             follow_redirects: true
           ) do
        {:ok, %Req.Response{status: 200, body: body}} ->
          File.write!(tmp, body)
          {:cont, {:ok, [tmp | acc]}}

        {:ok, %Req.Response{status: s}} ->
          {:halt, {:error, "片段下载失败 (#{s})"}}

        {:error, reason} ->
          {:halt, {:error, "片段下载失败: #{inspect(reason)}"}}
      end
    end)
    |> case do
      {:ok, paths} -> {:ok, Enum.reverse(paths)}
      err -> err
    end
  end

  defp download_video(url) do
    tmp = Path.join(System.tmp_dir!(), "seg_#{System.unique_integer([:positive])}.mp4")

    with {:ok, %Req.Response{status: 200, body: body}} <-
           Req.get(url,
             connect_options: [timeout: 10_000],
             receive_timeout: 120_000,
             follow_redirects: true
           ) do
      File.write!(tmp, body)
      KgEdu.Agent.OssUpload.upload_video(tmp)
    else
      {:ok, %Req.Response{status: s}} -> {:error, "片段下载失败 (#{s})"}
      {:error, reason} -> {:error, "片段下载失败: #{inspect(reason)}"}
    end
  end

  # ── 辅助 ─────────────────────────────────────────────────────────────

  defp first_incomplete(scenes) do
    Enum.find(scenes, fn s ->
      status = s["status"] || "pending"
      status in ["pending", "tts_done", "submitted"]
    end)
  end

  defp normalize_scenes(nil), do: []
  defp normalize_scenes(scenes) when is_list(scenes), do: scenes
  defp normalize_scenes(_), do: []

  defp update_scenes(script, _scenes, updated_scene, tenant) do
    scenes =
      normalize_scenes(script.scenes)
      |> Enum.map(fn s ->
        if s["id"] == updated_scene["id"], do: updated_scene, else: s
      end)

    update_script(script, tenant, %{scenes: scenes})
  end

  defp mark_scene_failed(script, scenes, scene, tenant, reason) do
    reason = to_string(reason)
    scene = scene |> Map.put("status", "failed") |> Map.put("error", reason)
    update_scenes(script, scenes, scene, tenant)

    update_script(script, tenant, %{
      status: :failed,
      error_message: "镜头「#{scene["title"] || ""}」失败: #{String.slice(reason, 0, 1500)}"
    })

    Logger.error("[CameraScript] script #{script.id} scene failed: #{reason}")
    :ok
  end

  defp load_script(script_id, tenant) do
    script = KgEdu.AI.CameraScript.get_camera_script!(%{id: script_id}, tenant: tenant, authorize?: false)
    {:ok, script}
  rescue
    e -> {:error, Exception.message(e)}
  end

  defp update_script(script, tenant, attrs) do
    script
    |> Ash.Changeset.for_update(:update_status, attrs)
    |> Ash.update!(tenant: tenant, authorize?: false)
  rescue
    e -> Logger.error("[CameraScript] update failed: #{Exception.message(e)}")
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
