import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  InputNumber,
  Tag,
  Alert,
  Divider,
  Spin,
  Space,
  Collapse,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  StarOutlined,
  DownOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useNavigate, useParams } from "react-router-dom";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import {
  getStudentExam,
  getAnswersByStudentExam,
  gradeExam,
  gradeAnswer,
} from "@/lib/ash_rpc";

const { Title, Text } = Typography;

interface AIGradingResponse {
  analysis: string;
  reasoning: string;
  suggestedScore: number;
}

interface ExerciseAnswer {
  id: string;
  answer: string;
  pointsEarned: number;
  graded: boolean;
  exerciseId: string;
  title: string;
  questionContent: string;
  questionType: string;
  correctAnswer?: string;
  maxPoints: number;
  order: number;
  options?: any;
}

export default function ExamGradeDetail() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { studentExamId } = useParams();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();

  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [aiGradingResults, setAiGradingResults] = useState<
    Record<string, AIGradingResponse>
  >({});
  const [aiGradingLoading, setAiGradingLoading] = useState<
    Record<string, boolean>
  >({});
  const [expandedAIResults, setExpandedAIResults] = useState<
    Record<string, boolean>
  >({});

  const { data: studentExamData, isLoading: isLoadingExam } = useQuery({
    queryKey: ["student-exam", studentExamId],
    queryFn: async () => {
      if (!studentExamId) return null;

      const result = await getStudentExam({
        tenant: currentTenant?.schemaName || "",
        fields: [
          "id",
          "status",
          "score",
          "passed",
          "startedAt",
          "submittedAt",
          { exam: ["id", "title"] },
          { student: ["id", "name"] },
        ],
        input: { id: studentExamId },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      return result;
    },
    enabled: !!studentExamId && !!user,
  });

  const { data: answersResult, isLoading: isLoadingAnswers } = useQuery({
    queryKey: ["student-exam-answers", studentExamId],
    queryFn: async () => {
      if (!studentExamId) return { success: true, data: [] };

      const result = await getAnswersByStudentExam({
        tenant: currentTenant?.schemaName || "",
        fields: [
          "id",
          "answer",
          "pointsEarned",
          "graded",
          { examExercise: ["points", "order"] },
          {
            exercise: [
              "id",
              "title",
              "questionContent",
              "questionType",
              "options",
              "answer",
            ],
          },
        ],
        input: { studentExamId },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      return result;
    },
    enabled: !!studentExamId && !!user,
  });

  const gradeAnswerMutation = useMutation({
    mutationFn: async ({
      answerId,
      points,
    }: {
      answerId: string;
      points: number;
    }) => {
      const result = await gradeAnswer({
        tenant: currentTenant?.schemaName || "",
        input: { studentExamAnswerId: answerId, awardedPoints: points },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return result;
    },
    onSuccess: () => {
      // Don't invalidate here to avoid infinite loop
      // The UI will be updated through local state
    },
    onError: (error) => {
      console.error("gradeAnswer mutation error:", error);
    },
  });

  React.useEffect(() => {
    if (
      answersResult?.success &&
      "data" in answersResult &&
      answersResult.data
    ) {
      const initialScores: Record<string, string> = {};
      const initialFeedbacks: Record<string, string> = {};

      const answersList = Array.isArray(answersResult.data)
        ? answersResult.data
        : [];

      answersList.forEach((answer: any) => {
        if (
          answer.graded &&
          answer.pointsEarned !== undefined &&
          answer.pointsEarned !== null
        ) {
          initialScores[answer.id] = answer.pointsEarned.toString();
        } else {
          initialScores[answer.id] = "";
        }
        initialFeedbacks[answer.id] = "";
      });

      setScores(initialScores);
      setFeedbacks(initialFeedbacks);
    }
     
  }, [answersResult]);

  const handleScoreChange = (answerId: string, value: string) => {
    setScores((prev) => ({ ...prev, [answerId]: value }));
  };

  const handleGradeAnswer = (
    answerId: string,
    points: number,
    maxPoints: number,
  ) => {
    if (isNaN(points) || points < 0 || points > maxPoints) {
      alert(`请输入0-${maxPoints}之间的有效分数`);
      return;
    }
    setScores((prev) => ({ ...prev, [answerId]: points.toString() }));
    gradeAnswerMutation.mutate({ answerId, points });
  };

  const handleAIGrading = async (answer: ExerciseAnswer) => {
    if (answer.questionType === "multiple_choice") {
      alert("选择题可以自动判分，无需使用AI功能");
      return;
    }

    if (!answer.answer || answer.answer.trim() === "") {
      alert("学生未作答，无法使用AI评分");
      return;
    }

    if (!answer.correctAnswer) {
      alert("该题目没有设置参考答案，无法使用AI评分");
      return;
    }

    setAiGradingLoading((prev) => ({ ...prev, [answer.id]: true }));

    try {
      const response = await fetch("/agent/grade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(user),
        },
        body: JSON.stringify({
          question: answer.questionContent || answer.title,
          studentAnswer:
            answer.questionType === "multiple_choice"
              ? ["A", "B", "C", "D"][parseInt(answer.answer)] +
                ` (${answer.answer})`
              : answer.answer,
          correctAnswer: answer.correctAnswer,
          maxScore: answer.maxPoints,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AIGradingResponse = await response.json();
      setAiGradingResults((prev) => ({ ...prev, [answer.id]: data }));
      setExpandedAIResults((prev) => ({ ...prev, [answer.id]: true }));
    } catch (error) {
      console.error("AI grading failed:", error);
      alert(
        "AI评分失败：" + (error instanceof Error ? error.message : "未知错误"),
      );
    } finally {
      setAiGradingLoading((prev) => ({ ...prev, [answer.id]: false }));
    }
  };

  const handleApplyAIScore = (
    answerId: string,
    suggestedScore: number,
    maxPoints: number,
  ) => {
    setScores((prev) => ({ ...prev, [answerId]: suggestedScore.toString() }));
    handleGradeAnswer(answerId, suggestedScore, maxPoints);
  };

  const toggleAIResult = (answerId: string) => {
    setExpandedAIResults((prev) => ({ ...prev, [answerId]: !prev[answerId] }));
  };

  const handleAutoGradeMultipleChoice = async () => {
    const multipleChoiceAnswers = answers.filter(
      (a) => a.questionType === "multiple_choice"
    );

    if (multipleChoiceAnswers.length === 0) {
      alert("没有选择题需要批改");
      return;
    }

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

    let gradedCount = 0;

    for (const answer of multipleChoiceAnswers) {
      const answerOptions = answer.options || [];
      
      const studentAnswer = normalizeAnswer(answer.answer, answerOptions);
      const correctAnswer = normalizeCorrectAnswer(answer.correctAnswer, answerOptions);

      console.log(`Question ${answer.order}: studentAnswer=${studentAnswer}, correctAnswer=${correctAnswer}, isCorrect=${studentAnswer === correctAnswer}`);

      const isCorrect =
        studentAnswer !== null &&
        correctAnswer !== null &&
        studentAnswer === correctAnswer;

      const points = isCorrect ? answer.maxPoints : 0;

      setScores((prev) => ({ ...prev, [answer.id]: points.toString() }));

      await gradeAnswerMutation.mutateAsync({ answerId: answer.id, points });

      gradedCount++;
    }

    alert(`选择题自动批改完成！共批改 ${gradedCount} 道题`);
  };

  const handleGradeAll = async () => {
    if (!studentExamId) {
      alert("学生考试ID缺失，无法提交批改");
      return;
    }

    const answers =
      answersResult?.success &&
      "data" in answersResult &&
      Array.isArray(answersResult.data)
        ? answersResult.data
        : [];
    const ungradedAnswers: Array<{ id: string; title: string; order: number }> =
      [];

    answers.forEach((answer: any) => {
      const scoreValue = scores[answer.id];
      const maxPoints = answer.examExercise?.points ?? 0;

      if (
        answer.graded &&
        answer.pointsEarned !== undefined &&
        answer.pointsEarned !== null
      ) {
        return;
      }

      if (!scoreValue || scoreValue.trim() === "") {
        ungradedAnswers.push({
          id: answer.id,
          title:
            answer.exercise?.title ||
            `第 ${answer.examExercise?.order ?? "?"} 题`,
          order: answer.examExercise?.order ?? 0,
        });
        return;
      }

      const points = parseFloat(scoreValue);
      if (isNaN(points) || points < 0 || points > maxPoints) {
        ungradedAnswers.push({
          id: answer.id,
          title:
            answer.exercise?.title ||
            `第 ${answer.examExercise?.order ?? "?"} 题`,
          order: answer.examExercise?.order ?? 0,
        });
      }
    });

    if (ungradedAnswers.length > 0) {
      const sortedAnswers = ungradedAnswers.sort((a, b) => a.order - b.order);
      const answerList = sortedAnswers.map((a) => a.title).join("、");
      alert(`以下题目尚未批改或分数无效，请完成后再提交：\n\n${answerList}`);
      return;
    }

    if (!window.confirm("确定要提交所有批改结果吗？")) {
      return;
    }

    setIsGrading(true);
    console.log("Starting grade process for studentExamId:", studentExamId);

    const gradingPromises: Promise<void>[] = [];

    answers.forEach((answer: any) => {
      const scoreValue = scores[answer.id];
      const maxPoints = answer.examExercise?.points ?? 0;

      if (
        answer.graded &&
        answer.pointsEarned !== undefined &&
        answer.pointsEarned !== null
      ) {
        console.log(
          `Answer ${answer.id} already graded with score ${answer.pointsEarned}, skipping`,
        );
        return;
      }

      if (!scoreValue || scoreValue.trim() === "") {
        return;
      }

      const points = parseFloat(scoreValue);

      if (isNaN(points) || points < 0 || points > maxPoints) {
        return;
      }

      console.log(`Grading answer ${answer.id} with score ${points}`);

      const promise = new Promise<void>((resolve, reject) => {
        gradeAnswerMutation.mutate(
          { answerId: answer.id, points },
          {
            onSuccess: () => {
              console.log(`Successfully graded answer ${answer.id}`);
              resolve();
            },
            onError: (error) => {
              console.error(`Failed to grade answer ${answer.id}:`, error);
              reject(error);
            },
          },
        );
      });

      gradingPromises.push(promise);
    });

    try {
      if (gradingPromises.length > 0) {
        await Promise.all(gradingPromises);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const gradeResult = await gradeExam({
        tenant: currentTenant?.schemaName || "",
        input: { studentExamId: studentExamId! },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (gradeResult.success) {
        setIsGrading(false);
        queryClient.invalidateQueries({ queryKey: ["student-exams"] });
        queryClient.invalidateQueries({
          queryKey: ["student-exam", studentExamId],
        });
        alert("批改提交成功！");
        navigate("/teacher/dashboard/exam-management");
      } else {
        const errors = "errors" in gradeResult ? gradeResult.errors : [];
        throw new Error(errors?.map((e) => e.message).join(", ") || "未知错误");
      }
    } catch (error) {
      console.error("Grade exam error:", error);
      setIsGrading(false);
      alert(
        "批改提交失败：" +
          (error instanceof Error ? error.message : "未知错误"),
      );
    }
  };

  if (!studentExamId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="学生考试ID缺失" />
      </div>
    );
  }

  if (isLoadingExam || isLoadingAnswers) {
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

  if (!studentExamData?.success || !studentExamData.data) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="加载学生考试失败" />
      </div>
    );
  }

  const studentExam = studentExamData.data;
  const answers: ExerciseAnswer[] =
    answersResult?.success &&
    answersResult?.data &&
    Array.isArray(answersResult.data)
      ? answersResult.data.map((answer: any) => {
          let options;
          if (answer.exercise?.options) {
            try {
              const optionsData =
                typeof answer.exercise.options === "string"
                  ? JSON.parse(answer.exercise.options)
                  : answer.exercise.options;

              if (optionsData?.choices && Array.isArray(optionsData.choices)) {
                options = optionsData.choices.map(
                  (choice: string, index: number) => {
                    const cleanedChoice = choice.replace(/^[A-Z][).、]\s*/, "");
                    return {
                      id: String.fromCharCode(65 + index),
                      label: cleanedChoice,
                      value: String(index),
                      originalText: choice,
                    };
                  },
                );
              }
            } catch (e) {
              console.error("Failed to parse options:", e);
            }
          }

          // 获取正确答案 - 优先使用 options.correctAnswer（索引）
          let correctAnswer: string | undefined;
          const optionsData = answer.exercise?.options
            ? (typeof answer.exercise.options === "string"
                ? JSON.parse(answer.exercise.options)
                : answer.exercise.options)
            : null;
          
          if (optionsData?.correctAnswer !== undefined && optionsData?.correctAnswer !== null) {
            correctAnswer = String(optionsData.correctAnswer);
          } else if (answer.exercise?.answer !== undefined && answer.exercise?.answer !== null) {
            correctAnswer = answer.exercise.answer;
          }

          if (optionsData?.choices && Array.isArray(optionsData.choices)) {
            options = optionsData.choices.map(
              (choice: string, index: number) => {
                const cleanedChoice = choice.replace(/^[A-Z][).、]\s*/, "");
                return {
                  id: String.fromCharCode(65 + index),
                  label: cleanedChoice,
                  value: String(index),
                  originalText: choice,
                };
              },
            );
          }

          return {
            id: answer.id,
            answer: answer.answer || "",
            pointsEarned: answer.pointsEarned ?? 0,
            graded: answer.graded ?? false,
            exerciseId: answer.exercise?.id || "",
            title: answer.exercise?.title || "",
            questionContent: answer.exercise?.questionContent || "",
            questionType: answer.exercise?.questionType || "",
            correctAnswer,
            maxPoints: answer.examExercise?.points ?? 0,
            order: answer.examExercise?.order ?? 0,
            options,
          };
        })
      : [];

  const totalScore = answers.reduce((sum, answer) => {
    const localScore = scores[answer.id];
    if (localScore && localScore.trim() !== "") {
      const parsedScore = parseFloat(localScore);
      if (!isNaN(parsedScore)) {
        return sum + parsedScore;
      }
    }
    return sum + (answer.pointsEarned ?? 0);
  }, 0);
  const maxTotalScore = answers.reduce(
    (sum, answer) => sum + (answer.maxPoints ?? 0),
    0,
  );

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
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(-1)}
              title="返回"
            />
            <div>
              <Title
                level={4}
                style={{ margin: 0, fontWeight: 700, color: "#333" }}
              >
                批改答卷
              </Title>
              <Text type="secondary">
                学生: {studentExam.student?.name || "Unknown"} | 考试:{" "}
                {studentExam.exam?.title || "Unknown"}
              </Text>
            </div>
          </div>

          <Space size={24}>
            <div style={{ textAlign: "center" }}>
              <Title level={3} style={{ margin: 0, color: "#1890ff" }}>
                {totalScore}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前得分
              </Text>
            </div>
            <div style={{ textAlign: "center" }}>
              <Title level={3} style={{ margin: 0, color: "#999" }}>
                {maxTotalScore}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                满分
              </Text>
            </div>
          </Space>
        </div>

        <Space size={8}>
          <Tag
            icon={
              studentExam.status === "graded" ? (
                <CheckCircleOutlined />
              ) : undefined
            }
            color={studentExam.status === "graded" ? "success" : "warning"}
          >
            {studentExam.status === "graded" ? "已批改" : "待批改"}
          </Tag>
          <Tag color={studentExam.passed ? "success" : "error"}>
            {studentExam.passed ? "及格" : "不及格"}
          </Tag>
          <ReadonlyActionButton
            type="primary"
            size="small"
            icon={<StarOutlined />}
            onClick={handleAutoGradeMultipleChoice}
            style={{ backgroundColor: "#722ed1", borderColor: "#722ed1" }}
          >
            自动批改选择题
          </ReadonlyActionButton>
        </Space>
      </div>

      <div style={{ flexGrow: 1, padding: 24, overflow: "auto" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {answers.length === 0 ? (
            <Card>
              <div style={{ padding: 32, textAlign: "center" }}>
                <Text type="secondary">该答卷暂无题目</Text>
              </div>
            </Card>
          ) : (
            answers
              .sort((a, b) => a.order - b.order)
              .map((answer, index) => (
                <Card
                  key={answer.id}
                  style={{ marginBottom: 16 }}
                  styles={{ body: { padding: 16 } }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ flexGrow: 1 }}>
                      <Space size={4} style={{ marginBottom: 8 }}>
                        <Tag color="blue">第 {index + 1} 题</Tag>
                        <Tag>{answer.maxPoints} 分</Tag>
                        <Tag>{answer.questionType}</Tag>
                        {answer.graded && <Tag color="success">已批改</Tag>}
                      </Space>
                      <Title
                        level={5}
                        style={{ margin: 0, fontWeight: 600, marginBottom: 8 }}
                      >
                        {answer.title}
                      </Title>
                      {answer.questionContent && (
                        <Text
                          type="secondary"
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            display: "block",
                          }}
                        >
                          {answer.questionContent}
                        </Text>
                      )}
                    </div>
                  </div>

                  <Divider style={{ margin: "12px 0" }} />

                  <div style={{ marginBottom: 16 }}>
                    <Text
                      type="secondary"
                      style={{
                        display: "block",
                        marginBottom: 8,
                        fontWeight: 500,
                      }}
                    >
                      学生答案:
                    </Text>
                    {answer.questionType === "multiple_choice" &&
                    answer.options &&
                    answer.options.length > 0 ? (
                      <Space size={8} wrap>
                        {answer.options.map((option: any) => {
                          const studentAnswer = answer.answer;
                          const isSelected = 
                            studentAnswer === option.value ||
                            studentAnswer === option.id ||
                            studentAnswer === String.fromCharCode(65 + parseInt(option.value));
                          return (
                            <Tag
                              key={option.id}
                              color={isSelected ? "processing" : "default"}
                              style={{
                                padding: "4px 12px",
                                fontSize: 14,
                                border: isSelected
                                  ? "2px solid #1890ff"
                                  : "1px solid #d9d9d9",
                                fontWeight: isSelected ? "bold" : "normal",
                              }}
                            >
                              {option.id}. {option.label}
                            </Tag>
                          );
                        })}
                      </Space>
                    ) : (
                      <div
                        style={{
                          padding: 16,
                          background: "#fafafa",
                          border: "1px solid #d9d9d9",
                          borderRadius: 6,
                          minHeight: 60,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                        }}
                      >
                        <Text>{answer.answer || "(未作答)"}</Text>
                      </div>
                    )}
                  </div>

                  {answer.correctAnswer && (
                    <div style={{ marginBottom: 16 }}>
                      <Text
                        type="secondary"
                        style={{
                          display: "block",
                          marginBottom: 8,
                          fontWeight: 500,
                        }}
                      >
                        {answer.questionType === "multiple_choice"
                          ? "正确答案:"
                          : "参考答案:"}
                      </Text>
                      {answer.questionType === "multiple_choice" &&
                      answer.options &&
                      answer.options.length > 0 ? (
                        <Space size={8} wrap>
                          {answer.options.map((option: any) => {
                            // 检查是否是正确答案 - 支持多种格式
                            let isCorrect = false;
                            const correctAnswer = answer.correctAnswer;

                            if (correctAnswer !== undefined && correctAnswer !== null) {
                              // 1. 直接匹配 originalText
                              if (correctAnswer === option.originalText) {
                                isCorrect = true;
                              }
                              // 2. 匹配索引（correctAnswer 是数字字符串如 "0", "1", "2"）
                              else if (correctAnswer === option.value) {
                                isCorrect = true;
                              }
                              // 3. 匹配选项字母（如 "A", "B", "C", "D"）
                              else if (correctAnswer === option.id) {
                                isCorrect = true;
                              }
                              // 4. 匹配清理后的选项文本
                              else {
                                const cleanCorrectAnswer = String(correctAnswer).replace(/^[A-Z][).、]\s*/, "");
                                if (cleanCorrectAnswer === option.label || cleanCorrectAnswer === option.originalText) {
                                  isCorrect = true;
                                }
                              }
                            }

                            return (
                              <Tag
                                key={option.id}
                                color={isCorrect ? "success" : "default"}
                                style={{
                                  padding: "4px 12px",
                                  fontSize: 14,
                                  border: isCorrect
                                    ? "2px solid #52c41a"
                                    : "1px solid #d9d9d9",
                                  fontWeight: isCorrect ? "bold" : "normal",
                                }}
                              >
                                {option.id}. {option.label}
                              </Tag>
                            );
                          })}
                        </Space>
                      ) : (
                        <div
                          style={{
                            padding: 16,
                            background: "#e6f7ff",
                            border: "1px solid #91d5ff",
                            borderRadius: 6,
                            minHeight: 60,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          <Text type="secondary">{answer.correctAnswer}</Text>
                        </div>
                      )}
                    </div>
                  )}

                  {answer.questionType !== "multiple_choice" && (
                    <div style={{ marginBottom: 16 }}>
                      <ReadonlyActionButton
                        icon={
                          aiGradingLoading[answer.id] ? (
                            <Spin size="small" />
                          ) : (
                            <StarOutlined />
                          )
                        }
                        onClick={() => handleAIGrading(answer)}
                        disabled={
                          aiGradingLoading[answer.id] ||
                          !answer.answer ||
                          answer.answer.trim() === ""
                        }
                        style={{ marginBottom: 8 }}
                      >
                        {aiGradingLoading[answer.id]
                          ? "AI评分中..."
                          : "AI 评分"}
                      </ReadonlyActionButton>

                      {aiGradingResults[answer.id] && (
                        <Collapse
                          activeKey={expandedAIResults[answer.id] ? ["1"] : []}
                          onChange={() => toggleAIResult(answer.id)}
                          items={[
                            {
                              key: "1",
                              label: "AI 评分分析",
                              children: (
                                <div>
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      marginBottom: 12,
                                    }}
                                  >
                                    <Title
                                      level={5}
                                      style={{ margin: 0, color: "#1890ff" }}
                                    >
                                      建议分数
                                    </Title>
                                    <Space>
                                      <Title
                                        level={4}
                                        style={{ margin: 0, color: "#1890ff" }}
                                      >
                                        {
                                          aiGradingResults[answer.id]
                                            .suggestedScore
                                        }{" "}
                                        分
                                      </Title>
                                      <ReadonlyActionButton
                                        type="primary"
                                        size="small"
                                        style={{ background: "#52c41a" }}
                                        onClick={() =>
                                          handleApplyAIScore(
                                            answer.id,
                                            aiGradingResults[answer.id]
                                              .suggestedScore,
                                            answer.maxPoints,
                                          )
                                        }
                                        disabled={gradeAnswerMutation.isPending}
                                      >
                                        应用此分数
                                      </ReadonlyActionButton>
                                    </Space>
                                  </div>

                                  <div style={{ marginBottom: 8 }}>
                                    <Text
                                      type="secondary"
                                      style={{ fontWeight: 600 }}
                                    >
                                      分析:
                                    </Text>
                                    <Text
                                      style={{
                                        display: "block",
                                        marginTop: 4,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {aiGradingResults[answer.id].analysis}
                                    </Text>
                                  </div>

                                  <div>
                                    <Text
                                      type="secondary"
                                      style={{ fontWeight: 600 }}
                                    >
                                      推理:
                                    </Text>
                                    <Text
                                      style={{
                                        display: "block",
                                        marginTop: 4,
                                        whiteSpace: "pre-wrap",
                                      }}
                                    >
                                      {aiGradingResults[answer.id].reasoning}
                                    </Text>
                                  </div>
                                </div>
                              ),
                            },
                          ]}
                        />
                      )}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    {answer.questionType === "multiple_choice" ? (
                      <Space size={8} align="center">
                        <InputNumber
                          placeholder="自动评分"
                          min={0}
                          max={answer.maxPoints}
                          step={0.5}
                          style={{ width: 100 }}
                          value={
                            scores[answer.id]
                              ? parseFloat(scores[answer.id])
                              : answer.pointsEarned ?? 0
                          }
                          disabled
                        />
                        <Text type="secondary">/ {answer.maxPoints} 分</Text>
                      </Space>
                    ) : (
                      <>
                        <InputNumber
                          placeholder="请输入分数"
                          min={0}
                          max={answer.maxPoints}
                          step={0.5}
                          disabled={!canEdit}
                          style={{ width: 120 }}
                          value={
                            scores[answer.id]
                              ? parseFloat(scores[answer.id])
                              : undefined
                          }
                          onChange={(value) =>
                            handleScoreChange(
                              answer.id,
                              value?.toString() || "",
                            )
                          }
                        />
                        <Text type="secondary">/ {answer.maxPoints} 分</Text>
                      </>
                    )}
                  </div>
                </Card>
              ))
          )}
        </div>
      </div>

      <div
        style={{
          padding: 24,
          background: "white",
          borderTop: "1px solid #e0e0e0",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text type="secondary">
            总分: {totalScore} / {maxTotalScore}
          </Text>
          <ReadonlyActionButton
            type="primary"
            onClick={handleGradeAll}
            disabled={isGrading || gradeAnswerMutation.isPending}
            icon={<CheckCircleOutlined />}
          >
            {isGrading ? "提交中..." : "完成批改"}
          </ReadonlyActionButton>
        </div>
      </div>
    </div>
  );
}
