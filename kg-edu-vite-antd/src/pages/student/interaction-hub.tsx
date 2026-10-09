import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Empty,
  Result,
  Skeleton,
  Grid,
} from "antd";
import {
  ArrowRightOutlined,
  CommentOutlined,
  DeploymentUnitOutlined,
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
import { PageHead, ProtoCard, ProtoTag, ProtoTabs, StatGrid } from "@/components/proto";

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
    <div className="pu-page">
      <PageHead
        title="互动课堂"
        description="参与课堂活动，记录思考，与老师和同学一起交流。"
        actions={
          courseResult?.title ? (
            <div className="pu-tags">
              <ProtoTag tone="blue">{courseResult.title}</ProtoTag>
              {courseResult.major && <ProtoTag tone="gray">{courseResult.major}</ProtoTag>}
            </div>
          ) : courseLoading ? (
            <Skeleton.Button active size="small" style={{ width: 140 }} />
          ) : null
        }
      />

      <StatGrid
        columns={2}
        items={[
          {
            label: "进行中的讨论",
            value: activeSessions.length,
            unit: "场",
            desc: "可以参与的课堂讨论",
            icon: <CommentOutlined />,
          },
          {
            label: "已发布任务",
            value: activeTasks.length,
            unit: "个",
            desc: "小组协作任务",
            icon: <DeploymentUnitOutlined />,
          },
        ]}
      />

      <ProtoTabs
        items={tabs.map((t) => ({
          id: t.key,
          label: (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              {t.icon}
              {t.label}
            </span>
          ),
        }))}
        active={activeTab}
        onChange={handleTabChange}
      />

      {activeTab === "discussions" && (
        <ProtoCard title="进行中的讨论" extra={<span style={{ fontSize: 12, color: "#64748b" }}>共 {activeSessions.length} 场</span>}>
          {sessionsError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="加载课堂讨论失败"
              description={(sessionsError as Error).message}
            />
          )}
          {sessionsLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : activeSessions.length === 0 ? (
            <Empty description="当前课程暂无进行中的讨论会话" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="pu-card"
                  style={{ padding: isMobile ? 16 : 20 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <ProtoTag tone="green">进行中</ProtoTag>
                    {session.startedAt && (
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {new Date(session.startedAt).toLocaleString("zh-CN")}
                      </span>
                    )}
                  </div>
                  <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 650, margin: "0 0 8px", color: "#202f47", lineHeight: 1.5 }}>
                    {session.title}
                  </h3>
                  <p style={{ fontSize: isMobile ? 13 : 14, color: "#64748b", lineHeight: 1.8, margin: "0 0 16px" }}>
                    {session.description || "教师已开启课堂讨论，进入后可查看同学发言并参与回复。"}
                  </p>
                  <Button
                    type="primary"
                    icon={<ArrowRightOutlined />}
                    onClick={() => openDiscussion(session.token)}
                    size={isMobile ? "small" : "middle"}
                  >
                    进入讨论
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ProtoCard>
      )}

      {activeTab === "group-tasks" && (
        <ProtoCard title="已发布任务" extra={<span style={{ fontSize: 12, color: "#64748b" }}>共 {activeTasks.length} 个</span>}>
          {tasksError && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="加载小组任务失败"
              description={(tasksError as Error).message}
            />
          )}
          {tasksLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : visibleTasks.length === 0 ? (
            <Empty description="当前课程暂无已发布的小组任务" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="pu-card"
                  style={{ padding: isMobile ? 16 : 20 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                    <ProtoTag tone={task.status === "active" ? "green" : "gray"}>
                      {task.status === "active" ? "进行中" : "已结束"}
                    </ProtoTag>
                    <ProtoTag tone="blue">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</ProtoTag>
                  </div>
                  <h3 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 650, margin: "0 0 8px", color: "#202f47", lineHeight: 1.5 }}>
                    {task.title}
                  </h3>
                  <p style={{ fontSize: isMobile ? 13 : 14, color: "#64748b", lineHeight: 1.8, margin: "0 0 16px" }}>
                    {task.description || "教师已发布小组任务，进入后可查看分组与提交内容。"}
                  </p>
                  <Button
                    type={task.status === "active" ? "primary" : "default"}
                    icon={<ArrowRightOutlined />}
                    onClick={() => openTask(task.token!)}
                  >
                    {task.status === "active" ? "进入任务" : "查看任务"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ProtoCard>
      )}
    </div>
  );
}
