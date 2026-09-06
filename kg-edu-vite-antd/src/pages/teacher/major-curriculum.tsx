import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Typography, Card, Table, Space, Tag, Modal, message,
  Popconfirm, Tooltip, Empty, Spin, Button, Input, Divider, Drawer,
} from "antd";
import {
  FileTextOutlined, EditOutlined,
  DeleteOutlined, DownloadOutlined, ThunderboltOutlined,
  ArrowLeftOutlined, CheckCircleOutlined, SyncOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { listCurriculumDesigns, updateCurriculumDesign, deleteCurriculumDesign, publishCurriculum as publishCurriculumRpc } from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CurriculumDesign {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published";
  version: number;
  fileUrl: string | null;
  markdownContent: string | null;
  ai_generated: boolean;
  inserted_at: string;
  updated_at: string;
}

const PROMPT_TEMPLATES = [
  { 
    label: "工程教育认证标准", 
    value: "请按照工程教育认证标准，设计 OBE 导向的课程体系，注重学生毕业能力的达成",
    desc: "适合需要进行工程教育认证的专业"
  },
  { 
    label: "项目驱动教学", 
    value: "请增加实践课程比重，注重项目驱动式教学，每学期设置课程设计环节",
    desc: "强调动手实践能力的培养"
  },
  { 
    label: "前沿技术融合", 
    value: "请融入最新的行业技术趋势，增加人工智能、大数据、云计算等前沿技术选修课",
    desc: "紧跟技术发展趋势"
  },
  { 
    label: "强化创新能力", 
    value: "请注重培养学生的创新能力和科研素养，设置创新实践学分和科研训练环节",
    desc: "培养研究型和应用创新型人才"
  },
  { 
    label: "产教融合", 
    value: "请深化产教融合，增加企业实习和项目实践环节，企业导师参与教学",
    desc: "加强校企合作，缩短就业适应期"
  },
];

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

export default function MajorCurriculum() {
  const { majorId } = useParams<{ majorId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [editTitleModalVisible, setEditTitleModalVisible] = useState(false);
  const [editTitleData, setEditTitleData] = useState<{ id: string; title: string } | null>(null);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  // 预览抽屉
  const [previewDrawerOpen, setPreviewDrawerOpen] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<CurriculumDesign | null>(null);
  
  // 生成表单状态
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");

  // Fetch curriculum designs
  const { data: curricula, isLoading } = useQuery({
    queryKey: ["curriculum-designs", majorId, tenant],
    queryFn: async () => {
      const result = await listCurriculumDesigns({
        tenant,
        fields: ["id", "title", "description", "status", "version", "fileUrl", "markdownContent", "ai_generated", "inserted_at", "updated_at"],
        filter: { majorId: { eq: majorId } },
        headers,
      });
      return result;
    },
    enabled: !!majorId && !!tenant,
  });

  // Poll job status
  const { data: jobStatus } = useQuery({
    queryKey: ["curriculum-job", activeJobId],
    queryFn: async (): Promise<any | null> => {
      if (!activeJobId) return null;
      const response = await fetch(`/api/curriculum/jobs/${activeJobId}`, {
        headers: { "Content-Type": "application/json", ...headers },
      });
      return response.json();
    },
    enabled: !!activeJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      if (status === "succeeded" || status === "failed") return false;
      return status === "running" || status === "queued" ? 2000 : false;
    },
  });

  // Create job mutation
  const createJobMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const response = await fetch("/api/curriculum/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ orgSchema: tenant, majorId: majorId, customPrompt: prompt }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message || "创建任务失败");
      return data;
    },
    onSuccess: (data) => {
      if (data.data?.jobId) {
        setActiveJobId(data.data.jobId);
        setGenerateModalVisible(false);
        setSelectedTemplates([]);
        setCustomPrompt("");
        message.loading({ content: "课程体系文档生成任务已创建，正在生成...", key: "curriculum-job", duration: 0 });
      }
    },
    onError: (error: any) => {
      message.error(error.message || "创建任务失败");
    },
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: async (values: { id: string; title: string }) => {
      const result = await updateCurriculumDesign({
        tenant,
        primaryKey: values.id,
        input: { title: values.title },
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) throw new Error("更新失败");
      return result;
    },
    onSuccess: () => {
      message.success("标题已更新");
      setEditTitleModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ["curriculum-designs", majorId] });
    },
    onError: (error: any) => {
      message.error(error.message || "更新失败");
    },
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await publishCurriculumRpc({
        tenant,
        primaryKey: id,
        fields: ["id", "status"],
        headers,
      });
      if (!result.success) throw new Error("发布失败");
      return result;
    },
    onSuccess: () => {
      message.success("文档已发布，学生端可见");
      queryClient.invalidateQueries({ queryKey: ["curriculum-designs", majorId] });
    },
    onError: (error: any) => {
      message.error(error.message || "发布失败");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCurriculumDesign({
        tenant,
        primaryKey: id,
        headers,
      });
      if (!result.success) throw new Error("删除失败");
      return result;
    },
    onSuccess: () => {
      message.success("文档已删除");
      queryClient.invalidateQueries({ queryKey: ["curriculum-designs", majorId] });
    },
    onError: (error: any) => {
      message.error(error.message || "删除失败");
    },
  });

  // Handle job status changes
  useEffect(() => {
    if (!jobStatus?.data) return;
    if (jobStatus.data.status === "succeeded") {
      setActiveJobId(null);
      message.success(jobStatus.data.message || "课程体系文档生成成功");
      queryClient.invalidateQueries({ queryKey: ["curriculum-designs", majorId] });
    } else if (jobStatus.data.status === "failed") {
      setActiveJobId(null);
      message.error(jobStatus.data.message || "课程体系文档生成失败");
    }
  }, [jobStatus, queryClient, majorId]);

  const isGenerating = createJobMutation.isPending || !!activeJobId;
  const curriculaList: CurriculumDesign[] = curricula?.success && curricula?.data 
    ? (curricula.data.results || curricula.data || [])
    : [];

  // 计算最终提示词
  const getFinalPrompt = () => {
    let prompt = customPrompt.trim();
    
    if (selectedTemplates.length > 0) {
      const templatePrompt = selectedTemplates
        .map(t => PROMPT_TEMPLATES.find(p => p.label === t)?.value || t)
        .join("；");
      prompt = prompt ? `${templatePrompt}；${prompt}` : templatePrompt;
    }
    
    return prompt || "无特殊要求，按常规标准设计课程体系。";
  };

  // 下载 markdown 内容为 .md 文件
  const handleDownload = (record: CurriculumDesign) => {
    if (record.fileUrl) {
      window.open(record.fileUrl, "_blank");
      return;
    }
    if (!record.markdownContent) {
      message.warning("暂无内容可下载");
      return;
    }
    const blob = new Blob([record.markdownContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.title || "课程体系"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("下载成功");
  };

  // 打开预览抽屉
  const handlePreview = (record: CurriculumDesign) => {
    setPreviewRecord(record);
    setPreviewDrawerOpen(true);
  };


  const columns: ColumnsType<CurriculumDesign> = [
    {
      title: "文档标题",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: CurriculumDesign) => (
        <Space size={4} style={{ maxWidth: "100%" }}>
          <FileTextOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
          <Tooltip title={title} mouseEnterDelay={0.3}>
            <Text style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{title}</Text>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <Tag color={status === "published" ? "green" : "default"}>
          {status === "published" ? "已发布" : "草稿"}
        </Tag>
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
      width: 280,
      render: (_: any, record: CurriculumDesign) => (
        <Space size="small">
          <Tooltip title="预览详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>
          <Tooltip title="下载 Markdown">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(record)}
            />
          </Tooltip>
          <Tooltip title="编辑标题">
            <ReadonlyActionButton
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => { setEditTitleData({ id: record.id, title: record.title }); setEditTitleModalVisible(true); }}
            />
          </Tooltip>
          {record.status === "draft" && (
            <Tooltip title="发布">
              <ReadonlyActionButton type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => publishMutation.mutate(record.id)} loading={publishMutation.isPending} />
            </Tooltip>
          )}
          <Popconfirm title="确定删除此文档？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <Tooltip title="删除">
              <ReadonlyActionButton type="text" size="small" danger icon={<DeleteOutlined />} loading={deleteMutation.isPending} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Generating status indicator
  const GeneratingStatus = () => (
    <Card style={{ marginTop: 16, marginBottom: 16, textAlign: "center" }}>
      <Spin indicator={<SyncOutlined spin style={{ fontSize: 32 }} />} />
      <div style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 15 }}>正在生成课程体系文档，请稍候...</Text>
      </div>
      <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
        正在综合分析专业信息、岗位需求和能力图谱
      </Text>
    </Card>
  );

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(`/teacher/dashboard/major-detail/${majorId}`)}>
          返回专业管理
        </Button>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setGenerateModalVisible(true)} disabled={!!activeJobId} style={canEdit ? undefined : { display: "none" }}>
          AI 生成课程体系
        </Button>
      </div>

      <Title level={4} style={{ marginBottom: 8 }}>课程体系文档</Title>
      <Text type="secondary">管理专业下的课程体系文档，支持 AI 生成、上传、发布给学生查看</Text>

      {/* Generating status */}
      {isGenerating && <GeneratingStatus />}

      {/* Table */}
      <Card style={{ marginTop: 16 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}><Spin size="large" /></div>
        ) : curriculaList.length === 0 && !isGenerating ? (
          <Empty description="暂无课程体系文档，点击右上角「AI 生成课程体系」开始创建" />
        ) : (
          <Table
            columns={columns}
            dataSource={curriculaList}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys(keys as string[]),
              rowExpandable: (record) => !!record.markdownContent,
              showExpandColumn: true,
            }}
          />
        )}
      </Card>

      {/* Generate Modal */}
      <Modal
        title={<Space><ThunderboltOutlined style={{ color: "#722ed1" }} />AI 生成课程体系</Space>}
        open={generateModalVisible}
        onCancel={() => {
          setGenerateModalVisible(false);
          setSelectedTemplates([]);
          setCustomPrompt("");
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            选择提示词模板或输入自定义要求，生成符合需求的课程体系文档
          </Text>
        </div>

        {/* 模板选择 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>选择模板</Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PROMPT_TEMPLATES.map((t) => (
              <Tag
                key={t.label}
                color={selectedTemplates.includes(t.label) ? "blue" : "default"}
                style={{ cursor: "pointer", padding: "4px 12px" }}
                onClick={() => {
                  if (selectedTemplates.includes(t.label)) {
                    setSelectedTemplates(selectedTemplates.filter(s => s !== t.label));
                  } else {
                    setSelectedTemplates([...selectedTemplates, t.label]);
                  }
                }}
              >
                {t.label}
              </Tag>
            ))}
          </div>
        </div>

        {/* 已选模板内容预览 */}
        {selectedTemplates.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>已选模板内容</Text>
            <Card size="small" style={{ background: "#f5f5f5" }}>
              {selectedTemplates.map((t, i) => {
                const template = PROMPT_TEMPLATES.find(p => p.label === t);
                return (
                  <div key={t} style={{ marginBottom: i < selectedTemplates.length - 1 ? 8 : 0 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>{template?.desc}</Text>
                    <br />
                    <Text>{template?.value}</Text>
                    {i < selectedTemplates.length - 1 && <Divider style={{ margin: "8px 0" }} />}
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {/* 自定义要求 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            自定义补充要求
            <Text type="secondary" style={{ fontWeight: "normal", marginLeft: 8 }}>（可选）</Text>
          </Text>
          <TextArea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="输入补充要求，如：注重培养数据分析能力，增加 Python 数据分析课程..."
            rows={3}
            maxLength={500}
            showCount
          />
        </div>

        {/* 最终提示词预览 */}
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>最终生成要求预览</Text>
          <Card size="small" style={{ background: "#fafafa", maxHeight: 120, overflow: "auto" }}>
            <Text style={{ whiteSpace: "pre-wrap" }}>{getFinalPrompt()}</Text>
          </Card>
        </div>

        {/* 操作按钮 */}
        <div style={{ textAlign: "right" }}>
          <Space>
            <Button onClick={() => {
              setGenerateModalVisible(false);
              setSelectedTemplates([]);
              setCustomPrompt("");
            }}>
              取消
            </Button>
            <Button 
              type="primary" 
              icon={<ThunderboltOutlined />} 
              loading={createJobMutation.isPending}
              onClick={() => createJobMutation.mutate(getFinalPrompt())}
            >
              开始生成
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Edit Title Modal */}
      <Modal
        title="编辑文档标题"
        open={editTitleModalVisible}
        onCancel={() => setEditTitleModalVisible(false)}
        footer={null}
        width={400}
      >
        {editTitleData && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: "block", marginBottom: 8 }}>文档标题</Text>
              <Input
                value={editTitleData.title}
                onChange={(e) => setEditTitleData({ ...editTitleData, title: e.target.value })}
                placeholder="请输入文档标题"
              />
            </div>
            <div style={{ textAlign: "right" }}>
              <Space>
                <Button onClick={() => setEditTitleModalVisible(false)}>取消</Button>
                <Button type="primary" onClick={() => updateTitleMutation.mutate(editTitleData)} loading={updateTitleMutation.isPending}>
                  保存
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview Drawer */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: "#1890ff" }} />
            <span>{previewRecord?.title || "文档预览"}</span>
          </Space>
        }
        placement="right"
        width={780}
        open={previewDrawerOpen}
        onClose={() => { setPreviewDrawerOpen(false); setPreviewRecord(null); }}
        extra={
          previewRecord && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(previewRecord)}
            >
              下载
            </Button>
          )
        }
      >
        <style>{`
          .markdown-preview table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 16px;
            font-size: 13px;
          }
          .markdown-preview th,
          .markdown-preview td {
            border: 1px solid #e0e0e0;
            padding: 8px 12px;
            text-align: left;
            vertical-align: top;
          }
          .markdown-preview th {
            background: #f5f5f5;
            font-weight: 600;
            color: #333;
          }
          .markdown-preview tr:nth-child(even) td {
            background: #fafafa;
          }
          .markdown-preview tr:hover td {
            background: #f0f7ff;
          }
          .markdown-preview h1 { font-size: 22px; margin: 16px 0 10px; border-bottom: 2px solid #e8e8e8; padding-bottom: 6px; }
          .markdown-preview h2 { font-size: 19px; margin: 14px 0 8px; }
          .markdown-preview h3 { font-size: 16px; margin: 12px 0 6px; }
          .markdown-preview ul, .markdown-preview ol { padding-left: 24px; margin: 8px 0; }
          .markdown-preview li { margin: 4px 0; }
          .markdown-preview code {
            background: #f0f0f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 13px;
            font-family: 'SF Mono', 'Monaco', 'Menlo', monospace;
          }
          .markdown-preview pre {
            background: #f5f5f5;
            padding: 12px 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 10px 0;
          }
          .markdown-preview pre code {
            background: none;
            padding: 0;
          }
          .markdown-preview hr { border: none; border-top: 1px solid #e8e8e8; margin: 16px 0; }
          .markdown-preview blockquote {
            border-left: 4px solid #1890ff;
            padding: 8px 16px;
            margin: 10px 0;
            background: #f0f7ff;
            color: #555;
          }
        `}</style>
        {previewRecord ? (
          previewRecord.markdownContent ? (
            <div className="markdown-preview">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {previewRecord.markdownContent}
              </ReactMarkdown>
            </div>
          ) : (
            <Empty description="暂无可预览内容" />
          )
        ) : (
          <Spin />
        )}
      </Drawer>
    </div>
  );
}
