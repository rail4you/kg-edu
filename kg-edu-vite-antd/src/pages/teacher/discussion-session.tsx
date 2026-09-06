import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Table,
  Space,
  Tag,
  Modal,
  Input,
  Select,
  message,
  Popconfirm,
  Spin,
  Empty,
  Avatar,
  Tooltip,
  QRCode,
  Tabs,
  Progress,
} from "antd";
import type { TableColumnsType, TabsProps } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  CopyOutlined,
  MessageOutlined,
  CloseOutlined,
  EyeOutlined,
  UserOutlined,
  BarChartOutlined,
  TeamOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listDiscussionSessions,
  createDiscussionSession,
  closeDiscussionSession,
  deleteDiscussionSession,
  listDiscussionsBySession,
  listEnrollmentsByCourse,
  listUsers,
  createReply,
  listRepliesByDiscussion,
} from "@/lib/ash_rpc";
import type { DiscussionSessionResourceSchema } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

function EChartsChart({ options, height = 280 }: { options: any; height?: number }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption(options);
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [options]);

  return <div ref={chartRef} style={{ width: "100%", height }} />;
}

interface DiscussionSession extends DiscussionSessionResourceSchema {
  discussionCount?: number;
}

const copyToClipboard = (text: string): boolean => {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).catch(() => {});
    return true;
  }

  const textElement = document.createElement("span");
  textElement.textContent = text;
  textElement.style.position = "fixed";
  textElement.style.left = "-9999px";
  textElement.style.top = "-9999px";
  textElement.style.whiteSpace = "pre";
  textElement.style.userSelect = "text";

  document.body.appendChild(textElement);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(textElement);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    const successful = document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(textElement);
    return successful;
  } catch {
    selection?.removeAllRanges();
    document.body.removeChild(textElement);
    return false;
  }
};

