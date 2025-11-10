defmodule KgEduWeb.FileUploadController do
  use KgEduWeb, :controller

  def upload(conn, %{"file" => file_upload, "course_id" => course_id} = params) do
    purpose = Map.get(params, "purpose", "course_file")

    case KgEdu.Courses.File.upload_phoenix_file(%{
           upload: file_upload,
           course_id: course_id,
           purpose: purpose
         }) do
      {:ok, file} ->
        json(conn, %{
          success: true,
          data: %{
            id: file.id,
            filename: file.filename,
            path: file.path,
            size: file.size,
            file_type: file.file_type,
            purpose: file.purpose,
            course_id: file.course_id,
            inserted_at: file.inserted_at
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
      errors: ["File and course_id are required"]
    })
  end

  def download_template(conn, _params) do
    template_path = Path.join(:code.priv_dir(:kg_edu), "uploads/template.xlsx")

    case File.exists?(template_path) do
      true ->
        conn
        |> put_resp_content_type(
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        |> put_resp_header("content-disposition", "attachment; filename=\"template.xlsx\"")
        |> send_file(200, template_path)

      false ->
        conn
        |> put_status(:not_found)
        |> json(%{
          success: false,
          errors: ["Template file not found"]
        })
    end
  end

  def import_xmind(conn, %{"file" => file_upload, "course_id" => course_id}) do
    # Validate file upload structure
    cond do
      file_upload == nil ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["No file provided"]
        })

      not is_map(file_upload) or Map.get(file_upload, :path) == nil ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["Invalid file format. Expected multipart form data with file upload."]
        })

      not String.ends_with?(file_upload.filename, ".xmind") ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["Only .xmind files are allowed"]
        })

      true ->
        # Read file content and convert to base64
        case File.read(file_upload.path) do
        {:ok, file_content} ->
          base64_data = Base.encode64(file_content)

          # Import using the knowledge resource action
          actor = Map.get(conn.assigns, :current_user)
          tenant = conn.assigns[:ash_tenant] || conn.assigns[:tenant]

          case KgEdu.Knowledge.Resource.import_knowledge_from_xmind(
                 %{
                   xmind_data: base64_data,
                   course_id: course_id
                 },
                 actor: actor,
                 tenant: tenant
               ) do
            :ok ->
              json(conn, %{
                success: true,
                message: "XMind file imported successfully"
              })

            {:error, reason} ->
              # Handle Ash errors properly
              error_messages = case reason do
                ash_error when is_map(ash_error) ->
                  # Extract error messages from Ash error with :errors field
                  case Map.get(ash_error, :errors) do
                    nil -> [inspect(ash_error)]
                    errors when is_list(errors) ->
                      Enum.map(errors, fn
                        %{error: message} when is_binary(message) -> message
                        %{message: message} when is_binary(message) -> message
                        other -> inspect(other)
                      end)
                    _ -> [inspect(ash_error)]
                  end
                string when is_binary(string) ->
                  [string]
                other ->
                  [inspect(other)]
              end

              conn
              |> put_status(:unprocessable_entity)
              |> json(%{
                success: false,
                errors: error_messages
              })
          end

        {:error, _reason} ->
          conn
          |> put_status(:internal_server_error)
          |> json(%{
            success: false,
            errors: ["Failed to read uploaded file"]
          })
      end
    end
  end

  def import_xmind(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      success: false,
      errors: ["File and course_id are required"]
    })
  end
end
