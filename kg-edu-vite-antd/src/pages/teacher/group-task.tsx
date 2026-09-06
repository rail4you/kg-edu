import * as React from "react"
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Table, Button, Typography, Tag, Modal, Input, Space, message, Popconfirm, Select, DatePicker, Row, Col, QRCode, Progress, Tooltip, Descriptions, InputNumber, Empty, Divider,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined, SendOutlined, StopOutlined, QrcodeOutlined, DeleteOutlined, FileTextOutlined, EyeOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getTasksByCourse, createTask, publishTask, closeTask, deleteTask, getGroupsByCourse, getSubmissionsByTask, gradeSubmission } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

const TASK_TYPE_LABELS: Record<string, string> = { submission: "提交任务", discussion: "讨论任务", survey: "投票调查", file_upload: "文件上传" };
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" }, active: { color: "green", label: "进行中" }, closed: { color: "red", label: "已结束" },
};
const SUBMISSION_STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: "default", label: "待提交" }, submitted: { color: "blue", label: "已提交" }, graded: { color: "green", label: "已评分" },
};

function getErrorMessage(result: unknown, fallback: string) {
  const errors = (result as { errors?: Array<{ message?: string }> })?.errors;
  return errors?.[0]?.message || fallback;
}

interface TaskGroup {
  id: string;
  name: string;
  members?: Array<{ id: string; name?: string }>;
}

interface SubmissionRecord {
  id: string;
  content: string | null;
  fileUrl: string | null;
  status: "pending" | "submitted" | "graded";
  score: number | null;
  feedback: string | null;
  submittedAt: string | null;
  taskId: string;
  groupId: string;
  studentId: string;
  student?: { id: string; name: string | null };
  group?: { id: string; name: string };
}

interface GroupWithMembers {
  id: string;
  name: string;
  members: Array<{ id: string; name?: string }>;
}

