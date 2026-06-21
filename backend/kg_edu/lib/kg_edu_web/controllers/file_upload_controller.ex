defmodule KgEduWeb.FileUploadController do
  use KgEduWeb, :controller

  require Logger

  @doc """
  POST /api/upload

  Receives a file via multipart form data and uploads it to Aliyun OSS.
  Returns JSON with the file URL.
  Matches the Express server's /api/upload behavior.
  """
  def upload(conn, %{"file" => %Plug.Upload{} = upload_file}) do
    result = KgEdu.Agent.OssUpload.upload_form(upload_file)

    case result do
      {:ok, url} ->
        conn
        |> json(%{
          success: true,
          url: url,
          filename: upload_file.filename,
          originalName: upload_file.filename,
          size: File.stat!(upload_file.path).size,
          type: upload_file.content_type
        })

      {:error, reason} ->
        conn
        |> put_status(500)
        |> json(%{success: false, error: reason})
    end
  end

  def upload(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{success: false, error: "No file provided"})
  end

  @doc """
  POST /api/sts-token

  Generate Aliyun STS temporary credentials for browser direct OSS upload.
  Returns credentials + upload config for the frontend's ali-oss client.
  Matches the Express server's /api/sts-token behavior.
  """
  def sts_token(conn, params) do
    file_name = params["fileName"] || "untitled"

    # Use static credentials directly (same as Express server)
    # In production, this should use AssumeRole via STS API.
    # For now, return static credentials with expiration in 1 hour.
    now = DateTime.utc_now()
    date_prefix = Calendar.strftime(now, "%Y-%m-%d")
    upload_path = "uploads/#{date_prefix}/#{file_name}"

    expiration =
      now
      |> DateTime.add(3600, :second)
      |> DateTime.to_iso8601()

    conn
    |> json(%{
      success: true,
      credentials: %{
        accessKeyId: "LTAI5tA3M63FNf9qJPGwHGMU",
        accessKeySecret: "Y481c9cjNvloxWTC0WOkLw8qWM9FMI",
        securityToken: "",
        expiration: expiration
      },
      uploadConfig: %{
        region: "cn-beijing",
        bucket: "kg-edu",
        endpoint: "https://oss-cn-beijing.aliyuncs.com",
        uploadPath: upload_path,
        fileName: file_name,
        fileSize: params["fileSize"],
        fileType: params["fileType"]
      }
    })
  end
end
