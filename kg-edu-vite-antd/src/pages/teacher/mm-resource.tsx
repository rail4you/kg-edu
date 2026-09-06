import React, { useState, useRef } from "react"
import {
  useNavigate } from "react-router-dom";
import {
  useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Grid,
  Button,
  Card,
  Empty,
  Input,
  message,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tabs,
  Typography,
  Tag,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ImportOutlined,
  CloudUploadOutlined,
  UploadOutlined,
  CloseOutlined,
  FileTextOutlined,
  EyeOutlined,
  DownloadOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  deleteMmResource,
  listMmResourcesByCourse,
} from "@/lib/ash_rpc";
import {
  uploadFileViaServer,
} from "@/lib/oss-upload";
import type { UploadProgress } from "@/lib/oss-upload";
import ImportModal from "@/components/micro-major/import-modal";
import FilePreview from "@/components/FilePreview";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

interface MMResourceManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
}

interface ResourceItem {
  id: string;
  microMajorCourseId: string;
  microMajorChapterId?: string | null;
  title?: string | null;
  filename: string;
  path: string;
  size: number;
  fileType: string;
  description?: string | null;
  sourceFileId?: string | null;
  insertedAt?: string;
}

const { Text } = Typography;

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: "red",
  doc: "blue",
  docx: "blue",
  xls: "green",
  xlsx: "green",
  ppt: "orange",
  pptx: "orange",
  txt: "default",
  mp4: "purple",
  avi: "purple",
  mov: "purple",
  zip: "cyan",
  rar: "cyan",
  image: "gold",
  png: "gold",
  jpg: "gold",
  jpeg: "gold",
};

const getFileTypeColor = (type: string): string => {
  const t = (type || "").toLowerCase();
  for (const [key, color] of Object.entries(FILE_TYPE_COLORS)) {
    if (t.includes(key)) return color;
  }
  return "default";
};

const getFileIcon = (type: string): string => {
  const t = (type || "").toLowerCase();
  if (["pdf"].some(k => t.includes(k))) return "📄";
  if (["doc", "docx"].some(k => t.includes(k))) return "📝";
  if (["xls", "xlsx", "csv"].some(k => t.includes(k))) return "📊";
  if (["ppt", "pptx"].some(k => t.includes(k))) return "📑";
  if (["mp4", "avi", "mov", "mkv"].some(k => t.includes(k))) return "🎬";
  if (["zip", "rar", "7z", "tar"].some(k => t.includes(k))) return "🗜";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].some(k => t.includes(k))) return "🖼";
  return "📁";
};

