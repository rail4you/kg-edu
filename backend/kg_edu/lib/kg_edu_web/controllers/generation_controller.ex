defmodule KgEduWeb.GenerationController do
  use KgEduWeb, :controller

  @doc """
  POST /api/generate_ai_exercise
  Direct exercise generation endpoint (non-streaming).
  """
  def generate_exercise(conn, params) do
    tenant = extract_tenant(conn, params)
    # Frontend wraps params in "input" key
    input = params["input"] || params

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      KgEdu.Agent.SessionContext.put(tenant: tenant, user_id: input["userId"])

      result =
        KgEdu.Agent.Tools.GenerateExercises.run(%{
          courseId: input["courseId"],
          knowledgeName: input["knowledgeName"] || input["chapterName"],
          exerciseType: input["exerciseType"] || "multiple_choice",
          number: input["number"] || 5,
          difficulty: input["difficulty"] || 3
        }, %{})

      case result do
        {:ok, output} ->
          exercises_data =
            (output[:exercises] || [])
            |> Enum.map(fn ex ->
              %{
                id: ex.id,
                title: ex.title,
                question_type: ex.question_type,
                difficulty: ex.difficulty
              }
            end)

          json(conn, %{
            success: true,
            message: output.result,
            data: exercises_data
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
  POST /api/curriculum/jobs
  Create an async curriculum generation job.
  """
  def create_curriculum_job(conn, params) do
    tenant = extract_tenant(conn, params)
    major_id = params["majorId"]

    if is_nil(tenant) or is_nil(major_id) do
      json(conn, %{success: false, message: "tenant 和 majorId 是必需参数"})
    else
      job_id = KgEdu.Agent.JobManager.create(tenant, major_id)
      KgEdu.Agent.SessionContext.put(tenant: tenant, user_id: params["userId"])

      # Update status to running
      KgEdu.Agent.JobManager.update(job_id, %{status: "running", message: "正在生成课程体系..."})

      # Ensure API key is loaded BEFORE spawning task (sets env vars for entire VM)
      KgEdu.Agent.ApiKeyProvider.ensure_key()

      # Run generation async
      Task.start(fn ->
        result =
          KgEdu.Agent.Tools.GenerateCurriculum.run(%{
            majorId: major_id,
            customPrompt: params["customPrompt"]
          }, %{})

        case result do
          {:ok, output} ->
            KgEdu.Agent.JobManager.update(job_id, %{
              status: "succeeded",
              message: output.result,
              result: %{
                curriculumId: output[:curriculumId],
                title: output[:title],
                markdownPreview: output[:content],
                downloadUrl: output[:downloadUrl] || ""
              }
            })

          {:error, reason} ->
            KgEdu.Agent.JobManager.update(job_id, %{
              status: "failed",
              message: reason,
              error: reason
            })
        end
      end)

      json(conn, %{
        success: true,
        message: "任务已创建",
        data: %{jobId: job_id, status: "queued"}
      })
    end
  end

  @doc """
  GET /api/curriculum/jobs/:jobId
  Get the status of a curriculum generation job.
  """
  def get_curriculum_job(conn, %{"jobId" => job_id}) do
    case KgEdu.Agent.JobManager.get(job_id) do
      {:ok, job} ->
        json(conn, %{success: true, data: job})

      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{success: false, message: "任务不存在"})
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
            _e ->
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
