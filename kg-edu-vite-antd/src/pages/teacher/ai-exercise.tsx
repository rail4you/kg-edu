import { useState } from "react"
import { useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Input,
  Select,
  Tag,
  List,
  Divider,
  Alert,
  Spin,
  Collapse,
  Empty,
  InputNumber,
  Tree,
  Modal,
  Form,
  Radio,
  Checkbox,
  message,
} from "antd";
import {
  HistoryOutlined,
  BookOutlined,
  BulbOutlined,
  StarOutlined,
  RocketOutlined,
  EditOutlined,
  ImportOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";

import {
  listChapters,
  getFullHierarchy,
  listExercises,
  listCourses,
  listAssignmentsForTeacher,
  updateExercise,
  type CourseResourceSchema,
  type ChapterResourceSchema,
  type ResourceResourceSchema,
} from "@/lib/ash_rpc";
import { generateAiExercise } from "@/lib/agent_api";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface FormData {
  courseId: string;
  chapterId?: string;
  knowledgeResourceId?: string;
  courseName: string;
  knowledgeName: string;
  chapterName?: string;
  exerciseType: "multiple_choice" | "essay" | "fill_in_blank" | "true_false" | "multiple_response" | "term_definition" | "case_study";
  number: number;
  difficulty: 1 | 2 | 3;
  customInput?: string;
}

// 扩展ResourceResourceSchema以包含path字段
interface ResourceWithPath extends ResourceResourceSchema {
  path?: string;
}

interface TreeNode {
  key: string;
  title: string;
  children?: TreeNode[];
  data: ResourceWithPath;
}

export default function AiExercisePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();

  const [selectedCourse, setSelectedCourse] =
    useState<CourseResourceSchema | null>(null);
  const [selectedChapter, setSelectedChapter] =
    useState<ChapterResourceSchema | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<ResourceResourceSchema | null>(null);
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [filterQuestionType, setFilterQuestionType] = useState<string | undefined>(undefined);
  const [exercisePage, setExercisePage] = useState(1);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({
    title: "",
    questionContent: "",
    questionType: "multiple_choice" as "multiple_choice" | "essay" | "fill_in_blank" | "true_false" | "multiple_response" | "term_definition" | "case_study",
    answer: "",
    choices: ["", "", "", ""],
    correctAnswer: 0,
    correctAnswers: [] as number[],
    answerExplanation: "",
  });

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      number: 1,
      exerciseType: "multiple_choice",
      difficulty: 2,
      courseName: "",
      knowledgeName: "",
      chapterName: "",
      customInput: "",
    },
  });

  const watchedCourseId = watch("courseId");

  // 获取自己创建的课程和分配给自己的课程
  const { data: myCoursesData, isLoading: myCoursesLoading } = useQuery({
    queryKey: ["my-courses", currentTenant?.schemaName, user?.id],
    queryFn: async () => {
      if (!currentTenant?.schemaName || !user) return [];
      
      const headers = getHeaders(user);
      const teacherId = user.id;
      
      // 获取自己创建的课程
      const createdCoursesResult = await listCourses({
        tenant: currentTenant.schemaName,
        fields: ["id", "title", "description", "teacherId"],
        filter: { teacherId: { eq: teacherId } },
        page: { limit: 1000, offset: 0 },
        headers,
      });
      
      const createdCourses = extractArrayData(createdCoursesResult);
      const createdCourseIds = createdCourses.map((c: any) => c.id);
      
      // 获取分配给自己的课程
      const assignedResult = await listAssignmentsForTeacher({
        tenant: currentTenant.schemaName,
        input: { teacherId },
        fields: ["id", "courseId"],
        headers,
      });
      
      const assignedCourses = extractArrayData(assignedResult);
      const assignedCourseIds = assignedCourses
        .map((a: any) => a.courseId)
        .filter(Boolean);
      
      // 合并并去重
      const allCourseIds = [...new Set([...createdCourseIds, ...assignedCourseIds])];
      
      if (allCourseIds.length === 0) return [];
      
      // 获取完整的课程信息
      const allCoursesResult = await listCourses({
        tenant: currentTenant.schemaName,
        fields: ["id", "title", "description", "teacherId"],
        filter: { id: { in: allCourseIds } },
        page: { limit: 1000, offset: 0 },
        headers,
      });
      
      return extractArrayData(allCoursesResult) as CourseResourceSchema[];
    },
    enabled: !!currentTenant?.schemaName && !!user,
  });

  const courses = myCoursesData || [];
  const coursesLoading = myCoursesLoading;

  const { data: chaptersResponse } = useQuery({
    queryKey: ["chapters", currentTenant?.schemaName, watchedCourseId],
    queryFn: () =>
      watchedCourseId
        ? listChapters({
            fields: ["id", "title", "description", "sortOrder"],
            filter: { courseId: { eq: watchedCourseId } },
            sort: "sortOrder",
            tenant: currentTenant?.schemaName || "",
            headers: getHeaders(user),
          })
        : null,
    enabled: !!watchedCourseId && !!currentTenant?.schemaName && !!user,
  });

  // 获取章节数据（使用parentChapterId构建层级）
  const { data: chaptersWithSubResponse } = useQuery({
    queryKey: ["chapters-full", currentTenant?.schemaName, watchedCourseId],
    queryFn: () =>
      watchedCourseId
        ? listChapters({
            fields: [
              "id",
              "title",
              "description",
              "sortOrder",
              "parentChapterId",
            ],
            filter: { courseId: { eq: watchedCourseId } },
            sort: "sortOrder",
            tenant: currentTenant?.schemaName || "",
            headers: getHeaders(user),
          })
        : null,
    enabled: !!watchedCourseId && !!currentTenant?.schemaName && !!user,
  });

  const { data: knowledgeResponse } = useQuery({
    queryKey: [
      "knowledge-hierarchy",
      currentTenant?.schemaName,
      watchedCourseId,
    ],
    queryFn: () =>
      watchedCourseId
        ? getFullHierarchy({
            fields: [
              "id",
              "name",
              "description",
              "knowledgeType",
              "subject",
              "unit",
              {
                childUnits: [
                  "id",
                  "name",
                  "description",
                  "knowledgeType",
                  "subject",
                  "unit",
                  {
                    childUnits: [
                      "id",
                      "name",
                      "description",
                      "knowledgeType",
                      "subject",
                      "unit",
                    ],
                  },
                  {
                    childCells: [
                      "id",
                      "name",
                      "description",
                      "knowledgeType",
                      "subject",
                      "unit",
                    ],
                  },
                ],
              },
              {
                childCells: [
                  "id",
                  "name",
                  "description",
                  "knowledgeType",
                  "subject",
                  "unit",
                ],
              },
            ],
            input: { courseId: watchedCourseId },
            tenant: currentTenant?.schemaName || "",
            headers: getHeaders(user),
          })
        : null,
    enabled: !!watchedCourseId && !!currentTenant?.schemaName && !!user,
  });

  const { data: exerciseHistoryResponse, isLoading: historyLoading } = useQuery(
    {
      queryKey: ["ai-exercises", currentTenant?.schemaName, selectedCourse?.id, filterQuestionType],
      queryFn: () => {
        const headers = getHeaders(user);
        
        const filter: any = { 
          aiType: { eq: "ai_generated" },
          courseId: { eq: selectedCourse!.id }
        };
        
        if (filterQuestionType) {
          filter.questionType = { eq: filterQuestionType };
        }
        
        return listExercises({
          fields: [
            "id",
            "title",
            "questionContent",
            "answer",
            "questionType",
            "aiType",
            "options",
            "answerExplanation",
            "insertedAt" as any,
          ],
          filter,
          sort: "-insertedAt",
          page: { limit: 50, offset: 0 },
          tenant: currentTenant?.schemaName || "",
          headers,
        });
      },
      enabled: !!selectedCourse?.id && !!currentTenant?.schemaName && !!user,
    },
  );

  const generateExerciseMutation = useMutation({
    mutationFn: (data: FormData) => {
      return generateAiExercise({
        tenant: currentTenant?.schemaName || "",
        input: {
          courseId: data.courseId,
          knowledgeName: data.knowledgeName,
          chapterName: data.chapterName,
          exerciseType: data.exerciseType,
          number: data.number,
          difficulty: data.difficulty,
        },
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ai-exercises", currentTenant?.schemaName],
      });
    },
  });

  const updateExerciseMutation = useMutation({
    mutationFn: async (data: typeof editFormData & { id: string }) => {
      const input: any = {
        title: data.title,
        questionContent: data.questionContent,
        questionType: data.questionType,
        answerExplanation: data.answerExplanation,
      };
      const isChoiceType = ["multiple_choice", "multiple_response", "true_false"].includes(data.questionType);
      if (isChoiceType) {
        input.options = JSON.stringify({
          choices: data.questionType === "true_false" ? ["A. 正确", "B. 错误"] : data.choices,
          ...(data.questionType === "multiple_response"
            ? { correctAnswers: data.correctAnswers }
            : { correctAnswer: data.correctAnswer }),
        });
        input.answer = data.questionType === "multiple_response"
          ? data.correctAnswers.map((i: number) => String.fromCharCode(65 + i)).join(",")
          : String.fromCharCode(65 + data.correctAnswer);
      } else {
        input.answer = data.answer;
      }
      const result = await updateExercise({
        tenant: currentTenant?.schemaName || "",
        primaryKey: data.id,
        input,
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ai-exercises", currentTenant?.schemaName],
      });
      message.success("更新成功");
      setEditModalOpen(false);
      setEditingExercise(null);
    },
    onError: () => {
      message.error("更新失败");
    },
  });

  const importToQuestionBankMutation = useMutation({
    mutationFn: async (exerciseId: string) => {
      const result = await updateExercise({
        tenant: currentTenant?.schemaName || "",
        primaryKey: exerciseId,
        input: { aiType: "manual_import" },
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["ai-exercises", currentTenant?.schemaName],
      });
      message.success("已导入题库");
    },
    onError: () => {
      message.error("导入题库失败");
    },
  });

  const chapters = extractArrayData(chaptersResponse);
  const chaptersWithSub = extractArrayData(chaptersWithSubResponse);
  const knowledgeResources = extractArrayData(knowledgeResponse);
  const exerciseHistoryData = exerciseHistoryResponse as any;
  const exerciseHistory = exerciseHistoryData?.results ? exerciseHistoryData.results : extractArrayData(exerciseHistoryResponse);

  // 将章节数据转换为树形结构
  // 根据parentChapterId和sortOrder构建章节树形结构
  const buildChapterTree = (chapters: ChapterResourceSchema[]): TreeNode[] => {
    if (!chapters || chapters.length === 0) return [];

    // 创建章节映射
    const chapterMap = new Map<string, ChapterResourceSchema>();
    chapters.forEach(ch => chapterMap.set(ch.id, ch));

    // 按sortOrder排序
    const sortedChapters = [...chapters].sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      return orderA - orderB;
    });

    // 获取一级章节（parentChapterId为null）
    const firstLevelChapters = sortedChapters.filter(ch => !ch.parentChapterId);

    // 递归构建子章节
    const buildChildren = (parentId: string): TreeNode[] => {
      const children = sortedChapters
        .filter(ch => ch.parentChapterId === parentId)
        .map(chapter => {
          const grandchildren = buildChildren(chapter.id);
          return {
            key: chapter.id,
            title: chapter.title,
            data: { ...chapter, knowledgeType: 'chapter' } as ResourceWithPath,
            children: grandchildren.length > 0 ? grandchildren : undefined,
          };
        });

      return children;
    };

    // 构建树
    return firstLevelChapters.map(chapter => {
      const children = buildChildren(chapter.id);
      return {
        key: chapter.id,
        title: chapter.title,
        data: { ...chapter, knowledgeType: 'chapter' } as ResourceWithPath,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  const chapterTree = buildChapterTree(chaptersWithSub);

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24, flexGrow: 1 }}>
        <Alert
          type="warning"
          message="请先选择租户才能使用AI练习生成器"
          style={{ marginBottom: 16 }}
        />
      </div>
    );
  }

  const handleCourseSelect = (course: CourseResourceSchema) => {
    setSelectedCourse(course);
    setSelectedChapter(null);
    setSelectedKnowledge(null);
    setValue("courseId", course.id);
    setValue("courseName", course.title);
    setValue("knowledgeName", "");
    setValue("chapterName", "");
    setUseCustomInput(false);
  };

  const handleChapterSelect = (chapter: ChapterResourceSchema) => {
    setSelectedChapter(chapter);
    setValue("chapterId", chapter.id);
    setValue("chapterName", chapter.title);
  };

  const handleKnowledgeSelect = (knowledge: ResourceResourceSchema) => {
    setSelectedKnowledge(knowledge);
    setValue("knowledgeResourceId", knowledge.id);
    setValue("knowledgeName", knowledge.name);
  };

  // 将API返回的层级结构转换为Tree组件需要的格式
  const convertToTreeNodes = (resources: ResourceResourceSchema[]): TreeNode[] => {
    if (!resources || resources.length === 0) return [];

    return resources.map((resource) => {
      const displayName =
        resource.subject && resource.unit
          ? `${resource.subject} - ${resource.unit}`
          : resource.name;

      const childUnits = resource.childUnits as unknown as ResourceResourceSchema[];
      const childCells = resource.childCells as unknown as ResourceResourceSchema[];

      const children: TreeNode[] = [];

      if (childUnits && childUnits.length > 0) {
        children.push(...convertToTreeNodes(childUnits));
      }
      if (childCells && childCells.length > 0) {
        children.push(...convertToTreeNodes(childCells));
      }

      return {
        key: resource.id,
        title: displayName,
        data: resource as ResourceWithPath,
        children: children.length > 0 ? children : undefined,
      };
    });
  };

  // 处理Tree节点选中
  const handleTreeSelect = (selectedKeys: React.Key[], info: { node: { data: ResourceWithPath } }) => {
    if (info.node && info.node.data) {
      handleKnowledgeSelect(info.node.data);
    }
  };

  const handleCustomInputChange = (input: string) => {
    setUseCustomInput(true);
    setValue("knowledgeName", input);
    setValue("chapterName", "");
    setSelectedChapter(null);
    setSelectedKnowledge(null);
  };

  const onSubmit = (data: FormData) => {
    generateExerciseMutation.mutate(data);
  };

  const handleEdit = (exercise: any) => {
    setEditingExercise(exercise);
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
          const ca = opts.correctAnswer;
          if (typeof ca === "string" && /^[A-D]$/i.test(ca)) {
            correctAnswer = ca.toUpperCase().charCodeAt(0) - 65;
          } else if (typeof ca === "number") {
            correctAnswer = ca;
          } else if (exercise.answer) {
            const match = exercise.answer.match(/^([A-D])[.、\s]/);
            if (match) {
              correctAnswer = match[1].charCodeAt(0) - 65;
            }
          }
          if (Array.isArray(opts.correctAnswers)) {
            correctAnswers = opts.correctAnswers;
          }
        } else if (opts && typeof opts === "object" && !Array.isArray(opts)) {
          const keys = Object.keys(opts).filter(k => k !== "correctAnswer" && k !== "correctAnswers" && k !== "answer");
          if (keys.length > 0 && keys.every(k => /^[A-D]$/i.test(k))) {
            const sortedKeys = keys.sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0));
            choices = sortedKeys.map(k => opts[k]);
            const ca = opts.correctAnswer || opts.answer;
            if (typeof ca === "string" && /^[A-D]$/i.test(ca)) {
              correctAnswer = ca.toUpperCase().charCodeAt(0) - 65;
            } else if (typeof ca === "number") {
              correctAnswer = ca;
            }
          }
        } else if (Array.isArray(opts)) {
          choices = opts;
        }
      } catch {
        // 解析失败，使用默认值
      }
    }
    setEditFormData({
      title: exercise.title,
      questionContent: exercise.questionContent,
      questionType: exercise.questionType,
      answer: exercise.answer || "",
      choices,
      correctAnswer,
      correctAnswers,
      answerExplanation: exercise.answerExplanation || "",
    });
    setEditModalOpen(true);
  };

  const renderEditForm = () => (
    <Form layout="vertical">
      <Form.Item label="标题" required>
        <Input
          value={editFormData.title}
          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
          placeholder="题目标题"
        />
      </Form.Item>
      <Form.Item label="题目内容" required>
        <TextArea
          rows={3}
          value={editFormData.questionContent}
          onChange={(e) =>
            setEditFormData({ ...editFormData, questionContent: e.target.value })
          }
          placeholder="题目内容"
        />
      </Form.Item>
      {editFormData.questionType === "multiple_choice" ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Form.Item key={i} label={`选项 ${String.fromCharCode(65 + i)}`}>
              <Input
                value={editFormData.choices[i]}
                onChange={(e) => {
                  const c = [...editFormData.choices];
                  c[i] = e.target.value;
                  setEditFormData({ ...editFormData, choices: c });
                }}
                style={{ width: "calc(100% - 60px)", marginRight: 8 }}
              />
              <Radio
                checked={editFormData.correctAnswer === i}
                onChange={() =>
                  setEditFormData({ ...editFormData, correctAnswer: i })
                }
              >
                正确
              </Radio>
            </Form.Item>
          ))}
        </>
      ) : editFormData.questionType === "multiple_response" ? (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Form.Item key={i} label={`选项 ${String.fromCharCode(65 + i)}`}>
              <Input
                value={editFormData.choices[i]}
                onChange={(e) => {
                  const c = [...editFormData.choices];
                  c[i] = e.target.value;
                  setEditFormData({ ...editFormData, choices: c });
                }}
                style={{ width: "calc(100% - 60px)", marginRight: 8 }}
              />
              <Checkbox
                checked={editFormData.correctAnswers.includes(i)}
                onChange={(e) => {
                  const ca = e.target.checked
                    ? [...editFormData.correctAnswers, i]
                    : editFormData.correctAnswers.filter((x: number) => x !== i);
                  setEditFormData({ ...editFormData, correctAnswers: ca });
                }}
              >
                正确
              </Checkbox>
            </Form.Item>
          ))}
        </>
      ) : editFormData.questionType === "true_false" ? (
        <Form.Item label="正确答案">
          <Radio.Group
            value={editFormData.correctAnswer}
            onChange={(e) =>
              setEditFormData({ ...editFormData, correctAnswer: e.target.value })
            }
          >
            <Radio value={0}>正确</Radio>
            <Radio value={1}>错误</Radio>
          </Radio.Group>
        </Form.Item>
      ) : (
        <Form.Item label="答案">
          <TextArea
            rows={editFormData.questionType === "case_study" ? 5 : 4}
            value={editFormData.answer}
            onChange={(e) =>
              setEditFormData({ ...editFormData, answer: e.target.value })
            }
            placeholder={
              editFormData.questionType === "term_definition"
                ? "请输入名词的完整解释"
                : editFormData.questionType === "case_study"
                  ? "请输入案例分析的参考答案"
                  : "参考答案"
            }
            style={{ minHeight: 100 }}
          />
        </Form.Item>
      )}
      <Form.Item 
        label="答案解析" 
        extra="可选，最多 10000 字符"
      >
        <TextArea
          rows={6}
          value={editFormData.answerExplanation}
          onChange={(e) =>
            setEditFormData({ ...editFormData, answerExplanation: e.target.value })
          }
          placeholder="请输入答案解析，帮助学生理解答案的原因"
          maxLength={10000}
          showCount
          style={{ minHeight: 150 }}
        />
      </Form.Item>
    </Form>
  );

  const renderKnowledgeNode = (
    node: ResourceResourceSchema,
    level: number = 0,
  ) => {
    const childUnitsArr = (node.childUnits ||
      []) as unknown as ResourceResourceSchema[];
    const childCellsArr = (node.childCells ||
      []) as unknown as ResourceResourceSchema[];
    const hasChildren = childUnitsArr.length > 0 || childCellsArr.length > 0;

    const displayName =
      node.subject && node.unit ? `${node.subject} - ${node.unit}` : node.name;

    if (hasChildren) {
      return (
        <div key={node.id} style={{ marginLeft: level * 16 }}>
          <Collapse
            style={{ marginBottom: 4, border: "none" }}
            bordered={false}
            size="small"
          >
            <Panel
              header={
                <div>
                  <Text strong={level === 0}>{displayName}</Text>
                  {node.description && (
                    <Text
                      type="secondary"
                      style={{ display: "block", fontSize: 12 }}
                    >
                      {node.description}
                    </Text>
                  )}
                </div>
              }
              key={node.id}
            >
              {childUnitsArr.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {childUnitsArr.map((childUnit: ResourceResourceSchema) =>
                    renderKnowledgeNode(childUnit, level + 1),
                  )}
                </div>
              )}
              {childCellsArr.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {childCellsArr.map((childCell: ResourceResourceSchema) =>
                    renderKnowledgeNode(childCell, level + 1),
                  )}
                </div>
              )}
            </Panel>
          </Collapse>
        </div>
      );
    }

    return (
      <div key={node.id} style={{ marginLeft: level * 16 }}>
        <List.Item
          style={{
            borderRadius: 4,
            marginBottom: 4,
            border:
              selectedKnowledge?.id === node.id
                ? "1px solid #1890ff"
                : "1px solid #f0f0f0",
            backgroundColor: level > 0 ? "#fafafa" : "transparent",
            padding: 8,
            cursor: "pointer",
          }}
          onClick={() => handleKnowledgeSelect(node)}
        >
          <List.Item.Meta
            title={
              <Text strong={level === 0} style={{ fontSize: 12 }}>
                {displayName}
              </Text>
            }
            description={
              node.description ? (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {node.description}
                </Text>
              ) : null
            }
          />
        </List.Item>
      </div>
    );
  };

  const subjects = knowledgeResources.filter(
    (r: ResourceResourceSchema) => r.knowledgeType === "subject",
  );

  // 将knowledgeResources转换为树形结构
  const knowledgeTree = convertToTreeNodes(knowledgeResources);

  const questionTypeMap: Record<string, string> = {
    multiple_choice: "单选题",
    multiple_response: "多选题",
    true_false: "判断题",
    fill_in_blank: "填空题",
    essay: "问答题",
    term_definition: "名词解释",
    case_study: "案例题",
  };

  return (
    <div className="ai-exercise-wrap" style={{ flexGrow: 1, padding: 24 }}>
<style>{`@media(max-width:768px){.ai-exercise-wrap{padding:12px!important}.ai-exercise-wrap>div:last-child{flex-direction:column!important;height:auto!important}.ai-exercise-wrap .ant-card{height:auto!important;min-height:auto!important}.ai-exercise-wrap .ant-select{width:100%!important}.ai-exercise-wrap .exercise-title-row{flex-direction:column!important;align-items:stretch!important;gap:8px!important}.ai-exercise-wrap .exercise-title-row .ant-btn{font-size:12px!important;padding:2px 8px!important}}`}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <Title
          level={4}
          style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}
        >
          <StarOutlined />
          AI 练习生成器
        </Title>
        <Tag color="blue">
          当前组织: {currentTenant.name}
        </Tag>
      </div>

      <div style={{ display: "flex", gap: 24, height: "calc(100vh - 160px)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
            styles={{ body: { flexGrow: 1, overflow: "auto" } }}
          >
            <Title
              level={5}
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <RocketOutlined />
              课程选择
            </Title>

            <div style={{ marginBottom: 24 }}>
              <Text
                style={{ marginBottom: 8, display: "block", fontWeight: 500 }}
              >
                选择课程
              </Text>
              {coursesLoading ? (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    padding: 16,
                  }}
                >
                  <Spin />
                </div>
              ) : courses.length === 0 ? (
                <Empty description="暂无可用课程" />
              ) : (
                <Select
                  style={{ width: "100%", marginBottom: 16 }}
                  placeholder="请选择课程..."
                  value={selectedCourse?.id || undefined}
                  onChange={(value) => {
                    const course = courses.find(
                      (c: CourseResourceSchema) => c.id === value,
                    );
                    if (course) handleCourseSelect(course);
                  }}
                  options={courses.map((course: CourseResourceSchema) => ({
                    value: course.id,
                    label: course.title,
                  }))}
                />
              )}
            </div>

            {selectedCourse && (
              <>
                <Divider style={{ margin: "16px 0" }} />

                {Array.isArray(chapters) && chapters.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <Title
                      level={5}
                      style={{
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#1890ff",
                      }}
                    >
                      <BookOutlined />
                      章节选择
                    </Title>
                    {chapterTree.length > 0 ? (
                      <Tree
                        treeData={chapterTree}
                        onSelect={(selectedKeys, info) => {
                          if (info.node && info.node.data) {
                            const chapterData = info.node.data as unknown as ChapterResourceSchema;
                            handleChapterSelect(chapterData);
                          }
                        }}
                        selectedKeys={selectedChapter ? [selectedChapter.id] : []}
                        defaultExpandLevel={1}
                        style={{ marginBottom: 8 }}
                      />
                    ) : (
                      <Text type="secondary">暂无章节数据</Text>
                    )}
                  </div>
                )}

                {subjects.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    <Title
                      level={5}
                      style={{
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#722ed1",
                      }}
                    >
                      <BulbOutlined />
                      知识体系选择
                    </Title>
                    {knowledgeTree.length > 0 ? (
                      <Tree
                        treeData={knowledgeTree}
                        onSelect={handleTreeSelect}
                        selectedKeys={selectedKnowledge ? [selectedKnowledge.id] : []}
                        defaultExpandLevel={1}
                        style={{ marginBottom: 8 }}
                      />
                    ) : (
                      <Text type="secondary">暂无知识体系数据</Text>
                    )}
                  </div>
                )}

                {((!Array.isArray(chapters) || chapters.length === 0) &&
                  subjects.length === 0) ||
                useCustomInput ? (
                  <div style={{ marginBottom: 24 }}>
                    <Title
                      level={5}
                      style={{
                        marginBottom: 16,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        color: "#faad14",
                      }}
                    >
                      <StarOutlined />
                      自定义内容
                    </Title>
                    <Text
                      type="secondary"
                      style={{ marginBottom: 8, display: "block" }}
                    >
                      未找到章节或知识项目，请描述课程内容：
                    </Text>
                    <Controller
                      name="customInput"
                      control={control}
                      render={({ field }) => (
                        <TextArea
                          {...field}
                          rows={3}
                          placeholder="请描述课程内容、主题或特定知识领域..."
                          onChange={(e) =>
                            handleCustomInputChange(e.target.value)
                          }
                        />
                      )}
                    />
                  </div>
                ) : null}

                <div style={{ marginBottom: 24 }}>
                  <Title
                    level={5}
                    style={{
                      marginBottom: 16,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: "#52c41a",
                    }}
                  >
                    <StarOutlined />
                    练习设置
                  </Title>

                  <Controller
                    name="exerciseType"
                    control={control}
                    render={({ field }) => (
                      <div style={{ marginBottom: 16 }}>
                        <Text style={{ marginBottom: 8, display: "block" }}>
                          练习类型
                        </Text>
                        <Select
                          {...field}
                          style={{ width: "100%" }}
                          options={[
                            { value: "multiple_choice", label: "单选题" },
                            { value: "multiple_response", label: "多选题" },
                            { value: "true_false", label: "判断题" },
                            { value: "fill_in_blank", label: "填空题" },
                            { value: "essay", label: "问答题" },
                            { value: "term_definition", label: "名词解释" },
                            { value: "case_study", label: "案例题" },
                          ]}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name="difficulty"
                    control={control}
                    render={({ field }) => (
                      <div style={{ marginBottom: 16 }}>
                        <Text style={{ marginBottom: 8, display: "block" }}>
                          难度
                        </Text>
                        <Select
                          {...field}
                          style={{ width: "100%" }}
                          options={[
                            { value: 1, label: "容易" },
                            { value: 2, label: "中等" },
                            { value: 3, label: "困难" },
                          ]}
                        />
                      </div>
                    )}
                  />

                  <Controller
                    name="number"
                    control={control}
                    rules={{ min: 1, max: 10 }}
                    render={({ field }) => (
                      <div style={{ marginBottom: 16 }}>
                        <Text style={{ marginBottom: 8, display: "block" }}>
                          练习数量
                        </Text>
                        <InputNumber
                          {...field}
                          style={{ width: "100%" }}
                          min={1}
                          max={10}
                          status={errors.number ? "error" : undefined}
                        />
                        {errors.number && (
                          <Text type="danger">请输入1-10之间的数字</Text>
                        )}
                      </div>
                    )}
                  />

                  <Button
                    type="primary"
                    icon={<StarOutlined />}
                    onClick={handleSubmit(onSubmit)}
                    disabled={
                      generateExerciseMutation.isPending ||
                      !watch("knowledgeName")
                    }
                    loading={generateExerciseMutation.isPending}
                    block
                    style={canEdit ? undefined : { display: "none" }}
                  >
                    {generateExerciseMutation.isPending
                      ? "生成中..."
                      : "生成练习题"}
                  </Button>

                  {generateExerciseMutation.error && (
                    <Alert
                      type="error"
                      message="生成练习题失败，请重试。"
                      style={{ marginTop: 16 }}
                    />
                  )}

                  {generateExerciseMutation.data &&
                    generateExerciseMutation.data.success && (
                      <Alert
                        type="success"
                        message={
                          generateExerciseMutation.data.message ||
                          "成功生成AI练习题"
                        }
                        style={{ marginTop: 16 }}
                      />
                    )}
                </div>
              </>
            )}
          </Card>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Card
            style={{ height: "100%", display: "flex", flexDirection: "column" }}
            styles={{ body: { flexGrow: 1, overflow: "auto" } }}
          >
            <Title
              level={5}
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <HistoryOutlined />
              最近的AI练习
            </Title>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Select
                style={{ width: 140 }}
                placeholder="题目类型"
                allowClear
                value={filterQuestionType}
                onChange={setFilterQuestionType}
                options={[
                  { value: "multiple_choice", label: "单选题" },
                  { value: "multiple_response", label: "多选题" },
                  { value: "true_false", label: "判断题" },
                  { value: "fill_in_blank", label: "填空题" },
                  { value: "essay", label: "问答题" },
                  { value: "term_definition", label: "名词解释" },
                  { value: "case_study", label: "案例题" },
                ]}
              />
            </div>

            {!selectedCourse ? (
              <Empty description="请选择课程以查看练习历史" />
            ) : historyLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <Spin />
              </div>
            ) : exerciseHistory.length === 0 ? (
              <Empty description="暂无练习，生成一些AI练习题后将在此显示" />
            ) : (
              <List
                dataSource={exerciseHistory}
                pagination={{
                  current: exercisePage,
                  pageSize: 5,
                  total: exerciseHistory.length,
                  onChange: setExercisePage,
                  showSizeChanger: false,
                  showTotal: (total) => `共 ${total} 道练习题`,
                }}
                renderItem={(exercise: any) => (
                  <Card
                    key={exercise.id}
                    style={{ marginBottom: 16 }}
                    size="small"
                  >
                    <div
                      className="exercise-title-row"
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 8,
                      }}
                    >
                      <Text strong>{exercise.title}</Text>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <ReadonlyActionButton
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleEdit(exercise)}
                        >
                          编辑
                        </ReadonlyActionButton>
                        <ReadonlyActionButton
                          type="link"
                          size="small"
                          icon={<ImportOutlined />}
                          loading={importToQuestionBankMutation.isPending}
                          onClick={() => importToQuestionBankMutation.mutate(exercise.id)}
                        >
                          导入题库
                        </ReadonlyActionButton>
                        <Tag color="blue">
                          {questionTypeMap[exercise.questionType] ||
                            exercise.questionType?.replace("_", " ") ||
                            "未知"}
                        </Tag>
                      </div>
                    </div>

                    <Text style={{ display: "block", marginBottom: 8 }}>
                      {exercise.questionContent}
                    </Text>

                    {["multiple_choice", "multiple_response", "true_false"].includes(exercise.questionType) &&
                      exercise.options && (
                        <div style={{ marginTop: 8, marginBottom: 8 }}>
                          <Text type="secondary" strong>
                            选项：
                          </Text>
                          <div style={{ marginTop: 4 }}>
                            {(() => {
                              try {
                                let options;
                                if (typeof exercise.options === "string") {
                                  options = JSON.parse(exercise.options);
                                } else {
                                  options = exercise.options;
                                }

                                if (
                                  options.choices &&
                                  Array.isArray(options.choices)
                                ) {
                                  const isTrueFalse = exercise.questionType === "true_false";
                                  return options.choices.map(
                                    (choice: string, idx: number) => (
                                      <Text
                                        key={choice}
                                        style={{
                                          display: "block",
                                          marginLeft: 8,
                                          marginBottom: 4,
                                        }}
                                      >
                                        {isTrueFalse
                                          ? choice.replace(/^[A-Z]\.\s*/i, '')
                                          : choice}
                                      </Text>
                                    ),
                                  );
                                } else if (
                                  typeof options === "object" &&
                                  !Array.isArray(options)
                                ) {
                                  return Object.entries(options).map(
                                    ([key, value]) => (
                                      <Text
                                        key={key}
                                        style={{
                                          display: "block",
                                          marginLeft: 8,
                                          marginBottom: 4,
                                        }}
                                      >
                                        {key}.{" "}
                                        {String(value).replace(
                                          /^choices\.?\s*/i,
                                          "",
                                        )}
                                      </Text>
                                    ),
                                  );
                                } else if (Array.isArray(options)) {
                                  return options.map((option, index) => (
                                    <Text
                                      key={index}
                                      style={{
                                        display: "block",
                                        marginLeft: 8,
                                        marginBottom: 4,
                                      }}
                                    >
                                      {String.fromCharCode(65 + index)}.{" "}
                                      {String(option).replace(
                                        /^choices\.?\s*/i,
                                        "",
                                      )}
                                    </Text>
                                  ));
                                }
                                return null;
                              } catch (e) {
                                return (
                                  <Text
                                    style={{ marginLeft: 8, color: "#999" }}
                                  >
                                    {exercise.options}
                                  </Text>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      )}

                    {exercise.answer && (
                      <Collapse style={{ marginTop: 8 }} size="small">
                        <Panel
                          header={<Text type="secondary">查看答案</Text>}
                          key="answer"
                        >
                          <Text>{exercise.questionType === "true_false"
                            ? (exercise.answer?.toUpperCase() === 'A' ? '正确' : exercise.answer?.toUpperCase() === 'B' ? '错误' : exercise.answer)
                            : exercise.answer}</Text>
                        </Panel>
                      </Collapse>
                    )}

                    {exercise.answerExplanation && (
                      <Collapse style={{ marginTop: 8 }} size="small">
                        <Panel
                          header={<Text type="secondary">查看答案解析</Text>}
                          key="explanation"
                        >
                          <div style={{ 
                            whiteSpace: "pre-wrap", 
                            color: "#1890ff",
                            padding: 8,
                            background: "#f0f5ff",
                            borderRadius: 4,
                          }}>
                            {exercise.answerExplanation}
                          </div>
                        </Panel>
                      </Collapse>
                    )}
                  </Card>
                )}
              />
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingExercise(null);
        }}
        title="编辑习题"
        width={700}
        onOk={() => editingExercise && updateExerciseMutation.mutate({ ...editFormData, id: editingExercise.id })}
        confirmLoading={updateExerciseMutation.isPending}
      >
        {renderEditForm()}
      </Modal>
    </div>
  );
}
