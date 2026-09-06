import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Table,
  Button,
  Typography,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Spin,
  Alert,
  message,
  Badge,
  Row,
  Col,
  DatePicker,
  Select,
  Popover,
  Tooltip,
} from "antd";
import { MailOutlined, RollbackOutlined, CheckOutlined, TeamOutlined, FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, LoadingOutlined, DownOutlined, RightOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listEmailMessages, replyEmail, markAsRead } from "@/lib/ash_rpc";

// 解析 API 错误消息，转换为友好文本
const parseErrorMessage = (error: any): string => {
  // 字符串格式的错误
  if (error && typeof error === "string") {
    // Elixir 元组格式 {:http_error, 400, %{...}} 或 {:http_error, "..."}
    const tupleMatch3 = error.match(/^\{:([^,]+),\s*([^,]+),\s*(.+)\}$/);
    if (tupleMatch3) {
      const [, errorType, code, detail] = tupleMatch3;
      if (errorType === "http_error") {
        // 尝试解析内部详情
        const innerMatch = detail.match(/\{"message"\s*=>\s*"([^"]+)"/);
        if (innerMatch) {
          return `邮件发送失败: ${innerMatch[1]}`;
        }
        return `邮件发送失败: ${detail}`;
      }
      return `${errorType}: ${code} - ${detail}`;
    }
    // 二元组格式 {:http_error, "..."}
    const tupleMatch2 = error.match(/^\{:([^,]+),\s*(.+)\}$/);
    if (tupleMatch2) {
      const [, errorType, errorDetail] = tupleMatch2;
      if (errorType === "http_error") {
        if (typeof errorDetail === "string") {
          if (errorDetail.includes("timeout")) return "请求超时，请检查网络连接";
          if (errorDetail.includes("ECONNREFUSED")) return "无法连接到服务器";
          if (errorDetail.includes("ENOTFOUND")) return "服务器地址不存在";
          return `网络错误: ${errorDetail}`;
        }
        return `网络错误: ${JSON.stringify(errorDetail)}`;
      }
      return `${errorType}: ${errorDetail}`;
    }
    // 直接返回原始字符串
    return error;
  }

  // 对象格式的错误
  if (error?.message && typeof error.message === "string") {
    return error.message;
  }
  if (error?.errors && Array.isArray(error.errors)) {
    return error.errors.map((e: any) => e.message || e.detail || JSON.stringify(e)).join("; ");
  }
  // 默认
  return "操作失败，请稍后重试";
};
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

const colors = {
  primary: "#0056D2",
  textSecondary: "#5E5E5E",
  border: "#E0E0E0",
  success: "#52c41a",
};

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  status: "pending" | "sending" | "sent" | "failed";
  readStatus?: "unread" | "read";
  readAt?: string | null;
  errorMessage?: string;
  sentAt?: string;
  failedAt?: string;
  senderId: string;
  senderName?: string;
  senderEmail?: string;
  receiverId: string;
  receiverName?: string;
  receiverEmail?: string;
  insertedAt: string;
  parentMessageId?: string | null;
  path?: string[];
  children?: EmailMessage[];
}

