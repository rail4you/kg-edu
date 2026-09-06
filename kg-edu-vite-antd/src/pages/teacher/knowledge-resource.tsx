import { useNavigate } from "react-router-dom";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Typography,
  Card,
  Tag,
  Spin,
  Modal,
  Input,
  Select,
  Space,
  Dropdown,
  message,
  Form,
  Upload,
  Alert,
  Tabs,
  Slider,
  Tooltip,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  RobotOutlined,
  DeleteColumnOutlined,
  SearchOutlined,
  BookOutlined,
  FolderOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  PlusCircleOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  createResource,
  updateResource,
  destroyResource,
  getFileTemplateBySection,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { generateKnowledgePoints } from "@/lib/agent_api";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { useCourses } from "@/hooks/use-courses";
import * as XLSX from "xlsx";

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

const chineseNumberMap: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
  十一: 11,
  十二: 12,
  十三: 13,
  十四: 14,
  十五: 15,
};

const chineseNumberSortComparator = (
  a: string | null,
  b: string | null,
): number => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const extractChineseNumber = (str: string): number => {
    const match = str.match(/^([一二三四五六七八九十]+)/);
    return match ? chineseNumberMap[match[1]] || 999 : 999;
  };

  const aNum = extractChineseNumber(a);
  const bNum = extractChineseNumber(b);
  return aNum !== bNum ? aNum - bNum : a.localeCompare(b, "zh-CN");
};

const knowledgeImportHeaders = [
  "一级知识点",
  "二级知识点",
  "三级知识点",
  "四级知识点",
  "五级知识点",
  "六级知识点",
  "七级知识点",
  "前置知识点",
  "后置知识点",
  "关联知识点",
  "标签",
  "认知维度",
  "分类",
  "教学目标",
  "知识点说明",
];

const normalizeExcelCell = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const findKnowledgeHeaderRowIndex = (rows: unknown[][]): number => {
  return rows.findIndex((row) => {
    const firstColumns = row.slice(0, 7).map(normalizeExcelCell);
    return ["一级知识点", "二级知识点", "三级知识点"].every((header) =>
      firstColumns.includes(header),
    );
  });
};

const parseKnowledgePreviewRows = (rows: unknown[][]): any[] => {
  const headerRowIndex = findKnowledgeHeaderRowIndex(rows);
  const headers =
    headerRowIndex >= 0
      ? rows[headerRowIndex].map((cell, index) => normalizeExcelCell(cell) || knowledgeImportHeaders[index] || `列${index + 1}`)
      : knowledgeImportHeaders;
  const dataRows = rows.slice(headerRowIndex >= 0 ? headerRowIndex + 1 : 4);

  const levelHeaders = knowledgeImportHeaders.slice(0, 7);

  // 先解析原始数据
  const parsed = dataRows
    .map((row) => {
      const obj: Record<string, string | null> = {};
      headers.forEach((header, index) => {
        obj[header] = normalizeExcelCell(row[index]);
      });
      return obj;
    })
    .filter((row) =>
      levelHeaders.some((header) => row[header] !== null),
    );

  // 填充父级知识点名称：同一行中上级为空时表示延续上一级
  const lastValues: Record<string, string | null> = {};
  levelHeaders.forEach((h) => { lastValues[h] = null; });

  parsed.forEach((row) => {
    // 找到当前行最深非空的层级
    let deepestLevel = -1;
    for (let i = levelHeaders.length - 1; i >= 0; i--) {
      if (row[levelHeaders[i]] !== null) {
        deepestLevel = i;
        break;
      }
    }

    if (deepestLevel >= 0) {
      // 更新当前层级的 lastValues
      lastValues[levelHeaders[deepestLevel]] = row[levelHeaders[deepestLevel]];
      // 清空更深层级的 lastValues（新分支开始，深层级值不再延续）
      for (let i = deepestLevel + 1; i < levelHeaders.length; i++) {
        lastValues[levelHeaders[i]] = null;
      }
    }

    // 填充当前行所有上级层级
    for (let i = 0; i < levelHeaders.length; i++) {
      if (row[levelHeaders[i]] === null && lastValues[levelHeaders[i]] !== null) {
        row[levelHeaders[i]] = lastValues[levelHeaders[i]];
      }
    }
  });

  return parsed;
};

interface KnowledgeResourceRow {
  id: string;
  name: string;
  enName?: string | null;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string | null;
  unit?: string | null;
  importanceLevel?: "hard" | "important" | "normal";
  description?: string | null;
  parentId: string | null;
  path: string[];
  sortPath?: string | null;
  tag?: string | null;
  dimension?: string | null;
  category?: string | null;
  teachingGoal?: string | null;
  children?: KnowledgeResourceRow[];
}

interface TreeNode extends KnowledgeResourceRow {
  key: string;
  children?: TreeNode[];
}

const buildTree = (flatRows: KnowledgeResourceRow[]): TreeNode[] => {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  flatRows.forEach((row) => {
    map.set(row.id, { ...row, key: row.id, children: [] });
  });

  flatRows.forEach((row) => {
    const node = map.get(row.id)!;
    if (row.parentId && map.has(row.parentId)) {
      const parent = map.get(row.parentId)!;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // 按照 sortPath 排序（而不是按名称）
  const sortChildren = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      const sortPathA = a.sortPath || "";
      const sortPathB = b.sortPath || "";
      return sortPathA.localeCompare(sortPathB, undefined, { numeric: true });
    });
    nodes.forEach((node) => {
      if (node.children?.length) sortChildren(node.children);
    });
  };

  sortChildren(roots);

  const removeEmptyChildren = (nodes: TreeNode[]) => {
    nodes.forEach((node) => {
      if (node.children?.length === 0) delete node.children;
      else if (node.children) removeEmptyChildren(node.children);
    });
  };

  removeEmptyChildren(roots);
  return roots;
};

