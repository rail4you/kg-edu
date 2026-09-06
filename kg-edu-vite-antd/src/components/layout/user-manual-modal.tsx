import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Modal,
  Typography,
  Button,
  Spin,
  Empty,
  Tag,
  Space,
  message,
  Tooltip,
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

interface UserManualModalProps {
  role: "teacher" | "student" | "admin";
}

const teacherHelpItems = [
  { icon: <DownloadOutlined />, title: "下载教师使用手册", desc: "获取详细的教学指导" },
  { icon: <CustomerServiceOutlined />, title: "联系系统管理员", desc: "获取技术支持和帮助" },
  { icon: <ReadOutlined />, title: "查看教学帮助和提示", desc: "系统内的帮助信息" },
  { icon: <SafetyCertificateOutlined />, title: "参考管理和指南", desc: "课程管理与知识点管理相关指南" },
];

const studentHelpItems = [
  { icon: <DownloadOutlined />, title: "下载学生使用手册", desc: "获取详细的学习指导" },
  { icon: <CustomerServiceOutlined />, title: "联系老师或管理员", desc: "获取学习帮助" },
  { icon: <ReadOutlined />, title: "查看学习帮助和提示", desc: "系统内的帮助信息" },
  { icon: <SafetyCertificateOutlined />, title: "参考学习指南", desc: "课程学习和知识点查看相关指南" },
];

const adminHelpItems = [
  { icon: <DownloadOutlined />, title: "下载使用手册", desc: "获取详细的管理操作指南" },
  { icon: <CustomerServiceOutlined />, title: "联系技术支持", desc: "获取技术支持和帮助" },
  { icon: <ReadOutlined />, title: "查看系统帮助", desc: "系统内的帮助信息" },
  { icon: <SafetyCertificateOutlined />, title: "参考管理指南", desc: "用户、租户、权限管理相关指南" },
];

