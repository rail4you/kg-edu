import * as React from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Table, Button, Typography, Tag, Modal, Input, Space, message, Popconfirm, Descriptions } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined, DeleteOutlined, EyeOutlined, TeamOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getPositionsByMajor, createJobPosition, deleteJobPosition } from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

export default function MajorJobs() {
  const { majorId } = useParams<{ majorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [formData, setFormData] = useState({ title: "", description: "", requirements: "", salaryRange: "", source: "" });

  const { data: jobs, isLoading } = useQuery({
    queryKey: ["job-positions", majorId, tenant],
    queryFn: async () => { const r = await getPositionsByMajor({ tenant, input: { majorId }, fields: ["id", "title", "description", "requirements", "salaryRange", "source"], headers }); return r?.success ? (r.data?.results || r.data || []) : []; },
    enabled: !!majorId && !!tenant,
  });

  const createMutation = useMutation({
    mutationFn: async () => await createJobPosition({ tenant, input: { ...formData, majorId }, fields: ["id"], headers }),
    onSuccess: () => { message.success("岗位已添加"); queryClient.invalidateQueries({ queryKey: ["job-positions"] }); setDialogOpen(false); },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteJobPosition({ tenant, primaryKey: id, headers });
      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "删除失败");
      }
      return result;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["job-positions"] }); },
    onError: (error: Error) => { message.error(error.message || "删除失败"); },
  });

  const columns: TableColumnsType<any> = [
    { title: "岗位名称", dataIndex: "title", key: "title", ellipsis: true },
    { title: "薪资范围", dataIndex: "salaryRange", key: "salaryRange" },
    { title: "来源", dataIndex: "source", key: "source" },
    { title: "操作", key: "actions", render: (_: unknown, record: any) => (
      <Space>
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelectedJob(record); setDetailDialogOpen(true); }} />
        <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(record.id)}><ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </Space>
    )},
  ];

  return (<div style={{ padding: 24 }}>
    <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate(`/teacher/dashboard/major-detail/${majorId}`)}>返回专业管理</Button>
    <Card>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
      <Title level={4} style={{ margin: 0 }}><TeamOutlined /> 岗位管理</Title>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { setFormData({ title: "", description: "", requirements: "", salaryRange: "", source: "" }); setDialogOpen(true); }} style={canEdit ? undefined : { display: "none" }}>添加岗位</Button>
    </div>
    <Table columns={columns} dataSource={jobs || []} rowKey="id" loading={isLoading} />
  </Card>
  <Modal title="添加岗位" open={dialogOpen} onCancel={() => setDialogOpen(false)} onOk={() => createMutation.mutate()} confirmLoading={createMutation.isPending}>
    <Space direction="vertical" style={{ width: "100%" }}>
      <div><Text>岗位名称 *</Text><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
      <div><Text>描述</Text><Input.TextArea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></div>
      <div><Text>要求</Text><Input.TextArea value={formData.requirements} onChange={e => setFormData({ ...formData, requirements: e.target.value })} rows={3} /></div>
      <Space><div><Text>薪资范围</Text><Input value={formData.salaryRange} onChange={e => setFormData({ ...formData, salaryRange: e.target.value })} placeholder="8K-15K" /></div><div><Text>来源</Text><Input value={formData.source} onChange={e => setFormData({ ...formData, source: e.target.value })} placeholder="招聘网站" /></div></Space>
    </Space>
  </Modal>
  <Modal title={`岗位详情 - ${selectedJob?.title || ""}`} open={detailDialogOpen} onCancel={() => setDetailDialogOpen(false)} footer={null} width={700}>
    {selectedJob && (<Descriptions column={1} bordered>
      <Descriptions.Item label="岗位名称">{selectedJob.title}</Descriptions.Item>
      <Descriptions.Item label="描述">{selectedJob.description || "-"}</Descriptions.Item>
      <Descriptions.Item label="要求">{selectedJob.requirements || "-"}</Descriptions.Item>
      <Descriptions.Item label="薪资">{selectedJob.salaryRange || "-"}</Descriptions.Item>
    </Descriptions>)}
  </Modal>
  </div>);
}
