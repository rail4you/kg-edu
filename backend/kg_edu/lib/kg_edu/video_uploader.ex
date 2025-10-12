defmodule KgEdu.VideoUploader do
  require Logger

  def create_video_asset(playback_policy \\ "public") do
    client =
      Mux.client(
        "5d03c8ed-21f9-452f-9d9f-5cc28d93b6a5",
        "/TeA9kOSZGHNiQybPSKNBatuNekN4nGKnadGVm12m6KDL+bHjnnDmPr8YBaoNX9WhTG0LtmyaTa"
      )

    asset_id = Ecto.UUID.generate()
    Logger.info("Creating Mux asset with passthrough_id: #{asset_id}")

    {:ok, asset, _env} =
      Mux.Video.Uploads.create(client, %{
        cors_origin: "*",
        new_asset_settings: %{
          passthrough: asset_id,
          playback_policy: [playback_policy]
        }
      })

    asset_id = asset["id"]
    Logger.info("Created Mux asset with ID: #{asset_id}")
    asset
  end
end
