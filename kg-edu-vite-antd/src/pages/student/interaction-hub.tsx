import { useEffect, useMemo, useState } from "react";
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
  Grid,
} from "antd";
import {
  ArrowRightOutlined,
  CommentOutlined,
  DeploymentUnitOutlined,
  FireOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import {
  listCourses,
  getTasksByCourse,
  listDiscussionSessions,
} from "@/lib/ash_rpc";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant";
import { themeColors as colors } from "@/styles/theme";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";

const { Title, Paragraph, Text } = Typography;

const TASK_TYPE_LABELS: Record<string, string> = {
  submission: "提交任务",
  discussion: "讨论任务",
  survey: "投票调查",
  file_upload: "文件上传",
};

interface GroupTaskItem {
  id: string;
  title: string;
  description?: string;
  taskType: string;
  status: "draft" | "active" | "closed";
  token?: string | null;
  dueDate?: string | null;
  publishAt?: string | null;
  courseId: string;
}

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

type TabKey = "discussions" | "group-tasks";

export default function StudentInteractionHubPage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const tenantFromQuery = searchParams.get("tenant") || "";
  const tenant = tenantFromQuery || currentTenant?.schemaName || "";
  const selectedCourseId =
    searchParams.get("courseId") ||
    localStorage.getItem("selectedCourse") ||
    "";

  // Read tab from URL hash or default to discussions
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "group-tasks") return "group-tasks";
    return "discussions";
  });

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

  // Update hash when tab changes
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // ── Course info ──
  const { data: courseResult, isLoading: courseLoading } = useQuery({
    queryKey: ["student-interaction-course", tenant, selectedCourseId],
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

  // ── Group tasks ──
  const { data: tasksResult, isLoading: tasksLoading, error: tasksError } =
    useQuery({
      queryKey: ["student-group-tasks", tenant, selectedCourseId],
      queryFn: async () => {
        const result = await getTasksByCourse({
          tenant,
          input: { courseId: selectedCourseId as any },
          fields: [
            "id",
            "title",
            "description",
            "taskType",
            "status",
            "token",
            "dueDate",
            "publishAt",
            "courseId",
          ],
          headers: user ? getHeaders(user) : undefined,
        } as any);

        if (!result.success) {
          throw new Error(
            result.errors?.[0]?.message || "加载小组任务失败"
          );
        }

        return extractArrayData(result) as GroupTaskItem[];
      },
      enabled: !!tenant && !!selectedCourseId,
    });

  // ── Discussion sessions ──
  const {
    data: sessionsResult,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useQuery({
    queryKey: ["student-discussion-sessions", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await listDiscussionSessions({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "courseId",
          "token",
          "status",
          "startedAt",
          "endedAt",
        ],
        filter: {
          courseId: { eq: selectedCourseId },
        },
        sort: "-startedAt",
        headers: user ? getHeaders(user) : undefined,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "加载课堂讨论失败"
        );
      }

      return extractArrayData(result) as DiscussionSessionItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  const visibleTasks = useMemo(
    () =>
      (tasksResult || []).filter(
        (item) => item.status !== "draft" && item.token
      ),
    [tasksResult]
  );

  const activeTasks = useMemo(
    () => visibleTasks.filter((item) => item.status === "active"),
    [visibleTasks]
  );

  const activeSessions = useMemo(
    () =>
      (sessionsResult || []).filter(
        (item) => item.token && item.status === "active"
      ),
    [sessionsResult]
  );

  const openTask = (token: string) => {
    navigate(`/dashboard/interaction/task/${token}`);
  };

  const openDiscussion = (token: string) => {
    navigate(`/dashboard/interaction/discussion/${token}`);
  };

  if (authLoading) {
    return (
      <div style={{ padding: 40 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!user) {
    return (
      <Result
        status="info"
        title="请先登录"
        subTitle="登录后可查看课堂互动。"
      />
    );
  }

  if (!tenant) {
    return (
      <Alert
        type="warning"
        message="未选择组织"
        description="请先从课程主页进入。"
      />
    );
  }

  if (!selectedCourseId) {
    return (
      <Alert
        type="warning"
        message="未选择课程"
        description="请先进入课程，再查看课堂互动。"
      />
    );
  }

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "discussions", label: "课堂讨论", icon: <CommentOutlined />, color: colors.primary },
    { key: "group-tasks", label: "小组任务", icon: <DeploymentUnitOutlined />, color: "#059669" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.background }}>
      <div style={{ flexGrow: 1, overflow: "auto", padding: isMobile ? "12px" : "24px 32px" }}>
      {/* Header card - 去标签、更明显卡片、占满容器高度 */}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: "24px 28px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)",
          border: "1px solid #E1E3E4",
          marginBottom: isMobile ? 12 : 20,
          minHeight: isMobile ? 140 : 160,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Space
          align="center"
          size={isMobile ? 8 : 16}
          style={{ width: "100%", justifyContent: "space-between" }}
          wrap
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={isMobile ? 4 : 3} style={{ margin: 0, fontSize: isMobile ? 18 : 24 }}>
              互动课堂
            </Title>
            <Paragraph
              style={{ margin: "6px 0 0", color: colors.textSecondary, fontSize: isMobile ? 13 : 14 }}
            >
              查看当前课程的课堂讨论与小组协作任务
            </Paragraph>
            <Space size={[6, 6]} wrap style={{ marginTop: 8 }}>
              {courseLoading ? (
                <Skeleton.Button active size="small" style={{ width: 120 }} />
              ) : (
                <>
                  <Tag style={{ fontSize: isMobile ? 11 : 13 }}>{courseResult?.title || "当前课程"}</Tag>
                  {courseResult?.major && (
                    <Tag color="cyan" style={{ fontSize: isMobile ? 11 : 13 }}>{courseResult.major}</Tag>
                  )}
                </>
              )}
            </Space>
          </div>
          <Space size={isMobile ? 6 : 12} wrap style={{ flexShrink: 0, alignSelf: "stretch", alignItems: "stretch" }}>
            <div
              style={{
                minWidth: isMobile ? 80 : 120,
                padding: isMobile ? "12px 14px" : "16px 20px",
                borderRadius: 12,
                background: "#FFFFFF",
                border: "1px solid #E1E3E4",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: isMobile ? 72 : 80,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(37,115,230,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid rgba(37,115,230,0.12)",
                }}
              >
                <CommentOutlined style={{ fontSize: 18, color: colors.primary }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, display: "block", lineHeight: 1, fontWeight: 600 }}>讨论</Text>
                <div
                  style={{
                    fontSize: isMobile ? 22 : 26,
                    fontWeight: 800,
                    color: colors.primary,
                    lineHeight: 1.1,
                  }}
                >
                  {activeSessions.length}
                </div>
              </div>
            </div>
            <div
              style={{
                minWidth: isMobile ? 80 : 120,
                padding: isMobile ? "12px 14px" : "16px 20px",
                borderRadius: 12,
                background: "#FFFFFF",
                border: "1px solid #E1E3E4",
                boxShadow: "0 8px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                minHeight: isMobile ? 72 : 80,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(5,150,105,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  border: "1px solid rgba(5,150,105,0.12)",
                }}
              >
                <DeploymentUnitOutlined style={{ fontSize: 18, color: "#059669" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <Text type="secondary" style={{ fontSize: isMobile ? 11 : 12, display: "block", lineHeight: 1, fontWeight: 600 }}>任务</Text>
                <div
                  style={{
                    fontSize: isMobile ? 22 : 26,
                    fontWeight: 800,
                    color: "#059669",
                    lineHeight: 1.1,
                  }}
                >
                  {activeTasks.length}
                </div>
              </div>
            </div>
          </Space>
        </Space>
      </div>

      {/* Inner Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: 4,
          background: "#F3F4F5",
          borderRadius: 9999,
          marginBottom: isMobile ? 12 : 20,
          width: isMobile ? "100%" : "fit-content",
          overflowX: isMobile ? "auto" : "visible",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <div
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 4 : 6,
                padding: isMobile ? "6px 12px" : "8px 20px",
                cursor: "pointer",
                fontSize: isMobile ? 12 : 14,
                fontWeight: isActive ? 600 : 400,
                fontFamily: "'Manrope', sans-serif",
                color: isActive ? "#FFFFFF" : "#424754",
                whiteSpace: "nowrap",
                borderRadius: 9999,
                background: isActive ? tab.color : "transparent",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "rgba(255, 255, 255, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLDivElement).style.background =
                    "transparent";
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </div>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "discussions" && (
        <div>
          {sessionsError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="加载课堂讨论失败"
              description={(sessionsError as Error).message}
            />
          )}
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: colors.primary }} />
                <span>进行中的讨论</span>
              </Space>
            }
            style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #E1E3E4" }}
            styles={{ header: { borderBottom: "1px solid #f0f0f0" }, body: { padding: isMobile ? 12 : 18 } }}
          >
            {sessionsLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : activeSessions.length === 0 ? (
              <Empty description="当前课程暂无进行中的讨论会话" />
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {activeSessions.map((session) => (
                  <Card
                    key={session.id}
                    size="small"
                    hoverable
                    style={{ borderRadius: 12, border: "1px solid #E1E3E4", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", background: "#FFFFFF" }}
                    styles={{ body: { padding: isMobile ? 12 : 18 } }}
                  >
                    <Space
                      direction="vertical"
                      size={isMobile ? 6 : 10}
                      style={{ width: "100%" }}
                    >
                      <Space wrap>
                        <Tag color="green" style={{ fontSize: isMobile ? 11 : 13 }}>进行中</Tag>
                        {session.startedAt && (
                          <Tag style={{ fontSize: isMobile ? 11 : 13 }}>
                            {new Date(session.startedAt).toLocaleString(
                              "zh-CN"
                            )}
                          </Tag>
                        )}
                      </Space>
                      <Title level={isMobile ? 5 : 4} style={{ margin: 0, fontSize: isMobile ? 16 : 20 }}>
                        {session.title}
                      </Title>
                      <Paragraph
                        style={{
                          margin: 0,
                          color: colors.textSecondary,
                          fontSize: isMobile ? 13 : 14,
                        }}
                      >
                        {session.description ||
                          "教师已开启课堂讨论，进入后可查看同学发言并参与回复。"}
                      </Paragraph>
                      <div>
                        <Button
                          type="primary"
                          icon={<ArrowRightOutlined />}
                          onClick={() => openDiscussion(session.token)}
                          size={isMobile ? "small" : "middle"}
                        >
                          进入讨论
                        </Button>
                      </div>
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "group-tasks" && (
        <div>
          {tasksError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="加载小组任务失败"
              description={(tasksError as Error).message}
            />
          )}
          <Card
            title={
              <Space>
                <FireOutlined style={{ color: "#059669" }} />
                <span>已发布任务</span>
              </Space>
            }
            style={{ background: "#FFFFFF", borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)", border: "1px solid #E1E3E4" }}
            styles={{ header: { borderBottom: "1px solid #f0f0f0" }, body: { padding: isMobile ? 12 : 18 } }}
          >
            {tasksLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : visibleTasks.length === 0 ? (
              <Empty description="当前课程暂无已发布的小组任务" />
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {visibleTasks.map((task) => (
                  <Card
                    key={task.id}
                    size="small"
                    hoverable
                    style={{ borderRadius: 12, border: "1px solid #E1E3E4", boxShadow: "0 4px 12px rgba(0,0,0,0.06)", background: "#FFFFFF" }}
                    styles={{ body: { padding: 18 } }}
                  >
                    <Space
                      direction="vertical"
                      size={10}
                      style={{ width: "100%" }}
                    >
                      <Space wrap>
                        <Tag
                          color={task.status === "active" ? "green" : "default"}
                        >
                          {task.status === "active" ? "进行中" : "已结束"}
                        </Tag>
                        <Tag>
                          {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                        </Tag>
                      </Space>
                      <Title level={4} style={{ margin: 0 }}>
                        {task.title}
                      </Title>
                      <Paragraph
                        style={{
                          margin: 0,
                          color: colors.textSecondary,
                        }}
                      >
                        {task.description ||
                          "教师已发布小组任务，进入后可查看分组与提交内容。"}
                      </Paragraph>
                      <div>
                        <Button
                          type={
                            task.status === "active" ? "primary" : "default"
                          }
                          icon={<ArrowRightOutlined />}
                          onClick={() => openTask(task.token!)}
                        >
                          {task.status === "active" ? "进入任务" : "查看任务"}
                        </Button>
                      </div>
                    </Space>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}
