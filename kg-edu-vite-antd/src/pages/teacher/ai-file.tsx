import React, { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom";
import {
  Card,
  Typography,
  Button,
  Space,
  Tooltip,
  Modal,
  message,
  Empty,
  Input,
  Select,
  Spin,
  Tag,
  Row,
  Col,
  Table,
  Pagination,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  DownloadOutlined,
  SearchOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FolderOutlined,
  AppstoreOutlined,
  EyeOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useTranslate } from "@/locales/use-locales";
import {
  listAiGeneratedFilesByCourse,
  deleteFile,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useCourses } from "@/hooks/use-courses";
import FilePreview from "@/components/FilePreview";

const { Text, Title } = Typography;

type FileData = {
  id: string;
  filename: string;
  fileType: string;
  size: number;
  path?: string;
  purpose?: string;
  source?: string;
};

type CourseData = {
  id: string;
  title: string;
  description?: string | null;
};

// 获取文件类型图标
const getFileIcon = (fileType: string) => {
  const type = fileType?.toLowerCase() || "";
  if (type.includes("pdf")) return <FilePdfOutlined style={{ color: "#e74c3c", fontSize: 20 }} />;
  if (type.includes("word") || type.includes("doc")) return <FileWordOutlined style={{ color: "#2b579a", fontSize: 20 }} />;
  if (type.includes("excel") || type.includes("sheet") || type.includes("xls")) return <FileExcelOutlined style={{ color: "#217346", fontSize: 20 }} />;
  if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg") || type.includes("gif"))
    return <FileImageOutlined style={{ color: "#9b59b6", fontSize: 20 }} />;
  return <FileTextOutlined style={{ color: "#7f8c8d", fontSize: 20 }} />;
};

// 简化文件类型显示
const simplifyFileType = (fileType: string, filename?: string): string => {
  if (!fileType && !filename) return "未知";
  const type = (fileType || "").toLowerCase();
  const name = (filename || "").toLowerCase();
  // 优先检查文件名扩展名，更可靠
  if (name.endsWith(".pdf")) return "PDF";
  if (name.endsWith(".doc") || name.endsWith(".docx")) return "Word";
  if (name.endsWith(".xls") || name.endsWith(".xlsx")) return "Excel";
  if (name.endsWith(".ppt") || name.endsWith(".pptx")) return "PPT";
  // 再检查 fileType
  if (type.includes("pdf")) return "PDF";
  if (type.includes("word") || type.includes("doc")) return "Word";
  if (type.includes("excel") || type.includes("sheet") || type.includes("xls")) return "Excel";
  if (type.includes("powerpoint") || type.includes("ppt")) return "PPT";
  if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg") || type.includes("gif"))
    return "图片";
  if (type.includes("text") || type.includes("txt")) return "文本";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz"))
    return "压缩包";
  // 提取 MIME 类型的主要部分
  const parts = fileType.split("/");
  if (parts.length >= 2) {
    return parts[parts.length - 1].split(".")[0].toUpperCase();
  }
  return fileType;
};

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

export default function AIFilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslate("teacher");
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [files, setFiles] = useState<FileData[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<FileData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 当课程加载完成后，自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  // 加载 AI 生成的文件
  const loadFiles = async (courseId: string) => {
    if (!courseId) return;

    try {
      setFilesLoading(true);
      const result = await listAiGeneratedFilesByCourse({
        tenant,
        input: { courseId },
        fields: ["id", "filename", "fileType", "size", "path", "purpose", "source"],
        headers: {
          ...buildCSRFHeaders(),
          ...getAuthHeaders(user),
        } as Record<string, string>,
      });

      if (result.success && result.data) {
        setFiles(result.data as FileData[]);
      } else {
        message.error(result.errors?.[0]?.message || t("pages.aiFile.messages.loadFailed"));
      }
    } catch (err) {
      message.error(t("pages.aiFile.messages.loadError"));
      console.error("Error loading AI files:", err);
    } finally {
      setFilesLoading(false);
    }
  };

  // 当选择课程后加载文件
  useEffect(() => {
    if (selectedCourseId) {
      loadFiles(selectedCourseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, tenant]);

  // 过滤后的文件列表
  const filteredFiles = useMemo(() => {
    if (!searchText.trim()) {
      return files;
    }
    const keyword = searchText.toLowerCase();
    return files.filter((file) =>
      file.filename.toLowerCase().includes(keyword),
    );
  }, [files, searchText]);

  // 分页后的文件列表
  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFiles.slice(start, start + pageSize);
  }, [filteredFiles, currentPage]);

  // 重置页码当文件数量变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [files.length, searchText]);

  const handleDownload = (file: FileData) => {
    const fileUrl = file.path || `/api/files/${file.id}/download?tenant=${tenant}`;
    window.open(fileUrl, "_blank");
    message.success(t("pages.aiFile.messages.downloading"));
  };

  const handleDeleteClick = (file: FileData) => {
    setFileToDelete(file);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;

    try {
      setDeleting(true);
      const result = await deleteFile({
        tenant,
        primaryKey: fileToDelete.id,
        headers: {
          ...buildCSRFHeaders(),
          ...getAuthHeaders(user),
        } as Record<string, string>,
      });

      if (result.success) {
        setFiles(files.filter((f) => f.id !== fileToDelete.id));
        message.success(t("pages.aiFile.messages.deleteSuccess"));
      } else {
        message.error(result.errors?.[0]?.message || t("pages.aiFile.messages.deleteFailed"));
      }
    } catch (err) {
      message.error(t("pages.aiFile.messages.deleteError"));
      console.error("Error deleting file:", err);
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
      setFileToDelete(null);
    }
  };

  const handleCourseChange = (value: string) => {
    setSelectedCourseId(value);
    setFiles([]);
  };

  const handlePreview = (file: FileData) => {
    const fileUrl = file.path || `/api/files/${file.id}/download?tenant=${tenant}`;
    setPreviewFile({
      url: fileUrl,
      name: file.filename,
      type: file.fileType,
      size: file.size,
    });
    setPreviewOpen(true);
  };

  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    type: string;
    size?: number;
  } | null>(null);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      background: "#f5f7fa"
    }}>
      {/* 顶部标题区域 */}
      <div style={{
        padding: "16px 24px",
        background: "#ffffff",
        borderBottom: "1px solid #e8ecf0",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <FolderOutlined style={{ color: "#0056D2", fontSize: 24 }} />
          <div>
                      <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>AI 生成文件</Title>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <Select
            style={{ width: 280 }}
            placeholder="请选择课程"
            value={selectedCourseId || undefined}
            onChange={handleCourseChange}
            loading={coursesLoading}
            disabled={coursesLoading}
            suffixIcon={<AppstoreOutlined style={{ color: "#0056D2" }} />}
            options={courses.map((course) => ({
              value: course.id,
              label: course.title,
            }))}
          />
          <Input
            placeholder="搜索文件名..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Space.Compact>
            <Button
              type={viewMode === "card" ? "primary" : "default"}
              icon={<AppstoreOutlined />}
              onClick={() => setViewMode("card")}
            >
              卡片
            </Button>
            <Button
              type={viewMode === "table" ? "primary" : "default"}
              icon={<FileTextOutlined />}
              onClick={() => setViewMode("table")}
            >
              表格
            </Button>
          </Space.Compact>
        </div>
      </div>

      {/* 内容区域 */}
      <div style={{ flex: 1, overflow: "auto", padding: "24px" }}>
        {coursesLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              gap: 16
            }}
          >
            <Spin size="large" />
            <Text type="secondary">加载课程中...</Text>
          </div>
        ) : !selectedCourseId ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e8ecf0",
              gap: 16
            }}
          >
            <div style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #f0f4f8 0%, #e8ecf0 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <FolderOutlined style={{ fontSize: 36, color: "#bfbfbf" }} />
            </div>
            <Text type="secondary" style={{ fontSize: 15 }}>
              请先选择课程
            </Text>
          </div>
        ) : filesLoading ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: 400,
            }}
          >
            <Spin size="large" tip="加载文件中..." />
          </div>
        ) : filteredFiles.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              background: "#ffffff",
              borderRadius: 12,
              border: "1px solid #e8ecf0",
              gap: 16
            }}
          >
            <Empty
              description={
                <span style={{ color: "#8c8c8c" }}>
                  {searchText ? "未找到匹配的文件" : "该课程暂无 AI 生成的文件"}
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : viewMode === "card" ? (
          <Card
            style={{
              borderRadius: 12,
              border: "1px solid #e8ecf0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          >
            {/* 文件卡片网格 */}
            <Row gutter={[12, 12]}>
              {paginatedFiles.map((file) => (
                <Col xs={24} sm={12} lg={8} xl={6} key={file.id}>
                  <Card
                    size="small"
                    hoverable
                    styles={{
                      body: {
                        display: "flex",
                        flexDirection: "column",
                        padding: "16px 20px",
                      },
                    }}
                    style={{
                      borderRadius: 8,
                      border: "1px solid #e8ecf0",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 12,
                    }}>
                      <div style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        background: "#f5f7fa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}>
                        {getFileIcon(file.fileType)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Tooltip title={file.filename}>
                          <Text
                            strong
                            ellipsis
                            style={{ display: "block", marginBottom: 4 }}
                          >
                            {file.filename}
                          </Text>
                        </Tooltip>
                        <Space size={8}>
                          <Tag style={{ fontSize: 11, padding: "0 6px" }}>
                            {simplifyFileType(file.fileType, file.filename)}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatFileSize(file.size)}
                          </Text>
                        </Space>
                      </div>
                    </div>

                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "auto",
                      paddingTop: 12,
                      borderTop: "1px solid #f0f0f0"
                    }}>
                      {file.source && (
                        <Tag color="green" style={{ fontSize: 11 }}>
                          {file.source === "ai_generated" ? "AI 生成" : file.source}
                        </Tag>
                      )}
                      {!file.source && <span />}
                      <Space size={4}>
                        <Tooltip title="预览">
                          <Button
                            size="small"
                            type="text"
                            icon={<EyeOutlined />}
                            onClick={() => handlePreview(file)}
                          />
                        </Tooltip>
                        <Tooltip title="下载">
                          <Button
                            size="small"
                            type="text"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownload(file)}
                          />
                        </Tooltip>
                        <ReadonlyActionButton title="删除" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteClick(file)} />
                      </Space>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
            {/* 卡片视图分页 */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredFiles.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
                showTotal={(total) => `共 ${total} 个文件`}
              />
            </div>
          </Card>
        ) : (
          <Card
            style={{
              borderRadius: 12,
              border: "1px solid #e8ecf0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
            }}
          >
            <Table
              dataSource={paginatedFiles}
              columns={[
                {
                  title: "文件名",
                  dataIndex: "filename",
                  key: "filename",
                  render: (_, record) => (
                    <Space style={{ maxWidth: "100%" }}>
                      <span style={{ flexShrink: 0 }}>{getFileIcon(record.fileType)}</span>
                      <Tooltip title={record.filename} mouseEnterDelay={0.3}>
                        <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{record.filename}</Text>
                      </Tooltip>
                    </Space>
                  ),
                },
                {
                  title: "类型",
                  dataIndex: "fileType",
                  key: "fileType",
                  width: 100,
                  render: (_, record) => (
                    <Tag>{simplifyFileType(record.fileType, record.filename)}</Tag>
                  ),
                },
                {
                  title: "大小",
                  dataIndex: "size",
                  key: "size",
                  width: 100,
                  render: (size) => formatFileSize(size),
                },
                {
                  title: "来源",
                  dataIndex: "source",
                  key: "source",
                  width: 100,
                  render: (source) => source === "ai_generated" ? <Tag color="green">AI 生成</Tag> : source || "-",
                },
                {
                  title: "操作",
                  key: "actions",
                  width: 150,
                  render: (_, record) => (
                    <Space>
                      <Tooltip title="预览">
                        <Button
                          size="small"
                          type="text"
                          icon={<EyeOutlined />}
                          onClick={() => handlePreview(record)}
                        />
                      </Tooltip>
                      <Tooltip title="下载">
                        <Button
                          size="small"
                          type="text"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload(record)}
                        />
                      </Tooltip>
                      <ReadonlyActionButton title="删除" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => handleDeleteClick(record)} />
                    </Space>
                  ),
                },
              ]}
              rowKey="id"
              pagination={false}
              size="small"
            />
            {/* 表格视图分页 */}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredFiles.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
                showTotal={(total) => `共 ${total} 个文件`}
              />
            </div>
          </Card>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        title={t("pages.aiFile.dialog.confirmTitle")}
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        onOk={handleConfirmDelete}
        okText={t("dialog.confirm")}
        cancelText={t("common.cancel")}
        confirmLoading={deleting}
        okButtonProps={{ danger: true }}
      >
        <p>
          {t("pages.aiFile.dialog.confirmMessage", {
            fileName: fileToDelete?.filename || "",
          })}
        </p>
      </Modal>

      {/* 文件预览弹窗 */}
      <FilePreview
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewFile(null);
        }}
        file={previewFile || { url: "", name: "", type: "" }}
        onDownload={() => {
          if (previewFile) {
            window.open(previewFile.url, "_blank");
          }
        }}
      />
    </div>
  );
}
