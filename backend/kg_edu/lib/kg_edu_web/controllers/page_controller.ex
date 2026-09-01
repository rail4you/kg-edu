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
  # GET /api/site-content — 未配置时返回当前生效的默认内容，便于管理端展示与编辑
  def get_site_content(conn, _params) do
    case KgEdu.SystemConfig.SiteContentConfig.get_default() do
      {:ok, [content | _]} ->
        json(conn, %{success: true, data: site_content_map(content)})

      _ ->
        json(conn, %{success: true, data: default_site_content()})
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

  # -------------------------------------------------------------------------
  # 门户配置（学历层级 + 模板页）
  # GET  /api/portal-config           公开读取（只返回启用的模板页）
  # GET  /api/portal-config/admin     仅超级管理员（含禁用页）
  # PUT  /api/portal-config/levels    仅超级管理员，批量保存 4 个层级
  # PUT  /api/portal-config/pages     仅超级管理员，全量替换模板页（含排序）
  # -------------------------------------------------------------------------

  # 默认 4 个学历层级（与首页学科面板 SUBJECT_CATEGORY_CONFIGS 一致）
  @default_levels [
    %{level_key: "graduate", title: "研究生", subtitle: "学术型 / 专业学位", sort_order: 0},
    %{level_key: "undergraduate", title: "本科", subtitle: "13 个学科门类", sort_order: 1},
    %{level_key: "higher_vocational", title: "高职", subtitle: "热门专业大类", sort_order: 2},
    %{level_key: "secondary_vocational", title: "中职", subtitle: "动手技能型课程", sort_order: 3}
  ]

  # 默认 5 个模板页（概述 + 实际内容，可在管理端修改）
  @default_pages [
    %{
      name: "教学资源库",
      slug: "resources",
      sort_order: 0,
      overview: "汇聚优质教学资源，共建共享教育资源生态。",
      content:
        "教学资源库汇聚了涵盖多个学科领域的优质教学资源，包括视频课程、教学课件、实验指导、试题库等。平台支持资源上传、分类管理、在线预览与下载，为教师提供一站式的教学资源服务。\n\n## 视频课程资源\n\n汇聚数千门精品视频课程，覆盖医学、工学、理学等多个学科门类，支持在线播放与课件下载。\n\n## 教学课件库\n\n提供丰富的 PPT、PDF 教学课件资源，教师可参考借鉴，快速构建自己的课程教学内容。\n\n## 实验教学资源\n\n涵盖虚拟仿真实验、实验指导手册、实验报告模板等，助力实验教学环节的开展。"
    },
    %{
      name: "示范教学包",
      slug: "demo",
      sort_order: 1,
      overview: "汇集全国优秀教师的教学案例与课程设计，助力教师提升课程建设质量。",
      content:
        "示范教学包汇集了全国优秀教师的教学案例与课程设计，涵盖教案、课件、习题、实验指导等完整教学资源。通过借鉴优秀教学实践，帮助教师提升课程建设质量与教学效果。\n\n## 精品示范课程\n\n精选国家级、省级一流课程的教学设计方案，包含完整的教学大纲、教案、课件与考核方案。\n\n## 创新教学案例\n\n汇集混合式教学、翻转课堂、项目制学习等创新教学模式的实际应用案例与经验分享。\n\n## 教学名师讲堂\n\n邀请教学名师分享课程建设经验、教学设计理念与课堂教学技巧，促进教师专业发展。"
    },
    %{
      name: "数字教材",
      slug: "textbook",
      sort_order: 2,
      overview: "交互式、多媒体融合的现代教材体验，让教材向智能化、个性化学习工具转型。",
      content:
        "数字教材中心提供交互式、多媒体融合的现代教材体验。支持富媒体阅读、笔记标注、习题自测、学习进度追踪等功能，让教材从传统纸质向智能化、个性化学习工具转型。\n\n## 富媒体交互教材\n\n集成视频、音频、动画、3D 模型等多媒体元素，打造沉浸式阅读与学习体验。\n\n## 智能学习工具\n\n支持笔记标注、高亮标记、章节书签、语音朗读等功能，提升学习效率。\n\n## 自测与进度追踪\n\n每章节内置习题自测，自动批改并生成学习报告，帮助学生及时掌握学习情况。"
    },
    %{
      name: "合作单位",
      slug: "partners",
      sort_order: 3,
      overview: "与全国高等院校、教育研究机构、行业企业携手共建智慧教育新生态。",
      content:
        "我们与全国高等院校、教育研究机构、行业企业建立了广泛的合作关系，共同推进智慧教育的技术创新与教学改革。欢迎更多合作伙伴加入，共建智慧教育新生态。\n\n## 院校合作\n\n与高等院校建立合作关系，共同开展智慧教学实践与教学改革探索。\n\n## 科研合作\n\n与教育技术研究机构合作开展知识图谱、AI 教育应用等前沿课题研究，推动技术创新与成果转化。\n\n## 资源共建\n\n联合多所院校共建共享优质教学资源，形成覆盖广泛、质量优良的教育资源生态体系。"
    },
    %{
      name: "关于我们",
      slug: "about",
      sort_order: 4,
      overview: "了解平台定位、发展理念与联系方式。",
      content:
        "易课程是一款面向教育领域的智慧教学平台，致力于将知识图谱技术与人工智能深度融合，为教师和学生提供智能化的教学与学习体验。\n\n平台以知识图谱为核心驱动，以 AI 智能体为智慧引擎，以微专业为特色培养路径，构建覆盖教、学、管、评、研全链路的智慧教学生态。通过知识图谱引擎支撑知识点之间的多维关联，实现学习资源的精准匹配与个性化学习路径推荐，帮助院校构建高质量、高效率的数字化教学环境。\n\n## 联系方式\n\n- 联系邮箱：demo@ketangxing.com\n- 工作时间：工作日 9:00 - 18:00\n- 联系地址：江苏省南京市"
    }
  ]

  # GET /api/portal-config — 公开读取（层级 + 启用的模板页）
  def get_portal_config(conn, _params) do
    levels = ensure_levels_seeded()
    pages = ensure_pages_seeded() |> Enum.filter(& &1.enabled)

    json(conn, %{
      success: true,
      data: %{
        levels: Enum.map(levels, &portal_level_map/1),
        pages: Enum.map(pages, &template_page_map/1)
      }
    })
  end

  # GET /api/portal-config/admin — 仅超级管理员（含禁用页）
  def get_portal_config_admin(conn, _params) do
    actor = conn.assigns[:actor]

    if is_nil(actor) or actor.role != :super_admin do
      json(conn, %{success: false, error: "仅超级管理员可查看门户配置"})
    else
      levels = ensure_levels_seeded()
      pages = ensure_pages_seeded()

      json(conn, %{
        success: true,
        data: %{
          levels: Enum.map(levels, &portal_level_map/1),
          pages: Enum.map(pages, &template_page_map/1)
        }
      })
    end
  end

  # PUT /api/portal-config/levels — 批量保存 4 个层级（仅超级管理员）
  def update_portal_levels(conn, params) do
    actor = conn.assigns[:actor]

    if is_nil(actor) or actor.role != :super_admin do
      json(conn, %{success: false, error: "仅超级管理员可修改门户配置"})
    else
      levels = (params["data"] || params)["levels"] || []

      results =
        Enum.map(levels, fn item ->
          KgEdu.SystemConfig.PortalLevel.save(%{
            level_key: item["level_key"],
            title: item["title"] || "",
            subtitle: item["subtitle"] || "",
            sort_order: item["sort_order"] || 0
          })
        end)

      if Enum.all?(results, &match?({:ok, _}, &1)) do
        json(conn, %{
          success: true,
          data: %{levels: Enum.map(ensure_levels_seeded(), &portal_level_map/1)}
        })
      else
        json(conn, %{success: false, error: "保存失败，请检查层级名称是否填写完整"})
      end
    end
  end

  # PUT /api/portal-config/pages — 全量替换模板页（创建/更新/删除/排序，仅超级管理员）
  def save_portal_pages(conn, params) do
    actor = conn.assigns[:actor]

    if is_nil(actor) or actor.role != :super_admin do
      json(conn, %{success: false, error: "仅超级管理员可修改门户配置"})
    else
      incoming = (params["data"] || params)["pages"] || []

      existing = unwrap_list(KgEdu.SystemConfig.TemplatePage.list_all())

      save_result =
        incoming
        |> Enum.with_index()
        |> Enum.reduce_while({:ok, MapSet.new()}, fn {item, index}, {:ok, kept} ->
          attrs = %{
            name: item["name"] || "",
            slug: normalize_slug(item["slug"], item["name"]),
            overview: item["overview"] || "",
            content: item["content"] || "",
            sort_order: index,
            enabled: item["enabled"] != false
          }

          result =
            case item["id"] do
              nil ->
                case Enum.find(existing, &(&1.slug == attrs.slug)) do
                  nil -> KgEdu.SystemConfig.TemplatePage.create_page(attrs)
                  page -> KgEdu.SystemConfig.TemplatePage.update_page(page, attrs)
                end

              id ->
                case Enum.find(existing, &(to_string(&1.id) == to_string(id))) do
                  nil -> KgEdu.SystemConfig.TemplatePage.create_page(attrs)
                  page -> KgEdu.SystemConfig.TemplatePage.update_page(page, attrs)
                end
            end

          case result do
            {:ok, page} -> {:cont, {:ok, MapSet.put(kept, page.id)}}
            {:error, _} -> {:halt, {:error, item["name"] || "未知"}}
          end
        end)

      case save_result do
        {:ok, kept_ids} ->
          # 删除列表外的旧页面
          to_delete =
            Enum.filter(existing, fn page -> not MapSet.member?(kept_ids, page.id) end)

          Enum.each(to_delete, fn page ->
            KgEdu.SystemConfig.TemplatePage.delete_page(page)
          end)

          json(conn, %{
            success: true,
            data: %{pages: Enum.map(ensure_pages_seeded(), &template_page_map/1)}
          })

        {:error, name} ->
          json(conn, %{
            success: false,
            error: "模板页「#{name}」保存失败：请检查名称与访问标识是否填写、且访问标识不重复"
          })
      end
    end
  end

  # --- 种子与工具函数 ---

  defp ensure_levels_seeded do
    levels = unwrap_list(KgEdu.SystemConfig.PortalLevel.get_all())

    case levels do
      [] ->
        Enum.map(@default_levels, fn attrs ->
          {:ok, level} = KgEdu.SystemConfig.PortalLevel.save(attrs)
          level
        end)

      levels ->
        Enum.sort_by(levels, & &1.sort_order)
    end
  end

  defp ensure_pages_seeded do
    pages = unwrap_list(KgEdu.SystemConfig.TemplatePage.list_all())

    case pages do
      [] ->
        Enum.map(@default_pages, fn attrs ->
          {:ok, page} = KgEdu.SystemConfig.TemplatePage.create_page(attrs)
          page
        end)

      pages ->
        Enum.sort_by(pages, & &1.sort_order)
    end
  end

  defp unwrap_list({:ok, list}), do: list
  defp unwrap_list(list) when is_list(list), do: list
  defp unwrap_list(_), do: []

  defp portal_level_map(level) do
    %{
      id: level.id,
      level_key: level.level_key,
      title: level.title,
      subtitle: level.subtitle || "",
      sort_order: level.sort_order
    }
  end

  defp template_page_map(page) do
    %{
      id: page.id,
      name: page.name,
      slug: page.slug,
      overview: page.overview || "",
      content: page.content || "",
      sort_order: page.sort_order,
      enabled: page.enabled
    }
  end

  # 规范化 slug：仅保留小写字母/数字/连字符；为空时自动生成
  defp normalize_slug(slug, _name) do
    normalized =
      (slug || "")
      |> String.downcase()
      |> String.replace(~r/[^a-z0-9-]/, "-")
      |> String.replace(~r/-+/, "-")
      |> String.trim("-")

    if normalized == "" do
      "page-" <> Base.url_encode64(:crypto.strong_rand_bytes(4), padding: false)
    else
      normalized
    end
  end

  # 未配置时的默认站点内容（与前端展示端默认一致）
  defp default_site_content do
    %{
      about_intro:
        "易课程是一款面向教育领域的智慧教学平台，致力于将知识图谱技术与人工智能深度融合，为教师和学生提供智能化的教学与学习体验。\n\n平台以知识图谱为核心驱动，以 AI 智能体为智慧引擎，以微专业为特色培养路径，构建覆盖教、学、管、评、研全链路的智慧教学生态。通过知识图谱引擎支撑知识点之间的多维关联，实现学习资源的精准匹配与个性化学习路径推荐，帮助院校构建高质量、高效率的数字化教学环境。",
      contact_email: System.get_env("BRANDING_CONTACT_EMAIL", "demo@ketangxing.com"),
      contact_address: "江苏省南京市",
      contact_hours: "工作日 9:00 - 18:00",
      privacy_policy:
        "易课程·智慧教学系统及其所有内容，包括但不限于文字、图片、音频、视频、软件、程序、版面设计等，均受《中华人民共和国著作权法》及其他相关法律法规保护。未经书面授权，任何单位及个人不得以任何方式或理由对本平台内容进行使用、复制、修改、抄录或与其它产品捆绑使用。"
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