export default function TeacherKnowledgeResource() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canEdit } = useEditPermission();

  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const actorId = (user as any)?.id || (user as any)?.actorId;

  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("");
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [updateModalOpen, setUpdateModalOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [selectedResource, setSelectedResource] =
    React.useState<KnowledgeResourceRow | null>(null);
  const [expandedRowKeys, setExpandedRowKeys] = React.useState<React.Key[]>([]);
  const [searchText, setSearchText] = React.useState("");

  // 统一的知识点添加模态框状态
  const [addModalOpen, setAddModalOpen] = React.useState(false);
  const [addModalMode, setAddModalMode] = React.useState<"child" | "sibling">("child");
  const [addModalTarget, setAddModalTarget] = React.useState<{
    parentId: string | null;
    parentType: "subject" | "knowledge_unit" | "knowledge_cell" | null; // 父级的类型
    knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell"; // 新建知识点的类型
    sortPath?: string;
    parentName?: string;
  } | null>(null);
  const [addFormData, setAddFormData] = React.useState({
    name: "",
    description: "",
    importanceLevel: "normal" as "hard" | "important" | "normal",
  });

  // 导入相关状态
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [selectedXmindFile, setSelectedXmindFile] = React.useState<File | null>(null);
  const [previewData, setPreviewData] = React.useState<any[]>([]);
  const [importTabKey, setImportTabKey] = React.useState<string>("excel");
  const [importResult, setImportResult] = React.useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  // AI导入（基于文本生成）相关状态
  const [aiImportModalOpen, setAiImportModalOpen] = React.useState(false);
  const [aiImporting, setAiImporting] = React.useState(false);
  const [aiImportText, setAiImportText] = React.useState("");
  const [aiImportCount, setAiImportCount] = React.useState(5);
  const [aiImportResult, setAiImportResult] = React.useState<{
    success: boolean;
    message: string;
    imported?: number;
    knowledgePoints?: any[];
  } | null>(null);

  // 删除所有知识点状态
  const [deleteAllModalOpen, setDeleteAllModalOpen] = React.useState(false);
  const [deletingAll, setDeletingAll] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: "",
    knowledgeType: "knowledge_cell" as
      | "subject"
      | "knowledge_unit"
      | "knowledge_cell",
    importanceLevel: "normal" as "hard" | "important" | "normal",
    description: "",
    parentId: null as string | null,
  });

  // 使用统一的课程获取 hook
  const {
    courses: coursesData,
    loading: coursesLoading,
    retryCount: coursesRetryCount,
    maxRetry: MAX_COURSES_RETRY,
    isMaxRetryReached,
    resetAndRefetch: resetCoursesAndRefetch,
  } = useCourses();

  const {
    data: hierarchyData,
    isLoading: hierarchyLoading,
    refetch,
  } = useQuery({
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

  const processedRows = React.useMemo(() => {
    if (!hierarchyData) return [];

    const flatRows: KnowledgeResourceRow[] = [];

    const flattenHierarchy = (
      node: any,
      parentPath: string[] = [],
      parentId: string | null = null,
    ): void => {
      const currentPath = [...parentPath, node.name];

      flatRows.push({
        id: node.id,
        name: node.name,
        enName: node.enName,
        knowledgeType: node.knowledgeType,
        subject: node.subject,
        unit: node.unit,
        importanceLevel: node.importanceLevel,
        description: node.description,
        parentId: node.parentKnowledgeResourceId || node.parentUnitId || node.parentSubjectId || parentId,
        path: currentPath,
        sortPath: node.sortPath,
        tag: node.tag,
        dimension: node.dimension,
        category: node.category,
        teachingGoal: node.teachingGoal,
      });

      const childArrays = [
        node.childUnits,
        node.directCells,
        node.subjectCells,
        node.childCells,
        node.nestedChildCells,
      ];
      childArrays.forEach((children) => {
        if (Array.isArray(children)) {
          children.forEach((child: any) =>
            flattenHierarchy(child, currentPath, node.id),
          );
        }
      });
    };

    hierarchyData.forEach((node: any) => flattenHierarchy(node));
    flatRows.sort((a, b) => {
      // 首先按照层级排序
      if (a.path.length !== b.path.length) return a.path.length - b.path.length;
      // 同层级情况下，按照 sortPath 排序
      const sortPathA = a.sortPath || "";
      const sortPathB = b.sortPath || "";
      return sortPathA.localeCompare(sortPathB, undefined, { numeric: true });
    });

    return flatRows;
  }, [hierarchyData]);

  // 搜索过滤
  const filteredRows = React.useMemo(() => {
    if (!searchText.trim()) return processedRows;
    const searchLower = searchText.toLowerCase();
    return processedRows.filter(
      (row) =>
        row.name.toLowerCase().includes(searchLower) ||
        (row.description && row.description.toLowerCase().includes(searchLower)) ||
        (row.tag && row.tag.toLowerCase().includes(searchLower)),
    );
  }, [processedRows, searchText]);

  const filteredTreeData = React.useMemo(
    () => buildTree(filteredRows),
    [filteredRows],
  );

  React.useEffect(() => {
    if (filteredTreeData.length > 0 && expandedRowKeys.length === 0) {
      setExpandedRowKeys(filteredRows.map((row) => row.id));
    }
  }, [filteredTreeData, filteredRows, expandedRowKeys.length]);

  const createKnowledgeMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!selectedCourseId) throw new Error("No course selected");

      const result = await createResource({
        tenant,
        input: {
          name: data.name,
          knowledgeType: data.knowledgeType,
          importanceLevel: data.importanceLevel,
          description: data.description || null,
          courseId: selectedCourseId,
        },
        fields: [
          "id",
          "name",
          "knowledgeType",
          "importanceLevel",
          "description",
        ],
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (!result.success)
        throw new Error(result.errors?.[0]?.message || "Failed to create");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("创建成功");
      setCreateModalOpen(false);
      resetFormData();
    },
  });

  const updateKnowledgeMutation = useMutation({
    mutationFn: async (data: { id: string; updateData: any }) => {
      const result = await updateResource({
        tenant,
        primaryKey: data.id,
        fields: ["id", "name", "importanceLevel", "description", "tag"],
        input: data.updateData,
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (!result.success)
        throw new Error(result.errors?.[0]?.message || "Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("更新成功");
      setUpdateModalOpen(false);
      setSelectedResource(null);
    },
  });

  // 思政点toggle mutation
  const togglePoliticalMutation = useMutation({
    mutationFn: async (data: { id: string; currentTag: string | null }) => {
      const tagStr = data.currentTag || "";
      let newTag: string;
      if (tagStr.includes("课程思政")) {
        // 移除课程思政
        newTag = tagStr.replace(/,?\s*课程思政/g, "").trim();
        if (!newTag) newTag = "";
      } else {
        // 添加课程思政
        newTag = tagStr ? `${tagStr}, 课程思政` : "课程思政";
      }

      const result = await updateResource({
        tenant,
        primaryKey: data.id,
        fields: ["id", "tag"],
        input: { tag: newTag || null },
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (!result.success)
        throw new Error(result.errors?.[0]?.message || "Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("思政点更新成功");
    },
  });

  // 统一的添加知识点 mutation
  const addKnowledgeMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      parentId: string | null;
      parentType: "subject" | "knowledge_unit" | "knowledge_cell" | null;
      knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
      sortPath?: string | null;
      description?: string | null;
      importanceLevel?: "hard" | "important" | "normal";
    }) => {
      if (!selectedCourseId) throw new Error("No course selected");

      // 根据父级类型构建正确的输入字段
      const input: any = {
        name: data.name,
        knowledgeType: data.knowledgeType,
        importanceLevel: data.importanceLevel || "normal",
        courseId: selectedCourseId,
        sortPath: data.sortPath || null,
        description: data.description || null,
      };

      // 根据父级类型设置正确的父级ID字段
      if (data.parentId && data.parentType) {
        switch (data.parentType) {
          case "subject":
            input.parentSubjectId = data.parentId;
            break;
          case "knowledge_unit":
            input.parentUnitId = data.parentId;
            break;
          case "knowledge_cell":
            input.parentKnowledgeResourceId = data.parentId;
            break;
        }
      }

      const result = await createResource({
        tenant,
        input,
        fields: ["id", "name", "knowledgeType", "sortPath", "description", "importanceLevel"],
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (!result.success)
        throw new Error(result.errors?.[0]?.message || "Failed to create");
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("创建成功");

      // 如果是添加子知识点，自动展开父节点
      if (variables.parentId && !expandedRowKeys.includes(variables.parentId)) {
        setExpandedRowKeys([...expandedRowKeys, variables.parentId]);
      }

      // 关闭模态框并重置状态
      setAddModalOpen(false);
      setAddModalTarget(null);
      setAddFormData({
        name: "",
        description: "",
        importanceLevel: "normal",
      });
    },
  });

  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyResource({
        tenant,
        primaryKey: id,
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (!result.success)
        throw new Error(result.errors?.[0]?.message || "Failed to delete");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("删除成功");
      setDeleteConfirmOpen(false);
      setSelectedResource(null);
    },
  });

  // 知识点排序 mutation（上移/下移）
  const reorderKnowledgeMutation = useMutation({
    mutationFn: async (data: { id: string; newDisplayOrder: number }) => {
      const payload = {
        action: "reorder_knowledge_resource",
        tenant: tenant,
        primaryKey: data.id,
        input: { new_display_order: data.newDisplayOrder },
        fields: ["id", "name", "sortPath", "displayOrder"],
      };

      const response = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildCSRFHeaders(),
          ...getAuthHeaders(user),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.errors?.[0]?.message || "排序失败");
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
      });
      message.success("排序成功");
    },
    onError: (error: Error) => {
      message.error(error.message || "排序失败");
    },
  });

  // 获取同级知识点列表（用于确定上移/下移边界）
  const getSiblings = (record: TreeNode): KnowledgeResourceRow[] => {
    // 获取同一父级下的所有同级知识点（使用 processedRows 而不是 filteredRows，避免搜索过滤影响）
    return processedRows.filter((r) => r.parentId === record.parentId);
  };

  // 上移知识点
  const handleMoveUp = (record: TreeNode) => {
    const siblings = getSiblings(record);
    // 按 sortPath 排序
    siblings.sort((a, b) => (a.sortPath || "").localeCompare(b.sortPath || "", undefined, { numeric: true }));
    const currentIndex = siblings.findIndex((s) => s.id === record.id);
    if (currentIndex <= 0) {
      message.info("已经是第一个了");
      return;
    }
    // 上移：将当前知识点移动到前一个位置（display_order 从 1 开始）
    reorderKnowledgeMutation.mutate({
      id: record.id,
      newDisplayOrder: currentIndex, // currentIndex 是 0-based，所以 currentIndex 对应第 currentIndex+1 个位置，移动到前一个就是 currentIndex
    });
  };

  // 下移知识点
  const handleMoveDown = (record: TreeNode) => {
    const siblings = getSiblings(record);
    // 按 sortPath 排序
    siblings.sort((a, b) => (a.sortPath || "").localeCompare(b.sortPath || "", undefined, { numeric: true }));
    const currentIndex = siblings.findIndex((s) => s.id === record.id);
    if (currentIndex >= siblings.length - 1) {
      message.info("已经是最后一个了");
      return;
    }
    // 下移：将当前知识点移动到后一个位置（display_order 从 1 开始）
    reorderKnowledgeMutation.mutate({
      id: record.id,
      newDisplayOrder: currentIndex + 2, // 移动到后一个位置
    });
  };

  // 下载模板
  const handleDownloadTemplate = async () => {
    try {
      const result = await getFileTemplateBySection({
        input: { section: "knowledge" },
        fields: ["id", "section", "filePath"],
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) },
      });

      if (result.success && result.data?.filePath) {
        const link = document.createElement("a");
        link.href = result.data.filePath;
        link.download = "knowledge_template.xlsx";
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

  // 处理文件选择
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: null,
          blankrows: false,
        }) as unknown[][];

        if (jsonData.length === 0) {
          message.error("文件内容为空");
          return;
        }

        const preview = parseKnowledgePreviewRows(jsonData);

        if (preview.length === 0) {
          message.error("未识别到知识点数据，请检查是否包含“一级知识点”等表头");
          setPreviewData([]);
          return;
        }

        setPreviewData(preview);
      } catch (error) {
        message.error("解析文件失败");
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  // 导入知识点
  const handleImport = async () => {
    if (!selectedFile || !selectedCourseId) {
      message.error("请选择文件并选择课程");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      // 读取文件为 base64
      const fileBuffer = await selectedFile.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(fileBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const payload = {
        file_data: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`,
        course_id: selectedCourseId,
        tenant: tenant,
      };

      const token = sessionStorage.getItem("jwt_access_token") || (user as any)?.token;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/agent/import", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success || result.Success) {
        const importedCount = result.importedResources || result.ImportedResources || 0;
        message.success(`导入成功，共导入 ${importedCount} 个知识点`);
        queryClient.invalidateQueries({ queryKey: ["knowledge-hierarchy", selectedCourseId, tenant] });
        handleCloseImportModal();
      } else {
        setImportResult({
          success: false,
          message: result.message || result.Message || "导入失败",
          errors: result.errors || result.Errors || [],
        });
        message.error(result.message || "导入失败");
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "导入失败";
      setImportResult({
        success: false,
        message: "导入失败",
        errors: [errorMsg],
      });
      message.error(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  // 关闭导入弹窗
  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setSelectedFile(null);
    setSelectedXmindFile(null);
    setPreviewData([]);
    setImportResult(null);
    setImportTabKey("excel");
  };

  // XMind文件选择处理
  const handleXmindFileSelect = (file: File) => {
    setSelectedXmindFile(file);
    setImportResult(null);
    return false;
  };

  // 导入XMind
  const handleXmindImport = async () => {
    if (!selectedXmindFile || !selectedCourseId) {
      message.error("请选择XMind文件并选择课程");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedXmindFile);
      formData.append("course_id", selectedCourseId);

      const token = sessionStorage.getItem("jwt_access_token") || (user as any)?.token;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `/api/files/import-xmind?tenant=${tenant}`,
        {
          method: "POST",
          headers: {
            ...headers,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (result.success || result.data?.success) {
        const importedCount = result.data?.imported_resources || result.importedResources || 0;
        message.success(`XMind导入成功，共导入 ${importedCount} 个知识点`);
        queryClient.invalidateQueries({ queryKey: ["knowledge-hierarchy", selectedCourseId, tenant] });
        handleCloseImportModal();
      } else {
        setImportResult({
          success: false,
          message: result.message || result.error || "XMind导入失败",
          errors: result.errors || [],
        });
        message.error(result.message || "XMind导入失败");
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "XMind导入失败";
      setImportResult({
        success: false,
        message: "XMind导入失败",
        errors: [errorMsg],
      });
      message.error(errorMsg);
    } finally {
      setImporting(false);
    }
  };

  // AI导入知识点（基于文本生成）
  const handleAiImport = async () => {
    if (!selectedCourseId) {
      message.error("请先选择课程");
      return;
    }
    if (!aiImportText.trim()) {
      message.error("请输入文本内容");
      return;
    }

    setAiImporting(true);
    setAiImportResult(null);

    try {
      const result = await generateKnowledgePoints({
        orgSchema: tenant,
        courseId: selectedCourseId,
        text: aiImportText.trim(),
        count: aiImportCount,
      });

      if (result.success && result.data) {
        const data = result.data as any;
        const generated = data.data?.generated ?? data.generated ?? 0;
        const knowledgePoints = data.data?.knowledgePoints ?? data.knowledgePoints ?? [];
        setAiImportResult({
          success: true,
          message: `AI导入成功，共生成 ${generated} 个知识点`,
          imported: generated,
          knowledgePoints: knowledgePoints,
        });
      } else {
        setAiImportResult({
          success: false,
          message: result.message || "AI导入失败",
        });
        message.error(result.message || "AI导入失败");
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "AI导入失败";
      setAiImportResult({
        success: false,
        message: errorMsg,
      });
      message.error(errorMsg);
    } finally {
      setAiImporting(false);
    }
  };

  const handleConfirmAiImport = () => {
    message.success("知识点已导入到课程中");
    setAiImportModalOpen(false);
    setAiImportResult(null);
    setAiImportText("");
    setAiImportCount(5);
    queryClient.invalidateQueries({ queryKey: ["knowledge-hierarchy", selectedCourseId, tenant] });
  };

  // 删除所有知识点
  const handleDeleteAll = async () => {
    if (!selectedCourseId) {
      message.error("请先选择课程");
      return;
    }

    setDeletingAll(true);

    try {
      const payload = {
        action: "delete_all_knowledges_by_course",
        tenant: tenant,
        input: { course_id: selectedCourseId }
      };

      const response = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...buildCSRFHeaders(),
          ...getAuthHeaders(user),
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        message.success("删除所有知识点成功");
        queryClient.invalidateQueries({ queryKey: ["knowledge-hierarchy", selectedCourseId, tenant] });
        setDeleteAllModalOpen(false);
      } else {
        message.error(result?.message || "删除失败");
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "删除失败";
      message.error(errorMsg);
    } finally {
      setDeletingAll(false);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: "",
      knowledgeType: "knowledge_cell",
      importanceLevel: "normal",
      description: "",
      parentId: null,
    });
  };

  const handleCreateSubject = () => {
    setFormData({
      name: "",
      knowledgeType: "subject",
      importanceLevel: "normal",
      description: "",
      parentId: null,
    });
    setCreateModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedResource) {
      deleteKnowledgeMutation.mutate(selectedResource.id);
    }
  };

  const confirmUpdate = () => {
    if (!selectedResource || !formData.name.trim()) return;

    updateKnowledgeMutation.mutate({
      id: selectedResource.id,
      updateData: {
        name: formData.name.trim(),
        importanceLevel: formData.importanceLevel,
        ...(formData.description?.trim() && {
          description: formData.description.trim(),
        }),
      },
    });
  };

  const getLevel = (record: TreeNode): number => {
    let level = 0;
    let current: TreeNode | null = record;
    while (current) {
      level++;
      current = filteredRows.find(
        (r) => r.id === current?.parentId,
      ) as TreeNode | null;
    }
    return level;
  };

  const getHierarchicalIndex = (record: TreeNode): string => {
    const segments: number[] = [];
    let current: TreeNode | null = record;

    while (current) {
      const siblings = processedRows.filter((r) => r.parentId === current!.parentId);
      siblings.sort((a, b) => (a.sortPath || "").localeCompare(b.sortPath || "", undefined, { numeric: true }));
      const index = siblings.findIndex((s) => s.id === current!.id) + 1;
      segments.unshift(index);
      current = current.parentId ? (processedRows.find((r) => r.id === current!.parentId) as TreeNode | null) : null;
    }

    return segments.join(".");
  };

  const getActionMenuItems = (record: TreeNode): MenuProps["items"] => [
    {
      key: "addChild",
      label: "添加子知识点",
      icon: <PlusCircleOutlined />,
      onClick: () => {
        const parentType = record.knowledgeType;
        let newType: "subject" | "knowledge_unit" | "knowledge_cell" = "knowledge_cell";
        if (parentType === "subject") newType = "knowledge_unit";
        else if (parentType === "knowledge_unit") newType = "knowledge_cell";

        setAddModalMode("child");
        setAddModalTarget({
          parentId: record.id,
          parentType: record.knowledgeType,
          knowledgeType: newType,
          sortPath: record.id,
          parentName: record.name,
        });
        setAddFormData({
          name: "",
          description: "",
          importanceLevel: "normal",
        });
        setAddModalOpen(true);
      },
    },
    {
      key: "addSibling",
      label: "添加同级知识点",
      icon: <PlusOutlined />,
      onClick: () => {
        const parentRecord = record.parentId
          ? processedRows.find((r) => r.id === record.parentId)
          : null;

        setAddModalMode("sibling");
        setAddModalTarget({
          parentId: record.parentId,
          parentType: parentRecord?.knowledgeType || null,
          knowledgeType: record.knowledgeType,
          sortPath: record.sortPath || record.parentId || undefined,
          parentName: record.name,
        });
        setAddFormData({
          name: "",
          description: "",
          importanceLevel: "normal",
        });
        setAddModalOpen(true);
      },
    },
    { type: "divider" },
    {
      key: "edit",
      label: "编辑",
      icon: <EditOutlined />,
      onClick: () => {
        setSelectedResource(record);
        setFormData({
          name: record.name,
          knowledgeType: record.knowledgeType,
          importanceLevel: record.importanceLevel || "normal",
          description: "",
          parentId: record.parentId,
        });
        setUpdateModalOpen(true);
      },
    },
    { type: "divider" },
    {
      key: "delete",
      label: "删除",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        setSelectedResource(record);
        setDeleteConfirmOpen(true);
      },
    },
  ];

  const typeMap = {
    subject: "主题",
    knowledge_unit: "知识单元",
    knowledge_cell: "知识点",
  };
  const importanceLevelMap = {
    hard: "难点",
    important: "重点",
    normal: "一般",
  };

  const columns: ColumnsType<TreeNode> = [
    {
      title: "序号",
      key: "index",
      width: 80,
      render: (_, record) => (
        <Text style={{ fontSize: 13, color: "#8c8c8c" }}>
          {getHierarchicalIndex(record)}
        </Text>
      ),
    },
    {
      title: "知识标题",
      key: "name",
      width: 350,
      sorter: (a, b) => {
        const sortPathA = a.sortPath || "";
        const sortPathB = b.sortPath || "";
        return sortPathA.localeCompare(sortPathB, undefined, { numeric: true });
      },
      render: (_, record) => {
        const getImportanceColor = (level?: string) => {
          switch (level) {
            case "hard":
              return "error";
            case "important":
              return "warning";
            default:
              return "default";
          }
        };

        const isExpanded = expandedRowKeys.includes(record.id);
        const hasChildren = record.children && record.children.length > 0;
        const level = getLevel(record);
        const indentSize = (level - 1) * 24;

        const handleToggleExpand = () => {
          if (hasChildren) {
            if (isExpanded) {
              setExpandedRowKeys(
                expandedRowKeys.filter((key) => key !== record.id),
              );
            } else {
              setExpandedRowKeys([...expandedRowKeys, record.id]);
            }
          }
        };

        return (
          <div style={{ paddingLeft: indentSize, display: "flex", alignItems: "flex-start", gap: 8 }}>
            {hasChildren ? (
              <span
                style={{
                  cursor: "pointer",
                  fontSize: 14,
                  userSelect: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  border: "1px solid #d9d9d9",
                  borderRadius: 4,
                  backgroundColor: "#fafafa",
                  flexShrink: 0,
                  marginTop: 2,
                }}
                onClick={handleToggleExpand}
              >
                {isExpanded ? <MinusOutlined style={{ fontSize: 10 }} /> : <PlusOutlined style={{ fontSize: 10 }} />}
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Tooltip title={record.name} placement="topLeft">
                  <Text 
                    strong 
                    style={{ 
                      maxWidth: 200,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "inline-block",
                      cursor: "pointer"
                    }}
                  >
                    {record.name}
                  </Text>
                </Tooltip>
                {(() => {
                  const tagStr = record.tag || "";
                  const tags = tagStr
                    .split(/[;；,，]/)
                    .map(t => t.trim())
                    .filter(t => t && t !== "课程思政");
                  
                  if (tags.length === 0) return null;
                  
                  const tagColors: Record<string, string> = {
                    "重点": "orange",
                    "难点": "red",
                    "考点": "blue",
                  };
                  
                  return (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {tags.map((tag, idx) => (
                        <Tag 
                          key={idx}
                          color={tagColors[tag] || "default"}
                          style={{ margin: 0, fontSize: 11 }}
                        >
                          {tag}
                        </Tag>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "类型",
      dataIndex: "knowledgeType",
      key: "knowledgeType",
      width: 100,
      render: (type: string) => (
        <Tag color={type === "subject" ? "blue" : type === "knowledge_unit" ? "purple" : "green"}>
          {typeMap[type as keyof typeof typeMap] || type}
        </Tag>
      ),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 150,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          <Text style={{ color: text ? undefined : "#bfbfbf" }}>{text || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "思政点",
      key: "political",
      width: 80,
      render: (_, record) => {
        const tagStr = record.tag || "";
        const isPolitical = tagStr.includes("课程思政");

        return (
          <Tag
            color={isPolitical ? "red" : "default"}
            style={{
              cursor: "pointer",
              borderStyle: isPolitical ? "solid" : "dashed",
              margin: 0,
            }}
            onClick={() => {
              togglePoliticalMutation.mutate({
                id: record.id,
                currentTag: record.tag,
              });
            }}
          >
            {isPolitical ? (record.dimension || "思政") : "无"}
          </Tag>
        );
      },
    },
    {
      title: "教学目标",
      dataIndex: "teachingGoal",
      key: "teachingGoal",
      width: 120,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          <Text style={{ color: text ? undefined : "#bfbfbf" }}>{text || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "分类",
      dataIndex: "category",
      key: "category",
      width: 100,
      ellipsis: { showTitle: false },
      render: (text: string) => (
        <Tooltip placement="topLeft" title={text}>
          <Text style={{ color: text ? undefined : "#bfbfbf" }}>{text || "-"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      fixed: "right",
      render: (_, record) =>
        canEdit ? (
          <Dropdown
            menu={{ items: getActionMenuItems(record) }}
            trigger={["click"]}
          >
            <Button type="link" size="small" icon={<EditOutlined />}>
              更多
            </Button>
          </Dropdown>
        ) : null,
    },
  ];

  React.useEffect(() => {
    if (!coursesData || coursesData.length === 0 || selectedCourseId) return;
    setSelectedCourseId(coursesData[0].id);
  }, [coursesData, selectedCourseId]);

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .tree-row-level-1 { background-color: #fafafa; font-weight: 500; }
        .tree-row-level-1:hover > td { background-color: #f0f0f0 !important; }
        .tree-row-level-2 { background-color: #ffffff; border-left: 3px solid #1890ff; }
        .tree-row-level-2:hover > td { background-color: #e6f7ff !important; }
        .tree-row-level-3 { background-color: #fafafa; border-left: 3px solid #52c41a; }
        .tree-row-level-3:hover > td { background-color: #f6ffed !important; }
        .tree-row-level-4 { background-color: #ffffff; border-left: 3px solid #faad14; }
        .tree-row-level-4:hover > td { background-color: #fffbe6 !important; }
      `}</style>
      <div className="kr-page-wrap" style={{ width: "100%", padding: 16 }}>
        <style>{`@media(max-width:768px){.kr-page-wrap{padding:8px!important}.kr-page-wrap .ant-table-cell{padding:6px 4px!important}.kr-page-wrap .kr-filter-row{flex-direction:column!important;align-items:stretch!important}.kr-page-wrap .kr-filter-row .ant-select{width:100%!important;margin-bottom:8px}}`}</style>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
          <Title level={4} style={{ margin: 0 }}>
            知识点管理
          </Title>
        </div>

          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {coursesLoading ? (
              <Space>
                <Spin size="small" />
                <Text type="secondary">
                  {coursesRetryCount > 0
                    ? `正在获取课程列表 (重试 ${coursesRetryCount}/${MAX_COURSES_RETRY})...`
                    : "加载课程中..."}
                </Text>
              </Space>
            ) : coursesData.length === 0 ? (
              <Space>
                <Text type="secondary">暂无课程数据</Text>
                <Button
                  size="small"
                  onClick={resetCoursesAndRefetch}
                >
                  重新加载
                </Button>
              </Space>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Text type="secondary">请选择课程：</Text>
                  <Select
                    style={{ width: 280, maxWidth: 400 }}
                    placeholder="选择课程"
                    value={selectedCourseId || undefined}
                    onChange={setSelectedCourseId}
                    loading={coursesLoading}
                    options={coursesData.map((course: any) => ({
                      value: course.id,
                      label: course.title,
                    }))}
                  />
                </div>
                {selectedCourseId && (
                  <Input
                    placeholder="搜索知识点名称"
                    prefix={<SearchOutlined />}
                    style={{ width: 220 }}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                  />
                )}
              </>
            )}
          </div>

          {selectedCourseId && (
            <div style={{ 
              marginBottom: 16, 
              display: "flex", 
              gap: 12, 
              flexWrap: "wrap",
              alignItems: "center"
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6,
                padding: "6px 16px",
                backgroundColor: "#e6f7ff",
                borderRadius: 4,
                minWidth: 140
              }}>
                <BookOutlined style={{ fontSize: 16, color: "#1890ff" }} />
                <span style={{ fontSize: 13, color: "#595959" }}>主题</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: "#1890ff", marginLeft: "auto" }}>
                  {filteredRows.filter((r) => r.knowledgeType === "subject").length}
                </span>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6,
                padding: "6px 16px",
                backgroundColor: "#f9f0ff",
                borderRadius: 4,
                minWidth: 140
              }}>
                <FolderOutlined style={{ fontSize: 16, color: "#722ed1" }} />
                <span style={{ fontSize: 13, color: "#595959" }}>知识单元</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: "#722ed1", marginLeft: "auto" }}>
                  {filteredRows.filter((r) => r.knowledgeType === "knowledge_unit").length}
                </span>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6,
                padding: "6px 16px",
                backgroundColor: "#f6ffed",
                borderRadius: 4,
                minWidth: 140
              }}>
                <FileTextOutlined style={{ fontSize: 16, color: "#52c41a" }} />
                <span style={{ fontSize: 13, color: "#595959" }}>知识点</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: "#52c41a", marginLeft: "auto" }}>
                  {filteredRows.filter((r) => r.knowledgeType === "knowledge_cell").length}
                </span>
              </div>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 6,
                padding: "6px 16px",
                backgroundColor: "#fffbe6",
                borderRadius: 4,
                minWidth: 140
              }}>
                <AppstoreOutlined style={{ fontSize: 16, color: "#faad14" }} />
                <span style={{ fontSize: 13, color: "#595959" }}>总计</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: "#faad14", marginLeft: "auto" }}>
                  {filteredRows.length}
                </span>
              </div>
            </div>
          )}

          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleDownloadTemplate}
            >
              下载模板
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => setImportModalOpen(true)}
              disabled={!selectedCourseId}
              style={canEdit ? undefined : { display: "none" }}
            >
              导入知识
            </Button>
            <Button
              icon={<RobotOutlined />}
              onClick={() => setAiImportModalOpen(true)}
              disabled={!selectedCourseId}
              style={canEdit ? undefined : { display: "none" }}
            >
              AI导入
            </Button>
            <Button
              danger
              icon={<DeleteColumnOutlined />}
              onClick={() => setDeleteAllModalOpen(true)}
              disabled={!selectedCourseId || processedRows.length === 0}
              style={canEdit ? undefined : { display: "none" }}
            >
              删除所有
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateSubject}
              disabled={!selectedCourseId}
              style={canEdit ? undefined : { display: "none" }}
            >
              创建主题
            </Button>
          </Space>

        <Card>
          {!selectedCourseId ? (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Title level={5} type="secondary">
                请选择课程
              </Title>
              <Text type="secondary">选择课程后将显示知识点结构</Text>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={filteredTreeData}
              loading={hierarchyLoading}
              pagination={false}
              scroll={{ x: 1200, y: 500 }}
              rowClassName={(record) => `tree-row-level-${getLevel(record)}`}
              expandable={{
                expandedRowKeys,
                onExpand: (expanded, record) => {
                  if (expanded) {
                    setExpandedRowKeys([...expandedRowKeys, record.id]);
                  } else {
                    setExpandedRowKeys(
                      expandedRowKeys.filter((key) => key !== record.id),
                    );
                  }
                },
                indentSize: 20,
                showExpandColumn: false,
              }}
            />
          )}
        </Card>

        <Modal
          open={createModalOpen}
          onCancel={() => setCreateModalOpen(false)}
          title="创建知识资源"
          width={600}
          footer={[
            <Button key="cancel" onClick={() => setCreateModalOpen(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => createKnowledgeMutation.mutate(formData)}
              loading={createKnowledgeMutation.isPending}
              disabled={!formData.name.trim()}
            >
              确认
            </Button>,
          ]}
        >
          <Form layout="vertical">
            <Form.Item label="名称" required>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Form.Item>
            <Form.Item label="类型">
              <Select
                value={formData.knowledgeType}
                disabled
                options={[
                  { value: "subject", label: "主题" },
                  { value: "knowledge_unit", label: "知识单元" },
                  { value: "knowledge_cell", label: "知识点" },
                ]}
              />
            </Form.Item>
            <Form.Item label="重要程度">
              <Select
                value={formData.importanceLevel}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    importanceLevel: value as "hard" | "important" | "normal",
                  }))
                }
                options={[
                  { value: "normal", label: "一般" },
                  { value: "important", label: "重点" },
                  { value: "hard", label: "难点" },
                ]}
              />
            </Form.Item>
            <Form.Item label="描述">
              <TextArea
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          open={updateModalOpen}
          onCancel={() => setUpdateModalOpen(false)}
          title="编辑知识资源"
          width={600}
          footer={[
            <Button key="cancel" onClick={() => setUpdateModalOpen(false)}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={confirmUpdate}
              loading={updateKnowledgeMutation.isPending}
              disabled={!formData.name.trim()}
            >
              确认
            </Button>,
          ]}
        >
          <Form layout="vertical">
            <Form.Item label="名称" required>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Form.Item>
            <Form.Item label="重要程度">
              <Select
                value={formData.importanceLevel}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    importanceLevel: value as "hard" | "important" | "normal",
                  }))
                }
                options={[
                  { value: "normal", label: "一般" },
                  { value: "important", label: "重点" },
                  { value: "hard", label: "难点" },
                ]}
              />
            </Form.Item>
            <Form.Item label="描述">
              <TextArea
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          open={deleteConfirmOpen}
          onCancel={() => setDeleteConfirmOpen(false)}
          title="确认删除"
          footer={[
            <Button key="cancel" onClick={() => setDeleteConfirmOpen(false)}>
              取消
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              onClick={confirmDelete}
              loading={deleteKnowledgeMutation.isPending}
            >
              删除
            </Button>,
          ]}
        >
          <Text>
            确定要删除知识资源 "{selectedResource?.name}" 吗？此操作无法撤销。
          </Text>
        </Modal>

        {/* 导入知识点弹窗 */}
        <Modal
          open={importModalOpen}
          onCancel={handleCloseImportModal}
          title="导入知识点"
          width={800}
          footer={
            <Space>
              <Button onClick={handleCloseImportModal} disabled={importing}>
                关闭
              </Button>
              {importTabKey === "excel" && selectedFile && !importResult && (
                <Button
                  type="primary"
                  onClick={handleImport}
                  loading={importing}
                  disabled={previewData.length === 0}
                >
                  开始导入
                </Button>
              )}
              {importTabKey === "xmind" && selectedXmindFile && !importResult && (
                <Button
                  type="primary"
                  onClick={handleXmindImport}
                  loading={importing}
                >
                  开始导入
                </Button>
              )}
            </Space>
          }
        >
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">
              当前课程:{" "}
              <Text strong>
                {coursesData.find((c: any) => c.id === selectedCourseId)?.title}
              </Text>
            </Text>
          </div>

          <Tabs
            activeKey={importTabKey}
            onChange={(key) => {
              setImportTabKey(key);
              setImportResult(null);
            }}
            items={[
              {
                key: "excel",
                label: "Excel导入",
                children: (
                  !selectedFile ? (
                    <div style={{ textAlign: "center", padding: 24 }}>
                      <Paragraph>请选择知识点导入 Excel 文件 (.xlsx 或 .xls)</Paragraph>

                      <div style={{ textAlign: "left", marginBottom: 24 }}>
                        <Title level={5}>Excel文件格式要求：</Title>
                        <Table
                          size="small"
                          pagination={false}
                          scroll={{ x: 1200 }}
                          dataSource={[
                            {
                              key: 1,
                              col1: "第一章 概述",
                              col2: "1.1 课程介绍",
                              col3: "1.1.1 基础概念",
                              col4: "",
                              col5: "",
                              col6: "",
                              col7: "",
                              col8: "",
                              col9: "高级应用",
                              col10: "{[数学基础]:依赖关系}",
                              col11: "重点",
                              col12: "理解",
                              col13: "理论",
                              col14: "掌握基本概念",
                              col15: "本知识点介绍...",
                            },
                          ]}
                          columns={[
                            { title: "一级知识点", dataIndex: "col1", width: 80 },
                            { title: "二级知识点", dataIndex: "col2", width: 80 },
                            { title: "三级知识点", dataIndex: "col3", width: 80 },
                            { title: "四级", dataIndex: "col4", width: 60 },
                            { title: "五级", dataIndex: "col5", width: 60 },
                            { title: "六级", dataIndex: "col6", width: 60 },
                            { title: "七级", dataIndex: "col7", width: 60 },
                            { title: "前置知识点", dataIndex: "col8", width: 80 },
                            { title: "后置知识点", dataIndex: "col9", width: 80 },
                            { title: "关联知识点", dataIndex: "col10", width: 120 },
                            { title: "标签", dataIndex: "col11", width: 60 },
                            { title: "认知维度", dataIndex: "col12", width: 70 },
                            { title: "分类", dataIndex: "col13", width: 60 },
                            { title: "教学目标", dataIndex: "col14", width: 90 },
                            { title: "知识点说明", dataIndex: "col15", width: 100 },
                          ]}
                        />
                        <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                          <b>说明：</b><br />
                          1. 一级知识点为必填，支持最多7级知识点嵌套<br />
                          2. 同一行中，上级为空时表示延续上一级<br />
                          3. <b>前置知识点</b>：逗号分隔的知识点名称，表示学习当前知识点前需先掌握的知识<br />
                          4. <b>后置知识点</b>：逗号分隔的知识点名称，表示学习当前知识点后可继续学习的知识<br />
                          5. <b>关联知识点</b>：格式为 {`{[知识点名称]:关联关系}`}，支持多种关系：<br />
                          &nbsp;&nbsp;&nbsp;&nbsp;同义关系、依赖关系、辩证关系、反问关系、前驱关系、并列关系、递进关系<br />
                          &nbsp;&nbsp;&nbsp;&nbsp;示例：{`{[基础知识]:依赖关系}{[概述]:并列关系}`}<br />
                          6. 标签：重点/难点/考点（系统自动判断重要程度）<br />
                          7. 新导入的关系将覆盖该知识点的旧关系
                        </Typography.Paragraph>
                      </div>

                      <Upload
                        accept=".xlsx,.xls"
                        showUploadList={false}
                        beforeUpload={handleFileSelect}
                      >
                        <Button icon={<UploadOutlined />} size="large">
                          选择文件
                        </Button>
                      </Upload>
                    </div>
                  ) : (
                    <div>
                      <Paragraph>
                        已选择文件: <Text strong>{selectedFile.name}</Text>
                      </Paragraph>

                      {previewData.length > 0 && (() => {
                        const PREVIEW_LIMIT = 5;
                        const previewSlice = previewData.slice(0, PREVIEW_LIMIT);
                        return (
                          <>
                            <Title level={5}>
                              预览导入数据（前 {Math.min(PREVIEW_LIMIT, previewData.length)} 个 / 共 {previewData.length} 个知识点）
                            </Title>
                            <Table
                              size="small"
                              dataSource={previewSlice.map((c, i) => ({ ...c, key: i }))}
                              pagination={false}
                              scroll={{ x: 600 }}
                              columns={[
                                {
                                  title: "一级知识点",
                                  dataIndex: "一级知识点",
                                  width: 100,
                                  render: (v: string) => v || "-",
                                },
                                {
                                  title: "二级知识点",
                                  dataIndex: "二级知识点",
                                  width: 100,
                                  render: (v: string) => v || "-",
                                },
                                {
                                  title: "三级知识点",
                                  dataIndex: "三级知识点",
                                  width: 100,
                                  render: (v: string) => v || "-",
                                },
                                {
                                  title: "四级知识点",
                                  dataIndex: "四级知识点",
                                  width: 100,
                                  render: (v: string) => v || "-",
                                },
                                {
                                  title: "五级知识点",
                                  dataIndex: "五级知识点",
                                  width: 100,
                                  render: (v: string) => v || "-",
                                },
                              ]}
                            />
                          </>
                        );
                      })()}

                      {importResult && (
                        <Alert
                          type={importResult.success ? "success" : "error"}
                          message={importResult.message}
                          showIcon
                          style={{ marginTop: 16 }}
                          description={
                            importResult.errors &&
                            importResult.errors.length > 0 && (
                              <div>
                                {importResult.errors.map((item, idx) => (
                                  <div key={idx}>• {item}</div>
                                ))}
                              </div>
                            )
                          }
                        />
                      )}

                      {!importResult && (
                        <Alert
                          type="info"
                          message="确认以上信息无误后，点击开始导入按钮进行导入"
                          style={{ marginTop: 16 }}
                        />
                      )}

                      <div style={{ marginTop: 16 }}>
                        <Button onClick={() => setSelectedFile(null)}>重新选择文件</Button>
                      </div>
                    </div>
                  )
                ),
              },
              {
                key: "xmind",
                label: "XMind导入",
                children: (
                  <div style={{ textAlign: "center", padding: 24 }}>
                    {!selectedXmindFile ? (
                      <>
                        <Paragraph>请选择 XMind 思维导图文件 (.xmind)</Paragraph>
                        <div style={{ textAlign: "left", marginBottom: 24 }}>
                          <Title level={5}>XMind文件格式说明：</Title>
                          <Typography.Paragraph type="secondary">
                            XMind 文件需要包含以主题为根节点的思维导图结构。<br />
                            系统会自动解析XMind中的主题、知识单元和知识点层级。<br />
                            支持从已有的XMind思维导图快速导入知识点结构。
                          </Typography.Paragraph>
                        </div>
                        <Upload
                          accept=".xmind"
                          showUploadList={false}
                          beforeUpload={handleXmindFileSelect}
                        >
                          <Button icon={<UploadOutlined />} size="large">
                            选择XMind文件
                          </Button>
                        </Upload>
                      </>
                    ) : (
                      <div>
                        <Paragraph>
                          已选择文件: <Text strong>{selectedXmindFile.name}</Text>
                        </Paragraph>

                        {importResult && (
                          <Alert
                            type={importResult.success ? "success" : "error"}
                            message={importResult.message}
                            showIcon
                            style={{ marginTop: 16 }}
                            description={
                              importResult.errors &&
                              importResult.errors.length > 0 && (
                                <div>
                                  {importResult.errors.map((item, idx) => (
                                    <div key={idx}>• {item}</div>
                                  ))}
                                </div>
                              )
                            }
                          />
                        )}

                        {!importResult && (
                          <Alert
                            type="info"
                            message="确认文件无误后，点击开始导入按钮进行导入"
                            style={{ marginTop: 16 }}
                          />
                        )}

                        <div style={{ marginTop: 16 }}>
                          <Button onClick={() => setSelectedXmindFile(null)}>重新选择文件</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Modal>

        {/* AI导入知识点弹窗（基于文本生成） */}
        <Modal
          open={aiImportModalOpen}
          onCancel={() => {
            if (!aiImporting) {
              setAiImportModalOpen(false);
              setAiImportResult(null);
              setAiImportText("");
              setAiImportCount(5);
            }
          }}
          title="AI导入知识点"
          width={700}
          footer={
            aiImportResult?.success ? [
              <Button
                key="regenerate"
                onClick={() => setAiImportResult(null)}
              >
                重新生成
              </Button>,
              <Button
                key="confirm"
                type="primary"
                onClick={handleConfirmAiImport}
              >
                确认导入
              </Button>,
            ] : [
              <Button
                key="close"
                onClick={() => {
                  setAiImportModalOpen(false);
                  setAiImportResult(null);
                  setAiImportText("");
                  setAiImportCount(5);
                }}
                disabled={aiImporting}
              >
                关闭
              </Button>,
              <Button
                key="submit"
                type="primary"
                onClick={handleAiImport}
                loading={aiImporting}
                disabled={!aiImportText.trim()}
              >
                {aiImporting ? "生成中..." : "开始生成"}
              </Button>,
            ]
          }
        >
          {!aiImportResult ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">
                  当前课程:{" "}
                  <Text strong>
                    {coursesData.find((c: any) => c.id === selectedCourseId)?.title}
                  </Text>
                </Text>
              </div>
              <Form layout="vertical">
                <Form.Item label="文本内容" required>
                  <TextArea
                    rows={6}
                    placeholder="请输入需要生成知识点的文本内容，例如课程章节、教材内容、教学大纲等..."
                    value={aiImportText}
                    onChange={(e) => setAiImportText(e.target.value)}
                  />
                </Form.Item>
                <Form.Item label={`生成知识点数量: ${aiImportCount}`}>
                  <Slider
                    min={1}
                    max={20}
                    value={aiImportCount}
                    onChange={(value) => setAiImportCount(value)}
                    marks={{
                      1: "1",
                      5: "5",
                      10: "10",
                      15: "15",
                      20: "20",
                    }}
                  />
                </Form.Item>
              </Form>
              <Alert
                type="info"
                message="使用说明"
                description="AI将根据您输入的文本内容，自动分析并生成结构化的知识点。您可以输入课程章节内容、教材摘要或教学大纲文本。"
                style={{ marginTop: 16 }}
              />
            </div>
          ) : aiImportResult.success ? (
            <div>
              <Alert
                type="success"
                message={aiImportResult.message}
                showIcon
                style={{ marginBottom: 16 }}
              />
              {aiImportResult.knowledgePoints && aiImportResult.knowledgePoints.length > 0 && (
                <div>
                  <Text strong style={{ display: 'block', marginBottom: 8 }}>知识点预览：</Text>
                  <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
                    {aiImportResult.knowledgePoints.map((kp: any, index: number) => (
                      <Card
                        key={kp.id || index}
                        size="small"
                        style={{ marginBottom: 8 }}
                        title={kp.name}
                      >
                        <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                          <Text type="secondary">英文：</Text>{kp.enName}
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: 13 }}>{kp.description}</p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Alert
              type="error"
              message={aiImportResult.message}
              showIcon
            />
          )}
        </Modal>

        {/* 删除所有知识点确认弹窗 */}
        <Modal
          open={deleteAllModalOpen}
          onCancel={() => setDeleteAllModalOpen(false)}
          title="确认删除所有知识点"
          footer={[
            <Button key="cancel" onClick={() => setDeleteAllModalOpen(false)} disabled={deletingAll}>
              取消
            </Button>,
            <Button
              key="delete"
              type="primary"
              danger
              onClick={handleDeleteAll}
              loading={deletingAll}
            >
              确认删除
            </Button>,
          ]}
        >
          <Alert
            type="warning"
            showIcon
            message="危险操作"
            description={
              <div>
                <Text>
                  确定要删除课程 "{coursesData.find((c: any) => c.id === selectedCourseId)?.title}" 的所有知识点吗？
                </Text>
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary">
                    此操作将删除 {processedRows.length} 个知识点，包括所有主题、知识单元和知识点。此操作无法撤销！
                  </Text>
                </div>
              </div>
            }
          />
        </Modal>

        {/* 统一的添加知识点模态框 */}
        <Modal
          open={addModalOpen}
          onCancel={() => {
            setAddModalOpen(false);
            setAddModalTarget(null);
            setAddFormData({
              name: "",
              description: "",
              importanceLevel: "normal",
            });
          }}
          title={addModalMode === "child" ? "添加子知识点" : "添加同级知识点"}
          footer={[
            <Button key="cancel" onClick={() => {
              setAddModalOpen(false);
              setAddModalTarget(null);
              setAddFormData({
                name: "",
                description: "",
                importanceLevel: "normal",
              });
            }}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={() => {
                if (addFormData.name.trim() && addModalTarget) {
                  addKnowledgeMutation.mutate({
                    name: addFormData.name.trim(),
                    parentId: addModalTarget.parentId,
                    parentType: addModalTarget.parentType,
                    knowledgeType: addModalTarget.knowledgeType,
                    sortPath: addModalTarget.sortPath || null,
                    description: addFormData.description.trim() || null,
                    importanceLevel: addFormData.importanceLevel,
                  });
                }
              }}
              disabled={!addFormData.name.trim()}
              loading={addKnowledgeMutation.isPending}
            >
              确认
            </Button>,
          ]}
        >
          <Form layout="vertical">
            {addModalTarget && (
              <Form.Item label={addModalMode === "child" ? "父级知识点" : "参考知识点"}>
                <Text strong>{addModalTarget.parentName}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  (类型: {typeMap[addModalTarget.knowledgeType]})
                </Text>
              </Form.Item>
            )}
            <Form.Item label="知识点名称" required>
              <Input
                value={addFormData.name}
                onChange={(e) => setAddFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder={addModalMode === "child" ? "输入子知识点名称" : "输入同级知识点名称"}
                onPressEnter={() => {
                  if (addFormData.name.trim() && addModalTarget) {
                    addKnowledgeMutation.mutate({
                      name: addFormData.name.trim(),
                      parentId: addModalTarget.parentId,
                      parentType: addModalTarget.parentType,
                      knowledgeType: addModalTarget.knowledgeType,
                      sortPath: addModalTarget.sortPath || null,
                      description: addFormData.description.trim() || null,
                      importanceLevel: addFormData.importanceLevel,
                    });
                  }
                }}
                autoFocus
              />
            </Form.Item>
            <Form.Item label="重要程度">
              <Select
                value={addFormData.importanceLevel}
                onChange={(value) => setAddFormData(prev => ({
                  ...prev,
                  importanceLevel: value as "hard" | "important" | "normal"
                }))}
                options={[
                  { value: "normal", label: "一般" },
                  { value: "important", label: "重点" },
                  { value: "hard", label: "难点" },
                ]}
              />
            </Form.Item>
            <Form.Item label="描述（可选）">
              <TextArea
                value={addFormData.description}
                onChange={(e) => setAddFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入知识点描述"
                rows={3}
              />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </>
  );
}
