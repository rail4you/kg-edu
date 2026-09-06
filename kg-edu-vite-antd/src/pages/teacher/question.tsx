import * as React from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
  Button,
  Input,
  Tag,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Alert,
  message,
  Form,
  Popconfirm,
  Upload,
  Empty,
  Tree,
  Tooltip,
  App,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  UploadOutlined,
  DownloadOutlined,
  MoreOutlined,
  FileTextOutlined,
  SettingOutlined,
  BookOutlined,
  SearchOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import ActionDropdown from "@/components/ActionDropdown";
import { QuestionLevelConfigModal } from "@/components/QuestionLevelConfigModal";
import {
  listQuestions,
  createQuestion,
  updateQuestion,
  destroyQuestion,
  createConnection,
  listConnections,
  destroyConnection,
  getFileTemplateBySection,
  importQuestionsFromXlsx,
  moveQuestionUp,
  moveQuestionDown,
  buildCSRFHeaders,
  type QuestionResourceSchema,
  type CreateQuestionInput,
  type CourseResourceSchema,
  type QuestionConnectionResourceSchema,
  type CreateConnectionInput,
  type ImportQuestionsFromXlsxInput,
  type ResourceResourceSchema,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import { useQuestionLevelConfig } from "@/hooks/use-question-level-config";

const { Title, Text } = Typography;
const { TextArea } = Input;

const CONNECTION_TYPE_LABELS = {
  hierarchy: "层级关系",
  dependency: "依赖关系",
  related: "相关关系",
} as const;

interface QuestionFormData {
  title: string;
  description?: string;
  questionLevel: "global" | "concept" | "method";
  position?: number;
  courseId?: string;
  knowledgeResourceId?: string;
  difficulty?: number;
}

interface ConnectionFormData {
  sourceQuestionId: string;
  targetQuestionIds: string[];
  courseId: string;
  connectionType?: "hierarchy" | "dependency" | "related";
}

interface KnowledgeTreeItem {
  id: string;
  key: string;
  label: string;
  title: string;
  children?: KnowledgeTreeItem[];
  knowledgeData?: any;
}

interface KnowledgeTreeSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  treeData: KnowledgeTreeItem[];
  placeholder?: string;
}

