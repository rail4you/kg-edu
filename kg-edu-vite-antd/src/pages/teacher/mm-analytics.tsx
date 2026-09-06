import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  Col,
  Empty,
  Grid,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
  Tooltip,
} from "antd";
import {
  ApartmentOutlined,
  BookOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FileOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listMicroMajors,
  listCoursesByMicroMajor,
  listMicroMajorEnrollments,
  listActivityLogsByResourceType,
  listActivityLogsByUser,
  listActivityLogs,
  listMmHomeworkSubmissionsByCourse,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text } = Typography;

export default function MMAnalyticsPage() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const [selectedMMId, setSelectedMMId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("ALL");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Fetch micro majors
  const { data: microMajors = [] } = useQuery({
    queryKey: ["mm-analytics-mms", tenant],
    queryFn: async () => {
      const result = await listMicroMajors({
        tenant: tenant!,
        fields: ["id", "name", "status"],
        headers,
      });
      return extractArrayData(result) as Array<{ id: string; name: string; status?: string }>;
    },
    enabled: !!tenant,
  });

  // Fetch courses for selected MM
  const { data: courses = [] } = useQuery({
    queryKey: ["mm-analytics-courses", selectedMMId],
    queryFn: async () => {
      if (!selectedMMId) return [];
      const result = await listCoursesByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: selectedMMId },
        fields: ["id", "title", "major"],
        headers,
      });
      return extractArrayData(result) as Array<{ id: string; title: string; major?: string }>;
    },
    enabled: !!selectedMMId,
  });

  // Fetch enrollments for selected MM
  const { data: enrollments = [] } = useQuery({
    queryKey: ["mm-analytics-enrollments", selectedMMId],
    queryFn: async () => {
      if (!selectedMMId) return [];
      const result = await listMicroMajorEnrollments({
        tenant: tenant!,
        fields: [
          "id", "microMajorId", "studentId", "status", "progress",
          { student: ["id", "name"] },
        ],
        filter: { microMajorId: { eq: selectedMMId } },
        headers,
      });
      const data = extractArrayData(result);
      return data as Array<{
        id: string; microMajorId: string; studentId: string;
        status: string; progress?: number;
        student?: { id: string; name?: string };
      }>;
    },
    enabled: !!selectedMMId,
  });

  const activeEnrollments = useMemo(() => enrollments.filter(e => e.status === "active"), [enrollments]);
  const students = useMemo(() => {
    const map = new Map<string, { id: string; name?: string }>();
    for (const e of enrollments) {
      if (e.student) map.set(e.student.id, e.student);
    }
    return Array.from(map.values());
  }, [enrollments]);

  // Fetch video view logs
  const { data: videoLogs = [] } = useQuery({
    queryKey: ["mm-analytics-videos", selectedMMId, selectedCourseId],
    queryFn: async () => {
      const filter: any = { actionType: { eq: "mm_video_view" } };
      if (selectedMMId) filter.microMajorId = { eq: selectedMMId };
      if (selectedCourseId && selectedCourseId !== "ALL") filter.microMajorCourseId = { eq: selectedCourseId };
      const result = await listActivityLogs({
        tenant: tenant!,
        fields: ["id", "resourceId", "microMajorCourseId", "microMajorCourseTitle", "userId", "insertedAt"],
        filter,
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant,
  });

  // Fetch exercise logs
  const { data: exerciseLogs = [] } = useQuery({
    queryKey: ["mm-analytics-exercises", selectedMMId, selectedCourseId],
    queryFn: async () => {
      const filter: any = { actionType: { eq: "mm_exercise_submit" } };
      if (selectedMMId) filter.microMajorId = { eq: selectedMMId };
      if (selectedCourseId && selectedCourseId !== "ALL") filter.microMajorCourseId = { eq: selectedCourseId };
      const result = await listActivityLogs({
        tenant: tenant!,
        fields: ["id", "resourceId", "microMajorCourseId", "microMajorCourseTitle", "userId", "metadata", "insertedAt"],
        filter,
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant,
  });

  // Fetch resource download logs
  const { data: downloadLogs = [] } = useQuery({
    queryKey: ["mm-analytics-downloads", selectedMMId, selectedCourseId],
    queryFn: async () => {
      const filter: any = { actionType: { eq: "mm_resource_download" } };
      if (selectedMMId) filter.microMajorId = { eq: selectedMMId };
      if (selectedCourseId && selectedCourseId !== "ALL") filter.microMajorCourseId = { eq: selectedCourseId };
      const result = await listActivityLogs({
        tenant: tenant!,
        fields: ["id", "resourceId", "microMajorCourseId", "microMajorCourseTitle", "userId", "insertedAt"],
        filter,
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant,
  });

  // Fetch homework submissions (single course or all courses)
  const { data: homeworkSubmissionsData = [] } = useQuery({
    queryKey: ["mm-analytics-homeworks", selectedMMId, selectedCourseId],
    queryFn: async () => {
      // 单个课程：只取该课程的作业提交
      if (selectedCourseId && selectedCourseId !== "ALL") {
        const result = await listMmHomeworkSubmissionsByCourse({
          tenant: tenant!,
          input: { microMajorCourseId: selectedCourseId },
          headers,
        });
        return extractArrayData(result) || [];
      }

      // 全部课程：逐个课程拉取后合并
      const allCourses = courses as Array<{ id: string; title: string }>;
      if (!allCourses.length) return [];

      const promises = allCourses.map((course: any) =>
        listMmHomeworkSubmissionsByCourse({
          tenant: tenant!,
          input: { microMajorCourseId: course.id },
          headers,
        }).then((r) => extractArrayData(r) || [])
      );

      const results = await Promise.all(promises);
      return results.flat();
    },
    enabled: !!tenant && !!selectedMMId,
  });

  const homeworkSubmissions: any[] = Array.isArray(homeworkSubmissionsData) ? homeworkSubmissionsData : [];

  const isSingleCourse = !!selectedCourseId && selectedCourseId !== "ALL";
  const selectedCourseObj = useMemo(
    () => courses.find((c: any) => c.id === selectedCourseId),
    [courses, selectedCourseId],
  );

  // Per-course homework stats
  const homeworkStats = useMemo(() => {
    const targetCourses = isSingleCourse
      ? courses.filter((c: any) => c.id === selectedCourseId)
      : courses;
    return targetCourses.map((c: any) => {
      const courseSubmissions = homeworkSubmissions.filter(
        (s: any) => s.microMajorHomework?.microMajorCourseId === c.id
      );
      const total = courseSubmissions.length;
      const graded = courseSubmissions.filter((s: any) => s.status === "graded");
      const gradedCount = graded.length;
      const avgScore = gradedCount > 0
        ? Math.round(graded.reduce((sum: number, s: any) => sum + (s.score ? Number(s.score) : 0), 0) / gradedCount)
        : 0;
      return {
        courseId: c.id,
        courseTitle: c.title,
        total,
        gradedCount,
        avgScore,
        pendingCount: total - gradedCount,
      };
    });
  }, [courses, homeworkSubmissions, isSingleCourse, selectedCourseId]);

  const totalHomeworkSubmissions = homeworkSubmissions.length;
  const gradedCount = homeworkSubmissions.filter((s: any) => s.status === "graded").length;
  const avgScore = gradedCount > 0
    ? Math.round(homeworkSubmissions.filter((s: any) => s.status === "graded")
        .reduce((sum: number, s: any) => sum + (s.score ? Number(s.score) : 0), 0) / gradedCount)
    : 0;

  const correctSubmissions = useMemo(
    () => exerciseLogs.filter((l: any) => l.metadata?.is_correct === true).length,
    [exerciseLogs]
  );

  const uniqueViewers = useMemo(
    () => new Set(videoLogs.map((l: any) => l.userId)).size,
    [videoLogs]
  );

  const uniqueDownloaders = useMemo(
    () => new Set(downloadLogs.map((l: any) => l.userId)).size,
    [downloadLogs]
  );

  // Per-course stats
  const courseStats = useMemo(() => {
    const targetCourses = isSingleCourse
      ? courses.filter((c: any) => c.id === selectedCourseId)
      : courses;
    return targetCourses.map((c: any) => {
      const courseVideoViews = videoLogs.filter((l: any) => l.microMajorCourseId === c.id).length;
      const courseExerciseSubmits = exerciseLogs.filter((l: any) => l.microMajorCourseId === c.id).length;
      const courseCorrect = exerciseLogs.filter(
        (l: any) => l.microMajorCourseId === c.id && l.metadata?.is_correct === true
      ).length;
      const courseDownloads = downloadLogs.filter((l: any) => l.microMajorCourseId === c.id).length;
      return {
        ...c,
        videoViews: courseVideoViews,
        exerciseSubmits: courseExerciseSubmits,
        correctRate: courseExerciseSubmits > 0 ? Math.round((courseCorrect / courseExerciseSubmits) * 100) : 0,
        downloads: courseDownloads,
      };
    });
  }, [courses, videoLogs, exerciseLogs, downloadLogs, isSingleCourse, selectedCourseId]);

  return (
    <div className="mm-analytics-wrap" style={{ padding: isMobile ? 12 : 24 }}>
<style>{`@media(max-width:768px){.mm-analytics-wrap{padding:12px!important}.mm-analytics-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
                <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={isMobile ? 5 : 4} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: isMobile ? 16 : 24 }}>
        <ApartmentOutlined style={{ color: "#722ed1" }} />
        微专业运营分析
      </Title>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 12 }} bodyStyle={isMobile ? { padding: 12 } : undefined}>
        <Row gutter={isMobile ? [0, 10] : 16}>
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: isMobile ? 13 : 14 }}>微专业</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="选择微专业"
              value={selectedMMId}
              onChange={(v) => { setSelectedMMId(v); setSelectedCourseId("ALL"); setSelectedStudentId(null); }}
              allowClear
              options={microMajors.map((m: any) => ({ value: m.id, label: m.name }))}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: isMobile ? 13 : 14 }}>课程</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="全部课程"
              value={selectedCourseId}
              onChange={(v) => setSelectedCourseId(v)}
              disabled={!selectedMMId}
              options={[
                { label: "全部课程", value: "ALL" },
                ...courses.map((c: any) => ({ value: c.id, label: c.title })),
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Text strong style={{ display: "block", marginBottom: 4, fontSize: isMobile ? 13 : 14 }}>学生</Text>
            <Select
              style={{ width: "100%" }}
              placeholder="全部学生"
              value={selectedStudentId}
              onChange={(v) => setSelectedStudentId(v)}
              allowClear
              disabled={!selectedMMId}
              options={students.map((s: any) => ({ value: s.id, label: s.name || s.id }))}
            />
          </Col>
        </Row>
      </Card>

      {!selectedMMId ? (
        <Card><Empty description="请先选择一个微专业" /></Card>
      ) : (
        <>
          {/* Summary Cards */}
          <Row gutter={[isMobile ? 6 : 12, isMobile ? 6 : 12]} style={{ marginBottom: isMobile ? 12 : 24 }}>
            <Col xs={isMobile ? 8 : 12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={isMobile ? { padding: "8px 10px" } : undefined}>
                <Statistic
                  title={<span style={{ fontSize: isMobile ? 11 : 13 }}>选课人数</span>}
                  value={activeEnrollments.length}
                  valueStyle={{ fontSize: isMobile ? 18 : 24 }}
                  prefix={<TeamOutlined style={{ color: "#722ed1", fontSize: isMobile ? 14 : 18 }} />}
                />
              </Card>
            </Col>
            <Col xs={isMobile ? 8 : 12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={isMobile ? { padding: "8px 10px" } : undefined}>
                <Statistic
                  title={<span style={{ fontSize: isMobile ? 11 : 13 }}>视频观看</span>}
                  value={videoLogs.length}
                  valueStyle={{ fontSize: isMobile ? 18 : 24 }}
                  prefix={<EyeOutlined style={{ color: "#1890ff", fontSize: isMobile ? 14 : 18 }} />}
                  suffix={!isMobile && <Text type="secondary" style={{ fontSize: 12 }}>{uniqueViewers} 人</Text>}
                />
              </Card>
            </Col>
            <Col xs={isMobile ? 8 : 12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={isMobile ? { padding: "8px 10px" } : undefined}>
                <Statistic
                  title={<span style={{ fontSize: isMobile ? 11 : 13 }}>习题</span>}
                  value={exerciseLogs.length}
                  valueStyle={{ fontSize: isMobile ? 18 : 24 }}
                  prefix={<FileTextOutlined style={{ color: "#52c41a", fontSize: isMobile ? 14 : 18 }} />}
                />
              </Card>
            </Col>
            <Col xs={isMobile ? 12 : 12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={isMobile ? { padding: "8px 10px" } : undefined}>
                <Statistic
                  title={<span style={{ fontSize: isMobile ? 11 : 13 }}>下载</span>}
                  value={downloadLogs.length}
                  valueStyle={{ fontSize: isMobile ? 18 : 24 }}
                  prefix={<DownloadOutlined style={{ color: "#fa8c16", fontSize: isMobile ? 14 : 18 }} />}
                  suffix={!isMobile && <Text type="secondary" style={{ fontSize: 12 }}>{uniqueDownloaders} 人</Text>}
                />
              </Card>
            </Col>
            <Col xs={isMobile ? 12 : 12} sm={8} md={6} lg={4}>
              <Card size="small" bodyStyle={isMobile ? { padding: "8px 10px" } : undefined}>
                <Statistic
                  title={<span style={{ fontSize: isMobile ? 11 : 13 }}>作业</span>}
                  value={totalHomeworkSubmissions}
                  valueStyle={{ fontSize: isMobile ? 18 : 24 }}
                  prefix={<EditOutlined style={{ color: "#eb2f96", fontSize: isMobile ? 14 : 18 }} />}
                  suffix={!isMobile && gradedCount > 0 ? <Text type="secondary" style={{ fontSize: 12 }}>平均{avgScore}分</Text> : undefined}
                />
              </Card>
            </Col>
          </Row>

          {/* Per-Course Stats Table */}
          <Card title={isSingleCourse ? `「${selectedCourseObj?.title || "该课程"}」数据` : "各课程数据"} size="small" style={{ marginBottom: 12 }} bodyStyle={isMobile ? { padding: 8 } : undefined}>
            <Table
              dataSource={courseStats}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: "课程", dataIndex: "title", key: "title", render: (v: string) => <Tooltip title={v} mouseEnterDelay={0.3}><span style={{ fontSize: isMobile ? 12 : 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span></Tooltip> },
                {
                  title: "视频观看", dataIndex: "videoViews", key: "videoViews",
                  responsive: ["md"],
                },
                {
                  title: "习题", dataIndex: "exerciseSubmits", key: "exerciseSubmits", width: isMobile ? 90 : 100,
                  sorter: (a: any, b: any) => a.exerciseSubmits - b.exerciseSubmits,
                },
                {
                  title: "正确率", dataIndex: "correctRate", key: "correctRate", width: isMobile ? 80 : 80,
                  render: (v: number) => (
                    <Tag color={v >= 70 ? "success" : v >= 40 ? "warning" : "error"} style={{ fontSize: isMobile ? 11 : 12 }}>{v}%</Tag>
                  ),
                  sorter: (a: any, b: any) => a.correctRate - b.correctRate,
                },
                {
                  title: "资源下载", dataIndex: "downloads", key: "downloads",
                  responsive: ["md"],
                },
              ]}
            />
          </Card>

          {/* Homework Stats Table */}
          <Card title={isSingleCourse ? `「${selectedCourseObj?.title || "该课程"}」作业统计` : "作业提交统计"} size="small" style={{ marginBottom: 12 }} bodyStyle={isMobile ? { padding: 8 } : undefined}>
            <Table
              dataSource={homeworkStats}
              rowKey="courseId"
              size="small"
              pagination={false}
              columns={[
                { title: "课程", dataIndex: "courseTitle", key: "courseTitle", render: (v: string) => <span style={{ fontSize: isMobile ? 12 : 13 }}>{v}</span> },
                {
                  title: "提交", dataIndex: "total", key: "total", width: isMobile ? 70 : 100,
                  sorter: (a: any, b: any) => a.total - b.total,
                },
                {
                  title: "已评分", dataIndex: "gradedCount", key: "gradedCount", responsive: ["md"],
                  render: (v: number, record: any) => (
                    <>
                      <Tag color={v === record.total ? "success" : "warning"}>{v}</Tag>
                      {record.pendingCount > 0 && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          (待评分 {record.pendingCount})
                        </Text>
                      )}
                    </>
                  ),
                },
                {
                  title: "平均分", dataIndex: "avgScore", key: "avgScore", width: isMobile ? 80 : 80,
                  render: (v: number) => (
                    v > 0
                      ? <Tag color={v >= 80 ? "success" : v >= 60 ? "warning" : "error"} style={{ fontSize: isMobile ? 11 : 12 }}>{v}分</Tag>
                      : <Text type="secondary">-</Text>
                  ),
                },
              ]}
            />
          </Card>

          {/* Student List */}
          <Card title={`学生列表 (${activeEnrollments.length} 人)`} size="small" bodyStyle={isMobile ? { padding: 8 } : undefined}>
            <Table
              dataSource={activeEnrollments}
              rowKey="id"
              size="small"
              pagination={{ pageSize: isMobile ? 5 : 10 }}
              columns={[
                { title: "姓名", dataIndex: ["student", "name"], key: "name", render: (v: string) => v || "-" },
                {
                  title: "进度", dataIndex: "progress", key: "progress", width: isMobile ? 80 : 120,
                  render: (v: number) => (
                    <Tag color={v && v >= 100 ? "success" : "processing"} style={{ fontSize: isMobile ? 11 : 12 }}>
                      {v ?? 0}%
                    </Tag>
                  ),
                },
                {
                  title: "视频", key: "videoCount", width: isMobile ? 50 : 100,
                  responsive: ["md"],
                  render: (_: any, record: any) => {
                    const count = videoLogs.filter((l: any) => l.userId === record.studentId).length;
                    return count;
                  },
                },
                {
                  title: "习题", key: "exerciseCount", width: isMobile ? 50 : 100,
                  responsive: ["md"],
                  render: (_: any, record: any) => {
                    const count = exerciseLogs.filter((l: any) => l.userId === record.studentId).length;
                    return count;
                  },
                },
                {
                  title: "下载", key: "downloadCount", width: isMobile ? 50 : 100,
                  responsive: ["md"],
                  render: (_: any, record: any) => {
                    const count = downloadLogs.filter((l: any) => l.userId === record.studentId).length;
                    return count;
                  },
                },
                {
                  title: "作业", key: "homeworkCount", width: isMobile ? 60 : 100,
                  responsive: ["md"],
                  render: (_: any, record: any) => {
                    const subs = homeworkSubmissions.filter((l: any) => l.studentId === record.studentId);
                    const graded = subs.filter((s: any) => s.status === "graded");
                    const avg = graded.length > 0
                      ? Math.round(graded.reduce((sum: number, s: any) => sum + (s.score ? Number(s.score) : 0), 0) / graded.length)
                      : 0;
                    return (
                      <Space size={4}>
                        <span>{subs.length}</span>
                        {graded.length > 0 && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ({avg}分)
                          </Text>
                        )}
                      </Space>
                    );
                  },
                },
                { title: "状态", dataIndex: "status", key: "status", width: isMobile ? 60 : 80, responsive: ["md"],
                  render: (v: string) => <Tag color={v === "active" ? "green" : "default"} style={{ fontSize: isMobile ? 11 : 12 }}>{v === "active" ? "学习中" : v}</Tag>,
                },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}
