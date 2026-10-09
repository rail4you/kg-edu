import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { Typography, Button, Spin, Alert, Tag } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getHeaders } from "@/utils/api-helpers";
import { usePageTitle } from "@/hooks/use-page-title";
import { getSessionByToken, checkIn } from "@/lib/ash_rpc";

const { Text } = Typography;

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
          background: "var(--pu-bg, #f5f7fb)",
          padding: 24,
        }}
      >
        <div className="pu-card" style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#fdeef1",
              color: "#c93d50",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <CloseCircleOutlined style={{ fontSize: 30 }} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 650, color: "var(--pu-ink)", marginBottom: 8 }}>
            签到链接无效
          </h2>
          <p style={{ color: "var(--pu-muted)", fontSize: 14, lineHeight: 1.7, marginBottom: 24 }}>
            该签到码可能已过期或不存在，请联系老师确认。
          </p>
          <Button type="primary" block onClick={() => navigate("/")} style={{ height: 44, fontWeight: 600 }}>
            返回首页
          </Button>
        </div>
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
        background: "var(--pu-bg, #f5f7fb)",
        padding: 24,
      }}
    >
      <div className="pu-card" style={{ maxWidth: 460, width: "100%", padding: 30 }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "var(--pu-blue-soft, #edf2ff)",
              color: "var(--pu-blue, #2859df)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 14px",
            }}
          >
            <EnvironmentOutlined style={{ fontSize: 26 }} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 650, color: "var(--pu-ink)" }}>学生签到</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--pu-muted)" }}>
            {session.createdBy?.name || "老师"} 发起的签到
          </p>
        </div>

        <div style={{ marginBottom: 22, textAlign: "center" }}>
          <h2 style={{ fontSize: 17, fontWeight: 650, color: "var(--pu-ink)", marginBottom: 6 }}>
            {session.title}
          </h2>
          {session.description && (
            <p style={{ color: "var(--pu-muted)", fontSize: 13, lineHeight: 1.7, marginBottom: 14 }}>
              {session.description}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Tag color={isSessionActive ? "success" : "default"} style={{ fontWeight: 600, margin: 0 }}>
              {isSessionActive ? "进行中" : "已关闭"}
            </Tag>
            <span style={{ color: "var(--pu-muted)", fontSize: 13 }}>
              开始时间: {new Date(session.startedAt).toLocaleString("zh-CN")}
            </span>
          </div>
        </div>

        {hasCheckedIn ? (
          <Alert
            type="success"
            icon={<CheckCircleOutlined />}
            showIcon
            message="签到成功！"
            description="您已完成签到，感谢配合。"
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
        ) : checkInError ? (
          <Alert
            type="error"
            message={checkInError}
            style={{ marginBottom: 16, borderRadius: 10 }}
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
                height: 52,
                fontSize: 17,
                fontWeight: 600,
                background: "var(--pu-green, #137b62)",
                borderColor: "var(--pu-green, #137b62)",
              }}
            >
              {checkInMutation.isPending
                ? "签到中..."
                : !user
                  ? "登录后签到"
                  : "确认签到"}
            </Button>
            {!user && (
              <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
                点击后将跳转到登录页面
              </Text>
            )}
          </div>
        )}

        {isSessionClosed && (
          <Alert
            type="info"
            message="该签到已结束，无法继续签到。"
            style={{ marginBottom: 16, borderRadius: 10 }}
          />
        )}

        {user && !hasCheckedIn && (
          <div
            style={{
              marginTop: 16,
              padding: "10px 14px",
              background: "#f6f8fb",
              borderRadius: 10,
            }}
          >
            <Text type="secondary" style={{ fontSize: 13 }}>
              签到用户: <strong style={{ color: "var(--pu-ink)" }}>{(user as any).displayName || (user as any).email}</strong>
            </Text>
          </div>
        )}

        <div style={{ marginTop: 22, textAlign: "center" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            签到码: {session.token}
          </Text>
        </div>
      </div>
    </div>
  );
}
