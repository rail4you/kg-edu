import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Input, Spin, message, Descriptions } from "antd";
import { ArrowLeftOutlined, CheckCircleOutlined, SendOutlined } from "@ant-design/icons";
import { getTaskByToken, submitTask } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { saveStudentActivityHistory } from "@/lib/student-activity-history";
import { setCurrentTenant, getCurrentTenant } from "@/lib/tenant";
import { themeColors as colors } from "@/styles/theme";
import { ProtoCard, ProtoTag, ProtoEmpty } from "@/components/proto";

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
      <div className="pu-page" style={embedded ? undefined : { maxWidth: 760, margin: "0 auto" }}>
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
        <ProtoCard>
          <div className="pu-eyebrow">小组任务</div>
          <h2 style={{ fontSize: 24, fontWeight: 650, color: "var(--pu-ink)", margin: "4px 0 12px" }}>
            {task.title}
          </h2>
          <div className="pu-tags pu-tags--plain" style={{ marginBottom: 18 }}>
            <ProtoTag tone="green">小组任务</ProtoTag>
            <ProtoTag tone="blue">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</ProtoTag>
            {isGraded ? (
              <ProtoTag tone="green">已评分</ProtoTag>
            ) : (
              <ProtoTag tone="amber">已提交 · 待审核</ProtoTag>
            )}
          </div>
          {task.description && (
            <p style={{ color: "var(--pu-muted)", fontSize: 15, lineHeight: 1.8, marginBottom: 18 }}>
              {task.description}
            </p>
          )}

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
            <div
              style={{
                marginTop: 18,
                padding: 18,
                background: "linear-gradient(135deg, rgba(19,123,98,0.06) 0%, rgba(19,123,98,0.02) 100%)",
                border: "1px solid rgba(19,123,98,0.18)",
                borderRadius: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <CheckCircleOutlined style={{ color: "var(--pu-green)", fontSize: 18 }} />
                <span style={{ fontWeight: 650, fontSize: 15, color: "var(--pu-ink)" }}>评分结果</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: existingSubmission?.feedback ? 12 : 0 }}>
                <span style={{ fontSize: 30, fontWeight: 650, color: existingSubmission.score >= 60 ? "var(--pu-green)" : "var(--pu-red)" }}>
                  {existingSubmission.score}
                </span>
                <span style={{ color: "var(--pu-muted)", fontSize: 14 }}>/ 100</span>
              </div>
              {existingSubmission?.feedback && (
                <p style={{ margin: 0, color: "var(--pu-muted)", fontSize: 15, lineHeight: 1.75 }}>
                  教师评语：{existingSubmission.feedback}
                </p>
              )}
            </div>
          )}
        </ProtoCard>
      </div>
    );
  }

  if (!user) {
    const loginPath = embedded
      ? `/login?role=student&redirect=/dashboard/interaction/task/${token}`
      : `/login?role=student&redirect=/student/group-task/${tenantSchema}/${token}`;
    return (
      <div className="pu-page" style={embedded ? undefined : { maxWidth: 600, margin: "0 auto" }}>
        <ProtoEmpty
          title="请先登录"
          description="登录后才能参与分组任务"
          action={<Button type="primary" href={loginPath}>登录</Button>}
        />
      </div>
    );
  }

  if (!activeGroup) {
    return (
      <div className="pu-page" style={embedded ? undefined : { maxWidth: 600, margin: "0 auto" }}>
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
        <ProtoEmpty
          title="无权参与该任务"
          description="你不在该任务所分配的分组内，只有分组内学生才能参与。"
        />
      </div>
    );
  }

  return (
    <div className="pu-page" style={embedded ? undefined : { maxWidth: 760, margin: "0 auto" }}>
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
      <ProtoCard>
        <div className="pu-eyebrow">小组任务</div>
        <h2 style={{ fontSize: 24, fontWeight: 650, color: "var(--pu-ink)", margin: "4px 0 12px" }}>
          {task.title}
        </h2>
        <div className="pu-tags pu-tags--plain" style={{ marginBottom: 18 }}>
          <ProtoTag tone="green">小组任务</ProtoTag>
          <ProtoTag tone="blue">{TASK_TYPE_LABELS[task.taskType] || task.taskType}</ProtoTag>
          {task.status === "active" ? <ProtoTag tone="green">进行中</ProtoTag> : <ProtoTag tone="red">已结束</ProtoTag>}
        </div>
        {task.description && (
          <p style={{ color: "var(--pu-muted)", fontSize: 15, lineHeight: 1.8, marginBottom: 18 }}>
            {task.description}
          </p>
        )}
        <Descriptions column={1} size="small" bordered style={{ marginBottom: 18 }}>
          <Descriptions.Item label="参与分组">{activeGroup.name}</Descriptions.Item>
        </Descriptions>
        {task.status === "active" ? (
          <>
            <div style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--pu-ink)" }}>提交内容</span>
              <Input.TextArea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="输入你的回答..."
                rows={6}
                style={{ marginTop: 8 }}
              />
            </div>
            <Button type="primary" size="large" block icon={<SendOutlined />} onClick={handleSubmit} disabled={!content.trim()} style={{ height: 46, fontWeight: 600 }}>
              提交任务
            </Button>
          </>
        ) : (
          <ProtoEmpty title="任务已结束" description="该任务已关闭，无法继续提交。" />
        )}
      </ProtoCard>
    </div>
  );
}
