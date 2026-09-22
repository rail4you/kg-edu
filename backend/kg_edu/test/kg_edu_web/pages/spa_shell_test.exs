defmodule KgEduWeb.SpaShellTest do
  @moduledoc """
  P0: phoenix_test 界面检验 — SPA 外壳页可访问且关键元素存在。
  后端对未知路由 fallback 到 React SPA（或未构建时的占位 HTML）。
  """
  use KgEduWeb.ConnCase, async: true

  import PhoenixTest

  setup %{conn: conn} do
    {:ok, conn: PhoenixTest.put_endpoint(conn, KgEduWeb.Endpoint)}
  end

  test "首页 serves SPA shell", %{conn: conn} do
    conn
    |> visit("/")
    |> assert_has("title", text: "智慧教学系统")
    |> assert_has("#root")
  end

  test "未知路由 fallback 到 SPA shell（前端路由可用）", %{conn: conn} do
    conn
    |> visit("/teacher/dashboard/ai-exercise")
    |> assert_has("title", text: "智慧教学系统")
    |> assert_has("#root")
  end
end
