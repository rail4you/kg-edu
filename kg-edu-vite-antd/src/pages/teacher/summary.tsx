import { useEffect, useRef } from "react";
import { Card, Row, Col, Typography, Spin, Tag, Statistic } from "antd";
import {
  ReadOutlined,
  VideoCameraOutlined,
  BarChartOutlined,
  BulbOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts";
import { useQuery } from "@tanstack/react-query";
import {
  listChapters,
  listKnowledges,
  listVideos,
  listFiles,
  listHomeworks,
  listExercises,
  listCommands,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useCourses } from "@/hooks/use-courses";

const { Title, Text } = Typography;

interface ApiResult {
  success: boolean;
  data?: unknown;
}

function extractArrayFromResult(result: ApiResult): any[] {
  if (!result.success || !result.data) return [];
  if (Array.isArray(result.data)) return result.data;
  if (
    typeof result.data === "object" &&
    result.data !== null &&
    "results" in result.data
  ) {
    return (result.data as { results: any[] }).results;
  }
  return [];
}

function DonutChart({
  data,
  colors,
}: {
  data: { value: number; name: string }[];
  colors: string[];
}) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    const option = {
      tooltip: { trigger: "item" },
      legend: { bottom: "0%", left: "center" },
      color: colors,
      series: [
        {
          type: "pie" as const,
          radius: ["40%", "70%"],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 8, borderColor: "#fff", borderWidth: 2 },
          label: {
            show: true,
            position: "center",
            formatter: () => {
              const total = data.reduce((sum, item) => sum + item.value, 0);
              return `{total|${total}}\n{label|汇总}`;
            },
            rich: {
              total: { fontSize: 24, fontWeight: "bold", color: "#333" },
              label: { fontSize: 14, color: "#999", padding: [5, 0, 0, 0] },
            },
          },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: "bold" } },
          labelLine: { show: false },
          data,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data, colors]);

  return <div ref={chartRef} style={{ width: "100%", height: 300 }} />;
}

