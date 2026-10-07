import { useCallback, useEffect, useState } from "react";
import { App, Button, Card, Empty, List, Space, Tag, Typography } from "antd";
import { ReloadOutlined, LoginOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import {
  fetchTenantPracticeSessions,
  joinPracticeSession,
  type PracticeSession,
} from "@/lib/practice-session";
import PracticeSessionRoom from "@/components/practice/PracticeSessionRoom";

const { Text, Title } = Typography;

export default function StudentAiQa() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const res = await fetchTenantPracticeSessions(tenant, headers);
      if (res.ok) setSessions(res.data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  useEffect(() => {
    load();
  }, [load]);

  const enter = async (s: PracticeSession) => {
    if (!user?.id) {
      message.error("请先登录");
      return;
    }
    setJoining(s.token);
    try {
      // 记录加入（租户内任意学生均可加入）
      await joinPracticeSession(s.token, user.id, tenant, headers);
      setActiveToken(s.token);
    } finally {
      setJoining(null);
    }
  };

  return (
    <div style={{ padding: "20px 24px", maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>
          互动故事
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          加入老师发起的互动故事，与老师一起推进剧情；评分后可查看分数与报告
        </Text>
      </div>

      <Card>
        {activeToken ? (
          <PracticeSessionRoom
            token={activeToken}
            role="student"
            userId={user?.id || ""}
            tenant={tenant}
            headers={headers}
            onExit={() => {
              setActiveToken(null);
              load();
            }}
          />
        ) : (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Text strong>可加入的互动故事</Text>
              <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>
                刷新
              </Button>
            </Space>
            {sessions.length === 0 ? (
              <Empty description="当前租户暂无进行中的互动故事" />
            ) : (
              <List
                dataSource={sessions}
                renderItem={(s) => (
                  <List.Item
                    actions={[
                      <Button
                        key="enter"
                        type="primary"
                        size="small"
                        icon={<LoginOutlined />}
                        loading={joining === s.token}
                        onClick={() => enter(s)}
                      >
                        进入房间
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text strong>{s.title || "互动故事课堂"}</Text>
                          {s.status === "evaluated" ? (
                            <Tag color="purple">已评分 {s.score} 分</Tag>
                          ) : (
                            <Tag color="orange">进行中</Tag>
                          )}
                        </Space>
                      }
                      description={s.report ? s.report.slice(0, 80) : "等待教师评分"}
                    />
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
