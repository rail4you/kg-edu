import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Skeleton,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import {
  listCourses,
  getTasksByCourse,
  listDiscussionSessions,
  listDiscussions,
  listFaceChecksByUser,
  listSubmissions,
  listRepliesByDiscussion,
  createDiscussion,
} from "@/lib/ash_rpc";
import type { UUID } from "@/lib/ash_rpc";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { PageHead, ProtoCard, ProtoTag, ProtoTabs } from "@/components/proto";

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

interface DiscussionItem {
  id: string;
  title: string;
  content: string;
  insertedAt: string;
  replyCount: number;
  discussionSessionId?: string | null;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
}

interface FaceCheckItem {
  id: string;
  courseId?: string | null;
  result?: string | null;
}

interface ReplyItem {
  id: string;
  content: string;
  insertedAt: string;
  user?: { id?: string; name?: string | null; email?: string | null } | null;
}

type TabKey = "activities" | "discussions" | "homeworks";

const displayName = (u?: { name?: string | null; email?: string | null } | null) =>
  u?.name || u?.email?.split("@")[0] || "同学";

const formatTime = (v?: string | null) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function StudentInteractionHubPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const tenantFromQuery = searchParams.get("tenant") || "";
  const tenant = tenantFromQuery || currentTenant?.schemaName || "";
  const selectedCourseId =
    searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";

  const [activeTab, setActiveTab] = useState<TabKey>("activities");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishTitle, setPublishTitle] = useState("");
  const [publishContent, setPublishContent] = useState("");
  const [replyDiscussion, setReplyDiscussion] = useState<DiscussionItem | null>(null);
  const [localSigned, setLocalSigned] = useState(false);

  useEffect(() => {
    if (tenantFromQuery) {
      setCurrentTenant({ id: tenantFromQuery, name: tenantFromQuery, schemaName: tenantFromQuery });
    }
  }, [tenantFromQuery]);

  useEffect(() => {
    if (selectedCourseId) localStorage.setItem("selectedCourse", selectedCourseId);
  }, [selectedCourseId]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // ── Course info ──
  const { data: courseResult } = useQuery({
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
  const { data: tasksResult, isLoading: tasksLoading, error: tasksError } = useQuery({
    queryKey: ["student-group-tasks", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await getTasksByCourse({
        tenant,
        input: { courseId: selectedCourseId as UUID },
        fields: ["id", "title", "description", "taskType", "status", "token", "dueDate", "publishAt", "courseId"],
        headers: user ? getHeaders(user) : undefined,
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || "加载小组任务失败");
      return extractArrayData(result) as GroupTaskItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  // ── Discussion sessions ──
  const { data: sessionsResult, isLoading: sessionsLoading, error: sessionsError } = useQuery({
    queryKey: ["student-discussion-sessions", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await listDiscussionSessions({
        tenant,
        fields: ["id", "title", "description", "courseId", "token", "status", "startedAt", "endedAt"],
        filter: { courseId: { eq: selectedCourseId } },
        sort: "-startedAt",
        headers: user ? getHeaders(user) : undefined,
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || "加载课堂讨论失败");
      return extractArrayData(result) as DiscussionSessionItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  // ── Course discussions (posts) ──
  const { data: discussionsResult, isLoading: discussionsLoading } = useQuery({
    queryKey: ["student-course-discussions", tenant, selectedCourseId],
    queryFn: async () => {
      const result = await listDiscussions({
        tenant,
        fields: ["id", "title", "content", "status", "replyCount", "insertedAt", "discussionSessionId", { user: ["id", "name", "email"] }],
        filter: { courseId: { eq: selectedCourseId }, status: { eq: "active" } },
        sort: "-insertedAt",
        headers: user ? getHeaders(user) : undefined,
      });
      return extractArrayData(result) as DiscussionItem[];
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  // ── Face checks (课堂签到) ──
  const { data: faceChecks } = useQuery({
    queryKey: ["student-facechecks", tenant, selectedCourseId, user?.id],
    queryFn: async () => {
      const result = await listFaceChecksByUser({
        tenant,
        input: { userId: user!.id },
        fields: ["id", "courseId", "result"],
        headers: getHeaders(user),
      });
      return extractArrayData(result) as FaceCheckItem[];
    },
    enabled: !!tenant && !!user?.id,
  });

  // ── Task submissions (作业完成状态) ──
  const { data: submissions } = useQuery({
    queryKey: ["student-task-submissions", tenant, user?.id],
    queryFn: async () => {
      const result = await listSubmissions({
        tenant,
        fields: ["id", "taskId", "studentId", "status"],
        filter: { studentId: { eq: user!.id } },
        headers: getHeaders(user),
      });
      return extractArrayData(result) as { taskId: string; status: string }[];
    },
    enabled: !!tenant && !!user?.id,
  });

  // ── Replies for selected discussion ──
  const { data: replies, isLoading: repliesLoading } = useQuery({
    queryKey: ["student-discussion-replies", tenant, replyDiscussion?.id],
    queryFn: async () => {
      const result = await listRepliesByDiscussion({
        tenant,
        input: { discussionId: replyDiscussion!.id },
        fields: ["id", "content", "insertedAt", { user: ["id", "name", "email"] }],
        headers: user ? getHeaders(user) : undefined,
      });
      return extractArrayData(result) as ReplyItem[];
    },
    enabled: !!tenant && !!replyDiscussion?.id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const result = await createDiscussion({
        tenant,
        input: {
          title: publishTitle.trim() || "课堂讨论",
          content: publishContent.trim(),
          courseId: selectedCourseId,
          userId: user?.id,
        },
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || "发布失败");
      return result;
    },
    onSuccess: () => {
      message.success("讨论已发布");
      setPublishOpen(false);
      setPublishTitle("");
      setPublishContent("");
      queryClient.invalidateQueries({ queryKey: ["student-course-discussions", tenant, selectedCourseId] });
    },
    onError: (err: Error) => message.error(err?.message || "发布失败"),
  });

  const visibleTasks = useMemo(
    () => (tasksResult || []).filter((item) => item.status !== "draft" && item.token),
    [tasksResult]
  );
  const activeTasks = useMemo(() => visibleTasks.filter((item) => item.status === "active"), [visibleTasks]);
  const activeSessions = useMemo(
    () => (sessionsResult || []).filter((item) => item.token && item.status === "active"),
    [sessionsResult]
  );

  const submissionsByTask = useMemo(() => {
    const map = new Map<string, string>();
    (submissions || []).forEach((s) => map.set(s.taskId, s.status));
    return map;
  }, [submissions]);

  const checkedIn = useMemo(
    () => (faceChecks || []).some((f) => f.courseId === selectedCourseId && f.result === "pass"),
    [faceChecks, selectedCourseId]
  );

  const openTask = (token: string) => navigate(`/dashboard/interaction/task/${token}`);
  const openDiscussion = (token: string) => navigate(`/dashboard/interaction/discussion/${token}`);

  if (authLoading) {
    return (
      <div style={{ padding: 40 }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (!user) {
    return <Alert type="info" message="请先登录" description="登录后可查看课堂互动。" style={{ margin: 24 }} />;
  }

  if (!tenant) {
    return <Alert type="warning" message="未选择组织" description="请先从课程主页进入。" style={{ margin: 24 }} />;
  }

  if (!selectedCourseId) {
    return <Alert type="warning" message="未选择课程" description="请先进入课程，再查看课堂互动。" style={{ margin: 24 }} />;
  }

  const tabs = [
    { id: "activities" as TabKey, label: "课堂活动" },
    { id: "discussions" as TabKey, label: "课程讨论" },
    { id: "homeworks" as TabKey, label: "我的作业" },
  ];

  const signed = checkedIn || localSigned;

  const activityCards = [
    {
      key: "checkin",
      icon: <CheckCircleOutlined />,
      title: "课堂签到",
      desc: courseResult?.title || "当前课程",
      actionLabel: signed ? "已签到" : "立即签到",
      disabled: signed,
      onClick: () => {
        setLocalSigned(true);
        message.success("签到成功");
      },
    },
    {
      key: "task",
      icon: <TeamOutlined />,
      title: "小组任务",
      desc: activeTasks[0]?.title || "暂无进行中的任务",
      actionLabel: "查看任务",
      disabled: false,
      onClick: () => {
        if (activeTasks[0]?.token) openTask(activeTasks[0].token);
        else handleTabChange("homeworks");
      },
    },
    {
      key: "discussion",
      icon: <FileTextOutlined />,
      title: "随堂讨论",
      desc: activeSessions[0]?.title || "暂无进行中的讨论",
      actionLabel: "参与讨论",
      disabled: false,
      onClick: () => {
        if (activeSessions[0]?.token) openDiscussion(activeSessions[0].token);
        else handleTabChange("discussions");
      },
    },
  ];

  return (
    <div className="pu-page">
      <PageHead
        title="互动课堂"
        description="参与课堂活动，记录思考，与老师和同学一起交流。"
        actions={
          <Button type="primary" onClick={() => setPublishOpen(true)}>
            发布讨论
          </Button>
        }
      />

      <ProtoTabs items={tabs} active={activeTab} onChange={handleTabChange} />

      {/* ── 课堂活动 ── */}
      {activeTab === "activities" && (
        <div className="pu-grid pu-grid--three">
          {activityCards.map((card) => (
            <ProtoCard key={card.key}>
              <span className="pu-stat__icon" style={{ position: "static", display: "inline-flex" }}>
                {card.icon}
              </span>
              <h2 style={{ margin: "20px 0 10px" }}>{card.title}</h2>
              <p style={{ color: "var(--pu-muted)", fontSize: 14, marginBottom: 22 }}>{card.desc}</p>
              <Button type="primary" disabled={card.disabled} onClick={card.onClick}>
                {card.actionLabel}
              </Button>
            </ProtoCard>
          ))}
        </div>
      )}

      {/* ── 课程讨论 ── */}
      {activeTab === "discussions" && (
        <div className="pu-grid pu-grid--two">
          <ProtoCard>
            {sessionsError && (
              <Alert type="error" showIcon style={{ marginBottom: 16 }} message="加载课堂讨论失败" description={(sessionsError as Error).message} />
            )}
            {discussionsLoading || sessionsLoading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (discussionsResult || []).length === 0 && activeSessions.length === 0 ? (
              <Empty description="暂无课程讨论，点击右上角发布讨论" />
            ) : (
              <>
                {(discussionsResult || []).map((d, i) => (
                  <div className="pu-item" key={d.id} style={{ alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--pu-blue-soft, #edf2ff)",
                        color: "var(--pu-blue, #2573e6)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {displayName(d.user).charAt(0)}
                    </span>
                    <div className="pu-item__body" style={{ flex: 1 }}>
                      <h3>{d.title}</h3>
                      <small style={{ color: "var(--pu-muted)", fontSize: 12 }}>
                        {displayName(d.user)} · {formatTime(d.insertedAt)} · {d.replyCount} 条回复
                      </small>
                      <p style={{ margin: "12px 0" }}>{d.content}</p>
                      <Button size="small" onClick={() => setReplyDiscussion(d)}>查看与回复</Button>
                    </div>
                    {i === 0 && <ProtoTag tone="blue">未读</ProtoTag>}
                  </div>
                ))}
                {activeSessions.map((s) => (
                  <div className="pu-item" key={s.id} style={{ alignItems: "flex-start" }}>
                    <span
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: "var(--pu-blue-soft, #edf2ff)",
                        color: "var(--pu-blue, #2573e6)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      课
                    </span>
                    <div className="pu-item__body" style={{ flex: 1 }}>
                      <h3>{s.title}</h3>
                      <small style={{ color: "var(--pu-muted)", fontSize: 12 }}>
                        课堂讨论 · {formatTime(s.startedAt)}
                      </small>
                      <p style={{ margin: "12px 0" }}>{s.description || "教师已开启课堂讨论，进入后可参与回复。"}</p>
                      <Button size="small" type="primary" onClick={() => openDiscussion(s.token)}>进入讨论</Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </ProtoCard>

          <ProtoCard title="交流提示">
            <p style={{ color: "var(--pu-muted)", margin: "20px 0" }}>
              描述具体的课程、章节与问题，有助于获得更准确的反馈。
            </p>
            <div className="pu-note">此处发布的内容仅在课堂互动内展示。</div>
          </ProtoCard>
        </div>
      )}

      {/* ── 我的作业 ── */}
      {activeTab === "homeworks" && (
        <ProtoCard title="我的作业" extra={<span style={{ fontSize: 12, color: "#64748b" }}>共 {visibleTasks.length} 个</span>}>
          {tasksError && (
            <Alert type="error" showIcon style={{ marginBottom: 16 }} message="加载作业失败" description={(tasksError as Error).message} />
          )}
          {tasksLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : visibleTasks.length === 0 ? (
            <Empty description="当前课程暂无作业" />
          ) : (
            visibleTasks.map((task) => {
              const status = submissionsByTask.get(task.id);
              const done = status === "submitted" || status === "graded";
              return (
                <div className="pu-item" key={task.id} style={{ alignItems: "flex-start" }}>
                  <div className="pu-item__body" style={{ flex: 1 }}>
                    <h3>{task.title}</h3>
                    <p>
                      {task.dueDate ? `截止 ${task.dueDate}` : "未设置截止时间"} · {courseResult?.title || "课程"}
                    </p>
                  </div>
                  <ProtoTag tone={done ? "green" : "amber"}>{done ? "已完成" : "待提交"}</ProtoTag>
                  <Button size="small" onClick={() => task.token && openTask(task.token)} disabled={!task.token}>
                    查看作业
                  </Button>
                </div>
              );
            })
          )}
        </ProtoCard>
      )}

      {/* 发布讨论 */}
      <Modal
        title="发布讨论"
        open={publishOpen}
        onCancel={() => setPublishOpen(false)}
        onOk={() => {
          if (!publishContent.trim()) {
            message.warning("请输入讨论内容");
            return;
          }
          createMutation.mutate();
        }}
        confirmLoading={createMutation.isPending}
        okText="发布"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="讨论标题（可选）"
            value={publishTitle}
            onChange={(e) => setPublishTitle(e.target.value)}
            maxLength={80}
          />
        </div>
        <Input.TextArea
          placeholder="描述你的问题或想法……"
          value={publishContent}
          onChange={(e) => setPublishContent(e.target.value)}
          rows={4}
          maxLength={1000}
          showCount
        />
      </Modal>

      {/* 查看与回复 */}
      <Modal
        title={replyDiscussion?.title || "讨论"}
        open={!!replyDiscussion}
        onCancel={() => setReplyDiscussion(null)}
        footer={null}
      >
        {replyDiscussion && (
          <p style={{ color: "var(--pu-muted)", marginBottom: 16 }}>{replyDiscussion.content}</p>
        )}
        {repliesLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : (replies || []).length === 0 ? (
          <Empty description="暂无回复" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          (replies || []).map((r) => (
            <div key={r.id} className="pu-item">
              <span className="pu-item__num" style={{ width: 30, height: 30, borderRadius: "50%" }}>
                {displayName(r.user).charAt(0)}
              </span>
              <div className="pu-item__body">
                <h3 style={{ fontSize: 14 }}>{displayName(r.user)}</h3>
                <p>{r.content}</p>
                <small style={{ color: "var(--pu-muted)", fontSize: 12 }}>{formatTime(r.insertedAt)}</small>
              </div>
            </div>
          ))
        )}
      </Modal>
    </div>
  );
}
