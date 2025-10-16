defmodule KgEduWeb.DownloadController do
  use KgEduWeb, :controller

  def template(conn, _params) do
    file_path = Path.join(:code.priv_dir(:kg_edu), "uploads/template.xlsx")

    case File.read(file_path) do
      {:ok, content} ->
        conn
        |> put_resp_content_type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        |> put_resp_header("content-disposition", "attachment; filename=\"template.xlsx\"")
        |> send_resp(200, content)

      {:error, _reason} ->
        conn
        |> put_status(404)
        |> json(%{error: "File not found"})
    end
  end
end
