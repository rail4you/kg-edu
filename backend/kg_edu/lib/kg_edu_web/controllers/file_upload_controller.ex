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
                error_messages =
                  case reason do
                    ash_error when is_map(ash_error) ->
                      # Extract error messages from Ash error with :errors field
                      case Map.get(ash_error, :errors) do
                        nil ->
                          [inspect(ash_error)]

                        errors when is_list(errors) ->
                          Enum.map(errors, fn
                            %{error: message} when is_binary(message) -> message
                            %{message: message} when is_binary(message) -> message
                            other -> inspect(other)
                          end)

                        _ ->
                          [inspect(ash_error)]
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

  def import_excel(conn, %{"sheet_data" => sheet_data, "course_id" => course_id} = params) do
    # JSON format with parsed sheet data from Node.js
    tenant = params["tenant"] || Plug.Conn.get_req_header(conn, "x-tenant") |> List.first() || conn.assigns[:ash_tenant] || conn.assigns[:tenant]
    IO.inspect("Received sheet_data with #{length(sheet_data)} rows")
    IO.inspect("First row: #{inspect(List.first(sheet_data))}")
    import_excel_json(conn, %{"sheet_data" => sheet_data}, course_id, tenant)
  end

  def import_excel(conn, %{"file_data" => file_data, "course_id" => course_id} = params) do
    # JSON format with base64 encoded file
    # 优先从 params 获取 tenant，其次从 header 获取 x-tenant，最后从 conn.assigns 获取
    tenant = params["tenant"] || Plug.Conn.get_req_header(conn, "x-tenant") |> List.first() || conn.assigns[:ash_tenant] || conn.assigns[:tenant]
    import_excel_json(conn, file_data, course_id, tenant)
  end

  def import_excel(conn, %{"file" => file_upload, "course_id" => course_id}) do
    # Multipart form data format
    tenant = Plug.Conn.get_req_header(conn, "x-tenant") |> List.first() || conn.assigns[:ash_tenant] || conn.assigns[:tenant]
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

      not String.ends_with?(file_upload.filename, ".xlsx") and not String.ends_with?(file_upload.filename, ".xls") ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["Only .xlsx or .xls files are allowed"]
        })

      true ->
        # Read file content and convert to base64
        case File.read(file_upload.path) do
          {:ok, file_content} ->
            base64_data = Base.encode64(file_content)
            import_excel_json(conn, base64_data, course_id, tenant)

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

  def import_excel(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{
      success: false,
      errors: ["File and course_id are required"]
    })
  end

  defp import_excel_json(conn, file_data, course_id, tenant) do
    # 处理两种格式：
    # 1. file_data - base64 编码的 Excel 文件
    # 2. sheet_data - Node.js 解析后的 JSON sheet 数据
    
    actor = Map.get(conn.assigns, :current_user)
    
    cond do
      # 格式1: sheet_data (Node.js 解析后的数据)
      is_map(file_data) and Map.has_key?(file_data, "sheet_data") ->
        # 直接使用解析后的行数据
        process_sheet_data(conn, file_data["sheet_data"], course_id, tenant, actor)
        
      # 格式2: file_data 包含 base64 数据
      is_binary(file_data) ->
        base64_data = case String.split(file_data, ";base64,") do
          [_, encoded] -> encoded
          _ -> file_data
        end

        case Base.decode64(base64_data) do
          {:ok, _decoded} ->
            case KgEdu.Knowledge.Resource.import_knowledge_from_excel(
                   %{
                     excel_data: base64_data,
                     course_id: course_id
                   },
                   actor: actor,
                   tenant: tenant
                 ) do
              :ok ->
                json(conn, %{
                  success: true,
                  message: "Excel file imported successfully"
                })

              {:error, reason} ->
                error_messages =
                  case reason do
                    ash_error when is_map(ash_error) ->
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
                    string when is_binary(string) -> [string]
                    other -> [inspect(other)]
                  end

                conn
                |> put_status(:unprocessable_entity)
                |> json(%{
                  success: false,
                  errors: error_messages
                })
            end

          :error ->
            conn
            |> put_status(:bad_request)
            |> json(%{
              success: false,
              errors: ["Invalid base64 encoded file data"]
            })
        end
        
      true ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["Invalid file data format"]
        })
    end
  end
  
  defp process_sheet_data(conn, rows, course_id, tenant, actor) do
    # 处理 Node.js 解析后的 sheet 数据
    case rows do
      nil ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["No sheet data provided"]
        })
        
      _ when is_list(rows) ->
        # 使用 ExcelParser 处理数据（跳过前4行，处理空值）
        processed_rows = KgEdu.ExcelParser.process_sheet_data(rows)
        
        IO.inspect("Processed #{length(processed_rows)} data rows from sheet")
        IO.inspect("First processed row: #{inspect(List.first(processed_rows))}")
        
        # 直接调用 process_knowledge_import 处理数据
        case KgEdu.Knowledge.Resource.process_knowledge_import(processed_rows, course_id, tenant) do
          {:ok, message} ->
            json(conn, %{
              success: true,
              message: message
            })
            
          {:error, reason} ->
            conn
            |> put_status(:unprocessable_entity)
            |> json(%{
              success: false,
              errors: [inspect(reason)]
            })
        end
        
      _ ->
        conn
        |> put_status(:bad_request)
        |> json(%{
          success: false,
          errors: ["Invalid sheet data format, expected array"]
        })
    end
  end
end
