import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Empty,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  ArrowRightOutlined,
  CommentOutlined,
  FireOutlined,
  HistoryOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { listCourses, listDiscussionSessions } from "@/lib/ash_rpc";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant";
import { getStudentActivityHistory } from "@/lib/student-activity-history";
import { themeColors as colors } from "@/styles/theme";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";

const { Title, Paragraph, Text } = Typography;

interface DiscussionSessionItem {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  token: string;
  status: "active" | "closed";
  startedAt?: string;
  endedAt?: string;
}

export default function StudentDiscussionHubPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const tenantFromQuery = searchParams.get("tenant") || "";
  const tenant = tenantFromQuery || currentTenant?.schemaName || "";
  const selectedCourseId = searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";

  useEffect(() => {
    if (tenantFromQuery) {
      setCurrentTenant({
        id: tenantFromQuery,
        name: tenantFromQuery,
        schemaName: tenantFromQuery,
      });
    }
  }, [tenantFromQuery]);

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourse", selectedCourseId);
    }
  }, [selectedCourseId]);

  const { data: courseResult, isLoading: courseLoading } = useQuery({
    queryKey: ["student-discussion-course", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: ["id", "title", "major"],
        filter: { id: { eq: selectedCourseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return extractArrayData(result)?.[0] || null;
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  const { data: sessionsResult, isLoading: sessionsLoading, error } = useQuery({
    queryKey: ["student-discussion-sessions", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await listDiscussionSessions({
        tenant,
        fields: ["id", "title", "description", "courseId", "token", "status", "startedAt", "endedAt"],
        filter: {
          courseId: { eq: selectedCourseId },
        },
        sort: "-startedAt",
        headers: user ? getHeaders(user) : undefined,
      });

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "加载课堂讨论失败");
      }

      return extractArrayData(result) as DiscussionSessionItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  const activeSessions = useMemo(
    () => (sessionsResult || []).filter((item) => item.token && item.status === "active"),
    [sessionsResult],
  );

  const recentSessions = useMemo(() => {
    return getStudentActivityHistory("discussion")
      .filter((item) => item.tenantSchema === tenant && item.courseId === selectedCourseId)
      .filter((item) => !activeSessions.some((session) => session.token === item.token));
  }, [tenant, selectedCourseId, activeSessions]);

  const openDiscussion = (token: string) => {
    navigate(`/student/discussion/${tenant}/${token}`);
  };

  if (authLoading) {
    return <div style={{ padding: 40 }}><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }

  if (!user) {
    return <Result status="info" title="请先登录" subTitle="登录后可查看课程中的课堂讨论。" />;
  }

  if (!tenant) {
    return <Alert type="warning" message="未选择组织" description="请先从课程主页进入，或重新扫码进入课堂讨论。" />;
  }

  if (!selectedCourseId) {
    return <Alert type="warning" message="未选择课程" description="请先进入课程，再查看课堂讨论。" />;
  }

  return (
    <div style={{ padding: "24px 0 8px" }}>
      <div
        style={{
          padding: "24px 24px 20px",
          borderRadius: 24,
          background: "linear-gradient(135deg, rgba(37,115,230,0.08) 0%, rgba(37,115,230,0.02) 100%)",
          border: `1px solid ${colors.primary}1f`,
          marginBottom: 20,
        }}
      >
        <Space align="start" size={16} style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Tag color="blue" style={{ marginBottom: 10 }}>课堂互动</Tag>
            <Title level={3} style={{ margin: 0 }}>课堂讨论</Title>
            <Paragraph style={{ margin: "10px 0 0", color: colors.textSecondary }}>
              这里会显示当前课程教师已开启的讨论会话。扫码进入过的讨论，也会在学生端继续保留入口。
            </Paragraph>
            <Space size={[8, 8]} wrap>
              {courseLoading ? (
                <Skeleton.Button active size="small" style={{ width: 120 }} />
              ) : (
                <>
                  <Tag>{courseResult?.title || "当前课程"}</Tag>
                  {courseResult?.major && <Tag color="cyan">{courseResult.major}</Tag>}
                </>
              )}
            </Space>
          </div>
          <Space size={12} wrap>
            <div style={{ minWidth: 120, padding: "12px 14px", borderRadius: 16, background: "#FFFFFF" }}>
              <Text type="secondary">进行中</Text>
              <div style={{ fontSize: 26, fontWeight: 800, color: colors.primary }}>{activeSessions.length}</div>
            </div>
            <div style={{ minWidth: 120, padding: "12px 14px", borderRadius: 16, background: "#FFFFFF" }}>
              <Text type="secondary">最近扫码</Text>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>{recentSessions.length}</div>
            </div>
          </Space>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="加载课堂讨论失败"
          description={(error as Error).message}
        />
      )}

      <Card
        title={<Space><FireOutlined style={{ color: colors.primary }} /><span>进行中的讨论</span></Space>}
        bordered={false}
        style={{ borderRadius: 20, marginBottom: 20 }}
      >
        {sessionsLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : activeSessions.length === 0 ? (
          <Empty description="当前课程暂无进行中的讨论会话" />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {activeSessions.map((session) => (
              <Card
                key={session.id}
                size="small"
                style={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                styles={{ body: { padding: 18 } }}
              >
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color="green">进行中</Tag>
                    {session.startedAt && (
                      <Tag>{new Date(session.startedAt).toLocaleString("zh-CN")}</Tag>
                    )}
                  </Space>
                  <Title level={4} style={{ margin: 0 }}>{session.title}</Title>
                  <Paragraph style={{ margin: 0, color: colors.textSecondary }}>
                    {session.description || "教师已开启课堂讨论，进入后可查看同学发言并参与回复。"}
                  </Paragraph>
                  <div>
                    <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => openDiscussion(session.token)}>
                      进入讨论
                    </Button>
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={<Space><HistoryOutlined style={{ color: "#6B7280" }} /><span>最近扫码进入</span></Space>}
        bordered={false}
        style={{ borderRadius: 20 }}
      >
        {recentSessions.length === 0 ? (
          <Empty description="最近没有扫码进入过课堂讨论" />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {recentSessions.map((session) => (
              <Card
                key={`${session.kind}-${session.token}`}
                size="small"
                style={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                styles={{ body: { padding: 18 } }}
              >
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color="blue">最近访问</Tag>
                    <Tag>{new Date(session.visitedAt).toLocaleString("zh-CN")}</Tag>
                  </Space>
                  <Title level={5} style={{ margin: 0 }}>{session.title}</Title>
                  <Paragraph style={{ margin: 0, color: colors.textSecondary }}>
                    {session.description || "这是你最近扫码进入过的课堂讨论。"}
                  </Paragraph>
                  <div>
                    <Button icon={<CommentOutlined />} onClick={() => openDiscussion(session.token)}>
                      继续查看
                    </Button>
                  </div>
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