export default function SummaryPage() {
  const { user, loading: authLoading, tenant } = useAuth();
  const tenantName = tenant || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const {
    courses: coursesData,
    loading: coursesLoading,
    error: coursesError,
  } = useCourses({
    fields: ["id", "title", "teacherId"],
  });

  const {
    data: chaptersData,
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useQuery({
    queryKey: ["chapters-summary", tenantName],
    queryFn: async () => {
      const result = await listChapters({
        tenant: tenantName,
        fields: ["id", "title", "courseId", "sortOrder"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: subjectsData,
    isLoading: subjectsLoading,
    error: subjectsError,
  } = useQuery({
    queryKey: ["knowledges-summary", tenantName],
    queryFn: async () => {
      const result = await listKnowledges({
        tenant: tenantName,
        fields: ["id", "name", "knowledgeType", "courseId", "chapterId"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: videosData,
    isLoading: videosLoading,
    error: videosError,
  } = useQuery({
    queryKey: ["videos-summary", tenantName],
    queryFn: async () => {
      const result = await listVideos({
        tenant: tenantName,
        fields: ["id", "title", "duration", "chapterId"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: filesData,
    isLoading: filesLoading,
    error: filesError,
  } = useQuery({
    queryKey: ["files-summary", tenantName],
    queryFn: async () => {
      const result = await listFiles({
        tenant: tenantName,
        fields: ["id", "filename", "fileType", "size"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: homeworksData,
    isLoading: homeworksLoading,
    error: homeworksError,
  } = useQuery({
    queryKey: ["homeworks-summary", tenantName],
    queryFn: async () => {
      const result = await listHomeworks({
        tenant: tenantName,
        fields: ["id", "title", "score", "courseId", "chapterId"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: exercisesData,
    isLoading: exercisesLoading,
    error: exercisesError,
  } = useQuery({
    queryKey: ["exercises-summary", tenantName],
    queryFn: async () => {
      const result = await listExercises({
        tenant: tenantName,
        fields: ["id", "title", "questionType", "aiType", "courseId"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  const {
    data: commandsData,
    isLoading: commandsLoading,
    error: commandsError,
  } = useQuery({
    queryKey: ["commands-summary", tenantName],
    queryFn: async () => {
      const result = await listCommands({
        tenant: tenantName,
        fields: ["id", "title"],
        headers,
      });
      return extractArrayFromResult(result as ApiResult);
    },
    enabled: !!tenantName,
  });

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Title level={4} style={{ marginBottom: 16, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text style={{ marginBottom: 24 }}>请登录以访问概览页面。</Text>
      </div>
    );
  }

  const courses: any[] = coursesData || [];
  const chapters: any[] = chaptersData || [];
  const subjects: any[] = subjectsData || [];
  const videos: any[] = videosData || [];
  const files: any[] = filesData || [];
  const homeworks: any[] = homeworksData || [];
  const exercises: any[] = exercisesData || [];
  const commands: any[] = commandsData || [];

  const isLoading =
    coursesLoading ||
    chaptersLoading ||
    subjectsLoading ||
    videosLoading ||
    filesLoading ||
    homeworksLoading ||
    exercisesLoading ||
    commandsLoading;
  const hasError =
    coursesError ||
    chaptersError ||
    subjectsError ||
    videosError ||
    filesError ||
    homeworksError ||
    exercisesError ||
    commandsError;

  const totalCourses = courses.length;
  const totalChapters = chapters.length;
  const totalResources = subjects.length;
  const totalVideos = videos.length;
  const totalDocuments = files.length;
  const totalMediaFiles = totalVideos + totalDocuments;
  const totalHomeworks = homeworks.length;
  const totalExercises = exercises.length;
  const totalAiExercises = exercises.filter(
    (ex: any) => ex.aiType === "ai_generated",
  ).length;
  const totalCommands = commands.length;

  const totalVideoDuration = videos.reduce(
    (sum: number, video: any) => sum + (video.duration || 0),
    0,
  );

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return remainingSeconds > 0
        ? `${minutes}分${remainingSeconds}秒`
        : `${minutes}分钟`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  };

  const courseChartData = [
    { value: totalCourses, name: "课程" },
    { value: totalChapters, name: "章节" },
    { value: totalResources, name: "知识点" },
  ];
  const courseColors = ["#1890ff", "#722ed1", "#52c41a"];

  const mediaChartData = [
    { value: totalVideos, name: "视频" },
    { value: totalDocuments, name: "文档" },
  ];
  const mediaColors = ["#1890ff", "#faad14"];

  const studyChartData = [
    { value: totalHomeworks, name: "作业" },
    { value: totalExercises, name: "练习题" },
    { value: totalAiExercises, name: "AI生成练习" },
  ];
  const studyColors = ["#1890ff", "#722ed1", "#52c41a"];

  const aiChartData = [
    { value: totalCommands, name: "AI命令" },
    { value: totalAiExercises, name: "AI生成练习" },
    { value: totalResources, name: "其他资源" },
  ];
  const aiColors = ["#1890ff", "#52c41a", "#faad14"];

  if (isLoading) {
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.45)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <Spin size="large" />
        <Text style={{ marginTop: 16, color: "#fff" }}>正在加载数据...</Text>
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        style={{
          minHeight: "100vh",
          padding: 32,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <Title level={5} style={{ marginBottom: 16, color: "#ff4d4f" }}>
            加载数据时出错
          </Title>
          <Text style={{ color: "#999" }}>请刷新页面重试</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <Title
          level={3}
          style={{ fontWeight: "bold", marginBottom: 8, color: "#1890ff" }}
        >
          教学概览
        </Title>
        <Text style={{ color: "#999", marginBottom: 32, display: "block" }}>
          实时查看您的教学资源和学习活动统计
        </Text>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <ReadOutlined
                  style={{ fontSize: 40, color: "#1890ff", marginRight: 16 }}
                />
                <div>
                  <Statistic
                    value={totalCourses}
                    valueStyle={{ fontSize: 28, fontWeight: "bold" }}
                  />
                  <Text style={{ color: "#999" }}>课程</Text>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: "#999" }}>
                  章节: {totalChapters}
                </Text>
                <Text style={{ fontSize: 12, color: "#999" }}>
                  知识点: {totalResources}
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <VideoCameraOutlined
                  style={{ fontSize: 40, color: "#722ed1", marginRight: 16 }}
                />
                <div>
                  <Statistic
                    value={totalVideos}
                    valueStyle={{ fontSize: 28, fontWeight: "bold" }}
                  />
                  <Text style={{ color: "#999" }}>视频</Text>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: "#999" }}>
                  文件: {totalMediaFiles}
                </Text>
                <Text style={{ fontSize: 12, color: "#999" }}>
                  总时长: {formatDuration(totalVideoDuration)}
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <BarChartOutlined
                  style={{ fontSize: 40, color: "#faad14", marginRight: 16 }}
                />
                <div>
                  <Statistic
                    value={totalHomeworks + totalExercises}
                    valueStyle={{ fontSize: 28, fontWeight: "bold" }}
                  />
                  <Text style={{ color: "#999" }}>学习任务</Text>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: "#999" }}>
                  作业: {totalHomeworks}
                </Text>
                <Text style={{ fontSize: 12, color: "#999" }}>
                  练习: {totalExercises}
                </Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <BulbOutlined
                  style={{ fontSize: 40, color: "#52c41a", marginRight: 16 }}
                />
                <div>
                  <Statistic
                    value={totalCommands + totalAiExercises}
                    valueStyle={{ fontSize: 28, fontWeight: "bold" }}
                  />
                  <Text style={{ color: "#999" }}>AI应用</Text>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                }}
              >
                <Text style={{ fontSize: 12, color: "#999" }}>
                  命令: {totalCommands}
                </Text>
                <Text style={{ fontSize: 12, color: "#999" }}>
                  AI练习: {totalAiExercises}
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card style={{ height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 24,
                    backgroundColor: "#1890ff",
                    marginRight: 8,
                    borderRadius: 4,
                  }}
                />
                <Title level={5} style={{ margin: 0, fontWeight: "bold" }}>
                  课程结构概览
                </Title>
                <Tag color="blue" style={{ marginLeft: "auto" }}>
                  共 {totalCourses} 门课程
                </Tag>
              </div>
              <DonutChart data={courseChartData} colors={courseColors} />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-around",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                    {totalCourses}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>课程</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#722ed1" }}>
                    {totalChapters}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>章节</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#52c41a" }}>
                    {totalResources}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>知识点</Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card style={{ height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 24,
                    backgroundColor: "#722ed1",
                    marginRight: 8,
                    borderRadius: 4,
                  }}
                />
                <Title level={5} style={{ margin: 0, fontWeight: "bold" }}>
                  媒体资源分布
                </Title>
                <Tag color="purple" style={{ marginLeft: "auto" }}>
                  共 {totalMediaFiles} 个文件
                </Tag>
              </div>
              <DonutChart data={mediaChartData} colors={mediaColors} />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-around",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                    {totalVideos}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>视频</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#faad14" }}>
                    {totalDocuments}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>文档</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#13c2c2" }}>
                    {formatDuration(totalVideoDuration)}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>总时长</Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card style={{ height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 24,
                    backgroundColor: "#faad14",
                    marginRight: 8,
                    borderRadius: 4,
                  }}
                />
                <Title level={5} style={{ margin: 0, fontWeight: "bold" }}>
                  学习活动统计
                </Title>
                <Tag color="orange" style={{ marginLeft: "auto" }}>
                  共 {totalHomeworks + totalExercises} 项任务
                </Tag>
              </div>
              <DonutChart data={studyChartData} colors={studyColors} />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-around",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                    {totalHomeworks}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>作业</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#722ed1" }}>
                    {totalExercises}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>练习题</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#52c41a" }}>
                    {totalAiExercises}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>AI生成</Text>
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card style={{ height: "100%" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 24,
                    backgroundColor: "#52c41a",
                    marginRight: 8,
                    borderRadius: 4,
                  }}
                />
                <Title level={5} style={{ margin: 0, fontWeight: "bold" }}>
                  AI功能使用
                </Title>
                <Tag color="green" style={{ marginLeft: "auto" }}>
                  共 {totalCommands + totalAiExercises} 次使用
                </Tag>
              </div>
              <DonutChart data={aiChartData} colors={aiColors} />
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "space-around",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                    {totalCommands}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>AI命令</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#52c41a" }}>
                    {totalAiExercises}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>AI练习</Text>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Title level={5} style={{ margin: 0, color: "#13c2c2" }}>
                    {totalResources}
                  </Title>
                  <Text style={{ fontSize: 12, color: "#999" }}>知识点</Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
