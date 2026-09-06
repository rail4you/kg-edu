import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Typography, Card, Table, Space, Button, Drawer, Empty, Spin, Tooltip,
} from "antd";
import {
  FileTextOutlined, EyeOutlined, DownloadOutlined, ArrowLeftOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { listCurriculumDesigns } from "@/lib/ash_rpc";

const { Title, Text } = Typography;

// 格式化日期
const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN");
  } catch {
    return "-";
  }
};

interface CurriculumDesign {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  version: number;
  file_url: string | null;
  markdown_content: string | null;
  ai_generated: boolean;
  inserted_at: string;
}

export default function StudentCurriculum() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<CurriculumDesign | null>(null);

  // Fetch all published curriculum designs
  const { data: curricula, isLoading } = useQuery({
    queryKey: ["student-curriculum-designs", tenant],
    queryFn: async () => {
      const result = await listCurriculumDesigns({
        tenant,
        fields: ["id", "title", "description", "status", "version", "file_url", "markdown_content", "ai_generated", "inserted_at"],
        filter: { status: { eq: "published" } },
        headers,
      });
      return result;
    },
    enabled: !!tenant,
  });

  // Extract data from result
  const allDesigns: CurriculumDesign[] = curricula?.success && curricula?.data
    ? (curricula.data.results || curricula.data || [])
    : [];

  const columns: ColumnsType<CurriculumDesign> = [
    {
      title: "文档标题",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: CurriculumDesign) => (
        <Space size={4} style={{ maxWidth: "100%" }}>
          <FileTextOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
          <Tooltip title={title} mouseEnterDelay={0.3}>
            <a onClick={() => { setPreviewData(record); setPreviewVisible(true); }} style={{ display: "inline-block", verticalAlign: "middle", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{title}</a>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 80,
      render: (v: number) => <Text type="secondary">v{v}</Text>,
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 180,
      render: (t: string) => <Text type="secondary">{formatDate(t)}</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_: any, record: CurriculumDesign) => (
        <Space>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setPreviewData(record); setPreviewVisible(true); }}>
            预览
          </Button>
          {record.file_url && (
            <Button type="text" size="small" icon={<DownloadOutlined />} onClick={() => window.open(record.file_url, "_blank")}>
              下载
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Top bar */}
      <div style={{ marginBottom: 20 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/dashboard")}>
          返回首页
        </Button>
      </div>

      <Title level={4} style={{ marginBottom: 4 }}>课程体系</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 20 }}>
        查看教师发布的课程体系文档
      </Text>

      {/* List */}
      <Card>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
        ) : allDesigns.length === 0 ? (
          <Empty description="暂无已发布的课程体系文档" />
        ) : (
          <Table
            columns={columns}
            dataSource={allDesigns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* Preview Drawer */}
      <Drawer
        title="文档预览"
        placement="right"
        width={720}
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
        extra={
          previewData?.file_url && (
            <Button type="primary" icon={<DownloadOutlined />} onClick={() => window.open(previewData.file_url!, "_blank")}>
              下载 DOCX
            </Button>
          )
        }
      >
        {previewData && (
          <div>
            <Title level={4}>{previewData.title}</Title>
            {previewData.description && (
              <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
                {previewData.description}
              </Text>
            )}
            {previewData.markdown_content ? (
              <div style={{ background: "#fafafa", padding: 24, borderRadius: 8, maxHeight: "calc(100vh - 280px)", overflow: "auto" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {previewData.markdown_content}
                </ReactMarkdown>
              </div>
            ) : (
              <Empty description="暂无内容" />
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}