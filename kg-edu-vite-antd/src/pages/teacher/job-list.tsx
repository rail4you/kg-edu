import * as React from "react";
import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Table, Button, Typography, Tag, Modal, Input, Space, message, Popconfirm,
  Row, Col, Select, Divider, Tooltip, Alert,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, TeamOutlined,
  ApartmentOutlined,
  ArrowLeftOutlined,
  SettingOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listMajors, listJobPositions, getPositionsByMajor,
  createJobPosition, updateJobPosition, deleteJobPosition,
  createMajor, deleteMajor, updateMajor,
  listJobCompetencyGraphs,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface JobPosition {
  id: string;
  title: string;
  description?: string | null;
  requirements?: string | null;
  salaryRange?: string | null;
  source?: string | null;
  majorId?: string;
}

interface Major {
  id: string;
  name: string;
}

export default function TeacherJobList() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();
  const [searchParams] = useSearchParams();

  const [majorFilter, setMajorFilter] = useState<string | undefined>(searchParams.get("majorId") || undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [graphDialogOpen, setGraphDialogOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosition | null>(null);
  const [selected, setSelected] = useState<JobPosition | null>(null);
  const [form, setForm] = useState({ title: "", description: "", requirements: "", salaryRange: "", source: "", majorId: "" as string | undefined, majorName: "" });
  const [majorSearch, setMajorSearch] = useState("");
  const [majorEditOpen, setMajorEditOpen] = useState(false);
  const [editingMajor, setEditingMajor] = useState<Major | null>(null);
  const [majorEditName, setMajorEditName] = useState("");
  const [majorManageOpen, setMajorManageOpen] = useState(false);
  const [newMajorName, setNewMajorName] = useState("");

  const { data: majorsRes } = useQuery({
    queryKey: ["majors-for-jobs", tenant],
    queryFn: async () => {
      const r = await listMajors({ tenant, fields: ["id", "name"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const majors: Major[] = useMemo(() => (Array.isArray(majorsRes) ? majorsRes : []), [majorsRes]);

  const { data: jobsRes, isLoading } = useQuery({
    queryKey: ["job-positions-all", tenant, majorFilter],
    queryFn: async () => {
      if (majorFilter) {
        const r = await getPositionsByMajor({ tenant, input: { majorId: majorFilter }, fields: ["id", "title", "description", "requirements", "salaryRange", "source", "majorId"], headers });
        const data = (r as any)?.data;
        return r?.success ? (data?.results || data || []) : [];
      } else {
        const r = await listJobPositions({ tenant, fields: ["id", "title", "description", "requirements", "salaryRange", "source", "majorId"], headers });
        const data = (r as any)?.data;
        return r?.success ? (data?.results || data || []) : [];
      }
    },
    enabled: !!tenant,
  });
  const jobs: JobPosition[] = useMemo(() => (Array.isArray(jobsRes) ? jobsRes : []), [jobsRes]);

  // 关联图谱：按 job position id 汇总
  const { data: graphsRes } = useQuery({
    queryKey: ["job-graphs-summary", tenant],
    queryFn: async () => {
      const r = await listJobCompetencyGraphs({ tenant, fields: ["id", "name", "jobPositionId", "isActive"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const graphs: Array<{ id: string; name: string; jobPositionId: string; isActive: boolean }> = useMemo(() => (Array.isArray(graphsRes) ? graphsRes : []), [graphsRes]);
  const graphsByJob = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of graphs) m[g.jobPositionId] = (m[g.jobPositionId] || 0) + 1;
    return m;
  }, [graphs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const majorId = form.majorId || editing?.majorId;
      if (!majorId) throw new Error("请选择所属专业（可在“管理专业”中新建）");
      const payload: any = { title: form.title, description: form.description, requirements: form.requirements, salaryRange: form.salaryRange, source: form.source, majorId };
      if (editing) {
        return await updateJobPosition({ tenant, primaryKey: editing.id, input: payload, fields: ["id"], headers });
      }
      return await createJobPosition({ tenant, input: payload, fields: ["id"], headers });
    },
    onSuccess: () => {
      message.success(editing ? "已更新" : "岗位已添加");
      queryClient.invalidateQueries({ queryKey: ["job-positions-all"] });
      queryClient.invalidateQueries({ queryKey: ["majors-for-jobs"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ title: "", description: "", requirements: "", salaryRange: "", source: "", majorId: "", majorName: "" });
      setMajorSearch("");
    },
    onError: (e: any) => { message.error(e?.message || "保存失败"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteJobPosition({ tenant, primaryKey: id, headers });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "删除失败");
      }
      return result;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["job-positions-all"] }); },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const deleteMajorMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteMajor({ tenant, primaryKey: id, headers });
      if (!(r as any)?.success) throw new Error((r as any)?.errors?.[0]?.message || "删除失败");
      return r;
    },
    onSuccess: () => {
      message.success("专业已删除");
      queryClient.invalidateQueries({ queryKey: ["majors-for-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-positions-all"] });
      if (majorFilter) setMajorFilter(undefined);
    },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const updateMajorMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const r = await updateMajor({ tenant, primaryKey: id, input: { name }, fields: ["id", "name"], headers });
      if (!(r as any)?.success) throw new Error((r as any)?.errors?.[0]?.message || "更新失败");
      return r;
    },
    onSuccess: () => {
      message.success("专业已更新");
      queryClient.invalidateQueries({ queryKey: ["majors-for-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-positions-all"] });
      setMajorEditOpen(false);
      setEditingMajor(null);
      setMajorEditName("");
    },
    onError: (e: Error) => { message.error(e.message || "更新失败"); },
  });

  const createMajorMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await createMajor({ tenant, input: { name }, fields: ["id", "name"], headers });
      if (!(r as any)?.success) throw new Error((r as any)?.errors?.[0]?.message || "创建专业失败");
      return r;
    },
    onSuccess: () => {
      message.success("专业已创建");
      queryClient.invalidateQueries({ queryKey: ["majors-for-jobs"] });
      setNewMajorName("");
    },
    onError: (e: Error) => { message.error(e.message || "创建失败"); },
  });

  const columns: TableColumnsType<JobPosition> = [
    { title: "岗位名称", dataIndex: "title", key: "title", ellipsis: true },
    { title: "所属专业", dataIndex: "majorId", key: "majorId", render: (v: string) => {
      const name = majors.find(m => m.id === v)?.name || "-";
      return <Tooltip title={name} mouseEnterDelay={0.3}><Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Text></Tooltip>;
    } },
    { title: "薪资范围", dataIndex: "salaryRange", key: "salaryRange" },
    { title: "来源", dataIndex: "source", key: "source" },
    {
      title: "能力图谱", key: "graphCount", render: (_: unknown, r: JobPosition) => {
        const count = graphsByJob[r.id] || 0;
        if (count === 0) {
          return <Button size="small" type="link" icon={<ApartmentOutlined />} onClick={() => navigate(`/teacher/dashboard/job-competency-graphs?jobPositionId=${r.id}`)}>新建</Button>;
        }
        return <Button size="small" type="link" onClick={() => navigate(`/teacher/dashboard/job-competency-graphs?jobPositionId=${r.id}`)}>{count} 张</Button>;
      },
    },
    {
      title: "操作", key: "actions", render: (_: unknown, r: JobPosition) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailDialogOpen(true); }} />
          <ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            setForm({ title: r.title, description: r.description || "", requirements: r.requirements || "", salaryRange: r.salaryRange || "", source: r.source || "", majorId: r.majorId, majorName: "" });
            setDialogOpen(true);
          }} />
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}><ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="job-list-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.job-list-wrap{padding:12px!important}.job-list-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}><TeamOutlined /> 岗位管理</Title></Col>
          <Col>
            <Space>
              <Select
                allowClear
                placeholder="按专业筛选"
                style={{ width: 180 }}
                value={majorFilter}
                onChange={setMajorFilter}
                options={majors.map(m => ({ value: m.id, label: m.name }))}
                notFoundContent={majors.length === 0 ? "暂无专业，请先在“管理专业”中新建" : undefined}
              />
              <Button icon={<SettingOutlined />} onClick={() => setMajorManageOpen(true)}>管理专业</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setForm({ title: "", description: "", requirements: "", salaryRange: "", source: "", majorId: "", majorName: "" });
                  setMajorSearch("");
                  setDialogOpen(true);
                }}
                style={canEdit ? undefined : { display: "none" }}
              >
                添加岗位
              </Button>
            </Space>
          </Col>
        </Row>
        {majors.length === 0 && (
          <Alert type="info" showIcon message="暂无专业" description={<span>当前暂无专业，请先 <a onClick={() => setMajorManageOpen(true)}>前往“管理专业”新建专业</a> 后再创建岗位</span>} style={{ marginBottom: 12 }} />
        )}
        <Table columns={columns} dataSource={jobs} rowKey="id" loading={isLoading} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={editing ? "编辑岗位" : "添加岗位"}
        open={dialogOpen}
        onCancel={() => { setDialogOpen(false); setEditing(null); }}
        onOk={() => saveMutation.mutate()}
        confirmLoading={saveMutation.isPending}
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>岗位名称 *</Text><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Text>所属专业 *</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder={majors.length === 0 ? "暂无专业，请先在“管理专业”中新建" : "请选择所属专业"}
              value={form.majorId || undefined}
              onChange={v => setForm({ ...form, majorId: v })}
              options={majors.map(m => ({ value: m.id, label: m.name }))}
              notFoundContent={majors.length === 0 ? "暂无专业" : undefined}
              disabled={majors.length === 0}
            />
            {majors.length === 0 && (
              <div style={{ marginTop: 8, padding: "6px 10px", background: "#fffbe6", border: "1px solid #ffe58f", borderRadius: 4, fontSize: 12, color: "#666" }}>
                暂无专业，请先 <a onClick={() => { setDialogOpen(false); setMajorManageOpen(true); }}>前往“管理专业”新建</a> 后再创建岗位
              </div>
            )}
          </div>
          <div><Text>描述</Text><Input.TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <div><Text>要求</Text><Input.TextArea value={form.requirements} onChange={e => setForm({ ...form, requirements: e.target.value })} rows={3} /></div>
          <Space>
            <div><Text>薪资范围</Text><Input value={form.salaryRange} onChange={e => setForm({ ...form, salaryRange: e.target.value })} placeholder="8K-15K" /></div>
            <div><Text>来源</Text><Input value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} placeholder="招聘网站" /></div>
          </Space>
        </Space>
      </Modal>

      <Modal title={`岗位详情 - ${selected?.title || ""}`} open={detailDialogOpen} onCancel={() => setDetailDialogOpen(false)} footer={null} width={700}>
        {selected && (
          <div>
            <Row gutter={[16, 8]}>
              <Col span={6}><Text type="secondary">岗位名称</Text></Col>
              <Col span={18}><Text strong>{selected.title}</Text></Col>
              <Col span={6}><Text type="secondary">所属专业</Text></Col>
              <Col span={18}><Text>{majors.find(m => m.id === selected.majorId)?.name || "-"}</Text></Col>
              <Col span={6}><Text type="secondary">薪资</Text></Col>
              <Col span={18}><Text>{selected.salaryRange || "-"}</Text></Col>
              <Col span={6}><Text type="secondary">来源</Text></Col>
              <Col span={18}><Text>{selected.source || "-"}</Text></Col>
            </Row>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">描述</Text>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.description || "-"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">要求</Text>
              <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{selected.requirements || "-"}</div>
            </div>
            <div style={{ marginTop: 24, textAlign: "right" }}>
              <Button type="primary" icon={<ApartmentOutlined />} onClick={() => navigate(`/teacher/dashboard/job-competency-graphs?jobPositionId=${selected.id}`)}>查看能力图谱</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal title="能力图谱" open={graphDialogOpen} onCancel={() => setGraphDialogOpen(false)} footer={null} />

      <Modal
        title={`编辑专业 - ${editingMajor?.name || ""}`}
        open={majorEditOpen}
        onCancel={() => { setMajorEditOpen(false); setEditingMajor(null); setMajorEditName(""); }}
        onOk={() => {
          if (!editingMajor) return;
          const name = majorEditName.trim();
          if (!name) { message.error("请输入专业名称"); return; }
          updateMajorMutation.mutate({ id: editingMajor.id, name });
        }}
        confirmLoading={updateMajorMutation.isPending}
        okButtonProps={{ disabled: !majorEditName.trim() || majorEditName.trim() === editingMajor?.name }}
      >
        <div style={{ marginTop: 8 }}>
          <Text>专业名称 *</Text>
          <Input value={majorEditName} onChange={e => setMajorEditName(e.target.value)} placeholder="请输入专业名称" style={{ marginTop: 4 }} onPressEnter={() => {
            if (!editingMajor) return;
            const name = majorEditName.trim();
            if (!name || name === editingMajor.name) return;
            updateMajorMutation.mutate({ id: editingMajor.id, name });
          }} />
        </div>
      </Modal>

      <Modal
        title="管理专业"
        open={majorManageOpen}
        onCancel={() => setMajorManageOpen(false)}
        footer={null}
        width={520}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Input value={newMajorName} onChange={e => setNewMajorName(e.target.value)} placeholder="输入新专业名称" onPressEnter={() => {
            const name = newMajorName.trim();
            if (!name) { message.error("请输入专业名称"); return; }
            createMajorMutation.mutate(name);
          }} />
          <Button type="primary" icon={<PlusOutlined />} loading={createMajorMutation.isPending} disabled={!newMajorName.trim()} onClick={() => {
            const name = newMajorName.trim();
            if (!name) { message.error("请输入专业名称"); return; }
            createMajorMutation.mutate(name);
          }}>新建</Button>
        </div>
        {majors.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无专业，请在上方输入名称后点击“新建”</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {majors.map(m => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #f0f0f0", borderRadius: 8, background: "#fafafa" }}>
                <Text strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</Text>
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingMajor(m); setMajorEditName(m.name); setMajorEditOpen(true); }}>重命名</Button>
                  <Popconfirm title={`确定删除专业「${m.name}」？`} description="该专业下的岗位将一并删除" onConfirm={() => deleteMajorMutation.mutate(m.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
