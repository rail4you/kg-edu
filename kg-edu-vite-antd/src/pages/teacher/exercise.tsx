import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Card,
  Typography,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  Radio,
  Empty,
  Upload,
  Checkbox,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DownloadOutlined,
  UploadOutlined,
  SearchOutlined,
  BulbOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  listExercises,
  createExercise,
  destroyExercises,
  updateExercise,
  importExercisesFromExcel,
  getFileTemplateBySection,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import { updateAnswerExplanation } from "@/lib/agent_api";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Exercise {
  id: string;
  title: string;
  questionContent: string;
  questionType: "multiple_choice" | "essay" | "fill_in_blank" | "true_false" | "multiple_response" | "term_definition" | "case_study";
  answer?: string;
  options?: { choices: string[]; correctAnswer: number; correctAnswers?: number[] } | string;
  position?: number;
  answerExplanation?: string;
}

const questionTypeMap: Record<string, { label: string; color: string }> = {
  multiple_choice: { label: "单选题", color: "blue" },
  multiple_response: { label: "多选题", color: "purple" },
  true_false: { label: "判断题", color: "cyan" },
  fill_in_blank: { label: "填空题", color: "orange" },
  essay: { label: "问答题", color: "green" },
  term_definition: { label: "名词解释", color: "magenta" },
  case_study: { label: "案例题", color: "gold" },
};

const cleanOptionPrefix = (text: string, letter: string): string => {
  const trimmed = text.trim();
  if (trimmed.match(new RegExp(`^${letter}[.、．)\\s]`, "i"))) {
    return trimmed.replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
  }
  return trimmed;
};

