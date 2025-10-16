defmodule KgEduWeb.UploadVideoController do
  use KgEduWeb, :controller
  require Logger

  alias KgEdu.Courses.Video

  def upload(conn, %{"video" => video_upload, "chapter_id" => chapter_id} = params) do
    title = Map.get(params, "title")

    upload_params = %{
      upload: video_upload,
      chapter_id: chapter_id,
      title: title
    }

    case Video.upload_video(upload_params, actor: conn.assigns.current_user) do
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

  def direct_upload(conn, _params) do
    asset = KgEdu.VideoUploader.create_video_asset()

    json(conn, %{
      success: true,
      url: asset["url"]
      # asset_id: asset.id,
      # playback_id: List.first(asset.playback_ids)
    })
  end

  def webhook(conn, _params) do
    signature_header = List.first(get_req_header(conn, "mux-signature"))
    raw_body = List.first(conn.assigns.raw_body)
    secret = Application.get_env(:kg_edu, :mux_webhook_secret) || "86h1a5uueieeqm0tot4ptrdd9pg6s5d4"

    case Mux.Webhooks.verify_header(raw_body, signature_header, secret) do
      :ok ->
        {:ok, data} = Jason.decode(raw_body)

        handle_webhook_event(data)

        json(conn, %{success: true})

      :error ->
        Logger.warning("Invalid Mux webhook signature")
        json(conn, %{error: "Invalid signature"})
    end
  end

  defp handle_webhook_event(%{"type" => "video.upload.asset_created", "data" => data}) do
    Logger.info("Upload complete: Asset #{data["asset_id"]} created")

    upload_id = data["upload_id"]
    asset_id = data["asset_id"]

    # Try to find existing video by upload_id
    case Ash.get(KgEdu.Courses.Video, upload_id, filter: [upload_id: upload_id]) do
      {:ok, video} ->
        # Update existing video with asset_id
        case Ash.update(video, :update_video, %{asset_id: asset_id}) do
          {:ok, updated_video} ->
            Logger.info("Updated video #{updated_video.id} with asset_id: #{asset_id}")

          {:error, error} ->
            Logger.error("Failed to update video #{video.id}: #{inspect(error)}")
        end

      {:error, :not_found} ->
        # Create a new video record with upload_id and asset_id
        # We'll update other fields when the video is ready
        video_attrs = %{
          upload_id: upload_id,
          asset_id: asset_id,
          title: "Video #{upload_id}"
        }

        case Ash.create(KgEdu.Courses.Video, :create, video_attrs) do
          {:ok, video} ->
            Logger.info("Created new video #{video.id} for upload: #{upload_id}")

          {:error, error} ->
            Logger.error("Failed to create video for upload #{upload_id}: #{inspect(error)}")
        end

      {:error, error} ->
        Logger.error("Error finding video by upload_id #{upload_id}: #{inspect(error)}")
    end
  end

  defp handle_webhook_event(%{"type" => "video.asset.ready", "data" => data}) do
    Logger.info("Video ready for playback: #{data["asset_id"]}")
    Logger.info("Complete data: #{inspect(data)}")

    asset_id = data["id"]
    playback_id = data["playback_ids"] |> List.first() |> Map.get("id")
    duration = data["tracks"] |> Enum.find(fn track -> track["type"] == "video" end) |> Map.get("duration")
    thumbnail = "https://image.mux.com/#{playback_id}/thumbnail.webp"

    Logger.info("Duration: #{duration}")
    Logger.info("Playback ID: #{playback_id}")
    Logger.info("Thumbnail: #{thumbnail}")

    # create video use asset_id, playback_id, duration, thumbnail
    case Ash.Changeset.for_create(KgEdu.Courses.Video, :create, %{
      asset_id: asset_id,
      playback_id: playback_id,
      duration: duration,
      thumbnail: thumbnail
    }) |> Ash.create do
      {:ok, video} ->
        Logger.info("Created new video #{video.id} with playback details")
      {:error, error} ->
        Logger.error("Failed to create video with playback details: #{inspect(error)}")
    end

  end

  defp handle_webhook_event(%{"type" => _type, "data" => _data}) do
    # Handle other event types if needed
    :ok
  end

  def link_to_chapter(conn, %{"video_id" => video_id, "chapter_id" => chapter_id}) do
    case Ash.get(KgEdu.Courses.Video, video_id) do
      {:ok, video} ->
        case Ash.update(video, :link_video_to_chapter, %{chapter_id: chapter_id}) do
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

      {:error, :not_found} ->
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
        case Ash.update(video, :unlink_video_from_chapter, %{}) do
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

      {:error, :not_found} ->
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
