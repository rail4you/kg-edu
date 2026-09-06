import React, { useEffect, useState } from "react";
import { Button, Layout, Typography } from "antd";
import { useNavigate } from "react-router-dom";
import {
  BookOutlined,
  EyeOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { themeColors } from "@/styles/theme";
import { useBranding } from "@/hooks/use-branding";
import { useAuth } from "@/auth/auth-context";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import FilePreview from "@/components/FilePreview";
import { fetchSiteContent } from "@/lib/site-content";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

const NAV_ITEMS = [
  { key: "/", label: "首页" },
  { key: "/courses", label: "课程" },
  { key: "/micro-majors", label: "微专业" },
  { key: "/resources", label: "教学资源库" },
  { key: "/demo", label: "示范教学包" },
  { key: "/textbook", label: "数字教材" },
  { key: "/partners", label: "合作单位" },
  { key: "/about", label: "关于我们" },
];

const MANUAL_URL =
  "https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/20260805/课堂星用户手册.docx";
const MANUAL_NAME = "易课程用户手册.docx";

/** 平台简介默认文案（未配置时使用） */
const DEFAULT_INTRO = [
  "易课程是一款面向教育领域的智慧教学平台，致力于将知识图谱技术与人工智能深度融合，为教师和学生提供智能化的教学与学习体验。",
  "平台以知识图谱为核心驱动，以 AI 智能体为智慧引擎，以微专业为特色培养路径，构建覆盖教、学、管、评、研全链路的智慧教学生态。通过知识图谱引擎支撑知识点之间的多维关联，实现学习资源的精准匹配与个性化学习路径推荐，帮助院校构建高质量、高效率的数字化教学环境。",
];

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 600,
  textAlign: "center",
  marginBottom: 16,
  color: "#1a1a2e",
};

const sectionDivider: React.CSSProperties = {
  width: 40,
  height: 3,
  background: themeColors.primary,
  borderRadius: 2,
  margin: "0 auto 48px",
  border: "none",
};

export default function AboutPage() {
  const navigate = useNavigate();
  const branding = useBranding();
  const { authenticated, user } = useAuth();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [introParagraphs, setIntroParagraphs] = useState<string[] | null>(null);

  // 平台简介 — 超级管理员可在后台配置（多段用空行分隔），未配置时使用默认文案
  useEffect(() => {
    let active = true;
    fetchSiteContent().then((content) => {
      if (!active) return;
      const text = content.aboutIntro.trim();
      setIntroParagraphs(text ? text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : null);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleDownloadManual = () => {
    const link = document.createElement("a");
    link.href = MANUAL_URL;
    link.download = MANUAL_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
              {NAV_ITEMS.map((item) => (
                <Button
                  key={item.key}
                  type="text"
                  className={`home-nav__button ${item.key === "/about" ? "is-active" : ""}`}
                  onClick={() => navigate(item.key)}
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
                <Button className="home-login-button" onClick={() => navigate("/login")}>登录</Button>
                <Button className="home-register-button" onClick={() => navigate("/login")}>进入平台</Button>
              </>
            )}
          </div>
        </div>
      </Header>
      <Content style={{ flex: 1, background: "#fff" }}>
        <div style={{ padding: "48px 24px 64px" }}>
          <div className="about-page__grid" style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* 左侧：平台简介（动态文案，可后台配置） */}
            <div>
              <Title level={2} style={sectionTitleStyle}>平台简介</Title>
              <div style={sectionDivider} />

              {(introParagraphs || DEFAULT_INTRO).map((paragraph, index) => (
                <Paragraph
                  key={index}
                  style={{
                    fontSize: 15,
                    lineHeight: 2,
                    color: "#444",
                    marginBottom: 20,
                    textIndent: "2em",
                  }}
                >
                  {paragraph}
                </Paragraph>
              ))}
            </div>

            {/* 右侧边栏：用户使用手册（sticky 上部分） */}
            <aside className="about-page__side">
              <Title
                level={3}
                style={{ fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#1a1a2e" }}
              >
                📘 用户使用手册
              </Title>
              <Paragraph style={{ color: "#888", fontSize: 14, marginBottom: 20, lineHeight: 1.7 }}>
                快速上手易课程 · 学生 / 教师 / 管理员完整操作指南
              </Paragraph>

              <div
                style={{
                  background:
                    "linear-gradient(135deg, #eef4ff 0%, #f7fbff 50%, #eef7ff 100%)",
                  borderRadius: 16,
                  padding: "28px 28px 24px",
                  border: "1px solid #dbeafe",
                  boxShadow: "0 8px 24px rgba(37,115,230,0.08)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 16 }}>
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: 15,
                      background: `linear-gradient(135deg, ${themeColors.primary} 0%, #4d8fef 100%)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 4px 12px rgba(37,115,230,0.3)",
                    }}
                  >
                    <BookOutlined style={{ fontSize: 28, color: "#fff" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <Text style={{ fontSize: 17, fontWeight: 700, color: "#1a1a2e", display: "block", marginBottom: 6 }}>
                      易课程用户使用手册
                    </Text>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: themeColors.primary,
                          background: "#eef4ff",
                          padding: "2px 10px",
                          borderRadius: 10,
                        }}
                      >
                        DOCX
                      </span>
                      <span style={{ fontSize: 12, color: "#999" }}>学生端 · 教师端 · 管理员端</span>
                    </div>
                  </div>
                </div>
                <Paragraph style={{ color: "#666", fontSize: 13, margin: "0 0 20px", lineHeight: 1.8 }}>
                  涵盖课程学习、教学管理、账号与班级管理、数据分析等全部功能，帮助您快速上手使用平台。
                </Paragraph>
                <div style={{ display: "flex", gap: 12 }}>
                  <Button
                    type="primary"
                    icon={<EyeOutlined />}
                    onClick={() => setPreviewVisible(true)}
                    style={{ borderRadius: 10, flex: 1, height: 42 }}
                  >
                    在线预览
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadManual}
                    style={{ borderRadius: 10, flex: 1, height: 42 }}
                  >
                    下载手册
                  </Button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </Content>
      <GlobalFooter />

      <FilePreview
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
        file={{ url: MANUAL_URL, name: MANUAL_NAME, type: "docx" }}
        onDownload={handleDownloadManual}
      />
    </Layout>
  );
}