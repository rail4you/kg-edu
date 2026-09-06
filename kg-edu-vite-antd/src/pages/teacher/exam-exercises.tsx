import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Typography,
  Card,
  Modal,
  Input,
  InputNumber,
  Select,
  Spin,
  Divider,
  Tag,
  Space,
  Checkbox,
  message,
  Popconfirm,
  Empty,
  Statistic,
  Row,
  Col,
  Dropdown,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  MinusOutlined,
  ArrowLeftOutlined,
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StarFilled,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  getExercisesByExam,
  listExercises,
  addExerciseToExam,
  removeExerciseFromExam,
  updateExamExercise,
  getExam,
} from "@/lib/ash_rpc";
import { previewExam } from "@/lib/agent_api";
import type { PreviewSection, PreviewExercise } from "@/lib/agent_api";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useAuth } from "@/auth/auth-context";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Exercise {
  id: string;
  title: string;
  questionContent: string;
  questionType: string;
  answer?: string;
  answerExplanation?: string;
}

interface ExamExercise {
  id: string;
  examId: string;
  exerciseId: string;
  exercise?: Exercise;
  points: number;
  order?: number;
}

interface ExerciseTypeStats {
  questionType: string;
  questionTypeName: string;
  count: number;
}

interface ComposeConfigItem {
  questionType: string;
  questionTypeName: string;
  count: number;
  pointsPerQuestion: number;
  enabled: boolean;
  maxCount: number;
  difficulties: number[];
}

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const questionTypeNames: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  fill_in_blank: "填空题",
  fill_blank: "填空题",
  essay: "问答题",
  term_definition: "名词解释",
  case_study: "案例题",
};

const questionTypeOptions = [
  { value: "all", label: "全部题型" },
  { value: "multiple_choice", label: "单选题" },
  { value: "multiple_response", label: "多选题" },
  { value: "true_false", label: "判断题" },
  { value: "fill_in_blank", label: "填空题" },
  { value: "essay", label: "问答题" },
  { value: "term_definition", label: "名词解释" },
  { value: "case_study", label: "案例题" },
];

const translateQuestionType = (type: string) => {
  const typeMap: Record<string, string> = {
    essay: "问答题",
    multiple_choice: "选择题",
    text: "文本题",
    true_false: "判断题",
    fill_in_blank: "填空题",
  };
  return typeMap[type] || type;
};

