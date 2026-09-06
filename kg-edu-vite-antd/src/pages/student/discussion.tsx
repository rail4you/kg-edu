import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Spin,
  Empty,
  Avatar,
  List,
  Input,
  Space,
  Tag,
  message,
  Drawer,
  Badge,
} from "antd";
import {
  UserOutlined,
  SendOutlined,
  TeamOutlined,
  BookOutlined,
  MenuOutlined,
  DownOutlined,
  UpOutlined,
  ArrowLeftOutlined,
  CommentOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { usePageTitle } from "@/hooks/use-page-title";
import { saveStudentActivityHistory } from "@/lib/student-activity-history";
import { setCurrentTenant, getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";
import {
  getDiscussionSessionByToken,
  listDiscussionsBySession,
  createDiscussion,
  createReply,
  listRepliesByDiscussion,
  listEnrollmentsByCourse,
  listUsers,
} from "@/lib/ash_rpc";
import type { DiscussionResourceSchema } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1200,
    height: typeof window !== "undefined" ? window.innerHeight : 800,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return windowSize;
}

interface DiscussionSession {
  id: string;
  title: string;
  description?: string;
  courseId: string;
  token: string;
  status: "active" | "closed";
  startedAt: string;
  endedAt?: string;
  course?: {
    id: string;
    title: string;
  };
  createdBy?: {
    id: string;
    name?: string;
  };
}

interface CourseMember {
  id: string;
  memberId: string;
  enrolledAt: string;
  member?: {
    id: string;
    name?: string;
    email?: string;
  };
}

interface StudentDiscussionProps {
  embedded?: boolean;
}

export default function StudentDiscussionPage({ embedded }: StudentDiscussionProps) {
  const params = useParams<{ tenantSchema?: string; token?: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  usePageTitle();

  const currentTenant = getCurrentTenant();
  // In embedded mode: /dashboard/interaction/discussion/:token (tenantSchema comes from currentTenant)
  // In standalone mode: /student/discussion/:tenantSchema/:token
  const tenantSchema = embedded
    ? (currentTenant?.schemaName || "")
    : (params.tenantSchema || "");
  const token = params.token || "";
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [newDiscussionTitle, setNewDiscussionTitle] = useState("");
  const [newDiscussionContent, setNewDiscussionContent] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sidebarDrawerOpen, setSidebarDrawerOpen] = useState(false);
  
  const { width: windowWidth } = useWindowSize();
  const isMobile = windowWidth < 768;

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  const { data: sessionResult, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ["discussion-session", tenantSchema, token],
    queryFn: async () => {
      if (!token || !tenantSchema) {
        throw new Error("Invalid discussion URL format");
      }

      const result = await getDiscussionSessionByToken({
        tenant: tenantSchema,
        fields: [
          "id",
          "title",
          "description",
          "courseId",
          "token",
          "status",
          "startedAt",
          "endedAt",
          { course: ["id", "title"] },
          { createdBy: ["id", "name"] },
        ],
        input: { token },
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        return { data: result.data as DiscussionSession };
      }

      throw new Error("Invalid or expired discussion token");
    },
    enabled: !!token && !!tenantSchema,
    retry: false,
  });

  const session = sessionResult?.data;
  const courseId = session?.courseId || selectedCourseId;

  useEffect(() => {
    if (!tenantSchema || !session) {
      return;
    }

    setCurrentTenant({
      id: tenantSchema,
      name: tenantSchema,
      schemaName: tenantSchema,
    });

    if (session.courseId) {
      localStorage.setItem("selectedCourse", session.courseId);
    }
    if (session.course?.title) {
      localStorage.setItem("selectedCourseName", session.course.title);
    }

    saveStudentActivityHistory({
      kind: "discussion",
      tenantSchema,
      courseId: session.courseId,
      token: session.token,
      title: session.title,
      description: session.description,
      status: session.status,
      courseTitle: session.course?.title,
      visitedAt: new Date().toISOString(),
    });
  }, [tenantSchema, session]);

  const { data: enrollmentResult, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["check-enrollment", tenantSchema, courseId, user?.id],
    queryFn: async () => {
      if (!courseId || !user) return { enrolled: false };

      const result = await listEnrollmentsByCourse({
        tenant: tenantSchema!,
        fields: ["id", "memberId", "enrolledAt"],
        input: { courseId },
        filter: { memberId: { eq: user.id } },
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const enrollments = Array.isArray(data) ? data : data.results || data.data || [];
        return { enrolled: enrollments.length > 0 };
      }
      return { enrolled: false };
    },
    enabled: !!tenantSchema && !!courseId && !!user,
  });

  const isEnrolled = enrollmentResult?.enrolled || false;

  const { data: discussionsResult, isLoading: discussionsLoading, refetch: refetchDiscussions } = useQuery({
    queryKey: ["discussions", tenantSchema, session?.id],
    queryFn: async () => {
      if (!session?.id) return { data: [] };

      const result = await listDiscussionsBySession({
        tenant: tenantSchema!,
        fields: [
          "id",
          "title",
          "content",
          "status",
          "replyCount",
          "viewCount",
          "insertedAt",
          { user: ["id", "name", "email", "role"] },
        ],
        input: { discussionSessionId: session.id },
        sort: "-insertedAt",
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const discussions = Array.isArray(data) ? data : data.results || data.data || [];
        return { data: discussions };
      }
      return { data: [] };
    },
    enabled: !!tenantSchema && !!session?.id,
  });

  const { data: membersResult, isLoading: membersLoading } = useQuery({
    queryKey: ["course-members", tenantSchema, courseId],
    queryFn: async () => {
      if (!courseId) return { data: [] };

      const result = await listEnrollmentsByCourse({
        tenant: tenantSchema!,
        fields: [
          "id",
          "memberId",
          "enrolledAt",
        ],
        input: { courseId },
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const members = Array.isArray(data) ? data : data.results || data.data || [];
        
        const memberIds = members.map((m: CourseMember) => m.memberId).filter(Boolean);
        const usersMap: Record<string, { name?: string; email?: string }> = {};
        
        if (memberIds.length > 0) {
          const usersResult = await listUsers({
            tenant: tenantSchema!,
            fields: ["id", "name", "email"],
            filter: { id: { in: memberIds } },
            headers: user ? getHeaders(user) : undefined,
          });
          
          if (usersResult.success && usersResult.data) {
            const usersData = usersResult.data as any;
            const usersList = Array.isArray(usersData) ? usersData : usersData.results || usersData.data || [];
            usersList.forEach((u: { id: string; name?: string; email?: string }) => {
              usersMap[u.id] = { name: u.name, email: u.email };
            });
          }
        }
        
        const membersWithUser = members.map((m: CourseMember) => ({
          ...m,
          member: usersMap[m.memberId] || null,
        }));
        
        return { data: membersWithUser as CourseMember[] };
      }
      return { data: [] };
    },
    enabled: !!tenantSchema && !!courseId && !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error("请先登录");
      }

      if (!session?.id) {
        throw new Error("会话不存在");
      }

      if (!newDiscussionTitle.trim() || !newDiscussionContent.trim()) {
        throw new Error("请填写标题和内容");
      }

      const result = await createDiscussion({
        tenant: tenantSchema!,
        fields: ["id", "title", "content"],
        input: {
          title: newDiscussionTitle,
          content: newDiscussionContent,
          courseId: courseId,
          userId: user?.id,
          discussionSessionId: session?.id,
        },
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errors = (result as any).errors;
        if (errors && errors.length > 0) {
          throw new Error(errors[0].message || "发布失败");
        }
        throw new Error("发布失败");
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("发布成功");
      setNewDiscussionTitle("");
      setNewDiscussionContent("");
      setShowCreateForm(false);
      refetchDiscussions();
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  useEffect(() => {
    if (session?.courseId) {
      setSelectedCourseId(session.courseId);
    }
  }, [session]);

  const isSessionActive = session?.status === "active";
  const isSessionClosed = session?.status === "closed";
  const discussions: DiscussionResourceSchema[] = discussionsResult?.data || [];
  const members: CourseMember[] = membersResult?.data || [];

  const studentCourses = courses;
  const membersList = members;

  if (authLoading || sessionLoading) {
    return (
      <div
        style={{
          minHeight: embedded ? 200 : "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (sessionError || !session) {
    return (
      <div
        style={{
          minHeight: embedded ? 200 : "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 500, padding: 24, textAlign: "center" }}>
          <Title level={4} style={{ color: "#ff4d4f", marginBottom: 8 }}>
            讨论链接无效
          </Title>
          <Text type="secondary">
            该讨论码可能已过期或不存在，请联系老师确认。
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => navigate(embedded ? "/dashboard/interaction" : "/")}>
              {embedded ? "返回互动课堂" : "返回首页"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!user) {
    const loginPath = embedded
      ? `/login?role=student&redirect=/dashboard/interaction/discussion/${token}`
      : `/login?role=student&redirect=/student/discussion/${tenantSchema}/${token}`;
    return (
      <div
        style={{
          minHeight: embedded ? 200 : "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 500, padding: 24, textAlign: "center" }}>
          <Title level={4} style={{ marginBottom: 8 }}>
            请先登录
          </Title>
          <Text type="secondary">
            登录后可参与讨论
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => navigate(loginPath)}>
              登录
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!isEnrolled && !enrollmentLoading && session) {
    return (
      <div
        style={{
          minHeight: embedded ? 200 : "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Card style={{ maxWidth: 500, padding: 24, textAlign: "center" }}>
          <Title level={4} style={{ color: "#ff4d4f", marginBottom: 8 }}>
            无权访问
          </Title>
          <Text type="secondary">
            您未选修「{session?.course?.title}」课程，无法参与该课程的讨论。
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => navigate(embedded ? "/dashboard/interaction" : "/dashboard")}>
              {embedded ? "返回互动课堂" : "返回学习中心"}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: embedded ? "auto" : "100vh", background: embedded ? "transparent" : "#f5f5f5" }}>
      {/* Embedded mode: back button + header */}
      {embedded && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/dashboard/interaction#discussions")}
            style={{ color: colors.primary, padding: "4px 0", marginBottom: 8 }}
          >
            返回讨论列表
          </Button>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space style={{ marginBottom: 4 }}>
                <Tag color="blue" style={{ margin: 0 }}>
                  <CommentOutlined /> 课堂讨论
                </Tag>
              </Space>
              <Title level={3} style={{ margin: "8px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {session.title}
              </Title>
            </div>
            <Tag color={isSessionActive ? "green" : "default"} style={{ margin: 0, flexShrink: 0 }}>
              {isSessionActive ? "进行中" : "已关闭"}
            </Tag>
          </div>
        </div>
      )}

      {/* Standalone mode: original header */}
      {!embedded && (
        <div
          style={{
            background: "white",
            padding: isMobile ? "12px 16px" : "16px 24px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={isMobile ? 5 : 4} style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {session.title}
            </Title>
            {!isMobile && <Text type="secondary">{session.title}</Text>}
          </div>
          <Space>
            {isMobile && (
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setSidebarDrawerOpen(true)}
              />
            )}
            <Tag color={isSessionActive ? "green" : "default"} style={{ margin: 0 }}>
              {isSessionActive ? "进行中" : "已关闭"}
            </Tag>
          </Space>
        </div>
      )}

      {isMobile && (
        <Drawer
          title="课程信息"
          placement="left"
          open={sidebarDrawerOpen}
          onClose={() => setSidebarDrawerOpen(false)}
          width={280}
        >
          <Card
            title={
              <Space>
                <BookOutlined />
                <span>课程</span>
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {coursesLoading ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <Spin size="small" />
              </div>
            ) : studentCourses.length === 0 ? (
              <Empty description="暂无课程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={studentCourses}
                renderItem={(course) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      background: course.id === courseId ? "#e6f7ff" : "transparent",
                      padding: "8px 12px",
                      margin: "4px 0",
                      borderRadius: 4,
                    }}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setSidebarDrawerOpen(false);
                    }}
                  >
                    <Space>
                      {course.id === courseId && <BookOutlined style={{ color: "#1890ff" }} />}
                      <Text ellipsis>{course.title}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>

          <Card
            title={
              <Space>
                <TeamOutlined />
                <span>成员 ({members.length})</span>
              </Space>
            }
            size="small"
            style={{ maxHeight: "40vh", overflow: "auto" }}
          >
            {membersLoading ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <Spin size="small" />
              </div>
            ) : members.length === 0 ? (
              <Empty description="暂无成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                size="small"
                dataSource={membersList}
                renderItem={(member) => (
                  <List.Item style={{ padding: "4px 0" }}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} />
                      <Text ellipsis style={{ maxWidth: 180 }}>
                        {member.memberId === user?.memberId
                          ? "我"
                          : (member.member?.name || member.member?.email || `用户 ${member.memberId?.substring(0, 8)}`)}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Drawer>
      )}

      <div style={{ display: "flex", padding: embedded ? 0 : isMobile ? 12 : 24, gap: isMobile ? 12 : 24 }}>
        {!isMobile && !embedded && (
          <div style={{ width: 240, flexShrink: 0 }}>
            <Card
              title={
                <Space>
                  <BookOutlined />
                  <span>课程列表</span>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              {coursesLoading ? (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <Spin size="small" />
                </div>
              ) : studentCourses.length === 0 ? (
                <Empty description="暂无课程" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={studentCourses}
                  renderItem={(course) => (
                    <List.Item
                      style={{
                        cursor: "pointer",
                        background: course.id === courseId ? "#e6f7ff" : "transparent",
                        padding: "8px 12px",
                        margin: "4px 0",
                        borderRadius: 4,
                      }}
                      onClick={() => setSelectedCourseId(course.id)}
                    >
                      <Space>
                        {course.id === courseId && <BookOutlined style={{ color: "#1890ff" }} />}
                        <Text>{course.title}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>

            <Card
              title={
                <Space>
                  <TeamOutlined />
                  <span>成员列表</span>
                </Space>
              }
              size="small"
            >
              {membersLoading ? (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <Spin size="small" />
                </div>
              ) : members.length === 0 ? (
                <Empty description="暂无成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <List
                  size="small"
                  dataSource={membersList}
                  renderItem={(member) => (
                    <List.Item style={{ padding: "4px 0" }}>
                      <Space>
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text>
                          {member.memberId === user?.memberId
                            ? "我"
                            : (member.member?.name || member.member?.email || `用户 ${member.memberId?.substring(0, 8)}`)}
                        </Text>
                      </Space>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Card style={embedded ? { borderRadius: 20 } : undefined} bodyStyle={isMobile ? { padding: 12 } : undefined}>
            <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <Title level={5} style={{ margin: 0 }}>
                讨论区 {discussions.length > 0 && <Badge count={discussions.length} style={{ marginLeft: 8 }} />}
              </Title>
              {isSessionActive && (
                <Button
                  type="primary"
                  size={isMobile ? "small" : undefined}
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  {isMobile ? "发帖" : "发布新讨论"}
                </Button>
              )}
            </div>

            {showCreateForm && (
              <div style={{ marginBottom: isMobile ? 16 : 24, padding: isMobile ? 12 : 16, background: "#f5f5f5", borderRadius: 8 }}>
                <div style={{ marginBottom: 12 }}>
                  <Input
                    placeholder="请输入讨论标题"
                    value={newDiscussionTitle}
                    onChange={(e) => setNewDiscussionTitle(e.target.value)}
                    size={isMobile ? "middle" : "large"}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <TextArea
                    placeholder="请输入讨论内容"
                    value={newDiscussionContent}
                    onChange={(e) => setNewDiscussionContent(e.target.value)}
                    rows={isMobile ? 3 : 4}
                  />
                </div>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => createMutation.mutate()}
                    loading={createMutation.isPending}
                    size={isMobile ? "small" : undefined}
                  >
                    发布
                  </Button>
                  <Button onClick={() => setShowCreateForm(false)} size={isMobile ? "small" : undefined}>
                    取消
                  </Button>
                </Space>
              </div>
            )}

            {isSessionClosed && (
              <div style={{ padding: 16, background: "#fffbe6", borderRadius: 4, marginBottom: 16 }}>
                <Text type="warning">该讨论已结束，无法发布新内容。</Text>
              </div>
            )}

            {discussionsLoading || membersLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : discussions.length === 0 ? (
              <Empty description="暂无讨论，率先发起讨论吧！" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
              <List
                itemLayout="vertical"
                dataSource={discussions}
                renderItem={(discussion) => (
                  <DiscussionItem
                    key={discussion.id}
                    discussion={discussion}
                    tenantSchema={tenantSchema!}
                    session={session}
                    user={user}
                    isMobile={isMobile}
                    isSessionActive={isSessionActive}
                    refetchDiscussions={refetchDiscussions}
                  />
                )}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

interface ReplyItem {
  id: string;
  content: string;
  insertedAt: string;
  userId: string | null;
  user?: {
    id: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
}

interface DiscussionItemProps {
  discussion: DiscussionResourceSchema;
  tenantSchema: string;
  session: DiscussionSession;
  user: any;
  isMobile: boolean;
  isSessionActive: boolean;
  refetchDiscussions: () => void;
}

function DiscussionItem({
  discussion,
  tenantSchema,
  session,
  user,
  isMobile,
  isSessionActive,
  refetchDiscussions,
}: DiscussionItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);

  const { data: repliesResult, isLoading: repliesLoading, refetch: refetchReplies } = useQuery({
    queryKey: ["discussion-replies", tenantSchema, discussion.id],
    queryFn: async () => {
      const result = await listRepliesByDiscussion({
        tenant: tenantSchema,
        fields: [
          "id",
          "content",
          "insertedAt",
          { user: ["id", "name", "email", "role"] },
        ],
        input: { discussionId: discussion.id },
        sort: "insertedAt",
        headers: user ? getHeaders(user) : undefined,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const replies = Array.isArray(data) ? data : data.results || data.data || [];
        return { data: replies as ReplyItem[] };
      }
      return { data: [] as ReplyItem[] };
    },
    enabled: expanded,
  });

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!replyContent.trim()) {
        throw new Error("请输入回复内容");
      }

      const result = await createReply({
        tenant: tenantSchema,
        fields: ["id", "content"],
        input: {
          content: replyContent,
          discussionId: discussion.id,
          userId: user?.id,
        },
        headers: getHeaders(user),
      });

      if (!result.success) {
        const errors = (result as any).errors;
        if (errors && errors.length > 0) {
          throw new Error(errors[0].message || "回复失败");
        }
        throw new Error("回复失败");
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("回复成功");
      setReplyContent("");
      setShowReplyInput(false);
      refetchReplies();
      refetchDiscussions();
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  const replies = repliesResult?.data || [];

  const isTeacher = (replyUser: ReplyItem["user"]) => {
    return replyUser?.role === "teacher" || replyUser?.role === "admin" || replyUser?.role === "super_admin";
  };

  const discussionUser = (discussion as any).user || {};

  return (
    <List.Item style={{ padding: isMobile ? "8px 0" : "12px 0", borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 4 }}>
          <Avatar size="small" icon={<UserOutlined />} style={{ background: isTeacher(discussionUser) ? "#1890ff" : undefined, marginRight: 8 }} />
          <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>
            {discussionUser.id === user?.id
              ? discussionUser.name || user.displayName || user.email?.split('@')[0] || "我"
              : discussionUser.name || (discussionUser.email ? discussionUser.email.split('@')[0] : "匿名用户")}
          </Text>
          {isTeacher(discussionUser) && (
            <Tag color="blue" style={{ fontSize: 11, lineHeight: "18px", padding: "0 4px", margin: 0 }}>
              老师
            </Tag>
          )}
          <Text type="secondary" style={{ marginLeft: "auto", fontSize: 12 }}>
            {discussion.insertedAt ? new Date(discussion.insertedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
          </Text>
        </div>
        <Title level={5} style={{ margin: "8px 0", fontSize: isMobile ? 15 : undefined }}>
          {discussion.title}
        </Title>
        <Paragraph
          ellipsis={{ rows: isMobile ? 2 : 3 }}
          style={{ margin: 0, color: "#666", fontSize: isMobile ? 13 : 14 }}
        >
          {discussion.content}
        </Paragraph>

        {/* 回复区域 */}
        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, fontSize: 13, color: "#1890ff" }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "收起回复" : "回复列表"}
            {expanded ? <UpOutlined style={{ fontSize: 10, marginLeft: 4 }} /> : <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />}
          </Button>
          {isSessionActive && (
            <Button
              type="link"
              size="small"
              style={{ padding: 0, fontSize: 13, color: "#1890ff" }}
              onClick={() => {
                setExpanded(true);
                setShowReplyInput(!showReplyInput);
              }}
            >
              {showReplyInput ? "取消回复" : "写回复"}
            </Button>
          )}
        </div>

        {/* 展开的回复列表 */}
        {expanded && (
          <div style={{ marginTop: 12, paddingLeft: isMobile ? 8 : 16, borderLeft: "2px solid #e8e8e8" }}>
            {repliesLoading ? (
              <div style={{ textAlign: "center", padding: 12 }}>
                <Spin size="small" />
              </div>
            ) : replies.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 13 }}>暂无回复</Text>
            ) : (
              replies.map((reply) => {
                const teacher = isTeacher(reply.user);
                return (
                  <div
                    key={reply.id}
                    style={{
                      marginBottom: 12,
                      padding: isMobile ? "8px" : "10px 12px",
                      background: teacher ? "#f0f7ff" : "#fafafa",
                      borderRadius: 6,
                      borderLeft: teacher ? "3px solid #1890ff" : "3px solid #d9d9d9",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 6, flexWrap: "wrap" }}>
                      <Avatar size="small" icon={<UserOutlined />} style={{ background: teacher ? "#1890ff" : undefined }} />
                      <Text strong style={{ fontSize: 13 }}>
                        {reply.user?.id === user?.id
                          ? reply.user?.name || "我"
                          : reply.user?.name || (reply.user?.email ? reply.user.email.split('@')[0] : "匿名用户")}
                      </Text>
                      {teacher && (
                        <Tag color="blue" style={{ fontSize: 11, lineHeight: "18px", padding: "0 4px", margin: 0 }}>
                          老师
                        </Tag>
                      )}
                      <Text type="secondary" style={{ marginLeft: "auto", fontSize: 11 }}>
                        {reply.insertedAt ? new Date(reply.insertedAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      </Text>
                    </div>
                    <Text style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>{reply.content}</Text>
                  </div>
                );
              })
            )}

            {/* 回复输入框 */}
            {showReplyInput && (
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-start" }}>
                <TextArea
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="输入回复内容..."
                  rows={2}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  loading={replyMutation.isPending}
                  onClick={() => replyMutation.mutate()}
                  style={{ marginTop: 4 }}
                >
                  回复
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </List.Item>
  );
}
