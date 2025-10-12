defmodule KgEduWeb.UploadVideoController do
  use KgEduWeb, :controller
  require Logger

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
    secret = Application.get_env(:kg_edu, :mux_webhook_secret) || "tk5udqsqdm21t5b2deeu0vhdqjrtin57"

    case Mux.Webhooks.verify_header(raw_body, signature_header, secret) do
      :ok ->
        body = Plug.Conn.get_req_header(conn, "content-type")
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

    # case Videos.get_by_upload_id(upload_id) do
    #   video ->
    #     Videos.update_video(video, %{asset_id: asset_id})

    #   nil ->
    #     Logger.warn("Video record not found for upload: #{upload_id}")
    # end
  end

  defp handle_webhook_event(%{"type" => "video.asset.ready", "data" => data}) do
    Logger.info("Video ready for playback: #{data["asset_id"]}")

    asset_id = data["asset_id"]
    playback_id = get_playback_id(asset_id)
    Logger.info("Playback ID: #{playback_id}")

    # case Videos.get_by_asset_id(asset_id) do
    #   video ->
    #     playback_id = get_playback_id(asset_id)

    #     Videos.update_video(video, %{
    #       playback_id: playback_id,
    #       status: "ready"
    #     })

    #   nil ->
    #     Logger.warn("Video record not found for asset: #{asset_id}")
    # end
  end

  defp handle_webhook_event(%{"type" => _type, "data" => _data}) do
    # Handle other event types if needed
    :ok
  end

  defp get_playback_id(asset_id) do
    client = Mux.client()

    case Mux.Video.Assets.get(client, asset_id) do
      {:ok, asset, _env} ->
        case asset["playback_ids"] do
          [%{"id" => id} | _] -> id
          [%{id: id} | _] -> id
          [] -> nil
        end

      {:error, _err} ->
        nil
    end
  end

end