export default function ExamExercises() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { examId } = useParams();
  const navigate = useNavigate();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<ExamExercise | null>(
    null,
  );
  const [editForm, setEditForm] = useState({ points: 10, order: 1 });
  const [selectedExercisesMap, setSelectedExercisesMap] = useState<
    Map<string, string>
  >(new Map());
  const [selectedQuestionType, setSelectedQuestionType] =
    useState<string>("all");
  const [tableQuestionTypeFilter, setTableQuestionTypeFilter] =
    useState<string>("all");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;
  const [searchQuery, setSearchQuery] = useState("");

  const [autoComposeOpen, setAutoComposeOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewSections, setPreviewSections] = useState<PreviewSection[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
  const [removedExerciseIds, setRemovedExerciseIds] = useState<Set<string>>(new Set());

  const [exerciseTypeStats, setExerciseTypeStats] = useState<
    ExerciseTypeStats[]
  >([]);
  const [loadingExerciseStats, setLoadingExerciseStats] = useState(false);
  const [composeConfig, setComposeConfig] = useState<ComposeConfigItem[]>([]);

  const tenant = currentTenant?.schemaName || "";

  const fetchExerciseTypeStats = async (courseId: string) => {
    setLoadingExerciseStats(true);
    try {
      const questionTypes = ["multiple_choice", "multiple_response", "true_false", "fill_in_blank", "essay", "term_definition", "case_study"];
      const stats: ExerciseTypeStats[] = [];

      for (const questionType of questionTypes) {
        const result = await listExercises({
          tenant,
          fields: ["id"],
          filter: {
            courseId: { eq: courseId },
            questionType: { eq: questionType as any },
          },
          page: { limit: 1, offset: 0, count: true },
          headers: getHeaders(user),
        });

        if (result.success && result.data) {
          const count =
            (result.data as any).count ?? (result.data as any).total ?? 0;
          if (count > 0) {
            stats.push({
              questionType,
              questionTypeName: questionTypeNames[questionType] || questionType,
              count,
            });
          }
        }
      }

      setExerciseTypeStats(stats);

      const config: ComposeConfigItem[] = stats.map((stat) => ({
        questionType: stat.questionType,
        questionTypeName: stat.questionTypeName,
        count: stat.count,
        pointsPerQuestion: 2,
        enabled: true,
        maxCount: stat.count,
        difficulties: [1, 2, 3],
      }));

      setComposeConfig(config);
      return stats;
    } catch (error) {
      console.error("Failed to fetch exercise type stats:", error);
      return [];
    } finally {
      setLoadingExerciseStats(false);
    }
  };

  const { data: examData } = useQuery({
    queryKey: ["exam", examId],
    queryFn: async () => {
      const result = await getExam({
        tenant,
        fields: [
          "id",
          "title",
          "examType",
          "totalScore",
          "passingScore",
          "courseId",
        ],
        input: { id: examId! },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!examId && !!user,
  });

  const { data: examExercisesResult, isLoading: isLoadingExamExercises } =
    useQuery({
      queryKey: ["exam-exercises", examId],
      queryFn: async () => {
        const result = await getExercisesByExam({
          tenant,
          fields: [
            "id",
            "examId",
            "exerciseId",
            "points",
            "order",
            { 
              exercise: [
                "id", 
                "title", 
                "questionContent", 
                "questionType",
                "answerExplanation"
              ] 
            },
          ],
          input: { examId: examId! },
          headers: getHeaders(user),
        });

        if (result.success && result.data) {
          const exercises = Array.isArray(result.data)
            ? result.data
            : (result.data as any).results || (result.data as any).data || [];
          const sorted = exercises.sort(
            (a: any, b: any) => (a.order || 0) - (b.order || 0),
          );
          return sorted;
        }
        return [];
      },
      enabled: !!examId && !!user,
    });

  const { data: allExercisesResult, isLoading: isLoadingAllExercises } =
    useQuery({
      queryKey: [
        "exercises",
        selectedQuestionType,
        currentPage,
        searchQuery,
        (examData as any)?.data?.courseId,
      ],
      queryFn: async () => {
        const courseId = (examData as any)?.data?.courseId;

        const filter: any = {};
        if (courseId) {
          filter.courseId = { eq: courseId };
        }
        if (selectedQuestionType !== "all") {
          filter.questionType = { eq: selectedQuestionType };
        }
        if (searchQuery) {
          filter.or = [
            { title: { contains: searchQuery } },
            { questionContent: { contains: searchQuery } },
          ];
        }

        const result = await listExercises({
          tenant,
          fields: ["id", "title", "questionContent", "questionType", "answer"],
          filter: Object.keys(filter).length > 0 ? filter : undefined,
          page: { limit: itemsPerPage, offset: currentPage * itemsPerPage },
          headers: getHeaders(user),
        });

        return result;
      },
      enabled: !!user && addDialogOpen && !!(examData as any)?.data?.courseId,
    });

  const exercisesList = React.useMemo(() => {
    if (!allExercisesResult?.success) {
      return { exercises: [], total: 0, hasMore: false };
    }

    const data = allExercisesResult.data as any;
    let exercises = [];
    if (Array.isArray(data)) {
      exercises = data;
    } else if (Array.isArray(data.results)) {
      exercises = data.results;
    } else if (Array.isArray(data.data)) {
      exercises = data.data;
    }

    return {
      exercises,
      total: data.count ?? data.total ?? exercises.length,
      hasMore: data.hasMore ?? false,
    };
  }, [allExercisesResult]);

  React.useEffect(() => {
    setCurrentPage(0);
  }, [selectedQuestionType, searchQuery]);

  const addMutation = useMutation({
    mutationFn: async (
      exercisesToAdd: Array<{
        exerciseId: string;
        points: number;
        order: number;
      }>,
    ) => {
      const results = [];
      for (const { exerciseId, points, order } of exercisesToAdd) {
        const result = await addExerciseToExam({
          tenant,
          primaryKey: examId!,
          input: {
            exerciseId,
            points,
            order,
          },
          fields: ["id", "totalScore"],
          headers: getHeaders(user),
        });

        if (!result.success) {
          throw new Error(
            `添加题目 ${exerciseId} 失败: ${result.errors?.[0]?.message || "Unknown error"}`,
          );
        }

        results.push(result);
      }

      return results;
    },
    onSuccess: () => {
      message.success("添加成功");
      queryClient.invalidateQueries({ queryKey: ["exam-exercises", examId] });
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      setAddDialogOpen(false);
      setSelectedExercisesMap(new Map());
    },
    onError: (error: Error) => {
      console.error("Add exercise error:", error);
      message.error(`添加失败: ${error.message}`);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      return removeExerciseFromExam({
        tenant,
        primaryKey: examId!,
        input: {
          exerciseId,
        },
        fields: ["id"],
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("移除成功");
      queryClient.invalidateQueries({ queryKey: ["exam-exercises", examId] });
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const exercises = examExercisesResult || [];
      const results = [];
      for (const exercise of exercises) {
        const result = await removeExerciseFromExam({
          tenant,
          primaryKey: examId!,
          input: { exerciseId: exercise.exerciseId },
          fields: ["id"],
          headers: getHeaders(user),
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      message.success("清除成功");
      queryClient.invalidateQueries({ queryKey: ["exam-exercises", examId] });
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
    },
    onError: (error: Error) => {
      console.error("Clear all exercises error:", error);
      message.error(`清除失败: ${error.message}`);
    },
  });

  const handleClearAll = () => {
    const exerciseCount = examExercisesResult?.length || 0;
    if (exerciseCount === 0) {
      message.warning("当前考试没有习题，无需清除");
      return;
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      points,
      order,
      exerciseId,
    }: {
      id: string;
      points: number;
      order: number;
      exerciseId: string;
    }) => {
      const removeResult = await removeExerciseFromExam({
        tenant,
        primaryKey: examId!,
        input: { exerciseId },
        fields: ["id"],
        headers: getHeaders(user),
      });

      if (!removeResult.success) {
        throw new Error(
          removeResult.errors?.[0]?.message || "Failed to remove exercise",
        );
      }

      const addResult = await addExerciseToExam({
        tenant,
        primaryKey: examId!,
        input: { exerciseId, points, order },
        fields: ["id", "totalScore"],
        headers: getHeaders(user),
      });

      if (!addResult.success) {
        throw new Error(
          addResult.errors?.[0]?.message || "Failed to add exercise back",
        );
      }

      return addResult;
    },
    onSuccess: () => {
      message.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["exam-exercises", examId] });
      queryClient.invalidateQueries({ queryKey: ["exam", examId] });
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      console.error("Update exercise error:", error);
      message.error(`更新失败: ${error.message}`);
    },
  });

  const examExerciseIds = new Set(
    examExercisesResult?.map((ee: any) => ee.exerciseId) || [],
  );

  const availableExercises = React.useMemo(() => {
    return exercisesList.exercises.filter(
      (ex: any) => !examExerciseIds.has(ex.id),
    );
  }, [exercisesList.exercises, examExerciseIds]);

  const totalPages = Math.ceil(exercisesList.total / itemsPerPage);

  const handleComposeConfigChange = (
    index: number,
    field: string,
    value: any,
  ) => {
    const newConfig = [...composeConfig];
    newConfig[index] = { ...newConfig[index], [field]: value };
    setComposeConfig(newConfig);
  };

  const handlePreviewCompose = async () => {
    const courseId = (examData as any)?.data?.courseId;
    if (!courseId) {
      message.warning("考试未关联课程，无法使用智能组卷");
      return;
    }

    const exerciseConfig: Record<string, { count: number; points: number; difficulties: number[] }> =
      {};
    composeConfig
      .filter((c) => c.enabled && c.count > 0)
      .forEach((c) => {
        exerciseConfig[c.questionType] = {
          count: c.count,
          points: c.pointsPerQuestion,
          difficulties: c.difficulties,
        };
      });

    if (Object.keys(exerciseConfig).length === 0) {
      message.warning("请至少选择一种题型并设置数量");
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setIsPartialSuccess(false);

    try {
      const result = await previewExam(
        { orgSchema: tenant, courseId, exerciseConfig },
        getHeaders(user),
      );

      if (result.success) {
        setPreviewSections(result.sections);
        setPreviewError(null);
        setIsPartialSuccess(false);
        setAutoComposeOpen(false);
        setPreviewDialogOpen(true);
      } else {
        const hasPartialData =
          result.sections?.some((s) => s.actualCount > 0) ?? false;
        setPreviewSections(result.sections || []);
        setIsPartialSuccess(!hasPartialData);
        setPreviewError(result.message);
        setAutoComposeOpen(false);
        setPreviewDialogOpen(true);
      }
    } catch (error) {
      console.error("Preview exam error:", error);
      setPreviewError("组卷预览失败，请稍后重试");
      message.error("组卷预览失败，请稍后重试");
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAddPreviewedExercises = async () => {
    if (!examId || previewSections.length === 0) return;

    const exercisesToAdd: Array<{
      exerciseId: string;
      points: number;
      order: number;
    }> = [];
    const skippedExercises: string[] = [];
    let orderOffset = examExercisesResult?.length || 0;

    previewSections.forEach((section) => {
      section.exercises.forEach((exercise) => {
        // 跳过已移除的习题
        if (removedExerciseIds.has(exercise.id)) {
          return;
        }
        // 跳过已存在于考试中的习题
        if (examExerciseIds.has(exercise.id)) {
          skippedExercises.push(exercise.id);
          return;
        }

        const config = composeConfig.find(
          (c) => c.questionType === section.questionType,
        );
        exercisesToAdd.push({
          exerciseId: exercise.id,
          points: config?.pointsPerQuestion || 2,
          order: ++orderOffset,
        });
      });
    });

    // 如果有跳过的习题，显示提示
    if (skippedExercises.length > 0) {
      message.info(`已跳过 ${skippedExercises.length} 道重复的习题`);
    }

    if (exercisesToAdd.length === 0) {
      if (skippedExercises.length > 0) {
        message.warning("所有习题已存在于考试中，无需添加");
      } else {
        message.warning("没有可添加的习题");
      }
      return;
    }

    addMutation.mutate(exercisesToAdd, {
      onSuccess: () => {
        setPreviewDialogOpen(false);
        setPreviewSections([]);
        setPreviewError(null);
        setIsPartialSuccess(false);
        setRemovedExerciseIds(new Set());
        if (skippedExercises.length > 0) {
          message.success(`成功添加 ${exercisesToAdd.length} 道习题，跳过 ${skippedExercises.length} 道重复习题`);
        }
      },
    });
  };

  const handleRecompose = () => {
    setPreviewDialogOpen(false);
    setAutoComposeOpen(true);
  };

  const handleRemoveFromPreview = (exerciseId: string) => {
    setRemovedExerciseIds(prev => new Set(prev).add(exerciseId));
  };

  const handleResetRemovedExercises = () => {
    setRemovedExerciseIds(new Set());
  };

  const handleBatchAddExercises = () => {
    if (selectedExercisesMap.size === 0) {
      message.warning("请至少选择一道习题");
      return;
    }

    if (!examId) {
      message.error("考试ID缺失，请重新进入页面");
      return;
    }

    const exercisesToAdd = Array.from(selectedExercisesMap.entries()).map(
      ([exerciseId, pointsStr], index) => {
        const points = parseInt(pointsStr) || 10;
        return {
          exerciseId,
          points,
          order: (examExercisesResult?.length || 0) + index + 1,
        };
      },
    );

    addMutation.mutate(exercisesToAdd);
  };

  const handleToggleExercise = (exerciseId: string, points: string) => {
    const newMap = new Map(selectedExercisesMap);
    if (newMap.has(exerciseId)) {
      newMap.delete(exerciseId);
    } else {
      newMap.set(exerciseId, points);
    }
    setSelectedExercisesMap(newMap);
  };

  const handleUpdatePoints = (exerciseId: string, points: string) => {
    const newMap = new Map(selectedExercisesMap);
    if (newMap.has(exerciseId)) {
      newMap.set(exerciseId, points);
    }
    setSelectedExercisesMap(newMap);
  };

  const examExerciseColumns: ColumnsType<ExamExercise> = [
    {
      title: "顺序",
      dataIndex: "order",
      key: "order",
      width: 80,
    },
    {
      title: "习题标题",
      key: "title",
      width: 300,
      render: (_, record) => (
        <div>
          <Tooltip title={record.exercise?.title || "未知标题"} mouseEnterDelay={0.3}>
            <Text strong style={{ display: "inline-block", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>{record.exercise?.title || "未知标题"}</Text>
          </Tooltip>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {translateQuestionType(record.exercise?.questionType || "")}
          </Text>
        </div>
      ),
    },
    {
      title: "分值",
      dataIndex: "points",
      key: "points",
      width: 100,
      render: (points: number) => (
        <Text strong style={{ color: "#1890ff" }}>
          {points} 分
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_, record) => (
        <Popconfirm
          title="确定要移除这道习题吗？"
          onConfirm={() => removeMutation.mutate(record.exerciseId)}
        >
          <ReadonlyActionButton type="text" danger icon={<MinusOutlined />} size="small">
            移除
          </ReadonlyActionButton>
        </Popconfirm>
      ),
    },
  ];

  const filteredExamExercises =
    tableQuestionTypeFilter === "all"
      ? examExercisesResult || []
      : (examExercisesResult || []).filter(
          (ee: any) => ee.exercise?.questionType === tableQuestionTypeFilter,
        );

  const filterMenuItems = questionTypeOptions.map((option) => ({
    key: option.value,
    label: option.label,
    onClick: () => setSelectedQuestionType(option.value),
  }));

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: 24,
          background: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/teacher/dashboard/exam-management")} // 保持原路径
            />
            <Title level={3} style={{ margin: 0 }}>
              习题管理
            </Title>
            {(examData as any)?.data && (
              <Tag color="blue">{(examData as any).data.title}</Tag>
            )}
          </Space>
          <Space>
            <Button
              icon={<StarFilled style={{ color: "#9c27b0" }} />}
              onClick={async () => {
                const courseId = (examData as any)?.data?.courseId;
                if (!courseId) {
                  message.warning("考试未关联课程，无法使用智能组卷");
                  return;
                }
                await fetchExerciseTypeStats(courseId);
                setAutoComposeOpen(true);
              }}
              style={canEdit ? undefined : { display: "none" }}
            >
              智能组卷
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedExercisesMap(new Map());
                setSelectedQuestionType("all");
                setCurrentPage(0);
                setSearchQuery("");
                setAddDialogOpen(true);
              }}
              style={canEdit ? undefined : { display: "none" }}
            >
              添加习题
            </Button>
          </Space>
        </div>

        <Row gutter={24}>
          <Col span={8}>
            <Statistic
              title="已添加习题"
              value={examExercisesResult?.length || 0}
              valueStyle={{ color: "#1890ff" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="总分"
              value={(examData as any)?.data?.totalScore || 0}
              valueStyle={{ color: "#52c41a" }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="及格分"
              value={(examData as any)?.data?.passingScore || 0}
              valueStyle={{ color: "#faad14" }}
            />
          </Col>
        </Row>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        <Card
          style={{ height: "100%" }}
          styles={{
            body: {
              padding: 0,
              display: "flex",
              flexDirection: "column",
              height: "100%",
            },
          }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #e0e0e0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Space>
              <Text type="secondary">筛选:</Text>
              {["all", "multiple_choice", "fill_in_blank", "essay"].map(
                (type) => (
                  <Button
                    key={type}
                    size="small"
                    type={
                      tableQuestionTypeFilter === type ? "primary" : "default"
                    }
                    onClick={() => setTableQuestionTypeFilter(type)}
                  >
                    {type === "all"
                      ? "全部"
                      : type === "multiple_choice"
                        ? "选择题"
                        : type === "fill_in_blank"
                          ? "填空题"
                          : "问答题"}
                  </Button>
                ),
              )}
            </Space>
            <Popconfirm
              title={`确定要清除所有 ${examExercisesResult?.length || 0} 道习题吗？此操作不可撤销。`}
              onConfirm={() => clearAllMutation.mutate()}
            >
              <Button
                size="small"
                danger
                icon={
                  clearAllMutation.isPending ? (
                    <Spin size="small" />
                  ) : (
                    <MinusOutlined />
                  )
                }
                disabled={
                  clearAllMutation.isPending || !examExercisesResult?.length
                }
                style={canEdit ? undefined : { display: "none" }}
              >
                清除所有
              </Button>
            </Popconfirm>
          </div>

          {isLoadingExamExercises ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <Table
              columns={examExerciseColumns}
              dataSource={filteredExamExercises}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
              style={{ flex: 1 }}
            />
          )}
        </Card>
      </div>

      <Modal
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>添加习题到考试</span>
            <Text type="secondary">
              已选择 {selectedExercisesMap.size} 道习题
            </Text>
          </div>
        }
        open={addDialogOpen}
        onCancel={() => {
          setAddDialogOpen(false);
          setSelectedExercisesMap(new Map());
          setSelectedQuestionType("all");
          setCurrentPage(0);
          setSearchQuery("");
        }}
        footer={null}
        width={900}
      >
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            alignItems: "center",
          }}
        >
          <Input
            placeholder="搜索习题标题或内容..."
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <Dropdown
            menu={{
              items: filterMenuItems,
              selectedKeys: [selectedQuestionType],
            }}
          >
            <Button icon={<FilterOutlined />}>
              {questionTypeOptions.find(
                (opt) => opt.value === selectedQuestionType,
              )?.label || "全部题型"}
            </Button>
          </Dropdown>
        </div>

        {isLoadingAllExercises ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 48 }}
          >
            <Spin size="large" />
          </div>
        ) : exercisesList.exercises.length === 0 ? (
          <Empty
            description={searchQuery ? "未找到匹配的习题" : "暂无可用的习题"}
          />
        ) : (
          <div>
            <Table
              columns={[
                {
                  title: "选择",
                  key: "select",
                  width: 60,
                  render: (_, exercise: any) => {
                    const isSelected = selectedExercisesMap.has(exercise.id);
                    const isAlreadyInExam = examExerciseIds.has(exercise.id);
                    return (
                      <Checkbox
                        checked={isSelected}
                        disabled={isAlreadyInExam}
                        onChange={() => handleToggleExercise(exercise.id, "10")}
                      />
                    );
                  },
                },
                {
                  title: "习题标题",
                  key: "title",
                  render: (_, exercise: any) => {
                    const isAlreadyInExam = examExerciseIds.has(exercise.id);
                    return (
                      <div>
                        <Tooltip title={exercise.title} mouseEnterDelay={0.3}>
                          <Text
                            strong
                            style={{
                              color: isAlreadyInExam ? "#999" : "inherit",
                              display: "block",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {exercise.title}
                          </Text>
                        </Tooltip>
                        {exercise.questionContent && (
                          <div
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "#666",
                              fontSize: 12,
                            }}
                          >
                            {exercise.questionContent}
                          </div>
                        )}
                        {isAlreadyInExam && (
                          <Tag color="default" style={{ marginTop: 4 }}>
                            已添加
                          </Tag>
                        )}
                      </div>
                    );
                  },
                },
                {
                  title: "分值",
                  key: "points",
                  width: 120,
                  render: (_, exercise: any) => {
                    const isSelected = selectedExercisesMap.has(exercise.id);
                    const isAlreadyInExam = examExerciseIds.has(exercise.id);
                    const points = selectedExercisesMap.get(exercise.id) || "";
                    return (
                      <InputNumber
                        min={1}
                        placeholder="10"
                        value={points ? parseInt(points) : undefined}
                        disabled={!isSelected}
                        onChange={(value) => {
                          if (!isSelected && value && !isAlreadyInExam) {
                            handleToggleExercise(exercise.id, String(value));
                          } else if (isSelected) {
                            handleUpdatePoints(
                              exercise.id,
                              String(value || ""),
                            );
                          }
                        }}
                        style={{ width: 80 }}
                      />
                    );
                  },
                },
              ]}
              dataSource={exercisesList.exercises}
              rowKey="id"
              pagination={false}
              scroll={{ y: 400 }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 0",
                borderTop: "1px solid #e0e0e0",
              }}
            >
              <Text type="secondary">
                显示 {currentPage * itemsPerPage + 1} -{" "}
                {Math.min(
                  (currentPage + 1) * itemsPerPage,
                  exercisesList.total,
                )}{" "}
                / 共 {exercisesList.total} 条
              </Text>
              <Space>
                <Button
                  size="small"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(currentPage - 1)}
                >
                  上一页
                </Button>
                <Text type="secondary">第 {currentPage + 1} 页</Text>
                <Button
                  size="small"
                  disabled={!exercisesList.hasMore}
                  onClick={() => setCurrentPage(currentPage + 1)}
                >
                  下一页
                </Button>
              </Space>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 12,
                background: "#f5f5f5",
                borderRadius: 8,
              }}
            >
              <Text type="secondary">
                提示：勾选复选框或直接在分值框中输入数字即可选择习题并设置分值
              </Text>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 16,
              }}
            >
              <Button
                onClick={() => {
                  setAddDialogOpen(false);
                  setSelectedExercisesMap(new Map());
                  setSelectedQuestionType("all");
                  setCurrentPage(0);
                  setSearchQuery("");
                }}
                disabled={addMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="primary"
                onClick={handleBatchAddExercises}
                disabled={
                  selectedExercisesMap.size === 0 || addMutation.isPending
                }
                loading={addMutation.isPending}
              >
                {addMutation.isPending
                  ? "添加中..."
                  : `添加 ${selectedExercisesMap.size} 道习题`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="编辑习题分值和顺序"
        open={editDialogOpen}
        onCancel={() => setEditDialogOpen(false)}
        footer={null}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 16,
          }}
        >
          {selectedExercise && (
            <div
              style={{ padding: 16, background: "#f5f5f5", borderRadius: 8 }}
            >
              <Text strong>{selectedExercise.exercise?.title}</Text>
              <br />
              <Text type="secondary">
                当前分值: {selectedExercise.points} 分 | 顺序:{" "}
                {selectedExercise.order || "-"}
              </Text>
            </div>
          )}

          <div>
            <Text>分值（分数）</Text>
            <InputNumber
              min={0}
              value={editForm.points}
              onChange={(value) =>
                setEditForm({ ...editForm, points: value || 0 })
              }
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>
          <div>
            <Text>顺序（题号）</Text>
            <InputNumber
              min={1}
              value={editForm.order}
              onChange={(value) =>
                setEditForm({ ...editForm, order: value || 1 })
              }
              style={{ width: "100%", marginTop: 8 }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button
              onClick={() => setEditDialogOpen(false)}
              disabled={updateMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="primary"
              onClick={() => {
                if (selectedExercise) {
                  updateMutation.mutate({
                    id: selectedExercise.id,
                    exerciseId: selectedExercise.exerciseId,
                    points: editForm.points,
                    order: editForm.order,
                  });
                }
              }}
              loading={updateMutation.isPending}
            >
              保存更改
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <StarFilled style={{ color: "#9c27b0" }} />
            <span>智能组卷</span>
          </Space>
        }
        open={autoComposeOpen}
        onCancel={() => setAutoComposeOpen(false)}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary">
            系统将自动从课程题库中随机选择指定数量的习题组成试卷。
          </Text>
        </div>

        {loadingExerciseStats ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 48 }}
          >
            <Spin size="large" />
          </div>
        ) : composeConfig.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              background: "#e6f7ff",
              borderRadius: 8,
            }}
          >
            <Title level={5} type="secondary">
              课程暂无习题
            </Title>
            <Text type="secondary">
              该课程题库中还没有可用的习题，请先添加习题后再进行智能组卷。
            </Text>
          </div>
        ) : (
          <>
            {composeConfig.map((config, index) => (
              <div
                key={config.questionType}
                style={{
                  marginBottom: 16,
                  padding: 16,
                  background: config.enabled ? "#f8f9fa" : "#fafafa",
                  borderRadius: 8,
                  border: `1px solid ${config.enabled ? "#91d5ff" : "#e0e0e0"}`,
                  opacity: config.enabled ? 1 : 0.7,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Checkbox
                    checked={config.enabled}
                    onChange={(e) =>
                      handleComposeConfigChange(
                        index,
                        "enabled",
                        e.target.checked,
                      )
                    }
                  />
                  <Text strong style={{ flex: 1 }}>
                    {config.questionTypeName}
                    <Tag
                      color={config.maxCount > 0 ? "green" : "default"}
                      style={{ marginLeft: 8 }}
                    >
                      可用 {config.maxCount} 题
                    </Tag>
                  </Text>
                </div>

                <div style={{ display: "flex", gap: 24, paddingLeft: 32 }}>
                  <div>
                    <Text type="secondary">题目数量</Text>
                    <InputNumber
                      min={0}
                      max={config.maxCount}
                      value={config.count === 0 ? undefined : config.count}
                      disabled={!config.enabled}
                      onChange={(value) =>
                        handleComposeConfigChange(
                          index,
                          "count",
                          Math.min(config.maxCount, value || 0),
                        )
                      }
                      style={{ width: 120, marginTop: 8 }}
                    />
                  </div>
                  <div>
                    <Text type="secondary">每题分值</Text>
                    <InputNumber
                      min={1}
                      value={config.pointsPerQuestion || undefined}
                      disabled={!config.enabled}
                      onChange={(value) =>
                        handleComposeConfigChange(
                          index,
                          "pointsPerQuestion",
                          value || 1,
                        )
                      }
                      style={{ width: 120, marginTop: 8 }}
                    />
                  </div>
                  <div>
                    <Text type="secondary">难度</Text>
                    <Select
                      mode="multiple"
                      placeholder="选择难度"
                      value={config.difficulties}
                      disabled={!config.enabled}
                      onChange={(value) =>
                        handleComposeConfigChange(
                          index,
                          "difficulties",
                          value.length > 0 ? value : [1, 2, 3],
                        )
                      }
                      style={{ width: 180, marginTop: 8 }}
                      options={[
                        { value: 1, label: "简单" },
                        { value: 2, label: "中等" },
                        { value: 3, label: "困难" },
                      ]}
                    />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <Text type="secondary">
                      小计:{" "}
                      <strong>
                        {config.enabled
                          ? config.count * config.pointsPerQuestion
                          : 0}{" "}
                        分
                      </strong>
                    </Text>
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                marginTop: 24,
                padding: 16,
                background: "#e6f7ff",
                borderRadius: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text strong>预计总分</Text>
              <Title level={4} style={{ margin: 0, color: "#1890ff" }}>
                {composeConfig.reduce(
                  (sum, c) =>
                    c.enabled ? sum + c.count * c.pointsPerQuestion : sum,
                  0,
                )}{" "}
                分
              </Title>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 24,
              }}
            >
              <Button
                onClick={() => setAutoComposeOpen(false)}
                disabled={previewLoading}
              >
                取消
              </Button>
              <Button
                type="primary"
                icon={previewLoading ? <Spin size="small" /> : <StarFilled />}
                onClick={handlePreviewCompose}
                disabled={
                  previewLoading ||
                  loadingExerciseStats ||
                  composeConfig.length === 0
                }
                style={{ background: "#9c27b0" }}
              >
                {previewLoading ? "组卷中..." : "预览组卷结果"}
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <CheckCircleOutlined style={{ color: "#52c41a" }} />
            <span>组卷预览</span>
            <Tag color="blue">
              共{" "}
              {previewSections.reduce((sum, s) => sum + s.exercises.length, 0)}{" "}
              题
            </Tag>
          </Space>
        }
        open={previewDialogOpen}
        onCancel={() => setPreviewDialogOpen(false)}
        footer={null}
        width={900}
      >
        {isPartialSuccess && (
          <div
            style={{
              padding: 16,
              background: "#fffbe6",
              borderBottom: "1px solid #faad14",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <WarningOutlined style={{ color: "#faad14" }} />
            <Text type="warning">{previewError}</Text>
          </div>
        )}

        <div className="exam-exercises-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.exam-exercises-wrap{padding:12px!important}.exam-exercises-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
          {previewSections.length === 0 ? (
            <div style={{ textAlign: "center", padding: 32 }}>
              <CloseCircleOutlined
                style={{ fontSize: 48, color: "#ff4d4f", marginBottom: 16 }}
              />
              <Text type="secondary">暂无可预览的习题</Text>
              {previewError && (
                <div>
                  <Text type="danger">{previewError}</Text>
                </div>
              )}
            </div>
          ) : (
            previewSections.map((section) => (
              <div key={section.questionType} style={{ marginBottom: 24 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                    paddingBottom: 8,
                    borderBottom: "2px solid #1890ff",
                  }}
                >
                  <Text strong style={{ color: "#1890ff", fontSize: 16 }}>
                    {section.questionTypeName}
                  </Text>
                  <Space>
                    {section.actualCount < section.requestedCount && (
                      <Tag color="warning">
                        数量不足: {section.actualCount}/{section.requestedCount}
                      </Tag>
                    )}
                    <Text type="secondary">
                      {section.actualCount} 题 ×{" "}
                      {composeConfig.find(
                        (c) => c.questionType === section.questionType,
                      )?.pointsPerQuestion || 2}{" "}
                      分 ={" "}
                      {section.actualCount *
                        (composeConfig.find(
                          (c) => c.questionType === section.questionType,
                        )?.pointsPerQuestion || 2)}{" "}
                      分
                    </Text>
                  </Space>
                </div>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  {section.exercises
                    .filter(exercise => !removedExerciseIds.has(exercise.id))
                    .map((exercise, exerciseIndex) => (
                    <div
                      key={exercise.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "10px 16px",
                        background: "#fff",
                        borderRadius: 6,
                        border: "1px solid #e0e0e0",
                        gap: 8,
                      }}
                    >
                      <Text strong style={{ color: "#1890ff", minWidth: 30 }}>
                        {exerciseIndex + 1}.
                      </Text>
                      <Text style={{ flex: 1 }}>{exercise.title}</Text>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveFromPreview(exercise.id)}
                        title="移除此习题"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "16px 0",
          }}
        >
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleRecompose}
              disabled={addMutation.isPending}
            >
              重新选择
            </Button>
            {removedExerciseIds.size > 0 && (
              <Button
                type="link"
                onClick={handleResetRemovedExercises}
                disabled={addMutation.isPending}
              >
                恢复已移除 ({removedExerciseIds.size})
              </Button>
            )}
          </Space>
          <Space>
            <Button
              onClick={() => setPreviewDialogOpen(false)}
              disabled={addMutation.isPending}
            >
              取消
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddPreviewedExercises}
              disabled={
                addMutation.isPending ||
                previewSections.reduce(
                  (sum, s) => sum + s.exercises.filter(e => !removedExerciseIds.has(e.id)).length,
                  0,
                ) === 0
              }
              loading={addMutation.isPending}
              style={{ background: "#9c27b0" }}
            >
              {addMutation.isPending
                ? "添加中..."
                : `确认添加 ${previewSections.reduce((sum, s) => sum + s.exercises.length, 0)} 道习题`}
            </Button>
          </Space>
        </div>
      </Modal>
    </div>
  );
}
