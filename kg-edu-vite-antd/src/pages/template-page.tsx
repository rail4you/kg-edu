import { Button, Empty, Layout, Skeleton, Typography } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { useBranding } from "@/hooks/use-branding";
import { useAuth } from "@/auth/auth-context";
import { usePortalConfig, usePortalNavItems, findTemplatePage } from "@/hooks/use-portal-config";
import "@/styles/home-portal-theme.css";
import "./template-page.css";

const { Header, Content } = Layout;
const { Title, Paragraph } = Typography;

interface TemplatePageProps {
  /** 固定 slug（旧路由如 /resources、/about）；为空时从 URL :slug 读取 */
  slug?: string;
}

/**
 * 通用模板页 — 渲染「名称 + 概述 + 实际内容」
 * 数据来自门户配置（超级管理员可动态维护），支持 Markdown 内容。
 */
export default function TemplatePage({ slug: fixedSlug }: TemplatePageProps) {
  const navigate = useNavigate();
  const params = useParams();
  const slug = fixedSlug ?? params.slug;

  const branding = useBranding();
  const { authenticated, user } = useAuth();
  const navItems = usePortalNavItems();
  const { data, isLoading } = usePortalConfig();

  const page = findTemplatePage(data?.pages, slug);
  const notFound = !isLoading && !page;

  const handleNav = (path: string) => navigate(path);

  return (
    <Layout className="home-page" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header className="home-header">
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <img src={branding.logo_light} alt={branding.app_name} className="home-brand__logo" />
              <div className="home-brand__title">{branding.app_title}</div>
            </div>
            <div className="home-nav">
              {navItems.map((item) => (
                <Button
                  key={item.key}
                  type="text"
                  className={`home-nav__button ${item.key === `/page/${slug}` ? "is-active" : ""}`}
                  onClick={() => handleNav(item.key)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="home-header__actions">
            {authenticated && user ? (
              <UserMenu role="student" variant="header" />
            ) : (
              <>
                <Button className="home-login-button" onClick={() => navigate("/login")}>
                  登录
                </Button>
                <Button className="home-register-button" onClick={() => navigate("/login")}>
                  进入平台
                </Button>
              </>
            )}
          </div>
        </div>
      </Header>

      <Content style={{ flex: 1, display: "flex", flexDirection: "column", background: "#f8fafc" }}>
        {isLoading ? (
          <div style={{ maxWidth: 900, margin: "48px auto", width: "100%", padding: "0 24px" }}>
            <Skeleton active paragraph={{ rows: 6 }} />
          </div>
        ) : notFound ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty description="页面不存在或已下架">
              <Button type="primary" onClick={() => navigate("/")}>
                返回首页
              </Button>
            </Empty>
          </div>
        ) : (
          <>
            {/* Hero：页面名称 */}
            <div
              className="template-page__hero"
              style={{
                background: "linear-gradient(135deg, #0B4CA8 0%, #1A6DD8 50%, #0E63D8 100%)",
                padding: "56px 24px 48px",
                textAlign: "center",
              }}
            >
              <div style={{ maxWidth: 1140, margin: "0 auto" }}>
                <Title level={2} className="template-page__title" style={{ margin: 0, fontWeight: 700 }}>
                  {page?.name}
                </Title>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div className="template-page__body">
                {/* 概述 */}
                {page?.overview ? (
                  <Paragraph className="template-page__overview">{page.overview}</Paragraph>
                ) : null}

                {/* 实际内容 */}
                {page?.content ? (
                  <div className="template-page__content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.content}</ReactMarkdown>
                  </div>
                ) : (
                  <Empty
                    className="template-page__empty"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="页面内容正在完善中"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
