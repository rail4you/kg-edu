defmodule KgEduWeb.FormsAiController do
  @moduledoc """
  P3: 审批 AI 能力 — AI 填表（文本/图片回填）与 AI 公式（生成/解释）。
  """
  use KgEduWeb, :controller

  plug KgEduWeb.Plugs.RequireEditable when action in [:ai_fill, :ai_formula]

  @doc """
  POST /api/forms/ai-fill — body: { schema: [...], text?, imageUrl? }。
  """
  def ai_fill(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    schema = input["schema"] || []
    text = input["text"]
    image_url = input["imageUrl"] || input["image_url"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      schema == [] ->
        json(conn, %{success: false, error: "缺少表单 schema"})

      is_binary(text) and text != "" ->
        case KgEdu.Agent.FormAiService.fill_from_text(schema, text) do
          {:ok, values} -> json(conn, %{success: true, values: values})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end

      is_binary(image_url) and image_url != "" ->
        case KgEdu.Agent.FormAiService.fill_from_image(schema, image_url) do
          {:ok, values} -> json(conn, %{success: true, values: values})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end

      true ->
        json(conn, %{success: false, error: "请提供文本描述或图片"})
    end
  end

  @doc """
  POST /api/forms/ai-formula — body: { fields: [...], goal }。
  """
  def ai_formula(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    fields = input["fields"] || []
    goal = input["goal"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      fields == [] or not is_binary(goal) or goal == "" ->
        json(conn, %{success: false, error: "缺少字段或计算目标"})

      true ->
        case KgEdu.Agent.FormAiService.suggest_formula(fields, goal) do
          {:ok, result} ->
            json(conn, %{success: true, expression: result.expression, explanation: result.explanation})

          {:error, reason} ->
            json(conn, %{success: false, error: reason})
        end
    end
  end

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
