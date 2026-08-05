defmodule KgEduWeb.UploadVideoController do
  use KgEduWeb, :controller
  require Logger

  # 只读教师禁止视频上传与章节关联操作
  plug KgEduWeb.Plugs.RequireEditable
       when action in [:upload, :link_to_chapter, :unlink_from_chapter]

  alias KgEdu.Courses.Video

  def upload(conn, %{"video" => video_upload, "chapter_id" => chapter_id} = params) do
    title = Map.get(params, "title")

    upload_params = %{
      upload: video_upload,
      chapter_id: chapter_id,
      title: title || ""
    }

    case Video.upload_video(upload_params) do
      {:ok, video} ->
        json(conn, %{
          success: true,
          data: %{
            id: video.id,
            title: video.title,
            playback_id: video.playback_id,
            thumbnail: video.thumbnail,
            duration: video.duration,
            chapter_id: video.chapter_id,
            inserted_at: video.inserted_at
          }
        })

      {:error, changeset} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{
          success: false,
          errors: Ash.Error.to_ash_error(changeset)
        })
    end
  end

  def upload(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      success: false,
      errors: ["Video and chapter_id are required"]
    })
  end

  def link_to_chapter(conn, %{"video_id" => video_id, "chapter_id" => chapter_id}) do
    case Ash.get(KgEdu.Courses.Video, video_id) do
      {:ok, video} ->
        case Ash.update(video, %{chapter_id: chapter_id}) do
          {:ok, updated_video} ->
            json(conn, %{
              success: true,
              message: "Video successfully linked to chapter",
              data: %{
                video_id: updated_video.id,
                chapter_id: updated_video.chapter_id,
                title: updated_video.title
              }
            })

          {:error, error} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{
              success: false,
              error: "Failed to link video to chapter",
              details: inspect(error)
            })
        end

      {:error, _error} ->
        conn
        |> put_status(:not_found)
        |> json(%{
          success: false,
          error: "Video not found"
        })

      {:error, error} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{
          success: false,
          error: "Error finding video",
          details: inspect(error)
        })
    end
  end

  def unlink_from_chapter(conn, %{"video_id" => video_id}) do
    case Ash.get(KgEdu.Courses.Video, video_id) do
      {:ok, video} ->
        case Ash.update(video, %{chapter_id: nil}) do
          {:ok, updated_video} ->
            json(conn, %{
              success: true,
              message: "Video successfully unlinked from chapter",
              data: %{
                video_id: updated_video.id,
                chapter_id: updated_video.chapter_id,
                title: updated_video.title
              }
            })

          {:error, error} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{
              success: false,
              error: "Failed to unlink video from chapter",
              details: inspect(error)
            })
        end

      {:error, _error} ->
        conn
        |> put_status(:not_found)
        |> json(%{
          success: false,
          error: "Video not found"
        })

      {:error, error} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{
          success: false,
          error: "Error finding video",
          details: inspect(error)
        })
    end
  end
end
