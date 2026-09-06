import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Row,
  Col,
  Typography,
  Select,
  Spin,
  Tag,
  Tabs,
  Button,
  Tooltip,
  Progress,
  Statistic,
  Empty,
  Avatar,
  Table,
} from "antd";
import {
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  SolutionOutlined,
  RiseOutlined,
  DownloadOutlined,
  ReloadOutlined,
  BarChartOutlined,
  ReadOutlined,
  LineChartOutlined,
  PieChartOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  FileSearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts";
import * as XLSX from "xlsx";
import {
  listCourses,
  listChapters,
  listVideos,
  listExercises,
  listHomeworks,
  listActivityLogs,
  listEnrollmentsByCourse,
  calculateCourseStatistics,
  getCourseLearningStatsByStudent,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useCourses } from "@/hooks/use-courses";

const { Title, Text } = Typography;

interface ApiResult {
  success: boolean;
  data?: unknown;
}

function extractArrayFromResult(result: ApiResult | undefined): any[] {
  if (!result?.success || !result.data) return [];
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

function EChartsChart({
  options,
  height = 350,
}: {
  options: any;
  height?: number;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 如果图表实例不存在，创建一个新的
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 设置配置项
    chartInstance.current.setOption(options, true);

    // 立即调用 resize 确保正确渲染
    chartInstance.current.resize();

    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [options]);

  // 使用 ResizeObserver 监听容器尺寸变化
  useEffect(() => {
    if (!chartRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (chartInstance.current) {
        // 延迟执行 resize，确保容器已完成渲染
        setTimeout(() => {
          chartInstance.current?.resize();
        }, 0);
      }
    });

    resizeObserver.observe(chartRef.current);

    return () => {
      resizeObserver.disconnect();
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, []);

  return <div ref={chartRef} style={{ width: "100%", height }} />;
}

export default function StudySummary() {
  const [activeTab, setActiveTab] = useState("0");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const { user, tenant } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenantName = tenant || "";
  const tenantDisplayName = currentTenant?.name || "默认组织";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const {
    data: coursesData,
    isLoading: coursesLoading,
    refetch: refetchCourses,
  } = useQuery({
    queryKey: ["courses", tenantName],
    queryFn: async () => {
      const result = await listCourses({
        tenant: tenantName,
        fields: ["id", "title", "description", { knowledgeResources: ["id", "name", "knowledgeType"] }] as any,
        headers,
      }) as any;
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "获取课程失败");
      }
      return Array.isArray(result.data) ? result.data : result.data?.results || [];
    },
    enabled: !!tenantName && !!user,
  });

  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listChapters({
        tenant: tenantName,
        fields: ["id", "title", "description", "courseId", "sortOrder"],
        filter: { courseId: { eq: selectedCourseId } },
        sort: "sortOrder",
        page: { limit: 100 },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ["videos", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listVideos({
        tenant: tenantName,
        fields: ["id", "title", "duration", "chapterId"],
        page: { limit: 100 },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: exercisesData, isLoading: exercisesLoading } = useQuery({
    queryKey: ["exercises", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listExercises({
        tenant: tenantName,
        fields: [
          "id",
          "title",
          "questionType",
          "aiType",
          "knowledgeResourceId",
          "answer",
        ],
        filter: { courseId: { eq: selectedCourseId } },
        page: { limit: 100 },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: homeworksData, isLoading: homeworksLoading } = useQuery({
    queryKey: ["homeworks", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listHomeworks({
        tenant: tenantName,
        fields: ["id", "title", "score", "chapterId", "knowledgeResourceId"],
        filter: { courseId: { eq: selectedCourseId } },
        page: { limit: 100 },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: courseStatsData, isLoading: courseStatsLoading } = useQuery({
    queryKey: ["courseStats", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: {} };
      return calculateCourseStatistics({
        tenant: tenantName,
        input: { courseId: selectedCourseId },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: enrollmentsData = {} } = useQuery({
    queryKey: ["enrollments", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listEnrollmentsByCourse({
        tenant: tenantName,
        input: { courseId: selectedCourseId },
        fields: ["id", "memberId", "enrolledAt"],
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const { data: studentLearningStatsData, isLoading: studentStatsLoading } =
    useQuery({
      queryKey: ["studentLearningStats", selectedCourseId, tenantName],
      queryFn: () => {
        if (!selectedCourseId) return { success: true, data: { results: [] } };
        return getCourseLearningStatsByStudent({
          tenant: tenantName,
          input: { courseId: selectedCourseId },
          headers,
        });
      },
      enabled: !!selectedCourseId && !!tenantName,
    });

  const { data: activityLogsData = {} } = useQuery({
    queryKey: ["activityLogs", selectedCourseId, tenantName],
    queryFn: () => {
      if (!selectedCourseId) return { success: true, data: { results: [] } };
      return listActivityLogs({
        tenant: tenantName,
        fields: [
          "id",
          "actionType",
          "resourceId",
          "resourceType",
          "userId",
          "insertedAt",
        ],
        sort: "-insertedAt",
        page: { limit: 2000 },
        headers,
      });
    },
    enabled: !!selectedCourseId && !!tenantName,
  });

  const courses = coursesData || [];
  const chapters = extractArrayFromResult(chaptersData as ApiResult);
  const exercises = extractArrayFromResult(exercisesData as ApiResult);
  const homeworksDataArray = extractArrayFromResult(homeworksData as ApiResult);
  const activityLogs = extractArrayFromResult(activityLogsData as ApiResult);
  const enrollments = extractArrayFromResult(enrollmentsData as ApiResult);
  const courseStats = (courseStatsData as ApiResult)?.success
    ? (courseStatsData as ApiResult).data
    : {};

  const studentLearningStats = (() => {
    const data = (studentLearningStatsData as ApiResult)?.data;
    if (!(studentLearningStatsData as ApiResult)?.success) return [];
    if (Array.isArray((data as any)?.results)) return (data as any).results;
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      const arrays = Object.values(data).filter(Array.isArray);
      if (arrays.length > 0) return arrays.flat();
    }
    return [];
  })();

  const allVideos = extractArrayFromResult(videosData as ApiResult);
  const chapterIds = chapters.map((ch: any) => ch.id);
  const videos = allVideos.filter(
    (video: any) => video.chapterId && chapterIds.includes(video.chapterId),
  );

  useEffect(() => {
    if (!selectedCourseId && courses && courses.length > 0 && courses[0]?.id) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses?.find?.(
    (c: any) => c?.id === selectedCourseId,
  );
  const knowledgeResources = selectedCourse?.knowledgeResources || [];

  const processedStudentStats = useMemo(() => {
    if (
      !Array.isArray(studentLearningStats) ||
      studentLearningStats.length === 0
    ) {
      return [];
    }

    return studentLearningStats.map((student: any) => ({
      studentId: student.studentId,
      studentName: student.name,
      courseId: student.courseId,
      videos: {
        completed: student.videos?.completed || 0,
        total: student.videos?.total || 0,
        completionRatio: student.videos?.completionRatio || 0,
        percentage: Math.round((student.videos?.completionRatio || 0) * 100),
      },
      files: {
        completed: student.files?.completed || 0,
        total: student.files?.total || 0,
        completionRatio: student.files?.completionRatio || 0,
        percentage: Math.round((student.files?.completionRatio || 0) * 100),
      },
      exercises: {
        completed: student.exercises?.completed || 0,
        total: student.exercises?.total || 0,
        completionRatio: student.exercises?.completionRatio || 0,
        percentage: Math.round((student.exercises?.completionRatio || 0) * 100),
      },
      homework: {
        completed: student.homework?.completed || 0,
        total: student.homework?.total || 0,
        completionRatio: student.homework?.completionRatio || 0,
        percentage: Math.round((student.homework?.completionRatio || 0) * 100),
      },
      overall: {
        completed: student.overall?.totalCompleted || 0,
        total: student.overall?.totalResources || 0,
        completionRatio: student.overall?.completionRatio || 0,
        percentage: Math.round((student.overall?.completionRatio || 0) * 100),
      },
    }));
  }, [studentLearningStats]);

  const processedKnowledgePoints = useMemo(() => {
    if (!Array.isArray(knowledgeResources) || knowledgeResources.length === 0) {
      return [];
    }

    return knowledgeResources.map((kp: any) => {
      const studentStats =
        kp.student_learning_stats || kp.studentLearningStats || {};
      const completionData = studentStats.completion || studentStats;
      const completedStudents =
        completionData.completed_students ||
        completionData.completedStudents ||
        studentStats.total_completed ||
        0;
      const totalStudents =
        completionData.total_students ||
        completionData.totalStudents ||
        processedStudentStats.length;
      const completionRatio =
        totalStudents > 0 ? completedStudents / totalStudents : 0;
      const completionRate = Math.round(completionRatio * 100);

      return {
        id: kp.id,
        name: kp.name,
        knowledgeType: kp.knowledgeType,
        description: kp.description,
        studentStats: {
          completedStudents,
          totalStudents,
          averageProgress: studentStats.averageProgress || completionRatio,
          completionRate,
        },
      };
    });
  }, [knowledgeResources, processedStudentStats]);

  const analyticsData = useMemo(() => {
    let courseCompletionRate = 0;
    let completedKnowledgePoints = 0;
    let completedKnowledgePointIds: string[] = [];

    if (processedStudentStats.length > 0) {
      const avgCompletionRate =
        processedStudentStats.reduce(
          (sum: number, student: any) =>
            sum + (student.overall.percentage || 0),
          0,
        ) / processedStudentStats.length;
      courseCompletionRate = Math.round(avgCompletionRate);
      completedKnowledgePoints = Math.round(
        knowledgeResources.length * (avgCompletionRate / 100),
      );
      completedKnowledgePointIds =
        studentLearningStats.length > 0
          ? []
          : [
              ...new Set(
                activityLogs
                  .filter(
                    (log: any) => log.resourceType === "knowledge_resource",
                  )
                  .map((log: any) => log.resourceId)
                  .filter(
                    (id: string) =>
                      id && knowledgeResources.some((kr: any) => kr.id === id),
                  ),
              ),
            ];
    } else if (
      courseStats &&
      typeof (courseStats as any).completionRate === "number"
    ) {
      courseCompletionRate = Math.round(
        (courseStats as any).completionRate * 100,
      );
      completedKnowledgePoints =
        (courseStats as any).completedKnowledgePoints || 0;
      completedKnowledgePointIds = [
        ...new Set(
          activityLogs
            .filter((log: any) => log.resourceType === "knowledge_resource")
            .map((log: any) => log.resourceId)
            .filter(
              (id: string) =>
                id && knowledgeResources.some((kr: any) => kr.id === id),
            ),
        ),
      ];
    } else {
      completedKnowledgePointIds = [
        ...new Set(
          activityLogs
            .filter((log: any) => log.resourceType === "knowledge_resource")
            .map((log: any) => log.resourceId)
            .filter(
              (id: string) =>
                id && knowledgeResources.some((kr: any) => kr.id === id),
            ),
        ),
      ];
      completedKnowledgePoints = completedKnowledgePointIds.length;
      courseCompletionRate =
        knowledgeResources.length > 0
          ? Math.round(
              (completedKnowledgePoints / knowledgeResources.length) * 100,
            )
          : 0;
    }

    const knowledgePointCompletionRates = knowledgeResources.map((kp: any) => {
      const kpVideos = videos.filter(
        (v: any) => v.knowledgeResourceId === kp.id,
      );
      const kpExercises = exercises.filter(
        (e: any) => e.knowledgeResourceId === kp.id,
      );
      const kpHomeworks = homeworksDataArray.filter(
        (h: any) => h.knowledgeResourceId === kp.id,
      );
      const kpFiles = allVideos.filter(
        (v: any) => v.knowledgeResourceId === kp.id,
      );

      const totalResources =
        1 +
        kpVideos.length +
        kpExercises.length +
        kpHomeworks.length +
        kpFiles.length;
      const isKpCompleted = completedKnowledgePointIds.includes(kp.id);

      const completedVideos = [
        ...new Set(
          activityLogs
            .filter(
              (log: any) =>
                log.resourceType === "video" && log.actionType === "video_view",
            )
            .map((log: any) => log.resourceId)
            .filter((id: string) => kpVideos.some((v: any) => v.id === id)),
        ),
      ];

      const completedExercises = [
        ...new Set(
          activityLogs
            .filter(
              (log: any) =>
                log.resourceType === "exercise" &&
                log.actionType === "exercise_submit",
            )
            .map((log: any) => log.resourceId)
            .filter((id: string) => kpExercises.some((e: any) => e.id === id)),
        ),
      ];

      const completedHomeworks = [
        ...new Set(
          activityLogs
            .filter(
              (log: any) =>
                log.resourceType === "homework" &&
                log.actionType === "homework_submit",
            )
            .map((log: any) => log.resourceId)
            .filter((id: string) => kpHomeworks.some((h: any) => h.id === id)),
        ),
      ];

      const completedResources =
        (isKpCompleted ? 1 : 0) +
        completedVideos.length +
        completedExercises.length +
        completedHomeworks.length;
      const completionRate =
        totalResources > 0
          ? Math.round((completedResources / totalResources) * 100)
          : 0;

      return {
        id: kp.id,
        name: kp.name,
        knowledgeType: kp.knowledgeType,
        completionRate,
        totalResources,
        completedResources,
        isCompleted: isKpCompleted,
      };
    });

    const contentDistribution = [
      { name: "章节", value: chapters.length, color: "#0284c7" },
      { name: "视频", value: videos.length, color: "#d97706" },
      { name: "练习题", value: exercises.length, color: "#16a34a" },
      { name: "作业", value: homeworksDataArray.length, color: "#db2777" },
    ];

    const typeLabelMap: Record<string, string> = {
      multiple_choice: "单选题",
      multiple_response: "多选题",
      true_false: "判断题",
      fill_in_blank: "填空题",
      essay: "问答题",
      term_definition: "名词解释",
      case_study: "案例题",
    };
    const exerciseTypes = exercises.reduce(
      (acc: Record<string, number>, exercise: any) => {
        const type = typeLabelMap[exercise.questionType] || exercise.questionType || "其他";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      {},
    );

    const typeColorMap: Record<string, string> = {
      "单选题": "#0284c7",
      "多选题": "#7c3aed",
      "判断题": "#0891b2",
      "填空题": "#d97706",
      "问答题": "#16a34a",
      "名词解释": "#db2777",
      "案例题": "#ca8a04",
    };
    const exerciseTypeDistribution = Object.entries(exerciseTypes).map(
      ([name, value]) => ({
        name,
        value,
        color: typeColorMap[name] || "#64748b",
      }),
    );

    const aiGenerated = exercises.filter(
      (e: any) => e.aiType === "ai_generated",
    ).length;
    const manualGenerated = exercises.length - aiGenerated;
    const exerciseSourceDistribution = [
      { name: "AI生成", value: aiGenerated, color: "#8b5cf6" },
      { name: "手动创建", value: manualGenerated, color: "#64748b" },
    ];

    const scoreRanges = homeworksDataArray.reduce(
      (acc: Record<string, number>, homework: any) => {
        const score = parseFloat(homework.score || "0");
        let range = "未设置";
        if (score > 0 && score <= 30) range = "0-30分";
        else if (score > 30 && score <= 60) range = "31-60分";
        else if (score > 60 && score <= 80) range = "61-80分";
        else if (score > 80 && score <= 100) range = "81-100分";
        acc[range] = (acc[range] || 0) + 1;
        return acc;
      },
      {},
    );

    const scoreDistribution = Object.entries(scoreRanges).map(
      ([name, value]) => ({
        name,
        value,
        color:
          name === "未设置"
            ? "#94a3b8"
            : name === "0-30分"
              ? "#ef4444"
              : name === "31-60分"
                ? "#f97316"
                : name === "61-80分"
                  ? "#eab308"
                  : "#22c55e",
      }),
    );

    const currentChapters = chapters.length;
    const currentVideos = videos.length;
    const currentExercises = exercises.length;
    const currentHomeworks = homeworksDataArray.length;

    // 生成最近6个月的月份标签
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentYear = now.getFullYear();
    const monthlyGrowth = Array.from({ length: 6 }, (_, i) => {
      const monthOffset = 5 - i; // 从5个月前到当前月
      const month = ((currentMonth - monthOffset - 1 + 12) % 12) + 1;
      const year = currentMonth - monthOffset > 0 ? currentYear : currentYear - 1;
      return {
        month: `${month}月`,
        year,
        // 前5个月数据为0，当前月显示实际数量
        chapters: i === 5 ? currentChapters : 0,
        videos: i === 5 ? currentVideos : 0,
        exercises: i === 5 ? currentExercises : 0,
        homeworks: i === 5 ? currentHomeworks : 0,
      };
    });

    const totalExercises = exercises.length;
    const aiGeneratedExercises = exercises.filter(
      (e: any) => e.aiType === "ai_generated",
    ).length;
    const aiGeneratedRatio =
      totalExercises > 0
        ? Math.round((aiGeneratedExercises / totalExercises) * 100)
        : 0;

    const exercisesWithoutAnswers = exercises.filter(
      (e: any) => !e.answer || e.answer.trim() === "" || e.answer === null,
    ).length;
    const missingAnswersRatio =
      totalExercises > 0
        ? Math.round((exercisesWithoutAnswers / totalExercises) * 100)
        : 0;

    const exerciseSubmitLogs = activityLogs.filter(
      (log: any) => log.actionType === "exercise_submit",
    );
    const exerciseIds = exercises.map((e: any) => e.id);
    const submittedExerciseIds = [
      ...new Set(
        exerciseSubmitLogs
          .map((log: any) => log.resourceId)
          .filter((id: string) => exerciseIds.includes(id)),
      ),
    ];
    const exerciseSubmissionRatio =
      totalExercises > 0
        ? Math.round((submittedExerciseIds.length / totalExercises) * 100)
        : 0;

    const engagementMetrics = [
      { metric: "练习提交率", value: exerciseSubmissionRatio },
      { metric: "AI生成练习占比", value: aiGeneratedRatio },
      { metric: "练习答案缺失率", value: missingAnswersRatio },
    ];

    const avgScore =
      currentHomeworks > 0
        ? (
            homeworksDataArray.reduce(
              (sum: number, h: any) => sum + parseFloat(h.score || "0"),
              0,
            ) / currentHomeworks
          ).toFixed(1)
        : "0";

    const aiContentRatio =
      currentExercises > 0
        ? ((aiGenerated / currentExercises) * 100).toFixed(1)
        : "0";

    const resourceCompletionStats =
      processedStudentStats.length > 0
        ? {
            videos: {
              totalCompleted: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.videos.completed,
                0,
              ),
              totalPossible: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.videos.total,
                0,
              ),
              averageRate: Math.round(
                processedStudentStats.reduce(
                  (sum: number, s: any) => sum + s.videos.percentage,
                  0,
                ) / processedStudentStats.length,
              ),
            },
            files: {
              totalCompleted: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.files.completed,
                0,
              ),
              totalPossible: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.files.total,
                0,
              ),
              averageRate: Math.round(
                processedStudentStats.reduce(
                  (sum: number, s: any) => sum + s.files.percentage,
                  0,
                ) / processedStudentStats.length,
              ),
            },
            exercises: {
              totalCompleted: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.exercises.completed,
                0,
              ),
              totalPossible: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.exercises.total,
                0,
              ),
              averageRate: Math.round(
                processedStudentStats.reduce(
                  (sum: number, s: any) => sum + s.exercises.percentage,
                  0,
                ) / processedStudentStats.length,
              ),
            },
            homework: {
              totalCompleted: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.homework.completed,
                0,
              ),
              totalPossible: processedStudentStats.reduce(
                (sum: number, s: any) => sum + s.homework.total,
                0,
              ),
              averageRate: Math.round(
                processedStudentStats.reduce(
                  (sum: number, s: any) => sum + s.homework.percentage,
                  0,
                ) / processedStudentStats.length,
              ),
            },
          }
        : {
            videos: { totalCompleted: 0, totalPossible: 0, averageRate: 0 },
            files: { totalCompleted: 0, totalPossible: 0, averageRate: 0 },
            exercises: { totalCompleted: 0, totalPossible: 0, averageRate: 0 },
            homework: { totalCompleted: 0, totalPossible: 0, averageRate: 0 },
          };

    return {
      contentDistribution,
      exerciseTypeDistribution,
      exerciseSourceDistribution,
      scoreDistribution,
      monthlyGrowth,
      engagementMetrics,
      totalContent:
        currentChapters + currentVideos + currentExercises + currentHomeworks,
      avgScore,
      aiContentRatio,
      courseCompletionRate,
      knowledgePointCompletionRates,
      totalKnowledgePoints: knowledgeResources.length,
      completedKnowledgePoints,
      totalEnrollments: enrollments.length,
      completedEnrollments: 0,
      resourceCompletionStats,
      processedStudentStats,
      processedKnowledgePoints,
    };
  }, [
    chapters,
    videos,
    exercises,
    homeworksDataArray,
    activityLogs,
    knowledgeResources,
    courseStats,
    enrollments,
    processedStudentStats,
    processedKnowledgePoints,
    allVideos,
  ]);

  const handleRefresh = () => {
    refetchCourses();
  };

  const handleExportData = () => {
    const wb = XLSX.utils.book_new();

    const courseOverviewData = [
      ["课程名称", selectedCourse?.title || "未命名课程"],
      ["课程描述", selectedCourse?.description || "暂无课程描述"],
      ["导出时间", new Date().toLocaleString()],
      ["组织", tenantDisplayName],
      ["总内容数量", analyticsData.totalContent],
      ["练习题数量", exercises.length],
      ["平均分数", analyticsData.avgScore],
      ["AI内容比例", `${analyticsData.aiContentRatio}%`],
      ["课程完成度", `${analyticsData.courseCompletionRate}%`],
      ["总知识点数", analyticsData.totalKnowledgePoints],
      ["已完成知识点", analyticsData.completedKnowledgePoints],
      ["学习学生数", processedStudentStats.length],
      [
        "已完成学生数",
        processedStudentStats.filter((s: any) => s.overall.percentage >= 100)
          .length,
      ],
    ];
    const courseOverviewWs = XLSX.utils.aoa_to_sheet(courseOverviewData);
    XLSX.utils.book_append_sheet(wb, courseOverviewWs, "课程概览");

    const contentDistributionData = [
      ["内容类型", "数量", "占比"],
      ...analyticsData.contentDistribution.map((item: any) => [
        item.name,
        item.value,
        `${((item.value / analyticsData.totalContent) * 100).toFixed(1)}%`,
      ]),
    ];
    const contentDistributionWs = XLSX.utils.aoa_to_sheet(
      contentDistributionData,
    );
    XLSX.utils.book_append_sheet(wb, contentDistributionWs, "内容分布");

    const exerciseAnalysisData = [
      ["练习题类型", "数量"],
      ...analyticsData.exerciseTypeDistribution.map((item: any) => [
        item.name,
        item.value,
      ]),
    ];
    const exerciseAnalysisWs = XLSX.utils.aoa_to_sheet(exerciseAnalysisData);
    XLSX.utils.book_append_sheet(wb, exerciseAnalysisWs, "练习分析");

    const engagementMetricsData = [
      ["指标", "数值", "说明"],
      ...analyticsData.engagementMetrics.map((metric: any) => [
        metric.metric,
        `${metric.value}%`,
        metric.metric === "练习提交率"
          ? "学生提交练习的比例"
          : metric.metric === "AI生成练习占比"
            ? "AI生成的练习比例"
            : "缺少答案的练习比例",
      ]),
    ];
    const engagementMetricsWs = XLSX.utils.aoa_to_sheet(engagementMetricsData);
    XLSX.utils.book_append_sheet(wb, engagementMetricsWs, "参与度指标");

    if (processedStudentStats.length > 0) {
      const studentStatsData = [
        [
          "学生姓名",
          "视频完成度",
          "文件完成度",
          "练习完成度",
          "作业完成度",
          "整体完成度",
        ],
        ...processedStudentStats.map((student: any) => [
          student.studentName || "",
          `${student.videos.percentage}%`,
          `${student.files.percentage}%`,
          `${student.exercises.percentage}%`,
          `${student.homework.percentage}%`,
          `${student.overall.percentage}%`,
        ]),
      ];
      const studentStatsWs = XLSX.utils.aoa_to_sheet(studentStatsData);
      XLSX.utils.book_append_sheet(wb, studentStatsWs, "学生学习统计");
    }

    const knowledgeTypeMap: Record<string, string> = {
      subject: "主题",
      knowledge_unit: "知识单元",
      knowledge_cell: "知识点",
    };

    if (processedKnowledgePoints.length > 0) {
      const knowledgePointsData = [
        [
          "知识点名称",
          "知识点类型",
          "完成学生数",
          "总学生数",
          "完成率",
        ],
        ...processedKnowledgePoints.map((kp: any) => [
          kp.name,
          knowledgeTypeMap[kp.knowledgeType] || kp.knowledgeType,
          kp.studentStats.completedStudents,
          kp.studentStats.totalStudents,
          `${kp.studentStats.completionRate}%`,
        ]),
      ];
      const knowledgePointsWs = XLSX.utils.aoa_to_sheet(knowledgePointsData);
      XLSX.utils.book_append_sheet(wb, knowledgePointsWs, "知识点分析");
    }

    const resourceCompletionData = [
      ["资源类型", "平均完成率", "已完成总数", "总资源数"],
      [
        "视频",
        `${analyticsData.resourceCompletionStats.videos.averageRate}%`,
        analyticsData.resourceCompletionStats.videos.totalCompleted,
        analyticsData.resourceCompletionStats.videos.totalPossible,
      ],
      [
        "文件",
        `${analyticsData.resourceCompletionStats.files.averageRate}%`,
        analyticsData.resourceCompletionStats.files.totalCompleted,
        analyticsData.resourceCompletionStats.files.totalPossible,
      ],
      [
        "练习",
        `${analyticsData.resourceCompletionStats.exercises.averageRate}%`,
        analyticsData.resourceCompletionStats.exercises.totalCompleted,
        analyticsData.resourceCompletionStats.exercises.totalPossible,
      ],
      [
        "作业",
        `${analyticsData.resourceCompletionStats.homework.averageRate}%`,
        analyticsData.resourceCompletionStats.homework.totalCompleted,
        analyticsData.resourceCompletionStats.homework.totalPossible,
      ],
    ];
    const resourceCompletionWs = XLSX.utils.aoa_to_sheet(
      resourceCompletionData,
    );
    XLSX.utils.book_append_sheet(wb, resourceCompletionWs, "资源完成统计");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `学习分析报告-${selectedCourse?.title || "未命名课程"}-${new Date().toLocaleDateString()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isLoading =
    coursesLoading ||
    courseStatsLoading ||
    studentStatsLoading ||
    chaptersLoading ||
    videosLoading ||
    exercisesLoading ||
    homeworksLoading;

  if (!tenantName) {
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
        <Title level={4} style={{ marginBottom: 16, color: "#faad14" }}>
          未选择组织
        </Title>
        <Text style={{ marginBottom: 24 }}>
          请选择一个组织以查看学习数据分析。
        </Text>
        <Button
          type="primary"
          onClick={() => (window.location.href = "/dashboard/organization")}
        >
          选择组织
        </Button>
      </div>
    );
  }

  if (isLoading) {
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
        <Text style={{ marginLeft: 16 }}>
          {studentStatsLoading
            ? "加载学习统计数据中..."
            : courseStatsLoading
              ? "加载课程统计数据中..."
              : "加载课程数据中..."}
        </Text>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Empty description="暂无课程数据" />
      </div>
    );
  }

  const tabItems = [
    {
      key: "0",
      label: (
        <span>
          <PieChartOutlined />
          内容分布
        </span>
      ),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card
              title={<Text strong>内容类型分布</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <EChartsChart
                options={{
                  tooltip: { trigger: "item" },
                  legend: { position: "bottom" },
                  colors: analyticsData.contentDistribution.map(
                    (item: any) => item.color,
                  ),
                  series: [
                    {
                      type: "pie",
                      radius: ["40%", "70%"],
                      data: analyticsData.contentDistribution.map(
                        (item: any) => ({ value: item.value, name: item.name }),
                      ),
                      label: { show: true, formatter: "{b}: {d}%" },
                    },
                  ],
                }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              title={<Text strong>AI vs 手动内容对比</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <EChartsChart
                options={{
                  tooltip: { trigger: "item" },
                  legend: { position: "bottom" },
                  colors: analyticsData.exerciseSourceDistribution.map(
                    (item: any) => item.color,
                  ),
                  series: [
                    {
                      type: "pie",
                      radius: ["40%", "70%"],
                      data: analyticsData.exerciseSourceDistribution.map(
                        (item: any) => ({ value: item.value, name: item.name }),
                      ),
                      label: { show: true, formatter: "{b}: {d}%" },
                    },
                  ],
                }}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "1",
      label: (
        <span>
          <BarChartOutlined />
          练习分析
        </span>
      ),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Card
              title={<Text strong>练习题类型分布</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <EChartsChart
                options={{
                  tooltip: { trigger: "axis" },
                  xAxis: {
                    type: "category",
                    data: analyticsData.exerciseTypeDistribution.map(
                      (item: any) => item.name,
                    ),
                  },
                  yAxis: { type: "value" },
                  series: [
                    {
                      type: "bar",
                      data: analyticsData.exerciseTypeDistribution.map(
                        (item: any) => item.value,
                      ),
                      itemStyle: {
                        color: "#0284c7",
                        borderRadius: [8, 8, 0, 0],
                      },
                    },
                  ],
                }}
              />
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card
              title={<Text strong>练习内容质量指标</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 24 }}
              >
                {analyticsData.engagementMetrics.map(
                  (metric: any, index: number) => {
                    let strokeColor = "#52c41a";
                    if (metric.metric === "练习提交率") {
                      strokeColor =
                        metric.value >= 70
                          ? "#52c41a"
                          : metric.value >= 40
                            ? "#faad14"
                            : "#ff4d4f";
                    } else if (metric.metric === "AI生成练习占比") {
                      strokeColor =
                        metric.value >= 50
                          ? "#52c41a"
                          : metric.value >= 20
                            ? "#faad14"
                            : "#ff4d4f";
                    } else {
                      strokeColor =
                        metric.value <= 10
                          ? "#52c41a"
                          : metric.value <= 30
                            ? "#faad14"
                            : "#ff4d4f";
                    }
                    return (
                      <div key={index}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text strong>{metric.metric}</Text>
                          <Text type="secondary">{metric.value}%</Text>
                        </div>
                        <Progress
                          percent={metric.value}
                          strokeColor={strokeColor}
                          showInfo={false}
                        />
                      </div>
                    );
                  },
                )}
              </div>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "2",
      label: (
        <span>
          <LineChartOutlined />
          作业分析
        </span>
      ),
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Card
              title={<Text strong>作业分数分布</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <EChartsChart
                options={{
                  tooltip: { trigger: "axis" },
                  xAxis: {
                    type: "category",
                    data: analyticsData.scoreDistribution.map(
                      (item: any) => item.name,
                    ),
                  },
                  yAxis: { type: "value" },
                  series: [
                    {
                      type: "bar",
                      data: analyticsData.scoreDistribution.map(
                        (item: any) => ({
                          value: item.value,
                          itemStyle: { color: item.color },
                        }),
                      ),
                      itemStyle: { borderRadius: [8, 8, 0, 0] },
                      label: { show: true, position: "top" },
                    },
                  ],
                }}
              />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card
              title={<Text strong>作业统计摘要</Text>}
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Text>总作业数</Text>
                  <Text strong>{homeworksDataArray.length}</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Text>平均分数</Text>
                  <Text strong>{analyticsData.avgScore}分</Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <Text>已设置分数</Text>
                  <Text strong>
                    {
                      homeworksDataArray.filter(
                        (h: any) => h.score && parseFloat(h.score) > 0,
                      ).length
                    }
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 0",
                  }}
                >
                  <Text>未设置分数</Text>
                  <Text strong>
                    {
                      homeworksDataArray.filter(
                        (h: any) => !h.score || parseFloat(h.score) === 0,
                      ).length
                    }
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: "3",
      label: (
        <span>
          <ThunderboltOutlined />
          学生完成度
        </span>
      ),
      children: (
        <div>
          {/* Overview metrics - Coursera style */}
          <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
            <Col xs={12} sm={12} md={6}>
              <div style={{
                background: "#fff",
                border: "1px solid #E0E0E0",
                borderRadius: 8,
                padding: "20px 24px",
                borderLeft: "4px solid #0056D2",
              }}>
                <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <BarChartOutlined /> 平均完成度
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#0056D2" }}>
                  {analyticsData.courseCompletionRate}%
                </div>
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div style={{
                background: "#fff",
                border: "1px solid #E0E0E0",
                borderRadius: 8,
                padding: "20px 24px",
                borderLeft: "4px solid #18842C",
              }}>
                <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <UserOutlined /> 学习学生数
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#18842C" }}>
                  {processedStudentStats.length}
                </div>
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div style={{
                background: "#fff",
                border: "1px solid #E0E0E0",
                borderRadius: 8,
                padding: "20px 24px",
                borderLeft: "4px solid #0056D2",
              }}>
                <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircleOutlined /> 优秀 (&ge;80%)
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#0056D2" }}>
                  {processedStudentStats.filter((s: any) => s.overall.percentage >= 80).length}
                </div>
              </div>
            </Col>
            <Col xs={12} sm={12} md={6}>
              <div style={{
                background: "#fff",
                border: "1px solid #E0E0E0",
                borderRadius: 8,
                padding: "20px 24px",
                borderLeft: "4px solid #E65100",
              }}>
                <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <RiseOutlined /> 待提升 (&lt;50%)
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#E65100" }}>
                  {processedStudentStats.filter((s: any) => s.overall.percentage < 50).length}
                </div>
              </div>
            </Col>
          </Row>

          {/* Resource completion summary */}
          {processedStudentStats.length > 0 && (
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "24px",
              marginBottom: 32,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1F1F1F", marginBottom: 20 }}>
                资源完成概览
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { label: "视频", icon: <VideoCameraOutlined style={{ color: "#0056D2" }} />, rate: analyticsData.resourceCompletionStats.videos.averageRate, completed: analyticsData.resourceCompletionStats.videos.totalCompleted, total: analyticsData.resourceCompletionStats.videos.totalPossible, color: "#0056D2" },
                  { label: "文件", icon: <FileTextOutlined style={{ color: "#1A6DAA" }} />, rate: analyticsData.resourceCompletionStats.files.averageRate, completed: analyticsData.resourceCompletionStats.files.totalCompleted, total: analyticsData.resourceCompletionStats.files.totalPossible, color: "#1A6DAA" },
                  { label: "练习", icon: <SolutionOutlined style={{ color: "#18842C" }} />, rate: analyticsData.resourceCompletionStats.exercises.averageRate, completed: analyticsData.resourceCompletionStats.exercises.totalCompleted, total: analyticsData.resourceCompletionStats.exercises.totalPossible, color: "#18842C" },
                  { label: "作业", icon: <BookOutlined style={{ color: "#6B2FA0" }} />, rate: analyticsData.resourceCompletionStats.homework.averageRate, completed: analyticsData.resourceCompletionStats.homework.totalCompleted, total: analyticsData.resourceCompletionStats.homework.totalPossible, color: "#6B2FA0" },
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ width: 80, display: "flex", alignItems: "center", gap: 6, color: "#5E5E5E", fontSize: 13 }}>
                      {item.icon} {item.label}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 8, background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${item.rate}%`, background: item.color, borderRadius: 4, transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                    <div style={{ width: 60, textAlign: "right", fontSize: 13, color: "#1F1F1F", fontWeight: 600 }}>
                      {item.rate}%
                    </div>
                    <div style={{ width: 80, textAlign: "right", fontSize: 12, color: "#5E5E5E" }}>
                      {item.completed}/{item.total}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Student progress table */}
          {processedStudentStats.length > 0 ? (
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              overflow: "hidden",
            }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #E0E0E0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1F1F1F" }}>
                  学生完成详情
                </div>
                <div style={{ fontSize: 13, color: "#5E5E5E" }}>
                  共 {processedStudentStats.length} 名学生
                </div>
              </div>
              <Table
                dataSource={processedStudentStats}
                rowKey="studentId"
                pagination={false}
                className="theme-table"
                columns={[
                  {
                    title: "学生",
                    dataIndex: "studentName",
                    key: "studentName",
                    render: (name: string) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar size={32} style={{ backgroundColor: "#0056D2", flexShrink: 0, fontSize: 14 }}>
                          {name?.charAt(0) || "?"}
                        </Avatar>
                        <span style={{ fontWeight: 500, color: "#1F1F1F" }}>{name || "未知学生"}</span>
                      </div>
                    ),
                  },
                  {
                    title: "视频",
                    key: "videos",
                    width: 140,
                    render: (_: any, record: any) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${record.videos.percentage}%`, background: "#0056D2", borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: "#5E5E5E", minWidth: 32, textAlign: "right" }}>{record.videos.percentage}%</span>
                      </div>
                    ),
                  },
                  {
                    title: "文件",
                    key: "files",
                    width: 140,
                    render: (_: any, record: any) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${record.files.percentage}%`, background: "#1A6DAA", borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: "#5E5E5E", minWidth: 32, textAlign: "right" }}>{record.files.percentage}%</span>
                      </div>
                    ),
                  },
                  {
                    title: "练习",
                    key: "exercises",
                    width: 140,
                    render: (_: any, record: any) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${record.exercises.percentage}%`, background: "#18842C", borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: "#5E5E5E", minWidth: 32, textAlign: "right" }}>{record.exercises.percentage}%</span>
                      </div>
                    ),
                  },
                  {
                    title: "作业",
                    key: "homework",
                    width: 140,
                    render: (_: any, record: any) => (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ height: 6, background: "#F0F0F0", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${record.homework.percentage}%`, background: "#6B2FA0", borderRadius: 3 }} />
                          </div>
                        </div>
                        <span style={{ fontSize: 12, color: "#5E5E5E", minWidth: 32, textAlign: "right" }}>{record.homework.percentage}%</span>
                      </div>
                    ),
                  },
                  {
                    title: "整体完成度",
                    key: "overall",
                    width: 160,
                    render: (_: any, record: any) => {
                      const pct = record.overall.percentage;
                      const color = pct >= 80 ? "#18842C" : pct >= 50 ? "#E65100" : "#D32F2F";
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ height: 8, background: "#F0F0F0", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4 }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 600, color, minWidth: 36, textAlign: "right" }}>{pct}%</span>
                        </div>
                      );
                    },
                  },
                  {
                    title: "状态",
                    key: "status",
                    width: 80,
                    render: (_: any, record: any) => {
                      const pct = record.overall.percentage;
                      if (pct >= 80) return <Tag color="success">优秀</Tag>;
                      if (pct >= 50) return <Tag color="warning">良好</Tag>;
                      return <Tag color="error">待提升</Tag>;
                    },
                  },
                ]}
              />
            </div>
          ) : (
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: 64,
              textAlign: "center",
            }}>
              <Empty description="暂无学生学习数据，请确认该课程已有学生参与学习" />
            </div>
          )}
        </div>
      ),
    },

    {
      key: "4",
      label: (
        <span>
          <RiseOutlined />
          时间线
        </span>
      ),
      children: (
        <Card
          title={<Text strong>内容创建时间线（近6个月）</Text>}
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
        >
          <EChartsChart
            options={{
              tooltip: { trigger: "axis" },
              legend: { position: "top" },
              xAxis: {
                type: "category",
                data: analyticsData.monthlyGrowth.map(
                  (item: any) => `${item.year}年${item.month}`,
                ),
              },
              yAxis: { type: "value" },
              series: [
                {
                  name: "章节",
                  type: "line",
                  smooth: true,
                  data: analyticsData.monthlyGrowth.map(
                    (item: any) => item.chapters,
                  ),
                },
                {
                  name: "视频",
                  type: "line",
                  smooth: true,
                  data: analyticsData.monthlyGrowth.map(
                    (item: any) => item.videos,
                  ),
                },
                {
                  name: "练习题",
                  type: "line",
                  smooth: true,
                  data: analyticsData.monthlyGrowth.map(
                    (item: any) => item.exercises,
                  ),
                },
                {
                  name: "作业",
                  type: "line",
                  smooth: true,
                  data: analyticsData.monthlyGrowth.map(
                    (item: any) => item.homeworks,
                  ),
                },
              ],
              color: ["#0284c7", "#d97706", "#16a34a", "#db2777"],
            }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div style={{ backgroundColor: "#F8F9FA", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
            background: "#fff",
            padding: "20px 24px",
            borderRadius: 8,
            border: "1px solid #E0E0E0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <BarChartOutlined style={{ fontSize: 28, color: "#0056D2" }} />
            <div>
              <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#1F1F1F" }}>
                学习数据分析 - {tenantDisplayName}
              </Title>
              <Text style={{ fontSize: 14, color: "#5E5E5E" }}>基于课程内容的深度分析报告</Text>
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Select
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              style={{ minWidth: 300 }}
              placeholder="选择课程"
              options={courses?.map?.((course: any) => ({
                value: course?.id,
                label: course?.title,
              }))}
            />
            <Tooltip title="刷新数据">
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
              />
            </Tooltip>
            <Tooltip title="导出报告">
              <Button
                type="text"
                icon={<DownloadOutlined />}
                onClick={handleExportData}
              />
            </Tooltip>
          </div>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
          <Col xs={12} sm={6}>
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "20px 24px",
              borderLeft: "4px solid #0056D2",
            }}>
              <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <ReadOutlined style={{ color: "#0056D2" }} /> 总内容数量
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#0056D2" }}>
                {analyticsData.totalContent}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "20px 24px",
              borderLeft: "4px solid #18842C",
            }}>
              <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <FileTextOutlined style={{ color: "#18842C" }} /> 练习题数量
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#18842C" }}>
                {exercises.length}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "20px 24px",
              borderLeft: "4px solid #6B2FA0",
            }}>
              <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <SolutionOutlined style={{ color: "#6B2FA0" }} /> 平均分数
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#6B2FA0" }}>
                {analyticsData.avgScore}
              </div>
            </div>
          </Col>
          <Col xs={12} sm={6}>
            <div style={{
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "20px 24px",
              borderLeft: "4px solid #E65100",
            }}>
              <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <RiseOutlined style={{ color: "#E65100" }} /> AI内容比例
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#E65100" }}>
                {analyticsData.aiContentRatio}%
              </div>
            </div>
          </Col>
        </Row>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="theme-tabs"
          style={{ marginBottom: 24, background: "#fff", borderRadius: 8, border: "1px solid #E0E0E0", padding: "0 16px" }}
        />

        {selectedCourse && (
          <div
            style={{
              marginTop: 24,
              background: "#fff",
              border: "1px solid #E0E0E0",
              borderRadius: 8,
              padding: "20px 24px",
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1F1F1F", marginBottom: 6 }}>
              当前课程: {selectedCourse.title}
            </div>
            <div style={{ fontSize: 13, color: "#5E5E5E", marginBottom: 16 }}>
              {selectedCourse.description || "暂无课程描述"}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <Tag className="theme-tag theme-tag-primary">{chapters.length} 章节</Tag>
              <Tag className="theme-tag theme-tag-primary">{videos.length} 视频</Tag>
              <Tag className="theme-tag theme-tag-success">{exercises.length} 练习</Tag>
              <Tag className="theme-tag theme-tag-primary">{homeworksDataArray.length} 作业</Tag>
              <Tag className="theme-tag theme-tag-primary">{knowledgeResources.length} 知识点</Tag>
              <Tag className="theme-tag theme-tag-success">
                {analyticsData.courseCompletionRate}% 完成度
              </Tag>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
