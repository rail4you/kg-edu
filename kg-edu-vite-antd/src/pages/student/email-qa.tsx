import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
  Button,
  Input,
  Tag,
  Spin,
  Space,
  message,
  Form,
  Select,
  Empty,
  DatePicker,
  Grid,
} from "antd";
import {
  MailOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useAuth } from "@/auth/auth-context";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { getCurrentTenant } from "@/lib/tenant";
import { useSearchParams } from "react-router-dom";
import {
  listEmailConfigs,
  sendEmail,
  listEmailMessages,
  listEnrollments,
  listCourses,
  listCourseAssignments,
} from "@/lib/ash_rpc";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface EmailConfig {
  id: string;
  userId: string;
  emailAddress: string;
  senderName: string;
  user?: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  status: "pending" | "sending" | "sent" | "failed";
  sentAt?: string;
  failedAt?: string;
  errorMessage?: string;
  insertedAt?: string;
  sender: {
    id: string;
    name: string | null;
    email: string | null;
  };
  receiver: {
    id: string;
    name: string | null;
    email: string | null;
  };
  parentMessageId?: string | null;
  path?: string[];
}

interface EnrolledCourse {
  id: string;
  courseId: string;
  title: string;
}

type ViewMode = "list" | "compose";

export default function EmailQA({ courseId }: { courseId?: string }) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedTeacher, setSelectedTeacher] = useState<EmailConfig | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(
    courseId || searchParams.get("courseId") || localStorage.getItem("selectedCourse") || undefined
  );
  const [form] = Form.useForm();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);

  const activeCourseId = selectedCourseId;

  // 学生注册的课程（用于发送问答时选择课程）
  const { data: enrolledCourses } = useQuery({
    queryKey: ["email-qa-enrolled-courses", user?.id, currentTenant?.schemaName],
    queryFn: async () => {
      if (!user?.id) return [] as EnrolledCourse[];
      const result = await listEnrollments({
        tenant: currentTenant?.schemaName || "",
        fields: ["courseId", { course: ["id", "title"] }],
        filter: { memberId: { eq: user.id } },
        page: { limit: 200, offset: 0 },
        headers: getHeaders(user),
      });
      const data = extractArrayData(result) as any[];
      return data
        .filter((e) => e.courseId)
        .map((e) => ({
          id: e.courseId,
          courseId: e.courseId,
          title: e.course?.title || "未命名课程",
        }));
    },
    enabled: !!user?.id,
  });

  const { data: courseData } = useQuery({
    queryKey: ["course", activeCourseId],
    queryFn: async () => {
      if (!activeCourseId) return null;

      const result = await listCourses({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "title", "teacherId"],
        filter: { id: { eq: activeCourseId } },
        page: { limit: 1, offset: 0 },
        headers: getHeaders(user),
      });

      const data = extractArrayData(result);
      return data[0] || null;
    },
    enabled: !!activeCourseId && !!user,
  });

  // 课程的其它类型教师（助教/客座等分配教师）
  const { data: courseAssignments } = useQuery({
    queryKey: ["email-qa-course-assignments", activeCourseId],
    queryFn: async () => {
      if (!activeCourseId) return [] as any[];
      const result = await listCourseAssignments({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "role", { teacher: ["id", "name", "email"] }],
        filter: { courseId: { eq: activeCourseId } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!activeCourseId && !!user,
  });

  // 教师类型文案
  const roleLabel: Record<string, string> = {
    primary_teacher: "主讲教师",
    assistant_teacher: "助教",
    guest_teacher: "客座教师",
  };

  // 课程教师列表（主讲教师在前，其余分配教师在后，去重）
  const courseTeachers = React.useMemo(() => {
    if (!activeCourseId) return [] as any[];
    const list: any[] = [];
    const seen = new Set<string>();

    // 主讲教师
    if (courseData?.teacherId) {
      seen.add(courseData.teacherId);
      list.push({ userId: courseData.teacherId, role: "primary_teacher" });
    }

    // 其余分配教师
    (courseAssignments || []).forEach((a: any) => {
      if (!a.teacher?.id || seen.has(a.teacher.id)) return;
      seen.add(a.teacher.id);
      list.push({ userId: a.teacher.id, role: a.role || "assistant_teacher" });
    });

    return list;
  }, [courseData, courseAssignments, activeCourseId]);

  const { data: emailConfigsResult, isLoading: configsLoading } = useQuery({
    queryKey: ["email-configs", activeCourseId, courseTeachers.map((t) => t.userId).join(",")],
    queryFn: async () => {
      const teacherIds = courseTeachers.map((t) => t.userId).filter(Boolean);
      if (teacherIds.length === 0) return [];

      const result = await listEmailConfigs({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "userId", "emailAddress", "senderName", { user: ["id", "name", "email"] }],
        filter: { userId: { in: teacherIds } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });

      return extractArrayData(result);
    },
    enabled: !!user && !!activeCourseId && courseTeachers.length > 0,
  });

  const { data: sentMessagesResult, isLoading: messagesLoading } = useQuery({
    queryKey: ["email-messages", "all", user?.id, activeCourseId],
    queryFn: async () => {
      if (!user?.id || !activeCourseId) return [];

      const result = await listEmailMessages({
        tenant: currentTenant?.schemaName || "",
        // 学生只能看到本课程下、自己参与（发送/接收）的消息
        filter: {
          and: [
            { courseId: { eq: activeCourseId } },
            {
              or: [
                { senderUserId: { eq: user.id } },
                { receiverUserId: { eq: user.id } },
              ],
            },
          ],
        },
        fields: [
          "id",
          "subject",
          "body",
          "status",
          "errorMessage",
          "sentAt",
          "failedAt",
          "insertedAt",
          "parentMessageId",
          "courseId",
          { sender: ["id", "name", "email"] },
          { receiver: ["id", "name", "email"] },
          { course: ["id", "title"] },
        ],
        sort: "-insertedAt",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });

      const messages = extractArrayData(result);

      const userMessages = messages.filter(
        (msg: EmailMessage) => msg.sender?.id === user.id || msg.receiver?.id === user.id
      );

      const messageMap = new Map<string, EmailMessage>();
      const rootMessages: EmailMessage[] = [];

      userMessages.forEach((msg: EmailMessage) => {
        const message: EmailMessage = {
          ...msg,
          parentMessageId: msg.parentMessageId || null,
        };

        if (!message.parentMessageId) {
          message.path = [message.id];
          messageMap.set(message.id, message);
          rootMessages.push(message);
        } else {
          messageMap.set(message.id, message);
        }
      });

      messageMap.forEach((msg) => {
        if (msg.parentMessageId && messageMap.has(msg.parentMessageId)) {
          const parent = messageMap.get(msg.parentMessageId)!;
          msg.path = [...(parent.path || []), msg.id];
        }
      });

      const allMessages: EmailMessage[] = [];
      rootMessages.forEach((root) => {
        allMessages.push(root);
        messageMap.forEach((msg) => {
          if (msg.parentMessageId === root.id) {
            allMessages.push(msg);
          }
        });
      });

      return allMessages;
    },
    enabled: !!user?.id && !!activeCourseId,
  });

  // 回复状态由会话线程结构决定：某封邮件被其它邮件通过 parentMessageId 指向，即视为“已回复”
  const repliedMessageIds = React.useMemo(() => {
    const ids = new Set<string>();
    (sentMessagesResult || []).forEach((msg: EmailMessage) => {
      if (msg.parentMessageId) ids.add(msg.parentMessageId);
    });
    return ids;
  }, [sentMessagesResult]);

  const filteredMessages = React.useMemo(() => {
    if (!sentMessagesResult) return [];
    return sentMessagesResult.filter((msg: EmailMessage) => {
      if (statusFilter === "replied") {
        // 已回复：仅展示收到过回复的邮件问答（含回复内容）
        const rootId = msg.path?.[0] || msg.id;
        if (!rootId || !repliedMessageIds.has(rootId)) return false;
      } else if (statusFilter === "pending") {
        // 待回复：去除已回复，只显示没有任何回复的邮件
        if (msg.parentMessageId) return false; // 回复本身不计入待回复
        if (repliedMessageIds.has(msg.id)) return false;
      }
      if (dateRange[0] && dateRange[1]) {
        if (msg.sentAt) {
          const sentDate = dayjs(msg.sentAt);
          if (sentDate.isBefore(dateRange[0]) || sentDate.isAfter(dateRange[1])) return false;
        }
      }
      return true;
    });
  }, [sentMessagesResult, statusFilter, dateRange, repliedMessageIds]);

  const successCount = sentMessagesResult?.filter((m: EmailMessage) => m.status === "sent").length || 0;
  // 待回复数 = 没有任何回复的邮件问答数量
  const pendingCount =
    sentMessagesResult?.filter(
      (m: EmailMessage) => !m.parentMessageId && !repliedMessageIds.has(m.id)
    ).length || 0;

  // 收件教师选项：按课程教师顺序（主讲在前），仅保留有邮箱配置的教师，显示类型
  // 注意：该 useMemo 必须位于组件 early return（未登录等）之前，避免 hooks 数量变化
  const teacherOptions = React.useMemo(() => {
    const configByUser = new Map<string, any>();
    (emailConfigsResult || []).forEach((c: any) => configByUser.set(c.userId, c));
    const opts: { label: string; value: string }[] = [];
    courseTeachers.forEach((t: any) => {
      const cfg = configByUser.get(t.userId);
      if (!cfg) return;
      const role = roleLabel[t.role] || "教师";
      const name = cfg.user?.name || cfg.senderName || "未知教师";
      opts.push({ label: `${name}（${role}）`, value: cfg.id });
    });
    return opts;
  }, [emailConfigsResult, courseTeachers]);

  const sendEmailMutation = useMutation({
    mutationFn: async (data: {
      configId: string;
      receiverUserId: string;
      subject: string;
      body: string;
    }) => {
      const result = await sendEmail({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "subject", "status", "sentAt"],
        input: {
          senderUserId: user!.id,
          receiverUserId: data.receiverUserId,
          subject: data.subject,
          body: data.body,
          courseId: activeCourseId || null,
        },
        headers: getHeaders(user),
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
      message.success("问题发送成功！");
      setViewMode("list");
      setSelectedTeacher(null);
      form.resetFields();
    },
    onError: (error: Error) => {
      message.error(`问题发送失败：${error.message || "未知错误"}`);
    },
  });

  const handleCompose = () => {
    // 发送前必须选择课程
    if (!enrolledCourses || enrolledCourses.length === 0) {
      message.warning("您还没有注册任何课程，无法发起邮件问答");
      return;
    }
    if (!activeCourseId) {
      message.warning("请先选择课程");
      return;
    }
    if (!emailConfigsResult || emailConfigsResult.length === 0) {
      message.warning("该课程暂无可发送的教师邮箱配置");
      return;
    }
    // 默认选中主讲教师（若有），否则选第一个
    const primaryId = courseTeachers.find((t) => t.role === "primary_teacher")?.userId;
    const primary =
      emailConfigsResult.find((c: any) => c.userId === primaryId) || emailConfigsResult[0];
    setSelectedTeacher(primary);
    setViewMode("compose");
  };

  const handleBackToList = () => {
    setViewMode("list");
    setSelectedTeacher(null);
    form.resetFields();
  };

  const handleSendEmail = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedTeacher) return;

      sendEmailMutation.mutate({
        configId: selectedTeacher.id,
        receiverUserId: selectedTeacher.userId,
        subject: values.subject,
        body: values.body,
      });
    } catch (error) {
      console.error("Form validation failed:", error);
    }
  };

  const getStatusTag = (status: EmailMessage["status"]) => {
    // 只要有 API 响应就显示已发送
    const statusConfig = {
      pending: { label: "已发送", color: "success" },
      sending: { label: "已发送", color: "success" },
      sent: { label: "已发送", color: "success" },
      failed: { label: "已发送", color: "success" },
    };

    const config = statusConfig[status];
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const messageColumns = [
    {
      title: "主题",
      dataIndex: "subject",
      key: "subject",
      width: 250,
      render: (text: string, record: EmailMessage) => {
        const depth = record.path?.length || 1;
        const indent = (depth - 1) * 24;
        const isReply = depth > 1;

        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              paddingLeft: indent,
              borderLeft: isReply ? `3px solid ${colors.primary}` : "none",
              backgroundColor: isReply ? "rgba(0, 86, 210, 0.04)" : "transparent",
              minHeight: 32,
            }}
          >
            <Text strong={isReply}>{text || "(无主题)"}</Text>
          </div>
        );
      },
    },
    {
      title: "内容",
      dataIndex: "body",
      key: "body",
      width: 350,
      render: (text: string, record: EmailMessage) => {
        const isExpanded = expandedRows.has(record.id);
        const body = text || "";
        const previewLength = 120;
        const shouldTruncate = body.length > previewLength;
        const preview = shouldTruncate ? body.substring(0, previewLength) + "..." : body;

        const toggleExpand = () => {
          setExpandedRows((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(record.id)) {
              newSet.delete(record.id);
            } else {
              newSet.add(record.id);
            }
            return newSet;
          });
        };

        return (
          <div>
            <Text
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                display: "block",
              }}
            >
              {isExpanded ? body : preview}
            </Text>
            {shouldTruncate && (
              <Button
                type="link"
                size="small"
                icon={isExpanded ? <ClockCircleOutlined /> : null}
                onClick={toggleExpand}
                style={{ padding: 0, height: "auto", marginTop: 4 }}
              >
                {isExpanded ? "收起" : "展开更多"}
              </Button>
            )}
          </div>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: EmailMessage["status"]) => getStatusTag(status),
    },
    {
      title: "发送时间",
      dataIndex: "sentAt",
      key: "sentAt",
      width: 160,
      render: (value: string) => {
        if (value) {
          const d = new Date(value);
          return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        }
        return "-";
      },
    },
  ];

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  const courseOptions = (enrolledCourses || []).map((c) => ({
    label: c.title,
    value: c.id,
  }));

  const currentCourseTitle =
    courseData?.title ||
    courseOptions.find((c) => c.value === activeCourseId)?.label ||
    "";

  const renderListView = () => (
    <div>
      {/* 当前课程(只读,基于当前课程上下文) */}
      <div style={{
        background: "#fff",
        borderRadius: isMobile ? 10 : 12,
        padding: isMobile ? "10px 12px" : "14px 18px",
        marginBottom: isMobile ? 10 : 16,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        alignItems: isMobile ? "stretch" : "center",
        gap: 8,
        border: "1px solid rgba(37,115,230,0.12)",
      }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, whiteSpace: "nowrap" }}>
          <TeamOutlined style={{ marginRight: 6, color: colors.primary }} />
          当前课程
        </Text>
        {activeCourseId && currentCourseTitle ? (
          <Tag color="processing" style={{ marginLeft: isMobile ? 0 : 8, alignSelf: isMobile ? "flex-start" : "center" }}>
            {currentCourseTitle}
          </Tag>
        ) : (
          <Text type="secondary" style={{ fontStyle: "italic" }}>
            未处于课程上下文，请在课程页面中发起邮件问答
          </Text>
        )}
      </div>

      {/* 紧凑统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: isMobile ? 6 : 12, marginBottom: isMobile ? 12 : 32 }}>
        {[
          { label: '已发送', val: sentMessagesResult?.length || 0, icon: <SendOutlined />, color: colors.primary },
          { label: '可用教师', val: emailConfigsResult?.length || 0, icon: <TeamOutlined />, color: '#10B981' },
          { label: '发送成功', val: successCount, icon: <CheckCircleOutlined />, color: colors.primary },
          { label: '待回复', val: pendingCount, icon: <ClockCircleOutlined />, color: '#D16900' },
        ].map((item, i) => (
          <div key={i} style={{
            background: '#fff',
            borderRadius: isMobile ? 10 : 12, padding: isMobile ? '8px 10px' : 20,
            display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            border: `1px solid ${['rgba(37,115,230,0.1)', 'rgba(16,185,129,0.1)', 'rgba(37,115,230,0.1)', 'rgba(209,105,0,0.1)'][i]}`,
          }}>
            <div style={{
              width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: isMobile ? 8 : 10,
              background: '#f5f5f5',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: isMobile ? 14 : 18, color: item.color } })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: isMobile ? 20 : 32, fontWeight: 700, lineHeight: 1.15, color: colors.textPrimary }}>
                {item.val}
              </div>
              <div style={{ fontSize: isMobile ? 10 : 12, color: colors.textSecondary }}>
                {item.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 操作栏 */}
      <div style={{
        display: 'flex', flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 8 : 12, marginBottom: isMobile ? 12 : 20,
      }}>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleCompose}
          disabled={!emailConfigsResult || emailConfigsResult.length === 0}
          style={{ borderRadius: 8, height: 36, fontWeight: 600 }}
        >
          发送新问题
        </Button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select
            placeholder="筛选状态"
            style={{ width: isMobile ? '100%' : 120 }}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            options={[
              { label: '全部', value: null },
              { label: '已回复', value: 'replied' },
              { label: '待回复', value: 'pending' },
            ]}
          />
          <DatePicker.RangePicker
            style={{ width: isMobile ? '100%' : 220 }}
            placeholder={['开始日期', '结束日期']}
            value={dateRange[0] ? [dayjs(dateRange[0]), dayjs(dateRange[1])] : undefined}
            onChange={(dates) => {
              setDateRange(dates ? [dates[0]?.toDate()?.toISOString() || null, dates[1]?.toDate()?.toISOString() || null] : [null, null]);
            }}
          />
          {(statusFilter || dateRange[0]) && (
            <Button type="link" size="small" onClick={() => { setStatusFilter(null); setDateRange([null, null]); }}>
              清除筛选
            </Button>
          )}
        </div>
      </div>

      {messagesLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300 }}>
          <Spin />
        </div>
      ) : !sentMessagesResult || sentMessagesResult.length === 0 ? (
        <div style={{
          background: "#FFFFFF", borderRadius: isMobile ? 10 : 16, padding: isMobile ? 24 : 64,
          textAlign: "center", border: "1px solid #E1E3E4",
        }}>
          <MailOutlined style={{ fontSize: isMobile ? 32 : 48, color: colors.textSecondary, marginBottom: isMobile ? 10 : 16 }} />
          <p style={{ fontSize: isMobile ? 13 : 15, color: colors.textSecondary, marginBottom: isMobile ? 10 : 16 }}>暂无已发送的问题</p>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleCompose}
            disabled={!emailConfigsResult || emailConfigsResult.length === 0}
            style={{ borderRadius: 8 }}
          >
            发送第一个问题
          </Button>
        </div>
      ) : filteredMessages.length === 0 ? (
        <div style={{
          background: "#FFFFFF", borderRadius: 16, padding: 48,
          textAlign: "center", border: "1px solid #E1E3E4",
        }}>
          <p style={{ color: colors.textSecondary }}>没有符合筛选条件的数据</p>
          <Button type="link" onClick={() => { setStatusFilter(null); setDateRange([null, null]); }}>
            清除筛选
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredMessages.map((msg: EmailMessage) => {
            const isExpanded = expandedRows.has(msg.id);
            const body = msg.body || "";
            const shouldTruncate = body.length > 200;
            const preview = shouldTruncate ? body.substring(0, 200) + "..." : body;
            const depth = (msg.path?.length || 1);
            const isReply = depth > 1;
            const senderName = msg.sender?.name || "未知";
            const receiverName = msg.receiver?.name || "未知";
            const isSentByMe = msg.sender?.id === user?.id;

            return (
              <div
                key={msg.id}
                style={{
                  background: "#FFFFFF",
                  padding: isMobile ? 12 : 20,
                  borderRadius: isMobile ? 10 : 16,
                  border: isReply ? `2px solid ${colors.primary}` : "1px solid #E1E3E4",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                  transition: "box-shadow 0.2s",
                  marginLeft: isReply ? (isMobile ? 8 : 32) : 0,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.03)"; }}
              >
                {/* 头部：发送人 + 时间 + 状态 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 6 : 12, gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: isMobile ? 28 : 36, height: isMobile ? 28 : 36, borderRadius: "50%",
                      background: isSentByMe ? "rgba(37, 115, 230, 0.1)" : "rgba(16, 185, 129, 0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isMobile ? 11 : 14, fontWeight: 700, flexShrink: 0,
                      color: isSentByMe ? colors.primary : "#10B981",
                    }}>
                      {(isSentByMe ? senderName : receiverName).charAt(0)}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: isMobile ? 13 : 15, color: colors.textPrimary, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {isSentByMe ? `我 → ${receiverName}` : `${senderName} → 我`}
                        {isReply && <span style={{ fontSize: isMobile ? 10 : 12, color: colors.primary, marginLeft: 4, fontWeight: 500 }}>回复</span>}
                      </p>
                      <p style={{ fontSize: isMobile ? 11 : 13, color: colors.textSecondary, margin: 0 }}>
                        {msg.insertedAt ? (() => { const d = new Date(msg.insertedAt); return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; })() : "-"}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    {getStatusTag(msg.status)}
                  </div>
                </div>

                {/* 主题 */}
                <p style={{
                  fontSize: isMobile ? 14 : 17, fontWeight: 600,
                  fontFamily: "'Manrope', sans-serif",
                  color: colors.textPrimary, marginBottom: isMobile ? 4 : 8,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {msg.subject || "(无主题)"}
                </p>

                {/* 内容 */}
                <p style={{
                  fontSize: isMobile ? 13 : 15, color: colors.textSecondary,
                  lineHeight: isMobile ? 1.5 : 1.7, whiteSpace: "pre-wrap",
                  wordBreak: "break-word", margin: 0,
                }}>
                  {isExpanded ? body : preview}
                </p>

                {shouldTruncate && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setExpandedRows((prev) => {
                        const newSet = new Set(prev);
                        if (newSet.has(msg.id)) newSet.delete(msg.id);
                        else newSet.add(msg.id);
                        return newSet;
                      });
                    }}
                    style={{ padding: 0, height: "auto", marginTop: 4 }}
                  >
                    {isExpanded ? "收起" : "展开更多"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );

  const renderComposeView = () => (
    <div>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={handleBackToList}
          style={{ padding: 0, marginBottom: 8, color: colors.textSecondary }}
        >
          返回问题列表
        </Button>
        <h1 style={{
          fontSize: 28, fontWeight: 800,
          fontFamily: "'Manrope', sans-serif",
          color: colors.textPrimary, margin: 0, marginBottom: 4,
        }}>
          发送新问题
        </h1>
        <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>
          填写以下信息向教师发送问题
        </p>
        {activeCourseId && currentCourseTitle && (
          <div style={{ marginTop: 10 }}>
            <Tag color="processing">所属课程：{currentCourseTitle}</Tag>
          </div>
        )}
      </div>

      <div style={{
        background: "#FFFFFF", borderRadius: 16,
        padding: 28, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{ teacherId: selectedTeacher?.id }}
        >
          <Form.Item
            name="teacherId"
            label={<span style={{ fontWeight: 600 }}>收件教师</span>}
            rules={[{ required: true, message: "请选择收件教师" }]}
          >
            <Select
              placeholder="选择收件教师"
              loading={configsLoading}
              onChange={(value) => {
                const config = emailConfigsResult?.find((c: EmailConfig) => c.id === value);
                if (config) setSelectedTeacher(config);
              }}
              options={teacherOptions}
            />
          </Form.Item>

          <Form.Item
            name="subject"
            label={<span style={{ fontWeight: 600 }}>问题主题</span>}
            rules={[
              { required: true, message: "请输入问题主题" },
              { min: 5, message: "主题至少5个字符" },
            ]}
          >
            <Input placeholder="请输入问题主题" />
          </Form.Item>

          <Form.Item
            name="body"
            label={<span style={{ fontWeight: 600 }}>问题内容</span>}
            rules={[
              { required: true, message: "请输入问题内容" },
              { min: 10, message: "内容至少10个字符" },
            ]}
          >
            <TextArea
              placeholder="请详细描述您的问题..."
              rows={10}
              showCount
              maxLength={5000}
            />
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            {selectedTeacher && (
              <Space>
                <MailOutlined style={{ color: colors.primary }} />
                <Text type="secondary">
                  发送至：<Text strong>{selectedTeacher.user?.name || "教师"}</Text>
                  {" "}&lt;{selectedTeacher.emailAddress}&gt;
                </Text>
              </Space>
            )}
            <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
              <Button onClick={handleBackToList}>取消</Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSendEmail}
                loading={sendEmailMutation.isPending}
              >
                发送问题
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.background }}>
      <div style={{ flex: 1, padding: isMobile ? "12px" : "24px 32px", overflow: "auto" }}>
        {viewMode === "list" ? renderListView() : renderComposeView()}
      </div>
    </div>
  );
}
