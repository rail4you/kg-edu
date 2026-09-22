defmodule KgEduWeb.AssistantTrackControllerTest do
  @moduledoc """
  需求 10+12：助教与追踪接口 validation 路径（不触网）。
  """
  use KgEduWeb.ConnCase, async: true

  import KgEdu.AccountsFixtures

  describe "assistant settings" do
    test "缺租户返回错误", %{conn: conn} do
      conn = get(conn, "/api/assistant/settings")
      assert %{"success" => false} = json_response(conn, 200)
    end

    test "读写开关", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", test_tenant())
        |> post("/api/assistant/settings", %{fallbackEnabled: false, webSearchEnabled: true})

      assert %{"success" => true, "data" => %{"fallback_enabled" => false, "web_search_enabled" => true}} =
               json_response(conn, 200)
    end

    test "插件目录 11 种", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", test_tenant())
        |> get("/api/assistant/plugins")

      assert %{"success" => true, "data" => %{"builtin" => builtin}} = json_response(conn, 200)
      assert length(builtin) == 11
    end

    test "plugin-run 缺 plugin 报错", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/assistant/plugin-run", %{params: %{}})

      assert %{"success" => false} = json_response(conn, 200)
    end

    test "plugin-run chart 可执行", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/assistant/plugin-run", %{
          plugin: "chart",
          params: %{title: "t", data: [%{name: "a", value: 1}]}
        })

      assert %{"success" => true, "data" => %{"option" => _}} = json_response(conn, 200)
    end

    test "mcp-tools 列出真实 tools", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/assistant/mcp-tools")

      assert %{"success" => true, "data" => %{"count" => count, "tools" => tools}} =
               json_response(conn, 200)

      names = Enum.map(tools, & &1["name"])
      assert count >= 8
      assert "list_courses" in names
    end
  end

  describe "track validation" do
    test "search 缺 query 报错", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/track/search?type=works")

      assert %{"success" => false} = json_response(conn, 200)
    end

    test "author 缺 id 报错", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/track/author")

      assert %{"success" => false} = json_response(conn, 200)
    end

    test "twin-chat 缺参数报错", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/track/twin-chat", %{})

      assert %{"success" => false} = json_response(conn, 200)
    end

    test "venue-digest 缺 query 报错", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/track/venue-digest")

      assert %{"success" => false} = json_response(conn, 200)
    end
  end
end
