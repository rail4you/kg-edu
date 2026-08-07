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

  # 只读教师禁止创建数字人任务
  plug KgEduWeb.Plugs.RequireEditable when action in [:create]

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
            reason =
              changeset
              |> Ash.Changeset.errors()
              |> Enum.map(&Exception.message/1)
              |> Enum.join("; ")

            json(conn, %{success: false, message: reason || "创建任务失败"})
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

  # ── Helpers ─────────────────────────────────────────────────────────

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
