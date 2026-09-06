import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Typography,
  Card,
  Tag,
  Spin,
  Modal,
  Steps,
  Progress,
  Alert,
  Space,
  Statistic,
  Row,
  Col,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  StarOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  getStudentExamsByExam,
  gradeExam,
  gradeAnswer,
  getAnswersByStudentExam,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useAuth } from "@/auth/auth-context";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface StudentExam {
  id: string;
  examId: string;
  studentId: string;
  studentName?: string;
  status: "in_progress" | "submitted" | "graded";
  score: number;
  passed: boolean;
  startedAt?: string;
  submittedAt?: string;
  maxScore?: number;
  autoGraded?: boolean;
  answerCount?: number;
  gradedCount?: number;
}

interface AIGradingResponse {
  analysis: string;
  reasoning: string;
  suggestedScore: number;
}

interface ExamAnswer {
  id: string;
  answer: string;
  pointsEarned: number;
  graded: boolean;
  exerciseId: string;
  examExerciseId: string;
  title: string;
  questionContent: string;
  questionType: string;
  correctAnswer?: string;
  maxPoints: number;
  order: number;
  options?: any;
}

type GradingStep =
  | "fetching"
  | "multiple_choice"
  | "ai_grading"
  | "submitting"
  | "complete";

interface GradingProgress {
  currentStep: GradingStep;
  totalAnswers: number;
  multipleChoiceCount: number;
  essayCount: number;
  currentEssayIndex: number;
  error?: string;
}

const extractArrayData = (result: any): any[] => {
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data) return result.data.results || [];
    if ("data" in result.data) return result.data.data || [];
  }
  return [];
};

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const statusMap: Record<string, { label: string; color: string }> = {
  graded: { label: "已批改", color: "success" },
  submitted: { label: "待批改", color: "warning" },
  in_progress: { label: "进行中", color: "default" },
};

function getStepIndex(step: GradingStep): number {
  const stepOrder: GradingStep[] = [
    "fetching",
    "multiple_choice",
    "ai_grading",
    "submitting",
    "complete",
  ];
  const index = stepOrder.indexOf(step);
  return step === "complete" ? stepOrder.length - 1 : Math.max(0, index);
}

