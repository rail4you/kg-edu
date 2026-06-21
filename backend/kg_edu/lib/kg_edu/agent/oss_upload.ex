defmodule KgEdu.Agent.OssUpload do
  @moduledoc """
  OSS file upload using HTTP Basic Auth.

  Uploads to Aliyun OSS via HTTP PUT with simple Basic authentication.
  Same credentials and bucket as the Express server.
  """

  require Logger

  @bucket "kg-edu"
  @oss_host "oss-cn-beijing.aliyuncs.com"
  @credentials "LTAI5tA3M63FNf9qJPGwHGMU:Y481c9cjNvloxWTC0WOkLw8qWM9FMI"

  @doc """
  Upload a local file to Aliyun OSS and return the public URL.

  Returns `{:ok, url}` or `{:error, reason}`.
  """
  def upload(file_path) when is_binary(file_path) do
    if not File.exists?(file_path) do
      {:error, "File not found: #{file_path}"}
    else
      timestamp = timestamp_key()
      file_name = Path.basename(file_path)
      # Sanitize: replace Chinese/special chars with safe ASCII for OSS object key
      safe_name = sanitize_filename(file_name)
      object_key = "uploads/#{timestamp}/#{safe_name}"
      file_binary = File.read!(file_path)

      case put_object(object_key, file_binary) do
        :ok ->
          url = "https://#{@bucket}.#{@oss_host}/#{encoded_path(object_key)}"
          File.rm(file_path)
          {:ok, url}

        {:error, reason} ->
          {:error, "OSS upload failed: #{inspect(reason)}"}
      end
    end
  end

  @doc """
  Upload a file from a Plug.Upload struct (multipart form data).
  """
  def upload_form(upload_file, opts \\ []) do
    prefix = Keyword.get(opts, :prefix, "uploads")
    timestamp = timestamp_key()
    object_key = "#{prefix}/#{timestamp}/#{upload_file.filename}"
    file_binary = File.read!(upload_file.path)

    content_type = upload_file.content_type || "application/octet-stream"

    case put_object(object_key, file_binary, content_type) do
      :ok ->
        url = "https://#{@bucket}.#{@oss_host}/#{object_key}"
        {:ok, url}

      {:error, reason} ->
        {:error, "OSS upload failed: #{inspect(reason)}"}
    end
  end

  @doc """
  Save a file record to the database via Ash.
  Returns the file ID or nil (graceful fallback — file URL is still returned).
  """
  def save_file_record(tenant, file_name, file_url, file_size, file_type, opts \\ []) do
    try do
      record =
        KgEdu.Courses.File
        |> Ash.Changeset.for_create(:create, %{
          filename: file_name,
          path: file_url,
          size: file_size,
          file_type: file_type,
          purpose: "ai_generated",
          source: "ai_generated",
          created_by_id: Keyword.get(opts, :user_id),
          course_id: Keyword.get(opts, :course_id),
          knowledge_resource_id: Keyword.get(opts, :knowledge_resource_id)
        })
        |> Ash.create!(tenant: tenant, authorize?: false)

      Logger.info("[OssUpload] Saved file record: #{record.id} (#{file_name}) for course #{Keyword.get(opts, :course_id)}")
      record.id
    rescue
      e ->
        Logger.warning("[OssUpload] Failed to save file record: #{Exception.message(e)}")
        nil
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp put_object(object_key, binary, content_type \\ "application/octet-stream") do
    # URL-encode the object key for non-ASCII characters (Chinese filenames, etc.)
    encoded_key = object_key |> String.split("/") |> Enum.map_join("/", &URI.encode_www_form/1)
    url = "https://#{@bucket}.#{@oss_host}/#{encoded_key}"
    auth = "Basic " <> Base.encode64(@credentials)

    result =
      Req.new(
        method: :put,
        url: url,
        headers: %{
          "authorization" => auth,
          "content-type" => content_type,
          "date" => format_gmt()
        },
        body: binary
      )
      |> Req.Request.run()

    case result do
      {:ok, %{status: status}} when status in 200..299 ->
        :ok

      {:ok, %{status: status, body: body}} ->
        {:error, "#{status}: #{inspect(body)}"}

      {:error, error} ->
        {:error, inspect(error)}
    end
  end

  defp timestamp_key do
    DateTime.utc_now() |> Calendar.strftime("%Y%m%d%H%M%S")
  end

  defp sanitize_filename(name) do
    # Keep extension, replace Chinese/special chars with hex hash suffix
    ext = Path.extname(name)
    base = Path.basename(name, ext)
    # If the name is pure ASCII and safe, keep it; otherwise use a hash
    if String.match?(base, ~r/^[a-zA-Z0-9._-]+$/) do
      name
    else
      hash = :crypto.hash(:md5, name) |> Base.encode16(case: :lower) |> binary_part(0, 8)
      "file_#{hash}#{ext}"
    end
  end

  defp encoded_path(key) do
    key |> String.split("/") |> Enum.map_join("/", &URI.encode_www_form/1)
  end

  defp format_gmt do
    # RFC 1123 GMT format: "Sun, 21 Jun 2026 03:00:00 GMT"
    now = DateTime.utc_now()
    day = now |> Calendar.strftime("%a")
    date_part = now |> Calendar.strftime("%d %b %Y %H:%M:%S")
    "#{day}, #{date_part} GMT"
  end
end
