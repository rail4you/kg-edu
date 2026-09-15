import { useNavigate } from "react-router-dom";
import React, { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Table,
  Button,
  Modal,
  Input,
  Select,
  Tag,
  Alert,
  message,
  Space,
  List,
  Avatar,
  Progress,
  Form,
  Popconfirm,
  Spin,
} from "antd";
import type { TableProps } from "antd";
import {
  CloudUploadOutlined,
  DeleteOutlined,
  DownloadOutlined,
  FileTextOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  StopOutlined,
  EyeOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MenuOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import {
  listFiles,
  deleteFile,
  createFile,
  reorderFiles,
  type ListFilesFields,
  type CreateFileFields,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import {
  getSTSToken,
  uploadFileToOSS,
  uploadFileViaServer,
} from "@/lib/oss-upload";
import FilePreview from "@/components/FilePreview";
import type { UploadProgress } from "@/lib/oss-upload";

const { Title, Text } = Typography;

const FILE_FIELDS: ListFilesFields = [
  "id",
  "filename",
  "path",
  "size",
  "fileType",
  "purpose",
  "knowledgeResourceId",
  "courseId",
  "assetId",
  "playbackId",
  "sortOrder",
  "insertedAt",
];

type FileType = {
  id: string;
  filename: string;
  path: string;
  size: number;
  fileType: string;
  purpose: string;
  knowledgeResourceId: string | null;
  courseId: string | null;
  assetId: string | null;
  playbackId: string | null;
  sortOrder: number | null;
  insertedAt?: string | null;
};

export default function FileManagement() {
  const navigate = useNavigate();
  const { canEdit } = useEditPermission();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [currentUploadingFile, setCurrentUploadingFile] = useState<string>("");
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const [isUploadCancelled, setIsUploadCancelled] = useState(false);
  const cancelRef = useRef(false);
  const [completedUploads, setCompletedUploads] = useState<string[]>([]);
  const [failedUploads, setFailedUploads] = useState<
    { filename: string; error: string }[]
  >([]);
  const [duplicateFiles, setDuplicateFiles] = useState<string[]>([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [form] = Form.useForm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  // 使用统一的课程获取 hook
  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const {
    data: filesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["files", tenant, selectedCourseId],
    queryFn: async () => {
      const baseFilter = { createdById: { eq: user?.id } };
      const filter = selectedCourseId
        ? { and: [baseFilter, { courseId: { eq: selectedCourseId } }] }
        : baseFilter;

      const response = await listFiles({
        tenant,
        fields: FILE_FIELDS,
        filter,
        page: { limit: 1000, offset: 0 },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (response.success) {
        return response.data;
      }
      throw new Error("Failed to fetch files");
    },
    enabled: !!tenant && !!user,
  });

  const fileList = extractArrayData(filesData);

  // 手动排序状态：以 sortOrder 为基准的完整顺序（学生端也将沿用此顺序）
  const [orderedFiles, setOrderedFiles] = useState<FileType[]>([]);
  // 列排序状态（受控，AntD Table 原生排序）
  const [sortedInfo, setSortedInfo] = useState<{
    columnKey?: string;
    order?: "ascend" | "descend";
  }>({});
  const [isReordering, setIsReordering] = useState(false);

  // 当服务端数据变化时同步手动排序顺序。
  // 注意：依赖 `filesData`（TanStack Query 的稳定内存引用），并用函数式更新
  // 防止数组引用变化导致无限循环（Maximum update depth exceeded）。
  useEffect(() => {
    const ordered = [...fileList].sort((a, b) => {
      const oa = a.sortOrder ?? 2_000_000_000;
      const ob = b.sortOrder ?? 2_000_000_000;
      if (oa !== ob) return oa - ob;
      // 同权重时按上传时间倒序（最新在前）
      const ta = a.insertedAt ? new Date(a.insertedAt).getTime() : 0;
      const tb = b.insertedAt ? new Date(b.insertedAt).getTime() : 0;
      return tb - ta;
    });
    setOrderedFiles((prev) => {
      // 内容未变化时返回原引用，避免触发多余渲染/循环
      if (
        prev.length === ordered.length &&
        prev.every((f, i) => f.id === ordered[i]?.id)
      ) {
        return prev;
      }
      return ordered;
    });
  }, [filesData]);

  // 持久化手动排序到后端（学生端同步）
  const persistOrder = async (nextOrder: FileType[]) => {
    const items = nextOrder.map((f, i) => ({
      id: f.id,
      order: i + 1,
    }));
    setIsReordering(true);
    try {
      const result = await reorderFiles({
        tenant,
        input: { items },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        setOrderedFiles(nextOrder.map((f, i) => ({ ...f, sortOrder: i + 1 })));
      } else {
        message.error("排序保存失败，请重试");
      }
    } catch (e: any) {
      message.error(e?.message || "排序保存失败，请重试");
    } finally {
      setIsReordering(false);
    }
  };

  const moveFile = async (record: FileType, direction: "up" | "down") => {
    const idx = displayList.findIndex((f) => f.id === record.id);
    if (idx === -1) return;
    const target = direction === "up" ? idx - 1 : idx + 1;
    if (target < 0 || target >= displayList.length) return;
    const next = [...displayList];
    [next[idx], next[target]] = [next[target], next[idx]];
    // 若处于列排序视图，点击上下移将切换到手动排序
    if (sortedInfo.order) {
      message.info("已切换到手动排序");
    }
    setSortedInfo({});
    await persistOrder(next);
  };

  // 当前是否为手动排序模式（未按列排序时）。
  // 手动模式下保持 sort_order 顺序，可用于上移/下移。
  const isManualMode = !sortedInfo.order;
  // 是否已建立手动顺序（存在非默认大值的 sortOrder）
  const hasManualOrder = orderedFiles.some(
    (f) => (f.sortOrder ?? 0) > 0 && (f.sortOrder ?? 0) < 2_000_000_000
  );

  // 表格实际展示顺序：手动模式 = orderedFiles；列排序时镜像 AntD 的排序结果。
  // 用于上移/下移按钮的边界判断与移动（与当前看到的位置一致）。
  const displayList = useMemo(() => {
    if (!sortedInfo.order || !sortedInfo.columnKey) return orderedFiles;
    const dir = sortedInfo.order === "ascend" ? 1 : -1;
    const list = [...orderedFiles];
    list.sort((a, b) => {
      switch (sortedInfo.columnKey) {
        case "filename":
          return (a.filename || "").localeCompare(b.filename || "") * dir;
        case "fileType":
          return (
            getFileExtension(a.filename).localeCompare(getFileExtension(b.filename)) * dir
          );
        case "size":
          return ((a.size || 0) - (b.size || 0)) * dir;
        case "insertedAt":
          return (
            (new Date(a.insertedAt || 0).getTime() || 0) -
              (new Date(b.insertedAt || 0).getTime() || 0)
          ) * dir;
        default:
          return 0;
      }
    });
    return list;
  }, [orderedFiles, sortedInfo]);

  // 每行在展示顺序中的位置（用于禁用首/尾行的上/下移）
  const getDisplayIndex = (record: FileType) =>
    displayList.findIndex((f) => f.id === record.id);

  const handleSingleFileUpload = async (
    file: File,
    purpose?: string,
  ): Promise<{ success: boolean; filename: string; error?: string }> => {
    if (!selectedCourseId) {
      return { success: false, filename: file.name, error: "请先选择一个课程" };
    }

    const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
    setCurrentUploadingFile(file.name);
    setUploadProgress((prev) => ({ ...prev, [fileKey]: 0 }));

    const abortController = new AbortController();
    setCurrentAbortController(abortController);

    if (cancelRef.current) {
      abortController.abort();
      return { success: false, filename: file.name, error: "已取消上传" };
    }

    try {
      let ossResult: { url: string; name: string };

      if (cancelRef.current) {
        abortController.abort();
        return { success: false, filename: file.name, error: "已取消上传" };
      }

      try {
        const stsResponse = await getSTSToken(file.name, file.size, file.type);

        if (!stsResponse.success) {
          throw new Error(stsResponse.error || "获取上传凭证失败");
        }

        ossResult = await uploadFileToOSS(stsResponse, {
          file,
          onProgress: (progress: UploadProgress) => {
            setUploadProgress((prev) => ({
              ...prev,
              [fileKey]: Math.min(progress.percent, 90),
            }));
          },
          signal: abortController.signal,
        });
      } catch (ossError) {
        if (cancelRef.current) {
          abortController.abort();
          return { success: false, filename: file.name, error: "已取消上传" };
        }

        console.warn(
          "Direct OSS upload failed, falling back to server upload:",
          ossError,
        );

        setUploadProgress((prev) => ({
          ...prev,
          [fileKey]: 25,
        }));

        ossResult = await uploadFileViaServer(file, {
          onProgress: (progress: UploadProgress) => {
            setUploadProgress((prev) => ({
              ...prev,
              [fileKey]: Math.min(25 + Math.floor(progress.percent * 0.65), 90),
            }));
          },
          signal: abortController.signal,
        });
      }

      if (cancelRef.current) {
        abortController.abort();
        return { success: false, filename: file.name, error: "已取消上传" };
      }

      setUploadProgress((prev) => ({
        ...prev,
        [fileKey]: 95,
      }));

      const createFileResult = await createFile({
        tenant: tenant,
        input: {
          filename: file.name,
          path: ossResult.url,
          size: file.size,
          fileType: file.type,
          purpose: purpose || "general",
          courseId: selectedCourseId,
          knowledgeResourceId: null,
          createdById: user?.id,
        },
        fields: FILE_FIELDS as CreateFileFields,
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (!createFileResult.success) {
        throw new Error("创建文件记录失败");
      }

      setUploadProgress((prev) => ({
        ...prev,
        [fileKey]: 100,
      }));

      setCompletedUploads((prev) => [...prev, file.name]);
      setCurrentAbortController(null);
      return { success: true, filename: file.name };
    } catch (error: any) {
      const isAborted = error?.name === "AbortError" || error?.message === "canceled" || error?.error === "已取消上传";
      if (isAborted || cancelRef.current) {
        setCurrentAbortController(null);
        return { success: false, filename: file.name, error: "已取消上传" };
      }
      const errorMessage = error instanceof Error ? error.message : "上传失败";
      setFailedUploads((prev) => [
        ...prev,
        { filename: file.name, error: errorMessage },
      ]);
      setCurrentAbortController(null);
      return { success: false, filename: file.name, error: errorMessage };
    } finally {
      setCurrentAbortController(null);
    }
  };

  const handleBatchUpload = async (purpose?: string, filesToUpload?: File[]) => {
    const files = filesToUpload || selectedFiles;

    if (!selectedCourseId) {
      message.warning("请先选择一个课程");
      return;
    }

    setIsUploading(true);
    setCompletedUploads([]);
    setFailedUploads([]);
    setUploadProgress({});
    setIsUploadCancelled(false);
    cancelRef.current = false;

    const uploadPromises = files.map((file) =>
      handleSingleFileUpload(file, purpose),
    );

    try {
      const results = await Promise.allSettled(uploadPromises);

      if (cancelRef.current) {
        message.info("已取消上传");
        setIsUploading(false);
        setIsUploadCancelled(false);
        cancelRef.current = false;
        return;
      }

      let successful = 0;
      let failed = 0;

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success) {
            successful++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      });

      queryClient.invalidateQueries({
        queryKey: ["files", tenant],
      });

      setUploadDialogOpen(false);
      setSelectedFiles([]);
      form.resetFields();
      setUploadProgress({});

      if (successful > 0 && failed === 0) {
        message.success(`成功上传 ${successful} 个文件`);
      } else if (successful > 0 && failed > 0) {
        message.warning(
          `成功上传 ${successful} 个文件，${failed} 个文件上传失败`,
        );
      } else {
        message.error(`所有文件上传失败 (${failed} 个文件)`);
      }
    } catch (error: any) {
      console.error("Batch upload error:", error);
      const isCancelled = cancelRef.current || error?.error === "已取消上传" || error?.message === "canceled" || error?.name === "AbortError";
      if (isCancelled) {
        message.info("已取消上传");
        setIsUploadCancelled(false);
        cancelRef.current = false;
        setIsUploading(false);
        setCurrentUploadingFile("");
        return;
      }
      message.error("批量上传过程中发生错误");
    } finally {
      setIsUploading(false);
      setCurrentUploadingFile("");
      setCompletedUploads([]);
      setFailedUploads([]);
      setIsUploadCancelled(false);
      cancelRef.current = false;
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (fileId: string) =>
      deleteFile({
        tenant: tenant,
        primaryKey: fileId,
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["files", tenant],
      });
      message.success("文件删除成功");
    },
    onError: (error: any) => {
      let errorMessage = "文件删除失败";
      if (error?.errors?.[0]?.message) {
        errorMessage = error.errors[0].message;
      } else if (error?.message) {
        errorMessage = error.message;
      }
      message.error(errorMessage);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      const currentCount = selectedFiles.length;
      const maxAdd = 10 - currentCount;
      if (maxAdd <= 0) {
        message.warning("最多只能选择10个文件");
        return;
      }
      const filesToAdd = files.slice(0, maxAdd);
      if (files.length > maxAdd) {
        message.warning(`最多只能选择10个文件，已自动选择${maxAdd}个`);
      }
      setSelectedFiles((prev) => [...prev, ...filesToAdd]);
    }
    // 清空 input 值，允许重新选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCancelUpload = () => {
    cancelRef.current = true;
    setIsUploadCancelled(true);
    if (currentAbortController) {
      currentAbortController.abort();
      setCurrentAbortController(null);
    }
    setIsUploading(false);
    setCurrentUploadingFile("");
    message.info("正在取消上传...");
  };

  const clearSelectedFiles = () => {
    setSelectedFiles([]);
    setUploadProgress({});
    setCompletedUploads([]);
    setFailedUploads([]);
  };

  const checkDuplicateFilenames = (files: File[]): string[] => {
    const existingFilenames = new Set(fileList.map((f) => f.filename));
    const duplicates = files
      .filter((file) => existingFilenames.has(file.name))
      .map((file) => file.name);
    return duplicates;
  };

  const handleUploadWithDuplicateCheck = (values: { purpose?: string }) => {
    if (selectedFiles.length === 0) {
      message.warning("请先选择文件");
      return;
    }

    if (!selectedCourseId) {
      message.warning("请先选择一个课程");
      return;
    }

    const duplicates = checkDuplicateFilenames(selectedFiles);
    if (duplicates.length > 0) {
      setDuplicateFiles(duplicates);
      setShowDuplicateModal(true);
      return;
    }

    handleUpload(values, selectedFiles);
  };

  const handleSkipDuplicates = (values: { purpose?: string }) => {
    const nonDuplicateFiles = selectedFiles.filter(
      (file) => !duplicateFiles.includes(file.name),
    );
    setShowDuplicateModal(false);
    setDuplicateFiles([]);
    if (nonDuplicateFiles.length > 0) {
      handleUpload(values, nonDuplicateFiles);
    } else {
      message.info("没有需要上传的文件");
    }
  };

  const handleUpload = (values: { purpose?: string }, filesToUpload?: File[]) => {
    const files = filesToUpload || selectedFiles;

    if (files.length === 0) {
      message.warning("请先选择文件");
      return;
    }

    if (!selectedCourseId) {
      message.warning("请先选择一个课程");
      return;
    }

    const maxSize = 500 * 1024 * 1024;
    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/gif",
      "text/plain",
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/wmv",
      "video/flv",
      "video/webm",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    const sizeErrors = files
      .filter((file) => file.size > maxSize)
      .map((file) => file.name);
    const typeErrors = files
      .filter((file) => !allowedTypes.includes(file.type))
      .map((file) => file.name);

    if (sizeErrors.length > 0 || typeErrors.length > 0) {
      let errorMessage = "";
      if (sizeErrors.length > 0) {
        errorMessage += `文件大小超过500MB限制: ${sizeErrors.join(", ")} `;
      }
      if (typeErrors.length > 0) {
        errorMessage += `不支持的文件类型: ${typeErrors.join(", ")}`;
      }
      message.error(errorMessage);
      return;
    }

    handleBatchUpload(values.purpose, files);
  };

  const handleDelete = (fileId: string) => {
    deleteMutation.mutate(fileId);
  };

  const getDownloadUrl = (file: FileType) => {
    if (file.path) {
      if (file.path.startsWith("http://") || file.path.startsWith("https://")) {
        return file.path;
      }
      const normalizedPath = file.path.startsWith("/")
        ? file.path
        : `/${file.path}`;
      return normalizedPath;
    }
    return `/api/files/${file.id}/download`;
  };

  const handleDownload = (file: FileType) => {
    try {
      const downloadUrl = getDownloadUrl(file);

      const isOssUrl =
        downloadUrl.includes("oss-cn-beijing.aliyuncs.com") ||
        downloadUrl.includes("aliyuncs.com") ||
        downloadUrl.startsWith("https://");

      if (isOssUrl) {
        window.open(downloadUrl, "_blank", "noopener,noreferrer");
        message.success("正在打开文件链接，新标签页将开始下载");
      } else {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = file.filename;

        if (
          file.fileType?.includes("image") ||
          file.fileType?.includes("pdf") ||
          file.fileType?.includes("text")
        ) {
          window.open(downloadUrl, "_blank", "noopener,noreferrer");
        } else {
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        message.success("文件下载已开始");
      }
    } catch (error) {
      console.error("Download error:", error);
      message.error("文件下载失败，请重试");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const getFileExtension = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return ext ? ext.toUpperCase() : "文件";
  };

  const getFileTypeColor = (fileType: string): string => {
    const type = fileType.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp"].includes(type)) return "blue";
    if (["mp4", "webm", "avi", "mov", "mkv", "wmv", "flv"].includes(type)) return "purple";
    if (type === "pdf") return "red";
    if (["doc", "docx"].includes(type)) return "green";
    if (["xls", "xlsx"].includes(type)) return "orange";
    if (["ppt", "pptx"].includes(type)) return "magenta";
    if (type === "txt") return "cyan";
    return "default";
  };

  const columns: TableProps<FileType>["columns"] = [
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
      width: 250,
      ellipsis: true,
      sorter: (a: FileType, b: FileType) =>
        (a.filename || "").localeCompare(b.filename || ""),
      sortOrder:
        sortedInfo.columnKey === "filename" ? sortedInfo.order : undefined,
    },
    {
      title: "类型",
      key: "fileType",
      width: 100,
      align: "center",
      sorter: (a: FileType, b: FileType) =>
        getFileExtension(a.filename).localeCompare(getFileExtension(b.filename)),
      sortOrder:
        sortedInfo.columnKey === "fileType" ? sortedInfo.order : undefined,
      render: (_: unknown, record: FileType) => {
        const ext = getFileExtension(record.filename);
        return <Tag color={getFileTypeColor(ext)}>{ext}</Tag>;
      },
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      width: 100,
      align: "center",
      sorter: (a: FileType, b: FileType) => (a.size || 0) - (b.size || 0),
      sortOrder: sortedInfo.columnKey === "size" ? sortedInfo.order : undefined,
      render: (size: number) => <Text>{formatFileSize(size)}</Text>,
    },
    {
      title: "上传时间",
      dataIndex: "insertedAt",
      key: "insertedAt",
      width: 150,
      align: "center",
      sorter: (a: FileType, b: FileType) =>
        (new Date(a.insertedAt || 0).getTime() || 0) -
        (new Date(b.insertedAt || 0).getTime() || 0),
      sortOrder:
        sortedInfo.columnKey === "insertedAt" ? sortedInfo.order : undefined,
      render: (t?: string) => <Text>{formatDateTime(t)}</Text>,
    },
    {
      title: "用途",
      dataIndex: "purpose",
      key: "purpose",
      width: 120,
      align: "center",
      ellipsis: true,
      render: (purpose: string) => {
        const purposeMap: Record<string, string> = {
          course_material: "课程资料",
          assignment: "作业",
          resource: "资源",
          other: "其他",
          general: "通用",
        };
        return purposeMap[purpose] || purpose || "-";
      },
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      align: "center",
      render: (_: unknown, record: FileType) => (
        <Space>
          {canEdit && (
            <Space size={0}>
              <Button
                type="text"
                icon={<ArrowUpOutlined />}
                disabled={isReordering || getDisplayIndex(record) <= 0}
                onClick={() => moveFile(record, "up")}
                title={
                  getDisplayIndex(record) <= 0
                    ? "已是第一个资源，无法上移"
                    : "上移（切换到手动排序）"
                }
              />
              <Button
                type="text"
                icon={<ArrowDownOutlined />}
                disabled={
                  isReordering ||
                  getDisplayIndex(record) < 0 ||
                  getDisplayIndex(record) >= displayList.length - 1
                }
                onClick={() => moveFile(record, "down")}
                title={
                  getDisplayIndex(record) >= displayList.length - 1
                    ? "已是最后一个资源，无法下移"
                    : "下移（切换到手动排序）"
                }
              />
            </Space>
          )}
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => {
              const downloadUrl = getDownloadUrl(record);
              setPreviewFile({
                url: downloadUrl,
                name: record.filename,
                type: record.fileType || "",
              });
              setPreviewOpen(true);
            }}
            title="预览文件"
          />
          <Button
            type="text"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
            title="下载文件"
          />
            <Popconfirm
              title="确定删除此文件?"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <ReadonlyActionButton
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!tenant) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          message="未选择租户或租户配置不完整"
          description="请先选择一个租户（组织）才能管理文件资源。如果已选择租户但仍显示此消息，请联系管理员确保租户配置了正确的数据库模式。"
          showIcon
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 16,
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
          资源管理
        </Title>
      </div>

      {/* 课程选择独立一行 */}
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程：</Text>
          <Select
            value={selectedCourseId}
            onChange={(value) => {
              setSelectedCourseId(value);
            }}
            loading={coursesLoading}
            placeholder="请选择课程"
            style={{ width: 280 }}
            allowClear
          >
            {(Array.isArray(courses) ? courses : []).map((course: any) => (
              <Select.Option key={course.id} value={course.id}>
                {course.title}
              </Select.Option>
            ))}
          </Select>
          {selectedCourseId && (
            <Button
              type="link"
              size="small"
              onClick={() => {
                setSelectedCourseId("");
              }}
            >
              清除
            </Button>
          )}
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          message={
            error instanceof Error ? error.message : "Failed to load files"
          }
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <Card>
        <Table
          className="theme-table"
          columns={columns}
          dataSource={orderedFiles}
          rowKey="id"
          loading={isLoading || isReordering}
          onChange={(_, __, sorter: any) => {
            const s = Array.isArray(sorter) ? sorter[0] : sorter;
            if (s && s.order) {
              setSortedInfo({ columnKey: s.columnKey as string, order: s.order });
            } else {
              setSortedInfo({});
            }
          }}
          title={() => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Space>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={() => setUploadDialogOpen(true)}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  批量上传
                </Button>
                {canEdit && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "2px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      border: "1px solid #c5c9cf",
                      background: "#f5f6f8",
                      color: "#555c66",
                    }}
                  >
                    {!isManualMode ? (
                      <>
                        <SortAscendingOutlined />
                        按{
                          sortedInfo.columnKey === "filename"
                            ? "文件名"
                            : sortedInfo.columnKey === "fileType"
                              ? "类型"
                              : sortedInfo.columnKey === "size"
                                ? "大小"
                                : sortedInfo.columnKey === "insertedAt"
                                  ? "上传时间"
                                  : "列"
                        }排序
                      </>
                    ) : hasManualOrder ? (
                      <>
                        <MenuOutlined />
                        手动排序
                      </>
                    ) : (
                      <>
                        <MenuOutlined />
                        上传时间倒序
                      </>
                    )}
                  </span>
                )}
              </Space>
            </div>
          )}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={
          <span>
            批量上传文件
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              (最多10个文件，每个文件不超过100MB)
            </Text>
          </span>
        }
        open={uploadDialogOpen}
        onCancel={() => {
          setUploadDialogOpen(false);
          setSelectedFiles([]);
          form.resetFields();
          setUploadProgress({});
          setCompletedUploads([]);
          setFailedUploads([]);
        }}
        footer={null}
        width={600}
      >
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          message={
            <div>
              <Text strong>支持的文件类型：</Text>
              <br />
              <Text type="secondary">
                文档：PDF、DOC、DOCX、TXT
                <br />
                表格：XLS、XLSX
                <br />
                演示文稿：PPT、PPTX
                <br />
                图片：JPG、JPEG、PNG、GIF
                <br />
                视频：MP4、AVI、MOV、WMV、FLV、WEBM
              </Text>
            </div>
          }
        />
        {isUploading && (
          <Progress
            percent={Object.values(uploadProgress)[0] || 0}
            status="active"
            style={{ marginBottom: 16 }}
          />
        )}
        <Form form={form} layout="vertical" onFinish={handleUploadWithDuplicateCheck} style={{ marginTop: 16 }}>
          {selectedCourseId ? (
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message={
                <div>
                  <Text type="secondary">上传到课程:</Text>
                  <br />
                  <Text strong>
                    {courses.find((c: any) => c.id === selectedCourseId)?.title}
                  </Text>
                </div>
              }
            />
          ) : (
            <Alert
              type="warning"
              message="请先选择一个课程后再上传文件"
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <div style={{ marginBottom: 16 }}>
            <input
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt,.mp4,.avi,.mov,.wmv,.flv,.webm,.ppt,.pptx,.xls,.xlsx"
              id="file-upload"
              type="file"
              multiple
              style={{ display: "none" }}
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            <Button
              icon={<CloudUploadOutlined />}
              disabled={isUploading}
              block
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading
                ? "上传中..."
                : `选择文件 (${selectedFiles.length}/10)`}
            </Button>
          </div>

          {selectedFiles.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <Text type="secondary">
                  已选择 {selectedFiles.length} 个文件
                </Text>
                <Button
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={clearSelectedFiles}
                  disabled={isUploading}
                >
                  清除全部
                </Button>
              </div>

              <List
                dataSource={selectedFiles}
                style={{
                  maxHeight: 200,
                  overflow: "auto",
                  backgroundColor: "#fafafa",
                  borderRadius: 8,
                }}
                renderItem={(file, index) => {
                  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                  const progress = uploadProgress[fileKey] || 0;
                  const isCompleted = completedUploads.includes(file.name);
                  const hasError = failedUploads.find(
                    (f) => f.filename === file.name,
                  );
                  const isUploadingFile = currentUploadingFile === file.name;

                  return (
                    <List.Item
                      actions={[
                        isUploadingFile ? (
                          <Button
                            key="cancel"
                            type="text"
                            size="small"
                            danger
                            icon={<StopOutlined />}
                            onClick={handleCancelUpload}
                            title="取消上传"
                          />
                        ) : (
                          <Button
                            key="remove"
                            type="text"
                            size="small"
                            icon={<CloseOutlined />}
                            onClick={() => handleRemoveFile(index)}
                            title="删除"
                          />
                        ),
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar
                            icon={<FileTextOutlined />}
                            style={{ backgroundColor: "#1890ff" }}
                          />
                        }
                        title={file.name}
                        description={
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {formatFileSize(file.size)} | {getFileExtension(file.name)}
                            </Text>

                            {isUploading && isUploadingFile && (
                              <div style={{ marginTop: 4 }}>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {progress < 25
                                    ? "获取凭证..."
                                    : progress < 90
                                      ? "上传中..."
                                      : progress < 100
                                        ? "保存中..."
                                        : "完成!"}{" "}
                                  {progress}%
                                </Text>
                                <Progress
                                  percent={progress}
                                  size="small"
                                  showInfo={false}
                                />
                              </div>
                            )}

                            {isCompleted && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  marginTop: 4,
                                }}
                              >
                                <CheckCircleOutlined
                                  style={{ color: "#52c41a", marginRight: 4 }}
                                />
                                <Text
                                  style={{ color: "#52c41a", fontSize: 12 }}
                                >
                                  上传成功
                                </Text>
                              </div>
                            )}

                            {hasError && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  marginTop: 4,
                                }}
                              >
                                <CloseCircleOutlined
                                  style={{ color: "#ff4d4f", marginRight: 4 }}
                                />
                                <Text type="danger" style={{ fontSize: 12 }}>
                                  {hasError.error}
                                </Text>
                              </div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>
          )}

          {isUploading &&
            (completedUploads.length > 0 || failedUploads.length > 0) && (
              <Alert
                type="info"
                style={{ marginBottom: 16 }}
                message={
                  <div>
                    <Text>
                      上传进度: {completedUploads.length + failedUploads.length}{" "}
                      / {selectedFiles.length}
                    </Text>
                    {completedUploads.length > 0 && (
                      <div>
                        <Text style={{ color: "#52c41a" }}>
                          成功: {completedUploads.length} 个
                        </Text>
                      </div>
                    )}
                    {failedUploads.length > 0 && (
                      <div>
                        <Text type="danger">
                          失败: {failedUploads.length} 个
                        </Text>
                      </div>
                    )}
                  </div>
                }
              />
            )}

          <Form.Item name="purpose" label="用途">
            <Select placeholder="选择用途（可选）" allowClear>
              <Select.Option value="course_material">课程资料</Select.Option>
              <Select.Option value="assignment">作业</Select.Option>
              <Select.Option value="resource">资源</Select.Option>
              <Select.Option value="other">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: "100%", justifyContent: "flex-end" }}>
              {isUploading && (
                <Button
                  danger
                  onClick={handleCancelUpload}
                >
                  取消上传
                </Button>
              )}
              <Button
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFiles([]);
                  form.resetFields();
                  setUploadProgress({});
                  setCompletedUploads([]);
                  setFailedUploads([]);
                }}
                disabled={isUploading}
              >
                关闭
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                disabled={
                  isUploading || selectedFiles.length === 0 || !selectedCourseId
                }
              >
                {isUploading
                  ? `上传中... (${completedUploads.length + failedUploads.length}/${selectedFiles.length})`
                  : selectedFiles.length > 1
                    ? `批量上传 ${selectedFiles.length} 个文件`
                    : "上传文件"}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="检测到重复文件"
        open={showDuplicateModal}
        onCancel={() => {
          setShowDuplicateModal(false);
          setDuplicateFiles([]);
        }}
        footer={null}
        width={500}
      >
        <Alert
          type="warning"
          showIcon
          message="以下文件已存在"
          description={
            <div style={{ marginTop: 8, maxHeight: 150, overflow: "auto" }}>
              {duplicateFiles.map((filename) => (
                <div key={filename} style={{ padding: "4px 0" }}>
                  <FileTextOutlined style={{ marginRight: 8 }} />
                  {filename}
                </div>
              ))}
            </div>
          }
          style={{ marginBottom: 16 }}
        />
        <Text type="secondary">
          您可以选择跳过重复文件只上传新文件，或者继续上传覆盖已有文件。
        </Text>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Space>
            <Button
              onClick={() => {
                setShowDuplicateModal(false);
                setDuplicateFiles([]);
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                handleSkipDuplicates(form.getFieldsValue());
              }}
            >
              跳过重复文件
            </Button>
            <Button
              type="primary"
              onClick={() => {
                setShowDuplicateModal(false);
                handleUpload(form.getFieldsValue(), selectedFiles);
              }}
            >
              继续上传（覆盖）
            </Button>
          </Space>
        </div>
      </Modal>

      <FilePreview
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
        file={previewFile || { url: "", name: "", type: "" }}
      />
    </div>
  );
}
