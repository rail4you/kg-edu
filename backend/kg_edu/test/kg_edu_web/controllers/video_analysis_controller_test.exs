defmodule KgEduWeb.VideoAnalysisControllerTest do
  @moduledoc """
  P2: 视频解析接口 — 只覆盖不触网路径（参数校验、任务不存在）。
  真实解析需有效 Qwen Key + 公网视频，不在自动化测试中覆盖。
  """
  use KgEduWeb.ConnCase, async: true

  describe "POST /api/video-analysis/analyze" do
    test "缺租户上下文返回错误", %{conn: conn} do
      conn = post(conn, "/api/video-analysis/analyze", %{videoId: Ash.UUID.generate()})

      assert %{"success" => false, "error" => "未设置租户上下文"} =
               json_response(conn, 200)
    end

    test "缺 videoId 返回错误", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> post("/api/video-analysis/analyze", %{})

      assert %{"success" => false, "error" => "缺少 videoId"} = json_response(conn, 200)
    end
  end

  describe "GET /api/video-analysis/:id" do
    test "缺租户上下文返回错误", %{conn: conn} do
      conn = get(conn, "/api/video-analysis/#{Ash.UUID.generate()}")

      assert %{"success" => false, "error" => "未设置租户上下文"} =
               json_response(conn, 200)
    end

    test "任务不存在返回错误", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/video-analysis/#{Ash.UUID.generate()}")

      assert %{"success" => false} = json_response(conn, 200)
    end
  end

  describe "GET /api/video-analysis/:id/marks" do
    test "缺 videoId 返回错误", %{conn: conn} do
      conn =
        conn
        |> put_req_header("x-org-schema", "test-tenant")
        |> get("/api/video-analysis/#{Ash.UUID.generate()}/marks")

      assert %{"success" => false, "error" => "缺少 videoId"} = json_response(conn, 200)
    end
  end
end
