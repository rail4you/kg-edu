import * as React from "react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Table, Button, Typography, Tag, Modal, message, Popconfirm, Space, Empty } from "antd";
import { DeleteOutlined, FileTextOutlined, RobotOutlined, EyeOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getReportsByMajor, deleteReport, generateReport } from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const TYPE_OPTIONS = [{ value: "job_analysis", label: "岗位分析" }, { value: "competency", label: "能力图谱" }, { value: "curriculum", label: "课程体系" }, { value: "comprehensive", label: "综合分析" }];

export default function MajorReport() {
  const { majorId } = useParams<{ majorId: string }>();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [generateVisible, setGenerateVisible] = useState(false);
  const [reportType, setReportType] = useState("comprehensive");

  const { data: reports, isLoading } = useQuery({
    queryKey: ["reports", majorId, tenant],
    queryFn: async () => { const r = await getReportsByMajor({ tenant, input: { majorId }, fields: ["id", "title", "reportType", "content", "aiGenerated", "generatedAt"], headers }); return r?.success ? (r.data?.results || r.data || []) : []; },
    enabled: !!majorId && !!tenant,
  });
  const generateMutation = useMutation({
    mutationFn: async () => await generateReport({ tenant, input: { majorId, reportType }, headers }),
    onSuccess: () => { message.success("报告已生成"); queryClient.invalidateQueries({ queryKey: ["reports"] }); setGenerateVisible(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await deleteReport({ tenant, input: { id }, headers }),
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["reports"] }); },
  });

  const columns = [
    { title: "报告标题", dataIndex: "title", key: "title", ellipsis: true },
    { title: "类型", dataIndex: "reportType", key: "reportType", render: (v: string) => <Tag>{TYPE_OPTIONS.find(o => o.value === v)?.label || v}</Tag> },
    { title: "来源", dataIndex: "aiGenerated", key: "aiGenerated", render: (v: boolean) => v ? <Tag color="purple">AI 生成</Tag> : <Tag>手动</Tag> },
    { title: "操作", key: "actions", render: (_: unknown, record: any) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedReport(record); setPreviewVisible(true); }}>查看</Button>
        <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}><ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    )},
  ];

  return (<div style={{ padding: 24 }}><Card>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
      <Title level={4} style={{ margin: 0 }}><FileTextOutlined /> 分析报告</Title>
      <Button type="primary" icon={<RobotOutlined />} onClick={() => setGenerateVisible(true)} style={canEdit ? undefined : { display: "none" }}>AI 生成报告</Button>
    </div>
    <Table columns={columns} dataSource={reports || []} rowKey="id" loading={isLoading} locale={{ emptyText: <Empty description="暂无报告，点击上方按钮 AI 生成" /> }} />
  </Card>
  <Modal title="AI 生成报告" open={generateVisible} onCancel={() => setGenerateVisible(false)} onOk={() => generateMutation.mutate()} confirmLoading={generateMutation.isPending}>
    <Space direction="vertical" style={{ width: "100%" }}><Text>选择报告类型</Text>
      <select style={{ width: "100%", padding: 8, borderRadius: 4, border: "1px solid #d9d9d9" }} value={reportType} onChange={e => setReportType(e.target.value)}>{TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </Space>
  </Modal>
  <Modal title={selectedReport?.title || "报告预览"} open={previewVisible} onCancel={() => setPreviewVisible(false)} footer={null} width={800}>
    {selectedReport?.content ? <div style={{ background: "#f5f5f5", padding: 24, borderRadius: 8, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{selectedReport.content}</div> : <Empty description="暂无内容" />}
  </Modal></div>);
}