export default function ExamGrading() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { examId } = useParams();
  const navigate = useNavigate();
  const currentTenant = getCurrentTenant();
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [autoGrading, setAutoGrading] = useState(false);

  const [aiGradingOpen, setAiGradingOpen] = useState(false);
  const [aiGradingStudentExam, setAiGradingStudentExam] =
    useState<StudentExam | null>(null);
  const [gradingProgress, setGradingProgress] = useState<GradingProgress>({
    currentStep: "fetching",
    totalAnswers: 0,
    multipleChoiceCount: 0,
    essayCount: 0,
    currentEssayIndex: 0,
  });

  const tenant = currentTenant?.schemaName || "";

  const { data: studentExamsResult, isLoading } = useQuery({
    queryKey: ["student-exams", examId],
    queryFn: async () => {
      const result = await getStudentExamsByExam({
        tenant,
        fields: [
          "id",
          "status",
          "score",
          "passed",
          "startedAt",
          "submittedAt",
          { student: ["id", "name"] },
        ],
        input: { examId: examId! },
        headers: getHeaders(user),
      });

      const studentExams = extractArrayData(result).map((se: any) => ({
        ...se,
        studentName: se.student?.name || se.student?.id || "Unknown",
        studentId: se.student?.id || "Unknown",
      }));
      return studentExams;
    },
    enabled: !!examId && !!user,
  });

  const gradeAnswerMutation = useMutation({
    mutationFn: async ({
      answerId,
      points,
    }: {
      answerId: string;
      points: number;
    }) => {
      return gradeAnswer({
        tenant,
        input: { studentExamAnswerId: answerId, awardedPoints: points },
        headers: getHeaders(user),
      });
    },
  });

  const gradeExamMutation = useMutation({
    mutationFn: async (studentExamId: string) => {
      return gradeExam({
        tenant,
        input: { studentExamId },
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-exams", examId] });
    },
  });

  const autoGradeMutation = useMutation({
    mutationFn: async (studentExamIds: string[]) => {
      const promises = studentExamIds.map((id) =>
        gradeExam({
          tenant,
          input: { studentExamId: id },
          headers: getHeaders(user),
        }),
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-exams", examId] });
      setAutoGrading(false);
      Modal.success({ title: "批改完成", content: "已成功批改所有选中的答卷" });
    },
    onError: (error: Error) => {
      setAutoGrading(false);
      Modal.error({ title: "批改失败", content: error.message });
    },
  });

  const handleAutoGrade = () => {
    if (selectedRowKeys.length === 0) {
      Modal.warning({ title: "请先选择要批改的学生答卷" });
      return;
    }
    setAutoGrading(true);
    autoGradeMutation.mutate(selectedRowKeys);
  };

  const handleAIAutoGrade = async (studentExam: StudentExam) => {
    setAiGradingStudentExam(studentExam);
    setAiGradingOpen(true);
    setGradingProgress({
      currentStep: "fetching",
      totalAnswers: 0,
      multipleChoiceCount: 0,
      essayCount: 0,
      currentEssayIndex: 0,
    });

    try {
      const answersResult = await getAnswersByStudentExam({
        tenant,
        fields: [
          "id",
          "answer",
          "pointsEarned",
          "graded",
          "examExerciseId",
          "exerciseId",
          { examExercise: ["points", "order"] },
          {
            exercise: [
              "id",
              "title",
              "questionContent",
              "questionType",
              "answer",
              "options",
            ],
          },
        ],
        input: { studentExamId: studentExam.id },
        headers: getHeaders(user),
      });

      if (!answersResult.success || !answersResult.data) {
        throw new Error("获取答案失败");
      }

      const answers: ExamAnswer[] = extractArrayData(answersResult).map(
        (a: any) => {
          const opts = a.exercise?.options;
          const parsedOpts = opts ? (typeof opts === "string" ? JSON.parse(opts) : opts) : null;
          let correctAnswer: string | undefined;
          if (parsedOpts?.correctAnswer !== undefined && parsedOpts?.correctAnswer !== null) {
            correctAnswer = String(parsedOpts.correctAnswer);
          } else if (a.exercise?.answer !== undefined && a.exercise?.answer !== null) {
            correctAnswer = a.exercise.answer;
          }
          
          let processedOptions = null;
          if (opts) {
            try {
              const parsed = typeof opts === "string" ? JSON.parse(opts) : opts;
              if (parsed?.choices && Array.isArray(parsed.choices)) {
                processedOptions = parsed.choices.map((choice: string, index: number) => {
                  const cleanedChoice = choice.replace(/^[A-Z][).、]\s*/, "");
                  return {
                    id: String.fromCharCode(65 + index),
                    label: cleanedChoice,
                    value: String(index),
                    originalText: choice,
                  };
                });
              }
            } catch (e) {
              console.error("Failed to parse options:", e);
            }
          }
          
          return {
            id: a.id,
            answer: a.answer || "",
            pointsEarned: a.pointsEarned ?? 0,
            graded: a.graded ?? false,
            examExerciseId: a.examExerciseId,
            exerciseId: a.exercise?.id || "",
            title: a.exercise?.title || "",
            questionContent: a.exercise?.questionContent || "",
            questionType: a.exercise?.questionType || "",
            correctAnswer,
            maxPoints: a.examExercise?.points ?? 0,
            order: a.examExercise?.order ?? 0,
            options: processedOptions,
          };
        }
      );

      const autoGradeAnswers = answers.filter(
        (a) => ["multiple_choice", "true_false", "multiple_response"].includes(a.questionType),
      );
      const essayAnswers = answers.filter(
        (a) =>
          !["multiple_choice", "true_false", "multiple_response"].includes(a.questionType) &&
          !a.graded &&
          a.answer &&
          a.answer.trim(),
      );

      setGradingProgress({
        currentStep: "multiple_choice",
        totalAnswers: answers.length,
        multipleChoiceCount: autoGradeAnswers.length,
        essayCount: essayAnswers.length,
        currentEssayIndex: 0,
      });

      const normalizeAnswer = (ans: string | undefined | null, options?: any[]): string | null => {
        if (ans === undefined || ans === null) return null;
        const trimmed = String(ans).trim();
        if (!trimmed) return null;
        
        if (/^[A-Da-d]$/.test(trimmed)) {
          return trimmed.toUpperCase();
        }
        
        if (/^[0-3]$/.test(trimmed)) {
          return String.fromCharCode(65 + parseInt(trimmed));
        }
        
        if (options && options.length > 0) {
          const lowerTrimmed = trimmed.toLowerCase();
          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (
              opt.id?.toLowerCase() === lowerTrimmed ||
              opt.value?.toLowerCase() === lowerTrimmed ||
              opt.label?.toLowerCase() === lowerTrimmed ||
              opt.originalText?.toLowerCase() === lowerTrimmed
            ) {
              return String.fromCharCode(65 + i);
            }
          }
        }
        
        return trimmed.toUpperCase();
      };

      const normalizeCorrectAnswer = (correctAns: string | undefined | null, options?: any[]): string | null => {
        if (correctAns === undefined || correctAns === null) return null;
        const trimmed = String(correctAns).trim();
        if (!trimmed) return null;
        
        if (/^[A-Da-d]$/.test(trimmed)) {
          return trimmed.toUpperCase();
        }
        
        if (/^[0-3]$/.test(trimmed)) {
          return String.fromCharCode(65 + parseInt(trimmed));
        }
        
        if (options && options.length > 0) {
          const lowerTrimmed = trimmed.toLowerCase();
          for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (
              opt.id?.toLowerCase() === lowerTrimmed ||
              opt.value?.toLowerCase() === lowerTrimmed ||
              opt.label?.toLowerCase() === lowerTrimmed ||
              opt.originalText?.toLowerCase() === lowerTrimmed
            ) {
              return String.fromCharCode(65 + i);
            }
          }
        }
        
        return trimmed.toUpperCase();
      };

      for (const answer of autoGradeAnswers) {
        const answerOptions = answer.options;
        let isCorrect: boolean;

        if (answer.questionType === "multiple_response") {
          const studentSet = new Set(
            (answer.answer || "")
              .split(/[,，\s]+/)
              .map(s => s.trim().toUpperCase())
              .filter(s => /^[A-D]$/.test(s))
              .sort()
          );
          const correctSet = new Set(
            (answer.correctAnswer || "")
              .split(/[,，\s]+/)
              .map(s => s.trim().toUpperCase())
              .filter(s => /^[A-D]$/.test(s))
              .sort()
          );
          isCorrect = studentSet.size === correctSet.size && 
                      [...studentSet].every(s => correctSet.has(s));
        } else {
          const studentAnswer = normalizeAnswer(answer.answer, answerOptions || undefined);
          const correctAnswer = normalizeCorrectAnswer(answer.correctAnswer, answerOptions || undefined);
          isCorrect = studentAnswer !== null && correctAnswer !== null && studentAnswer === correctAnswer;
        }

        console.log(`Question ${answer.order}: type=${answer.questionType}, studentAnswer=${answer.answer}, correctAnswer=${answer.correctAnswer}, isCorrect=${isCorrect}`);

        const points = isCorrect ? answer.maxPoints : 0;

        await gradeAnswerMutation.mutateAsync({ answerId: answer.id, points });
      }

      if (essayAnswers.length > 0) {
        setGradingProgress((prev) => ({ ...prev, currentStep: "ai_grading" }));

        for (let i = 0; i < essayAnswers.length; i++) {
          const answer = essayAnswers[i];
          setGradingProgress((prev) => ({ ...prev, currentEssayIndex: i + 1 }));

          if (!answer.correctAnswer) {
            continue;
          }

          try {
            const response = await fetch("/agent/grade", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getHeaders(user),
              },
              body: JSON.stringify({
                question: answer.questionContent || answer.title,
                studentAnswer: answer.answer,
                correctAnswer: answer.correctAnswer,
                maxScore: answer.maxPoints,
              }),
            });

            if (!response.ok)
              throw new Error(`HTTP error! status: ${response.status}`);

            const data: AIGradingResponse = await response.json();
            await gradeAnswerMutation.mutateAsync({
              answerId: answer.id,
              points: data.suggestedScore,
            });
          } catch (error) {
            console.error("AI grading failed for answer:", answer.id, error);
          }
        }
      }

      setGradingProgress((prev) => ({ ...prev, currentStep: "submitting" }));
      await gradeExamMutation.mutateAsync(studentExam.id);

      setGradingProgress({
        currentStep: "complete",
        totalAnswers: answers.length,
        multipleChoiceCount: autoGradeAnswers.length,
        essayCount: essayAnswers.length,
        currentEssayIndex: essayAnswers.length,
      });

      queryClient.invalidateQueries({ queryKey: ["student-exams", examId] });
    } catch (error) {
      console.error("AI auto-grading failed:", error);
      setGradingProgress((prev) => ({
        ...prev,
        currentStep: "complete",
        error: error instanceof Error ? error.message : "未知错误",
      }));
    }
  };

  const handleCloseAIGradingDialog = () => {
    setAiGradingOpen(false);
    setAiGradingStudentExam(null);
  };

  const columns: ColumnsType<StudentExam> = [
    {
      title: "学生姓名",
      dataIndex: "studentName",
      key: "studentName",
      width: 150,
      align: "center",
    },
    {
      title: "学生ID",
      dataIndex: "studentId",
      key: "studentId",
      width: 200,
      align: "center",
    },
    {
      title: "提交时间",
      dataIndex: "submittedAt",
      key: "submittedAt",
      width: 180,
      align: "center",
      render: (v) => (v ? new Date(v).toLocaleString("zh-CN") : "未提交"),
    },
    {
      title: "得分",
      dataIndex: "score",
      key: "score",
      width: 100,
      align: "center",
      render: (v) => (
        <Text strong style={{ color: v >= 60 ? "#52c41a" : "#ff4d4f" }}>
          {v}
        </Text>
      ),
    },
    {
      title: "批改状态",
      dataIndex: "status",
      key: "status",
      width: 120,
      align: "center",
      render: (status: StudentExam["status"]) => {
        const config = statusMap[status] || { label: status, color: "default" };
        return (
          <Tag
            color={config.color}
            icon={status === "graded" ? <CheckCircleOutlined /> : undefined}
          >
            {config.label}
          </Tag>
        );
      },
    },
    {
      title: "是否及格",
      dataIndex: "passed",
      key: "passed",
      width: 100,
      align: "center",
      render: (passed: boolean, record) => {
        if (record.status !== "graded") return <Text type="secondary">-</Text>;
        return (
          <Tag color={passed ? "success" : "error"}>
            {passed ? "及格" : "不及格"}
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "actions",
      width: 280,
      align: "center",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            onClick={() => navigate(`/teacher/dashboard/exam-grade-detail/${record.id}`)}
          >
            {record.status === "graded" ? "查看" : "批改"}
          </Button>
          {record.status === "submitted" && (
            <ReadonlyActionButton
              type="primary"
              size="small"
              icon={<StarOutlined />}
              style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
              onClick={() => handleAIAutoGrade(record)}
            >
              AI自动批改
            </ReadonlyActionButton>
          )}
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys as string[]);
    },
  };

  const gradedCount =
    studentExamsResult?.filter((se: StudentExam) => se.status === "graded")
      .length || 0;
  const submittedCount =
    studentExamsResult?.filter((se: StudentExam) => se.status === "submitted")
      .length || 0;
  const avgScore =
    (studentExamsResult?.length ?? 0) > 0
      ? Math.round(
          (studentExamsResult!.reduce(
            (sum: number, se: StudentExam) => sum + se.score,
            0,
          ) /
            studentExamsResult!.length) *
            10,
        ) / 10
      : 0;

  const stepItems = [
    {
      title: "获取题目列表",
      description:
        gradingProgress.currentStep === "fetching"
          ? "正在获取题目..."
          : undefined,
    },
    {
      title: "批改选择题",
      description:
        gradingProgress.multipleChoiceCount > 0
          ? `共 ${gradingProgress.multipleChoiceCount} 道题`
          : undefined,
    },
    {
      title: "AI 批改问答题",
      description:
        gradingProgress.essayCount > 0
          ? `共 ${gradingProgress.essayCount} 道题`
          : undefined,
    },
    {
      title: "提交批改结果",
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              className="teacher-page-back-btn"
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/teacher/dashboard")}
              style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
            />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                智能批改
              </Title>
              <Text type="secondary">考试ID: {examId}</Text>
            </div>
          </div>
          <Space>
            <ReadonlyActionButton
              type="primary"
              icon={<RobotOutlined />}
              onClick={handleAutoGrade}
              loading={autoGrading}
              style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
            >
              {autoGrading ? "AI批改中..." : "AI自动批改"}
            </ReadonlyActionButton>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/teacher/dashboard/exam-management")}
            >
              返回列表
            </Button>
          </Space>
        </div>

        <Row gutter={24}>
          <Col>
            <Statistic
              title="总答卷数"
              value={studentExamsResult?.length || 0}
              valueStyle={{ color: "#1890ff" }}
            />
          </Col>
          <Col>
            <Statistic
              title="已批改"
              value={gradedCount}
              valueStyle={{ color: "#52c41a" }}
            />
          </Col>
          <Col>
            <Statistic
              title="待批改"
              value={submittedCount}
              valueStyle={{ color: "#faad14" }}
            />
          </Col>
          <Col>
            <Statistic
              title="平均分"
              value={avgScore}
              valueStyle={{ color: "#722ed1" }}
            />
          </Col>
        </Row>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        <Card style={{ height: "100%" }}>
          {isLoading ? (
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
              columns={columns}
              dataSource={studentExamsResult || []}
              rowKey="id"
              rowSelection={rowSelection}
              pagination={{ pageSize: 10 }}
            />
          )}
        </Card>
      </div>

      <Modal
        open={aiGradingOpen}
        onCancel={handleCloseAIGradingDialog}
        title={
          <Space>
            <StarOutlined style={{ color: "#722ed1" }} />
            <span>AI 自动批改</span>
          </Space>
        }
        footer={
          <Button
            type="primary"
            onClick={handleCloseAIGradingDialog}
            disabled={gradingProgress.currentStep !== "complete"}
          >
            {gradingProgress.error ? "关闭" : "完成"}
          </Button>
        }
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            学生: {aiGradingStudentExam?.studentName}
          </Text>
        </div>

        {gradingProgress.error ? (
          <Alert
            type="error"
            message={`批改失败: ${gradingProgress.error}`}
            style={{ marginBottom: 16 }}
          />
        ) : gradingProgress.currentStep === "complete" ? (
          <Alert
            type="success"
            message="批改完成！"
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Card size="small" style={{ marginBottom: 16 }}>
          <Steps
            current={getStepIndex(gradingProgress.currentStep)}
            direction="vertical"
            items={stepItems}
          />
        </Card>

        {gradingProgress.currentStep === "ai_grading" &&
          gradingProgress.currentEssayIndex > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Progress
                percent={Math.round(
                  (gradingProgress.currentEssayIndex /
                    gradingProgress.essayCount) *
                    100,
                )}
                style={{ flex: 1 }}
              />
              <Text type="secondary">
                {gradingProgress.currentEssayIndex} /{" "}
                {gradingProgress.essayCount}
              </Text>
            </div>
          )}

        {gradingProgress.currentStep === "complete" &&
          !gradingProgress.error && (
            <Card size="small" style={{ background: "#f6ffed", marginTop: 16 }}>
              <Text strong>批改摘要</Text>
              <br />
              <Text type="secondary">
                总题数: {gradingProgress.totalAnswers} | 选择题:{" "}
                {gradingProgress.multipleChoiceCount} 道 | 问答题:{" "}
                {gradingProgress.essayCount} 道
              </Text>
            </Card>
          )}
      </Modal>
    </div>
  );
}
