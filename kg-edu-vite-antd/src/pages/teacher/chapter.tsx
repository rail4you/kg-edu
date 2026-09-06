import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Modal,
  Input,
  Select,
  Tag,
  Typography,
  Alert,
  message,
  Space,
  Table,
  Dropdown,
  Popconfirm,
  Empty,
  Spin,
  Form,
  InputNumber,
  Upload,
  Tooltip,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined,
  MoreOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  CheckOutlined,
  HolderOutlined,
  UploadOutlined,
  DownloadOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  listChapters,
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
  listVideos,
  linkVideoToChapter,
  getFileTemplateBySection,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import * as XLSX from "xlsx";

// 根据 path 生成显示编号
// path 格式: 每级4位，如 "0011", "0021", "00010001"
// 根章节: "0011" → 1, "0021" → 2 (取倒数第二位)
// 子章节: "00010001" → 1.1 (取每段最后一位)
const generateChapterNumber = (path: string | null): string => {
  if (!path) return "";
  
  const numbers: string[] = [];
  
  for (let i = path.length; i >= 4; i -= 4) {
    const segment = path.slice(Math.max(0, i - 4), i);
    let num: string;
    
    if (path.length === 4) {
      // 根章节：取倒数第二位 "0011" → "1", "0021" → "2"
      num = segment.charAt(2);
    } else {
      // 子章节：取最后一位 "0001" → "1"
      num = segment.slice(-1);
    }
    
    if (num && num !== "0") {
      numbers.unshift(num);
    }
  }
  
  return numbers.join(".");
};

// 可排序的行组件
function SortableRow({ children, ...props }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props["data-row-key"] });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    ...props.style,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  );
}

// 扁平化章节树（移到组件外部，避免初始化顺序问题）
function flattenChapters(
  chapters: ChapterRow[],
  level = 0,
): (ChapterRow & { level: number })[] {
  const result: (ChapterRow & { level: number })[] = [];
  chapters.forEach((chapter: any) => {
    // 兼容 children 和 subchapters 两种字段名
    const chapterChildren = chapter.children || chapter.subchapters || [];
    result.push({ ...chapter, level });
    if (chapterChildren.length > 0) {
      result.push(...flattenChapters(chapterChildren, level + 1));
    }
  });
  return result;
}

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

interface ChapterRow {
  id: string;
  title: string;
  description?: string | null;
  sortOrder?: number | null;
  path?: string | null;
  courseId: string;
  parentChapterId?: string | null;
  children?: ChapterRow[];
  course?: { id: string; title: string };
  videos?: any[];
}

interface VideoItem {
  id: string;
  title: string | null;
  duration: number | null;
  thumbnail: string | null;
}

