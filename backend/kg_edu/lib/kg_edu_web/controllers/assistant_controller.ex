defmodule KgEduWeb.AssistantController do
  @moduledoc """
  需求 10：AI 助教 — 设置开关、应用池/插件/MCP 注册表、插件试运行、MCP 工具目录。
  """
  use KgEduWeb, :controller

  require Ash.Query

  plug KgEduWeb.Plugs.RequireEditable when action in [:save_settings, :plugin_run]

  @doc """
  GET /api/assistant/settings — 租户开关（不存在返回默认值）。
  """
  def settings(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      case KgEdu.AI.AssistantSetting
           |> Ash.Query.filter(tenant_key == ^tenant)
           |> Ash.read_one(tenant: tenant, authorize?: false) do
        {:ok, nil} ->
          json(conn, %{success: true, data: %{fallback_enabled: true, web_search_enabled: false}})

        {:ok, s} ->
          json(conn, %{
            success: true,
            data: %{fallback_enabled: s.fallback_enabled, web_search_enabled: s.web_search_enabled}
          })

        {:error, reason} ->
          json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 200)})
      end
    end
  end

  @doc """
  POST /api/assistant/settings — body: { fallbackEnabled?, webSearchEnabled? }。
  """
  def save_settings(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      args =
        %{}
        |> maybe_put(:fallback_enabled, first_present([input["fallbackEnabled"], input["fallback_enabled"]]))
        |> maybe_put(:web_search_enabled, first_present([input["webSearchEnabled"], input["web_search_enabled"]]))

      case KgEdu.AI.AssistantSetting.save_assistant_settings(args, tenant: tenant, authorize?: false) do
        {:ok, saved} ->
          json(conn, %{
            success: true,
            data: %{fallback_enabled: saved.fallback_enabled, web_search_enabled: saved.web_search_enabled}
          })

        {:error, reason} ->
          json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 200)})
      end
    end
  end

  @doc """
  GET /api/assistant/plugins — 插件目录（内置 11 种 + 已注册）。
  """
  def plugins(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      registered =
        case KgEdu.AI.AssistantTool.list_assistant_tools(tenant: tenant, authorize?: false) do
          {:ok, list} -> list
          _ -> []
        end

      json(conn, %{
        success: true,
        data: %{
          builtin: KgEdu.AI.PluginRunner.catalog(),
          registered:
            Enum.map(registered, fn t ->
              %{id: t.id, name: t.name, kind: t.kind, plugin: t.plugin, enabled: t.enabled, config: t.config}
            end)
        }
      })
    end
  end

  @doc """
  POST /api/assistant/plugin-run — body: { plugin, params, toolId? }。
  已注册工具若被禁用则拒绝执行。
  """
  def plugin_run(conn, params) do
    tenant = extract_tenant(conn, params)
    input = params["input"] || params
    plugin = input["plugin"]
    plugin_params = normalize_params(input["params"] || %{})

    cond do
      is_nil(tenant) ->
        json(conn, %{success: false, error: "未设置租户上下文"})

      is_nil(plugin) or plugin == "" ->
        json(conn, %{success: false, error: "缺少 plugin"})

      true ->
        with :ok <- check_tool_enabled(input["toolId"], tenant),
             {:ok, result} <- KgEdu.AI.PluginRunner.run(plugin, stringify(plugin_params), tenant) do
          json(conn, %{success: true, data: result})
        else
          {:error, reason} when is_binary(reason) -> json(conn, %{success: false, error: reason})
          {:error, reason} -> json(conn, %{success: false, error: inspect(reason) |> String.slice(0, 300)})
        end
    end
  end

  @doc """
  GET /api/assistant/mcp-tools — 本 MCP 服务实时暴露的 Ash tools（ash_ai）。
  """
  def mcp_tools(conn, params) do
    tenant = extract_tenant(conn, params)

    if is_nil(tenant) do
      json(conn, %{success: false, error: "未设置租户上下文"})
    else
      tools =
        Application.get_env(:kg_edu, :ash_domains, [])
        |> Enum.flat_map(fn domain ->
          try do
            AshAi.Info.tools(domain) |> Enum.map(&%{name: &1.name, domain: inspect(domain)})
          rescue
            _ -> []
          end
        end)
        |> Enum.uniq_by(& &1.name)

      json(conn, %{success: true, data: %{endpoint: "/mcp", count: length(tools), tools: tools}})
    end
  end

  # ── Private ────────────────────────────────────────────────────────────

  defp check_tool_enabled(nil, _tenant), do: :ok
  defp check_tool_enabled("", _tenant), do: :ok

  defp check_tool_enabled(tool_id, tenant) do
    case KgEdu.AI.AssistantTool.get_assistant_tool(tool_id, tenant: tenant, authorize?: false) do
      {:ok, %{enabled: false}} -> {:error, "该工具已被禁用"}
      {:ok, _} -> :ok
      _ -> :ok
    end
  end

  defp normalize_params(params) when is_map(params), do: params
  defp normalize_params(_), do: %{}

  defp stringify(map) do
    Map.new(map, fn {k, v} -> {to_string(k), v} end)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp first_present(values), do: Enum.find(values, &(!is_nil(&1)))

  defp extract_tenant(conn, params) do
    params["orgSchema"] ||
      params["tenant"] ||
      (params["forwardedProps"] || %{})["orgSchema"] ||
      get_req_header(conn, "x-org-schema") |> List.first() ||
      conn.assigns[:org_schema]
  end
end