function KnowledgeTreeSelect({
  value,
  onChange,
  treeData,
  placeholder = "选择知识点",
}: KnowledgeTreeSelectProps) {
  const [searchValue, setSearchValue] = React.useState("");
  const [expandedKeys, setExpandedKeys] = React.useState<React.Key[]>([]);
  const [autoExpanded, setAutoExpanded] = React.useState(true);

  React.useEffect(() => {
    setExpandedKeys([]);
    setAutoExpanded(true);
  }, [treeData]);

  const allKeys = React.useMemo(() => {
    const getKeys = (nodes: KnowledgeTreeItem[]): React.Key[] => {
      const keys: React.Key[] = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys.push(...getKeys(node.children));
        }
      });
      return keys;
    };
    return getKeys(treeData);
  }, [treeData]);

  const filterTree = (
    nodes: KnowledgeTreeItem[],
    search: string,
  ): KnowledgeTreeItem[] => {
    if (!search) return nodes;
    const searchLower = search.toLowerCase();
    return nodes
      .map((node) => {
        const label = node.label || node.title?.toString() || "";
        const match = label.toLowerCase().includes(searchLower);
        const filteredChildren = node.children
          ? filterTree(node.children, search)
          : undefined;
        if (match || (filteredChildren && filteredChildren.length > 0)) {
          return {
            ...node,
            children: filteredChildren,
          } as KnowledgeTreeItem;
        }
        return null;
      })
      .filter((node): node is KnowledgeTreeItem => node !== null);
  };

  const filteredItems = React.useMemo(
    () => filterTree(treeData, searchValue),
    [treeData, searchValue],
  );

  const effectiveExpandedKeys = React.useMemo(() => {
    if (searchValue) {
      return allKeys;
    }
    if (expandedKeys.length > 0) {
      return expandedKeys;
    }
    if (autoExpanded && treeData.length > 0) {
      return allKeys;
    }
    return [];
  }, [searchValue, expandedKeys, autoExpanded, treeData, allKeys]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (val) {
      setAutoExpanded(true);
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
    setAutoExpanded(false);
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (!selectedKeys.length) return;
    const itemId = selectedKeys[0] as string;
    if (onChange) {
      onChange(itemId);
    }
  };

  return (
    <div>
      <Input
        placeholder={placeholder}
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={handleSearchChange}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <div style={{
        border: "1px solid #d9d9d9",
        borderRadius: 4,
        maxHeight: 300,
        overflow: "auto",
        padding: 8,
      }}>
        {filteredItems.length > 0 ? (
          <Tree
            showIcon
            expandedKeys={effectiveExpandedKeys}
            onExpand={handleExpand}
            selectedKeys={value ? [value] : []}
            onSelect={handleSelect}
            treeData={filteredItems}
          />
        ) : (
          <Empty description="暂无知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </div>
  );
}

export default function TeacherQuestion() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  // React 19 下 antd 静态 message/Modal.confirm 可能失效，统一使用 App 上下文
  const { message, modal } = App.useApp();

  // 本地状态管理课程选择
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | undefined>(undefined);

  const handleCourseChange = (courseId: string | undefined) => {
    setSelectedCourseId(courseId);
  };

  const [createQuestionModalOpen, setCreateQuestionModalOpen] =
    React.useState(false);
  const [editQuestionModalOpen, setEditQuestionModalOpen] =
    React.useState(false);
  const [createConnectionModalOpen, setCreateConnectionModalOpen] =
    React.useState(false);
  const [editConnectionModalOpen, setEditConnectionModalOpen] =
    React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedQuestion, setSelectedQuestion] =
    React.useState<QuestionResourceSchema | null>(null);
  const [selectedConnection, setSelectedConnection] =
    React.useState<QuestionConnectionResourceSchema | null>(null);

  // 在 selectedCourseId 声明之后调用 hook
  const { getLabel, shouldSeed, seedDefaults, isSeeding } = useQuestionLevelConfig(selectedCourseId);
  const [tabValue, setTabValue] = React.useState("questions");
  const [importResultModalOpen, setImportResultModalOpen] =
    React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    successCount: number;
    skippedCount: number;
    errorCount: number;
    skipped: Array<{ title: string; reason: string }>;
    errors: Array<{ title: string; reason: string }>;
  } | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = React.useState<string[]>([]);
  const [batchDeleteModalOpen, setBatchDeleteModalOpen] = React.useState(false);
  const [configModalOpen, setConfigModalOpen] = React.useState(false);

  const [questionForm] = Form.useForm<QuestionFormData>();
  const [connectionForm] = Form.useForm<ConnectionFormData>();

  const tenant = currentTenant?.schemaName || "";
  const userId = (user as any)?.id || (user as any)?.actorId;

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: ["questions", tenant, selectedCourseId],
    queryFn: async () => {
      const filter = selectedCourseId
        ? { courseId: { eq: selectedCourseId } }
        : undefined;

      const result = await listQuestions({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "questionLevel",
          "position",
          "tags",
          "courseId",
          "createdById",
          "knowledgeResourceId",
          { knowledgeResource: ["id", "name", "subject"] },
        ],
        filter,
        sort: "position",
        page: { limit: 100 },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to fetch questions",
        );
      }
      return result.data;
    },
    enabled:
      !!tenant && !!user && (!!selectedCourseId || selectedCourseId === ""),
  });

  // 使用统一的课程获取 hook
  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  // 自动选择第一个课程
  React.useEffect(() => {
    const courses = Array.isArray(coursesData) ? coursesData : [];
    if (courses.length > 0 && !selectedCourseId) {
      handleCourseChange(courses[0].id);
    }
  }, [coursesData, selectedCourseId]);

  // 当课程变化时，自动创建默认层级配置
  React.useEffect(() => {
    if (shouldSeed && selectedCourseId) {
      seedDefaults();
    }
  }, [shouldSeed, selectedCourseId, seedDefaults]);

  const { data: hierarchyData = [] } = useQuery({
    queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${tenant}`,
        { headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
      }
      const result = await response.json();
      if (result && typeof result === "object" && Array.isArray(result.data)) {
        return result.data;
      } else if (Array.isArray(result)) {
        return result;
      }
      return [];
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const knowledgeTreeData = React.useMemo(() => {
    if (!hierarchyData || hierarchyData.length === 0) return [];

    const globalSeenIds = new Set<string>();

    const convertToTree = (node: any): KnowledgeTreeItem | null => {
      if (!node.id || globalSeenIds.has(node.id)) {
        return null;
      }
      globalSeenIds.add(node.id);

      const childArrays = [
        node.childUnits,
        node.directCells,
        node.subjectCells,
        node.childCells,
        node.nestedChildCells,
      ];

      const children: KnowledgeTreeItem[] = [];
      childArrays.forEach((arr) => {
        if (Array.isArray(arr)) {
          arr.forEach((child: any) => {
            const childNode = convertToTree(child);
            if (childNode) {
              children.push(childNode);
            }
          });
        }
      });

      return {
        id: node.id,
        key: node.id,
        label: node.name,
        title: node.name,
        children: children.length > 0 ? children : undefined,
        knowledgeData: node,
        icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
      };
    };

    const treeItems = hierarchyData
      .map((node: any) => convertToTree(node))
      .filter((item): item is KnowledgeTreeItem => item !== null);
    return treeItems;
  }, [hierarchyData]);

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: ["connections", tenant, selectedCourseId],
    queryFn: async () => {
      const filter = selectedCourseId
        ? { courseId: { eq: selectedCourseId } }
        : undefined;

      const result = await listConnections({
        tenant,
        fields: [
          "id",
          "connectionType",
          "sourceQuestionId",
          "targetQuestionId",
          "courseId",
          "createdById",
          { sourceQuestion: ["id", "title", "description"] },
          { targetQuestion: ["id", "title", "description"] },
        ],
        filter,
        page: { limit: 100 },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to fetch connections",
        );
      }
      return result.data;
    },
    enabled: !!tenant && !!user && !!selectedCourseId,
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (input: CreateQuestionInput) => {
      const result = await createQuestion({
        tenant,
        input,
        fields: [
          "id",
          "title",
          "questionLevel",
          "description",
          "position",
          "courseId",
          "createdById",
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to create question",
        );
      }
      return result.data;
    },
    onSuccess: () => {
      message.success("问题创建成功！");
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
      setCreateQuestionModalOpen(false);
      questionForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败，请重试");
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      const result = await updateQuestion({
        tenant,
        primaryKey: id,
        input,
        fields: [
          "id",
          "title",
          "questionLevel",
          "description",
          "position",
          "tags",
          "courseId",
          "createdById",
          "knowledgeResourceId",
          { knowledgeResource: ["id", "name", "subject"] },
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to update question",
        );
      }
      return result.data;
    },
    onSuccess: () => {
      message.success("问题更新成功！");
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
      setEditQuestionModalOpen(false);
      setSelectedQuestion(null);
      questionForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败，请重试");
    },
  });

  const deleteQuestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyQuestion({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to delete question",
        );
      }
      return result.data;
    },
    onSuccess: () => {
      message.success("问题删除成功！");
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败，请重试");
    },
  });

  // 上移问题
  const moveUpMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await moveQuestionUp({
        tenant,
        primaryKey: id,
        fields: ["id"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) throw new Error("Failed to move up");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
      message.success("上移成功");
    },
    onError: () => {
      message.error("上移失败");
    },
  });

  // 下移问题
  const moveDownMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await moveQuestionDown({
        tenant,
        primaryKey: id,
        fields: ["id"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) throw new Error("Failed to move down");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
      message.success("下移成功");
    },
    onError: () => {
      message.error("下移失败");
    },
  });

  const createConnectionMutation = useMutation({
    mutationFn: async (input: CreateConnectionInput) => {
      const result = await createConnection({
        tenant,
        input,
        fields: ["id", "connectionType", "createdById"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to create connection",
        );
      }
      return result.data;
    },
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyConnection({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to delete connection",
        );
      }
      return result.data;
    },
    onSuccess: () => {
      message.success("问题关联删除成功！");
      queryClient.invalidateQueries({ queryKey: ["connections"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除关联失败，请重试");
    },
  });

  const importQuestionsMutation = useMutation({
    mutationFn: async (input: ImportQuestionsFromXlsxInput) => {
      const result = await importQuestionsFromXlsx({
        tenant,
        input,
      });
      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to import questions",
        );
      }
      return result.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["questions", tenant] });
      setImportModalOpen(false);
      setSelectedFile(null);
      // 显示导入结果
      setImportResult({
        successCount: data?.successCount || 0,
        skippedCount: data?.skippedCount || 0,
        errorCount: data?.errorCount || 0,
        skipped: data?.skipped || [],
        errors: data?.errors || [],
      });
      setImportResultModalOpen(true);
    },
    onError: (error: any) => {
      message.error(error?.message || "导入失败，请重试");
    },
  });

  const questions = extractArrayData(questionsData);
  const connections = extractArrayData(connectionsData);
  const courses = extractArrayData(coursesData);

  if (!currentTenant?.schemaName) {
    return (
      <div className="question-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.question-wrap{padding:12px!important}.question-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Alert
          type="warning"
          message="未选择租户或租户配置不完整"
          description="请先选择一个租户（组织）才能管理问题资源。如果已选择租户但仍显示此消息，请联系管理员确保租户配置了正确的数据库模式。"
          showIcon
        />
      </div>
    );
  }

  const handleCreateQuestion = async (values: QuestionFormData) => {
    const courseId = selectedCourseId || values.courseId;
    if (!courseId) {
      message.warning("请先选择一个课程再创建问题");
      return;
    }

    // 生成随机标题用于数据库约束
    const randomTitle = `问题_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await createQuestionMutation.mutateAsync({
      title: randomTitle,
      description: values.description || null,
      questionLevel: values.questionLevel,
      position: values.position || 0,
      courseId,
      tags: undefined,
      createdById: userId,
    });
  };

  const handleUpdateQuestion = async (values: QuestionFormData) => {
    if (!selectedQuestion) return;

    const processedData: any = {
      // 保持原有 title 不变
      title: selectedQuestion.title,
      description: values.description || null,
      questionLevel: values.questionLevel,
      position: values.position || 0,
      courseId: values.courseId,
    };

    if (values.knowledgeResourceId) {
      processedData.knowledgeResourceId = values.knowledgeResourceId;
    }

    await updateQuestionMutation.mutateAsync({
      id: selectedQuestion.id,
      input: processedData,
    });
  };

  const handleCreateConnection = async (values: ConnectionFormData) => {
    const connectionType = values.connectionType || "hierarchy";
    const courseId = selectedCourseId || values.courseId;
    if (!courseId) {
      message.warning("请先选择课程后再创建关联");
      return;
    }

    // 排除已存在关联的目标问题，避免重复创建
    const existingTargets = connectedTargetIdsFor(values.sourceQuestionId);
    const dupTargets = values.targetQuestionIds.filter((id) => existingTargets.has(id));
    const validTargets = values.targetQuestionIds.filter((id) => !existingTargets.has(id));
    if (dupTargets.length > 0) {
      message.warning(`已存在 ${dupTargets.length} 个关联（已跳过），继续创建 ${validTargets.length} 个`);
      if (validTargets.length === 0) return;
      values.targetQuestionIds = validTargets;
    }

    let successCount = 0;
    let failCount = 0;

    for (const targetQuestionId of values.targetQuestionIds) {
      try {
        await createConnectionMutation.mutateAsync({
          sourceQuestionId: values.sourceQuestionId,
          targetQuestionId,
          courseId,
          connectionType,
          createdById: userId,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      setCreateConnectionModalOpen(false);
      connectionForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["connections"] });
      if (failCount > 0) {
        message.warning(`成功创建 ${successCount} 个关联，${failCount} 个失败`);
      } else {
        message.success(`成功创建 ${successCount} 个问题关联！`);
      }
    } else {
      message.error("创建关联失败，请重试");
    }
  };

  const handleUpdateConnection = async (values: ConnectionFormData) => {
    if (!selectedConnection) return;

    await destroyConnection({
      tenant,
      primaryKey: selectedConnection.id,
      headers: getAuthHeaders(user) as Record<string, string>,
    });

    const targetQuestionId = values.targetQuestionIds?.[0] || "";
    const courseId = values.courseId || selectedConnection.courseId;
    if (!courseId) {
      message.warning("关联缺少课程信息，请选择课程后重试");
      return;
    }
    await createConnectionMutation.mutateAsync({
      sourceQuestionId: values.sourceQuestionId,
      targetQuestionId,
      courseId,
      connectionType: values.connectionType,
      createdById: userId,
    });
    setEditConnectionModalOpen(false);
    setSelectedConnection(null);
    connectionForm.resetFields();
    queryClient.invalidateQueries({ queryKey: ["connections"] });
    message.success("问题关联更新成功！");
  };

  const handleEditQuestion = (question: any) => {
    setSelectedQuestion(question);
    if (question.courseId) {
      handleCourseChange(question.courseId);
    }
    questionForm.setFieldsValue({
      title: question.title,
      description: question.description || "",
      questionLevel: question.questionLevel || "global",
      position: question.position || 0,
      courseId: question.courseId || "",
      knowledgeResourceId: question.knowledgeResourceId || "",
    });
    setEditQuestionModalOpen(true);
  };

  const handleEditConnection = (connection: any) => {
    setSelectedConnection(connection);
    connectionForm.setFieldsValue({
      sourceQuestionId: connection.sourceQuestionId,
      targetQuestionIds: connection.targetQuestionId
        ? [connection.targetQuestionId]
        : [],
      courseId: connection.courseId,
      connectionType: connection.connectionType || "hierarchy",
    });
    setEditConnectionModalOpen(true);
  };

  const getQuestionLevelLabel = (level: string) => {
    return getLabel(level);
  };

  // 给定源问题，返回已存在关联的目标问题 id 集合（编辑时排除当前连接本身）
  const connectedTargetIdsFor = (sourceId: string | undefined): Set<string> => {
    if (!sourceId) return new Set();
    const currentId = selectedConnection?.id;
    return new Set(
      connections
        .filter((c) => c.sourceQuestionId === sourceId && c.id !== currentId)
        .map((c) => c.targetQuestionId),
    );
  };

  const renderGroupedQuestionOptions = (
    questionList: QuestionResourceSchema[],
    excludeId?: string,
    excludeIds?: Set<string>
  ) => {
    const groups: { key: string; label: string; questions: QuestionResourceSchema[] }[] = [
      { key: "global", label: getLabel("global"), questions: [] },
      { key: "concept", label: getLabel("concept"), questions: [] },
      { key: "method", label: getLabel("method"), questions: [] },
    ];
    questionList
      .filter(
        (q) =>
          (!excludeId || q.id !== excludeId) &&
          (!excludeIds || !excludeIds.has(q.id))
      )
      .forEach((q) => {
        const group = groups.find((g) => g.key === q.questionLevel);
        if (group) {
          group.questions.push(q);
        } else {
          groups[0].questions.push(q);
        }
      });
    return groups
      .filter((g) => g.questions.length > 0)
      .map((g) => (
        <Select.OptGroup key={g.key} label={g.label}>
          {g.questions.map((q) => (
            <Select.Option key={q.id} value={q.id}>
              {truncateQuestionText(q.description || q.title)}
            </Select.Option>
          ))}
        </Select.OptGroup>
      ));
  };

  // 问题标题为自动生成的占位名，选择列表优先展示描述；过长截断
  const truncateQuestionText = (text: string, maxLength = 48) => {
    const trimmed = (text || "").trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}…`;
  };

  const getQuestionLevelColor = (level: string): string => {
    const colors: Record<string, string> = {
      global: "blue",
      concept: "green",
      method: "orange",
    };
    return colors[level] || "default";
  };

  const getConnectionTypeLabel = (type: string) => {
    return (
      CONNECTION_TYPE_LABELS[type as keyof typeof CONNECTION_TYPE_LABELS] ||
      type
    );
  };

  const getConnectionTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      hierarchy: "blue",
      dependency: "orange",
      related: "cyan",
    };
    return colors[type] || "default";
  };

  const getQuestionTitleById = (questionId: string) => {
    const question = questions.find((q: any) => q.id === questionId);
    return question?.description || question?.title || "(未知问题)";
  };

  const getCourseTitleById = (courseId: string) => {
    const course = courses.find((c: any) => c.id === courseId);
    return course?.title || courseId;
  };

  const handleBatchDelete = async () => {
    const successIds: string[] = [];
    const failedIds: string[] = [];

    for (const id of selectedQuestionIds) {
      try {
        await deleteQuestionMutation.mutateAsync(id);
        successIds.push(id);
      } catch (error) {
        failedIds.push(id);
      }
    }

    setSelectedQuestionIds([]);
    setBatchDeleteModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ["questions", tenant] });

    if (failedIds.length === 0) {
      message.success(`成功删除 ${successIds.length} 个问题`);
    } else {
      message.warning(`删除完成：成功 ${successIds.length} 个，失败 ${failedIds.length} 个`);
    }
  };

  const handleFileSelect = (file: File) => {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    if (fileExtension !== "xlsx") {
      message.error("请选择 XLSX 格式的文件");
      return false;
    }
    setSelectedFile(file);
    return false;
  };

  const handleImportSubmit = async () => {
    if (!selectedFile) {
      message.warning("请选择要导入的文件");
      return;
    }

    if (!selectedCourseId) {
      message.warning("请先选择一个课程再导入问题");
      return;
    }

    try {
      const base64String = await fileToBase64(selectedFile);
      const attributes = ["title", "title_summary", "description", "position"];

      await importQuestionsMutation.mutateAsync({
        excelFile: base64String,
        courseId: selectedCourseId,
        attributes,
      });
    } catch (error) {
      message.error("导入失败，请重试");
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64String = base64.split(",")[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleDownloadTemplate = async () => {
    try {
      const result = await getFileTemplateBySection({
        input: { section: "knowledge_question" },
        fields: ["id", "section", "filePath"],
        headers: {
          ...getAuthHeaders(user),
          "x-tenant": tenant,
        } as Record<string, string>,
      });

      if (result.success && result.data?.filePath) {
        const link = document.createElement("a");
        link.href = result.data.filePath;
        link.download = "knowledge_question_template.xlsx";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (
        result.errors?.[0]?.type === "not_found" ||
        result.errors?.[0]?.message?.includes("record not found")
      ) {
        message.warning(
          "暂未配置模板文件，请联系管理员上传模板后再试",
        );
      } else {
        message.error("下载模板失败，请稍后重试");
      }
    } catch (error) {
      message.error("下载模板失败，请稍后重试");
    }
  };

  const questionColumns: ColumnsType<any> = [
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: "30%",
      ellipsis: true,
      align: "left" as const,
      render: (text: string) => (
        <div style={{ textAlign: "left" }}>{text || "无描述"}</div>
      ),
    },
    {
      title: "问题分类",
      dataIndex: "questionLevel",
      key: "questionLevel",
      width: 90,
      align: "center" as const,
      render: (level: string) => (
        <Tag color={getQuestionLevelColor(level)}>
          {getQuestionLevelLabel(level)}
        </Tag>
      ),
    },
    {
      title: "关联知识点",
      dataIndex: "knowledgeResource",
      key: "knowledgeResource",
      width: "20%",
      align: "center" as const,
      ellipsis: true,
      render: (knowledge: any) =>
        knowledge ? (
          <div>
            <Text strong>{knowledge.name}</Text>
            {knowledge.subject && (
              <Text type="secondary" style={{ fontSize: 12, display: "block" }}>
                {knowledge.subject}
              </Text>
            )}
          </div>
        ) : (
          <Text type="secondary">未关联</Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 50,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const items = [
          {
            key: "edit",
            label: "编辑",
            icon: <EditOutlined />,
            onClick: () => handleEditQuestion(record),
          },
          {
            key: "delete",
            label: "删除",
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              modal.confirm({
                title: "确定删除这个问题吗？",
                content: "删除后无法恢复，请谨慎操作。",
                okText: "确认",
                cancelText: "取消",
                onOk: () => deleteQuestionMutation.mutate(record.id),
              });
            },
          },
        ];
        return canEdit ? <ActionDropdown items={items} /> : null;
      },
    },
  ];

  const connectionColumns: ColumnsType<any> = [
    {
      title: "源问题",
      dataIndex: "sourceQuestionId",
      key: "sourceQuestionId",
      width: "25%",
      ellipsis: true,
      render: (_: any, record: any) => {
        const text =
          record.sourceQuestion?.description || record.sourceQuestion?.title ||
          getQuestionTitleById(record.sourceQuestionId);
        return (
          <Tooltip title={text} placement="topLeft">
            <Text strong>{truncateQuestionText(text, 40)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: "目标问题",
      dataIndex: "targetQuestionId",
      key: "targetQuestionId",
      width: "25%",
      ellipsis: true,
      render: (_: any, record: any) => {
        const text =
          record.targetQuestion?.description || record.targetQuestion?.title ||
          getQuestionTitleById(record.targetQuestionId);
        return (
          <Tooltip title={text} placement="topLeft">
            <Text strong>{truncateQuestionText(text, 40)}</Text>
          </Tooltip>
        );
      },
    },
    {
      title: "关联类型",
      dataIndex: "connectionType",
      key: "connectionType",
      width: 100,
      align: "center" as const,
      render: (type: string) => (
        <Tag color={getConnectionTypeColor(type)}>
          {getConnectionTypeLabel(type)}
        </Tag>
      ),
    },
    {
      title: "课程",
      dataIndex: "courseId",
      key: "courseId",
      width: "20%",
      align: "center" as const,
      ellipsis: true,
      render: (id: string) => (
        <Text strong>{getCourseTitleById(id)}</Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 50,
      align: "center" as const,
      fixed: "right" as const,
      render: (_: any, record: any) => {
        const items = [
          {
            key: "edit",
            label: "编辑",
            icon: <EditOutlined />,
            onClick: () => handleEditConnection(record),
          },
          {
            key: "delete",
            label: "删除",
            icon: <DeleteOutlined />,
            danger: true,
            onClick: () => {
              modal.confirm({
                title: "确定删除这个问题关联吗？",
                content: "删除后无法恢复，请谨慎操作。",
                okText: "确认",
                cancelText: "取消",
                onOk: () => deleteConnectionMutation.mutateAsync(record.id),
              });
            },
          },
        ];
        return <ActionDropdown items={items} />;
      },
    },
  ];

  const tabItems = [
    {
      key: "questions",
      label: "问题列表",
      children: (
        <Table
          className="theme-table"
          columns={questionColumns}
          dataSource={questions}
          rowKey="id"
          loading={questionsLoading}
          title={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateQuestionModalOpen(true)}
                  disabled={!selectedCourseId}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  创建问题
                </Button>
                <Button
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => setConfigModalOpen(true)}
                >
                  层级配置
                </Button>
                <Button 
                  size="small" 
                  icon={<UploadOutlined />} 
                  onClick={() => setImportModalOpen(true)}
                  disabled={!selectedCourseId}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  导入
                </Button>
                <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                  下载模板
                </Button>
                {selectedQuestionIds.length > 0 && (
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => setBatchDeleteModalOpen(true)}
                  >
                    批量删除 ({selectedQuestionIds.length})
                  </Button>
                )}
              </Space>
            </div>
          )}
          rowSelection={{
            selectedRowKeys: selectedQuestionIds,
            onChange: (selectedRowKeys: React.Key[]) => {
              setSelectedQuestionIds(selectedRowKeys as string[]);
            },
            columnWidth: 8,
          }}
          pagination={{
            pageSize: 25,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 700 }}
        />
      ),
    },
    {
      key: "connections",
      label: "问题关联",
      children: (
        <Table
          className="theme-table"
          columns={connectionColumns}
          dataSource={connections}
          rowKey="id"
          loading={connectionsLoading}
          title={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Button
                  size="small"
                  icon={<LinkOutlined />}
                  onClick={() => {
                    setCreateConnectionModalOpen(true);
                    connectionForm.resetFields();
                    connectionForm.setFieldsValue({
                      sourceQuestionId: undefined,
                      targetQuestionIds: [],
                      courseId: selectedCourseId || "",
                      connectionType: "hierarchy",
                    });
                  }}
                >
                  创建关联
                </Button>
              </Space>
            </div>
          )}
          pagination={{
            pageSize: 25,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 600 }}
        />
      ),
    },
  ];

  return (
    <div className="question-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.question-wrap{padding:12px!important}.question-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <FileTextOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
          问题管理
        </Title>
      </div>

      {/* 课程选择独立一行 */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程：</Text>
          <Select
            style={{ width: 280 }}
            placeholder="请选择课程"
            value={selectedCourseId || undefined}
            onChange={(value) => handleCourseChange(value || undefined)}
            loading={coursesLoading}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {courses.map((course: CourseResourceSchema) => (
              <Select.Option key={course.id} value={course.id}>
                {course.title}
              </Select.Option>
            ))}
          </Select>
        </Space>
      </div>

      <Tabs activeKey={tabValue} onChange={setTabValue} items={tabItems} />

      <Modal
        title={
          <Space>
            <PlusOutlined style={{ color: "#1890ff" }} />
            创建问题
          </Space>
        }
        open={createQuestionModalOpen}
        onCancel={() => {
          setCreateQuestionModalOpen(false);
          questionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={questionForm}
          layout="vertical"
          onFinish={handleCreateQuestion}
          initialValues={{ questionLevel: "global", position: 0 }}
        >
          <Form.Item
            name="questionLevel"
            label="问题标题"
            rules={[{ required: true, message: "请选择问题标题" }]}
          >
            <Select>
              <Select.Option value="global">{getLabel("global")}</Select.Option>
              <Select.Option value="concept">{getLabel("concept")}</Select.Option>
              <Select.Option value="method">{getLabel("method")}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="问题描述"
            rules={[{ required: true, message: "请输入问题描述" }]}
          >
            <TextArea rows={3} placeholder="请输入问题描述" />
          </Form.Item>

          <Form.Item
            name="difficulty"
            label="难度"
            initialValue={1}
          >
            <Select>
              <Select.Option value={1}>简单</Select.Option>
              <Select.Option value={2}>中等</Select.Option>
              <Select.Option value={3}>困难</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="position" label="位置">
            <Input type="number" placeholder="请输入问题位置顺序" />
          </Form.Item>

          {selectedCourseId && (
            <Alert
              type="info"
              message={`创建问题在课程: ${getCourseTitleById(selectedCourseId)}`}
              style={{ marginBottom: 16 }}
            />
          )}
        </Form>

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
              setCreateQuestionModalOpen(false);
              questionForm.resetFields();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => questionForm.submit()}
            loading={createQuestionMutation.isPending}
          >
            创建问题
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: "#1890ff" }} />
            编辑问题
          </Space>
        }
        open={editQuestionModalOpen}
        onCancel={() => {
          setEditQuestionModalOpen(false);
          setSelectedQuestion(null);
          questionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={questionForm}
          layout="vertical"
          onFinish={handleUpdateQuestion}
        >
          <Form.Item
            name="questionLevel"
            label="问题标题"
            rules={[{ required: true, message: "请选择问题标题" }]}
          >
            <Select>
              <Select.Option value="global">{getLabel("global")}</Select.Option>
              <Select.Option value="concept">{getLabel("concept")}</Select.Option>
              <Select.Option value="method">{getLabel("method")}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="问题描述"
            rules={[{ required: true, message: "请输入问题描述" }]}
          >
            <TextArea rows={3} placeholder="请输入问题描述" />
          </Form.Item>

          <Form.Item name="difficulty" label="难度">
            <Select>
              <Select.Option value={1}>简单</Select.Option>
              <Select.Option value={2}>中等</Select.Option>
              <Select.Option value={3}>困难</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="courseId"
            label="所属课程"
            rules={[{ required: true, message: "请选择课程" }]}
          >
            <Select
              loading={coursesLoading}
              showSearch
              optionFilterProp="children"
            >
              {courses.map((course: CourseResourceSchema) => (
                <Select.Option key={course.id} value={course.id}>
                  {course.title}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="knowledgeResourceId" label="关联知识点">
            <KnowledgeTreeSelect
              treeData={knowledgeTreeData}
              placeholder="搜索并选择知识点"
            />
          </Form.Item>

          <Form.Item name="position" label="位置">
            <Input type="number" placeholder="请输入问题位置顺序" />
          </Form.Item>
        </Form>

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
              setEditQuestionModalOpen(false);
              setSelectedQuestion(null);
              questionForm.resetFields();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => questionForm.submit()}
            loading={updateQuestionMutation.isPending}
          >
            更新问题
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <LinkOutlined style={{ color: "#1890ff" }} />
            创建问题关联
          </Space>
        }
        open={createConnectionModalOpen}
        onCancel={() => {
          setCreateConnectionModalOpen(false);
          connectionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={connectionForm}
          layout="vertical"
          onFinish={handleCreateConnection}
          initialValues={{ connectionType: "hierarchy", targetQuestionIds: [] }}
        >
          <Form.Item name="courseId" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item
            name="sourceQuestionId"
            label="源问题"
            rules={[{ required: true, message: "请选择源问题" }]}
          >
            <Select
              loading={questionsLoading}
              showSearch
              optionFilterProp="children"
              onChange={() => {
                // 源问题变化时，清除已选的目标问题中与源问题重复的
                const current = connectionForm.getFieldValue("targetQuestionIds") || [];
                const sourceId = connectionForm.getFieldValue("sourceQuestionId");
                if (sourceId && current.includes(sourceId)) {
                  connectionForm.setFieldsValue({
                    targetQuestionIds: current.filter((id: string) => id !== sourceId),
                  });
                }
              }}
            >
              {renderGroupedQuestionOptions(questions)}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetQuestionIds"
            label="目标问题"
            rules={[{ required: true, message: "请选择目标问题" }]}
          >
            <Select
              mode="multiple"
              loading={questionsLoading}
              showSearch
              optionFilterProp="children"
              placeholder="请选择一个或多个目标问题"
            >
              {renderGroupedQuestionOptions(
                questions,
                connectionForm.getFieldValue("sourceQuestionId"),
                connectedTargetIdsFor(connectionForm.getFieldValue("sourceQuestionId"))
              )}
            </Select>
          </Form.Item>

          <Form.Item name="connectionType" label="关联类型">
            <Select>
              <Select.Option value="hierarchy">层级关系</Select.Option>
              <Select.Option value="dependency">依赖关系</Select.Option>
              <Select.Option value="related">相关关系</Select.Option>
            </Select>
          </Form.Item>
        </Form>

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
              setCreateConnectionModalOpen(false);
              connectionForm.resetFields();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => connectionForm.submit()}
            loading={createConnectionMutation.isPending}
          >
            创建关联
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <EditOutlined style={{ color: "#1890ff" }} />
            编辑问题关联 (ID: {selectedConnection?.id || "none"})
          </Space>
        }
        open={editConnectionModalOpen}
        onCancel={() => {
          setEditConnectionModalOpen(false);
          setSelectedConnection(null);
          connectionForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={connectionForm}
          layout="vertical"
          onFinish={handleUpdateConnection}
        >
          <Form.Item name="courseId" hidden>
            <Input type="hidden" />
          </Form.Item>
          <Form.Item
            name="sourceQuestionId"
            label="源问题"
            rules={[{ required: true, message: "请选择源问题" }]}
          >
            <Select
              loading={questionsLoading}
              showSearch
              optionFilterProp="children"
            >
              {renderGroupedQuestionOptions(questions)}
            </Select>
          </Form.Item>

          <Form.Item
            name="targetQuestionIds"
            label="目标问题"
            rules={[{ required: true, message: "请选择目标问题" }]}
          >
            <Select
              loading={questionsLoading}
              showSearch
              optionFilterProp="children"
            >
              {renderGroupedQuestionOptions(
                questions,
                connectionForm.getFieldValue("sourceQuestionId"),
                connectedTargetIdsFor(connectionForm.getFieldValue("sourceQuestionId"))
              )}
            </Select>
          </Form.Item>

          <Form.Item name="connectionType" label="关联类型">
            <Select>
              <Select.Option value="hierarchy">层级关系</Select.Option>
              <Select.Option value="dependency">依赖关系</Select.Option>
              <Select.Option value="related">相关关系</Select.Option>
            </Select>
          </Form.Item>
        </Form>

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
              setEditConnectionModalOpen(false);
              setSelectedConnection(null);
              connectionForm.resetFields();
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => connectionForm.submit()}
            loading={createConnectionMutation.isPending}
          >
            更新关联
          </Button>
        </div>
      </Modal>

      <Modal
        title={
          <Space>
            <UploadOutlined style={{ color: "#1890ff" }} />
            导入问题
          </Space>
        }
        open={importModalOpen}
        onCancel={() => {
          setImportModalOpen(false);
          setSelectedFile(null);
        }}
        footer={null}
        width={500}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          {selectedCourseId && (
            <Alert
              type="info"
              message={`导入到课程: ${getCourseTitleById(selectedCourseId)}`}
            />
          )}

          <Upload.Dragger
            accept=".xlsx"
            beforeUpload={handleFileSelect}
            showUploadList={false}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: "#1890ff" }} />
            </p>
            <p className="ant-upload-text">选择要导入的文件</p>
            <p className="ant-upload-hint">支持 XLSX 格式文件</p>
          </Upload.Dragger>

          {selectedFile && (
            <Alert
              type="success"
              message={
                <div>
                  <Text strong>已选择文件：</Text>
                  <br />
                  <Text type="success">{selectedFile.name}</Text>
                  <br />
                  <Text type="secondary">
                    大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </Text>
                </div>
              }
            />
          )}

          <Text type="secondary">
            请确保 Excel 文件包含以下列：
            <br />• 问题标题 (必填)
            <br />• 标题概括 (可选)
            <br />• 问题描述 (可选)
            <br />• 问题位置 (可选)
          </Text>
        </Space>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 24,
          }}
        >
          <Button
            onClick={() => {
              setImportModalOpen(false);
              setSelectedFile(null);
            }}
          >
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleImportSubmit}
            disabled={!selectedFile}
            loading={importQuestionsMutation.isPending}
          >
            导入
          </Button>
        </div>
      </Modal>

      {/* 导入结果弹窗 */}
      <Modal
        title="导入结果"
        open={importResultModalOpen}
        onCancel={() => setImportResultModalOpen(false)}
        footer={null}
        width={600}
      >
        {importResult && (
          <div style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                marginBottom: 24,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#52c41a",
                  }}
                >
                  {importResult.successCount}
                </div>
                <Text type="secondary">成功导入</Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#faad14",
                  }}
                >
                  {importResult.skippedCount}
                </div>
                <Text type="secondary">已忽略（重复）</Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  {importResult.errorCount}
                </div>
                <Text type="secondary">导入失败</Text>
              </div>
            </div>

            {importResult.skippedCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>已忽略的问题（标题重复）</Title>
                <div
                  style={{
                    maxHeight: 120,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 8,
                  }}
                >
                  {importResult.skipped.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "4px 0",
                        borderBottom:
                          index < importResult.skipped.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Tag color="warning">{item.title}</Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {item.reason}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.errorCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>导入失败的问题</Title>
                <div
                  style={{
                    maxHeight: 120,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 8,
                  }}
                >
                  {importResult.errors.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "4px 0",
                        borderBottom:
                          index < importResult.errors.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Tag color="error">{item.title}</Tag>
                      <Text type="danger" style={{ marginLeft: 8 }}>
                        {item.reason}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => setImportResultModalOpen(false)}
              >
                确定
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: "#ff4d4f" }} />
            确认批量删除
          </Space>
        }
        open={batchDeleteModalOpen}
        onCancel={() => setBatchDeleteModalOpen(false)}
        footer={null}
        width={400}
      >
        <div style={{ padding: "16px 0" }}>
          <Alert
            type="warning"
            showIcon
            message={`确定要删除选中的 ${selectedQuestionIds.length} 个问题吗？`}
            description="删除后无法恢复，请谨慎操作。"
            style={{ marginBottom: 16 }}
          />
          <div style={{ textAlign: "right", gap: 8, display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={() => setBatchDeleteModalOpen(false)}>
              取消
            </Button>
            <Button
              danger
              onClick={handleBatchDelete}
              loading={deleteQuestionMutation.isPending}
            >
              确认删除
            </Button>
          </div>
        </div>
      </Modal>

      <QuestionLevelConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        courseId={selectedCourseId}
      />
    </div>
  );
}
