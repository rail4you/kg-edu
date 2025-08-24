defmodule KgEduWeb.FileUploadController do
  use KgEduWeb, :controller

  alias KgEdu.Courses.File

  def upload(conn, %{"file" => file_upload, "course_id" => course_id} = params) do
    purpose = Map.get(params, "purpose", "course_file")
    
    case File.upload_file(%{
      file: file_upload,
      course_id: course_id,
      purpose: purpose
    }, actor: conn.assigns.current_user) do
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
end