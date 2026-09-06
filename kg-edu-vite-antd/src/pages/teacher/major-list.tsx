import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Table, Button, Typography, Tag, Modal, Input, Space, message, Popconfirm, Row, Col, InputNumber, Select } from "antd";
import type { TableColumnsType } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, EyeOutlined, BookOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useNavigate } from "react-router-dom";
import { listMajors, createMajor, updateMajor, deleteMajor } from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const STATUS_CONFIG: Record<string, { color: string; label: string }> = { draft: { color: "default", label: "草稿" }, active: { color: "green", label: "启用" }, archived: { color: "red", label: "归档" } };
const DEGREE_OPTIONS = [{ value: "bachelor", label: "本科" }, { value: "master", label: "硕士" }, { value: "doctoral", label: "博士" }];
interface Major { id: string; name: string; code?: string; description?: string; college?: string; degreeType?: string; duration?: number; status: string; }
type MajorStatus = "draft" | "active" | "archived";
type MajorFormData = { name: string; code: string; description: string; college: string; degreeType: string; duration: number; status: MajorStatus };

export default function MajorList() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMajor, setEditingMajor] = useState<Major | null>(null);
  const [formData, setFormData] = useState<MajorFormData>({ name: "", code: "", description: "", college: "", degreeType: "bachelor", duration: 4, status: "draft" });

  const { data: result, isLoading } = useQuery({
    queryKey: ["majors", tenant],
    queryFn: async () => { const r = await listMajors({ tenant, fields: ["id", "name", "code", "description", "college", "degreeType", "duration", "status"], headers }); const data = (r as any)?.data; return r?.success ? (data?.results || data || []) : []; },
    enabled: !!tenant,
  });
  const majors: Major[] = result || [];
  const saveMutation = useMutation({
    mutationFn: async () => editingMajor ? await updateMajor({ tenant, primaryKey: editingMajor.id, input: formData, fields: ["id"], headers }) : await createMajor({ tenant, input: formData, fields: ["id"], headers }),
    onSuccess: (res: any) => { message.success(editingMajor ? "已更新" : "已创建"); queryClient.invalidateQueries({ queryKey: ["majors"] }); setDialogOpen(false); setEditingMajor(null); if (!editingMajor && res?.data?.id) { navigate(`/teacher/dashboard/major-detail/${res.data.id}`); } },
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => await deleteMajor({ tenant, primaryKey: id, headers }),
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["majors"] }); },
  });
  const columns: TableColumnsType<Major> = [
    { title: "专业名称", dataIndex: "name", key: "name", ellipsis: true },
    { title: "代码", dataIndex: "code", key: "code" },
    { title: "学院", dataIndex: "college", key: "college" },
    { title: "学位", dataIndex: "degreeType", key: "degreeType", render: (v: string) => DEGREE_OPTIONS.find(o => o.value === v)?.label || v },
    { title: "学制", dataIndex: "duration", key: "duration", render: (v: number) => v ? `${v}年` : "-" },
    { title: "状态", dataIndex: "status", key: "status", render: (s: string) => { const c = STATUS_CONFIG[s] || { color: "default", label: s }; return <Tag color={c.color}>{c.label}</Tag>; } },
    { title: "操作", key: "actions", render: (_: unknown, r: Major) => (<Space><Button size="small" type="link" icon={<EyeOutlined />} onClick={() => navigate(`/teacher/dashboard/major-detail/${r.id}`)}>详情</Button><Button size="small" type="link" icon={<BookOutlined />} onClick={() => navigate(`/teacher/dashboard/major-courses/${r.id}`)}>课程</Button><ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => { setEditingMajor(r); setFormData({ name: r.name, code: r.code || "", description: r.description || "", college: r.college || "", degreeType: r.degreeType || "bachelor", duration: r.duration || 4, status: (r.status as MajorStatus) || "draft" }); setDialogOpen(true); }} /><Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}><ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>)},
  ];
  return (<div style={{ padding: 24 }}><Card><Row justify="space-between" align="middle" style={{ marginBottom: 16 }}><Col><Title level={4} style={{ margin: 0 }}><ApartmentOutlined /> 专业管理</Title></Col><Col><Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingMajor(null); setFormData({ name: "", code: "", description: "", college: "", degreeType: "bachelor", duration: 4, status: "draft" }); setDialogOpen(true); }} style={canEdit ? undefined : { display: "none" }}>添加专业</Button></Col></Row><Table columns={columns} dataSource={majors} rowKey="id" loading={isLoading} /></Card><Modal title={editingMajor ? "编辑专业" : "添加专业"} open={dialogOpen} onCancel={() => { setDialogOpen(false); setEditingMajor(null); }} onOk={() => saveMutation.mutate()} confirmLoading={saveMutation.isPending} width={600}><Space direction="vertical" style={{ width: "100%" }} size="middle"><Row gutter={16}><Col span={12}><Text>专业名称 *</Text><Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></Col><Col span={12}><Text>专业代码</Text><Input value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} /></Col></Row><Row gutter={16}><Col span={12}><Text>学院</Text><Input value={formData.college} onChange={e => setFormData({ ...formData, college: e.target.value })} /></Col><Col span={12}><Text>学位类型</Text><Select style={{ width: "100%" }} value={formData.degreeType} onChange={v => setFormData({ ...formData, degreeType: v })} options={DEGREE_OPTIONS} /></Col></Row><Row gutter={16}><Col span={12}><Text>学制</Text><InputNumber style={{ width: "100%" }} value={formData.duration} onChange={v => setFormData({ ...formData, duration: v || 4 })} min={2} max={8} /></Col><Col span={12}><Text>状态</Text><Select style={{ width: "100%" }} value={formData.status} onChange={v => setFormData({ ...formData, status: v as MajorStatus })} options={Object.entries(STATUS_CONFIG).map(([v, c]) => ({ value: v, label: c.label }))} /></Col></Row><div><Text>描述</Text><Input.TextArea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} /></div></Space></Modal></div>);
}
