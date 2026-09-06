import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Typography, Button, Spin, Empty, Tag, Space, message } from "antd";
import {
  DownloadOutlined,
  EyeOutlined,
  BookOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  FilePptOutlined,
  ReadOutlined,
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

export default function AdminManualPage() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const section = isSuperAdmin ? "super_admin_manual" : "admin_manual";

  const { data: manualsData, isLoading, error } = useQuery({
    queryKey: ["admin-manual-templates", section, currentTenant?.id],
    queryFn: () =>
      listFileTemplates({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "section", "filePath"],
        filter: { section: { eq: section } },
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
    const iconStyle = { fontSize: 28 };
    switch (ext) {
      case "pdf": return <FilePdfOutlined style={{ ...iconStyle, color: "#f5222d" }} />;
      case "doc": case "docx": return <FileWordOutlined style={{ ...iconStyle, color: "#1890ff" }} />;
      case "xls": case "xlsx": return <FileExcelOutlined style={{ ...iconStyle, color: "#52c41a" }} />;
      case "ppt": case "pptx": return <FilePptOutlined style={{ ...iconStyle, color: "#fa8c16" }} />;
      default: return <FileTextOutlined style={{ ...iconStyle, color: "#8c8c8c" }} />;
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
        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e8e8e8",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "36px 40px 28px", borderBottom: "1px solid #f0f0f0" }}>
            <Title level={3} style={{ margin: "0 0 12px", color: "#1a1a1a", fontWeight: 600, letterSpacing: "0.5px" }}>
              {isSuperAdmin ? "超级管理员使用手册" : "管理平台使用手册"}
            </Title>
            <Text style={{ fontSize: 15, lineHeight: 2, color: "#595959", display: "block" }}>
              {isSuperAdmin
                ? "本手册将帮助您快速了解平台级管理功能，包括租户管理、API Key 配置以及系统全局设置等。你可以在下方下载完整的使用手册文档，也可以在线预览。建议先下载到本地，方便随时查阅。"
                : "本手册将帮助您快速了解管理平台的核心功能，包括管理员/教师/学生账号管理、班级与小组组织管理、系统状态与日志查看等。你可以在下方下载完整的使用手册文档，也可以在线预览。建议先下载到本地，方便随时查阅。"}
            </Text>
          </div>

          {manuals.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center" }}>
              <FileTextOutlined style={{ fontSize: 48, color: "#d9d9d9", marginBottom: 16 }} />
              <Title level={4} style={{ color: "#999", fontWeight: 400 }}>暂无可用的使用手册</Title>
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
                        {isSuperAdmin ? "平台管理使用指南和操作说明文档" : "管理平台使用指南和操作说明文档"}
                      </Text>
                    </Space>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                    <Button size="middle" icon={<EyeOutlined />} onClick={() => handlePreview(manual)} style={{ borderRadius: 8 }}>
                      在线预览
                    </Button>
                    <Button type="primary" size="middle" icon={<DownloadOutlined />} onClick={() => handleDownload(manual)} style={{ borderRadius: 8 }}>
                      下载手册
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{
          background: "linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%)",
          borderRadius: 12,
          padding: "20px 24px",
          marginTop: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <ReadOutlined style={{ color: "#2573E6", fontSize: 16 }} />
          <Text style={{ fontSize: 13, color: "#4d8fef", lineHeight: 1.8 }}>
            建议先下载手册到本地，方便随时查阅。如遇到系统使用问题，可先查看手册中的常见问题解答。
          </Text>
        </div>
      </div>

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