export function UserManualModal({ role }: UserManualModalProps) {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [open, setOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const isSuperAdmin = user?.role === "super_admin";
  const section =
    role === "teacher"
      ? "teacher_manual"
      : role === "admin"
      ? isSuperAdmin
        ? "super_admin_manual"
        : "admin_manual"
      : "student_manual";
  const isTeacher = role === "teacher";
  const isAdmin = role === "admin";
  const manualLabel = isTeacher ? "教师" : isAdmin ? (isSuperAdmin ? "超级管理员" : "管理员") : "学生";

  const { data: manualsData, isLoading } = useQuery({
    queryKey: ["manual-templates-topbar", section, currentTenant?.id],
    queryFn: () =>
      listFileTemplates({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "section", "filePath"],
        filter: { section: { eq: section } },
        sort: "-id",
        page: { limit: 50, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: open && !!currentTenant && !!user,
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
    const iconStyle = { fontSize: 24 };
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

  const helpItems = isTeacher
    ? teacherHelpItems
    : isAdmin
    ? adminHelpItems
    : studentHelpItems;

  return (
    <>
      <Tooltip title="用户手册" placement="bottom">
        <div
          onClick={() => setOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            padding: "4px 12px",
            borderRadius: 8,
            transition: "all 0.2s ease",
            color: "#424754",
            fontSize: 14,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "#F3F4F6";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.background = "transparent";
          }}
        >
          <BookOutlined style={{ fontSize: 16 }} />
          <span>用户手册</span>
        </div>
      </Tooltip>

      <Modal
        title={null}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={800}
        centered
        destroyOnHidden
        styles={{ body: { padding: 0, maxHeight: "80vh", overflow: "auto" } }}
      >
        {/* Header */}
        <div style={{
          padding: "28px 32px 20px",
          borderBottom: "1px solid #f0f0f0",
          background: "linear-gradient(135deg, #f0f5ff 0%, #e6f7ff 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <BookOutlined style={{ fontSize: 22, color: "#1890ff" }} />
            <Title level={4} style={{ margin: 0, color: "#1a1a1a" }}>
              {isTeacher ? "教师使用手册" : isAdmin ? (isSuperAdmin ? "超级管理员使用手册" : "管理员使用手册") : "学生使用手册"}
            </Title>
          </div>
          <Text style={{ fontSize: 14, lineHeight: 1.8, color: "#595959" }}>
            {isTeacher
              ? "本手册将帮助您快速了解教学平台的核心功能，包括课程管理、知识点管理、练习出题、学生管理、学习数据分析等。"
              : isAdmin
              ? isSuperAdmin
                ? "本手册将帮助您快速了解平台级管理功能，包括租户管理、API Key 配置以及系统全局设置等。"
                : "本手册将帮助您快速了解管理平台的核心功能，包括管理员/教师/学生账号管理、班级与小组组织、系统状态与日志查看等。"
              : "本手册将帮助你快速了解学习平台的核心功能，包括课程学习、知识点浏览、练习测试、学习总结等。"}
          </Text>
        </div>

        {/* Manual file list */}
        {isLoading ? (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <Spin size="large" />
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">加载中...</Text>
            </div>
          </div>
        ) : manuals.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center" }}>
            <FileTextOutlined style={{ fontSize: 40, color: "#d9d9d9", marginBottom: 12 }} />
            <Title level={5} style={{ color: "#999", fontWeight: 400 }}>
              暂无可用的{manualLabel}使用手册
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              系统管理员正在准备中，请稍后再来查看
            </Text>
          </div>
        ) : (
          <div style={{ padding: "8px 32px 20px" }}>
            {manuals.map((manual: FileTemplate, idx: number) => (
              <div
                key={manual.id}
                style={{
                  padding: "20px 0",
                  borderBottom: idx < manuals.length - 1 ? "1px solid #f0f0f0" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 10,
                  background: "#fafafa", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {getFileIcon(manual.filePath)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 15, color: "#1a1a1a", display: "block", marginBottom: 4 }} ellipsis>
                    {getFileName(manual.filePath)}
                  </Text>
                  <Space size={8}>
                    <Tag color={getFileTypeColor(manual.filePath)} style={{ margin: 0, fontSize: 12, borderRadius: 4, padding: "1px 8px" }}>
                      {getFileTypeLabel(manual.filePath)}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {isTeacher ? "教学系统使用指南和操作说明文档" : isAdmin ? (isSuperAdmin ? "平台管理使用指南和操作说明文档" : "管理平台使用指南和操作说明文档") : "学习系统使用指南和操作说明文档"}
                    </Text>
                  </Space>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => handlePreview(manual)}
                    style={{ borderRadius: 6 }}
                  >
                    预览
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => handleDownload(manual)}
                    style={{ borderRadius: 6 }}
                  >
                    下载
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help section */}
        <div style={{ borderTop: "1px solid #f0f0f0", padding: "16px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <QuestionCircleOutlined style={{ color: "#1890ff", fontSize: 15 }} />
            <Text strong style={{ fontSize: 14 }}>需要更多帮助？</Text>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {helpItems.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 8px",
                  borderBottom: idx < 2 ? "1px solid #f5f5f5" : "none",
                  borderRight: idx % 2 === 0 ? "1px solid #f5f5f5" : "none",
                  borderRadius: 4,
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "#e6f7ff", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#1890ff", fontSize: 14,
                }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: 12, display: "block", marginBottom: 1 }}>{item.title}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{item.desc}</Text>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tip */}
        <div style={{
          background: "linear-gradient(135deg, #f0f5ff 0%, #d6e4ff 100%)",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}>
          <ReadOutlined style={{ color: "#1890ff", fontSize: 14 }} />
          <Text style={{ fontSize: 12, color: "#4d8fef" }}>
            建议先下载手册到本地，方便随时查阅。{isTeacher ? "如遇到系统使用问题，可优先查阅手册中的常见问题解答。" : isAdmin ? (isSuperAdmin ? "如遇到平台配置问题，可优先查阅手册中的常见问题解答。" : "如遇到管理操作问题，可优先查阅手册中的常见问题解答。") : "如遇到学习问题，可先查看手册中的常见问题。"}
          </Text>
        </div>
      </Modal>

      {/* File Preview Modal */}
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
    </>
  );
}
