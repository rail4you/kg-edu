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
  FireOutlined,
  HistoryOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { listCourses, getTasksByCourse } from "@/lib/ash_rpc";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant";
import { getStudentActivityHistory } from "@/lib/student-activity-history";
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

export default function StudentGroupTaskHubPage() {
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
    queryKey: ["student-group-task-course", tenant, selectedCourseId],
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

  const { data: tasksResult, isLoading: tasksLoading, error } = useQuery({
    queryKey: ["student-group-tasks", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await getTasksByCourse({
        tenant,
        input: { courseId: selectedCourseId as any },
        fields: ["id", "title", "description", "taskType", "status", "token", "dueDate", "publishAt", "courseId"],
        headers: user ? getHeaders(user) : undefined,
      } as any);

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "加载小组任务失败");
      }

      return extractArrayData(result) as GroupTaskItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  const visibleTasks = useMemo(
    () => (tasksResult || []).filter((item) => item.status !== "draft" && item.token),
    [tasksResult],
  );

  const activeTasks = useMemo(
    () => visibleTasks.filter((item) => item.status === "active"),
    [visibleTasks],
  );

  const recentTasks = useMemo(() => {
    return getStudentActivityHistory("group_task")
      .filter((item) => item.tenantSchema === tenant && item.courseId === selectedCourseId)
      .filter((item) => !visibleTasks.some((task) => task.token === item.token));
  }, [tenant, selectedCourseId, visibleTasks]);

  const openTask = (token: string) => {
    navigate(`/student/group-task/${tenant}/${token}`);
  };

  if (authLoading) {
    return <div style={{ padding: 40 }}><Skeleton active paragraph={{ rows: 6 }} /></div>;
  }

  if (!user) {
    return <Result status="info" title="请先登录" subTitle="登录后可查看课程中的小组任务。" />;
  }

  if (!tenant) {
    return <Alert type="warning" message="未选择组织" description="请先从课程主页进入，或重新扫码进入小组任务。" />;
  }

  if (!selectedCourseId) {
    return <Alert type="warning" message="未选择课程" description="请先进入课程，再查看小组任务。" />;
  }

  return (
    <div style={{ padding: "24px 0 8px" }}>
      <div
        style={{
          padding: "24px 24px 20px",
          borderRadius: 24,
          background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
          marginBottom: 20,
        }}
      >
        <Space align="start" size={16} style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <div>
            <Tag color="green" style={{ marginBottom: 10 }}>协作任务</Tag>
            <Title level={3} style={{ margin: 0 }}>小组任务</Title>
            <Paragraph style={{ margin: "10px 0 0", color: colors.textSecondary }}>
              这里会显示当前课程教师发布的小组任务。扫码进入过的任务，也会在学生端保留继续进入的入口。
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
              <div style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>{activeTasks.length}</div>
            </div>
            <div style={{ minWidth: 120, padding: "12px 14px", borderRadius: 16, background: "#FFFFFF" }}>
              <Text type="secondary">最近扫码</Text>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>{recentTasks.length}</div>
            </div>
          </Space>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message="加载小组任务失败"
          description={(error as Error).message}
        />
      )}

      <Card
        title={<Space><FireOutlined style={{ color: "#059669" }} /><span>已发布任务</span></Space>}
        bordered={false}
        style={{ borderRadius: 20, marginBottom: 20 }}
      >
        {tasksLoading ? (
          <Skeleton active paragraph={{ rows: 4 }} />
        ) : visibleTasks.length === 0 ? (
          <Empty description="当前课程暂无已发布的小组任务" />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {visibleTasks.map((task) => (
              <Card
                key={task.id}
                size="small"
                style={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                styles={{ body: { padding: 18 } }}
              >
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color={task.status === "active" ? "green" : "default"}>
                      {task.status === "active" ? "进行中" : "已结束"}
                    </Tag>
                    <Tag>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</Tag>
                  </Space>
                  <Title level={4} style={{ margin: 0 }}>{task.title}</Title>
                  <Paragraph style={{ margin: 0, color: colors.textSecondary }}>
                    {task.description || "教师已发布小组任务，进入后可查看分组与提交内容。"}
                  </Paragraph>
                  <div>
                    <Button
                      type={task.status === "active" ? "primary" : "default"}
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

      <Card
        title={<Space><HistoryOutlined style={{ color: "#6B7280" }} /><span>最近扫码进入</span></Space>}
        bordered={false}
        style={{ borderRadius: 20 }}
      >
        {recentTasks.length === 0 ? (
          <Empty description="最近没有扫码进入过小组任务" />
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {recentTasks.map((task) => (
              <Card
                key={`${task.kind}-${task.token}`}
                size="small"
                style={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                styles={{ body: { padding: 18 } }}
              >
                <Space direction="vertical" size={10} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color="blue">最近访问</Tag>
                    <Tag>{new Date(task.visitedAt).toLocaleString("zh-CN")}</Tag>
                  </Space>
                  <Title level={5} style={{ margin: 0 }}>{task.title}</Title>
                  <Paragraph style={{ margin: 0, color: colors.textSecondary }}>
                    {task.description || "这是你最近扫码进入过的小组任务。"}
                  </Paragraph>
                  <div>
                    <Button icon={<TeamOutlined />} onClick={() => openTask(task.token)}>
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