export default function DiscussionSessionManagement() {
  const { user, tenant, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<DiscussionSession | null>(null);
  const [detailSession, setDetailSession] = useState<DiscussionSession | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    courseId: "",
  });

  // 回复相关状态
  const [selectedDiscussion, setSelectedDiscussion] = useState<any | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  const { data: sessionsResult, isLoading } = useQuery({
    queryKey: ["discussion-sessions", user?.id, tenant],
    queryFn: async () => {
      const result = await listDiscussionSessions({
        tenant: tenant!,
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
        filter: { createdBy: { id: { eq: user!.id } } },
        sort: "-startedAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const sessions = Array.isArray(data) ? data : data.results || data.data || [];
        return { data: sessions };
      }
      return { data: [] };
    },
    enabled: !!user && !!tenant,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return createDiscussionSession({
        tenant: tenant!,
        fields: ["id", "title", "description", "courseId", "token", "status", "startedAt", { course: ["id", "title"] }],
        input: {
          title: data.title,
          description: data.description || undefined,
          courseId: data.courseId,
          createdById: user!.id,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("讨论会话创建成功");
      queryClient.invalidateQueries({ queryKey: ["discussion-sessions"] });
      setDialogOpen(false);
      setFormData({ title: "", description: "", courseId: "" });
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return closeDiscussionSession({
        tenant: tenant!,
        primaryKey: sessionId,
        fields: ["id", "status", "endedAt"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("讨论会话已关闭");
      queryClient.invalidateQueries({ queryKey: ["discussion-sessions"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "关闭失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return deleteDiscussionSession({
        tenant: tenant!,
        primaryKey: sessionId,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("讨论会话已删除");
      queryClient.invalidateQueries({ queryKey: ["discussion-sessions"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  // 详情 Modal：获取讨论帖子（按会话ID过滤）
  const { data: detailDiscussionsResult, isLoading: detailDiscussionsLoading, refetch: refetchDetailDiscussions } = useQuery({
    queryKey: ["detail-discussions", detailSession?.id, tenant],
    queryFn: async () => {
      if (!detailSession?.id) return { data: [] };

      const result = await listDiscussionsBySession({
        tenant: tenant!,
        fields: [
          "id",
          "title",
          "content",
          "replyCount",
          "viewCount",
          "insertedAt",
          { user: ["id", "name", "email"] },
        ],
        input: { discussionSessionId: detailSession.id },
        sort: "-insertedAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const discussions = Array.isArray(data) ? data : data.results || data.data || [];
        return { data: discussions };
      }
      return { data: [] };
    },
    enabled: !!detailSession && !!user && !!tenant,
  });

  // 详情 Modal：获取课程学生列表
  const { data: detailMembersResult, isLoading: detailMembersLoading } = useQuery({
    queryKey: ["detail-members", detailSession?.id, tenant],
    queryFn: async () => {
      if (!detailSession?.courseId) return { data: [] };

      const enrollmentsResult = await listEnrollmentsByCourse({
        tenant: tenant!,
        fields: ["id", "memberId", "enrolledAt"],
        input: { courseId: detailSession.courseId },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (!enrollmentsResult.success || !enrollmentsResult.data) return { data: [] };

      const enrollmentsData = enrollmentsResult.data as any;
      const enrollments = Array.isArray(enrollmentsData) ? enrollmentsData : enrollmentsData.results || enrollmentsData.data || [];

      const memberIds = enrollments.map((e: any) => e.memberId).filter(Boolean);
      if (memberIds.length === 0) return { data: [] };

      const usersResult = await listUsers({
        tenant: tenant!,
        fields: ["id", "name", "email"],
        filter: { id: { in: memberIds } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      const usersMap: Record<string, { name?: string; email?: string }> = {};
      if (usersResult.success && usersResult.data) {
        const usersData = usersResult.data as any;
        const usersList = Array.isArray(usersData) ? usersData : usersResult.data.results || usersResult.data.data || [];
        (usersList as any[]).forEach((u: any) => {
          usersMap[u.id] = { name: u.name, email: u.email };
        });
      }

      const members = enrollments.map((e: any) => ({
        id: e.id,
        memberId: e.memberId,
        name: usersMap[e.memberId]?.name || usersMap[e.memberId]?.email || `用户 ${e.memberId?.substring(0, 8)}`,
      }));

      return { data: members };
    },
    enabled: !!detailSession && !!user && !!tenant,
  });

  const detailDiscussions: any[] = detailDiscussionsResult?.data || [];
  const detailMembers: { id: string; memberId: string; name: string }[] = detailMembersResult?.data || [];

  // 页面加载时批量获取每个讨论的回复数量
  useEffect(() => {
    if (!detailDiscussions.length || !tenant || !user) return;

    const fetchReplyCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        detailDiscussions.map(async (discussion: any) => {
          const result = await listRepliesByDiscussion({
            tenant: tenant!,
            fields: ["id"],
            input: { discussionId: discussion.id },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
          if (result.success && result.data) {
            const data = result.data as any;
            const replies = Array.isArray(data) ? data : data.results || data.data || [];
            counts[discussion.id] = replies.length;
          } else {
            counts[discussion.id] = 0;
          }
        })
      );
      setReplyCounts(counts);
    };

    fetchReplyCounts();
  }, [detailDiscussions.length, tenant, user]);

  // 回复列表查询
  const { data: repliesResult, isLoading: repliesLoading, refetch: refetchReplies } = useQuery({
    queryKey: ["discussion-replies", selectedDiscussion?.id, tenant],
    queryFn: async () => {
      if (!selectedDiscussion?.id) return { data: [] };

      const result = await listRepliesByDiscussion({
        tenant: tenant!,
        fields: ["id", "content", "insertedAt", { user: ["id", "name", "email"] }],
        input: { discussionId: selectedDiscussion.id },
        sort: "insertedAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const replies = Array.isArray(data) ? data : data.results || data.data || [];
        return { data: replies };
      }
      return { data: [] };
    },
    enabled: !!selectedDiscussion && !!user && !!tenant,
  });

  // 创建回复 mutation
  const createReplyMutation = useMutation({
    mutationFn: async ({ content, discussionId }: { content: string; discussionId: string }) => {
      return createReply({
        tenant: tenant!,
        fields: ["id", "content", "insertedAt", { user: ["id", "name", "email"] }],
        input: {
          content,
          discussionId,
          userId: user!.id,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: (_data, variables) => {
      message.success("回复成功");
      setReplyContent("");
      // 更新 replyCounts
      setReplyCounts(prev => ({
        ...prev,
        [variables.discussionId]: (prev[variables.discussionId] || 0) + 1
      }));
      refetchReplies();
      refetchDetailDiscussions();
    },
    onError: (error: any) => {
      message.error(error?.message || "回复失败");
    },
  });

  const replies: any[] = repliesResult?.data || [];

  // 更新 replyCounts 当 repliesResult 变化时
  useEffect(() => {
    if (selectedDiscussion?.id && replies.length > 0) {
      setReplyCounts(prev => ({
        ...prev,
        [selectedDiscussion.id]: replies.length
      }));
    }
  }, [replies, selectedDiscussion?.id]);

  // 聚合每个学生的发帖数据
  const studentStats = detailMembers.map((member) => {
    const posts = detailDiscussions.filter((d: any) => d.user?.id === member.memberId);
    const lastPost = posts.length > 0
      ? posts.reduce((latest: any, p: any) =>
          new Date(p.insertedAt) > new Date(latest.insertedAt) ? p : latest
        )
      : null;
    return {
      ...member,
      postCount: posts.length,
      lastPostAt: lastPost?.insertedAt || null,
    };
  });

  const handleViewDetail = (session: DiscussionSession) => {
    setDetailSession(session);
    setDetailDialogOpen(true);
  };

  const studentColumns: TableColumnsType<typeof studentStats[0]> = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: any) => (
        <Space>
          <Avatar size="small" icon={<UserOutlined />} />
          <div>
            <Text strong>{name}</Text>
            {record.postCount === 0 && <div><Text type="secondary" style={{ fontSize: 12 }}>未参与</Text></div>}
          </div>
        </Space>
      ),
    },
    {
      title: "发帖数量",
      dataIndex: "postCount",
      key: "postCount",
      width: 120,
      align: "center",
      sorter: (a: any, b: any) => a.postCount - b.postCount,
      render: (count: number) => (
        <Text strong style={{ color: count > 0 ? "#0056D2" : "#bfbfbf", fontSize: 16 }}>
          {count}
        </Text>
      ),
    },
    {
      title: "最近发帖时间",
      dataIndex: "lastPostAt",
      key: "lastPostAt",
      width: 180,
      align: "center",
      render: (date: string | null) =>
        date ? (
          <Space size={4}>
            <ClockCircleOutlined style={{ color: "#8c8c8c", fontSize: 12 }} />
            <Text>{new Date(date).toLocaleString("zh-CN")}</Text>
          </Space>
        ) : <Text type="secondary">-</Text>,
    },
  ];

  // ECharts 选项：发帖时间分布
  const timelineChartOptions = useMemo(() => {
    if (detailDiscussions.length === 0) return null;

    // 按日期聚合
    const dateMap: Record<string, number> = {};
    detailDiscussions.forEach((d: any) => {
      if (d.insertedAt) {
        const day = new Date(d.insertedAt).toLocaleDateString("zh-CN");
        dateMap[day] = (dateMap[day] || 0) + 1;
      }
    });

    const dates = Object.keys(dateMap).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    const counts = dates.map((d) => dateMap[d]);

    return {
      tooltip: { trigger: "axis" as const },
      grid: { left: 40, right: 20, top: 20, bottom: 30 },
      xAxis: {
        type: "category" as const,
        data: dates,
        axisLabel: { fontSize: 11, color: "#5E5E5E" },
        axisLine: { lineStyle: { color: "#E0E0E0" } },
      },
      yAxis: {
        type: "value" as const,
        minInterval: 1,
        axisLabel: { fontSize: 11, color: "#5E5E5E" },
        splitLine: { lineStyle: { color: "#F0F0F0" } },
      },
      series: [{
        type: "bar" as const,
        data: counts,
        barWidth: dates.length > 10 ? undefined : 24,
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#0056D2" },
            { offset: 1, color: "#69c0ff" },
          ]),
        },
      }],
    };
  }, [detailDiscussions]);

  // ECharts 选项：学生参与分布
  const participationChartOptions = useMemo(() => {
    if (studentStats.length === 0) return null;

    const participated = studentStats.filter((s) => s.postCount > 0).length;
    const notParticipated = studentStats.length - participated;

    return {
      tooltip: { trigger: "item" as const },
      legend: { bottom: 0, textStyle: { color: "#5E5E5E" } },
      series: [{
        type: "pie" as const,
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: "bold" },
        },
        data: [
          {
            value: participated,
            name: "已参与",
            itemStyle: { color: "#0056D2" },
          },
          {
            value: notParticipated,
            name: "未参与",
            itemStyle: { color: "#E0E0E0" },
          },
        ],
      }],
    };
  }, [studentStats]);

  // Tabs 配置
  const detailTabItems: TabsProps["items"] = [
    {
      key: "overview",
      label: (
        <Space>
          <BarChartOutlined />
          <span>统计概览</span>
        </Space>
      ),
      children: (
        <div>
          {/* 统计卡片 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
            <div style={{
              padding: 20,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #E0E0E0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "linear-gradient(135deg, #0056D2 0%, #69c0ff 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileTextOutlined style={{ fontSize: 22, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#0056D2", lineHeight: 1.2 }}>
                    {detailDiscussions.length}
                  </div>
                  <div style={{ fontSize: 13, color: "#5E5E5E" }}>总帖子数</div>
                </div>
              </div>
            </div>
            <div style={{
              padding: 20,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #E0E0E0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "linear-gradient(135deg, #18842C 0%, #73d13d 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <TeamOutlined style={{ fontSize: 22, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#18842C", lineHeight: 1.2 }}>
                    {studentStats.filter((s) => s.postCount > 0).length}
                    <span style={{ fontSize: 14, fontWeight: 400, color: "#8c8c8c" }}> / {detailMembers.length}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#5E5E5E" }}>参与学生</div>
                </div>
              </div>
            </div>
            <div style={{
              padding: 20,
              borderRadius: 8,
              background: "#fff",
              border: "1px solid #E0E0E0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10,
                  background: "linear-gradient(135deg, #722ed1 0%, #b37feb 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <BarChartOutlined style={{ fontSize: 22, color: "#fff" }} />
                </div>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#722ed1", lineHeight: 1.2 }}>
                    {detailMembers.length > 0
                      ? Math.round((studentStats.filter((s) => s.postCount > 0).length / detailMembers.length) * 100)
                      : 0}%
                  </div>
                  <div style={{ fontSize: 13, color: "#5E5E5E" }}>参与率</div>
                </div>
              </div>
            </div>
          </div>

          {/* 参与率进度条 */}
          {detailMembers.length > 0 && (
            <div style={{
              padding: "16px 20px", borderRadius: 8, background: "#F8F9FA",
              marginBottom: 24, border: "1px solid #E0E0E0",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 13, color: "#5E5E5E" }}>学生参与率</Text>
                <Text strong style={{ color: "#0056D2" }}>
                  {studentStats.filter((s) => s.postCount > 0).length} / {detailMembers.length}
                </Text>
              </div>
              <Progress
                percent={detailMembers.length > 0
                  ? Math.round((studentStats.filter((s) => s.postCount > 0).length / detailMembers.length) * 100)
                  : 0}
                strokeColor={{ "0%": "#0056D2", "100%": "#69c0ff" }}
                showInfo={false}
                size="small"
              />
            </div>
          )}

          {/* 图表区域 */}
          <div style={{ display: "grid", gridTemplateColumns: timelineChartOptions && participationChartOptions ? "1fr 1fr" : "1fr", gap: 16, marginBottom: 24 }}>
            {timelineChartOptions ? (
              <div style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 16 }}>
                <Text strong style={{ fontSize: 14, color: "#1F1F1F", marginBottom: 12, display: "block" }}>
                  发帖时间分布
                </Text>
                <EChartsChart options={timelineChartOptions} height={240} />
              </div>
            ) : (
              <div style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 40, textAlign: "center" }}>
                <Empty description="暂无帖子数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
            {participationChartOptions ? (
              <div style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 16 }}>
                <Text strong style={{ fontSize: 14, color: "#1F1F1F", marginBottom: 12, display: "block" }}>
                  参与分布
                </Text>
                <EChartsChart options={participationChartOptions} height={240} />
              </div>
            ) : (
              <div style={{ border: "1px solid #E0E0E0", borderRadius: 8, padding: 40, textAlign: "center" }}>
                <Empty description="暂无学生数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "students",
      label: (
        <Space>
          <TeamOutlined />
          <span>学生参与 ({detailMembers.length})</span>
        </Space>
      ),
      children: (
        <div>
          {detailMembers.length === 0 ? (
            <Empty description="暂无选课学生" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              className="theme-table"
              columns={studentColumns}
              dataSource={studentStats}
              rowKey="memberId"
              pagination={false}
              size="middle"
              locale={{ emptyText: "暂无学生" }}
            />
          )}
        </div>
      ),
    },
    {
      key: "replies",
      label: (
        <Space>
          <MessageOutlined />
          <span>讨论回复</span>
        </Space>
      ),
      children: (
        <div>
          {detailDiscussions.length === 0 ? (
            <Empty description="暂无讨论帖子" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {detailDiscussions.map((discussion: any) => (
                <div
                  key={discussion.id}
                  style={{
                    marginBottom: 16,
                    padding: 16,
                    border: selectedDiscussion?.id === discussion.id ? "2px solid #0056D2" : "1px solid #E0E0E0",
                    borderRadius: 8,
                    cursor: "pointer",
                    background: selectedDiscussion?.id === discussion.id ? "#f0f7ff" : "#fff",
                  }}
                  onClick={() => setSelectedDiscussion(discussion.id === selectedDiscussion?.id ? null : discussion)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Avatar size="small" icon={<UserOutlined />} />
                        <Text strong>{discussion.user?.name || "未知用户"}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {discussion.insertedAt ? new Date(discussion.insertedAt).toLocaleString("zh-CN") : ""}
                        </Text>
                      </div>
                      <div style={{ marginBottom: 4 }}>
                        <Text strong>{discussion.title}</Text>
                      </div>
                      <Paragraph
                        ellipsis={{ rows: 2, expandable: false }}
                        style={{ marginBottom: 0, color: "#5E5E5E" }}
                      >
                        {discussion.content}
                      </Paragraph>
                    </div>
                    <Tag color="blue">{replyCounts[discussion.id] ?? discussion.replyCount ?? 0} 回复</Tag>
                  </div>

                  {/* 展开显示回复 */}
                  {selectedDiscussion?.id === discussion.id && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #E0E0E0" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          回复列表 ({replies.length})
                        </Text>
                      </div>

                      {repliesLoading ? (
                        <div style={{ textAlign: "center", padding: 20 }}>
                          <Spin size="small" />
                        </div>
                      ) : replies.length === 0 ? (
                        <Text type="secondary" style={{ fontSize: 13 }}>暂无回复</Text>
                      ) : (
                        <div style={{ maxHeight: 200, overflow: "auto" }}>
                          {replies.map((reply: any) => (
                            <div
                              key={reply.id}
                              style={{
                                padding: "8px 0",
                                borderBottom: "1px solid #f5f5f5",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <Avatar size="small" icon={<UserOutlined />} />
                                <Text strong style={{ fontSize: 13 }}>{reply.user?.name || "未知用户"}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {reply.insertedAt ? new Date(reply.insertedAt).toLocaleString("zh-CN") : ""}
                                </Text>
                              </div>
                              <div style={{ paddingLeft: 36 }}>
                                <Text style={{ fontSize: 13 }}>{reply.content}</Text>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 回复输入框 */}
                      <div style={{ marginTop: 12 }} onClick={(e) => e.stopPropagation()}>
                        <TextArea
                          placeholder="输入回复内容..."
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          rows={2}
                          maxLength={2000}
                          style={{ marginBottom: 8 }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDiscussion(null);
                              setReplyContent("");
                            }}
                          >
                            取消
                          </Button>
                          <Button
                            type="primary"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!replyContent.trim()) {
                                message.error("请输入回复内容");
                                return;
                              }
                              createReplyMutation.mutate({
                                content: replyContent,
                                discussionId: discussion.id,
                              });
                            }}
                            loading={createReplyMutation.isPending}
                          >
                            发送回复
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  const handleViewQRCode = (session: DiscussionSession) => {
    setSelectedSession(session);
    setQrDialogOpen(true);
  };

  const getDiscussionUrl = (token?: string) => {
    return `${window.location.origin}/student/discussion/${tenant}/${token || ""}`;
  };

  const handleCopy = (text?: string, label?: string) => {
    if (!text) return;
    const success = copyToClipboard(text);
    if (success) {
      message.success(`${label || "内容"}已复制到剪贴板`);
    } else {
      message.error("复制失败，请手动复制");
    }
  };

  const handleFormSubmit = () => {
    if (!formData.title.trim()) {
      message.error("请输入讨论主题");
      return;
    }
    if (!formData.courseId) {
      message.error("请选择课程");
      return;
    }
    createMutation.mutate(formData);
  };

  const sessions: DiscussionSession[] = sessionsResult?.data || [];

  const columns: TableColumnsType<DiscussionSession> = [
    {
      title: "讨论主题",
      dataIndex: "title",
      key: "title",
      width: 200,
      render: (text: string) => (
        <Space size={4} style={{ maxWidth: "100%" }}>
          <MessageOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
          <Tooltip title={text} mouseEnterDelay={0.3}>
            <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
              {text}
            </Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "课程",
      dataIndex: "course",
      key: "course",
      width: 150,
      render: (course: any) => course?.title || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      align: "center",
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "default"}>
          {status === "active" ? "进行中" : "已关闭"}
        </Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "startedAt",
      key: "startedAt",
      width: 180,
      align: "center",
      render: (date: string) =>
        date ? new Date(date).toLocaleString("zh-CN") : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      align: "center",
      render: (_: any, record: DiscussionSession) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined style={{ color: "#1890ff" }} />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          {record.status === "active" && record.token && (
            <Tooltip title="查看二维码">
              <Button
                type="text"
                icon={<QrcodeOutlined style={{ color: "#52c41a" }} />}
                onClick={() => handleViewQRCode(record)}
              />
            </Tooltip>
          )}
          {record.status === "active" && (
            <Popconfirm
              title="确定要关闭这个实时课程讨论吗？"
              onConfirm={() => closeMutation.mutate(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="关闭讨论">
                <ReadonlyActionButton
                  type="text"
                  icon={<CloseOutlined style={{ color: "#faad14" }} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除这个实时课程讨论吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <ReadonlyActionButton
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
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
        <Text type="danger">用户未登录，请登录以访问实时课程讨论管理。</Text>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">未选择组织，请重新登录并选择组织。</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <MessageOutlined style={{ fontSize: 24, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          实时课程讨论
        </Title>
      </div>

      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
        <Card>
          <Table
            className="theme-table"
            columns={columns}
            dataSource={sessions}
            rowKey="id"
            loading={isLoading}
            title={() => (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => setDialogOpen(true)}
                    style={canEdit ? undefined : { display: "none" }}
                  >
                    新建讨论会话
                  </Button>
                </Space>
              </div>
            )}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 个实时讨论`,
            }}
            locale={{
              emptyText: (
                <Empty description="暂无实时课程讨论" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            }}
          />
        </Card>
      </div>

      <Modal
        title="新建讨论会话"
        open={dialogOpen}
        onCancel={() => {
          setDialogOpen(false);
          setFormData({ title: "", description: "", courseId: "" });
        }}
        onOk={handleFormSubmit}
        confirmLoading={createMutation.isPending}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text>讨论主题 <span style={{ color: "#ff4d4f" }}>*</span></Text>
          </div>
          <Input
            placeholder="请输入讨论主题"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Text>选择课程 <span style={{ color: "#ff4d4f" }}>*</span></Text>
          </div>
          <Select
            placeholder="请选择课程"
            style={{ width: "100%" }}
            value={formData.courseId || undefined}
            onChange={(value) => setFormData({ ...formData, courseId: value })}
            loading={coursesLoading}
          >
            {courses.map((course) => (
              <Select.Option key={course.id} value={course.id}>
                {course.title}
              </Select.Option>
            ))}
          </Select>
        </div>
        <div>
          <div style={{ marginBottom: 8 }}>
            <Text>描述说明</Text>
          </div>
          <TextArea
            placeholder="请输入描述说明（可选）"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>
      </Modal>

      <Modal
        title="扫描二维码参与实时讨论"
        open={qrDialogOpen}
        onCancel={() => {
          setQrDialogOpen(false);
          setSelectedSession(null);
        }}
        footer={null}
        width={400}
      >
        {selectedSession && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <QRCode
              value={getDiscussionUrl(selectedSession.token || "")}
              size={200}
              style={{ margin: "0 auto 20px" }}
            />
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 16 }}>{selectedSession.title}</Text>
            </div>
            <Button
              icon={<CopyOutlined />}
              onClick={() => handleCopy(getDiscussionUrl(selectedSession.token || ""), "链接")}
            >
              复制链接
            </Button>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOutlined style={{ color: "#0056D2" }} />
            <span>{detailSession?.title} - 讨论详情</span>
            <Tag color={detailSession?.status === "active" ? "green" : "default"}>
              {detailSession?.status === "active" ? "进行中" : "已关闭"}
            </Tag>
          </div>
        }
        open={detailDialogOpen}
        onCancel={() => {
          setDetailDialogOpen(false);
          setDetailSession(null);
          setSelectedDiscussion(null);
          setReplyContent("");
        }}
        footer={<Button onClick={() => setDetailDialogOpen(false)}>关闭</Button>}
        width={900}
      >
        {detailDiscussionsLoading || detailMembersLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Tabs items={detailTabItems} />
        )}
      </Modal>
    </div>
  );
}