// 渲染题目详情（用于 Tooltip 显示）
const renderExerciseDetail = (exercise: Exercise): React.ReactNode => {
  const lines: React.ReactNode[] = [];

  // 题目内容
  lines.push(
    <div key="content" style={{ marginBottom: 8 }}>
      <strong>题目：</strong>
      <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>
        {exercise.questionContent}
      </div>
    </div>
  );

  // 选择题/多选题/判断题 显示选项和答案
  const isChoiceType = ["multiple_choice", "multiple_response", "true_false"].includes(exercise.questionType);
  const isTrueFalse = exercise.questionType === "true_false";
  if (isChoiceType && exercise.options) {
    try {
      const opts = typeof exercise.options === "string"
        ? JSON.parse(exercise.options)
        : exercise.options;
      const isMultipleResponse = exercise.questionType === "multiple_response";
      const correctIndices: number[] = isMultipleResponse
        ? (Array.isArray(opts.correctAnswers) ? opts.correctAnswers : [])
        : (typeof opts.correctAnswer === "number" ? [opts.correctAnswer] : []);

      if (opts && Array.isArray(opts.choices)) {
        lines.push(
          <div key="options" style={{ marginBottom: 8 }}>
            <strong>选项：</strong>
            <div style={{ marginTop: 4 }}>
              {opts.choices.map((choice: string, idx: number) => {
                const letter = String.fromCharCode(65 + idx);
                const cleaned = cleanOptionPrefix(String(choice), letter);
                const isCorrect = correctIndices.includes(idx);
                return (
                  <div
                    key={idx}
                    style={{
                      color: isCorrect ? "#52c41a" : "inherit",
                      fontWeight: isCorrect ? "bold" : "normal",
                    }}
                  >
                    {isTrueFalse ? cleaned : `${letter}. ${cleaned || choice}`}
                    {isCorrect && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>
        );
        if (correctIndices.length > 0) {
          const answerText = isTrueFalse
            ? (correctIndices[0] === 0 ? "正确" : "错误")
            : correctIndices.map(idx => {
                const letter = String.fromCharCode(65 + idx);
                const cleaned = cleanOptionPrefix(String(opts.choices[idx]), letter);
                return `${letter}. ${cleaned || opts.choices[idx]}`;
              }).join("；");
          lines.push(
            <div key="answer" style={{ marginBottom: 8 }}>
              <strong>答案：</strong>
              <span style={{ color: "#52c41a", fontWeight: "bold" }}>
                {answerText}
              </span>
            </div>
          );
        }
      } else {
        const letters = Object.keys(opts || {}).filter((k: string) => /^[A-Z]$/.test(k)).sort();
        if (letters.length > 0) {
          const answerStr = exercise.answer || "";
          const answerLetters = answerStr.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
          lines.push(
            <div key="options" style={{ marginBottom: 8 }}>
              <strong>选项：</strong>
              <div style={{ marginTop: 4 }}>
                {letters.map((l: string) => {
                  const cleaned = cleanOptionPrefix(opts[l], l);
                  const isCorrect = isMultipleResponse
                    ? answerLetters.includes(l)
                    : l === answerStr;
                  return (
                    <div
                      key={l}
                      style={{
                        color: isCorrect ? "#52c41a" : "inherit",
                        fontWeight: isCorrect ? "bold" : "normal",
                      }}
                    >
                      {isTrueFalse ? cleaned : `${l}. ${cleaned || opts[l]}`}
                      {isCorrect && " ✓"}
                    </div>
                  );
                })}
              </div>
            </div>
          );
          if (answerStr) {
            const displayAnswer = isTrueFalse
              ? (answerStr.toUpperCase() === 'A' ? '正确' : '错误')
              : answerStr;
            lines.push(
              <div key="answer" style={{ marginBottom: 8 }}>
                <strong>答案：</strong>
                <span style={{ color: "#52c41a", fontWeight: "bold" }}>
                  {displayAnswer}
                </span>
              </div>
            );
          }
        }
      }
    } catch {
      // 解析失败
    }
  } else if (exercise.answer) {
    lines.push(
      <div key="answer" style={{ marginBottom: 8 }}>
        <strong>答案：</strong>
        <div style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "#52c41a" }}>
          {exercise.answer}
        </div>
      </div>
    );
  }

  if (exercise.answerExplanation) {
    lines.push(
      <div key="explanation" style={{ marginTop: 8 }}>
        <strong>答案解析：</strong>
        <div style={{ marginTop: 4, whiteSpace: "pre-wrap", color: "#1890ff" }}>
          {exercise.answerExplanation}
        </div>
      </div>
    );
  }

  return <div style={{ maxWidth: 400 }}>{lines}</div>;
};

export default function ExercisePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importing, setImporting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [analyzingExerciseId, setAnalyzingExerciseId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    questionContent: "",
    questionType: "multiple_choice" as string,
    answer: "",
    choices: ["", "", "", ""],
    correctAnswer: 0,
    correctAnswers: [] as number[],
    answerExplanation: "",
  });

  const tenant = currentTenant?.schemaName || "";

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const { data: exercises = [], isLoading: exercisesLoading } = useQuery({
    queryKey: ["exercises", selectedCourseId, tenant, searchText],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const fields = [
        "id",
        "title",
        "questionContent",
        "questionType",
        "answer",
        "options",
        "position",
        "answerExplanation",
      ] as any;

      const filter: any = {
        and: [
          { courseId: { eq: selectedCourseId } },
          { aiType: { eq: "manual_import" } },
          ...(searchText
            ? [{
                or: [
                  { title: { contains: searchText } },
                  { questionContent: { contains: searchText } },
                ],
              }]
            : []),
        ],
      };

      const result = await listExercises({
        tenant,
        fields,
        filter,
        sort: "-insertedAt",
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const input: any = {
        title: data.title,
        questionContent: data.questionContent,
        questionType: data.questionType,
        courseId: selectedCourseId,
        answerExplanation: data.answerExplanation,
      };
      if (data.questionType === "multiple_choice" || data.questionType === "true_false") {
        input.options = JSON.stringify({
          choices: data.questionType === "true_false"
            ? ["A. 正确", "B. 错误"]
            : data.choices,
          correctAnswer: data.questionType === "true_false" ? data.correctAnswer : data.correctAnswer,
        });
        input.answer = data.questionType === "true_false"
          ? String.fromCharCode(65 + data.correctAnswer)
          : data.choices[data.correctAnswer] || "";
      } else if (data.questionType === "multiple_response") {
        input.options = JSON.stringify({
          choices: data.choices,
          correctAnswers: data.correctAnswers,
        });
        input.answer = data.correctAnswers.map(i => String.fromCharCode(65 + i)).join(",");
      } else {
        input.answer = data.answer;
      }
      const result = await createExercise({
        tenant,
        input,
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to create");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      message.success("创建成功");
      setCreateModalOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyExercises({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to delete");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      message.success("删除成功");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData & { id: string }) => {
      const input: any = {
        title: data.title,
        questionContent: data.questionContent,
        questionType: data.questionType,
        answerExplanation: data.answerExplanation,
      };
      if (data.questionType === "multiple_choice" || data.questionType === "true_false") {
        input.options = JSON.stringify({
          choices: data.questionType === "true_false"
            ? ["A. 正确", "B. 错误"]
            : data.choices,
          correctAnswer: data.questionType === "true_false" ? data.correctAnswer : data.correctAnswer,
        });
        input.answer = data.questionType === "true_false"
          ? String.fromCharCode(65 + data.correctAnswer)
          : data.choices[data.correctAnswer] || "";
      } else if (data.questionType === "multiple_response") {
        input.options = JSON.stringify({
          choices: data.choices,
          correctAnswers: data.correctAnswers,
        });
        input.answer = data.correctAnswers.map(i => String.fromCharCode(65 + i)).join(",");
      } else {
        input.answer = data.answer;
      }
      const result = await updateExercise({
        tenant,
        primaryKey: data.id,
        input,
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      message.success("更新成功");
      setEditModalOpen(false);
    },
  });

  const updateExplanationMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const result = await updateAnswerExplanation({
        orgSchema: tenant,
        exerciseId,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error(result.message || "Failed to update answer explanation");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exercises"] });
      message.success("答案解析生成成功");
      setAnalyzingExerciseId(null);
    },
    onError: (error: any) => {
      message.error(error?.message || "答案解析生成失败");
      setAnalyzingExerciseId(null);
    },
  });

  // 批量删除习题
  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      for (const id of selectedRowKeys) {
        await deleteMutation.mutateAsync(id as string);
      }
      setSelectedRowKeys([]);
      message.success(`成功删除 ${selectedRowKeys.length} 道习题`);
    } catch (error) {
      message.error("批量删除失败");
    }
  };

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const result = await getFileTemplateBySection({
        input: { section: "exercise" },
        fields: ["id", "filePath", "section"] as const,
        headers: getHeaders(user),
      });

      if (result.success && (result.data as any)?.filePath) {
        const link = document.createElement("a");
        link.href = (result.data as any).filePath;
        link.download = "exercise_import_template.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success("模板下载成功");
      } else {
        message.error("无法获取习题模板文件");
      }
    } catch (error) {
      console.error("下载习题模板失败:", error);
      message.error("模板下载失败");
    }
  };

  // 导入习题
  const handleImport = async (file: File) => {
    if (!selectedCourseId) {
      message.error("请先选择课程");
      return false;
    }
    if (!user?.id) {
      message.error("用户信息获取失败");
      return false;
    }
    setImporting(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(",")[1];
        console.log("[Import] Starting import with attributes including answerExplanation");
        const result = await importExercisesFromExcel({
          tenant,
          input: {
            excelFile: base64,
            courseId: selectedCourseId,
            createdById: user.id,
            attributes: [
              "title",
              "question_content",
              "question_type",
              "answer",
              "options",
              "answer_explanation",
            ],
          } as any,
          headers: getHeaders(user),
        });
        const res = result as any;
        if (res.success) {
          const data = res.data as any;
          const summary = data?.summary || {};
          const skipped = data?.skipped || [];
          const failed = data?.failed || [];

          // 构建结果消息
          const parts: string[] = [];
          if (summary.success > 0) parts.push(`成功 ${summary.success} 条`);
          if (summary.skipped > 0) parts.push(`跳过 ${summary.skipped} 条`);
          if (summary.failed > 0) parts.push(`失败 ${summary.failed} 条`);

          const headerMsg = `导入完成：共 ${summary.total || 0} 条，${parts.join("，")}`;

          // 构建详情消息
          const details: string[] = [];
          if (skipped.length > 0) {
            details.push("跳过的习题：");
            skipped.forEach((s: any) => details.push(`  - ${s.title}：${s.reason}`));
          }
          if (failed.length > 0) {
            details.push("失败的习题：");
            failed.forEach((f: any) => details.push(`  - 第${f.index}行 ${f.title}：${f.reason}`));
          }

          // 根据结果显示不同类型的消息
          if (summary.success > 0 && summary.skipped === 0 && summary.failed === 0) {
            message.success(headerMsg);
          } else if (summary.success > 0 || summary.skipped > 0) {
            message.warning({
              content: (
                <div>
                  <div>{headerMsg}</div>
                  {details.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      {details.map((d, i) => <div key={i}>{d}</div>)}
                    </div>
                  )}
                </div>
              ),
              duration: 6,
            });
          } else {
            message.error({
              content: (
                <div>
                  <div>{headerMsg}</div>
                  {details.length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {details.map((d, i) => <div key={i}>{d}</div>)}
                    </div>
                  )}
                </div>
              ),
              duration: 8,
            });
          }

          if (summary.success > 0) {
            queryClient.invalidateQueries({ queryKey: ["exercises"] });
          }
          setImportModalOpen(false);
        } else {
          message.error(res.errors?.[0]?.message || "导入失败");
        }
        setImporting(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      message.error("导入失败");
      setImporting(false);
    }
    return false;
  };

  const resetForm = () =>
    setFormData({
      title: "",
      questionContent: "",
      questionType: "multiple_choice",
      answer: "",
      choices: ["", "", "", ""],
      correctAnswer: 0,
      correctAnswers: [],
      answerExplanation: "",
    });

  const handleEdit = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    let choices = ["", "", "", ""];
    let correctAnswer = 0;
    let correctAnswers: number[] = [];
    const isChoiceType = ["multiple_choice", "multiple_response", "true_false"].includes(exercise.questionType);
    if (isChoiceType && exercise.options) {
      try {
        const opts = typeof exercise.options === "string"
          ? JSON.parse(exercise.options)
          : exercise.options;
        if (opts && Array.isArray(opts.choices)) {
          choices = opts.choices;
          correctAnswer = opts.correctAnswer || 0;
          correctAnswers = Array.isArray(opts.correctAnswers) ? opts.correctAnswers : [];
        }
      } catch {
        // 解析失败，使用默认值
      }
    }
    setFormData({
      title: exercise.title,
      questionContent: exercise.questionContent,
      questionType: exercise.questionType as any,
      answer: exercise.answer || "",
      choices,
      correctAnswer,
      correctAnswers,
      answerExplanation: exercise.answerExplanation || "",
    });
    setEditModalOpen(true);
  };

  const columns: ColumnsType<Exercise> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      width: 320,
      align: "left",
      ellipsis: true,
      render: (title, record) => (
        <Tooltip title={renderExerciseDetail(record)} placement="right" overlayStyle={{ maxWidth: 500 }}>
          <span style={{ cursor: "pointer" }}>{title}</span>
        </Tooltip>
      ),
    },
    {
      title: "类型",
      dataIndex: "questionType",
      key: "questionType",
      width: 100,
      align: "left",
      render: (t) => (
        <Tag color={questionTypeMap[t]?.color}>
          {questionTypeMap[t]?.label || t}
        </Tag>
      ),
    },
    {
      title: "内容",
      dataIndex: "questionContent",
      key: "questionContent",
      ellipsis: true,
      render: (content, record) => (
        <Tooltip title={renderExerciseDetail(record)} placement="right" overlayStyle={{ maxWidth: 500 }}>
          <span style={{ cursor: "pointer" }}>{content}</span>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 300,
      render: (_, r) => (
        <Space>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(r)}
          >
            编辑
          </ReadonlyActionButton>
          <Tooltip title="使用 AI 生成或更新答案解析">
            <ReadonlyActionButton
              type="link"
              size="small"
              icon={<BulbOutlined />}
              loading={analyzingExerciseId === r.id}
              disabled={analyzingExerciseId !== null && analyzingExerciseId !== r.id}
              onClick={() => {
                setAnalyzingExerciseId(r.id);
                updateExplanationMutation.mutate(r.id);
              }}
            >
              解析
            </ReadonlyActionButton>
          </Tooltip>
          <Popconfirm
            title="确定删除？"
            onConfirm={() => deleteMutation.mutate(r.id)}
          >
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderForm = () => (
    <Form layout="vertical">
      <Form.Item label="标题" required>
        <Input
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          placeholder="题目标题"
        />
      </Form.Item>
      <Form.Item label="题型" required>
        <Radio.Group
          value={formData.questionType}
          onChange={(e) =>
            setFormData({ ...formData, questionType: e.target.value })
          }
        >
          <Radio value="multiple_choice">单选题</Radio>
          <Radio value="multiple_response">多选题</Radio>
          <Radio value="true_false">判断题</Radio>
          <Radio value="fill_in_blank">填空题</Radio>
          <Radio value="essay">问答题</Radio>
          <Radio value="term_definition">名词解释</Radio>
          <Radio value="case_study">案例题</Radio>
        </Radio.Group>
      </Form.Item>
      <Form.Item label="题目内容" required>
        <TextArea
          rows={3}
          value={formData.questionContent}
          onChange={(e) =>
            setFormData({ ...formData, questionContent: e.target.value })
          }
          placeholder={formData.questionType === "term_definition" ? "请输入需要解释的名词" : formData.questionType === "case_study" ? "请输入案例场景描述" : "题目内容"}
        />
      </Form.Item>
      {formData.questionType === "multiple_choice" ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Form.Item key={i} label={`选项 ${String.fromCharCode(65 + i)}`}>
              <Space>
                <Input
                  value={formData.choices[i]}
                  onChange={(e) => {
                    const c = [...formData.choices];
                    c[i] = e.target.value;
                    setFormData({ ...formData, choices: c });
                  }}
                  style={{ width: 300 }}
                />
                <Radio
                  checked={formData.correctAnswer === i}
                  onChange={() =>
                    setFormData({ ...formData, correctAnswer: i })
                  }
                >
                  正确
                </Radio>
              </Space>
            </Form.Item>
          ))}
        </>
      ) : formData.questionType === "multiple_response" ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Form.Item key={i} label={`选项 ${String.fromCharCode(65 + i)}`}>
              <Space>
                <Input
                  value={formData.choices[i]}
                  onChange={(e) => {
                    const c = [...formData.choices];
                    c[i] = e.target.value;
                    setFormData({ ...formData, choices: c });
                  }}
                  style={{ width: 300 }}
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
            </Form.Item>
          ))}
        </>
      ) : formData.questionType === "true_false" ? (
        <Form.Item label="正确答案">
          <Radio.Group
            value={formData.correctAnswer}
            onChange={(e) =>
              setFormData({ ...formData, correctAnswer: e.target.value })
            }
          >
            <Radio value={0}>正确</Radio>
            <Radio value={1}>错误</Radio>
          </Radio.Group>
        </Form.Item>
      ) : (
        <Form.Item label="答案">
          <TextArea
            rows={formData.questionType === "case_study" ? 5 : 2}
            value={formData.answer}
            onChange={(e) =>
              setFormData({ ...formData, answer: e.target.value })
            }
            placeholder={
              formData.questionType === "term_definition"
                ? "请输入名词的完整解释"
                : formData.questionType === "case_study"
                  ? "请输入案例分析的参考答案"
                  : "参考答案"
            }
          />
        </Form.Item>
      )}
      <Form.Item 
        label="答案解析" 
        extra="可选，最多 10000 字符"
      >
        <TextArea
          rows={4}
          value={formData.answerExplanation}
          onChange={(e) =>
            setFormData({ ...formData, answerExplanation: e.target.value })
          }
          placeholder="请输入答案解析，帮助学生理解答案的原因"
          maxLength={10000}
          showCount
        />
      </Form.Item>
    </Form>
  );

  if (!user)
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );

  return (
    <div className="exercise-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.exercise-wrap{padding:12px!important}.exercise-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
                <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={3} style={{ marginBottom: 8 }}>
        <FileTextOutlined style={{ marginRight: 8 }} />
        习题管理
      </Title>
      <Text type="secondary">管理课程习题</Text>

      <Card style={{ marginTop: 24, marginBottom: 24 }}>
        <Space>
          <Select
            style={{ width: 280 }}
            placeholder="选择课程"
            value={selectedCourseId || undefined}
            onChange={(val) => {
              setSelectedCourseId(val);
              setSelectedRowKeys([]);
              setSearchText("");
            }}
            loading={coursesLoading}
            options={(Array.isArray(courses) ? courses : []).map((c: any) => ({ value: c.id, label: c.title }))}
          />
          {selectedCourseId && (
            <Input
              placeholder="搜索习题标题或内容"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 240 }}
              suffix={searchText ? (
                <span
                  style={{ cursor: "pointer" }}
                  onClick={() => setSearchText("")}
                >
                  ×
                </span>
              ) : null}
            />
          )}
          {selectedCourseId && (
            <>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  resetForm();
                  setCreateModalOpen(true);
                }}
                style={canEdit ? undefined : { display: "none" }}
              >
                添加习题
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalOpen(true)}
                style={canEdit ? undefined : { display: "none" }}
              >
                导入习题
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载模板
              </Button>
            </>
          )}
        </Space>
      </Card>

      <Card>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {selectedRowKeys.length > 0 && canEdit && (
            <Popconfirm
              title={`确定删除选中的 ${selectedRowKeys.length} 道习题？`}
              onConfirm={handleBatchDelete}
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </div>
        {selectedCourseId ? (
          <>
            {console.log("[exercise] Table dataSource:", exercises, "length:", exercises?.length)}
            <Table
              className="theme-table"
              columns={columns}
              dataSource={exercises}
              rowKey="id"
              loading={exercisesLoading}
              pagination={{ pageSize: 10 }}
              rowSelection={{
                selectedRowKeys,
                onChange: (keys) => setSelectedRowKeys(keys),
              }}
            />
          </>
        ) : (
          <Empty description="请先选择课程" />
        )}
      </Card>

      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        title="添加习题"
        width={600}
        onOk={() => createMutation.mutate(formData)}
        confirmLoading={createMutation.isPending}
      >
        {renderForm()}
      </Modal>

      <Modal
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        title="编辑习题"
        width={600}
        onOk={() => selectedExercise && updateMutation.mutate({ ...formData, id: selectedExercise.id })}
        confirmLoading={updateMutation.isPending}
      >
        {renderForm()}
      </Modal>

      <Modal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        title="导入习题"
        width={500}
        footer={null}
      >
        <div style={{ padding: "20px 0" }}>
          <p style={{ marginBottom: 16 }}>
            请上传 Excel 文件导入习题，支持 .xlsx 和 .xls 格式。
          </p>
          <p style={{ marginBottom: 16, color: "#888" }}>
            提示：先点击"下载模板"获取标准格式，按模板格式填写后再导入。
          </p>
          <Upload.Dragger
            accept=".xlsx,.xls"
            beforeUpload={handleImport}
            showUploadList={false}
            disabled={importing}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">支持 .xlsx 和 .xls 格式</p>
          </Upload.Dragger>
          {importing && (
            <div style={{ marginTop: 16, textAlign: "center" }}>
              导入中，请稍候...
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