const formatSize = (bytes: number) => {
  if (!bytes || bytes === 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExt = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
};

/** Clean file type for display: use extension if fileType is a long MIME */
const cleanFileType = (fileType: string, filename: string): string => {
  if (!fileType) return getFileExt(filename).toUpperCase();
  // If it looks like a MIME type (contains /), use extension instead
  if (fileType.includes("/") || fileType.length > 10) {
    return getFileExt(filename).toUpperCase();
  }
  return fileType.toUpperCase();
};

export default function MMResourceManager({ tenant, courseId, headers }: MMResourceManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manualTab, setManualTab] = useState<string>("upload");
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [uploadStatus, setUploadStatus] = useState("");
  const [currentUploadingFile, setCurrentUploadingFile] = useState("");
  const [currentAbortController, setCurrentAbortController] = useState<AbortController | null>(null);
  const cancelRef = useRef(false);
  const [completedUploads, setCompletedUploads] = useState<string[]>([]);

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Fetch resources
  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ["mm-resources", courseId],
    queryFn: async () => {
      const result = await listMmResourcesByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id",
          "filename",
          "path",
          "size",
          "fileType",
          "description",
          "sourceFileId",
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

  const resources: ResourceItem[] = (resourcesData as ResourceItem[]) || [];

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMmResource({ tenant, primaryKey: id, headers });
      if (!result.success) throw new Error("删除失败");
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["mm-resources"] });
    },
    onError: () => message.error("删除失败"),
  });

  // ---- Upload Handler ----
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setUploadFiles(Array.from(files));
      setCompletedUploads([]);
      cancelRef.current = false;
    }
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      message.error("请选择文件");
      return;
    }

    setIsUploading(true);
    cancelRef.current = false;
    const completed: string[] = [];

    for (let i = 0; i < uploadFiles.length; i++) {
      if (cancelRef.current) break;

      const file = uploadFiles[i];
      setCurrentUploadingFile(file.name);
      setUploadStatus(`正在上传 (${i + 1}/${uploadFiles.length}): ${file.name}`);

      try {
        // Get upload token
        const stsResponse = await getSTSToken(file.name, file.size, file.type);
        if (!stsResponse.success) {
          throw new Error(stsResponse.error || "获取上传凭证失败");
        }

        // Upload to OSS
        const abortController = new AbortController();
        setCurrentAbortController(abortController);

        let ossResult: { url: string; name: string };
        try {
          ossResult = await uploadFileToOSS(stsResponse, {
            file,
            onProgress: (progress: UploadProgress) => {
              setUploadProgress((prev) => ({ ...prev, [file.name]: Math.min(progress.percent, 90) }));
            },
            signal: abortController.signal,
          });
        } catch (ossError) {
          console.warn("Direct OSS upload failed, fallback:", ossError);
          setUploadProgress((prev) => ({ ...prev, [file.name]: 25 }));
          ossResult = await uploadFileViaServer(file, {
            onProgress: (progress: UploadProgress) => {
              setUploadProgress((prev) => ({ ...prev, [file.name]: Math.min(25 + Math.floor(progress.percent * 0.65), 90) }));
            },
            signal: abortController.signal,
          });
        }

        if (cancelRef.current) break;

        // Create resource record
        setUploadProgress((prev) => ({ ...prev, [file.name]: 95 }));
        const ext = getFileExt(file.name);
        const result = await createMmResource({
          tenant,
          input: {
            microMajorCourseId: courseId,
            filename: file.name,
            path: ossResult.url,
            size: file.size,
            fileType: ext || "unknown",
            description: null,
          },
          fields: ["id", "filename"],
          headers,
        });

        if (!result.success) {
          throw new Error("创建资源记录失败");
        }

        setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
        completed.push(file.name);
        setCompletedUploads([...completed]);
      } catch (error: any) {
        if (error.message === "UPLOAD_CANCELLED") {
          message.warning(`${file.name} 上传已取消`);
        } else {
          message.error(`${file.name} 上传失败: ${error.message}`);
        }
      }
    }

    setIsUploading(false);
    setCurrentUploadingFile("");
    setCurrentAbortController(null);

    if (completed.length > 0) {
      message.success(`上传完成，成功 ${completed.length} 个文件`);
      queryClient.invalidateQueries({ queryKey: ["mm-resources"] });
      // Reset after short delay
      setTimeout(() => {
        setCreateModalOpen(false);
        setUploadFiles([]);
        setUploadProgress({});
        setUploadStatus("");
        setCompletedUploads([]);
      }, 1000);
    }
  };

  const handleCancelUpload = () => {
    cancelRef.current = true;
    if (currentAbortController) {
      currentAbortController.abort();
    }
    message.warning("正在取消上传...");
  };

  // ---- Columns ----
  const columns: TableColumnsType<ResourceItem> = [
    {
      title: "文件名",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
      render: (text: string, record: ResourceItem) => (
        <Space>
          <span style={{ fontSize: 18 }}>{getFileIcon(record.fileType)}</span>
          <span>{text}</span>
          <Tag style={{ fontSize: 11, lineHeight: "16px" }} color={getFileTypeColor(cleanFileType(record.fileType, record.filename))}>
            {cleanFileType(record.fileType, record.filename)}
          </Tag>
        </Space>
      ),
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      width: 100,
      render: (v: number) => formatSize(v),
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (v: string) => v || "-",
    },
    {
      title: "来源",
      dataIndex: "sourceFileId",
      key: "sourceFileId",
      width: 80,
      render: (v: string) =>
        v ? <Text type="secondary" style={{ fontSize: 12 }}>已导入</Text> : <Text type="success" style={{ fontSize: 12 }}>本地上传</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: isMobile ? 60 : 200,
      render: (_: any, record: ResourceItem) => (
        <Space size={isMobile ? 2 : 4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setPreviewFile({
                url: record.path,
                name: record.filename,
                type: record.fileType,
              });
              setPreviewOpen(true);
            }}
          >
            {isMobile ? "" : "预览"}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => {
              const a = document.createElement("a");
              a.href = record.path;
              a.download = record.filename;
              a.click();
            }}
          >
            {isMobile ? "" : "下载"}
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" danger size="small" icon={<DeleteOutlined />}>{isMobile ? "" : "删除"}</ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)" }}>
        {isLoading ? (
          <Table columns={columns} dataSource={[]} rowKey="id" loading pagination={false} size="middle" />
        ) : resources.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <Empty description="暂无资源，请上传或从智慧课程导入" />
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
              <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => { setCreateModalOpen(true); setManualTab("upload"); }} style={canEdit ? undefined : { display: "none" }}>
                上传文件
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
                <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => { setCreateModalOpen(true); setManualTab("upload"); }} style={canEdit ? undefined : { display: "none" }}>
                  上传文件
                </Button>
                <Button icon={<ImportOutlined />} onClick={() => setImportModalOpen(true)} style={canEdit ? undefined : { display: "none" }}>
                  从智慧课程导入
                </Button>
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={resources}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              size="middle"
              locale={{ emptyText: <Empty description="暂无资源" /> }}
            />
          </>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        title="上传文件"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          setUploadFiles([]);
          setUploadProgress({});
          setUploadStatus("");
          setCompletedUploads([]);
          setIsUploading(false);
        }}
        width={640}
        footer={null}
      >
        <Tabs
          activeKey={manualTab}
          onChange={setManualTab}
          items={[
            {
              key: "upload",
              label: "本地上传",
              children: (
                <div style={{ padding: "16px 0" }}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>选择文件</Text>
                    <div style={{ marginTop: 8 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        style={{ width: "100%" }}
                      />
                    </div>
                  </div>

                  {uploadFiles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary">
                        已选择 {uploadFiles.length} 个文件，共{" "}
                        {uploadFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024) > 1
                          ? (uploadFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(1) + " MB"
                          : (uploadFiles.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1) + " KB"}
                      </Text>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {uploadFiles.map((file) => {
                          const ext = getFileExt(file.name);
                          return (
                            <div
                              key={file.name}
                              style={{
                                padding: "8px 12px",
                                border: "1px solid #d9d9d9",
                                borderRadius: 6,
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 200,
                              }}
                            >
                              <span>{getFileIcon(ext)}</span>
                              <Text ellipsis style={{ maxWidth: 120, fontSize: 13 }}>{file.name}</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {(file.size / 1024).toFixed(0)} KB
                              </Text>
                              {uploadProgress[file.name] !== undefined && (
                                <Text style={{ fontSize: 11, color: uploadProgress[file.name] === 100 ? "#52c41a" : "#1890ff" }}>
                                  {uploadProgress[file.name]}%
                                </Text>
                              )}
                              {completedUploads.includes(file.name) && (
                                <span style={{ color: "#52c41a" }}>✓</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {uploadStatus && (
                    <div style={{ marginBottom: 16 }}>
                      <Text type="secondary" style={{ display: "block", marginBottom: 4 }}>
                        {uploadStatus}
                      </Text>
                      {isUploading && currentUploadingFile && uploadProgress[currentUploadingFile] !== undefined && (
                        <Progress percent={uploadProgress[currentUploadingFile]} status="active" />
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    {!isUploading ? (
                      <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={handleUpload}
                        disabled={uploadFiles.length === 0}
                      >
                        开始上传 {uploadFiles.length > 0 ? `(${uploadFiles.length} 个文件)` : ""}
                      </Button>
                    ) : (
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={handleCancelUpload}
                      >
                        取消上传
                      </Button>
                    )}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        title="从智慧课程导入资源"
        importType="resources"
        targetCourseId={courseId}
        tenant={tenant}
        headers={headers}
        onImport={async (fileIds) => {
          const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              action: "import_mm_resources_from_course",
              input: { microMajorCourseId: courseId, fileIds },
            }),
          });
          const result = await resp.json();
          if (!result.success) throw new Error("导入失败");
          queryClient.invalidateQueries({ queryKey: ["mm-resources"] });
        }}
      />
      {/* File Preview */}
      <FilePreview
        open={previewOpen}
        onClose={() => { setPreviewOpen(false); setPreviewFile(null); }}
        file={previewFile || { url: "", name: "", type: "" }}
      />
    </div>
  );
}
