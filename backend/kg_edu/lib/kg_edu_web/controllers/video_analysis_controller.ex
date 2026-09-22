defmodule KgEduWeb.VideoAnalysisController do
  @moduledoc """
  P2: 章节视频 AI 解析 — 发起分析任务、轮询状态、读取打点。
  """
  use KgEduWeb, :controller
  require Logger

  plug KgEduWeb.Plugs.RequireEditable when action in [:analyze]

  @doc """
  POST /api/video-analysis/analyze — 发起解析（异步）。
  body: { videoType ("course_video"), videoId, courseId? }
  """
  def analyze(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    video_type = input["videoType"] || input["video_type"] || "course_video"
    video_id = input["videoId"] || input["video_id"]
    course_id = input["courseId"] || input["course_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(video_id) ->
        json(conn, %{success: false, error: "缺少 videoId"})

      true ->
        opts = [tenant: tenant, authorize?: false]

        with {:ok, analysis} <-
               KgEdu.Courses.VideoAnalysis.create_video_analysis(
                 %{video_type: video_type, video_id: video_id, course_id: course_id},
                 opts
               ) do
          Task.Supervisor.start_child(KgEdu.TaskSupervisor, fn ->
            KgEdu.Courses.VideoAnalysisPipeline.run(analysis.id, tenant)
          end)

          json(conn, %{success: true, analysis_id: analysis.id, status: "pending"})
        else
          {:error, reason} ->
            json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 300)})
        end
    end
  end

  @doc """
  GET /api/video-analysis/:id — 解析状态与结果（含分段/摘要/词云）。
  """
  def show(conn, %{"id" => id} = params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      case KgEdu.Courses.VideoAnalysis.get_video_analysis(id,
             tenant: tenant,
             authorize?: false
           ) do
        {:ok, nil} ->
          json(conn, %{success: false, error: "解析任务不存在"})

        {:ok, analysis} ->
          json(conn, %{
            success: true,
            data: %{
              id: analysis.id,
              status: analysis.status,
              summary: analysis.summary,
              segments: analysis.segments,
              wordcloud: analysis.wordcloud,
              error_message: analysis.error_message
            }
          })

        {:error, reason} ->
          json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 300)})
      end
    end
  end

  @doc """
  GET /api/video-analysis/:id/marks — 知识点打点列表。
  """
  def marks(conn, %{"id" => _} = params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    video_type = input["videoType"] || input["video_type"] || "course_video"
    video_id = input["videoId"] || input["video_id"] || params["videoId"] || params["video_id"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(video_id) ->
        json(conn, %{success: false, error: "缺少 videoId"})

      true ->
        case KgEdu.Courses.VideoKnowledgeMark.get_marks_by_video(
               %{video_type: video_type, video_id: video_id},
               tenant: tenant,
               authorize?: false
             ) do
          {:ok, marks} ->
            json(conn, %{
              success: true,
              data:
                Enum.map(marks, fn m ->
                  %{
                    id: m.id,
                    point_sec: m.point_sec,
                    label: m.label,
                    knowledge_resource_id: m.knowledge_resource_id
                  }
                end)
            })

          {:error, reason} ->
            json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 300)})
        end
    end
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
