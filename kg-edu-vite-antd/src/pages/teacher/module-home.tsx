import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";
import { Row, Col } from "antd";
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
} from "@ant-design/icons";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { useBranding } from "@/hooks/use-branding";
import { PageHead, ProtoCard } from "@/components/proto";
import "./module-home.css";

const MODULES = [
  {
    key: "smart-course",
    title: "智慧课程",
    description:
      "面向课程建设与教学运行的统一工作台，覆盖课程管理、知识图谱、教学资源、学习分析与 AI 辅助。",
    eyebrow: "知识图谱 · 教学资源 · 学情分析",
    hero: "/assets/decor/knowledge-bg_001.jpg",
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
    description:
      "围绕职业方向与能力目标组织短期项目，独立管理课程组合、章节视频、习题作业、学生与资源。",
    eyebrow: "课程组合 · 项目训练 · 能力认证",
    hero: "/assets/micro-major-hero.jpg",
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
          <PageHead
            title="选择要进入的管理模块"
            description="从课程建设到微专业运营，在同一平台完成教学内容、资源与学习过程管理。"
          />

          <div className="module-home-portal">
            <Row gutter={[28, 28]} justify="center" className="module-home-grid">
              {MODULES.map((mod) => (
                <Col key={mod.key} xs={24} md={12}>
                  <ProtoCard
                    onClick={() => navigate(mod.path)}
                    className="module-home-module-card"
                    style={
                      {
                        height: "100%",
                        cursor: "pointer",
                        "--module-accent": mod.accent,
                        "--module-dark": mod.dark,
                        "--module-soft": mod.soft,
                        "--module-border": mod.border,
                      } as CSSProperties
                    }
                  >
                    <div className="module-home-module-hero">
                      <img src={mod.hero} alt="" />
                      <div className="module-home-module-hero-copy">
                        <strong>{mod.title}</strong>
                        <span>{mod.eyebrow}</span>
                      </div>
                    </div>

                    <div className="module-home-module-body">
                      <p className="module-home-module-desc">{mod.description}</p>

                      <div className="module-home-module-stats">
                        {mod.stats.map((stat) => (
                          <span className="module-home-module-stat" key={stat}>
                            {stat}
                          </span>
                        ))}
                      </div>

                      <div className="module-home-module-features">
                        {mod.features.map((feature) => (
                          <div className="module-home-module-feature" key={feature.label}>
                            <span className="module-home-module-feature-icon">{feature.icon}</span>
                            <span className="module-home-module-feature-label">{feature.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ProtoCard>
                </Col>
              ))}
            </Row>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
