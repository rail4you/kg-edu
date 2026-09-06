import { Button, Layout, Typography, Row, Col, Card, Space } from "antd";
import { useNavigate } from "react-router-dom";
import {
  BookOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  TeamOutlined,
  RightOutlined,
} from "@ant-design/icons";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { useBranding } from "@/hooks/use-branding";
import { useAuth } from "@/auth/auth-context";
import { themeColors } from "@/styles/theme";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
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

interface PlaceholderPageProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  activeNavKey: string;
}

const pageContent: Record<string, { features: { icon: React.ReactNode; title: string; desc: string }[]; description: string }> = {
  "/resources": {
    description:
      "教学资源库汇聚了涵盖多个学科领域的优质教学资源，包括视频课程、教学课件、实验指导、试题库等。平台支持资源上传、分类管理、在线预览与下载，为教师提供一站式的教学资源服务。",
    features: [
      { icon: <BookOutlined />, title: "视频课程资源", desc: "汇聚数千门精品视频课程，覆盖医学、工学、理学等多个学科门类，支持在线播放与课件下载。" },
      { icon: <FileTextOutlined />, title: "教学课件库", desc: "提供丰富的 PPT、PDF 教学课件资源，教师可参考借鉴，快速构建自己的课程教学内容。" },
      { icon: <ExperimentOutlined />, title: "实验教学资源", desc: "涵盖虚拟仿真实验、实验指导手册、实验报告模板等，助力实验教学环节的开展。" },
    ],
  },
  "/demo": {
    description:
      "示范教学包汇集了全国优秀教师的教学案例与课程设计，涵盖教案、课件、习题、实验指导等完整教学资源。通过借鉴优秀教学实践，帮助教师提升课程建设质量与教学效果。",
    features: [
      { icon: <BookOutlined />, title: "精品示范课程", desc: "精选国家级、省级一流课程的教学设计方案，包含完整的教学大纲、教案、课件与考核方案。" },
      { icon: <ExperimentOutlined />, title: "创新教学案例", desc: "汇集混合式教学、翻转课堂、项目制学习等创新教学模式的实际应用案例与经验分享。" },
      { icon: <TeamOutlined />, title: "教学名师讲堂", desc: "邀请教学名师分享课程建设经验、教学设计理念与课堂教学技巧，促进教师专业发展。" },
    ],
  },
  "/textbook": {
    description:
      "数字教材中心提供交互式、多媒体融合的现代教材体验。支持富媒体阅读、笔记标注、习题自测、学习进度追踪等功能，让教材从传统纸质向智能化、个性化学习工具转型。",
    features: [
      { icon: <BookOutlined />, title: "富媒体交互教材", desc: "集成视频、音频、动画、3D模型等多媒体元素，打造沉浸式阅读与学习体验。" },
      { icon: <FileTextOutlined />, title: "智能学习工具", desc: "支持笔记标注、高亮标记、章节书签、语音朗读等功能，提升学习效率。" },
      { icon: <ExperimentOutlined />, title: "自测与进度追踪", desc: "每章节内置习题自测，自动批改并生成学习报告，帮助学生及时掌握学习情况。" },
    ],
  },
  "/partners": {
    description:
      "我们与全国高等院校、教育研究机构、行业企业建立了广泛的合作关系，共同推进智慧教育的技术创新与教学改革。欢迎更多合作伙伴加入，共建智慧教育新生态。",
    features: [
      { icon: <TeamOutlined />, title: "院校合作", desc: "与高等院校建立合作关系，共同开展智慧教学实践与教学改革探索。" },
      { icon: <ExperimentOutlined />, title: "科研合作", desc: "与教育技术研究机构合作开展知识图谱、AI 教育应用等前沿课题研究，推动技术创新与成果转化。" },
      { icon: <BookOutlined />, title: "资源共建", desc: "联合多所院校共建共享优质教学资源，形成覆盖广泛、质量优良的教育资源生态体系。" },
    ],
  },
};

export default function PlaceholderPage({ title, subtitle, icon, activeNavKey }: PlaceholderPageProps) {
  const navigate = useNavigate();
  const branding = useBranding();
  const { authenticated, user } = useAuth();
  const content = pageContent[activeNavKey];

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
                  className={`home-nav__button ${item.key === activeNavKey ? "is-active" : ""}`}
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
      <Content style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Hero section */}
        <div
          style={{
            background: "linear-gradient(135deg, #0B4CA8 0%, #1A6DD8 50%, #0E63D8 100%)",
            padding: "60px 24px",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {icon && <div style={{ marginBottom: 16 }}>{icon}</div>}
            <Typography.Title level={2} style={{ color: "#fff", margin: 0, fontWeight: 700 }}>
              {title}
            </Typography.Title>
            <Typography.Paragraph
              style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, marginTop: 12, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}
            >
              {subtitle}
            </Typography.Paragraph>
          </div>
        </div>

        {/* Description and features */}
        <div style={{ background: "#f8fafc", flex: 1 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px" }}>
            {content?.description && (
              <Typography.Paragraph
                style={{
                  fontSize: 15,
                  lineHeight: 2,
                  color: "#555",
                  marginBottom: 40,
                  textAlign: "center",
                  maxWidth: 800,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                {content.description}
              </Typography.Paragraph>
            )}

            {content?.features && (
              <Row gutter={[24, 24]}>
                {content.features.map((feature) => (
                  <Col xs={24} md={8} key={feature.title}>
                    <Card
                      style={{
                        borderRadius: 12,
                        height: "100%",
                        border: "1px solid #e8eef7",
                      }}
                      styles={{
                        body: { padding: 28 },
                      }}
                    >
                      <Space direction="vertical" size={12}>
                        <span style={{ fontSize: 32, color: themeColors.primary }}>
                          {feature.icon}
                        </span>
                        <Typography.Title level={4} style={{ margin: 0, fontSize: 18 }}>
                          {feature.title}
                        </Typography.Title>
                        <Typography.Paragraph
                          style={{ color: "#8c8c8c", fontSize: 14, margin: 0, lineHeight: 1.8 }}
                        >
                          {feature.desc}
                        </Typography.Paragraph>
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}

            <div style={{ textAlign: "center", marginTop: 48 }}>
              <Button
                type="primary"
                size="large"
                shape="round"
                onClick={() => navigate("/courses")}
                style={{ paddingLeft: 32, paddingRight: 32 }}
              >
                浏览课程 <RightOutlined />
              </Button>
            </div>
          </div>
        </div>
      </Content>
      <GlobalFooter />
    </Layout>
  );
}
