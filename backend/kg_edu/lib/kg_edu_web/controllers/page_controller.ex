defmodule KgEduWeb.PageController do
  use KgEduWeb, :controller

  # 健康检查端点 — 用于 Docker / k8s 探活
  def health(conn, _params) do
    json(conn, %{status: "ok", service: "kg-edu-phoenix"})
  end

  # 品牌配置端点 — 从环境变量读取，支持部署时配置
  # 环境变量前缀: BRANDING_
  def branding(conn, _params) do
    app_name = System.get_env("BRANDING_APP_NAME", "课堂星")
    app_title = System.get_env("BRANDING_APP_TITLE", "智慧教学系统")
    app_description = System.get_env("BRANDING_APP_DESCRIPTION", "融合知识图谱与人工智能技术的智慧教学平台")
    logo_light = System.get_env("BRANDING_LOGO_LIGHT", "/logo-light-full.png")
    logo_dark = System.get_env("BRANDING_LOGO_DARK", "/logo.jpg")
    favicon = System.get_env("BRANDING_FAVICON", "/logo/yike-icon.png")
    contact_email = System.get_env("BRANDING_CONTACT_EMAIL", "demo@ketangxing.com")
    app_copyright = System.get_env("BRANDING_COPYRIGHT", "易课程 © 2026 - 融合知识图谱与人工智能技术 | 智慧教学平台")

    json(conn, %{
      app_name: app_name,
      app_title: app_title,
      app_description: app_description,
      app_copyright: app_copyright,
      logo_light: logo_light,
      logo_dark: logo_dark,
      favicon: favicon,
      contact_email: contact_email
    })
  end

  # 站点内容配置（平台简介 / 联系我们 / 隐私条款）— 超级管理员可写，公开可读
  # GET /api/site-content
  def get_site_content(conn, _params) do
    case KgEdu.SystemConfig.SiteContentConfig.get_default() do
      {:ok, [content | _]} ->
        json(conn, %{success: true, data: site_content_map(content)})

      _ ->
        json(conn, %{success: true, data: nil})
    end
  end

  # PUT /api/site-content — 仅超级管理员
  def update_site_content(conn, params) do
    actor = conn.assigns[:actor]

    if is_nil(actor) or actor.role != :super_admin do
      json(conn, %{success: false, error: "仅超级管理员可修改站点内容"})
    else
      data = params["data"] || params

      attrs = %{
        about_intro: data["about_intro"],
        contact_email: data["contact_email"],
        contact_address: data["contact_address"],
        contact_hours: data["contact_hours"],
        privacy_policy: data["privacy_policy"]
      }

      case KgEdu.SystemConfig.SiteContentConfig.save(attrs) do
        {:ok, content} ->
          json(conn, %{success: true, data: site_content_map(content)})

        {:error, _} ->
          json(conn, %{success: false, error: "保存失败"})
      end
    end
  end

  defp site_content_map(content) do
    %{
      about_intro: content.about_intro || "",
      contact_email: content.contact_email || "",
      contact_address: content.contact_address || "",
      contact_hours: content.contact_hours || "",
      privacy_policy: content.privacy_policy || ""
    }
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
