import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Button,
  Spin,
  Empty,
  Tag,
  Space,
  message,
} from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  BookOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  QuestionCircleOutlined,
  CustomerServiceOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { listFileTemplates } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import FilePreview from "@/components/FilePreview";

const { Title, Text } = Typography;

interface FileTemplate {
  id: string;
  section: string;
  filePath: string;
}

const helpItems = [
  {
    icon: <DownloadOutlined />,
    title: "下载教师使用手册",
    desc: "获取详细的教学指导",
  },
  {
    icon: <CustomerServiceOutlined />,
    title: "联系系统管理员",
    desc: "获取技术支持和帮助",
  },
  {
    icon: <ReadOutlined />,
    title: "查看教学帮助和提示",
    desc: "系统内的帮助信息",
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: "参考管理和指南",
    desc: "课程管理与知识点管理相关指南",
  },
];

export default function TeacherManualPage() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data: manualsData, isLoading, error } = useQuery({
    queryKey: ["teacher-manual-templates", currentTenant?.id],
    queryFn: () =>
      listFileTemplates({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "section", "filePath"],
        filter: { section: "teacher_manual" },
        sort: "-id",
        page: { limit: 50, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: !!currentTenant && !!user,
  });

  const manuals = manualsData?.success
    ? Array.isArray(manualsData.data)
      ? manualsData.data
      : (manualsData.data as any)?.results || []
    : [];

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

  const getFileExtension = (filePath: string) => {
    return filePath.split(".").pop()?.toLowerCase() || "";
  };

  const getFileIcon = (filePath: string) => {
    const ext = getFileExtension(filePath);
    const iconStyle = { fontSize: 26 };
    switch (ext) {
      case "pdf":
        return <FilePdfOutlined style={{ ...iconStyle, color: "#f5222d" }} />;
      case "doc":
      case "docx":
        return <FileWordOutlined style={{ ...iconStyle, color: "#1890ff" }} />;
      case "xls":
      case "xlsx":
        return <FileExcelOutlined style={{ ...iconStyle, color: "#52c41a" }} />;
      case "ppt":
      case "pptx":
        return <FilePptOutlined style={{ ...iconStyle, color: "#fa8c16" }} />;
      default:
        return <FileTextOutlined style={{ ...iconStyle, color: "#8c8c8c" }} />;
    }
  };

  const getFileTypeLabel = (filePath: string) => {
    const ext = getFileExtension(filePath).toUpperCase();
    return ext || "文件";
  };

  const getFileTypeColor = (filePath: string) => {
    const ext = getFileExtension(filePath);
    switch (ext) {
      case "pdf": return "red";
      case "doc": case "docx": return "blue";
      case "xls": case "xlsx": return "green";
      case "ppt": case "pptx": return "orange";
      default: return "default";
    }
  };

  const handleDownload = (template: FileTemplate) => {
    const link = document.createElement("a");
    link.href = template.filePath;
    const filename = getFileName(template.filePath);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("开始下载: " + filename);
  };

  const handlePreview = (template: FileTemplate) => {
    setPreviewFile({
      url: template.filePath,
      name: getFileName(template.filePath),
      type: getFileExtension(template.filePath),
    });
    setPreviewVisible(true);
  };

  if (!currentTenant || !user) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <BookOutlined style={{ fontSize: 48, color: "#bbb", marginBottom: 16 }} />
        <Title level={4} style={{ color: "#999" }}>请先登录</Title>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Spin size="large" />
        <Text type="secondary">加载中...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty description="加载失败，请稍后重试" />
      </div>
    );
  }

  return (
    <div style={{ background: "#f7f8fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 32px 40px" }}>
        {/* Main content card */}
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e8e8e8",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}>
          {/* Introduction section */}
          <div style={{ padding: "36px 40px 28px", borderBottom: "1px solid #f0f0f0" }}>
            <Title level={3} style={{ margin: "0 0 12px", color: "#1a1a1a", fontWeight: 600, letterSpacing: "0.5px" }}>
              欢迎使用课堂星教学平台
            </Title>
            <Text style={{ fontSize: 15, lineHeight: 2, color: "#595959", display: "block" }}>
              本手册将帮助您快速了解教学平台的核心功能，包括课程管理、知识点管理、练习出题、学生管理、学习数据分析等。
              您可以在下方下载完整的使用手册文档，也可以在线预览。建议先下载到本地，方便随时查阅。
            </Text>
          </div>

          {/* Manual list */}
          {manuals.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center" }}>
              <FileTextOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }} />
              <Title level={4} style={{ color: "#999", fontWeight: 400 }}>暂无可用的教师使用手册</Title>
              <Text type="secondary">系统管理员正在准备中，请稍后再来查看</Text>
            </div>
          ) : (
            <div style={{ padding: "8px 40px 20px" }}>
              {manuals.map((manual: FileTemplate, idx: number) => (
                <div
                  key={manual.id}
                  style={{
                    padding: "24px 0",
                    borderBottom: idx < manuals.length - 1 ? "1px solid #f0f0f0" : "none",
                    display: "flex", alignItems: "center", gap: 20,
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 10,
                    background: "#fafafa", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    {getFileIcon(manual.filePath)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 16, color: "#1a1a1a", display: "block", marginBottom: 6 }} ellipsis>
                      {getFileName(manual.filePath)}
                    </Text>
                    <Space size={8}>
                      <Tag color={getFileTypeColor(manual.filePath)} style={{ margin: 0, fontSize: 12, borderRadius: 4, padding: "2px 10px" }}>
                        {getFileTypeLabel(manual.filePath)}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        教学系统使用指南和操作说明文档
                      </Text>
                    </Space>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <Button
                      size="middle"
                      icon={<EyeOutlined />}
                      onClick={() => handlePreview(manual)}
                      style={{ borderRadius: 8 }}
                    >
                      在线预览
                    </Button>
                    <Button
                      type="primary"
                      size="middle"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(manual)}
                      style={{ borderRadius: 8 }}
                    >
                      下载手册
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom section: Help + Tips side by side */}
        <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
          {/* Help items */}
          <div style={{
            background: "#fff", borderRadius: 12,
            border: "1px solid #e8e8e8",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            flex: 1,
          }}>
            <div style={{
              padding: "18px 24px 14px",
              borderBottom: "1px solid #f0f0f0",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <QuestionCircleOutlined style={{ color: "#1890ff", fontSize: 16 }} />
              <Text strong style={{ fontSize: 15 }}>需要更多帮助？</Text>
            </div>
            <div style={{ padding: "6px 20px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              {helpItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 10px",
                    borderBottom: idx < 2 ? "1px solid #f5f5f5" : "none",
                    borderRight: idx % 2 === 0 ? "1px solid #f5f5f5" : "none",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fafafa"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: "#e6f7ff", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0, color: "#1890ff", fontSize: 15,
                  }}>
                    {item.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text strong style={{ fontSize: 13, display: "block", marginBottom: 2 }}>{item.title}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.desc}</Text>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tip card */}
          <div style={{
            background: "linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)",
            borderRadius: 12,
            padding: "20px 24px",
            width: 300,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <ReadOutlined style={{ color: "#1890ff", fontSize: 15 }} />
              <Text strong style={{ fontSize: 14, color: "#096dd9" }}>温馨提示</Text>
            </div>
            <Text style={{ fontSize: 13, color: "#40a9ff", lineHeight: 1.8 }}>
              建议先下载手册到本地，方便随时查阅。如遇到系统使用问题，可优先查阅手册中的常见问题解答，或联系系统管理员获取帮助。
            </Text>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <FilePreview
          open={previewVisible}
          onClose={() => { setPreviewVisible(false); setPreviewFile(null); }}
          file={previewFile}
          onDownload={() => {
            const link = document.createElement("a");
            link.href = previewFile.url;
            link.download = previewFile.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            message.success("开始下载: " + previewFile.name);
          }}
        />
      )}
    </div>
  );
}
