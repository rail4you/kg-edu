defmodule KgEduWeb.PageControllerTest do
  use KgEduWeb.ConnCase

  test "GET / serves SPA shell", %{conn: conn} do
    conn = get(conn, ~p"/")
    assert html_response(conn, 200) =~ "智慧教学系统"
  end

  test "GET /api/health returns ok", %{conn: conn} do
    conn = get(conn, ~p"/api/health")
    assert %{"status" => "ok"} = json_response(conn, 200)
  end
end
