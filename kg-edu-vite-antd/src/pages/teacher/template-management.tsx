import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Modal,
  Form,
  Select,
  Typography,
  Space,
  Tag,
  Progress,
  Alert,
  Tooltip,
  Table,
  Upload,
  message,
  Popconfirm,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  CloudUploadOutlined,
  DownloadOutlined,
  EyeOutlined,
  CopyOutlined,
  DeleteOutlined,
  FileOutlined,
} from "@ant-design/icons";
import {
  listFileTemplates,
  createFileTemplate,
  destroyFileTemplate,
  type FileTemplateResourceSchema,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

const extractArrayData = (result: any): any[] => {
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
  }
  return [];
};

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

export const TEMPLATE_SECTIONS = {
  knowledge: { label: "知识点", value: "knowledge" },
  homework: { label: "作业", value: "homework" },
  knowledge_question: { label: "知识问答", value: "knowledge_question" },
  exercise: { label: "练习", value: "exercise" },
  user: { label: "用户", value: "user" },
  llm: { label: "LLM", value: "llm" },
  relation: { label: "知识点关联", value: "relation" },
  xmind: { label: "思维导图", value: "xmind" },
  student_manual: { label: "学生使用手册", value: "student_manual" },
  teacher_manual: { label: "教师使用手册", value: "teacher_manual" },
  background: { label: "背景", value: "background" },
  chapter: { label: "章节", value: "chapter" },
} as const;

export type TemplateSection = keyof typeof TEMPLATE_SECTIONS;

const sectionOptions = Object.entries(TEMPLATE_SECTIONS).map(
  ([key, section]) => ({
    label: section.label,
    value: section.value,
  }),
);

interface TemplateFormData {
  section: string;
  file: File;
}

