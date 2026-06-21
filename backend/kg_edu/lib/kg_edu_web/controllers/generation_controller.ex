defmodule KgEduWeb.GenerationController do
  use KgEduWeb, :controller

  @doc """
  POST /api/generate_ai_exercise
  Direct exercise generation endpoint (non-streaming).
  """
  def generate_exercise(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      KgEdu.Agent.SessionContext.put(tenant: tenant, user_id: params["userId"])

      result =
        KgEdu.Agent.Tools.GenerateExercises.run(%{
          courseId: params["courseId"],
          knowledgeName: params["knowledgeName"] || params["chapterName"],
          exerciseType: params["exerciseType"] || "multiple_choice",
          number: params["number"] || 5,
          difficulty: params["difficulty"] || 3
        }, %{})

      case result do
        {:ok, output} ->
          json(conn, %{
            success: true,
            message: output.result,
            data: output[:exercises] || []
          })

        {:error, reason} ->
          json(conn, %{success: false, error: reason})
      end
    end
  end

  @doc """
  POST /competency-graph/generate
  Generate competency graph for a major.
  """
  def generate_competency_graph(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      KgEdu.Agent.SessionContext.put(tenant: tenant)

      result =
        KgEdu.Agent.Tools.GenerateCompetencyGraph.run(%{
          majorId: params["majorId"],
          customPrompt: params["customPrompt"]
        }, %{})

      case result do
        {:ok, output} ->
          json(conn, %{
            success: true,
            message: output.result,
            data: %{nodeCount: output[:nodeCount], categories: output[:categories]}
          })

        {:error, reason} ->
          json(conn, %{success: false, message: reason})
      end
    end
  end

  @doc """
  POST /curriculum/generate
  Generate curriculum design for a major (synchronous).
  """
  def generate_curriculum(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, message: "未设置租户上下文"})
    else
      KgEdu.Agent.SessionContext.put(tenant: tenant, user_id: params["userId"])

      result =
        KgEdu.Agent.Tools.GenerateCurriculum.run(%{
          majorId: params["majorId"],
          customPrompt: params["customPrompt"]
        }, %{})

      case result do
        {:ok, output} ->
          json(conn, %{
            success: true,
            message: output.result,
            data: %{
              curriculumId: output[:curriculumId],
              title: output[:title],
              content: output[:content]
            }
          })

        {:error, reason} ->
          json(conn, %{success: false, message: reason})
      end
    end
  end

  @doc """
  POST /api/curriculum/upload
  Upload a curriculum document file to OSS and update the design record.
  """
  def upload_curriculum_document(conn, params) do
    tenant = extract_tenant(conn, params)
    id = params["id"]

    if is_nil(tenant) or is_nil(id) do
      json(conn, %{success: false, message: "缺少 tenant 或 id"})
    else
      KgEdu.Agent.SessionContext.put(tenant: tenant)

      case decode_and_upload(params) do
        {:ok, url} ->
          # Update curriculum design with file URL
          try do
            KgEdu.MajorAnalysis.CurriculumDesign
            |> Ash.get!(id, tenant: tenant, authorize?: false)
            |> Ash.Changeset.for_update(:update, %{file_url: url})
            |> Ash.update!(tenant: tenant, authorize?: false)

            json(conn, %{success: true, message: "上传成功", data: %{file_url: url}})
          rescue
            e ->
              json(conn, %{success: true, message: "文件已上传，记录更新失败", data: %{file_url: url}})
          end

        {:error, reason} ->
          json(conn, %{success: false, message: reason})
      end
    end
  end

  # ── Upload helpers ─────────────────────────────────────────────────────

  defp decode_and_upload(params) do
    # Handle base64 file_data
    data = params["file_data"] || ""

    if is_binary(data) and byte_size(data) > 0 do
      base64 = String.replace(data, ~r/^data:.*?;base64,/, "")
      file_name = params["file_name"] || "curriculum_document.docx"
      tmp_path = Path.join(System.tmp_dir!(), "#{System.os_time(:millisecond)}_#{file_name}")

      case Base.decode64(base64) do
        {:ok, bytes} ->
          File.write!(tmp_path, bytes)
          KgEdu.Agent.OssUpload.upload(tmp_path)

        :error ->
          {:error, "base64解码失败"}
      end
    else
      # Check for file upload
      upload = params["file"] || params["upload"]

      if is_map(upload) and Map.has_key?(upload, :path) do
        KgEdu.Agent.OssUpload.upload(upload.path)
      else
        {:error, "缺少文件内容"}
      end
    end
  end

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
