import React, { useState } from "react";
import {
  Avatar,
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Spin,
  Tooltip,
  message,
} from "antd";
import {
  BankOutlined,
  BookOutlined,
  CloseOutlined,
  DownOutlined,
  MailOutlined,
  PhoneOutlined,
  RightOutlined,
  StarOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listResearchRoomMessages,
  createResearchRoomMessage,
  markResearchRoomMessageRead,
  deleteResearchRoomMessage,
  listUsers,
  listCourses,
  listAssignmentsForTeacher,
  listCourseAssignments,
} from "@/lib/ash_rpc";
import type { ListCoursesFields, ListUsersFields } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import "./virtual-research-room.css";

/* ────────────────────── types ────────────────────── */

interface ResearchMessage {
  id: string;
  title: string;
  content: string;
  authorLabel?: string | null;
  readStatus: "unread" | "read";
  participated: boolean;
  postedAt: string;
}

interface TeacherInfo {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  email?: string | null;
  phone?: string | null;
  colledge?: string | null;
}

interface CourseTeacher {
  teacherId: string;
  teacher: TeacherInfo;
  role: string;
}

interface CourseWithTeachers {
  courseId: string;
  courseTitle: string;
  teachers: CourseTeacher[];
}

type TabId = "all" | "unread" | "mine";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "全部消息" },
  { id: "unread", label: "未读消息" },
  { id: "mine", label: "我参与的" },
];

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f5f5f5'/%3E%3Ccircle cx='50' cy='35' r='20' fill='%23ccc'/%3E%3Cellipse cx='50' cy='80' rx='30' ry='20' fill='%23ccc'/%3E%3C/svg%3E";

const TEACHER_FIELDS: ListUsersFields = [
  "id",
  "name",
  "email",
  "phone",
  "role",
  "avatarUrl",
  "jobTitle",
  "bio",
  "major",
  "colledge",
];

const ROLE_META: Record<
  string,
  { label: string; cls: string; icon: React.ReactNode }
> = {
  primary_teacher: {
    label: "主讲教师",
    cls: "primary",
    icon: <StarOutlined />,
  },
  assistant_teacher: {
    label: "助教",
    cls: "assistant",
    icon: <BookOutlined />,
  },
  guest_teacher: { label: "客座教师", cls: "guest", icon: <UserOutlined /> },
};

const ROLE_ORDER = ["primary_teacher", "assistant_teacher", "guest_teacher"];

function extractArrayData(result: unknown): Record<string, any>[] {
  const r = result as { success?: boolean; data?: unknown };
  if (r?.success && r.data) {
    if (Array.isArray(r.data)) return r.data as Record<string, any>[];
    const d = r.data as { results?: unknown; data?: unknown };
    if (Array.isArray(d.results)) return d.results as Record<string, any>[];
    if (Array.isArray(d.data)) return d.data as Record<string, any>[];
  }
  return [];
}