export default function EmailMessagesList() {
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(
    null,
  );
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [expandedContentRows, setExpandedContentRows] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);

  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const { data: messagesResult, isLoading } = useQuery({
    queryKey: ["email-messages", "all", user?.id],
    queryFn: async () => {
      const result = await listEmailMessages({
        tenant,
        // 教师只能看到收件人/发件人为自己的消息，不显示其他教师的邮件问答
        filter: {
          or: [
            { receiverUserId: { eq: user!.id } },
            { senderUserId: { eq: user!.id } },
          ],
        },
        fields: [
          "id",
          "subject",
          "body",
          "status",
          "readStatus",
          "readAt",
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
        page: { limit: 200, offset: 0 },
        headers,
      });

      if (result.success && result.data) {
        const rawData = result.data as any;
        const messages = Array.isArray(rawData)
          ? rawData
          : rawData.results || rawData.data || [];
        const messageMap = new Map<string, EmailMessage>();
        const rootMessages: EmailMessage[] = [];

        messages.forEach((msg: any) => {
          const message: EmailMessage = {
            ...msg,
            parentMessageId: msg.parentMessageId || null,
          };

          if (!message.parentMessageId) {
            message.path = [message.id];
            message.children = [];
            messageMap.set(message.id, message);
            rootMessages.push(message);
          } else {
            messageMap.set(message.id, message);
          }
        });

        messageMap.forEach((msg) => {
          if (msg.parentMessageId && messageMap.has(msg.parentMessageId)) {
            const parent = messageMap.get(msg.parentMessageId)!;
            msg.path = [...(parent.path || [parent.id]), msg.id];
            if (!parent.children) {
              parent.children = [];
            }
            parent.children.push(msg);
          }
        });

        return rootMessages;
      }
      return [];
    },
    enabled: !!tenant && !!user,
  });

  // 参与对话的学生（非当前教师本人）选项
  const studentOptions = React.useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();
    (messagesResult || []).forEach((msg: any) => {
      [msg.sender, msg.receiver].forEach((p) => {
        if (!p?.id || p.id === user?.id) return;
        if (!map.has(p.id)) {
          map.set(p.id, {
            value: p.id,
            label: p.name || p.email || "未知",
          });
        }
      });
    });
    return Array.from(map.values());
  }, [messagesResult, user?.id]);

  // 消息涉及的课程选项
  const courseOptions = React.useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();
    (messagesResult || []).forEach((msg: any) => {
      const c = msg.course;
      if (c?.id && !map.has(c.id)) {
        map.set(c.id, { value: c.id, label: c.title || "未知课程" });
      }
    });
    return Array.from(map.values());
  }, [messagesResult]);

  const filteredMessages = React.useMemo(() => {
    if (!messagesResult) return [];
    return messagesResult.filter((msg: EmailMessage) => {
      if (statusFilter && msg.status !== statusFilter) return false;
      if (statusFilter === "sent" && dateRange[0] && dateRange[1]) {
        if (!msg.sentAt) return false;
        const sentDate = dayjs(msg.sentAt);
        if (sentDate.isBefore(dateRange[0]) || sentDate.isAfter(dateRange[1])) return false;
      }
      // 按学生过滤：消息的发送者或接收者中包含该学生
      if (studentFilter) {
        const senderId = (msg as any).sender?.id;
        const receiverId = (msg as any).receiver?.id;
        if (senderId !== studentFilter && receiverId !== studentFilter) return false;
      }
      // 按课程过滤
      if (courseFilter) {
        if ((msg as any).course?.id !== courseFilter) return false;
      }
      return true;
    });
  }, [messagesResult, statusFilter, dateRange, studentFilter, courseFilter]);

  const totalMessages = messagesResult?.filter((m: EmailMessage) => !m.parentMessageId).length || 0;
  const unreadCount = messagesResult?.filter((m: EmailMessage) => m.readStatus === "unread" && !m.parentMessageId).length || 0;
  const successCount = messagesResult?.filter((m: EmailMessage) => m.status === "sent").length || 0;

  const replyMutation = useMutation({
    mutationFn: async ({
      subject,
      body,
      parentMessageId,
    }: {
      subject: string;
      body: string;
      parentMessageId: string;
    }) => {
      return replyEmail({
        tenant,
        input: {
          subject,
          body,
          parentMessageId,
          senderUserId: user!.id,
        },
        fields: [
          "id",
          "subject",
          "body",
          "status",
          "insertedAt",
          "parentMessageId",
        ],
        headers,
      });
    },
    onSuccess: () => {
      message.success("回复发送成功");
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
      setReplyDialogOpen(false);
      setReplySubject("");
      setReplyBody("");
      setSelectedMessage(null);
    },
    onError: (error: any) => {
      message.error(parseErrorMessage(error));
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return markAsRead({
        tenant,
        primaryKey: messageId,
        fields: ["id", "readStatus", "readAt"],
        headers,
      });
    },
    onSuccess: () => {
      message.success("标记已读成功");
      queryClient.invalidateQueries({ queryKey: ["email-messages"] });
      // 同步刷新左侧菜单的邮件未读数量
      queryClient.invalidateQueries({ queryKey: ["email-messages-unread-count"] });
    },
    onError: (error: any) => {
      message.error(parseErrorMessage(error));
    },
  });

  const handleReply = (message: EmailMessage) => {
    setSelectedMessage(message);
    setReplySubject(`Re: ${message.subject}`);
    setReplyBody("");
    setReplyDialogOpen(true);
  };

  const handleReplySubmit = () => {
    if (!selectedMessage || !replySubject.trim() || !replyBody.trim()) {
      return;
    }
    replyMutation.mutate({
      subject: replySubject,
      body: replyBody,
      parentMessageId: selectedMessage.id,
    }, {
      onSuccess: () => {
        if (selectedMessage.readStatus !== "read") {
          markAsReadMutation.mutate(selectedMessage.id);
        }
      },
    });
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: "待发送", color: "default" },
      sending: { label: "发送中", color: "processing" },
      sent: { label: "已发送", color: "success" },
      failed: { label: "发送失败", color: "error" },
    };
    return statusMap[status] || { label: status, color: "default" };
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns: ColumnsType<EmailMessage> = [
    {
      title: "主题",
      dataIndex: "subject",
      key: "subject",
      width: 350,
      render: (subject: string, record: EmailMessage) => {
        const isReply = !!record.parentMessageId;
        const isUnread = record.readStatus === "unread" && !record.parentMessageId;
        const hasChildren = record.children && record.children.length > 0;
        const isExpanded = expandedRowKeys.includes(record.id);

        const handleExpand = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (hasChildren) {
            setExpandedRowKeys(prev => 
              prev.includes(record.id) 
                ? prev.filter(k => k !== record.id)
                : [...prev, record.id]
            );
          }
        };

        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              whiteSpace: "nowrap",
              overflow: "hidden",
            }}
          >
            {hasChildren ? (
              <Tooltip title={isExpanded ? "收起回复" : `查看${record.children.length}条回复`}>
                <Button
                  type="text"
                  size="small"
                  onClick={handleExpand}
                  style={{ padding: "0 2px", minWidth: 20, marginRight: 4 }}
                >
                  {isExpanded ? 
                    <DownOutlined style={{ color: colors.primary, fontSize: 12 }} /> : 
                    <RightOutlined style={{ color: colors.primary, fontSize: 12 }} />
                  }
                </Button>
              </Tooltip>
            ) : <span style={{ width: 24 }} />}
            {isUnread && <Badge color="red" />}
            <MailOutlined style={{ color: isReply ? colors.primary : "#8c8c8c", fontSize: 14 }} />
            <Text strong={isReply || isUnread} ellipsis={{ tooltip: true }} style={{ flex: 1 }}>{subject || "(无主题)"}</Text>
          </div>
        );
      },
    },
    {
      title: "内容",
      dataIndex: "body",
      key: "body",
      width: 200,
      render: (body: string, record: EmailMessage) => {
        if (!body) return "-";
        const isExpanded = expandedContentRows.has(record.id);
        const previewLength = 60;
        const shouldTruncate = body.length > previewLength;
        const preview = shouldTruncate ? body.substring(0, previewLength) + "..." : body;

        const toggleExpand = () => {
          setExpandedContentRows((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(record.id)) {
              newSet.delete(record.id);
            } else {
              newSet.add(record.id);
            }
            return newSet;
          });
        };

        if (isExpanded) {
          return (
            <div style={{ padding: 8, background: "#f5f5f5", borderRadius: 4, maxHeight: 200, overflow: "auto" }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 12, fontFamily: "inherit" }}>{body}</pre>
              <Button type="link" size="small" onClick={toggleExpand} style={{ padding: 0, marginTop: 4 }}>
                收起
              </Button>
            </div>
          );
        }

        return (
          <div>
            <Text style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }} ellipsis={{ tooltip: preview }}>
              {preview}
            </Text>
            {shouldTruncate && (
              <Button type="link" size="small" onClick={toggleExpand} style={{ padding: 0, height: "auto", marginTop: 2 }}>
                展开
              </Button>
            )}
          </div>
        );
      },
    },
    {
      title: "课程",
      key: "course",
      width: 130,
      render: (_: any, record: EmailMessage) => {
        const course = (record as any).course;
        if (!course?.title) return <Text type="secondary">-</Text>;
        return (
          <Tooltip title={course.title}>
            <Tag color="processing" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
              {course.title}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "发件人",
      key: "sender",
      width: 100,
      render: (_: any, record: EmailMessage) => {
        const sender = (record as any).sender;
        const email = sender?.email;
        const name = sender?.name || "未知";
        if (!email) return name;
        return (
          <Popover content={<Space direction="vertical" size={0}><div>{name}</div><div style={{ cursor: "pointer", color: colors.primary }} onClick={() => { navigator.clipboard.writeText(email); message.success("已复制邮箱"); }}>{email} (点击复制)</div></Space>} trigger="hover">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <MailOutlined style={{ color: colors.primary }} />
              <Text ellipsis={{ tooltip: email }} style={{ maxWidth: 60 }}>{name}</Text>
            </div>
          </Popover>
        );
      },
    },
    {
      title: "收件人",
      key: "receiver",
      width: 100,
      render: (_: any, record: EmailMessage) => {
        const receiver = (record as any).receiver;
        const email = receiver?.email;
        const name = receiver?.name || "未知";
        if (!email) return name;
        return (
          <Popover content={<Space direction="vertical" size={0}><div>{name}</div><div style={{ cursor: "pointer", color: colors.primary }} onClick={() => { navigator.clipboard.writeText(email); message.success("已复制邮箱"); }}>{email} (点击复制)</div></Space>} trigger="hover">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              <MailOutlined style={{ color: colors.primary }} />
              <Text ellipsis={{ tooltip: email }} style={{ maxWidth: 80 }}>{name}</Text>
            </div>
          </Popover>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 60,
      render: (status: string, record: EmailMessage) => {
        const statusIcons: Record<string, React.ReactNode> = {
          pending: <ClockCircleOutlined style={{ color: "#8c8c8c", fontSize: 16 }} />,
          sending: <Spin indicator={<LoadingOutlined style={{ fontSize: 14 }} spin />} />,
          sent: <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />,
          failed: <CloseCircleOutlined style={{ color: "#ff4d4f", fontSize: 16 }} />,
        };
        return <Tooltip title={formatStatus(status).label}>{statusIcons[status] || "-"}</Tooltip>;
      },
    },
    {
      title: "发送时间",
      dataIndex: "sentAt",
      key: "sentAt",
      width: 140,
      render: (date: string) => formatDate(date),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: any, record: EmailMessage) => {
        if (!record.parentMessageId) {
          const isUnread = record.readStatus === "unread";
          // 只能回复收件人是自己的消息
          const receiver = (record as any).receiver;
          const canReply = receiver?.id === user?.id;
          return (
            <Space direction="vertical" size="small" style={{ marginTop: 4 }}>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                onClick={() => handleReply(record)}
                disabled={!canReply}
                title={canReply ? "回复" : "仅收件人可回复"}
                loading={replyMutation.isPending}
              >
                回复
              </Button>
              {isUnread && (
                <Button size="small" icon={<CheckOutlined />} onClick={() => markAsReadMutation.mutate(record.id)} loading={markAsReadMutation.isPending}>
                  已读
                </Button>
              )}
            </Space>
          );
        }
        return null;
      },
    },
    {
      title: "状态详情",
      key: "statusDetail",
      width: 60,
      render: (_: any, record: EmailMessage) => {
        if (record.status === "failed") {
          return (
            <Popover
              content={
                <div style={{ maxWidth: 300 }}>
                  <div style={{ marginBottom: 8, fontWeight: "bold" }}>失败时间: {formatDate(record.failedAt)}</div>
                  <div style={{ color: "#ff4d4f" }}>{parseErrorMessage(record.errorMessage)}</div>
                </div>
              }
              trigger="hover"
            >
              <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                <Badge color="red" />
                <Text type="secondary" style={{ fontSize: 12 }}>详情</Text>
              </div>
            </Popover>
          );
        }
        return "-";
      },
    },
  ];

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="用户未登录"
          description="请登录以访问邮件消息列表。"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", backgroundColor: "#F8F9FA" }}>
      <div style={{ backgroundColor: "white", borderBottom: "1px solid #e0e0e0", padding: "16px 24px" }}>
        <Title level={2} style={{ fontWeight: 700, color: "#333", marginBottom: 16 }}>
          邮件消息列表
        </Title>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{
                background: "linear-gradient(135deg, rgba(0, 86, 210, 0.08) 0%, #fff 100%)",
                border: "1px solid rgba(0, 86, 210, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "rgba(0, 86, 210, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <MailOutlined style={{ fontSize: 18, color: "#0056D2" }} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#0056D2", lineHeight: 1.2 }}>
                    {totalMessages}
                  </div>
                  <div style={{ fontSize: 12, color: "#5E5E5E" }}>邮件总数</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{
                background: "linear-gradient(135deg, rgba(255, 77, 79, 0.08) 0%, #fff 100%)",
                border: "1px solid rgba(255, 77, 79, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "rgba(255, 77, 79, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <Badge color="red" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#ff4d4f", lineHeight: 1.2 }}>
                    {unreadCount}
                  </div>
                  <div style={{ fontSize: 12, color: "#5E5E5E" }}>未读邮件</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card
              size="small"
              style={{
                background: "linear-gradient(135deg, rgba(82, 196, 26, 0.08) 0%, #fff 100%)",
                border: "1px solid rgba(82, 196, 26, 0.15)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: "rgba(82, 196, 26, 0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  <CheckCircleOutlined style={{ fontSize: 18, color: "#52c41a" }} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#52c41a", lineHeight: 1.2 }}>
                    {successCount}
                  </div>
                  <div style={{ fontSize: 12, color: "#5E5E5E" }}>发送成功</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        {unreadCount > 0 && (
          <div style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={async () => {
                const unreadMessages = messagesResult?.filter(
                  (msg: EmailMessage) => msg.readStatus === "unread" && !msg.parentMessageId
                ) || [];
                for (const msg of unreadMessages) {
                  await markAsReadMutation.mutateAsync(msg.id);
                }
                message.success(`已标记 ${unreadMessages.length} 封邮件为已读`);
              }}
              loading={markAsReadMutation.isPending}
            >
              一键已读 ({unreadCount})
            </Button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
        <Card styles={{ body: { padding: 16 } }}>
          <div style={{ marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary">状态:</Text>
              <Select
                placeholder="全部状态"
                allowClear
                style={{ width: 120 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { label: "等待中", value: "pending" },
                  { label: "发送中", value: "sending" },
                  { label: "已发送", value: "sent" },
                  { label: "发送失败", value: "failed" },
                ]}
              />
            </div>
            {statusFilter === "sent" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Text type="secondary">发送时间:</Text>
                <DatePicker.RangePicker
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                  style={{ width: 240 }}
                  placeholder={["开始日期", "结束日期"]}
                />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary">学生:</Text>
              <Select
                placeholder="全部学生"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: 140 }}
                value={studentFilter}
                onChange={setStudentFilter}
                options={studentOptions}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Text type="secondary">课程:</Text>
              <Select
                placeholder="全部课程"
                allowClear
                showSearch
                optionFilterProp="label"
                style={{ width: 160 }}
                value={courseFilter}
                onChange={setCourseFilter}
                options={courseOptions}
              />
            </div>
            {(statusFilter || dateRange[0] || studentFilter || courseFilter) && (
              <Button 
                type="link" 
                size="small" 
                onClick={() => {
                  setStatusFilter(null);
                  setDateRange([null, null]);
                  setStudentFilter(null);
                  setCourseFilter(null);
                }}
              >
                清除筛选
              </Button>
            )}
          </div>

          {isLoading ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: 300,
              }}
            >
              <Spin size="large" />
            </div>
          ) : filteredMessages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Text type="secondary">没有符合条件的数据</Text>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={filteredMessages}
              rowKey="id"
              loading={isLoading}
              size="small"
              pagination={{
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
                defaultPageSize: 10,
                pageSizeOptions: ["10", "25", "50", "100"],
              }}
              expandable={{
                expandedRowKeys,
                onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                rowExpandable: (record) =>
                  !!record.children && record.children.length > 0,
                childrenColumnName: "children",
                defaultExpandAllRows: true,
                showExpandColumn: false,
              }}
            />
          )}
        </Card>
      </div>

      <Modal
        title="回复邮件"
        open={replyDialogOpen}
        onCancel={() => setReplyDialogOpen(false)}
        footer={null}
        width={600}
      >
        {selectedMessage && (
          <div style={{ marginBottom: 16 }}>
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: 4 }}
            >
              原主题: {selectedMessage.subject}
            </Text>
            <Text type="secondary" style={{ display: "block" }}>
              原发件人:{" "}
              {(selectedMessage as any).sender?.name ||
                (selectedMessage as any).sender?.email ||
                "未知"}
            </Text>
          </div>
        )}
        <Form layout="vertical">
          <Form.Item label="主题" required>
            <Input
              value={replySubject}
              onChange={(e) => setReplySubject(e.target.value)}
              disabled={replyMutation.isPending}
            />
          </Form.Item>
          <Form.Item label="回复内容" required>
            <TextArea
              rows={8}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              disabled={replyMutation.isPending}
              placeholder="请输入回复内容..."
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Space>
              <Button onClick={() => setReplyDialogOpen(false)}>取消</Button>
              <Button
                type="primary"
                onClick={handleReplySubmit}
                disabled={!replySubject.trim() || !replyBody.trim()}
                loading={replyMutation.isPending}
              >
                发送
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
