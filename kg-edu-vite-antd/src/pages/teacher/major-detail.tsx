import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Row, Col, Typography, Spin, Descriptions, Tag, Empty, Button } from "antd";
import {
  ApartmentOutlined, TeamOutlined, TrophyOutlined, BookOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getMajor } from "@/lib/ash_rpc";

const { Title, Text } = Typography;

const DEGREE_MAP: Record<string, string> = { bachelor: "本科", master: "硕士", doctoral: "博士" };

export default function MajorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();

  const headers = getAuthHeaders(user) as Record<string, string>;

  const { data: major, isLoading } = useQuery({
    queryKey: ["major", id, tenant],
    queryFn: async () => { const r = await getMajor({ tenant, input: { id }, fields: ["id", "name", "code", "description", "college", "degreeType", "duration", "status"], headers }); return r?.success ? r.data : null; },
    enabled: !!id && !!tenant,
  });

  const modules = [
    { title: "岗位管理", desc: "管理专业相关岗位信息", icon: <TeamOutlined />, path: `/teacher/dashboard/major-jobs/${id}`, color: "#1890ff" },
    { title: "能力图谱构建", desc: "构建专业能力素质图谱，支持 AI 生成", icon: <TrophyOutlined />, path: `/teacher/dashboard/major-competency/${id}`, color: "#52c41a" },
    { title: "课程体系设计", desc: "AI 生成课程体系文档，支持预览、编辑、发布", icon: <BookOutlined />, path: `/teacher/dashboard/major-curriculum/${id}`, color: "#722ed1" },
  ];

  if (isLoading) return <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>;
  if (!major) return <Empty description="专业不存在" />;

  return (
    <div style={{ padding: 24 }}>
      <Button
        icon={<ArrowLeftOutlined />}
        style={{ marginBottom: 16 }}
        onClick={() => navigate("/teacher/dashboard/major-list")}
      >返回专业列表</Button>
      <Card style={{ marginBottom: 16 }}>
        <Descriptions title={<><ApartmentOutlined /> {major.name}</>} column={3}>
          <Descriptions.Item label="专业代码">{major.code || "-"}</Descriptions.Item>
          <Descriptions.Item label="所属学院">{major.college || "-"}</Descriptions.Item>
          <Descriptions.Item label="学位类型">{DEGREE_MAP[major.degreeType] || major.degreeType || "-"}</Descriptions.Item>
          <Descriptions.Item label="学制">{major.duration ? `${major.duration}年` : "-"}</Descriptions.Item>
          <Descriptions.Item label="状态"><Tag color={major.status === "active" ? "green" : "default"}>{major.status === "active" ? "启用" : "草稿"}</Tag></Descriptions.Item>
        </Descriptions>
        {major.description && <Text type="secondary">{major.description}</Text>}
      </Card>

      <Row gutter={16}>
        {modules.map((m, idx) => (
          <Col span={8} key={idx}>
            <Card hoverable style={{ cursor: "pointer", borderTop: `3px solid ${m.color}` }} onClick={() => navigate(m.path)}>
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 36, color: m.color, marginBottom: 12 }}>{m.icon}</div>
                <Title level={5}>{m.title}</Title>
                <Text type="secondary">{m.desc}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