export default function GroupTaskPage() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [formData, setFormData] = useState({ title: "", description: "", taskType: "submission", dueDate: null as string | null, groupId: null as string | null });

  // Submission detail dialog state
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressTask, setProgressTask] = useState<any>(null);
  const [gradeDialogOpen, setGradeDialogOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionRecord | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: null as number | null, feedback: "" });

  const headers = getAuthHeaders(user) as Record<string, string>;
  const { courses } = useCourses();

  // ── Task list query ──
  const { data: tasksResult, isLoading } = useQuery({
    queryKey: ["group-tasks", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant) return [];
      const result = await getTasksByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: ["id", "title", "description", "taskType", "status", "token", "dueDate", "publishAt", "courseId", "createdById",
          { groups: ["id", "name", { members: ["id", "name"] }] },
          { submissions: ["id", "status", "studentId", "groupId", "score", "submittedAt"] },
        ],
        headers,
      } as any);
      if (!result.success) throw new Error(getErrorMessage(result, "加载分组任务失败"));
      return result;
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  // ── Groups query ──
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["task-groups", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant) return [];
      const result = await getGroupsByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: ["id", "name", { members: ["id", "name"] }],
        headers,
      } as any);
      if (!result.success) throw new Error(getErrorMessage(result, "加载分组列表失败"));
      const data = (result as any).data;
      return (Array.isArray(data) ? data : data?.results || data?.data || []) as GroupWithMembers[];
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const tasks: any[] = (tasksResult as any)?.success ? ((tasksResult as any).data?.results || (tasksResult as any).data || []) : [];

  // ── Submissions detail query (for progress dialog) ──
  const { data: submissionsResult, isLoading: submissionsLoading } = useQuery({
    queryKey: ["task-submissions", progressTask?.id, tenant],
    queryFn: async () => {
      if (!progressTask?.id || !tenant) return [];
      const result = await getSubmissionsByTask({
        tenant,
        input: { taskId: progressTask.id },
        fields: ["id", "content", "fileUrl", "status", "score", "feedback", "submittedAt", "taskId", "groupId", "studentId",
          { student: ["id", "name"] },
          { group: ["id", "name"] },
        ],
        headers,
      } as any);
      if (!result.success) throw new Error(getErrorMessage(result, "加载提交数据失败"));
      const data = (result as any).data;
      return (Array.isArray(data) ? data : data?.results || []) as SubmissionRecord[];
    },
    enabled: !!progressTask?.id && !!tenant && progressDialogOpen,
  });

  const submissions: SubmissionRecord[] = Array.isArray(submissionsResult) ? submissionsResult : [];

  // ── Compute progress stats for each task in the list ──
  function getTaskProgress(task: any) {
    const taskGroups: GroupWithMembers[] = task.groups || [];
    const taskSubs: any[] = task.submissions || [];
    // Count unique submitted/graded student IDs
    const submittedIds = new Set(taskSubs.filter((s: any) => s.status === "submitted" || s.status === "graded").map((s: any) => s.studentId));
    // Total members across all assigned groups
    let totalMembers = 0;
    for (const g of taskGroups) {
      totalMembers += g.members?.length || 0;
    }
    const submittedCount = submittedIds.size;
    const gradedCount = taskSubs.filter((s: any) => s.status === "graded").length;
    return { totalMembers, submittedCount, gradedCount };
  }

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!tenant || !selectedCourseId) throw new Error("Missing");
      if (!formData.title.trim()) throw new Error("请输入任务标题");
      if (!formData.groupId) throw new Error("请选择要分配的小组");
      const result = await createTask({
        tenant,
        input: {
          title: formData.title.trim(),
          description: formData.description?.trim() || null,
          taskType: formData.taskType as any,
          dueDate: formData.dueDate || null,
          courseId: selectedCourseId,
          groupIds: [formData.groupId],
          createdById: user?.id,
        },
        fields: ["id"],
        headers,
      });
      if (!result.success) throw new Error(getErrorMessage(result, "创建任务失败"));
      return result;
    },
    onSuccess: () => {
      message.success("任务已创建");
      queryClient.invalidateQueries({ queryKey: ["group-tasks"] });
      setDialogOpen(false);
      setFormData({ title: "", description: "", taskType: "submission", dueDate: null, groupId: null });
    },
    onError: (error: Error) => message.error(error.message || "创建任务失败"),
  });

  const publishMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!tenant) throw new Error("缺少租户信息");
      const result = await publishTask({ tenant, primaryKey: taskId, fields: ["id", "token"] as any, headers });
      if (!result.success) throw new Error(getErrorMessage(result, "发布任务失败"));
      return result;
    },
    onSuccess: (result: any) => {
      message.success("任务已发布");
      queryClient.invalidateQueries({ queryKey: ["group-tasks"] });
      if (result?.data?.token) { setSelectedTask(result.data); setQrDialogOpen(true); }
    },
    onError: (error: Error) => message.error(error.message || "发布任务失败"),
  });

  const closeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      if (!tenant) throw new Error("缺少租户信息");
      const result = await closeTask({ tenant, primaryKey: taskId, fields: ["id"] as any, headers });
      if (!result.success) throw new Error(getErrorMessage(result, "关闭任务失败"));
      return result;
    },
    onSuccess: () => { message.success("已关闭"); queryClient.invalidateQueries({ queryKey: ["group-tasks"] }); },
    onError: (error: Error) => message.error(error.message || "关闭任务失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!tenant) throw new Error("缺少租户信息");
      const result = await deleteTask({ tenant, primaryKey: id, headers });
      if (!result.success) throw new Error(getErrorMessage(result, "删除任务失败"));
      return result;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["group-tasks"] }); },
    onError: (error: Error) => message.error(error.message || "删除任务失败"),
  });

  const gradeMutation = useMutation({
    mutationFn: async () => {
      if (!tenant || !gradingSubmission) throw new Error("Missing");
      const result = await gradeSubmission({
        tenant,
        primaryKey: gradingSubmission.id,
        input: { score: gradeForm.score, feedback: gradeForm.feedback || null },
        fields: ["id", "score", "feedback", "status"],
        headers,
      });
      if (!result.success) throw new Error(getErrorMessage(result, "评分失败"));
      return result;
    },
    onSuccess: () => {
      message.success("评分成功");
      queryClient.invalidateQueries({ queryKey: ["task-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["group-tasks"] });
      setGradeDialogOpen(false);
      setGradingSubmission(null);
      setGradeForm({ score: null, feedback: "" });
    },
    onError: (error: Error) => message.error(error.message || "评分失败"),
  });

  const getQrUrl = (token: string) => `${window.location.origin}/student/group-task/${tenant}/${token}`;

  // ── Open progress dialog ──
  const openProgress = (task: any) => {
    setProgressTask(task);
    setProgressDialogOpen(true);
  };

  // ── Build submission lookup for progress dialog ──
  const submissionByStudent = useMemo(() => {
    const map = new Map<string, SubmissionRecord>();
    for (const s of submissions) {
      map.set(s.studentId, s);
    }
    return map;
  }, [submissions]);

  // ── Grouped submissions for progress dialog ──
  const progressGroups = useMemo(() => {
    if (!progressTask?.groups) return [];
    return (progressTask.groups as GroupWithMembers[]).map((g) => {
      const members = g.members || [];
      const memberSubmissions = members.map((m) => ({
        ...m,
        submission: submissionByStudent.get(m.id) || null,
      }));
      const submitted = memberSubmissions.filter((ms) => ms.submission && ms.submission.status !== "pending").length;
      const graded = memberSubmissions.filter((ms) => ms.submission?.status === "graded").length;
      return { ...g, memberSubmissions, total: members.length, submitted, graded };
    });
  }, [progressTask, submissionByStudent]);

  // ── Task table columns ──
  const columns: TableColumnsType<any> = [
    { title: "任务标题", dataIndex: "title", key: "title", width: 180, ellipsis: true },
    {
      title: "分配分组", key: "groups", width: 150,
      render: (_: unknown, record: any) => {
        const taskGroups = record.groups || [];
        if (taskGroups.length === 0) return <Tag>未分配</Tag>;
        return taskGroups.map((group: TaskGroup) => <Tag key={group.id} color="blue">{group.name}</Tag>);
      },
    },
    { title: "类型", dataIndex: "taskType", key: "taskType", width: 100, render: (t: string) => <Tag>{TASK_TYPE_LABELS[t] || t}</Tag> },
    { title: "状态", dataIndex: "status", key: "status", width: 90, render: (s: string) => { const c = STATUS_CONFIG[s] || { color: "default", label: s }; return <Tag color={c.color}>{c.label}</Tag>; } },
    {
      title: "完成进度", key: "progress", width: 180,
      render: (_: unknown, record: any) => {
        const { totalMembers, submittedCount, gradedCount } = getTaskProgress(record);
        if (totalMembers === 0) return <Text type="secondary">暂无成员</Text>;
        const percent = Math.round((submittedCount / totalMembers) * 100);
        return (
          <Tooltip title={`已提交 ${submittedCount}/${totalMembers}，已评分 ${gradedCount}`}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Progress percent={percent} size="small" style={{ width: 100, marginBottom: 0 }} />
              <Text style={{ fontSize: 12, whiteSpace: "nowrap" }}>{submittedCount}/{totalMembers}</Text>
            </div>
          </Tooltip>
        );
      },
    },
    { title: "操作", key: "actions", width: 240,
      render: (_: unknown, record: any) => (
        <Space>
          {(record.status === "active" || record.status === "closed") && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => openProgress(record)}>查看进度</Button>
          )}
          {record.status === "draft" && <ReadonlyActionButton size="small" type="primary" icon={<SendOutlined />} onClick={() => publishMutation.mutate(record.id)}>发布</ReadonlyActionButton>}
          {record.status === "active" && (
            <>
              <Button size="small" icon={<QrcodeOutlined />} onClick={() => { setSelectedTask(record); setQrDialogOpen(true); }} />
              <ReadonlyActionButton size="small" danger icon={<StopOutlined />} onClick={() => closeMutation.mutate(record.id)}>关闭</ReadonlyActionButton>
            </>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="group-task-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.group-task-wrap{padding:12px!important}.group-task-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}><FileTextOutlined /> 分组任务</Title></Col>
          <Col><Space>
            <Select style={{ width: 240 }} placeholder="选择课程" value={selectedCourseId} onChange={setSelectedCourseId} options={courses?.map((c: any) => ({ label: c.title, value: c.id })) || []} />
            <Button type="primary" icon={<PlusOutlined />} disabled={!selectedCourseId} style={canEdit ? undefined : { display: "none" }} onClick={() => { setFormData({ title: "", description: "", taskType: "submission", dueDate: null, groupId: null }); setDialogOpen(true); }}>创建任务</Button>
          </Space></Col>
        </Row>
        <Table columns={columns} dataSource={tasks} rowKey="id" loading={isLoading} locale={{ emptyText: selectedCourseId ? "暂无任务" : "请先选择课程" }} />
      </Card>

      {/* ── Create task dialog ── */}
      <Modal title="创建分组任务" open={dialogOpen} onCancel={() => setDialogOpen(false)} onOk={() => createMutation.mutate()} confirmLoading={createMutation.isPending}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>任务标题 *</Text><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
          <div>
            <Text>分配分组 *</Text>
            <Select
              style={{ width: "100%", marginTop: 8 }}
              placeholder="选择一个分组"
              value={formData.groupId}
              loading={groupsLoading}
              onChange={(groupId) => setFormData({ ...formData, groupId })}
              options={groups.map((group) => ({
                value: group.id,
                label: `${group.name}${group.members?.length ? ` (${group.members.length}人)` : ""}`,
              }))}
            />
          </div>
          <div><Text>任务类型</Text><Select style={{ width: "100%" }} value={formData.taskType} onChange={v => setFormData({ ...formData, taskType: v })} options={Object.entries(TASK_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))} /></div>
          <div><Text>描述</Text><TextArea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={4} /></div>
        </Space>
      </Modal>

      {/* ── QR code dialog ── */}
      <Modal title="任务二维码" open={qrDialogOpen} onCancel={() => setQrDialogOpen(false)} footer={null} width={400}>
        {selectedTask?.token && (
          <div style={{ textAlign: "center" }}>
            <QRCode value={getQrUrl(selectedTask.token)} size={256} />
            <div style={{ marginTop: 16 }}><Text copyable={{ text: getQrUrl(selectedTask.token) }}>{getQrUrl(selectedTask.token)}</Text></div>
            <div style={{ marginTop: 8 }}><Text type="secondary">学生扫描二维码即可参与任务</Text></div>
          </div>
        )}
      </Modal>

      {/* ── Progress / Submissions dialog ── */}
      <Modal
        title={progressTask ? `任务进度 - ${progressTask.title}` : "任务进度"}
        open={progressDialogOpen}
        onCancel={() => { setProgressDialogOpen(false); setProgressTask(null); }}
        footer={null}
        width={800}
      >
        {submissionsLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Text>加载中...</Text></div>
        ) : (
          <>
            {/* Overall stats */}
            {progressTask && (() => {
              const { totalMembers, submittedCount, gradedCount } = getTaskProgress(progressTask);
              const percent = totalMembers > 0 ? Math.round((submittedCount / totalMembers) * 100) : 0;
              return (
                <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
                  <Row gutter={24}>
                    <Col span={6}><div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 600 }}>{totalMembers}</div><Text type="secondary">总人数</Text></div></Col>
                    <Col span={6}><div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 600, color: "#1890ff" }}>{submittedCount}</div><Text type="secondary">已提交</Text></div></Col>
                    <Col span={6}><div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 600, color: "#52c41a" }}>{gradedCount}</div><Text type="secondary">已评分</Text></div></Col>
                    <Col span={6}><div style={{ textAlign: "center" }}><div style={{ fontSize: 24, fontWeight: 600, color: "#faad14" }}>{totalMembers - submittedCount}</div><Text type="secondary">未提交</Text></div></Col>
                  </Row>
                  <div style={{ marginTop: 12 }}><Progress percent={percent} strokeColor="#1890ff" /></div>
                </Card>
              );
            })()}

            {/* Per-group breakdown */}
            {progressGroups.map((g) => {
              const groupPercent = g.total > 0 ? Math.round((g.submitted / g.total) * 100) : 0;
              return (
                <Card key={g.id} size="small" title={<Space><Text strong>{g.name}</Text><Tag>{g.submitted}/{g.total} 已提交</Tag><Tag color="green">{g.graded}/{g.total} 已评分</Tag></Space>} style={{ marginBottom: 12 }}>
                  <Progress percent={groupPercent} size="small" style={{ marginBottom: 12 }} />
                  <Table
                    size="small"
                    pagination={false}
                    rowKey="id"
                    dataSource={g.memberSubmissions}
                    columns={[
                      {
                        title: "学生", key: "name", width: 120,
                        render: (_: unknown, m: any) => <Text>{m.name || m.id.slice(0, 8)}</Text>,
                      },
                      {
                        title: "提交状态", key: "status", width: 100,
                        render: (_: unknown, m: any) => {
                          if (!m.submission) return <Tag color="default"><ClockCircleOutlined /> 待提交</Tag>;
                          const cfg = SUBMISSION_STATUS_CONFIG[m.submission.status] || { color: "default", label: m.submission.status };
                          const icon = m.submission.status === "graded" ? <CheckCircleOutlined /> : m.submission.status === "submitted" ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />;
                          return <Tag color={cfg.color}>{icon} {cfg.label}</Tag>;
                        },
                      },
                      {
                        title: "提交内容", key: "content", ellipsis: true,
                        render: (_: unknown, m: any) => {
                          if (!m.submission || !m.submission.content) return <Text type="secondary">-</Text>;
                          return <Tooltip title={m.submission.content}><Text ellipsis style={{ maxWidth: 200, display: "inline-block" }}>{m.submission.content}</Text></Tooltip>;
                        },
                      },
                      {
                        title: "提交时间", key: "submittedAt", width: 140,
                        render: (_: unknown, m: any) => m.submission?.submittedAt ? new Date(m.submission.submittedAt).toLocaleString() : <Text type="secondary">-</Text>,
                      },
                      {
                        title: "分数", key: "score", width: 70,
                        render: (_: unknown, m: any) => m.submission?.score != null ? <Text strong style={{ color: "#52c41a" }}>{m.submission.score}</Text> : <Text type="secondary">-</Text>,
                      },
                      {
                        title: "评语", key: "feedback", ellipsis: true,
                        render: (_: unknown, m: any) => m.submission?.feedback ? <Tooltip title={m.submission.feedback}><Text ellipsis>{m.submission.feedback}</Text></Tooltip> : <Text type="secondary">-</Text>,
                      },
                      {
                        title: "操作", key: "action", width: 100,
                        render: (_: unknown, m: any) => {
                          if (!m.submission || m.submission.status === "graded") {
                            if (m.submission?.status === "graded") {
                              return <ReadonlyActionButton size="small" onClick={() => {
                                setGradingSubmission(m.submission);
                                setGradeForm({ score: m.submission.score, feedback: m.submission.feedback || "" });
                                setGradeDialogOpen(true);
                              }}>修改评分</ReadonlyActionButton>;
                            }
                            return <Text type="secondary">-</Text>;
                          }
                          return <ReadonlyActionButton size="small" type="primary" onClick={() => {
                            setGradingSubmission(m.submission);
                            setGradeForm({ score: null, feedback: "" });
                            setGradeDialogOpen(true);
                          }}>评分</ReadonlyActionButton>;
                        },
                      },
                    ]}
                  />
                </Card>
              );
            })}

            {progressGroups.length === 0 && (
              <Empty description="暂无分组数据" />
            )}
          </>
        )}
      </Modal>

      {/* ── Grade dialog ── */}
      <Modal
        title={`评分 - ${gradingSubmission?.student?.name || "学生"}`}
        open={gradeDialogOpen}
        onCancel={() => { setGradeDialogOpen(false); setGradingSubmission(null); }}
        onOk={() => gradeMutation.mutate()}
        confirmLoading={gradeMutation.isPending}
        okText="提交评分"
      >
        {gradingSubmission && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="提交内容">{gradingSubmission.content || "-"}</Descriptions.Item>
              {gradingSubmission.fileUrl && <Descriptions.Item label="附件"><a href={gradingSubmission.fileUrl} target="_blank">查看文件</a></Descriptions.Item>}
              <Descriptions.Item label="提交时间">{gradingSubmission.submittedAt ? new Date(gradingSubmission.submittedAt).toLocaleString() : "-"}</Descriptions.Item>
            </Descriptions>
            <Divider />
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text>分数</Text>
                <InputNumber style={{ width: "100%", marginTop: 4 }} min={0} max={100} precision={1} placeholder="请输入分数 (0-100)" value={gradeForm.score} onChange={(v) => setGradeForm({ ...gradeForm, score: v })} />
              </div>
              <div>
                <Text>评语</Text>
                <TextArea style={{ marginTop: 4 }} rows={3} placeholder="请输入评语（可选）" value={gradeForm.feedback} onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })} />
              </div>
            </Space>
          </>
        )}
      </Modal>
    </div>
  );
}
