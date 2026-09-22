defmodule KgEduWeb.TrackController do
  @moduledoc """
  需求 12：AI 追踪 — 兴趣检索/追踪、学者画像与分身对话、期刊 digest。
  """
  use KgEduWeb, :controller

  plug KgEduWeb.Plugs.RequireEditable when action in [:twin_chat]

  @doc """
  GET /api/track/search?type=works|authors&query=... — OpenAlex 检索。
  """
  def search(conn, params) do
    tenant = extract_tenant(conn, params)
    query = params["query"] || ""
    type = params["type"] || "works"

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      query == "" ->
        json(conn, %{success: false, error: "缺少 query"})

      type == "authors" ->
        case KgEdu.AI.ScholarService.search_authors(query) do
          {:ok, result} -> json(conn, %{success: true, data: result})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end

      true ->
        case KgEdu.AI.ScholarService.search_works(query) do
          {:ok, result} -> json(conn, %{success: true, data: result})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end
    end
  end

  @doc """
  GET /api/track/author?openalex_id=... — 学者画像（含分身 persona）。
  """
  def author(conn, params) do
    tenant = extract_tenant(conn, params)
    openalex_id = params["openalex_id"] || params["openalexId"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(openalex_id) ->
        json(conn, %{success: false, error: "缺少 openalex_id"})

      true ->
        case KgEdu.AI.ScholarService.author_profile(openalex_id) do
          {:ok, profile} -> json(conn, %{success: true, data: profile})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end
    end
  end

  @doc """
  POST /api/track/twin-chat — 学者分身对话。body: { openalex_id, message }。
  """
  def twin_chat(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    openalex_id = input["openalex_id"] || input["openalexId"]
    message = input["message"]

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(openalex_id) or not is_binary(message) or message == "" ->
        json(conn, %{success: false, error: "缺少 openalex_id 或 message"})

      true ->
        with {:ok, profile} <- KgEdu.AI.ScholarService.author_profile(openalex_id),
             {:ok, reply} <- chat_with_persona(profile.persona, message) do
          json(conn, %{success: true, data: %{reply: reply, scholar: profile.name}})
        else
          {:error, reason} when is_binary(reason) -> json(conn, %{success: false, error: reason})
          {:error, reason} -> json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 300)})
        end
    end
  end

  @doc """
  GET /api/track/venue-digest?query=... — 期刊要点/观点对比/趋势。
  """
  def venue_digest(conn, params) do
    tenant = extract_tenant(conn, params)
    query = params["query"] || ""

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      query == "" ->
        json(conn, %{success: false, error: "缺少 query"})

      true ->
        case KgEdu.AI.ScholarService.venue_digest(query, tenant) do
          {:ok, result} -> json(conn, %{success: true, data: result})
          {:error, reason} -> json(conn, %{success: false, error: reason})
        end
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp chat_with_persona(persona, message) do
    KgEdu.Agent.ApiKeyProvider.ensure_key(:qwen)

    case ReqLLM.Generation.generate_text(
           "alibaba_cn:qwen-plus",
           [%{role: "system", content: persona}, %{role: "user", content: message}],
           max_tokens: 1024,
           temperature: 0.5,
           receive_timeout: 120_000
         ) do
      {:ok, resp} -> {:ok, resp |> ReqLLM.Response.text() |> String.trim()}
      {:error, error} -> {:error, "分身对话失败: #{inspect(error) |> String.slice(0, 200)}"}
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
