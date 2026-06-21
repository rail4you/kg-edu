defmodule KgEduWeb.PageController do
  use KgEduWeb, :controller

  # 健康检查端点 — 用于 Docker / k8s 探活
  def health(conn, _params) do
    json(conn, %{status: "ok", service: "kg-edu-phoenix"})
  end

  def home(conn, _params) do
    render(conn, :home)
  end

  # SPA fallback — 服务 React (Vite) 构建的 index.html
  # 所有未匹配的路径（React Router 路由）都由前端处理
  def index(conn, _params) do
    index_path = Application.app_dir(:kg_edu, "priv/static/index.html")

    if File.exists?(index_path) do
      conn
      |> put_resp_header("content-type", "text/html; charset=utf-8")
      |> put_resp_header("cache-control", "no-cache, no-store, must-revalidate")
      |> put_resp_header("pragma", "no-cache")
      |> put_resp_header("expires", "0")
      |> send_file(200, index_path)
    else
      # 开发环境可能尚未构建前端，返回提示
      conn
      |> put_resp_header("content-type", "text/html; charset=utf-8")
      |> send_resp(200, """
      <!doctype html>
      <html><head><meta charset="UTF-8"><title>KgEdu</title></head>
      <body><p>Frontend not built. Run <code>mix assets.build_frontend</code> or start Vite dev server.</p></body>
      </html>
      """)
    end
  end
end
