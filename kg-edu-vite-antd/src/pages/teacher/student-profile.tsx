import { useNavigate } from "react-router-dom";
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Row,
  Col,
  Button,
  Typography,
  Select,
  Spin,
  Empty,
  Progress,
  Table,
  Tag,
  Space,
  Tabs,
} from "antd";
import type { TabsProps } from "antd";
import {
  BookOutlined,
  TrophyOutlined,
  RiseOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  ExperimentOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import * as echarts from "echarts";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useCourses } from "@/hooks/use-courses";
import {
  listEnrollmentsByCourse,
  listUsers,
  getStudentProfileOverview,
  getActivityDistribution,
  getGroupTaskStats,
  getStudentExamsByStudent,
  listActivityLogsByTimeRange,
} from "@/lib/ash_rpc";
import { AppPage, StatGrid } from "@/components/proto";
import { SwitchButton } from "@/components/teacher/switch-button";

const { Text } = Typography;

// ── Robust ECharts wrapper ──
function EChartsChart({ options, height = 350 }: { options: any; height?: number }) {
  const elRef = useRef<HTMLDivElement>(null);
  const instRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    if (!instRef.current) {
      instRef.current = echarts.init(el);
    }
    instRef.current.setOption(options, true);
    instRef.current.resize();

    const resize = () => instRef.current?.resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    return () => {
      window.removeEventListener("resize", resize);
      ro.disconnect();
      instRef.current?.dispose();
      instRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  return <div ref={elRef} style={{ width: "100%", height }} />;
}

const COLORS = ["#5B8FF9", "#5AD8A6", "#F6BD16", "#E86452", "#6DC8EC", "#945FB9", "#FF9845"];

export default function StudentProfile() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const { courses } = useCourses();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Fetch enrolled students for selected course
  const { data: enrollmentsData } = useQuery({
    queryKey: ["enrollments-profile", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant) return [];
      const enrollmentsResult = await listEnrollmentsByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: ["id", "memberId"],
        headers,
      });
      if (!enrollmentsResult.success) return [];

      const data = (enrollmentsResult as any).data;
      const enrollments = Array.isArray(data) ? data : data?.results || [];
      const memberIds = Array.from(new Set(enrollments.map((item: any) => item.memberId).filter(Boolean)));
      if (memberIds.length === 0) return [];

      const usersResult = await listUsers({
        tenant,
        fields: ["id", "name", "email"],
        filter: { id: { in: memberIds } },
        sort: "+name",
        headers,
      });
      if (!usersResult.success) return [];

      const usersData = (usersResult as any).data;
      return Array.isArray(usersData) ? usersData : usersData?.results || [];
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const students = useMemo(() => (enrollmentsData || []).filter(Boolean), [enrollmentsData]);

  // ── Real API calls ──

  // 1. Profile overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["profile-overview", selectedStudentId, selectedCourseId, tenant],
    queryFn: async () => {
      const r = await getStudentProfileOverview({
        tenant: tenant!,
        input: { studentId: selectedStudentId!, courseId: selectedCourseId! },
        headers,
      });
      return r?.success ? r.data : null;
    },
    enabled: !!selectedStudentId && !!selectedCourseId && !!tenant,
  });

  // 2. Activity distribution
  const { data: activityDist } = useQuery({
    queryKey: ["profile-activity-dist", selectedStudentId, selectedCourseId, tenant],
    queryFn: async () => {
      const r = await getActivityDistribution({
        tenant: tenant!,
        input: { studentId: selectedStudentId!, courseId: selectedCourseId! },
        headers,
      });
      return r?.success ? r.data : null;
    },
    enabled: !!selectedStudentId && !!selectedCourseId && !!tenant,
  });

  // 3. Group task stats
  const { data: groupTaskStats } = useQuery({
    queryKey: ["profile-group-task-stats", selectedStudentId, selectedCourseId, tenant],
    queryFn: async () => {
      const r = await getGroupTaskStats({
        tenant: tenant!,
        input: { studentId: selectedStudentId!, courseId: selectedCourseId! },
        headers,
      });
      return r?.success ? r.data : null;
    },
    enabled: !!selectedStudentId && !!selectedCourseId && !!tenant,
  });

  // 4. Real exam scores (individual)
  const { data: studentExams } = useQuery({
    queryKey: ["profile-student-exams", selectedStudentId, tenant],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const r = await getStudentExamsByStudent({
        tenant: tenant!,
        input: { studentId: selectedStudentId! },
        fields: [
          "id", "score", "passed", "submittedAt",
          { exam: ["id", "title", "examDate", "totalScore"] },
        ],
        sort: "submittedAt",
        headers,
      });
      if (!r.success) return null;
      return (r as any).data as any[];
    },
    enabled: !!selectedStudentId && !!tenant,
  });

  // 5. 7-day activity logs for learning curve
  const dateRange = useMemo(() => {
    const now = new Date();
    const end = now.toISOString().split("T")[0];
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    return { start, end };
  }, []);

  const { data: activityLogs } = useQuery({
    queryKey: ["profile-7day-logs", selectedStudentId, selectedCourseId, dateRange, tenant],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      const r = await listActivityLogsByTimeRange({
        tenant: tenant!,
        input: { startDate: dateRange.start, endDate: dateRange.end },
        fields: ["id", "actionType", "insertedAt"],
        filter: { userId: { eq: selectedStudentId } },
        headers,
      });
      if (!r.success) return null;
      return (r as any).data as any[];
    },
    enabled: !!selectedStudentId && !!tenant,
  });

  // ── Derived data ──

  // 7-day curve: group activity logs by day and count
  const sevenDayData = useMemo(() => {
    if (!activityLogs || !Array.isArray(activityLogs)) return null;
    const now = new Date();
    // Build day labels for the last 7 days
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      const iso = d.toISOString().split("T")[0];
      dayMap[key] = 0;
    }
    // Count logs per day
    activityLogs.forEach((log: any) => {
      if (!log.insertedAt) return;
      const d = new Date(log.insertedAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (dayMap[key] !== undefined) dayMap[key]++;
    });
    const days = Object.keys(dayMap);
    const counts = Object.values(dayMap) as number[];
    return { days, counts };
  }, [activityLogs]);

  // Exam scores with exam names
  const examScores = useMemo(() => {
    if (!studentExams || !Array.isArray(studentExams)) return null;
    return studentExams
      .filter((se: any) => se.score != null && se.exam?.title)
      .map((se: any) => ({
        exam: se.exam?.title || "考试",
        score: se.score,
        fullScore: se.exam?.totalScore || 100,
        passed: se.passed,
        date: se.submittedAt ? new Date(se.submittedAt).toLocaleDateString("zh-CN") : "-",
      }))
      .reverse();
  }, [studentExams]);

  // Stats from overview
  const mastery = overview?.knowledge?.averageMastery;
  const activityIndex = overview?.activity?.activityIndex;
  const totalActivities = overview?.activity?.totalActivities;
  const examAvg = overview?.exam?.averageScore;
  const examHigh = overview?.exam?.highestScore;
  const examLow = overview?.exam?.lowestScore;
  const totalExams = overview?.exam?.totalExams;
  // Pass rate from real student exams
  const passRate = useMemo(() => {
    if (!studentExams || !Array.isArray(studentExams) || studentExams.length === 0) return null;
    const graded = studentExams.filter((se: any) => se.score != null);
    if (graded.length === 0) return null;
    return Math.round((graded.filter((se: any) => se.passed).length / graded.length) * 100);
  }, [studentExams]);

  // ── ECharts options ──

  // 7-day learning curve (from real logs)
  const sevenDayTrendOptions = useMemo(() => {
    if (!sevenDayData || sevenDayData.counts.every((c: number) => c === 0)) return null;
    const { days, counts } = sevenDayData;
    return {
      tooltip: { trigger: "axis", formatter: (ps: any) => `${ps[0].axisValue}<br/>学习次数: ${ps[0].value} 次` },
      grid: { left: "4%", right: "4%", bottom: "12%", top: "10%", containLabel: true },
      xAxis: { type: "category", data: days, axisLabel: { fontSize: 12, color: "#5E5E5E" }, axisLine: { lineStyle: { color: "#E0E0E0" } } },
      yAxis: { type: "value", name: "学习次数", minInterval: 1, axisLabel: { fontSize: 11, color: "#5E5E5E" }, splitLine: { lineStyle: { color: "#F0F0F0" } } },
      series: [{
        type: "line", data: counts, smooth: true, symbol: "circle", symbolSize: 8,
        lineStyle: { width: 3, color: "#5B8FF9" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(91,143,249,0.25)" }, { offset: 1, color: "rgba(91,143,249,0.02)" }]) },
        itemStyle: { color: "#5B8FF9" },
        markLine: {
          data: [{ type: "average", name: "平均" }],
          label: { formatter: "平均: {c}", fontSize: 11, color: "#8c8c8c" },
          lineStyle: { color: "#ff4d4f", type: "dashed" },
        },
      }],
    };
  }, [sevenDayData]);

  // Activity distribution pie
  const activityPieOptions = useMemo(() => {
    if (!activityDist || !Array.isArray(activityDist) || activityDist.length === 0) return null;
    return {
      tooltip: { trigger: "item", formatter: (p: any) => `${p.name}: ${p.value} 次 (${p.percent}%)` },
      legend: { bottom: 0, type: "scroll" },
      series: [{
        type: "pie", radius: ["40%", "70%"], avoidLabelOverlap: false,
        itemStyle: { borderRadius: 10, borderColor: "#fff", borderWidth: 2 },
        label: { show: true, formatter: (p: any) => `${p.name}\n${p.percent}%`, fontSize: 11 },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: "bold" } },
        data: activityDist.map((d: any) => ({ value: d.count, name: d.type })),
      }],
      color: COLORS,
    };
  }, [activityDist]);

  // Exam scores bar chart
  const examBarOptions = useMemo(() => {
    if (!examScores || examScores.length === 0) return null;
    const avg = Math.round(examScores.reduce((s: number, e: any) => s + e.score, 0) / examScores.length);
    return {
      tooltip: {
        trigger: "axis",
        formatter: (ps: any) => {
          const p = ps[0];
          const exam = examScores.find((s: any) => s.exam === p.axisValue);
          return `<b>${p.axisValue}</b><br/>得分: ${p.value} / ${exam?.fullScore || 100}<br/>日期: ${exam?.date || "-"}<br/>${exam?.passed ? "✅ 通过" : "❌ 未通过"}`;
        },
      },
      grid: { left: "3%", right: "4%", bottom: "14%", top: "12%", containLabel: true },
      xAxis: { type: "category", data: examScores.map((s: any) => s.exam), axisLabel: { rotate: 20, fontSize: 11, color: "#5E5E5E" }, axisLine: { lineStyle: { color: "#E0E0E0" } } },
      yAxis: { type: "value", name: "分数", max: 100, axisLabel: { fontSize: 11, color: "#5E5E5E" }, splitLine: { lineStyle: { color: "#F0F0F0" } } },
      series: [{
        type: "bar",
        data: examScores.map((s: any) => ({
          value: s.score,
          itemStyle: { color: s.passed ? "#52c41a" : "#ff4d4f", borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 40,
        label: { show: true, position: "top", formatter: (p: any) => `${p.value}`, fontSize: 11, fontWeight: 600 },
        markLine: {
          data: [{ yAxis: avg, name: "平均" }],
          label: { formatter: `平均: ${avg}`, fontSize: 11, color: "#722ed1" },
          lineStyle: { color: "#722ed1", type: "dashed" },
        },
      }],
    };
  }, [examScores]);

  // Group task score — horizontal bar chart
  const groupTaskBarOptions = useMemo(() => {
    const tasks = groupTaskStats?.tasks;
    if (!tasks || tasks.length === 0) return null;
    const reversed = [...tasks].reverse();
    return {
      tooltip: {
        trigger: "axis", axisPointer: { type: "shadow" },
        formatter: (ps: any) => {
          const name = ps[0].axisValue;
          const my = ps.find((p: any) => p.seriesName === "我的得分");
          const cls = ps.find((p: any) => p.seriesName === "班级平均");
          let html = `<b>${name}</b><br/>我的得分: ${my?.value ?? "未提交"}<br/>班级平均: ${cls?.value ?? "-"}`;
          if (my?.value != null && cls?.value != null) {
            const diff = my.value - cls.value;
            html += `<br/>差距: <span style="color:${diff >= 0 ? "#52c41a" : "#ff4d4f"}">${diff >= 0 ? "+" : ""}${diff.toFixed(1)}</span>`;
          }
          return html;
        },
      },
      grid: { left: "3%", right: "8%", bottom: "10%", top: "8%", containLabel: true },
      xAxis: { type: "value", max: 100, axisLabel: { fontSize: 11, color: "#5E5E5E" }, splitLine: { lineStyle: { color: "#F0F0F0" } } },
      yAxis: {
        type: "category", data: reversed.map((t: any) => t.taskTitle), inverse: false,
        axisLabel: { fontSize: 12, color: "#1F1F1F", width: 100, overflow: "truncate" },
        axisLine: { lineStyle: { color: "#E0E0E0" } },
      },
      series: [
        {
          name: "我的得分", type: "bar",
          data: reversed.map((t: any) => ({
            value: t.score,
            itemStyle: t.score != null
              ? { color: t.score >= 80 ? "#5B8FF9" : t.score >= 60 ? "#F6BD16" : "#E86452", borderRadius: [0, 4, 4, 0] }
              : { color: "#f0f0f0", borderRadius: [0, 4, 4, 0] },
          })),
          barMaxWidth: 22,
          label: { show: true, position: "right", formatter: (p: any) => p.value != null ? `${p.value} 分` : "未提交", fontSize: 11, fontWeight: 600, color: "#333" },
        },
        {
          name: "班级平均", type: "scatter",
          data: reversed.map((t: any) => ({
            value: t.classAverage,
            symbol: "diamond", symbolSize: t.classAverage != null ? 14 : 0,
            itemStyle: { color: "#5AD8A6", borderColor: "#fff", borderWidth: 2 },
          })),
          label: { show: true, position: "right", formatter: (p: any) => p.value != null ? `班均 ${p.value}` : "", fontSize: 10, color: "#5AD8A6", distance: 44 },
        },
      ],
    };
  }, [groupTaskStats]);

  // ── Table columns ──

  const examColumns = [
    { title: "考试/测验", dataIndex: "exam", key: "exam", width: 120 },
    { title: "日期", dataIndex: "date", key: "date", width: 110 },
    { title: "得分", dataIndex: "score", key: "score", width: 80,
      render: (v: number, r: any) => <Text strong style={{ color: v >= 80 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f" }}>{v} / {r.fullScore}</Text>,
    },
    { title: "通过", dataIndex: "passed", key: "passed", width: 70,
      render: (v: boolean) => v ? <Tag color="green">通过</Tag> : <Tag color="red">未通过</Tag>,
    },
    {
      title: "与上次对比", key: "trend", width: 100,
      render: (_: any, _r: any, idx: number) => {
        if (!examScores || idx === 0) return <Text type="secondary">起始</Text>;
        const prev = examScores[idx - 1];
        const cur = examScores[idx];
        if (!prev || !cur) return <Text type="secondary">-</Text>;
        const diff = cur.score - prev.score;
        if (diff > 0) return <Text style={{ color: "#52c41a" }}><ArrowUpOutlined /> +{diff}</Text>;
        if (diff < 0) return <Text style={{ color: "#ff4d4f" }}><ArrowDownOutlined /> {diff}</Text>;
        return <Text type="secondary">持平</Text>;
      },
    },
  ];

  const groupTaskColumns = [
    { title: "任务名称", dataIndex: "taskTitle", key: "taskTitle", ellipsis: true },
    { title: "提交时间", dataIndex: "submittedAt", key: "submittedAt", width: 110,
      render: (v: string | null) => v ? new Date(v).toLocaleDateString("zh-CN") : <Text type="secondary">-</Text>,
    },
    { title: "提交状态", dataIndex: "submissionStatus", key: "submissionStatus", width: 90,
      render: (v: string) => {
        const map: Record<string, { color: string; text: string }> = {
          graded: { color: "green", text: "已评分" },
          submitted: { color: "blue", text: "已提交" },
          not_submitted: { color: "default", text: "未提交" },
          pending: { color: "default", text: "未提交" },
        };
        const info = map[v] || { color: "default", text: v };
        return <Tag color={info.color}>{info.text}</Tag>;
      },
    },
    { title: "我的得分", dataIndex: "score", key: "score", width: 85,
      render: (v: number | null) => v != null
        ? <Text strong style={{ color: v >= 80 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f" }}>{v}</Text>
        : <Text type="secondary">-</Text>,
    },
    { title: "班级平均", dataIndex: "classAverage", key: "classAverage", width: 85,
      render: (v: number | null) => v != null ? <Text>{v}</Text> : <Text type="secondary">-</Text>,
    },
    { title: "教师反馈", dataIndex: "feedback", key: "feedback", ellipsis: true,
      render: (v: string | null) => v || <Text type="secondary">-</Text>,
    },
  ];

  const noStudent = !selectedStudentId || !selectedCourseId;

  // ── Tabs ──
  const tabItems: TabsProps["items"] = [
    {
      key: "behavior",
      label: <Space><BarChartOutlined /><span>学习行为</span></Space>,
      children: (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={10}>
              <Card title={<Space><RiseOutlined style={{ color: "#5B8FF9" }} /><span>学习行为分布</span></Space>}>
                {activityPieOptions ? (
                  <EChartsChart options={activityPieOptions} height={350} />
                ) : (
                  <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Empty description="暂无活动数据" />
                  </div>
                )}
              </Card>
            </Col>
            <Col span={14}>
              <Card
                title={<Space><ClockCircleOutlined style={{ color: "#5B8FF9" }} /><span>近 7 天学习趋势</span></Space>}
                extra={sevenDayData ? <Tag color="blue"><ThunderboltOutlined /> 今日: {sevenDayData.counts[sevenDayData.counts.length - 1]} 次</Tag> : null}
              >
                {sevenDayTrendOptions ? (
                  <EChartsChart options={sevenDayTrendOptions} height={350} />
                ) : (
                  <div style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Empty description="暂无近 7 天活动记录" />
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Card title={<Space><TrophyOutlined style={{ color: "#722ed1" }} /><span>考试/测验成绩</span></Space>} style={{ marginBottom: 16 }}>
            <StatGrid
              columns={6}
              items={[
                { label: "考试平均分", value: examAvg ?? "-", unit: examAvg != null ? "分" : "", icon: <TrophyOutlined /> },
                { label: "最高分", value: examHigh ?? "-", unit: examHigh != null ? "分" : "", icon: <CheckCircleOutlined /> },
                { label: "最低分", value: examLow ?? "-", unit: examLow != null ? "分" : "", icon: <ExperimentOutlined /> },
                { label: "考试次数", value: totalExams ?? (examScores?.length || 0), unit: "次", icon: <FileTextOutlined /> },
                { label: "通过率", value: passRate ?? "-", unit: passRate != null ? "%" : "", icon: <CheckCircleOutlined /> },
                { label: "学习活跃度", value: activityIndex ?? "-", unit: activityIndex != null ? "/ 100" : "", icon: <RiseOutlined /> },
              ]}
            />
            {examBarOptions ? (
              <EChartsChart options={examBarOptions} height={280} />
            ) : (<Empty description="暂无考试记录" />)}
            {examScores && examScores.length > 0 ? (
              <Table
            columns={examColumns} dataSource={examScores} rowKey="exam" pagination={false} size="small" style={{ marginTop: 16 }} />
            ) : null}
          </Card>
        </>
      ),
    },
    {
      key: "group-task",
      label: <Space><TeamOutlined /><span>分组任务表现</span></Space>,
      children: (
        <>
          <StatGrid
            columns={4}
            items={[
              {
                label: "分组任务数",
                value: groupTaskStats?.summary?.totalTasks ?? "-",
                icon: <TeamOutlined />,
                desc: groupTaskStats?.summary?.totalTasks != null
                  ? `已提交 ${groupTaskStats.summary.submittedCount || 0} / ${groupTaskStats.summary.totalTasks}`
                  : "暂无分组任务",
              },
              {
                label: "任务平均分",
                value: groupTaskStats?.summary?.averageScore ?? "-",
                unit: groupTaskStats?.summary?.averageScore != null ? "/ 100" : "",
                icon: <TrophyOutlined />,
                desc: groupTaskStats?.summary?.classAverageScore != null
                  ? `班级平均: ${groupTaskStats.summary.classAverageScore}`
                  : "暂无评分数据",
              },
              {
                label: "所属小组",
                value: groupTaskStats?.summary?.group?.groupName || "未加入小组",
                icon: <TeamOutlined />,
                desc: groupTaskStats?.summary?.group?.groupName
                  ? `已评分 ${groupTaskStats.summary.gradedCount || 0} 个任务`
                  : "该学生未加入任何小组",
              },
              {
                label: "平均分差距",
                value: (() => {
                  const my = groupTaskStats?.summary?.averageScore;
                  const cls = groupTaskStats?.summary?.classAverageScore;
                  if (my != null && cls != null) return (my - cls) > 0 ? `+${(my - cls).toFixed(1)}` : (my - cls).toFixed(1);
                  return "-";
                })(),
                icon: <ArrowUpOutlined />,
                desc: "vs 班级平均",
              },
            ]}
          />

          <Card title={<Space><BarChartOutlined style={{ color: "#5B8FF9" }} /><span>分组任务得分对比</span></Space>} style={{ marginBottom: 16 }}>
            {groupTaskBarOptions ? (
              <EChartsChart options={groupTaskBarOptions} height={350} />
            ) : (<Empty description="暂无任务评分数据" />)}
          </Card>

          <Card title={<Space><TeamOutlined style={{ color: "#1890ff" }} /><span>分组任务评分明细</span></Space>}>
            {groupTaskStats?.tasks && groupTaskStats.tasks.length > 0 ? (
              <Table
            columns={groupTaskColumns} dataSource={groupTaskStats.tasks} rowKey="taskId" pagination={{ pageSize: 5 }} size="small" />
            ) : (<Empty description="该学生暂无分组任务记录" />)}
          </Card>
        </>
      ),
    },
  ];

  if (!user || !tenant) {
    return (
      <AppPage title="学生学情画像" description="查看学生知识与活跃情况">
        <Card><Text type="danger">用户未登录或未选择组织。</Text></Card>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="学生学情画像"
      description="查看学生知识与活跃情况"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;学生学情画像</>}
      actions={
        <>
          <SwitchButton
            title="切换当前课程"
            buttonLabel="切换课程"
            options={courses?.map((c: any) => ({ id: c.id, label: c.title })) || []}
            value={selectedCourseId}
            onChange={(id) => { setSelectedCourseId(id ?? null); setSelectedStudentId(null); }}
          />
          <SwitchButton
            title="切换学生"
            buttonLabel="切换学生"
            options={students.map((s: any) => ({ id: s.id, label: s.name || s.email || s.id }))}
            value={selectedStudentId}
            onChange={(id) => setSelectedStudentId(id ?? null)}
          />
        </>
      }
    >

      {noStudent ? (
        <Card><Empty description="请选择课程和学生查看学情画像" /></Card>
      ) : overviewLoading ? (
        <div style={{ textAlign: "center", padding: 80 }}><Spin size="large" /></div>
      ) : (
        <>
          <StatGrid
            columns={3}
            items={[
              {
                label: "知识掌握度",
                value: mastery ?? "-",
                unit: mastery != null ? "%" : "",
                icon: <BookOutlined />,
                desc: mastery != null ? <Progress percent={mastery} showInfo={false} size="small" /> : undefined,
              },
              {
                label: "学习活跃度",
                value: activityIndex ?? "-",
                unit: activityIndex != null ? "/ 100" : "",
                icon: <RiseOutlined />,
                desc: `共 ${totalActivities ?? 0} 次活动`,
              },
              {
                label: "考试平均分",
                value: examAvg ?? "-",
                icon: <TrophyOutlined />,
                desc: `共 ${totalExams ?? 0} 次考试`,
              },
            ]}
          />

          <Tabs defaultActiveKey="behavior" items={tabItems} />
        </>
      )}
    </AppPage>
  );
}
