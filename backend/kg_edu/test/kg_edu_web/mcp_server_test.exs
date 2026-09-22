defmodule KgEduWeb.McpServerTest do
  @moduledoc """
  P0: ash_ai MCP Server 测试 — initialize 握手 + tools/list 暴露 8 个只读 tool。
  """
  use KgEduWeb.ConnCase, async: true

  @expected_tools ~w(
    get_course
    list_chapters
    list_courses
    list_files
    list_knowledge_by_course
    list_knowledge_resources
    list_videos
    search_knowledge_resources
  )

  defp rpc(conn, id, method, params) do
    conn
    |> put_req_header("content-type", "application/json")
    |> put_req_header("accept", "application/json, text/event-stream")
    |> post(
      "/mcp/",
      Jason.encode!(%{
        "jsonrpc" => "2.0",
        "id" => id,
        "method" => method,
        "params" => params
      })
    )
  end

  test "initialize 握手成功", %{conn: conn} do
    conn =
      rpc(conn, 1, "initialize", %{
        "protocolVersion" => "2024-11-05",
        "capabilities" => %{},
        "clientInfo" => %{"name" => "test", "version" => "0.1"}
      })

    assert %{
             "jsonrpc" => "2.0",
             "id" => 1,
             "result" => %{
               "protocolVersion" => "2024-11-05",
               "serverInfo" => %{"name" => _}
             }
           } = json_response(conn, 200)
  end

  test "tools/list 暴露 P0 只读 tools", %{conn: conn} do
    conn = rpc(conn, 2, "tools/list", %{})

    assert %{"result" => %{"tools" => tools}} = json_response(conn, 200)
    names = Enum.map(tools, & &1["name"])

    for tool <- @expected_tools do
      assert tool in names, "MCP tools 缺少 #{tool}，实际: #{inspect(names)}"
    end

    # 每个 tool 都有可用的 inputSchema（MCP 客户端渲染用）
    assert Enum.all?(tools, &Map.has_key?(&1, "inputSchema"))
  end
end