export default function TemplateManagementPage() {
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);
  const [form] = Form.useForm<TemplateFormData>();

  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const { canEdit } = useEditPermission();

  const {
    data: templates = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["file-templates", tenant],
    queryFn: async () => {
      const result = await listFileTemplates({
        fields: ["id", "section", "filePath"],
        sort: "-id",
        page: { limit: 50, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const file = data.file;

      const formData = new FormData();
      formData.append("file", file);

      const ossResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!ossResponse.ok) {
        throw new Error("OSS upload failed");
      }

      const ossResult = await ossResponse.json();

      if (!ossResult.success) {
        throw new Error(ossResult.error || "OSS upload failed");
      }

      return createFileTemplate({
        fields: ["id", "section", "filePath"],
        input: {
          section: data.section,
          filePath: ossResult.url,
        },
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("上传成功");
      queryClient.invalidateQueries({ queryKey: ["file-templates", tenant] });
      setUploadModalOpen(false);
      setSelectedFile(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.message || "上传失败");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (templateId: string) =>
      destroyFileTemplate({
        primaryKey: templateId,
        headers: getHeaders(user),
      }),
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["file-templates", tenant] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Progress percent={50} status="active" />
        <Text style={{ marginLeft: 16 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Title level={4} style={{ marginBottom: 8, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text style={{ marginBottom: 16 }}>请登录以访问模板管理。</Text>
      </div>
    );
  }

  const handleUpload = async () => {
    try {
      const values = await form.validateFields();
      if (!selectedFile) {
        message.error("请选择模板文件");
        return;
      }
      uploadMutation.mutate({
        ...values,
        file: selectedFile,
      });
    } catch (error) {
      console.error("Form validation error:", error);
      message.error("表单验证失败，请检查输入");
    }
  };

  const handleDelete = (templateId: string) => {
    deleteMutation.mutate(templateId);
  };

  const handleDownload = (template: FileTemplateResourceSchema) => {
    const link = document.createElement("a");
    link.href = template.filePath;
    const filename = template.filePath.split("/").pop() || "template";
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreview = (template: FileTemplateResourceSchema) => {
    const filename = getFileName(template.filePath);
    const extension = filename.split(".").pop()?.toLowerCase() || "";
    setPreviewFile({
      url: template.filePath,
      name: filename,
      type: extension,
    });
    setPreviewModalOpen(true);
  };

  const handleCopyTemplate = (template: FileTemplateResourceSchema) => {
    const filename = template.filePath.split("/").pop() || "template";
    navigator.clipboard.writeText(`Template copied: ${filename}`);
    message.success("已复制到剪贴板");
  };

  const getSectionLabel = (section: string) => {
    return (
      TEMPLATE_SECTIONS[section as keyof typeof TEMPLATE_SECTIONS]?.label ||
      "通用"
    );
  };

  const getFileTypeIcon = (filePath: string) => {
    const extension = filePath.split(".").pop()?.toLowerCase() || "";
    if (["pdf"].includes(extension)) return "📄";
    if (["doc", "docx"].includes(extension)) return "📝";
    if (["xls", "xlsx"].includes(extension)) return "📊";
    if (["ppt", "pptx"].includes(extension)) return "📈";
    if (["txt"].includes(extension)) return "📃";
    if (["xmind"].includes(extension)) return "🧠";
    if (["opml", "xml"].includes(extension)) return "🗺️";
    if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(extension))
      return "🖼️";
    return "📁";
  };

  const getFileName = (filePath: string) => {
    try {
      const url = new URL(filePath);
      let filename = url.pathname.split("/").pop() || "Unknown";
      filename = decodeURIComponent(filename);
      filename = filename.replace(/\(\d+\)$/, "");
      filename = filename.replace(/模板$/, "");
      filename = filename.replace(/_template$/, "");
      return filename;
    } catch {
      return filePath.split("/").pop() || "Unknown";
    }
  };

  const uploadFileList: UploadFile[] = selectedFile
    ? ([
        {
          uid: "-1",
          name: selectedFile.name,
          status: "done",
          originFileObj: selectedFile,
        },
      ] as unknown as UploadFile[])
    : [];

  const columns = [
    {
      title: "模板名称",
      dataIndex: "filePath",
      key: "filename",
      render: (filePath: string) => {
        const filename = getFileName(filePath);
        return <Tooltip title={filename} mouseEnterDelay={0.3}><Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</Text></Tooltip>;
      },
    },
    {
      title: "适用分类",
      dataIndex: "section",
      key: "section",
      width: 120,
      render: (section: string) => (
        <Tag color="blue">{getSectionLabel(section)}</Tag>
      ),
    },
    {
      title: "文件类型",
      dataIndex: "filePath",
      key: "fileType",
      width: 100,
      render: (filePath: string) => <Text>{getFileTypeIcon(filePath)}</Text>,
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: any, record: FileTemplateResourceSchema) => (
        <Space>
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="下载">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
              style={{ color: "#52c41a" }}
            />
          </Tooltip>
          <Tooltip title="复制">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleCopyTemplate(record)}
              style={{ color: "#faad14" }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个模板吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <ReadonlyActionButton
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          模板管理
        </Title>
        <Button
          type="primary"
          icon={<CloudUploadOutlined />}
          onClick={() => setUploadModalOpen(true)}
          style={canEdit ? undefined : { display: "none" }}
        >
          上传模板
        </Button>
      </div>

      {error && (
        <Alert
          message="加载模板列表失败"
          type="error"
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 25,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title="上传模板"
        open={uploadModalOpen}
        onCancel={() => {
          setUploadModalOpen(false);
          setSelectedFile(null);
          form.resetFields();
        }}
        onOk={handleUpload}
        okText="上传模板"
        cancelText="取消"
        confirmLoading={uploadMutation.isPending}
        okButtonProps={{ disabled: !selectedFile }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ section: "knowledge" }}
        >
          <Form.Item
            name="section"
            label="适用分类"
            rules={[{ required: true, message: "请选择适用分类" }]}
          >
            <Select options={sectionOptions} />
          </Form.Item>

          <Form.Item label="模板文件">
            <Upload
              beforeUpload={(file) => {
                setSelectedFile(file);
                form.setFieldValue("file", file);
                return false;
              }}
              onRemove={() => {
                setSelectedFile(null);
                form.setFieldValue("file", undefined);
              }}
              maxCount={1}
              accept=".doc,.docx,.pdf,.ppt,.pptx,.xls,.xlsx,.txt,.xmind,.opml,.xml,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
              fileList={uploadFileList}
            >
              <Button icon={<CloudUploadOutlined />}>选择模板文件</Button>
            </Upload>
          </Form.Item>

          {selectedFile && (
            <div
              style={{
                marginTop: 16,
                padding: 16,
                border: "2px dashed #1890ff",
                borderRadius: 8,
                backgroundColor: "rgba(24, 144, 255, 0.1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FileOutlined style={{ color: "#1890ff" }} />
                <Text strong>{selectedFile.name}</Text>
              </div>
            </div>
          )}

          {uploadMutation.isPending && (
            <div style={{ marginTop: 16 }}>
              <Progress percent={50} status="active" />
              <Text
                type="secondary"
                style={{ display: "block", textAlign: "center" }}
              >
                正在上传模板文件...
              </Text>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title={previewFile?.name || "文件预览"}
        open={previewModalOpen}
        onCancel={() => setPreviewModalOpen(false)}
        footer={null}
        width={800}
      >
        {previewFile && (
          <div style={{ minHeight: 400 }}>
            {["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(
              previewFile.type,
            ) ? (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                style={{ maxWidth: "100%", maxHeight: 500 }}
              />
            ) : previewFile.type === "pdf" ? (
              <iframe
                src={previewFile.url}
                style={{ width: "100%", height: 500, border: "none" }}
                title="PDF Preview"
              />
            ) : (
              <div style={{ textAlign: "center", padding: 40 }}>
                <FileOutlined style={{ fontSize: 64, color: "#999" }} />
                <p style={{ marginTop: 16, color: "#666" }}>
                  此文件类型不支持在线预览，请下载后查看
                </p>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    window.open(previewFile.url, "_blank");
                  }}
                >
                  下载文件
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
