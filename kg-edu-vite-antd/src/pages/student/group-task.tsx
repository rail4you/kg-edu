import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, Typography, Button, Input, Spin, Result, Space, message, Tag, Descriptions } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, DeploymentUnitOutlined, SendOutlined } from "@ant-design/icons";
import { getTaskByToken, submitTask } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { saveStudentActivityHistory } from "@/lib/student-activity-history";
import { setCurrentTenant, getCurrentTenant } from "@/lib/tenant";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TASK_TYPE_LABELS: Record<string, string> = { submission: "提交任务", discussion: "讨论任务", survey: "投票调查", file_upload: "文件上传" };

interface StudentGroupTaskProps {
  embedded?: boolean;
}

export default function StudentGroupTask({ embedded }: StudentGroupTaskProps) {
  // In embedded mode, route is /dashboard/interaction/task/:token
  // In standalone mode, route is /student/group-task/:tenantSchema/:token
  const params = useParams<{ tenantSchema?: string; token?: string }>();
  const navigate = useNavigate();
  const currentTenant = getCurrentTenant();

  const tenantSchema = embedded
    ? (currentTenant?.schemaName || "")
    : (params.tenantSchema || window.location.pathname.split("/")[3] || "");
  const token = embedded
    ? (params.token || "")
    : (params.token || window.location.pathname.split("/")[4] || "");

  const { user, loading: authLoading } = useAuth();
  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [content, setContent] = useState("");

  useEffect(() => { if (token && tenantSchema) fetchTask(); else setLoading(false); }, [token, tenantSchema, user]);

  useEffect(() => {
    if (!tenantSchema || !task) {
      return;
    }

    setCurrentTenant({
      id: tenantSchema,
      name: tenantSchema,
      schemaName: tenantSchema,
    });

    if (task.courseId) {
      localStorage.setItem("selectedCourse", task.courseId);
    }

    saveStudentActivityHistory({
      kind: "group_task",
      tenantSchema,
      courseId: task.courseId,
      token: task.token,
      title: task.title,
      description: task.description,
      status: task.status,
      visitedAt: new Date().toISOString(),
    });
  }, [tenantSchema, task]);

  const fetchTask = async () => {
    try {
      const result = await getTaskByToken({
        tenant: tenantSchema,
        input: { token },
        fields: ["id", "title", "description", "taskType", "status", "dueDate", "token", "courseId", { groups: ["id", "name", { members: ["id", "name"] }] }, { submissions: ["id", "status", "studentId", "content", "score", "feedback", "submittedAt"] }],
        headers: user ? getAuthHeaders(user) as Record<string, string> : undefined,
      } as any);
      if (result.success) setTask(result.data);
    } catch { message.error("获取任务失败"); }
    finally { setLoading(false); }
  };

  const activeGroup = useMemo(() => {
    if (!task || !user) return null;
    const groups = task.groups || [];
    return groups.find((group: any) => (group.members || []).some((member: any) => member.id === user.id)) || null;
  }, [task, user]);

  // Check if current user already has a submitted/graded submission
  const existingSubmission = useMemo(() => {
    if (!task || !user) return null;
    const subs = task.submissions || [];
    // Prefer graded submission over submitted
    const graded = subs.find((s: any) => s.studentId === user.id && s.status === "graded");
    if (graded) return graded;
    return subs.find((s: any) => s.studentId === user.id && s.status === "submitted") || null;
  }, [task, user]);

  const handleSubmit = async () => {
    if (!task || !tenantSchema || !user || !activeGroup) return;
    try {
      const result = await submitTask({
        tenant: tenantSchema,
        input: { taskId: task.id, groupId: activeGroup.id, studentId: user.id, content },
        fields: ["id"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) { setSubmitted(true); message.success("提交成功！"); }
      else message.error((result as any).errors?.[0]?.message || "提交失败");
    } catch { message.error("提交失败"); }
  };

  const handleBack = () => {
    navigate("/dashboard/interaction#group-tasks");
  };

  if (loading || authLoading) return <div style={{ display: "flex", justifyContent: "center", padding: 100 }}><Spin size="large" /></div>;
  if (!token || !tenantSchema) return <Result status="error" title="无效的任务链接" />;
  if (!task) return <Result status="404" title="任务不存在或已过期" />;

  // Show submitted state if local state OR existing submission found
  const hasSubmitted = submitted || !!existingSubmission;

  if (hasSubmitted) {
    const isGraded = existingSubmission?.status === "graded";
    return (
      <div style={{ maxWidth: embedded ? "100%" : 700, margin: embedded ? 0 : "40px auto", padding: embedded ? 0 : 24 }}>
        {embedded && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ marginBottom: 16, color: colors.primary }}
          >
            返回任务列表
          </Button>
        )}
        <Card style={{ borderRadius: 20 }}>
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            <div>
              <Space style={{ marginBottom: 8 }}>
                <Tag color="green" style={{ margin: 0 }}>
                  <DeploymentUnitOutlined /> 小组任务
                </Tag>
              </Space>
              <Title level={3} style={{ margin: "8px 0 0" }}>{task.title}</Title>
              <Space style={{ marginTop: 8 }}>
                <Tag>{TASK_TYPE_LABELS[task.taskType] || task.taskType}</Tag>
                {isGraded ? (
                  <Tag color="green" icon={<CheckCircleOutlined />}>已评分</Tag>
                ) : (
                  <Tag color="blue">已提交 · 待审核</Tag>
                )}
              </Space>
            </div>
            {task.description && <Paragraph>{task.description}</Paragraph>}

            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="参与分组">{activeGroup?.name || "-"}</Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {existingSubmission?.submittedAt
                  ? new Date(existingSubmission.submittedAt).toLocaleString("zh-CN")
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="提交内容">
                {existingSubmission?.content || "（无文字内容）"}
              </Descriptions.Item>
            </Descriptions>

            {isGraded && (
              <Card
                size="small"
                style={{
                  background: "linear-gradient(135deg, rgba(82,196,26,0.06) 0%, rgba(82,196,26,0.02) 100%)",
                  border: "1px solid rgba(82,196,26,0.2)",
                  borderRadius: 16,
                }}
              >
                <Space direction="vertical" style={{ width: "100%" }} size="middle">
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 18 }} />
                    <Text strong style={{ fontSize: 16 }}>评分结果</Text>
                  </div>
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="得分">
                      <Text strong style={{ fontSize: 24, color: existingSubmission.score >= 60 ? "#52c41a" : "#ff4d4f" }}>
                        {existingSubmission.score}
                      </Text>
                      <Text type="secondary"> / 100</Text>
                    </Descriptions.Item>
                    {existingSubmission?.feedback && (
                      <Descriptions.Item label="教师评语">
                        <Text>{existingSubmission.feedback}</Text>
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Space>
              </Card>
            )}
          </Space>
        </Card>
      </div>
    );
  }

  if (!user) {
    const loginPath = embedded
      ? `/login?role=student&redirect=/dashboard/interaction/task/${token}`
      : `/login?role=student&redirect=/student/group-task/${tenantSchema}/${token}`;
    return (
      <div style={{ maxWidth: embedded ? "100%" : 600, margin: embedded ? 0 : "40px auto", padding: embedded ? 0 : 24 }}>
        <Result
          status="info"
          title="请先登录"
          subTitle="登录后才能参与分组任务"
          extra={<Button type="primary" href={loginPath}>登录</Button>}
        />
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div style={{ maxWidth: embedded ? "100%" : 600, margin: embedded ? 0 : "40px auto", padding: embedded ? 0 : 24 }}>
        {embedded && (
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={handleBack}
            style={{ marginBottom: 16, color: colors.primary }}
          >
            返回任务列表
          </Button>
        )}
        <Result
          status="403"
          title="无权参与该任务"
          subTitle="你不在该任务所分配的分组内，只有分组内学生才能参与。"
        />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: embedded ? "100%" : 700, margin: embedded ? 0 : "40px auto", padding: embedded ? 0 : 24 }}>
      {embedded && (
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          style={{ marginBottom: 16, color: colors.primary, padding: "4px 0" }}
        >
          返回任务列表
        </Button>
      )}
      <Card style={{ borderRadius: 20 }}>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Tag color="green" style={{ margin: 0 }}>
                <DeploymentUnitOutlined /> 小组任务
              </Tag>
            </Space>
            <Title level={3} style={{ margin: "8px 0 0" }}>{task.title}</Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color="blue">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</Tag>
              {task.status === "active" ? <Tag color="green" icon={<CheckCircleOutlined />}>进行中</Tag> : <Tag color="red">已结束</Tag>}
            </Space>
          </div>
          {task.description && <Paragraph>{task.description}</Paragraph>}
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="参与分组">{activeGroup.name}</Descriptions.Item>
          </Descriptions>
          {task.status === "active" ? (
            <>
              <div><Text>提交内容</Text><TextArea value={content} onChange={e => setContent(e.target.value)} placeholder="输入你的回答..." rows={6} style={{ marginTop: 8 }} /></div>
              <Button type="primary" size="large" block icon={<SendOutlined />} onClick={handleSubmit} disabled={!content.trim()}>提交任务</Button>
            </>
          ) : <Result status="warning" title="任务已结束" subTitle="该任务已关闭，无法继续提交。" />}
        </Space>
      </Card>
    </div>
  );
}
