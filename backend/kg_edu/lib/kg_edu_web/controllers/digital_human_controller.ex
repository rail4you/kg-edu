defmodule KgEduWeb.DigitalHumanController do
  @moduledoc """
  数字人视频生成 API。

  流程：
    1. 教师上传人物图片 + 音频（走 /api/upload 获取 OSS URL）
    2. POST /api/digital-human/tasks 创建任务（入库 + 入队 Oban）
    3. 前端轮询 GET /api/digital-human/tasks/:id 查看进度
    4. 完成后可预览 / 下载 video_url
  """
  use KgEduWeb, :controller

  require Logger

  # 只读教师禁止创建数字人任务 / 导入脚本
  plug KgEduWeb.Plugs.RequireEditable when action in [:create, :create_script, :import_txt, :import_pptx, :render_script]

  @doc """
  POST /api/digital-human/tasks
  Body: { title?, imageUrl, audioUrl, resolution? }
  """
  def create(conn, params) do
    tenant = extract_tenant(conn, params)
    image_url = params["imageUrl"] || params["image_url"]
    audio_url = params["audioUrl"] || params["audio_url"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      is_nil(image_url) or is_nil(audio_url) ->
        json(conn, %{success: false, message: "imageUrl 和 audioUrl 是必需参数"})

      true ->
        user_id = extract_user_id(conn, params)

        attrs = %{
          title: params["title"] || "数字人视频",
          image_url: image_url,
          audio_url: audio_url,
          resolution: params["resolution"] || "480P"
        }

        result =
          KgEdu.AI.DigitalHumanTask.create_digital_human_task(attrs,
            tenant: tenant,
            authorize?: false,
            actor: actor(conn)
          )

        case result do
          {:ok, task} ->
            enqueue_worker(task, tenant, user_id)

            json(conn, %{
              success: true,
              message: "任务已创建",
              data: %{taskId: task.id, status: "queued"}
            })

          {:error, changeset} ->
            json(conn, %{success: false, message: format_changeset_error(changeset)})
        end
    end
  end

  @doc """
  GET /api/digital-human/tasks/:id
  """
  def show(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      case KgEdu.AI.DigitalHumanTask.get_digital_human_task(%{id: id},
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, task} ->
          json(conn, %{success: true, data: serialize_task(task)})

        {:error, _} ->
          conn |> put_status(404) |> json(%{success: false, message: "任务不存在"})
      end
    end
  end

  @doc """
  GET /api/digital-human/tasks
  列出当前用户创建的数字人任务（按更新时间倒序）。
  """
  def list(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      query =
        KgEdu.AI.DigitalHumanTask
        |> Ash.Query.new()
        |> Ash.Query.sort(updated_at: :desc)
        |> Ash.Query.limit(100)

      tasks =
        Ash.read!(query,
          tenant: tenant,
          actor: actor(conn),
          authorize?: false
        )

      json(conn, %{success: true, data: %{tasks: Enum.map(tasks, &serialize_task/1)}})
    end
  end

  @doc """
  DELETE /api/digital-human/tasks/:id
  """
  def delete(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      case KgEdu.AI.DigitalHumanTask.get_digital_human_task(%{id: id},
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, task} ->
          task
          |> Ash.Changeset.for_destroy(:destroy)
          |> Ash.destroy!(tenant: tenant, authorize?: false)

          json(conn, %{success: true, message: "任务已删除"})

        {:error, _} ->
          conn |> put_status(404) |> json(%{success: false, message: "任务不存在"})
      end
    end
  end

  # ── 镜头脚本 ────────────────────────────────────────────────────────

  @doc """
  POST /api/digital-human/scripts
  创建/保存镜头脚本。

  Body: { title?, scenes: [...] }
  """
  def create_script(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      scenes = params["scenes"] || []

      if not is_list(scenes) or scenes == [] do
        json(conn, %{success: false, message: "scenes 不能为空"})
      else
        attrs = %{
          title: params["title"] || "镜头脚本",
          scenes: normalize_scenes(scenes)
        }

        case KgEdu.AI.CameraScript.create_camera_script(attrs,
               tenant: tenant,
               authorize?: false,
               actor: actor(conn)
             ) do
          {:ok, script} ->
            json(conn, %{success: true, data: %{scriptId: script.id, status: "draft"}})

          {:error, changeset} ->
            json(conn, %{success: false, message: format_changeset_error(changeset)})
        end
      end
    end
  end

  @doc """
  PUT /api/digital-human/scripts/:id
  更新镜头脚本。
  """
  def update_script(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      with {:ok, script} <-
             KgEdu.AI.CameraScript.get_camera_script(%{id: id},
               tenant: tenant,
               authorize?: false
             ) do
        attrs =
          %{}
          |> maybe_put(:title, params["title"])
          |> maybe_put(:scenes, if(params["scenes"], do: normalize_scenes(params["scenes"])))

        case script
             |> Ash.Changeset.for_update(:update, attrs)
             |> Ash.update(tenant: tenant, authorize?: false) do
          {:ok, updated} ->
            json(conn, %{success: true, data: %{scriptId: updated.id, status: "updated"}})

          {:error, changeset} ->
            json(conn, %{success: false, message: format_changeset_error(changeset)})
        end
      else
        _ -> conn |> put_status(404) |> json(%{success: false, message: "脚本不存在"})
      end
    end
  end

  @doc """
  GET /api/digital-human/scripts
  列出当前用户的镜头脚本。
  """
  def list_scripts(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      scripts =
        KgEdu.AI.CameraScript
        |> Ash.Query.new()
        |> Ash.Query.sort(updated_at: :desc)
        |> Ash.Query.limit(100)
        |> Ash.read!(tenant: tenant, actor: actor(conn), authorize?: false)

      json(conn, %{success: true, data: %{scripts: Enum.map(scripts, &serialize_script/1)}})
    end
  end

  @doc """
  GET /api/digital-human/scripts/:id
  读取脚本（含镜头进度）。
  """
  def get_script(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      case KgEdu.AI.CameraScript.get_camera_script(%{id: id},
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, script} ->
          json(conn, %{success: true, data: serialize_script(script)})

        {:error, _} ->
          conn |> put_status(404) |> json(%{success: false, message: "脚本不存在"})
      end
    end
  end

  @doc """
  DELETE /api/digital-human/scripts/:id
  """
  def delete_script(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      case KgEdu.AI.CameraScript.get_camera_script(%{id: id},
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, script} ->
          script
          |> Ash.Changeset.for_destroy(:destroy)
          |> Ash.destroy!(tenant: tenant, authorize?: false)

          json(conn, %{success: true, message: "脚本已删除"})

        {:error, _} ->
          conn |> put_status(404) |> json(%{success: false, message: "脚本不存在"})
      end
    end
  end

  @doc """
  POST /api/digital-human/scripts/import-txt
  导入 TXT 文稿 → 自动分段创建镜头脚本。

  Body: { title?, content }
  """
  def import_txt(conn, params) do
    tenant = extract_tenant(conn, params)
    content = params["content"] || ""

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      String.trim(content) == "" ->
        json(conn, %{success: false, message: "文稿内容为空"})

      true ->
        case KgEdu.Agent.ScriptParser.parse_txt(content) do
          {:ok, scenes} ->
            json(conn, %{success: true, data: %{scenes: scenes}})

          {:error, reason} ->
            json(conn, %{success: false, message: "解析失败: #{reason}"})
        end
    end
  end

  @doc """
  POST /api/digital-human/scripts/import-pptx
  导入 PPT → 每页一个镜头（页面文字 + 备注台词 + 页面背景图）。

  支持 multipart 文件上传（field: file）或 base64（file_data）。
  """
  def import_pptx(conn, params) do
    tenant = extract_tenant(conn, params)

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      true ->
        with {:ok, pptx_path} <- save_pptx(params) do
          result =
            try do
              KgEdu.Agent.ScriptParser.parse_pptx(pptx_path)
            rescue
              e -> {:error, Exception.message(e)}
            end

          File.rm(pptx_path)

          case result do
            {:ok, scenes} ->
              json(conn, %{success: true, data: %{scenes: scenes}})

            {:error, reason} ->
              json(conn, %{success: false, message: "PPT 解析失败: #{reason}"})
          end
        else
          {:error, reason} -> json(conn, %{success: false, message: reason})
        end
    end
  end

  @doc """
  POST /api/digital-human/scripts/:id/render
  开始渲染镜头脚本（逐镜头 TTS → 合成 → 生成 → 拼接）。
  """
  def render_script(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      case KgEdu.AI.CameraScript.get_camera_script(%{id: id},
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, script} ->
          scenes = normalize_scenes(script.scenes)

          missing_person =
            Enum.find(scenes, fn s -> is_nil(s["person_image_url"]) or s["person_image_url"] == "" end)

          if missing_person do
            json(conn, %{
              success: false,
              message: "镜头「#{missing_person["title"] || ""}」未设置人物图片"
            })
          else
            # 重置为渲染中
            scenes = Enum.map(scenes, fn s -> Map.merge(%{"status" => "pending", "error" => nil}, s) end)

            update_script_attrs(script, tenant, %{status: :rendering, scenes: scenes, error_message: nil})

            %{script_id: id, tenant: tenant}
            |> KgEdu.Workers.CameraScriptRenderWorker.new()
            |> KgEdu.Oban.insert()

            json(conn, %{success: true, message: "渲染已启动", data: %{status: "rendering"}})
          end

        {:error, _} ->
          conn |> put_status(404) |> json(%{success: false, message: "脚本不存在"})
      end
    end
  end

  # ── 脚本 helpers ─────────────────────────────────────────────────────

  defp serialize_script(script) do
    %{
      id: script.id,
      title: script.title,
      status: to_string(script.status),
      scenes: script.scenes || [],
      videoUrl: script.video_url,
      errorMessage: script.error_message,
      createdAt: script.inserted_at,
      updatedAt: script.updated_at
    }
  end

  defp normalize_scenes(scenes) when is_list(scenes) do
    scenes
    |> Enum.with_index(1)
    |> Enum.map(fn {s, i} ->
      s =
        if is_map(s), do: s, else: %{}

      s =
        Map.put_new(s, "id", Ecto.UUID.generate())
        |> Map.put_new("title", "镜头#{i}")
        |> Map.put_new("text", "")
        |> Map.put_new("page_text", s["text"] || "")
        |> Map.put_new("bg_color", "#1e3a5f")
        |> Map.put_new("person_image_url", nil)
        |> Map.put_new("voice", "longanyang")
        |> Map.put_new("status", "pending")
        |> Map.put_new("audio_url", nil)
        |> Map.put_new("scene_image_url", nil)
        |> Map.put_new("video_url", nil)
        |> Map.put_new("dashscope_task_id", nil)
        |> Map.put_new("error", nil)

      s
    end)
  end

  defp normalize_scenes(_), do: []

  defp save_pptx(params) do
    case params["file"] do
      %Plug.Upload{} = upload ->
        tmp = Path.join(System.tmp_dir!(), "import_#{System.unique_integer([:positive])}.pptx")
        File.cp!(upload.path, tmp)
        {:ok, tmp}

      _ ->
        case params["file_data"] do
          base64 when is_binary(base64) and base64 != "" ->
            data = String.replace(base64, ~r/^data:.*?;base64,/, "")

            case Base.decode64(data) do
              {:ok, bytes} ->
                tmp = Path.join(System.tmp_dir!(), "import_#{System.unique_integer([:positive])}.pptx")
                File.write!(tmp, bytes)
                {:ok, tmp}

              :error ->
                {:error, "base64 解码失败"}
            end

          _ ->
            {:error, "缺少 PPT 文件（file 或 file_data）"}
        end
    end
  end

  defp update_script_attrs(script, tenant, attrs) do
    script
    |> Ash.Changeset.for_update(:update_status, attrs)
    |> Ash.update!(tenant: tenant, authorize?: false)
  rescue
    e -> Logger.error("[DigitalHuman] update script failed: #{Exception.message(e)}")
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp format_changeset_error(changeset) do
    changeset.errors
    |> Ash.Error.to_error_class()
    |> Exception.message()
  end

  # ── 抠像 ─────────────────────────────────────────────────────────────

  @doc """
  POST /api/digital-human/chroma-key
  广播级一键抠像。

  Body: { imageUrl, color?, similarity?, blend?, yuv?, despill? }
  color: green/blue/white/black/red 或 hex
  """
  def chroma_key(conn, params) do
    tenant = extract_tenant(conn, params)
    image_url = params["imageUrl"] || params["image_url"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      is_nil(image_url) ->
        json(conn, %{success: false, message: "imageUrl 是必需参数"})

      true ->
        case download_to_temp(image_url) do
          {:ok, tmp_path} ->
            opts = [
              color: params["color"] || "green",
              similarity: float_param(params["similarity"], 0.4),
              blend: float_param(params["blend"], 0.1),
              yuv: int_param(params["yuv"], 1),
              despill: int_param(params["despill"], 0)
            ]

            case KgEdu.Agent.VideoProcessor.chroma_key(tmp_path, opts) do
              {:ok, output_path} ->
                case KgEdu.Agent.OssUpload.upload(output_path) do
                  {:ok, url} ->
                    File.rm(tmp_path)
                    json(conn, %{success: true, data: %{resultUrl: url}})

                  {:error, reason} ->
                    File.rm(tmp_path)
                    json(conn, %{success: false, message: "结果上传失败: #{reason}"})
                end

              {:error, reason} ->
                File.rm(tmp_path)
                json(conn, %{success: false, message: "抠像失败: #{reason}"})
            end

          {:error, reason} ->
            json(conn, %{success: false, message: "图片下载失败: #{reason}"})
        end
    end
  end

  @doc """
  POST /api/digital-human/compose
  背景 + 人像透明 PNG 合成场景图。

  Body: { bgUrl|bgColor, personUrl, x?, y?, scale? }
  """
  def compose(conn, params) do
    tenant = extract_tenant(conn, params)
    person_url = params["personUrl"] || params["person_url"]
    bg_url = params["bgUrl"] || params["bg_url"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      is_nil(person_url) or is_nil(bg_url) ->
        json(conn, %{success: false, message: "personUrl 和 bgUrl 是必需参数"})

      true ->
        with {:ok, bg_path} <- download_to_temp(bg_url),
             {:ok, person_path} <- download_to_temp(person_url) do
          opts = [
            x: params["x"],
            y: params["y"],
            scale: params["scale"]
          ]

          case KgEdu.Agent.VideoProcessor.compose(bg_path, person_path, opts) do
            {:ok, output_path} ->
              File.rm(bg_path)
              File.rm(person_path)

              case KgEdu.Agent.OssUpload.upload(output_path) do
                {:ok, url} -> json(conn, %{success: true, data: %{resultUrl: url}})
                {:error, reason} -> json(conn, %{success: false, message: "结果上传失败: #{reason}"})
              end

            {:error, reason} ->
              File.rm(bg_path)
              File.rm(person_path)
              json(conn, %{success: false, message: "合成失败: #{reason}"})
          end
        else
          {:error, reason} -> json(conn, %{success: false, message: "文件下载失败: #{reason}"})
        end
    end
  end

  @doc """
  POST /api/digital-human/export
  视频导出（格式/编码/码率/帧率）。

  Body: { videoUrl, format?, codec?, bitrate?, fps? }

  当前阶段：MP4 + H264 直接返回原视频；其他格式/编码返回占位提示，
  待 VideoProcessor.transcode 接入 Oban 异步转码后启用。
  """
  def export(conn, params) do
    tenant = extract_tenant(conn, params)
    video_url = params["videoUrl"] || params["video_url"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, message: "未设置租户上下文"})

      is_nil(video_url) ->
        json(conn, %{success: false, message: "videoUrl 是必需参数"})

      true ->
        format = params["format"] || "mp4"
        codec = params["codec"] || "h264"

        if format == "mp4" and codec == "h264" do
          json(conn, %{
            success: true,
            message: "MP4/H264 为原始格式，直接导出",
            data: %{exportUrl: video_url, format: format, codec: codec}
          })
        else
          json(conn, %{
            success: false,
            code: "PLACEHOLDER",
            message: "#{format}/#{codec} 转码导出开发中，请先用 MP4/H264 导出",
            data: %{format: format, codec: codec}
          })
        end
    end
  end

  # ── Helpers ─────────────────────────────────────────────────────────

  defp download_to_temp(url) do
    tmp_path = Path.join(System.tmp_dir!(), "dh_#{System.unique_integer([:positive])}")

    case Req.get(url, connect_options: [timeout: 10_000], receive_timeout: 60_000, follow_redirects: true) do
      {:ok, %Req.Response{status: 200, body: body}} ->
        File.write!(tmp_path, body)
        {:ok, tmp_path}

      {:ok, %Req.Response{status: status}} ->
        {:error, "下载失败 (#{status})"}

      {:error, reason} ->
        {:error, inspect(reason)}
    end
  end

  defp float_param(nil, default), do: default
  defp float_param(v, _default) when is_number(v), do: v

  defp float_param(v, default) when is_binary(v) do
    case Float.parse(v) do
      {f, _} -> f
      _ -> default
    end
  end

  defp int_param(nil, default), do: default
  defp int_param(v, _default) when is_integer(v), do: v

  defp int_param(v, default) when is_binary(v) do
    case Integer.parse(v) do
      {i, _} -> i
      _ -> default
    end
  end

  defp enqueue_worker(task, tenant, _user_id) do
    %{task_id: task.id, tenant: tenant}
    |> KgEdu.Workers.DigitalHumanWorker.new()
    |> KgEdu.Oban.insert()
    |> case do
      {:ok, _job} ->
        Logger.info("[DigitalHuman] enqueued worker for task #{task.id}")

      {:error, reason} ->
        Logger.error("[DigitalHuman] failed to enqueue worker: #{inspect(reason)}")

        # Mark task failed if enqueue fails
        task
        |> Ash.Changeset.for_update(:update_status, %{status: :failed, error_message: "后台任务入队失败"})
        |> Ash.update!(tenant: tenant, authorize?: false)
    end
  end

  defp serialize_task(task) do
    %{
      id: task.id,
      title: task.title,
      status: to_string(task.status),
      progressMessage: task.progress_message,
      imageUrl: task.image_url,
      audioUrl: task.audio_url,
      videoUrl: task.video_url,
      resolution: task.resolution,
      errorMessage: task.error_message,
      createdAt: task.inserted_at,
      updatedAt: task.updated_at
    }
  end

  defp actor(conn), do: conn.assigns[:current_user] || conn.assigns[:actor]
  defp actor_id(conn), do: (actor(conn) && actor(conn).id) || nil

  defp extract_user_id(conn, params) do
    params["userId"] || (actor(conn) && actor(conn).id)
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
