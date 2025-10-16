defmodule KgEduWeb.FileUploadController do
  use KgEduWeb, :controller

  alias KgEdu.Courses.File

  def upload(conn, %{"file" => file_upload, "course_id" => course_id} = params) do
    purpose = Map.get(params, "purpose", "course_file")

    case File.upload_phoenix_file(
           %{
             upload: file_upload,
             course_id: course_id,
             purpose: purpose
           },
           actor: conn.assigns.current_user
         ) do
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
    
    case Elixir.File.exists?(template_path) do
      true ->
        conn
        |> put_resp_content_type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
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
end