function formatPostedAt(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `今天 ${hhmm}`;
  if (d.toDateString() === yesterday.toDateString()) return `昨天 ${hhmm}`;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hhmm}`;
}

function buildCourseWithTeachers(
  courses: Record<string, any>[],
  assignments: Record<string, any>[],
  teacherMap: Map<string, TeacherInfo>,
): CourseWithTeachers[] {
  return courses.map((course: Record<string, any>) => {
    const courseAssignments = assignments.filter(
      (a: Record<string, any>) => a.courseId === course.id,
    );
    const teachers: CourseTeacher[] = [];
    courseAssignments.forEach((a: Record<string, any>) => {
      const teacher = teacherMap.get(a.teacherId);
      if (teacher) {
        teachers.push({ teacherId: a.teacherId, teacher, role: a.role });
      }
    });
    const creator = teacherMap.get(course.teacherId);
    if (
      creator &&
      !teachers.find((t) => t.teacherId === course.teacherId)
    ) {
      teachers.unshift({
        teacherId: course.teacherId,
        teacher: creator,
        role: "primary_teacher",
      });
    }
    teachers.sort(
      (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
    );
    return {
      courseId: course.id,
      courseTitle: course.title,
      teachers,
    };
  });
}

async function fetchCoursesGroupedData(
  user: Record<string, any>,
  tenant: string,
): Promise<CourseWithTeachers[]> {
  const headers = getAuthHeaders(user) as Record<string, string>;
  const courseFields: ListCoursesFields = ["id", "title", "teacherId", "imageUrl"];

  const collect = async (courseIds: string[]) => {
    const [coursesRes, assignmentsRes] = await Promise.all([
      listCourses({
        tenant,
        fields: courseFields,
        filter: { id: { in: courseIds } },
        page: { limit: 1000, offset: 0 },
        headers,
      }),
      listCourseAssignments({
        tenant,
        fields: ["id", "courseId", "teacherId", "role"],
        filter: { courseId: { in: courseIds } },
        page: { limit: 1000, offset: 0 },
        headers,
      }),
    ]);
    const courses = extractArrayData(coursesRes);
    const assignments = extractArrayData(assignmentsRes);

    const teacherIds = new Set<string>();
    courses.forEach((c) => c.teacherId && teacherIds.add(c.teacherId));
    assignments.forEach((a) => a.teacherId && teacherIds.add(a.teacherId));

    const teachersRes = await listUsers({
      tenant,
      fields: TEACHER_FIELDS,
      filter: { role: { eq: "teacher" }, id: { in: Array.from(teacherIds) } },
      page: { limit: 1000, offset: 0 },
      headers,
    });
    const teachers = extractArrayData(teachersRes);
    const teacherMap = new Map<string, TeacherInfo>();
    teachers.forEach((t) => teacherMap.set(t.id, t as TeacherInfo));

    return buildCourseWithTeachers(courses, assignments, teacherMap);
  };

  if (user?.role !== "teacher") {
    const coursesRes = await listCourses({
      tenant,
      fields: courseFields,
      page: { limit: 1000, offset: 0 },
      headers,
    });
    const courses = extractArrayData(coursesRes);
    if (courses.length === 0) return [];
    return collect(courses.map((c) => c.id));
  }

  const [createdRes, assignedRes] = await Promise.all([
    listCourses({
      tenant,
      fields: courseFields,
      filter: { teacherId: { eq: user.id } },
      page: { limit: 1000, offset: 0 },
      headers,
    }),
    listAssignmentsForTeacher({
      tenant,
      input: { teacherId: user.id },
      fields: ["id", "courseId"],
      headers,
    }),
  ]);
  const allCourseIds = [
    ...new Set([
      ...extractArrayData(createdRes).map((c) => c.id),
      ...extractArrayData(assignedRes).map((a) => a.courseId).filter(Boolean),
    ]),
  ] as string[];

  if (allCourseIds.length === 0) return [];
  return collect(allCourseIds);
}

/* ────────────────────── teacher card ────────────────────── */

const CopyContact: React.FC<{
  text: string;
  icon: React.ReactNode;
}> = ({ text, icon }) => (
  <Tooltip title={text}>
    <span
      className="teacher-card__contact"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => message.success("已复制"));
      }}
    >
      {icon}
      {text}
    </span>
  </Tooltip>
);

const TeacherCard: React.FC<{ item: CourseTeacher }> = ({ item }) => {
  const { teacher, role } = item;
  const meta = ROLE_META[role] ?? {
    label: role,
    cls: "",
    icon: <UserOutlined />,
  };
  return (
    <div className="teacher-card">
      <div className="teacher-card__side">
        <Avatar
          size={54}
          src={teacher.avatarUrl || DEFAULT_AVATAR}
          alt={teacher.name || "教师"}
        />
        <span className="teacher-card__name">{teacher.name || "未知教师"}</span>
        {teacher.jobTitle && (
          <span className="teacher-card__title">{teacher.jobTitle}</span>
        )}
        <span className={`role-tag ${meta.cls}`}>
          {meta.icon}
          {meta.label}
        </span>
      </div>
      <div className="teacher-card__main">
        <div className="teacher-card__label">
          <UserOutlined />
          个人简介
        </div>
        <p className={`teacher-card__bio ${teacher.bio ? "" : "empty"}`}>
          {teacher.bio || "暂无个人简介信息"}
        </p>
        {(teacher.email || teacher.phone || teacher.colledge) && (
          <div className="teacher-card__foot">
            {teacher.email && (
              <CopyContact
                text={teacher.email}
                icon={<MailOutlined />}
              />
            )}
            {teacher.phone && (
              <CopyContact
                text={teacher.phone}
                icon={<PhoneOutlined />}
              />
            )}
            {teacher.colledge && (
              <span className="teacher-card__contact">
                <BankOutlined />
                {teacher.colledge}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const CourseGroup: React.FC<{ course: CourseWithTeachers }> = ({ course }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="course-group">
      <div
        className="course-group__head"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <DownOutlined className="course-group__arrow" />
        ) : (
          <RightOutlined className="course-group__arrow" />
        )}
        <BookOutlined className="course-group__icon" />
        <span className="course-group__title">
          {course.courseTitle || "未知课程"}
        </span>
        <span className="course-group__count">
          {course.teachers.length} 位教师
        </span>
      </div>
      {expanded &&
        (course.teachers.length === 0 ? (
          <div className="course-group__body">
            <Empty description="暂无教师信息" style={{ padding: "24px 0" }} />
          </div>
        ) : (
          <div className="course-group__body">
            <div className="teacher-grid">
              {course.teachers.map((item) => (
                <TeacherCard key={item.teacherId} item={item} />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
};

/* ────────────────────── page ────────────────────── */

export default function VirtualResearchRoom() {
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [moduleTab, setModuleTab] = useState<"teachers" | "messages">(
    "teachers",
  );
  const [tab, setTab] = useState<TabId>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [active, setActive] = useState<ResearchMessage | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  /* — 教师团队 — */
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["researchRoomTeachers", tenant, user?.id],
    queryFn: () => fetchCoursesGroupedData(user, tenant),
    enabled: !!tenant && !!user,
  });
  const courses = coursesData ?? [];

  /* — 消息 — */
  const { data, isLoading } = useQuery({
    queryKey: ["researchRoomMessages", tenant],
    queryFn: async () => {
      const res = await listResearchRoomMessages({
        tenant,
        fields: [
          "id",
          "title",
          "content",
          "authorLabel",
          "readStatus",
          "participated",
          "postedAt",
        ],
        page: { limit: 100, offset: 0 },
        headers,
      });
      if (res.success) {
        const payload = res.data as unknown;
        if (Array.isArray(payload)) return payload as ResearchMessage[];
        const nested = (payload as { results?: ResearchMessage[] })?.results;
        return Array.isArray(nested) ? nested : [];
      }
      return [];
    },
    enabled: !!tenant && !!user,
  });

  const messages = data ?? [];
  const filtered = messages.filter((m) => {
    if (tab === "unread") return m.readStatus === "unread";
    if (tab === "mine") return m.participated;
    return true;
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["researchRoomMessages", tenant] });

  const handleCreate = async () => {
    if (!draftTitle.trim() || !draftContent.trim()) {
      message.warning("请填写标题和内容");
      return;
    }
    setSubmitting(true);
    const res = await createResearchRoomMessage({
      tenant,
      input: {
        title: draftTitle.trim(),
        content: draftContent.trim(),
        authorLabel: user?.displayName || "教师",
        authorId: user?.id,
        participated: true,
      },
      fields: ["id"],
      headers,
    });
    setSubmitting(false);
    if (res.success) {
      message.success("已发布讨论");
      setCreateOpen(false);
      setDraftTitle("");
      setDraftContent("");
      refresh();
    } else {
      message.error("发布失败，请稍后重试");
    }
  };

  const openMessage = async (m: ResearchMessage) => {
    setActive(m);
    setReply("");
    if (m.readStatus === "unread") {
      await markResearchRoomMessageRead({
        tenant,
        primaryKey: m.id,
        fields: ["id"],
        headers,
      });
      refresh();
    }
  };

  const handleReply = async () => {
    if (!active || !reply.trim()) {
      message.warning("请输入回复内容");
      return;
    }
    setReplying(true);
    const res = await createResearchRoomMessage({
      tenant,
      input: {
        title: `回复：${active.title}`,
        content: reply.trim(),
        authorLabel: user?.displayName || "教师",
        authorId: user?.id,
        participated: true,
      },
      fields: ["id"],
      headers,
    });
    setReplying(false);
    if (res.success) {
      message.success("已回复");
      setActive(null);
      setReply("");
      refresh();
    } else {
      message.error("回复失败，请稍后重试");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteResearchRoomMessage({
      tenant,
      primaryKey: id,
      headers,
    });
    if (res.success) {
      message.success("已删除");
      if (active?.id === id) setActive(null);
      refresh();
    } else {
      message.error("删除失败，请稍后重试");
    }
  };

  return (
    <div className="virtual-room">
      <div className="pu-breadcrumb">智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;虚拟教研室</div>
      <div className="page-head">
        <div>
          <h1>虚拟教研室</h1>
          <p>按课程组织教研团队，并让教学沟通围绕课程与具体问题展开。</p>
        </div>
      </div>

      <div className="module-tabs">
        <button
          type="button"
          className={moduleTab === "teachers" ? "active" : ""}
          onClick={() => setModuleTab("teachers")}
        >
          教研室老师
        </button>
        <button
          type="button"
          className={moduleTab === "messages" ? "active" : ""}
          onClick={() => setModuleTab("messages")}
        >
          消息中心
        </button>
      </div>

      {moduleTab === "teachers" ? (
        <section className="module">
          {coursesLoading ? (
            <div className="card">
              <Spin>
                <div style={{ minHeight: 120 }} />
              </Spin>
            </div>
          ) : courses.length === 0 ? (
            <div className="card">
              <Empty description="暂无教师信息" style={{ padding: "40px 0" }} />
            </div>
          ) : (
            courses.map((course) => (
              <CourseGroup key={course.courseId} course={course} />
            ))
          )}
        </section>
      ) : (
        <section className="module">
          <div className="module-toolbar">
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "active" : ""}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button type="primary" onClick={() => setCreateOpen(true)}>
              发布讨论
            </Button>
          </div>

          {isLoading ? (
            <Spin>
              <div style={{ minHeight: 200 }} />
            </Spin>
          ) : (
            <div className="card">
              {filtered.length === 0 ? (
                <Empty description="暂无消息" style={{ padding: "40px 0" }} />
              ) : (
                filtered.map((m) => (
                  <div className="item" key={m.id}>
                    <span className="avatar">
                      {(m.authorLabel || "通").charAt(0)}
                    </span>
                    <div className="item__body">
                      <h3>{m.title}</h3>
                      <small>
                        {m.authorLabel || "课程教学团队"} ·{" "}
                        {formatPostedAt(m.postedAt)}
                      </small>
                      <p>{m.content}</p>
                      <Button onClick={() => openMessage(m)}>查看与回复</Button>
                    </div>
                    <div className="item__side">
                      <Popconfirm
                        title="删除这条消息？"
                        description="删除后不可恢复。"
                        okText="删除"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(m.id)}
                      >
                        <button
                          type="button"
                          className="item__delete"
                          aria-label="删除消息"
                          title="删除"
                        >
                          <CloseOutlined />
                        </button>
                      </Popconfirm>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {/* 发布讨论 */}
      <Modal
        title="发布讨论"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        okText="发布"
        cancelText="取消"
        destroyOnClose
      >
        <Input
          placeholder="讨论标题"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <Input.TextArea
          placeholder="描述具体的课程、章节与问题"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          rows={5}
        />
      </Modal>

      {/* 查看与回复 */}
      <Modal
        title={active?.title}
        open={!!active}
        onCancel={() => setActive(null)}
        onOk={handleReply}
        confirmLoading={replying}
        okText="回复"
        cancelText="关闭"
        destroyOnClose
      >
        {active && (
          <>
            <small style={{ color: "#64748b" }}>
              {active.authorLabel || "课程教学团队"} ·{" "}
              {formatPostedAt(active.postedAt)}
            </small>
            <p style={{ margin: "14px 0", lineHeight: 1.8, color: "#202f47" }}>
              {active.content}
            </p>
            <Input.TextArea
              placeholder="写下你的回复…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={4}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
