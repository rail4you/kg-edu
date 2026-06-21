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

  # ── Helpers ─────────────────────────────────────────────────────────────

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
