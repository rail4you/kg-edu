defmodule KgEduWeb.ImportController do
  use KgEduWeb, :controller

  @doc """
  POST /import — Import knowledge points from Excel (base64 JSON format).

  Accepts: { tenant, course_id, file_data (base64), file_name }
  """
  def import_knowledge(conn, params) do
    tenant = extract_tenant(conn, params)
    course_id = params["course_id"]

    if is_nil(tenant) or is_nil(course_id) do
      json(conn, %{success: false, error: "tenant 和 course_id 是必需参数"})
    else
      case decode_excel(params) do
        {:ok, _base64_data} ->
          # Use existing Ash import action
          KgEdu.Agent.SessionContext.put(tenant: tenant)

          try do
            result =
              KgEdu.Knowledge.ImportService.import_knowledge_excel(
                extract_base64(params["file_data"]),
                course_id
              )

            case result do
              {:ok, data} ->
                json(conn, %{
                  success: true,
                  message: "导入成功",
                  data: data
                })

              {:error, reason} ->
                json(conn, %{success: false, error: inspect(reason)})
            end
          rescue
            e ->
              json(conn, %{success: false, error: "导入失败: #{Exception.message(e)}"})
          end

        {:error, reason} ->
          json(conn, %{success: false, error: reason})
      end
    end
  end

  @doc """
  POST /import-chapters — Import chapter structure from Excel.
  Supports both multipart/form-data and JSON base64 formats.
  """
  def import_chapters(conn, params) do
    tenant = extract_tenant(conn, params)

    # Handle multipart form-data
    course_id =
      params["courseId"] || params["course_id"] || params["CourseId"] || ""

    if is_nil(tenant) or course_id == "" do
      json(conn, %{success: false, error: "tenant 和 courseId 是必需参数"})
    else
      case decode_excel(params) do
        {:ok, _data} ->
          KgEdu.Agent.SessionContext.put(tenant: tenant)
          base64_data = extract_base64(params["file_data"])
          _file_name = params["file_name"] || "chapters.xlsx"

          try do
            result =
              KgEdu.Knowledge.Resource.import_knowledge_from_excel(%{
                excel_data: base64_data,
                course_id: course_id
              })

            case result do
              {:ok, data} ->
                json(conn, %{
                  success: true,
                  message: "导入成功",
                  importedResources: data[:resources] || %{created: 0},
                  data: data
                })

              {:error, reason} ->
                json(conn, %{success: false, error: inspect(reason)})
            end
          rescue
            e ->
              json(conn, %{success: false, error: "导入失败: #{Exception.message(e)}"})
          end

        {:error, reason} ->
          json(conn, %{success: false, error: reason})
      end
    end
  end

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp decode_excel(params) do
    data = params["file_data"] || ""

    if is_binary(data) and byte_size(data) > 0 do
      {:ok, data}
    else
      # Check if there's a file upload
      upload = params["file"] || params["upload"]

      if is_map(upload) and Map.has_key?(upload, :path) do
        case File.read(upload.path) do
          {:ok, content} ->
            {:ok, Base.encode64(content)}

          {:error, reason} ->
            {:error, "文件读取失败: #{reason}"}
        end
      else
        {:error, "缺少 file_data 或 file 上传"}
      end
    end
  end

  defp extract_base64(data) when is_binary(data) do
    String.replace(data, ~r/^data:.*?;base64,/, "")
  end

  defp extract_base64(_), do: ""

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      params["Schema"] ||
      params["Tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      get_req_header(conn, "x-tenant") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
