import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Row, Col, Typography } from "antd";
import {
  ReadOutlined,
  ApartmentOutlined,
  BookOutlined,
  PartitionOutlined,
  FileTextOutlined,
  EditOutlined,
  RobotOutlined,
  TeamOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  StarOutlined,
  ArrowRightOutlined,
  AppstoreAddOutlined,
} from "@ant-design/icons";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { useBranding } from "@/hooks/use-branding";
import "./module-home.css";

const { Title, Text } = Typography;

const MODULES = [
  {
    key: "smart-course",
    title: "智慧课程",
    eyebrow: "Course Intelligence",
    description:
      "面向课程建设与教学运行的统一工作台，覆盖课程管理、知识图谱、教学资源、学习分析与 AI 辅助。",
    icon: <ReadOutlined />,
    path: "/teacher/dashboard",
    accent: "#1766d8",
    dark: "#0f3f8c",
    soft: "#eef5ff",
    border: "#b9d0f2",
    features: [
      { icon: <BookOutlined />, label: "课程管理" },
      { icon: <PartitionOutlined />, label: "知识图谱" },
      { icon: <RobotOutlined />, label: "AI 辅助" },
      { icon: <BarChartOutlined />, label: "统计分析" },
    ],
    stats: ["全流程教学管理", "结构化资源建设"],
  },
  {
    key: "micro-major",
    title: "微专业",
    eyebrow: "Micro Credential",
    description:
      "围绕职业方向与能力目标组织短期项目，独立管理课程组合、章节视频、习题作业、学生与资源。",
    icon: <ApartmentOutlined />,
    path: "/micro-major/dashboard",
    accent: "#7a4a12",
    dark: "#4f3211",
    soft: "#fff6e9",
    border: "#e6c58e",
    features: [
      { icon: <VideoCameraOutlined />, label: "视频管理" },
      { icon: <FileTextOutlined />, label: "习题管理" },
      { icon: <EditOutlined />, label: "作业管理" },
      { icon: <TeamOutlined />, label: "学员管理" },
    ],
    stats: ["能力导向项目", "独立运营体系"],
  },
];

const SIDE_PANELS = [
  {
    key: "course",
    label: "智慧课程",
    text: "知识图谱 · 教学资源 · 学情分析",
    image: "/assets/decor/knowledge-bg_001.jpg",
    className: "module-home-side-left",
  },
  {
    key: "micro-major",
    label: "微专业",
    text: "课程组合 · 项目训练 · 能力认证",
    image: "/assets/micro-major-hero.jpg",
    className: "module-home-side-right",
  },
];

export default function ModuleHome() {
  const navigate = useNavigate();
  const branding = useBranding();

  return (
    <div className="module-home-page">
      <div className="module-home-header">
        <div
          className="module-home-brand"
          onClick={() => navigate("/teacher/module-home")}
        >
          <img src={branding.logo_dark} alt={branding.app_name} className="module-home-logo" />
          <span className="module-home-brand-text">{branding.app_title} · 教师端</span>
        </div>
        <div className="module-home-actions">
          <UserMenu role="teacher" />
        </div>
      </div>

      <main className="module-home-main">
        <div className="module-home-backdrop" />

        <section className="module-home-content">
          <div className="module-home-portal">
            <div className="module-home-intro-card">
              <div className="module-home-intro-icon">
                <AppstoreAddOutlined />
              </div>
              <div className="module-home-intro-body">
                <span className="module-home-intro-tag">教学业务入口</span>
                <Title level={2}>选择要进入的管理模块</Title>
                <Text>从课程建设到微专业运营，在同一平台完成教学内容、资源与学习过程管理。</Text>
              </div>
            </div>
            <aside className={`module-home-side-panel ${SIDE_PANELS[0].className}`}>
              <img src={SIDE_PANELS[0].image} alt="" />
              <div className="module-home-side-copy">
                <strong>{SIDE_PANELS[0].label}</strong>
                <span>{SIDE_PANELS[0].text}</span>
              </div>
            </aside>

            <Row gutter={[28, 28]} justify="center" className="module-home-grid">
              {MODULES.map((mod) => (
                <Col key={mod.key} xs={24} md={12}>
                  <button
                    type="button"
                    className="module-home-card"
                    style={
                      {
                        "--module-accent": mod.accent,
                        "--module-dark": mod.dark,
                        "--module-soft": mod.soft,
                        "--module-border": mod.border,
                      } as CSSProperties
                    }
                    onClick={() => navigate(mod.path)}
                  >
                    <div className="module-home-card-head">
                      <div className="module-home-card-icon">{mod.icon}</div>
                      <div>
                        <span className="module-home-card-eyebrow">{mod.eyebrow}</span>
                        <Title level={3}>{mod.title}</Title>
                      </div>
                    </div>

                    <Text className="module-home-card-desc">{mod.description}</Text>

                    <div className="module-home-card-stats">
                      {mod.stats.map((stat) => (
                        <span key={stat}>
                          <StarOutlined />
                          {stat}
                        </span>
                      ))}
                    </div>

                    <div className="module-home-feature-list">
                      {mod.features.map((feature) => (
                        <span key={feature.label}>
                          {feature.icon}
                          {feature.label}
                        </span>
                      ))}
                    </div>

                    <div className="module-home-card-action">
                      <span>进入模块</span>
                      <ArrowRightOutlined />
                    </div>
                  </button>
                </Col>
              ))}
            </Row>

            <aside className={`module-home-side-panel ${SIDE_PANELS[1].className}`}>
              <img src={SIDE_PANELS[1].image} alt="" />
              <div className="module-home-side-copy">
                <strong>{SIDE_PANELS[1].label}</strong>
                <span>{SIDE_PANELS[1].text}</span>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
