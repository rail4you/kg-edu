import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Typography, Button, Spin, Alert, Tag } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getHeaders } from "@/utils/api-helpers";
import { usePageTitle } from "@/hooks/use-page-title";
import { getSessionByToken, checkIn } from "@/lib/ash_rpc";

const { Title, Text } = Typography;

interface CheckInSession {
  id: string;
  title: string;
  description?: string;
  status: "active" | "closed";
  token: string;
  startedAt: string;
  endedAt?: string;
  createdBy?: {
    id: string;
    name?: string;
  };
}

export default function StudentCheckInPage() {
  const { tenantSchema, token } = useParams<{ tenantSchema: string; token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  usePageTitle();
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInError, setCheckInError] = useState<string | null>(null);

  const { data: sessionResult, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ["checkin-session", tenantSchema, token],
    queryFn: async () => {
      if (!token || !tenantSchema) {
        throw new Error("Invalid check-in URL format");
      }

      const result = await getSessionByToken({
        tenant: tenantSchema,
        fields: ["id", "title", "description", "status", "token", "startedAt", "endedAt", { createdBy: ["id", "name"] }],
        input: { token },
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        const session = result.data as CheckInSession;
        return { data: session };
      }

      throw new Error("Invalid or expired check-in token");
    },
    enabled: !!token && !!tenantSchema,
    retry: false,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("请先登录");
      }

      if (!sessionResult?.data) {
        throw new Error("签到会话不存在");
      }

      if (!tenantSchema) {
        throw new Error("租户信息缺失");
      }

      const result = await checkIn({
        tenant: tenantSchema,
        fields: ["id", "checkedInAt"],
        input: {
          token: token!,
          userId: user.id,
        },
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errors = (result as any).errors;
        if (errors && errors.length > 0) {
          throw new Error(errors[0].message || "签到失败");
        }
        throw new Error("签到失败");
      }

      return result.data;
    },
    onSuccess: () => {
      setHasCheckedIn(true);
      setCheckInError(null);
    },
    onError: (error: Error) => {
      setCheckInError(error.message);
      setHasCheckedIn(false);
    },
  });

  const handleCheckIn = () => {
    if (!user) {
      const currentPath = window.location.pathname;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    checkInMutation.mutate();
  };

  if (authLoading || sessionLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>加载中...</Text>
          </div>
        </div>
      </div>
    );
  }

  if (sessionError || !sessionResult?.data) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 500, padding: 24, textAlign: "center" }}>
          <CloseCircleOutlined style={{ fontSize: 64, color: "#ff4d4f", marginBottom: 16 }} />
          <Title level={4} style={{ color: "#ff4d4f", marginBottom: 8 }}>
            签到链接无效
          </Title>
          <Text type="secondary">
            该签到码可能已过期或不存在，请联系老师确认。
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => navigate("/")}>
              返回首页
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const session = sessionResult.data;
  const isSessionActive = session.status === "active";
  const isSessionClosed = session.status === "closed";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F8F9FA",
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 500, width: "100%", borderRadius: 8, border: '1px solid #E0E0E0' }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={3} style={{ marginBottom: 8 }}>
            学生签到
          </Title>
          <Text type="secondary">
            {session.createdBy?.name || "老师"} 发起的签到
          </Text>
        </div>

        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <Title level={4} style={{ marginBottom: 8 }}>
            {session.title}
          </Title>
          {session.description && (
            <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
              {session.description}
            </Text>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 16, alignItems: "center" }}>
            <Tag color={isSessionActive ? "success" : "default"} style={{ fontWeight: 600 }}>
              {isSessionActive ? "进行中" : "已关闭"}
            </Tag>
            <Text type="secondary">
              开始时间: {new Date(session.startedAt).toLocaleString("zh-CN")}
            </Text>
          </div>
        </div>

        {hasCheckedIn ? (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message="签到成功！"
            description="您已完成签到，感谢配合。"
            style={{ marginBottom: 16 }}
          />
        ) : checkInError ? (
          <Alert
            type="error"
            message={checkInError}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {isSessionActive && !hasCheckedIn && (
          <div style={{ textAlign: "center" }}>
            <Button
              type="primary"
              size="large"
              block
              onClick={handleCheckIn}
              loading={checkInMutation.isPending}
              style={{
                height: 56,
                fontSize: 18,
                fontWeight: 600,
                backgroundColor: "#52c41a",
              }}
            >
              {checkInMutation.isPending
                ? "签到中..."
                : !user
                  ? "登录后签到"
                  : "确认签到"}
            </Button>
            {!user && (
              <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
                点击后将跳转到登录页面
              </Text>
            )}
          </div>
        )}

        {isSessionClosed && (
          <Alert
            type="info"
            message="该签到已结束，无法继续签到。"
            style={{ marginBottom: 16 }}
          />
        )}

        {user && !hasCheckedIn && (
          <div
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: "#F8F9FA",
              borderRadius: 8,
            }}
          >
            <Text type="secondary">
              签到用户: <strong>{(user as any).displayName || (user as any).email}</strong>
            </Text>
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            签到码: {session.token}
          </Text>
        </div>
      </Card>
    </div>
  );
}
