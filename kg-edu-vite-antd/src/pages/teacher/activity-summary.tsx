import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Typography,
  Spin,
  Tag,
  Statistic,
  Empty,
  Space,
  Modal,
  Tooltip,
  Badge,
  Avatar,
  Button,
  DatePicker,
  Select,
} from "antd";
import dayjs from "dayjs";
import {
  UserOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  CheckSquareOutlined,
  CalendarOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  EditOutlined,
  RightCircleOutlined,
  FireOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { listActivityLogsByTimeRange, listUsers } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import * as echarts from "echarts";

const { Title, Text } = Typography;

const COLORS = {
  primary: "#1890ff",
  success: "#52c41a",
  warning: "#faad14",
  info: "#13c2c2",
  error: "#ff4d4f",
  purple: "#722ed1",
  orange: "#fa8c16",
  volcano: "#fa541c",
  lime: "#a0d911",
  geekblue: "#2f54eb",
};

function EChartsChart({ options, height = 300 }: { options: any; height?: number }) {
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

// ── Helpers (kept from original) ──
const translateActionType = (actionType: string) => {
  const map: Record<string, string> = {
    file_view: "文件查看", video_view: "视频观看", exercise_submit: "练习提交",
    homework_submit: "作业提交", study: "学习", mm_video_view: "微专业视频",
    mm_exercise_submit: "微专业练习", mm_resource_download: "微专业下载",
  };
  return map[actionType] || actionType;
};

const translateResourceType = (type: string) => {
  const map: Record<string, string> = { file: "文件", video: "视频", exercise: "练习", homework: "作业", course: "课程" };
  return map[type.toLowerCase()] || type;
};

const formatTimestamp = (ts: string | null | undefined) => {
  if (!ts) return "未知";
  try { return new Date(ts).toLocaleString("zh-CN"); } catch { return "无效"; }
};

const formatTime = (ts: string | null | undefined) => {
  if (!ts) return "";
  try { return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};

const formatDateLabel = (ts: string | null | undefined) => {
  if (!ts) return "未知";
  try {
    const d = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "今天";
    if (d.toDateString() === yesterday.toDateString()) return "昨天";
    return d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  } catch { return "未知"; }
};

const getActionColor = (actionType: string) => {
  const map: Record<string, string> = {
    file_view: COLORS.primary, video_view: COLORS.info, exercise_submit: COLORS.warning,
    homework_submit: COLORS.success, mm_video_view: COLORS.geekblue,
    mm_exercise_submit: COLORS.orange, mm_resource_download: COLORS.volcano,
  };
  return map[actionType] || "#8c8c8c";
};

const getActionIcon = (actionType: string) => {
  const map: Record<string, React.ReactNode> = {
    file_view: <EyeOutlined />, video_view: <PlayCircleOutlined />,
    exercise_submit: <EditOutlined />, homework_submit: <CheckSquareOutlined />,
  };
  return map[actionType] || <FileTextOutlined />;
};

const getActionTag = (actionType: string) => (
  <Tag color={getActionColor(actionType)} style={{ fontSize: 11, lineHeight: "20px", padding: "0 6px" }}>
    {translateActionType(actionType)}
  </Tag>
);

const formatDuration = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
};

const _formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + " " + sizes[i];
};

const formatActivityMeta = (log: any): string[] => {
  const meta = typeof log.metadata === "string" ? (() => { try { return JSON.parse(log.metadata); } catch { return {}; } })() : (log.metadata || {});
  const parts: string[] = [];

  const at = log.actionType;
  if (at === "file_view" && meta.filename) parts.push(meta.filename);
  else if (at === "video_view" && (meta.title || meta.videoTitle)) parts.push(meta.title || meta.videoTitle);
  else if (at === "exercise_submit" && meta.title) parts.push(meta.title);
  else if (at === "homework_submit" && meta.title) parts.push(meta.title);
  else if (at === "mm_video_view") {
    if (meta.microMajorCourseTitle) parts.push(`课程: ${meta.microMajorCourseTitle}`);
    if (meta.microMajorName) parts.push(`微专业: ${meta.microMajorName}`);
  } else if (at === "mm_exercise_submit") {
    if (meta.microMajorCourseTitle) parts.push(`课程: ${meta.microMajorCourseTitle}`);
    if (meta.microMajorName) parts.push(`微专业: ${meta.microMajorName}`);
    if (meta.isCorrect !== undefined) parts.push(meta.isCorrect ? "✓ 正确" : "✗ 错误");
  } else if (at === "mm_resource_download") {
    if (meta.microMajorCourseTitle) parts.push(`课程: ${meta.microMajorCourseTitle}`);
    if (meta.microMajorName) parts.push(`微专业: ${meta.microMajorName}`);
  } else {
    Object.entries(meta).forEach(([k, v]) => {
      if (v && typeof v !== "object" && !["id", "userId", "courseId", "resourceId", "createdAt", "updatedAt", "timestamp", "microMajorCourseId", "microMajorId"].includes(k)) {
        parts.push(`${k}: ${v}`);
      }
    });
  }
  return parts.length > 0 ? parts : ["-"];
};

export default function ActivitySummaryPage() {
  const navigate = useNavigate();
  const { user, tenant, loading: authLoading } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detailLog, setDetailLog] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // ── Date range (default: last 14 days) ──
  const [dateRange, setDateRange] = useState(() => {
    const end = dayjs();
    const start = end.subtract(13, "day");
    return [start, end] as [dayjs.Dayjs, dayjs.Dayjs];
  });

  const dateRangeStr = useMemo(() => ({
    start: dateRange[0].format("YYYY-MM-DD"),
    end: dateRange[1].format("YYYY-MM-DD"),
  }), [dateRange]);

  // ── Fetch ALL activity logs in date range ──
  const { data: allLogs, isLoading: logsLoading, refetch } = useQuery({
    queryKey: ["activity-summary-all", dateRangeStr, tenant],
    queryFn: async () => {
      const r = await listActivityLogsByTimeRange({
        tenant: tenant!,
        input: { startDate: dateRangeStr.start, endDate: dateRangeStr.end },
        fields: [
          "id", "actionType", "resourceType", "resourceId", "metadata", "insertedAt",
          { user: ["id", "name", "email"] },
        ],
        sort: "-insertedAt",
        headers,
      });
      if (!r.success) throw new Error("Failed to fetch activity logs");
      // listActivityLogsByTimeRange returns { data: [...] }
      const data = (r as any).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!tenant,
  });

  // ── Fetch students list ──
  const { data: students } = useQuery({
    queryKey: ["activity-students", tenant],
    queryFn: async () => {
      const r = await listUsers({
        tenant: tenant!,
        fields: ["id", "name", "email"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        headers,
      });
      if (!r.success) return [];
      const data = (r as any).data;
      return Array.isArray(data) ? data : [];
    },
    enabled: !!tenant,
  });

  // ── Student ID set (for filtering) ──
  const studentIds = useMemo(() => {
    if (!students) return new Set<string>();
    return new Set((students as any[]).map(s => s.id));
  }, [students]);

  // ── Daily activity bar chart data (students only) ──
  const dailyBarData = useMemo(() => {
    if (!allLogs || studentIds.size === 0) return [];
    const dayMap: Record<string, number> = {};
    // Init all days in range
    let d = dateRange[0].toDate();
    const end = dateRange[1].toDate();
    for (let dt = new Date(d); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const key = dt.toISOString().split("T")[0];
      dayMap[key] = 0;
    }
    allLogs
      .filter((log: any) => studentIds.has(log.user?.id))
      .forEach((log: any) => {
        if (!log.insertedAt) return;
        try {
          const key = new Date(log.insertedAt).toISOString().split("T")[0];
          if (dayMap[key] !== undefined) dayMap[key]++;
        } catch {}
      });
    return Object.entries(dayMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allLogs, dateRange, studentIds]);

  // ── Filter logs by selected date + selected student + only students ──
  const filteredLogs = useMemo(() => {
    if (!allLogs || studentIds.size === 0) return [];
    let result = allLogs.filter((log: any) => studentIds.has(log.user?.id));
    if (selectedDate) {
      result = result.filter((log: any) => {
        if (!log.insertedAt) return false;
        try { return new Date(log.insertedAt).toISOString().split("T")[0] === selectedDate; }
        catch { return false; }
      });
    }
    if (selectedStudentId) {
      result = result.filter((log: any) => log.user?.id === selectedStudentId);
    }
    return result;
  }, [allLogs, selectedDate, selectedStudentId, studentIds]);

  // ── Stats for filtered logs ──
  const stats = useMemo(() => {
    const s = { total: 0, students: new Set<string>(), fileViews: 0, videoViews: 0, exercises: 0, homeworks: 0 };
    filteredLogs.forEach((log: any) => {
      s.total++;
      if (log.user?.id) s.students.add(log.user.id);
      if (log.actionType === "file_view") s.fileViews++;
      else if (log.actionType === "video_view") s.videoViews++;
      else if (log.actionType === "exercise_submit") s.exercises++;
      else if (log.actionType === "homework_submit") s.homeworks++;
    });
    return { ...s, studentCount: s.students.size };
  }, [filteredLogs]);

  // ── Group filtered logs by day ──
  const timelineGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredLogs.forEach((log: any) => {
      if (!log.insertedAt) return;
      try {
        const day = new Date(log.insertedAt).toISOString().split("T")[0];
        if (!groups[day]) groups[day] = [];
        groups[day].push(log);
      } catch {}
    });
    // Sort days desc, and logs within each day desc
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([day, logs]) => ({
        day,
        label: formatDateLabel(day + "T12:00:00"),
        logs: logs.sort((a: any, b: any) => new Date(b.insertedAt).getTime() - new Date(a.insertedAt).getTime()),
      }));
  }, [filteredLogs]);

  // ── Bar chart options ──
  const barChartOptions = useMemo(() => {
    if (dailyBarData.length === 0) return null;
    const labels = dailyBarData.map(d => {
      const dt = dayjs(d.date);
      return dt.format("MM/DD");
    });
    const values = dailyBarData.map(d => d.count);
    return {
      tooltip: {
        trigger: "axis",
        formatter: (ps: any) => `${ps[0].axisValue}<br/>活动数: ${ps[0].value}`,
      },
      grid: { left: "3%", right: "4%", bottom: "15%", top: "8%", containLabel: true },
      xAxis: {
        type: "category", data: labels,
        axisLabel: { fontSize: 11, color: "#5E5E5E", rotate: labels.length > 10 ? 30 : 0 },
        axisLine: { lineStyle: { color: "#E0E0E0" } },
      },
      yAxis: {
        type: "value", minInterval: 1,
        axisLabel: { fontSize: 11, color: "#5E5E5E" },
        splitLine: { lineStyle: { color: "#F0F0F0" } },
      },
      series: [{
        type: "bar", data: values, barMaxWidth: 28,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "#1890ff" },
            { offset: 1, color: "rgba(24,144,255,0.3)" },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        emphasis: { itemStyle: { color: "#096dd9" } },
      }],
    };
  }, [dailyBarData]);

  // ── Quick date range buttons ──
  const quickRanges = [
    { label: "近 7 天", days: 6 },
    { label: "近 14 天", days: 13 },
    { label: "近 30 天", days: 29 },
    { label: "近 90 天", days: 89 },
  ];

  const setQuickRange = (days: number) => {
    const end = dayjs();
    const start = end.subtract(days, "day");
    setDateRange([start, end]);
    setSelectedDate(null);
  };

  // ── ECharts onEvents are tricky; use a ref-based approach ──

  // Build a user-name lookup
  const userNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    filteredLogs.forEach((log: any) => {
      if (log.user?.id && log.user?.name) m[log.user.id] = log.user.name;
    });
    return m;
  }, [filteredLogs]);

  // ── Detail modal ──
  const showDetail = (log: any) => {
    setDetailLog(log);
    setDetailOpen(true);
  };

  if (authLoading) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}><Spin size="large" /></div>;
  }
  if (!user || !tenant) {
    return <div className="activity-summary-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.activity-summary-wrap{padding:12px!important}.activity-summary-wrap .ant-table-cell{padding:6px 4px!important}}`}</style><Text type="danger">用户未登录或未选择组织。</Text></div>;
  }

  return (
    <div className="activity-summary-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.activity-summary-wrap{padding:12px!important}.activity-summary-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              className="teacher-page-back-btn"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/teacher/dashboard")}
              style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
            />
            <Title level={3} style={{ margin: 0 }}><FireOutlined style={{ color: COLORS.primary, marginRight: 8 }} />学生活动总览</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>{selectedStudentId ? "查看选定学生的活动记录" : "查看所有学生的活动记录"}</Text>
          </div>
          <Space>
            {selectedDate && (
              <Tag closable onClose={() => setSelectedDate(null)} color="blue" style={{ fontSize: 13, padding: "2px 10px" }}>
                <CalendarOutlined /> {selectedDate}
              </Tag>
            )}
            <Tooltip title="刷新数据">
              <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={logsLoading} />
            </Tooltip>
          </Space>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16 }}>
          <Text strong style={{ fontSize: 14, whiteSpace: "nowrap" }}>学生：</Text>
          <Select
            style={{ width: 260 }}
            placeholder="全部学生"
            value={selectedStudentId}
            onChange={setSelectedStudentId}
            allowClear
            showSearch
            optionFilterProp="label"
            size="middle"
            options={(students || []).map((s: any) => ({ label: s.name || s.email || s.id, value: s.id }))}
          />
          {selectedStudentId && (
            <Button size="small" onClick={() => setSelectedStudentId(null)}>清除筛选</Button>
          )}
        </div>
      </div>

      {/* ── Daily Activity Bar Chart + Date Range Selector ── */}
      <Card style={{ marginBottom: 20, borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChartOutlined style={{ color: COLORS.primary, fontSize: 16 }} />
            <Text strong style={{ fontSize: 14 }}>每日活动趋势</Text>
          </div>
          <Space wrap>
            {quickRanges.map(q => (
              <Button key={q.label} size="small" onClick={() => setQuickRange(q.days)}
                type={dateRange[1].diff(dateRange[0], "day") === q.days ? "primary" : "default"}
              >
                {q.label}
              </Button>
            ))}
            <DatePicker.RangePicker
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                  setSelectedDate(null);
                }
              }}
              size="small"
              style={{ width: 220 }}
              allowClear={false}
            />
          </Space>
        </div>
        {barChartOptions ? (
          <EChartsChart options={barChartOptions} height={180} />
        ) : logsLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin /></div>
        ) : (
          <Empty description="暂无活动数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>

      {/* ── Stats Row ── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {[
          { title: "总活动数", value: stats.total, color: COLORS.primary, icon: <ThunderboltOutlined /> },
          { title: "活跃学生", value: stats.studentCount, color: COLORS.purple, icon: <TeamOutlined /> },
          { title: "文件查看", value: stats.fileViews, color: COLORS.primary, icon: <EyeOutlined /> },
          { title: "视频观看", value: stats.videoViews, color: COLORS.info, icon: <PlayCircleOutlined /> },
          { title: "练习提交", value: stats.exercises, color: COLORS.warning, icon: <EditOutlined /> },
          { title: "作业提交", value: stats.homeworks, color: COLORS.success, icon: <CheckSquareOutlined /> },
        ].map(item => (
          <Col xs={12} sm={8} md={4} key={item.title}>
            <Card size="small" style={{ textAlign: "center", borderRadius: 10 }} bodyStyle={{ padding: "12px 8px" }}>
              <Statistic title={item.title} value={item.value} prefix={item.icon} valueStyle={{ color: item.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Timeline ── */}
      <Card
        title={<Space><ClockCircleOutlined style={{ color: COLORS.primary }} /><span>活动时间线</span></Space>}
        extra={<Text type="secondary" style={{ fontSize: 12 }}>共 {filteredLogs.length} 条记录</Text>}
        style={{ borderRadius: 12 }}
        bodyStyle={{ padding: 0 }}
      >
        {logsLoading ? (
          <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>
        ) : filteredLogs.length === 0 ? (
          <Empty description="选定日期内暂无活动记录" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 40 }} />
        ) : (
          <div style={{ padding: 16 }}>
            {timelineGroups.map(group => (
              <div key={group.day} style={{ marginBottom: 20 }}>
                {/* Day header */}
                <div style={{
                  display: "flex", alignItems: "center", marginBottom: 12,
                  borderBottom: "2px solid #f0f0f0", paddingBottom: 8,
                }}>
                  <Badge count={group.logs.length} style={{ backgroundColor: COLORS.primary, fontSize: 11 }} />
                  <Text strong style={{ fontSize: 15, marginLeft: 10 }}>{group.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{group.day}</Text>
                </div>

                {/* Log cards for this day */}
                <div style={{ paddingLeft: 8 }}>
                  {group.logs.map((log: any) => {
                    const meta = formatActivityMeta(log);
                    return (
                      <div
                        key={log.id}
                        onClick={() => showDetail(log)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "10px 14px", marginBottom: 8,
                          borderRadius: 10, cursor: "pointer",
                          border: "1px solid #f0f0f0",
                          background: "#fff",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = COLORS.primary; (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 8px rgba(24,144,255,0.1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#f0f0f0"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
                      >
                        {/* Time */}
                        <div style={{ minWidth: 44, textAlign: "center", paddingTop: 2 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: `${getActionColor(log.actionType)}15`,
                            color: getActionColor(log.actionType), fontSize: 16,
                          }}>
                            {getActionIcon(log.actionType)}
                          </div>
                          <Text style={{ fontSize: 11, color: "#8c8c8c", display: "block", marginTop: 4 }}>
                            {formatTime(log.insertedAt)}
                          </Text>
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <Avatar size={20} icon={<UserOutlined />} style={{ background: COLORS.geekblue }} />
                            <Text strong style={{ fontSize: 13 }}>{log.user?.name || "未知用户"}</Text>
                            {getActionTag(log.actionType)}
                            <Tag style={{ fontSize: 10, lineHeight: "18px", padding: "0 4px" }}>
                              {translateResourceType(log.resourceType)}
                            </Tag>
                          </div>
                          {meta.length > 0 && (
                            <Text type="secondary" style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {meta[0]}
                            </Text>
                          )}
                        </div>

                        {/* Arrow */}
                        <div style={{ display: "flex", alignItems: "center", color: "#d9d9d9", paddingLeft: 4 }}>
                          <RightCircleOutlined />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Detail Modal ── */}
      <Modal
        title={
          <Space>
            <span style={{ color: getActionColor(detailLog?.actionType) }}>{getActionIcon(detailLog?.actionType)}</span>
            <span>{translateActionType(detailLog?.actionType)} 详情</span>
            {detailLog && getActionTag(detailLog.actionType)}
          </Space>
        }
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailLog(null); }}
        footer={<Button onClick={() => { setDetailOpen(false); setDetailLog(null); }}>关闭</Button>}
        width={640}
      >
        {detailLog && (
          <div>
            <div style={{ background: "#fafafa", borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <Row gutter={[16, 12]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>学生</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <Avatar size={24} icon={<UserOutlined />} />
                    <Text strong>{detailLog.user?.name || "未知用户"}</Text>
                  </div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>时间</Text>
                  <div style={{ marginTop: 2 }}><Text>{formatTimestamp(detailLog.insertedAt)}</Text></div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>活动类型</Text>
                  <div style={{ marginTop: 2 }}>{getActionTag(detailLog.actionType)}</div>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>资源类型</Text>
                  <div style={{ marginTop: 2 }}><Tag>{translateResourceType(detailLog.resourceType)}</Tag></div>
                </Col>
                {detailLog.resourceId && (
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>资源 ID</Text>
                    <div style={{ marginTop: 2 }}><Text code style={{ fontSize: 11 }}>{detailLog.resourceId}</Text></div>
                  </Col>
                )}
              </Row>
            </div>

            <div>
              <Text strong style={{ fontSize: 13 }}>元数据</Text>
              <div style={{ background: "#fafafa", borderRadius: 8, padding: 12, marginTop: 8, maxHeight: 300, overflow: "auto" }}>
                {(() => {
                  const meta = typeof detailLog.metadata === "string"
                    ? (() => { try { return JSON.parse(detailLog.metadata); } catch { return {}; } })()
                    : (detailLog.metadata || {});
                  const metaKeyLabels: Record<string, string> = {
                    microMajorCourseTitle: "微专业课程",
                    microMajorName: "微专业名称",
                    microMajorCourseId: "微专业课程ID",
                    microMajorId: "微专业ID",
                    video_id: "视频ID",
                    exercise_id: "习题ID",
                    resourceId: "资源ID",
                    answer: "学生答案",
                    isCorrect: "是否正确",
                    filename: "文件名",
                    title: "标题",
                    userId: "用户ID",
                    courseId: "课程ID",
                  };
                  const entries = Object.entries(meta).filter(([k]) => !["id", "userId", "createdAt", "updatedAt"].includes(k));
                  if (entries.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>无元数据</Text>;
                  return (
                    <table style={{ width: "100%", fontSize: 12 }}>
                      <tbody>
                        {entries.map(([key, value]) => (
                          <tr key={key} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "6px 8px", color: "#8c8c8c", whiteSpace: "nowrap", width: 100, verticalAlign: "top" }}>
                              {metaKeyLabels[key] || key}
                            </td>
                            <td style={{ padding: "6px 8px", wordBreak: "break-all" }}>
                              {key === "isCorrect"
                                ? (value ? "✓ 正确" : "✗ 错误")
                                : typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