export default function ChapterManagement() {
  const navigate = useNavigate();
  const { user, tenant: authTenant } = useAuth();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const tenant = authTenant || currentTenant?.schemaName || "";
  const { canEdit } = useEditPermission();

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingChapter, setEditingChapter] = useState<ChapterRow | null>(null);
  const [form] = Form.useForm();
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterRow | null>(
    null,
  );
  const [selectedVideo, setSelectedVideo] = useState<VideoItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  const {
    data: chaptersData = [],
    isLoading: chaptersLoading,
    error: chaptersError,
  } = useQuery({
    queryKey: ["chapters", tenant, selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const filter = { courseId: { eq: selectedCourseId } };
      const result = await listChapters({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "sortOrder",
          "path",
          "courseId",
          "parentChapterId",
          {
            subchapters: [
              "id",
              "title",
              "description",
              "sortOrder",
              "path",
              "parentChapterId",
            ],
          },
          { course: ["id", "title"] },
          { videos: ["id", "title", "duration", "thumbnail"] },
        ],
        filter,
        sort: "sortOrder",
        headers: getHeaders(user),
      });

      if (result.success && result.data) {
        const chapters = extractArrayData(result);
        return buildTreeData(chapters);
      }
      throw new Error("加载章节失败");
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const { data: videosData = [], isLoading: videosLoading } = useQuery({
    queryKey: ["available-videos", tenant, selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      try {
        const chaptersResult = await listChapters({
          tenant,
          fields: ["id", "title", "courseId"],
          filter: { courseId: { eq: selectedCourseId } },
          headers: getHeaders(user),
        });

        if (chaptersResult.success && chaptersResult.data) {
          const courseChapters = extractArrayData(chaptersResult);
          const courseChapterIds = courseChapters.map((chapter) => chapter.id);

          const videosResult = await listVideos({
            tenant,
            fields: ["id", "title", "duration", "thumbnail", "chapterId"],
            sort: "title",
            headers: getHeaders(user),
          });

          if (videosResult.success) {
            const allVideos = extractArrayData(videosResult);
            return courseChapterIds.length > 0
              ? allVideos.filter(
                  (video) =>
                    video.chapterId &&
                    courseChapterIds.includes(video.chapterId),
                )
              : [];
          }
        }
        return [];
      } catch (err) {
        console.error("Error loading course videos:", err);
        return [];
      }
    },
    enabled: videoModalOpen && !!selectedCourseId && !!tenant && !!user,
  });

  const buildTreeData = (chapters: any[]): ChapterRow[] => {
    // 创建章节映射
    const chapterMap = new Map<string, any>();
    chapters.forEach((c) => chapterMap.set(c.id, { ...c, children: [] }));

    const roots: ChapterRow[] = [];

    // 构建父子关系
    chapterMap.forEach((chapter) => {
      if (chapter.parentChapterId && chapterMap.has(chapter.parentChapterId)) {
        const parent = chapterMap.get(chapter.parentChapterId);
        parent.children.push(chapter);
      } else if (!chapter.parentChapterId) {
        roots.push(chapter);
      }
    });

    // 递归排序
    const sortChapters = (items: ChapterRow[]) => {
      items.sort((a, b) => (a.path || "").localeCompare(b.path || ""));
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          sortChapters(item.children);
        }
      });
    };

    sortChapters(roots);

    return roots;
  };

  const createChapterMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await createChapter({
        tenant,
        input: {
          title: data.title,
          description: data.description || null,
          courseId: data.courseId,
          parentChapterId: data.parentChapterId || null,
          sortOrder: data.sortOrder || 0,
        },
        fields: [
          "id",
          "title",
          "description",
          "sortOrder",
          "courseId",
          "parentChapterId",
        ],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("创建章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("章节创建成功");
      setEditModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
    },
    onError: () => {
      message.error("创建章节失败");
    },
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      const result = await updateChapter({
        tenant,
        primaryKey: id,
        input: {
          title: input.title,
          description: input.description || null,
          sortOrder: input.sortOrder,
          courseId: input.courseId,
          parentChapterId: input.parentChapterId || null,
        },
        fields: [
          "id",
          "title",
          "description",
          "sortOrder",
          "courseId",
          "parentChapterId",
        ],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("更新章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("章节更新成功");
      setEditModalOpen(false);
      setEditingChapter(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
    },
    onError: () => {
      message.error("更新章节失败");
    },
  });

  const deleteChapterMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteChapter({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("删除章节失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("章节删除成功");
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
    },
    onError: () => {
      message.error("删除章节失败");
    },
  });

  const linkVideoMutation = useMutation({
    mutationFn: async ({
      videoId,
      chapterId,
    }: {
      videoId: string;
      chapterId: string;
    }) => {
      const result = await linkVideoToChapter({
        tenant,
        primaryKey: videoId,
        input: { chapterId },
        fields: ["id", "title", "duration", "thumbnail"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("视频链接失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("视频链接成功");
      setVideoModalOpen(false);
      setSelectedVideo(null);
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      queryClient.invalidateQueries({ queryKey: ["available-videos"] });
    },
    onError: () => {
      message.error("视频链接失败");
    },
  });

  // 拖拽排序 mutation
  const reorderMutation = useMutation({
    mutationFn: async (items: { id: string; newParentId: string | null; newIndex: number }[]) => {
      const result = await reorderChapters({
        tenant,
        items,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("排序失败");
      return result;
    },
    onSuccess: () => {
      message.success("章节排序成功");
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
    },
    onError: () => {
      message.error("章节排序失败");
    },
  });

  // 解析章节导入文件
  const parseChapterFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const chapters: any[] = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as string[];
            if (row.length >= 1 && row[0]) {
              chapters.push({
                level1: row[0] || "",
                level2: row[1] || "",
                level3: row[2] || "",
                level4: row[3] || "",
                level5: row[4] || "",
                description: row[5] || "",
              });
            }
          }
          resolve(chapters);
        } catch (error) {
          reject(new Error("文件解析失败: " + (error instanceof Error ? error.message : "未知错误")));
        }
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsArrayBuffer(file);
    });
  };

  // 下载章节模板
  const handleDownloadTemplate = async () => {
    try {
      const result = await getFileTemplateBySection({
        tenant,
        input: { section: "chapter" },
        fields: ["id", "filePath", "section"],
        headers: getAuthHeaders(user),
      });

      if (result.success && (result.data as any)?.filePath) {
        const link = document.createElement("a");
        link.href = (result.data as any).filePath;
        link.download = "chapter_import_template.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success("模板下载成功");
      } else {
        message.error("无法获取章节模板文件");
      }
    } catch (error) {
      console.error("下载章节模板失败:", error);
      message.error("模板下载失败");
    }
  };

  // 处理文件选择
  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setImportResult(null);
    try {
      const data = await parseChapterFile(file);
      setPreviewData(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "文件解析失败");
    }
    return false;
  };

  // 提交导入
  const handleImport = async () => {
    if (!selectedFile || !selectedCourseId) {
      message.error("请选择文件并选择课程");
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("File", selectedFile);
      formData.append("tenant", tenant);
      formData.append("courseId", selectedCourseId);

      // 只传递 Authorization header，不设置 Content-Type（让浏览器自动设置 multipart/form-data boundary）
      const token = sessionStorage.getItem("jwt_access_token") || user?.token;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/agent/import-chapters", {
        method: "POST",
        headers,
        body: formData,
      });

      const result = await response.json();

      // API 返回的是 Success（大写），需要兼容处理
      const isSuccess = result.success || result.Success;

      if (isSuccess) {
        const importedCount = result.importedResources || result.ImportedResources || 0;
        message.success(`导入成功，共导入 ${importedCount} 个章节`);
        queryClient.invalidateQueries({ queryKey: ["chapters"] });
        // 导入成功后关闭对话框
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
    setPreviewData([]);
    setImportResult(null);
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 查找章节在扁平列表中的位置
  const findChapterPosition = (flatList: ChapterRow[], id: string): number => {
    return flatList.findIndex((c) => c.id === id);
  };

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const flatList = flattenChapters(chaptersData);
    const activePos = findChapterPosition(flatList, active.id as string);
    const overPos = findChapterPosition(flatList, over.id as string);

    if (activePos === -1 || overPos === -1) return;

    const activeChapter = flatList[activePos];
    const overChapter = flatList[overPos];

    // 确定新的父级和索引
    // 如果拖拽到不同层级，需要更新父级
    let newParentId: string | null = overChapter.parentChapterId || null;
    let newIndex = overPos;

    // 如果在同一父级下，直接调整顺序
    if (activeChapter.parentChapterId === overChapter.parentChapterId) {
      // 同级排序
      const siblings = flatList.filter(
        (c) => c.parentChapterId === activeChapter.parentChapterId
      );
      const oldIndex = siblings.findIndex((c) => c.id === active.id);
      const newSiblingIndex = siblings.findIndex((c) => c.id === over.id);

      // 计算新索引（在同一父级下的位置）
      newIndex = newSiblingIndex;
      newParentId = activeChapter.parentChapterId || null;
    } else {
      // 跨级拖拽
      // 计算在目标父级下的新索引
      const targetSiblings = flatList.filter(
        (c) => c.parentChapterId === overChapter.parentChapterId
      );
      newIndex = targetSiblings.findIndex((c) => c.id === over.id);
      if (newIndex === -1) newIndex = targetSiblings.length;
      newParentId = overChapter.parentChapterId || null;
    }

    // 触发排序更新
    reorderMutation.mutate([
      {
        id: active.id as string,
        newParentId,
        newIndex,
      },
    ]);
  }, [chaptersData, flattenChapters, reorderMutation]);

  useEffect(() => {
    const courses = Array.isArray(coursesData) ? coursesData : [];
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [coursesData, selectedCourseId]);

  const handleEditClick = (chapter: ChapterRow) => {
    setEditingChapter(chapter);
    form.setFieldsValue({
      title: chapter.title,
      description: chapter.description || "",
      sortOrder: chapter.sortOrder || 0,
      parentChapterId: chapter.parentChapterId || undefined,
    });
    setEditModalOpen(true);
  };

  const handleAddClick = (parentChapter?: ChapterRow) => {
    setEditingChapter(null);
    form.setFieldsValue({
      title: "",
      description: "",
      courseId: selectedCourseId,
      parentChapterId: parentChapter?.id || undefined,
      sortOrder: 0,
    });
    setEditModalOpen(true);
  };

  const handleDeleteClick = (chapter: ChapterRow) => {
    deleteChapterMutation.mutate(chapter.id);
  };

  const handleVideoLinkClick = (chapter: ChapterRow) => {
    setSelectedChapter(chapter);
    setVideoModalOpen(true);
  };

  const handleVideoSelect = () => {
    if (!selectedChapter || !selectedVideo) return;
    linkVideoMutation.mutate({
      videoId: selectedVideo.id,
      chapterId: selectedChapter.id,
    });
  };

  const handleFormSubmit = (values: any) => {
    const data = {
      ...values,
      courseId: selectedCourseId,
    };

    if (editingChapter) {
      updateChapterMutation.mutate({ id: editingChapter.id, input: data });
    } else {
      createChapterMutation.mutate(data);
    }
  };

  const getActionMenuItems = (chapter: ChapterRow): MenuProps["items"] => [
    {
      key: "edit",
      label: "编辑章节",
      icon: <EditOutlined />,
      onClick: () => handleEditClick(chapter),
    },
    {
      key: "add",
      label: "添加子章节",
      icon: <PlusOutlined />,
      onClick: () => handleAddClick(chapter),
    },
    {
      key: "video",
      label: "链接视频",
      icon: <LinkOutlined />,
      onClick: () => handleVideoLinkClick(chapter),
    },
    {
      type: "divider",
    },
    {
      key: "delete",
      label: "删除章节",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => handleDeleteClick(chapter),
    },
  ];

  const flatChapters = flattenChapters(chaptersData);

  const columns: TableColumnsType<ChapterRow> = [
    {
      title: "章节标题",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: any) => {
        // 兼容 children 和 subchapters 两种字段名
        const children = record.children || record.subchapters || [];
        const hasChildren = children.length > 0;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            <Tag color="blue" style={{ flexShrink: 0 }}>{generateChapterNumber(record.path)}</Tag>
            <FolderOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
            <Tooltip title={text} mouseEnterDelay={0.3}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</span>
            </Tooltip>
            {hasChildren && (
              <Tag color="blue" style={{ flexShrink: 0 }}>
                {children.length} 个子章节
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text: string) => (
        <Text type="secondary" ellipsis style={{ maxWidth: 200 }}>
          {text || "暂无描述"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 280,
      render: (_, record) => (
        <Space>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditClick(record)}
          >
            编辑
          </ReadonlyActionButton>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddClick(record)}
          >
            添加
          </ReadonlyActionButton>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<LinkOutlined />}
            onClick={() => handleVideoLinkClick(record)}
          >
            视频
          </ReadonlyActionButton>
          {canEdit && (
            <Dropdown
              menu={{ items: getActionMenuItems(record) }}
              trigger={["click"]}
            >
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )}
        </Space>
      ),
    },
  ];

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <FolderOutlined style={{ fontSize: 24, color: "#1890ff" }} />
      <Button
                  className="teacher-page-back-btn"
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/teacher/dashboard")}
                  style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
                />
                          <Title level={4} style={{ margin: 0 }}>
          章节管理
        </Title>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程：</Text>
          <Select
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            placeholder="请选择课程"
            style={{ width: 280 }}
            options={(Array.isArray(coursesData) ? coursesData : []).map((course: any) => ({
              value: course.id,
              label: course.title,
            }))}
          />
        </Space>
      </div>

      {chaptersError && (
        <Alert
          type="error"
          message={(chaptersError as Error).message || "加载章节失败"}
          style={{ marginBottom: 16 }}
        />
      )}

      {!selectedCourseId && (
        <Alert
          type="info"
          message="请先选择一个课程以查看和管理章节"
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        style={{
          boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)",
        }}
      >
        {chaptersLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : chaptersData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <Empty description="暂无章节数据，请添加或导入章节" />
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleAddClick()}
                disabled={!selectedCourseId}
                style={canEdit ? undefined : { display: "none" }}
              >
                新建章节
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setImportModalOpen(true)}
                disabled={!selectedCourseId}
                style={canEdit ? undefined : { display: "none" }}
              >
                导入章节模板
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadTemplate}
              >
                下载模板
              </Button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={flatChapters.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <Table
                className="theme-table"
                columns={columns}
                dataSource={chaptersData}
                rowKey="id"
                pagination={false}
                size="middle"
                showHeader={true}
                indentSize={24}
                childrenColumnName="children"
                defaultExpandAllRows
                title={() => (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddClick()}
                        disabled={!selectedCourseId}
                        style={canEdit ? undefined : { display: "none" }}
                      >
                        添加章节
                      </Button>
                      <Button
                        icon={<UploadOutlined />}
                        onClick={() => setImportModalOpen(true)}
                        disabled={!selectedCourseId}
                        style={canEdit ? undefined : { display: "none" }}
                      >
                        导入章节
                      </Button>
                      <Button
                        icon={<DownloadOutlined />}
                        onClick={handleDownloadTemplate}
                      >
                        下载模板
                      </Button>
                    </Space>
                  </div>
                )}
                components={{
                  body: {
                    row: ({ children, ...props }: any) => {
                      return <SortableRow {...props}>{children}</SortableRow>;
                    },
                  },
                }}
              />
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Modal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingChapter(null);
          form.resetFields();
        }}
        title={editingChapter ? "编辑章节" : "添加新章节"}
        width={600}
        onOk={() => form.submit()}
        confirmLoading={
          createChapterMutation.isPending || updateChapterMutation.isPending
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFormSubmit}
          initialValues={{ sortOrder: 0 }}
        >
          <Form.Item
            name="title"
            label="章节标题"
            rules={[{ required: true, message: "请输入章节标题" }]}
          >
            <Input placeholder="请输入章节标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={4} placeholder="请输入章节的详细描述..." />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="parentChapterId" label="父章节">
            <Select
              placeholder="选择父章节（可选）"
              allowClear
              options={flatChapters
                .filter((chapter) => !chapter.parentChapterId)
                .map((chapter) => {
                  const chapterNum = generateChapterNumber(chapter.path);
                  const displayTitle = chapter.title || `章节 (${chapter.id.slice(0, 8)})`;
                  return {
                    value: chapter.id,
                    label: chapterNum ? `${chapterNum}. ${displayTitle}` : displayTitle,
                  };
                })}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={videoModalOpen}
        onCancel={() => {
          setVideoModalOpen(false);
          setSelectedVideo(null);
        }}
        title={`为章节 "${selectedChapter?.title}" 选择视频`}
        width={600}
        onOk={handleVideoSelect}
        confirmLoading={linkVideoMutation.isPending}
        okButtonProps={{ disabled: !selectedVideo }}
      >
        <div style={{ marginTop: 16 }}>
          {videosLoading ? (
            <div style={{ textAlign: "center", padding: 24 }}>
              <Spin />
            </div>
          ) : videosData.length === 0 ? (
            <Empty description="暂无可用的视频" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {videosData.map((video: VideoItem) => (
                <div
                  key={video.id}
                  onClick={() => setSelectedVideo(video)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: 12,
                    border:
                      selectedVideo?.id === video.id
                        ? "2px solid #1890ff"
                        : "1px solid #d9d9d9",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "all 0.3s",
                  }}
                >
                  <VideoCameraOutlined
                    style={{ marginRight: 12, fontSize: 20, color: "#1890ff" }}
                  />
                  <div style={{ flex: 1 }}>
                    <Text strong>{video.title || "未命名视频"}</Text>
                    {video.duration && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          时长: {Math.floor(video.duration / 60)}:
                          {(video.duration % 60).toString().padStart(2, "0")}
                        </Text>
                      </div>
                    )}
                  </div>
                  {selectedVideo?.id === video.id && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        backgroundColor: "#1890ff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CheckOutlined style={{ color: "white", fontSize: 12 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={importModalOpen}
        onCancel={handleCloseImportModal}
        title="导入章节"
        width={800}
        footer={
          <Space>
            <Button onClick={handleCloseImportModal} disabled={importing}>
              关闭
            </Button>
            {selectedFile && !importResult && (
              <Button
                type="primary"
                onClick={handleImport}
                loading={importing}
                disabled={previewData.length === 0}
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
              {(Array.isArray(coursesData) ? coursesData : []).find((c: any) => c.id === selectedCourseId)?.title}
            </Text>
          </Text>
        </div>

        {!selectedFile ? (
          <div style={{ textAlign: "center", padding: 24 }}>
            <Paragraph>请选择章节导入 Excel 文件 (.xlsx 或 .xls)</Paragraph>

            <div style={{ textAlign: "left", marginBottom: 24 }}>
              <Title level={5}>Excel文件格式要求：</Title>
              <Table
                size="small"
                pagination={false}
                dataSource={[
                  {
                    key: 1,
                    a: "第一章 概述",
                    b: "1.1 课程介绍",
                    c: "",
                    d: "",
                    e: "",
                    f: "本章介绍课程目标",
                  },
                  {
                    key: 2,
                    a: "",
                    b: "1.2 基础知识",
                    c: "",
                    d: "",
                    e: "",
                    f: "",
                  },
                  {
                    key: 3,
                    a: "",
                    b: "",
                    c: "1.2.1 概念定义",
                    d: "",
                    e: "",
                    f: "",
                  },
                ]}
                columns={[
                  { title: "一级章节", dataIndex: "a", width: 120 },
                  { title: "二级章节", dataIndex: "b", width: 120 },
                  { title: "三级章节", dataIndex: "c", width: 120 },
                  { title: "四级章节", dataIndex: "d", width: 120 },
                  { title: "五级章节", dataIndex: "e", width: 80 },
                  { title: "章节说明", dataIndex: "f", width: 150 },
                ]}
              />
              <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
                说明：<br />
                1. 第一列（一级章节）为必填<br />
                2. 支持最多5级章节嵌套<br />
                3. 同一行中，上级章节为空时表示延续上一级的章节<br />
                4. 章节说明为可选项
              </Paragraph>
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

            {previewData.length > 0 && (
              <>
                <Title level={5}>
                  预览导入数据 ({previewData.length} 个章节)
                </Title>
                <Table
                  size="small"
                  dataSource={previewData.map((c, i) => ({ ...c, key: i }))}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 600 }}
                  columns={[
                    {
                      title: "一级章节",
                      dataIndex: "level1",
                      width: 120,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "二级章节",
                      dataIndex: "level2",
                      width: 120,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "三级章节",
                      dataIndex: "level3",
                      width: 120,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "四级章节",
                      dataIndex: "level4",
                      width: 120,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "五级章节",
                      dataIndex: "level5",
                      width: 80,
                      render: (v: string) => v || "-",
                    },
                    {
                      title: "说明",
                      dataIndex: "description",
                      width: 150,
                      ellipsis: true,
                    },
                  ]}
                />
              </>
            )}

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
        )}
      </Modal>
    </div>
  );
}
