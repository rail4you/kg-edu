import React, { useState, useCallback, useEffect, useMemo } from "react"
import {
  useNavigate } from "react-router-dom";
import {
  useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Grid,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Popover,
  Radio,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  Spin,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ImportOutlined,
  FileTextOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  TeamOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  createMmExercise,
  updateMmExercise,
  deleteMmExercise,
  listMmExercisesByCourse,
  listActivityLogsByActionType,
  listUsers,
} from "@/lib/ash_rpc";
import ImportModal from "@/components/micro-major/import-modal";
import {
extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

interface MMExerciseManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
}

interface ExerciseItem {
  id: string;
  microMajorCourseId: string;
  microMajorChapterId?: string | null;
  title: string;
  questionContent: string;
  questionType: string;
  answer?: string;
  options?: { choices: string[]; correctAnswer: number; correctAnswers?: number[] } | string;
  difficulty?: number | null;
  position?: number | null;
  answerExplanation?: string;
  sourceExerciseId?: string | null;
  insertedAt?: string;
}

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  fill_in_blank: "填空题",
  essay: "问答题",
  term_definition: "名词解释",
  case_study: "案例分析",
};

const DIFFICULTY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "简单", color: "green" },
  2: { label: "中等", color: "orange" },
  3: { label: "困难", color: "red" },
};

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "简单" },
  { value: 2, label: "中等" },
  { value: 3, label: "困难" },
];

function parseOptions(opts: any): { choices: string[]; correctAnswer: number; correctAnswers: number[] } {
  if (!opts) return { choices: ["", "", "", ""], correctAnswer: 0, correctAnswers: [] };
  try {
    const parsed = typeof opts === "string" ? JSON.parse(opts) : opts;
    return {
      choices: parsed.choices || ["", "", "", ""],
      correctAnswer: parsed.correctAnswer ?? 0,
      correctAnswers: parsed.correctAnswers || [],
    };
  } catch {
    return { choices: ["", "", "", ""], correctAnswer: 0, correctAnswers: [] };
  }
}

