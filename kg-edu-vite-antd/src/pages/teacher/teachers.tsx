import React, { useState } from "react";
import {
  Row,
  Col,
  Card,
  Typography,
  Avatar,
  Spin,
  Alert,
  Empty,
  Tooltip,
  message,
} from "antd";
import {
  UserOutlined,
  BookOutlined,
  TeamOutlined,
  MailOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listUsers } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text, Paragraph } = Typography;

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f5f5f5'/%3E%3Ccircle cx='50' cy='35' r='20' fill='%23ccc'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='20' fill='%23ccc'/%3E%3C/svg%3E";

interface Teacher {
  id: string;
  name: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  major: string | null;
  colledge: string | null;
  email: string | null;
}

const CopyText: React.FC<{ text: string; icon?: React.ReactNode }> = ({
  text,
  icon,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      message.success("已复制");
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <Tooltip title={copied ? "已复制" : text}>
      <span
        onClick={handleCopy}
        style={{
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          padding: "2px 4px",
          borderRadius: 4,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#f0f0f0";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {icon}
      </span>
    </Tooltip>
  );
};

const TeacherCard: React.FC<{ teacher: Teacher }> = ({ teacher }) => (
  <Card
    style={{
      borderRadius: 12,
      overflow: "hidden",
      border: "1px solid #e8e8e8",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      height: "100%",
    }}
    styles={{ body: { padding: 0 } }}
    hoverable
  >
    <div style={{ display: "flex", minHeight: 180 }}>
      {/* 左侧头像区域 */}
      <div
        style={{
          width: 150,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          backgroundColor: "#fafafa",
          borderRight: "1px solid #f0f0f0",
        }}
      >
        <Avatar
          src={teacher.avatarUrl || DEFAULT_AVATAR}
          alt={teacher.name || "Teacher"}
          size={64}
          style={{
            marginBottom: 10,
            border: "3px solid #fff",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          }}
        />

        <Text
          strong
          ellipsis
          style={{ fontSize: 15, textAlign: "center", width: "100%" }}
        >
          {teacher.name || "未知教师"}
        </Text>

        {teacher.jobTitle && (
          <Text
            type="secondary"
            style={{ fontSize: 13, marginTop: 2 }}
          >
            {teacher.jobTitle}
          </Text>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "#1890ff",
            background: "rgba(24, 144, 255, 0.08)",
            borderRadius: 4,
            padding: "2px 8px",
            marginTop: 8,
            fontWeight: 500,
          }}
        >
          <BookOutlined style={{ fontSize: 11 }} /> 教师
        </span>
      </div>

      {/* 右侧简介区域 */}
      <div
        style={{
          flex: 1,
          padding: "16px 18px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 8,
            }}
          >
            <UserOutlined style={{ fontSize: 13, color: "#8c8c8c" }} />
            <Text
              strong
              style={{ fontSize: 13, color: "#404040" }}
            >
              个人简介
            </Text>
          </div>

          {teacher.bio ? (
            <Paragraph
              type="secondary"
              ellipsis={{ rows: 3, expandable: true, symbol: "展开" }}
              style={{ lineHeight: 1.6, marginBottom: 8, fontSize: 13 }}
            >
              {teacher.bio}
            </Paragraph>
          ) : (
            <Text
              type="secondary"
              italic
              style={{ marginBottom: 8, display: "block", fontSize: 13 }}
            >
              暂无个人简介信息
            </Text>
          )}
        </div>

        {/* 底部联系信息 */}
        <div
          style={{
            marginTop: "auto",
            paddingTop: 10,
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {teacher.email && (
            <CopyText
              text={teacher.email}
              icon={
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    color: "#8c8c8c",
                  }}
                >
                  <MailOutlined style={{ fontSize: 12 }} />
                  {teacher.email}
                </span>
              }
            />
          )}
          {teacher.colledge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: "#8c8c8c",
              }}
            >
              <BankOutlined style={{ fontSize: 12 }} />
              {teacher.colledge}
            </span>
          )}
          {teacher.major && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {teacher.major}
            </Text>
          )}
        </div>
      </div>
    </div>
  </Card>
);

export default function TeachersPage() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();

  const {
    data: teachersData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teachers", currentTenant?.id],
    queryFn: async () => {
      const result = await listUsers({
        tenant: currentTenant?.schemaName || "",
        fields: [
          "id",
          "name",
          "jobTitle",
          "avatarUrl",
          "bio",
          "major",
          "colledge",
          "email",
        ],
        filter: { role: { eq: "teacher" } },
        sort: "name",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!currentTenant?.schemaName,
  });

  const teachers: Teacher[] = Array.isArray(teachersData) ? teachersData : [];

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Alert
            type="warning"
            message="未选择组织"
            description="请选择一个组织以查看教师信息。"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Spin size="large" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="加载教师信息失败"
          description={(error as Error).message}
          showIcon
          style={{ marginTop: 24 }}
        />
      </div>
    );
  }

  if (!teachers.length) {
    return (
      <div style={{ padding: 24 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Empty
            image={<UserOutlined style={{ fontSize: 64, color: "#bfbfbf" }} />}
            description={
              <>
                <Title level={4} style={{ color: "#8c8c8c", marginBottom: 8 }}>
                  暂无教师信息
                </Title>
                <Text type="secondary">当前还没有注册的教师信息。</Text>
              </>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 页面标题 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          padding: 0,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)",
            flexShrink: 0,
          }}
        >
          <TeamOutlined style={{ fontSize: 18, color: "#1890ff" }} />
        </div>
        <div>
          <Title
            level={3}
            style={{
              marginBottom: 0,
              fontWeight: 700,
              color: "#333",
              lineHeight: 1.2,
            }}
          >
            教师团队
          </Title>
          {teachers.length > 0 && (
            <Text style={{ fontSize: 12, color: "#8c8c8c" }}>
              共 {teachers.length} 位教师
            </Text>
          )}
        </div>
      </div>

      {/* 教师卡片列表 */}
      <Row gutter={[20, 20]}>
        {teachers.map((teacher) => (
          <Col xs={24} md={12} key={teacher.id}>
            <TeacherCard teacher={teacher} />
          </Col>
        ))}
      </Row>
    </div>
  );
}
