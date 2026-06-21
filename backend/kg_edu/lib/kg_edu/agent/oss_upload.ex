defmodule KgEdu.Agent.OssUpload do
  @moduledoc """
  OSS file upload for agent-generated documents.

  Uploads files to AliCloud OSS using HTTP PUT with HMAC-SHA1 signature.
  """

  require Logger

  @bucket "kg-edu"
  @endpoint "oss-cn-beijing.aliyuncs.com"

  defp access_key_id, do: System.get_env("OSS_ACCESS_KEY_ID") || "LTAI5tA3M63FNf9qJPGwHGMU"
  defp access_key_secret, do: System.get_env("OSS_ACCESS_KEY_SECRET") || "Y481c9cjNvloxWTC0WOkLw8qWM9FMI"

  @doc """
  Upload a local file to OSS and return the public URL.

  Returns `{:ok, url}` or `{:error, reason}`.
  """
  def upload(file_path) when is_binary(file_path) do
    unless File.exists?(file_path) do
      {:error, "File not found: #{file_path}"}
    else
      timestamp = timestamp_key()
      file_name = Path.basename(file_path)
      object_key = "uploads/#{timestamp}/#{file_name}"
      url = "https://#{@bucket}.#{@endpoint}/#{object_key}"

      result =
        Req.new(
          method: :put,
          url: url,
          headers: auth_headers("PUT", object_key, file_path)
        )
        |> Req.Request.put_attachment(file_path)
        |> Req.Request.run()

      case result do
        {:ok, %{status: status}} when status in 200..299 ->
          File.rm(file_path)
          {:ok, url}

        {:ok, %{status: status, body: body}} ->
          {:error, "OSS upload failed (#{status}): #{inspect(body)}"}

        {:error, error} ->
          {:error, "OSS upload failed: #{inspect(error)}"}
      end
    end
  end

  @doc """
  Save a file record to the database via Ash.
  Returns the file ID or nil (graceful fallback — file URL is still returned).
  """
  def save_file_record(tenant, file_name, file_url, file_size, file_type, opts \\ []) do
    try do
      {:ok, record} =
        KgEdu.Courses.File
        |> Ash.Changeset.for_create(:create, %{
          filename: file_name,
          path: file_url,
          size: file_size,
          file_type: file_type,
          purpose: "ai_generated",
          created_by_id: Keyword.get(opts, :user_id),
          course_id: Keyword.get(opts, :course_id),
          knowledge_resource_id: Keyword.get(opts, :knowledge_resource_id)
        })
        |> Ash.create!(tenant: tenant, authorize?: false)

      record.id
    rescue
      e ->
        Logger.warning("[OssUpload] Failed to save file record: #{Exception.message(e)}")
        nil
    end
  end

  # ── OSS Signature (HMAC-SHA1) ──────────────────────────────────────────

  defp auth_headers(method, object_key, file_path) do
    date = format_http_date()
    content_type = MIME.from_path(file_path)
    content_md5 = file_path |> File.read!() |> :crypto.hash(:md5) |> Base.encode64()

    string_to_sign = "#{method}\n#{content_md5}\n#{content_type}\n#{date}\n/#{@bucket}/#{object_key}"

    signature =
      :crypto.mac(:hmac, :sha, access_key_secret(), string_to_sign)
      |> Base.encode64()

    [
      {"date", date},
      {"content-type", content_type},
      {"content-md5", content_md5},
      {"authorization", "OSS #{access_key_id()}:#{signature}"}
    ]
  end

  defp timestamp_key do
    DateTime.utc_now()
    |> Calendar.strftime("%Y%m%d%H%M%S")
  end

  defp format_http_date do
    DateTime.utc_now()
    |> Calendar.strftime("%a, %d %b %Y %H:%M:%S GMT")
  end
end