export default function MMExerciseManager({ tenant, courseId, headers }: MMExerciseManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form state (use local state for dynamic form fields)
  const [formData, setFormData] = useState({
    title: "",
    questionType: "multiple_choice" as string,
    questionContent: "",
    answer: "",
    choices: ["", "", "", ""],
    correctAnswer: 0,
    correctAnswers: [] as number[],
    difficulty: undefined as number | undefined,
    answerExplanation: "",
    position: 0,
  });

  const resetForm = () => {
    setFormData({
      title: "",
      questionType: "multiple_choice",
      questionContent: "",
      answer: "",
      choices: ["", "", "", ""],
      correctAnswer: 0,
      correctAnswers: [],
      difficulty: undefined,
      answerExplanation: "",
      position: 0,
    });
  };

  // Student answers tab state
  const [answersTab, setAnswersTab] = useState("list");
  const [answersLoading, setAnswersLoading] = useState(false);
  const [answersData, setAnswersData] = useState<{ exerciseTitle: string; exerciseId: string; logId: string; studentName: string; answer: string; questionContent: string; correctAnswerText: string; answerExplanation: string; correct?: boolean; submittedAt: string }[]>([]);

  // Load all exercise submissions when switching to answers tab
  const loadAllAnswers = useCallback(async () => {
    if (!courseId) return;
    setAnswersLoading(true);
    setAnswersData([]);
    try {
      const [logsRes, exRes] = await Promise.all([
        listActivityLogsByActionType({
          tenant,
          input: { actionType: "mm_exercise_submit" },
          fields: ["id", "resourceId", "metadata", "insertedAt", { user: ["id", "name", "email"] }],
          sort: "-insertedAt",
          headers,
        }),
        listMmExercisesByCourse({
          tenant,
          input: { microMajorCourseId: courseId },
          fields: ["id", "title", "questionType", "options"],
          headers,
        }),
      ]);
      if (!logsRes.success || !exRes.success) return;
      const logs = extractArrayData(logsRes) as any[];
      const exData = extractArrayData(exRes) as { id: string; title: string; questionType: string; options: any }[];
      const exMap = Object.fromEntries(exData.map(e => [e.id, e]));
      const data = logs
        .filter((l: any) => exMap[l.resourceId])
        .map((l: any) => {
          const ex = exMap[l.resourceId];
          const meta = typeof l.metadata === "string" ? (() => { try { return JSON.parse(l.metadata); } catch { return {}; } })() : (l.metadata || {});
          // Convert answer index to option text for choice questions
          let answerText = meta.answer ?? "-";
          if (ex && ["multiple_choice", "multiple_response", "true_false"].includes(ex.questionType) && meta.answer !== undefined) {
            try {
              const opts = typeof ex.options === "string" ? JSON.parse(ex.options) : (ex.options || {});
              const choices: string[] = opts?.choices || [];
              if (ex.questionType === "multiple_response") {
                const indices: number[] = JSON.parse(meta.answer);
                answerText = (indices || []).map((i: number) => `${String.fromCharCode(65 + i)}. ${choices[i] || ""}`).join("; ");
              } else {
                const idx = parseInt(meta.answer, 10);
                answerText = `${String.fromCharCode(65 + (idx || 0))}. ${choices[idx] || ""}`;
              }
            } catch { /* keep raw */ }
          }
          return {
            exerciseTitle: ex?.title || "未知",
            exerciseId: l.resourceId,
            logId: l.id,
            studentName: l.user?.name || l.user?.email || "未知",
            answer: answerText,
            questionContent: ex?.questionContent || "",
            correctAnswerText: (() => {
              if (!ex) return "";
              if (["multiple_choice", "multiple_response", "true_false"].includes(ex.questionType)) {
                try {
                  const opts = typeof ex.options === "string" ? JSON.parse(ex.options) : (ex.options || {});
                  const choices: string[] = opts?.choices || [];
                  if (ex.questionType === "multiple_response") {
                    return (opts.correctAnswers || []).map((i: number) => `${String.fromCharCode(65 + i)}. ${choices[i] || ""}`).join("; ");
                  }
                  const ci = opts.correctAnswer ?? 0;
                  return `${String.fromCharCode(65 + ci)}. ${choices[ci] || ""}`;
                } catch { return ex.answer || ""; }
              }
              return ex.answer || "";
            })(),
            answerExplanation: ex?.answerExplanation || "",
            correct: meta.isCorrect,
            submittedAt: l.insertedAt ? new Date(l.insertedAt).toLocaleString("zh-CN") : "-",
          };
        });
      setAnswersData(data);
    } catch { /* ignore */ }
    setAnswersLoading(false);
  }, [courseId, tenant, headers]);

  // Local grading state: logId -> boolean (true=correct, false=incorrect)
  const gradeKey = `mm_exercise_grades_${courseId}`;
  const [manualGrades, setManualGrades] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(gradeKey);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(gradeKey, JSON.stringify(manualGrades));
  }, [manualGrades, gradeKey]);

  const studentSet = useMemo(() => new Set(answersData.map(d => d.studentName)), [answersData]);
  const avgCorrectRate = useMemo(() => {
    const allCorrect = answersData.map(d => {
      // Use manual grade if available, otherwise use auto-judged value
      return manualGrades[d.logId] !== undefined ? manualGrades[d.logId] : d.correct;
    });
    const withResult = allCorrect.filter(c => c !== undefined);
    return withResult.length > 0 ? Math.round(withResult.filter(Boolean).length / withResult.length * 100) : 0;
  }, [answersData, manualGrades]);

  const handleTabChange = (key: string) => {
    setAnswersTab(key);
    if (key === "answers") loadAllAnswers();
  };

  // Fetch exercises
  const { data: exercisesData, isLoading } = useQuery({
    queryKey: ["mm-exercises", courseId],
    queryFn: async () => {
      const result = await listMmExercisesByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id",
          "title",
          "questionContent",
          "questionType",
          "answer",
          "options",
          "difficulty",
          "position",
          "answerExplanation",
          "sourceExerciseId",
          "insertedAt",
        ],
        headers,
      });
      if (!result.success) return [];
      const data = result.data;
      if (Array.isArray(data)) return data;
      return data?.results || [];
    },
    enabled: !!tenant && !!courseId,
  });

  const exercises: ExerciseItem[] = (exercisesData as ExerciseItem[]) || [];

  // Create exercise
  const createMutation = useMutation({
    mutationFn: async () => {
      const { choices, correctAnswer, correctAnswers, ...rest } = formData;
      const input: any = {
        microMajorCourseId: courseId,
        ...rest,
      };
      // Build options for choice types
      if (formData.questionType === "multiple_choice") {
        input.options = {
          choices,
          correctAnswer: formData.correctAnswer,
        };
        input.answer = choices[formData.correctAnswer] || "";
      } else if (formData.questionType === "multiple_response") {
        const correctTexts = formData.correctAnswers.map(i => choices[i]).filter(Boolean);
        input.options = {
          choices,
          correctAnswers: formData.correctAnswers,
        };
        input.answer = correctTexts.join(", ");
      } else if (formData.questionType === "true_false") {
        input.options = {
          choices: ["正确", "错误"],
          correctAnswer: formData.correctAnswer,
        };
        input.answer = formData.correctAnswer === 0 ? "正确" : "错误";
      }
      // For non-choice types, answer is the text answer
      if (!["multiple_choice", "multiple_response", "true_false"].includes(formData.questionType)) {
        input.answer = formData.answer;
      }
      const result = await createMmExercise({
        tenant,
        input,
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) {
        const errMsg = result.errors?.[0]?.message || "创建失败";
        throw new Error(errMsg);
      }
      return result.data;
    },
    onSuccess: () => {
      message.success("习题创建成功");
      setCreateModalOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["mm-exercises"] });
    },
    onError: (err) => message.error("创建失败: " + (err instanceof Error ? err.message : "未知错误")),
  });

  // Update exercise
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingExercise) throw new Error("No exercise selected");
      const { choices, correctAnswer, correctAnswers, ...rest } = formData;
      const input: any = { ...rest };
      if (formData.questionType === "multiple_choice") {
        input.options = {
          choices,
          correctAnswer: formData.correctAnswer,
        };
        input.answer = choices[formData.correctAnswer] || "";
      } else if (formData.questionType === "multiple_response") {
        const correctTexts = formData.correctAnswers.map(i => choices[i]).filter(Boolean);
        input.options = {
          choices,
          correctAnswers: formData.correctAnswers,
        };
        input.answer = correctTexts.join(", ");
      } else if (formData.questionType === "true_false") {
        input.options = {
          choices: ["正确", "错误"],
          correctAnswer: formData.correctAnswer,
        };
        input.answer = formData.correctAnswer === 0 ? "正确" : "错误";
      }
      if (!["multiple_choice", "multiple_response", "true_false"].includes(formData.questionType)) {
        input.answer = formData.answer;
      }
      const result = await updateMmExercise({
        tenant,
        primaryKey: editingExercise.id,
        input,
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) throw new Error("更新失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("更新成功");
      setEditModalOpen(false);
      setEditingExercise(null);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["mm-exercises"] });
    },
    onError: (err) => message.error("更新失败: " + (err instanceof Error ? err.message : "未知错误")),
  });

  // Delete exercise
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMmExercise({ tenant, primaryKey: id, headers });
      if (!result.success) throw new Error("删除失败");
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["mm-exercises"] });
    },
    onError: () => message.error("删除失败"),
  });

  // ---- Form handlers ----
  const handleEditClick = (exercise: ExerciseItem) => {
    setEditingExercise(exercise);
    const opts = parseOptions(exercise.options);
    setFormData({
      title: exercise.title,
      questionType: exercise.questionType,
      questionContent: exercise.questionContent,
      answer: exercise.answer || "",
      choices: opts.choices,
      correctAnswer: opts.correctAnswer,
      correctAnswers: opts.correctAnswers,
      difficulty: exercise.difficulty ?? undefined,
      answerExplanation: exercise.answerExplanation || "",
      position: exercise.position || 0,
    });
    setEditModalOpen(true);
  };

  const handleCreateFinish = async () => {
    if (!formData.title.trim()) { message.error("请输入标题"); return; }
    if (!formData.questionContent.trim()) { message.error("请输入题目内容"); return; }
    createMutation.mutate();
  };

  const handleEditFinish = async () => {
    if (!formData.title.trim()) { message.error("请输入标题"); return; }
    updateMutation.mutate();
  };

  // ---- Render form fields ----
  const renderOptionFields = () => {
    if (formData.questionType === "multiple_choice") {
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Text strong style={{ marginRight: 8 }}>选项 {String.fromCharCode(65 + i)}</Text>
              <Space>
                <Input
                  value={formData.choices[i]}
                  onChange={(e) => {
                    const c = [...formData.choices];
                    c[i] = e.target.value;
                    setFormData({ ...formData, choices: c });
                  }}
                  style={{ width: 300 }}
                  placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                />
                <Radio
                  checked={formData.correctAnswer === i}
                  onChange={() => setFormData({ ...formData, correctAnswer: i })}
                >
                  正确
                </Radio>
              </Space>
            </div>
          ))}
        </>
      );
    }

    if (formData.questionType === "multiple_response") {
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <Text strong style={{ marginRight: 8 }}>选项 {String.fromCharCode(65 + i)}</Text>
              <Space>
                <Input
                  value={formData.choices[i]}
                  onChange={(e) => {
                    const c = [...formData.choices];
                    c[i] = e.target.value;
                    setFormData({ ...formData, choices: c });
                  }}
                  style={{ width: 300 }}
                  placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                />
                <Checkbox
                  checked={formData.correctAnswers.includes(i)}
                  onChange={(e) => {
                    const ca = e.target.checked
                      ? [...formData.correctAnswers, i]
                      : formData.correctAnswers.filter((x) => x !== i);
                    setFormData({ ...formData, correctAnswers: ca });
                  }}
                >
                  正确
                </Checkbox>
              </Space>
            </div>
          ))}
        </>
      );
    }

    if (formData.questionType === "true_false") {
      return (
        <div style={{ marginBottom: 12 }}>
          <Text strong>正确答案</Text>
          <div style={{ marginTop: 8 }}>
            <Radio.Group
              value={formData.correctAnswer}
              onChange={(e) => setFormData({ ...formData, correctAnswer: e.target.value })}
            >
              <Radio value={0}>正确</Radio>
              <Radio value={1}>错误</Radio>
            </Radio.Group>
          </div>
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 12 }}>
        <Text strong>答案</Text>
        <div style={{ marginTop: 8 }}>
          <Input.TextArea
            rows={formData.questionType === "case_study" ? 5 : 3}
            value={formData.answer}
            onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
            placeholder={
              formData.questionType === "term_definition"
                ? "请输入名词的完整解释"
                : formData.questionType === "case_study"
                  ? "请输入案例分析的参考答案"
                  : "参考答案"
            }
          />
        </div>
      </div>
    );
  };

  // ---- Columns ----
  const columns: TableColumnsType<ExerciseItem> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      ellipsis: true,
      render: (text: string, record: ExerciseItem) => {
        const answerText = record.answer || "-";
        const opts = (() => {
          if (!record.options) return null;
          try { return typeof record.options === "string" ? JSON.parse(record.options) : record.options; } catch { return null; }
        })();
        const correctText = opts?.choices ? (() => {
          if (record.questionType === "multiple_choice" || record.questionType === "true_false") {
            const i = opts.correctAnswer ?? 0;
            return `${String.fromCharCode(65 + i)}. ${opts.choices[i] || ""}`;
          }
          if (record.questionType === "multiple_response") {
            return (opts.correctAnswers || []).map((i: number) => `${String.fromCharCode(65 + i)}. ${opts.choices[i] || ""}`).join("; ");
          }
          return record.answer;
        })() : record.answer;
        return (
          <Popover
            title={<Text strong>{text}</Text>}
            content={
              <div style={{ maxWidth: 400 }}>
                <div style={{ marginBottom: 8 }}><Text type="secondary">题目：</Text><Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{record.questionContent}</Paragraph></div>
                <div><Text type="secondary">正确答案：</Text><Text strong style={{ color: "#52c41a" }}>{correctText || "-"}</Text></div>
                {record.answerExplanation && <div style={{ marginTop: 8 }}><Text type="secondary">解析：</Text><Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{record.answerExplanation}</Paragraph></div>}
              </div>
            }
            trigger="hover"
            placement="right"
          >
            <Space style={{ cursor: "pointer" }}>
              <FileTextOutlined style={{ color: "#722ed1" }} />
              <span>{text}</span>
            </Space>
          </Popover>
        );
      },
    },
    {
      title: "题型",
      dataIndex: "questionType",
      key: "questionType",
      width: 100,
      render: (v: string) => {
        const info = QUESTION_TYPE_LABELS[v];
        const colorMap: Record<string, string> = {
          multiple_choice: "blue",
          multiple_response: "purple",
          true_false: "cyan",
          fill_in_blank: "orange",
          essay: "green",
          term_definition: "magenta",
          case_study: "gold",
        };
        return <Tag color={colorMap[v] || "default"}>{info || v}</Tag>;
      },
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      key: "difficulty",
      width: 80,
      render: (v: number) => {
        const d = DIFFICULTY_LABELS[v];
        return d ? <Tag color={d.color}>{d.label}</Tag> : "-";
      },
    },
    {
      title: "来源",
      dataIndex: "sourceExerciseId",
      key: "sourceExerciseId",
      width: 80,
      render: (v: string) =>
        v ? <Text type="secondary" style={{ fontSize: 12 }}>已导入</Text> : <Text type="success" style={{ fontSize: 12 }}>手动</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: isMobile ? 60 : 140,
      render: (_: any, record: ExerciseItem) => (
        <Space size={isMobile ? 2 : 4}>
          <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditClick(record)}>
            {isMobile ? "" : "编辑"}
          </ReadonlyActionButton>
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>{isMobile ? "" : "删除"}</ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)" }}>
        <Tabs
          activeKey={answersTab}
          onChange={handleTabChange}
          items={[
            {
              key: "list",
              label: <Space><FileTextOutlined /><span>习题列表 ({exercises.length})</span></Space>,
              children: isLoading ? (
                <Table columns={columns} dataSource={[]} rowKey="id" loading pagination={false} size="middle" />
              ) : exercises.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 24px" }}>
                  <Empty description="暂无习题，请创建或从智慧课程导入" />
                  <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { resetForm(); setCreateModalOpen(true); }} style={canEdit ? undefined : { display: "none" }}>
                      新建习题
                    </Button>
                    <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                      从智慧课程导入
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Space>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => { resetForm(); setCreateModalOpen(true); }} style={canEdit ? undefined : { display: "none" }}>
                        新建习题
                      </Button>
                      <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                        从智慧课程导入
                      </Button>
                    </Space>
                  </div>
                  <Table
                    columns={columns}
                    dataSource={exercises}
                    rowKey="id"
                    loading={isLoading}
                    pagination={false}
                    size="middle"
                    locale={{ emptyText: <Empty description="暂无习题" /> }}
                  />
                </>
              ),
            },
            {
              key: "answers",
              label: <Space><EyeOutlined /><span>答题统计</span></Space>,
              children: (
                <div>
                  {answersLoading ? (
                    <div style={{ textAlign: "center", padding: 60 }}><Spin /></div>
                  ) : answersData.length === 0 ? (
                    <Empty description="暂无学生提交答案" />
                  ) : (
                    <>
                      {/* Overview stats */}
                      <Row gutter={isMobile ? 6 : 16} style={{ marginBottom: isMobile ? 10 : 16 }}>
                        <Col span={isMobile ? 6 : 6}>
                          <Card size="small" bodyStyle={isMobile ? { padding: "6px 4px" } : undefined} style={{ textAlign: "center" }}>
                            <Statistic title={<span style={{ fontSize: isMobile ? 10 : 13 }}>总习题</span>} value={exercises.length} prefix={<FileTextOutlined style={{ fontSize: isMobile ? 14 : 18 }} />} valueStyle={{ color: "#722ed1", fontSize: isMobile ? 16 : 24 }} />
                          </Card>
                        </Col>
                        <Col span={isMobile ? 6 : 6}>
                          <Card size="small" bodyStyle={isMobile ? { padding: "6px 4px" } : undefined} style={{ textAlign: "center" }}>
                            <Statistic title={<span style={{ fontSize: isMobile ? 10 : 13 }}>答题学生</span>} value={studentSet.size} prefix={<TeamOutlined style={{ fontSize: isMobile ? 14 : 18 }} />} valueStyle={{ color: "#1890ff", fontSize: isMobile ? 16 : 24 }} />
                          </Card>
                        </Col>
                        <Col span={isMobile ? 6 : 6}>
                          <Card size="small" bodyStyle={isMobile ? { padding: "6px 4px" } : undefined} style={{ textAlign: "center" }}>
                            <Statistic title={<span style={{ fontSize: isMobile ? 10 : 13 }}>提交次数</span>} value={answersData.length} prefix={<FileTextOutlined style={{ fontSize: isMobile ? 14 : 18 }} />} valueStyle={{ color: "#13c2c2", fontSize: isMobile ? 16 : 24 }} />
                          </Card>
                        </Col>
                        <Col span={isMobile ? 6 : 6}>
                          <Card size="small" bodyStyle={isMobile ? { padding: "6px 4px" } : undefined} style={{ textAlign: "center" }}>
                            <Statistic title={<span style={{ fontSize: isMobile ? 10 : 13 }}>正确率</span>} value={avgCorrectRate} suffix="%" prefix={<CheckCircleOutlined style={{ fontSize: isMobile ? 14 : 18 }} />} valueStyle={{ color: avgCorrectRate >= 60 ? "#3f8600" : "#faad14", fontSize: isMobile ? 16 : 24 }} />
                          </Card>
                        </Col>
                      </Row>
                      {/* Answers table */}
                      <Table
                        dataSource={answersData}
                        rowKey={(r, i) => String(i)}
                        pagination={{ pageSize: 20 }}
                        size="small"
                        columns={[
                          { title: "习题", dataIndex: "exerciseTitle", key: "exerciseTitle", width: 160, ellipsis: true,
                            render: (text: string, r: any) => (
                              <Popover
                                title={<Text strong>{text}</Text>}
                                content={
                                  <div style={{ maxWidth: 400 }}>
                                    <div style={{ marginBottom: 8 }}><Text type="secondary">题目：</Text><Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{r.questionContent}</Paragraph></div>
                                    <div><Text type="secondary">正确答案：</Text><Text strong style={{ color: "#52c41a" }}>{r.correctAnswerText || "-"}</Text></div>
                                    {r.answerExplanation && <div style={{ marginTop: 8 }}><Text type="secondary">解析：</Text><Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>{r.answerExplanation}</Paragraph></div>}
                                  </div>
                                }
                                trigger="hover"
                                placement="right"
                              >
                                <span style={{ cursor: "pointer" }}>{text}</span>
                              </Popover>
                            ),
                          },
                          { title: "学生", dataIndex: "studentName", key: "studentName", width: 120 },
                          { title: "答案", dataIndex: "answer", key: "answer", ellipsis: true },
                          {
                            title: "结果", key: "correct", width: 80,
                            render: (_, r) => {
                              const grade = manualGrades[r.logId] !== undefined ? manualGrades[r.logId] : r.correct;
                              if (grade === undefined) return <Text type="secondary">待批</Text>;
                              return grade
                                ? <Tag icon={<CheckCircleOutlined />} color="success">正确</Tag>
                                : <Tag icon={<CloseCircleOutlined />} color="error">错误</Tag>;
                            },
                          },
                          {
                            title: "操作", key: "action", width: 140,
                            render: (_, r) => {
                              const grade = manualGrades[r.logId] !== undefined ? manualGrades[r.logId] : r.correct;
                              if (grade !== undefined) return <Text type="secondary">已批</Text>;
                              return (
                                <Space>
                                  <ReadonlyActionButton size="small" type="primary" ghost icon={<CheckCircleOutlined />}
                                    onClick={() => setManualGrades(p => ({ ...p, [r.logId]: true }))}>正确</ReadonlyActionButton>
                                  <ReadonlyActionButton size="small" danger ghost icon={<CloseCircleOutlined />}
                                    onClick={() => setManualGrades(p => ({ ...p, [r.logId]: false }))}>错误</ReadonlyActionButton>
                                </Space>
                              );
                            },
                          },
                          { title: "提交时间", dataIndex: "submittedAt", key: "submittedAt", width: 170 },
                        ]}
                        locale={{ emptyText: "暂无答题记录" }}
                      />
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="新建习题"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); resetForm(); }}
        onOk={handleCreateFinish}
        confirmLoading={createMutation.isPending}
        width={700}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>标题</Text>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="习题标题"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>题型</Text>
            <div style={{ marginTop: 4 }}>
              <Radio.Group
                value={formData.questionType}
                onChange={(e) => {
                  setFormData({ ...formData, questionType: e.target.value, choices: ["", "", "", ""], correctAnswer: 0, correctAnswers: [], answer: "" });
                }}
              >
                <Radio value="multiple_choice">单选题</Radio>
                <Radio value="multiple_response">多选题</Radio>
                <Radio value="true_false">判断题</Radio>
                <Radio value="fill_in_blank">填空题</Radio>
                <Radio value="essay">问答题</Radio>
                <Radio value="term_definition">名词解释</Radio>
                <Radio value="case_study">案例题</Radio>
              </Radio.Group>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>题目内容</Text>
            <Input.TextArea
              rows={3}
              value={formData.questionContent}
              onChange={(e) => setFormData({ ...formData, questionContent: e.target.value })}
              placeholder={
                formData.questionType === "term_definition" ? "请输入需要解释的名词" :
                formData.questionType === "case_study" ? "请输入案例场景描述" :
                "题目内容"
              }
              style={{ marginTop: 4 }}
            />
          </div>

          {renderOptionFields()}

          <div style={{ marginBottom: 16 }}>
            <Text strong>难度</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                value={formData.difficulty}
                onChange={(v) => setFormData({ ...formData, difficulty: v ?? undefined })}
                placeholder="选择难度"
                allowClear
                style={{ width: 200 }}
                options={DIFFICULTY_OPTIONS}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>答案解析</Text>
            <Input.TextArea
              rows={3}
              value={formData.answerExplanation}
              onChange={(e) => setFormData({ ...formData, answerExplanation: e.target.value })}
              placeholder="请输入答案解析（可选）"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>排序</Text>
            <InputNumber
              value={formData.position}
              onChange={(v) => setFormData({ ...formData, position: v ?? 0 })}
              min={0}
              style={{ width: 200, marginTop: 4 }}
            />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑习题"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingExercise(null); resetForm(); }}
        onOk={handleEditFinish}
        confirmLoading={updateMutation.isPending}
        width={700}
      >
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>标题</Text>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="习题标题"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>题目内容</Text>
            <Input.TextArea
              rows={3}
              value={formData.questionContent}
              onChange={(e) => setFormData({ ...formData, questionContent: e.target.value })}
              placeholder="题目内容"
              style={{ marginTop: 4 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>题型</Text>
            <div style={{ marginTop: 4 }}>
              <Tag style={{ fontSize: 14, padding: "4px 12px" }} color="blue">
                {QUESTION_TYPE_LABELS[formData.questionType] || formData.questionType}
              </Tag>
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>编辑时不可修改题型</Text>
            </div>
          </div>

          {renderOptionFields()}

          <div style={{ marginBottom: 16 }}>
            <Text strong>难度</Text>
            <div style={{ marginTop: 4 }}>
              <Select
                value={formData.difficulty}
                onChange={(v) => setFormData({ ...formData, difficulty: v ?? undefined })}
                placeholder="选择难度"
                allowClear
                style={{ width: 200 }}
                options={DIFFICULTY_OPTIONS}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Text strong>答案解析</Text>
            <Input.TextArea
              rows={3}
              value={formData.answerExplanation}
              onChange={(e) => setFormData({ ...formData, answerExplanation: e.target.value })}
              placeholder="请输入答案解析（可选）"
              style={{ marginTop: 4 }}
            />
          </div>
        </div>
      </Modal>

      <ImportModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        title="从智慧课程导入习题"
        importType="exercises"
        targetCourseId={courseId}
        tenant={tenant}
        headers={headers}
        onImport={async (exerciseIds) => {
          const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              action: "import_mm_exercises_from_course",
              input: { microMajorCourseId: courseId, exerciseIds },
            }),
          });
          const result = await resp.json();
          if (!result.success) throw new Error("导入失败");
          queryClient.invalidateQueries({ queryKey: ["mm-exercises"] });
        }}
      />

    </div>
  );
}
