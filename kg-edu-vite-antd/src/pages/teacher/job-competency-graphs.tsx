import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card, Table, Button, Typography, Tag, Modal, Input, Space, message, Popconfirm,
  Row, Col, Select, Switch, InputNumber, Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ApartmentOutlined,
  CopyOutlined, CheckCircleOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listJobPositions, getPositionsByMajor, listMajors,
  listJobCompetencyGraphs, listGraphsByJobPosition,
  createJobCompetencyGraph, updateJobCompetencyGraph, deleteJobCompetencyGraph,
  activateJobCompetencyGraph, cloneJobCompetencyGraph,
  listCoreTasksByGraph, listAbilitiesByGraph, listLinksByGraph,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Graph {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  version: number;
  jobPositionId: string;
}

interface JobPosition { id: string; title: string; majorId?: string; }
interface Major { id: string; name: string; }

export default function TeacherJobCompetencyGraphs() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();
  const [searchParams, setSearchParams] = useSearchParams();

  const [jobFilter, setJobFilter] = useState<string | undefined>(searchParams.get("jobPositionId") || undefined);
  const [majorFilter, setMajorFilter] = useState<string | undefined>();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Graph | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; isActive: boolean; version: number; jobPositionId?: string }>({
    name: "", description: "", isActive: true, version: 1, jobPositionId: undefined,
  });

  // 同步 URL 参数变化
  useEffect(() => {
    const jpId = searchParams.get("jobPositionId");
    if (jpId !== jobFilter) setJobFilter(jpId || undefined);
  }, [searchParams]);

  const setJobFilterAndUrl = (val?: string) => {
    setJobFilter(val);
    const params = new URLSearchParams(searchParams);
    if (val) params.set("jobPositionId", val); else params.delete("jobPositionId");
    setSearchParams(params, { replace: true });
  };

  const { data: majorsRes } = useQuery({
    queryKey: ["majors-for-graphs", tenant],
    queryFn: async () => {
      const r = await listMajors({ tenant, fields: ["id", "name"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const majors: Major[] = useMemo(() => (Array.isArray(majorsRes) ? majorsRes : []), [majorsRes]);

  const { data: jobsRes } = useQuery({
    queryKey: ["jobs-for-graphs", tenant, majorFilter],
    queryFn: async () => {
      if (majorFilter) {
        const r = await getPositionsByMajor({ tenant, input: { majorId: majorFilter }, fields: ["id", "title", "majorId"], headers });
        const data = (r as any)?.data;
        return r?.success ? (data?.results || data || []) : [];
      }
      const r = await listJobPositions({ tenant, fields: ["id", "title", "majorId"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const jobs: JobPosition[] = useMemo(() => (Array.isArray(jobsRes) ? jobsRes : []), [jobsRes]);

  const { data: graphsRes, isLoading } = useQuery({
    queryKey: ["job-graphs", tenant, jobFilter],
    queryFn: async () => {
      if (jobFilter) {
        const r = await listGraphsByJobPosition({ tenant, input: { jobPositionId: jobFilter }, fields: ["id", "name", "description", "isActive", "version", "jobPositionId"], headers });
        const data = (r as any)?.data;
        return r?.success ? (data?.results || data || []) : [];
      }
      const r = await listJobCompetencyGraphs({ tenant, fields: ["id", "name", "description", "isActive", "version", "jobPositionId"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const graphs: Graph[] = useMemo(() => (Array.isArray(graphsRes) ? graphsRes : []), [graphsRes]);

  // 统计数据
  const { data: stats } = useQuery({
    queryKey: ["job-graph-stats", tenant, graphs],
    queryFn: async () => {
      const result: Record<string, { tasks: number; abilities: number; links: number }> = {};
      for (const g of graphs) {
        const [tR, aR, lR] = await Promise.all([
          listCoreTasksByGraph({ tenant, input: { graphId: g.id }, fields: ["id"], headers }),
          listAbilitiesByGraph({ tenant, input: { graphId: g.id }, fields: ["id"], headers }),
          listLinksByGraph({ tenant, input: { graphId: g.id }, fields: ["id"], headers }),
        ]);
        const tData = (tR as any)?.data;
        const aData = (aR as any)?.data;
        const lData = (lR as any)?.data;
        result[g.id] = {
          tasks: Array.isArray(tData) ? tData.length : (tData?.results?.length || 0),
          abilities: Array.isArray(aData) ? aData.length : (aData?.results?.length || 0),
          links: Array.isArray(lData) ? lData.length : (lData?.results?.length || 0),
        };
      }
      return result;
    },
    enabled: !!tenant && graphs.length > 0,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return await updateJobCompetencyGraph({ tenant, primaryKey: editing.id, input: { name: form.name, description: form.description, isActive: form.isActive, version: form.version }, fields: ["id"], headers });
      }
      if (!form.jobPositionId) throw new Error("请选择关联岗位");
      return await createJobCompetencyGraph({ tenant, input: { name: form.name, description: form.description, isActive: form.isActive, version: form.version, jobPositionId: form.jobPositionId }, fields: ["id"], headers });
    },
    onSuccess: () => {
      message.success(editing ? "已更新" : "已创建");
      queryClient.invalidateQueries({ queryKey: ["job-graphs"] });
      setDialogOpen(false);
      setEditing(null);
    },
    onError: (e: any) => { message.error(e?.message || "保存失败"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteJobCompetencyGraph({ tenant, primaryKey: id, headers });
      if (!result.success) throw new Error((result as any).errors?.[0]?.message || "删除失败");
      return result;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["job-graphs"] }); },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await activateJobCompetencyGraph({ tenant, primaryKey: id, fields: ["id"], headers });
      if (!result.success) throw new Error((result as any).errors?.[0]?.message || "操作失败");
      return result;
    },
    onSuccess: () => { message.success("已设为激活版本"); queryClient.invalidateQueries({ queryKey: ["job-graphs"] }); },
    onError: (e: Error) => { message.error(e.message || "操作失败"); },
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await cloneJobCompetencyGraph({ tenant, input: { id }, headers });
      if (!result.success) throw new Error((result as any).errors?.[0]?.message || "复制失败");
      return result;
    },
    onSuccess: () => { message.success("已复制"); queryClient.invalidateQueries({ queryKey: ["job-graphs"] }); },
    onError: (e: Error) => { message.error(e.message || "复制失败"); },
  });

  const columns: TableColumnsType<Graph> = [
    { title: "图谱名称", dataIndex: "name", key: "name", ellipsis: true },
    { title: "关联岗位", dataIndex: "jobPositionId", key: "jobPositionId", render: (v: string) => {
      const title = jobs.find(j => j.id === v)?.title || "-";
      return <Tooltip title={title} mouseEnterDelay={0.3}><Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Text></Tooltip>;
    } },
    { title: "版本", dataIndex: "version", key: "version", render: (v: number) => <Tag>v{v || 1}</Tag> },
    {
      title: "核心任务", key: "taskCount", render: (_: unknown, r: Graph) => stats?.[r.id]?.tasks ?? "-",
    },
    {
      title: "能力点", key: "abilityCount", render: (_: unknown, r: Graph) => stats?.[r.id]?.abilities ?? "-",
    },
    {
      title: "知识点关联", key: "linkCount", render: (_: unknown, r: Graph) => stats?.[r.id]?.links ?? "-",
    },
    {
      title: "状态", dataIndex: "isActive", key: "isActive", render: (v: boolean) => v ? <Tag color="green">激活</Tag> : <Tag>未激活</Tag>,
    },
    {
      title: "操作", key: "actions", render: (_: unknown, r: Graph) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/teacher/dashboard/job-competency-graphs/${r.id}`)}>查看</Button>
          <ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => {
            setEditing(r);
            setForm({ name: r.name, description: r.description || "", isActive: r.isActive, version: r.version, jobPositionId: r.jobPositionId });
            setDialogOpen(true);
          }} />
          <ReadonlyActionButton size="small" icon={<CopyOutlined />} onClick={() => cloneMutation.mutate(r.id)}>复制</ReadonlyActionButton>
          {!r.isActive && <ReadonlyActionButton size="small" icon={<CheckCircleOutlined />} onClick={() => activateMutation.mutate(r.id)}>激活</ReadonlyActionButton>}
          <Popconfirm title="确定删除？将级联删除所有任务/能力/知识点关联。" onConfirm={() => deleteMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="job-competency-graphs-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.job-competency-graphs-wrap{padding:12px!important}.job-competency-graphs-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}><ApartmentOutlined /> 岗位能力图谱</Title></Col>
          <Col>
            <Space>
              <Select
                allowClear
                placeholder="按专业筛选"
                style={{ width: 180 }}
                value={majorFilter}
                onChange={setMajorFilter}
                options={majors.map(m => ({ value: m.id, label: m.name }))}
              />
              <Select
                allowClear
                placeholder="按岗位筛选"
                style={{ width: 220 }}
                value={jobFilter}
                onChange={setJobFilterAndUrl}
                options={jobs.map(j => ({ value: j.id, label: j.title }))}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditing(null);
                  setForm({ name: "", description: "", isActive: true, version: 1, jobPositionId: jobFilter });
                  setDialogOpen(true);
                }}
                style={canEdit ? undefined : { display: "none" }}
              >
                创建图谱
              </Button>
            </Space>
          </Col>
        </Row>
        <Table columns={columns} dataSource={graphs} rowKey="id" loading={isLoading} pagination={{ pageSize: 20 }} />
      </Card>

      <Modal
        title={editing ? "编辑图谱" : "创建图谱"}
        open={dialogOpen}
        onCancel={() => { setDialogOpen(false); setEditing(null); }}
        onOk={() => saveMutation.mutate()}
        confirmLoading={saveMutation.isPending}
        width={600}
        okButtonProps={{ disabled: !form.name || (!editing && !form.jobPositionId) }}
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          {!editing && (
            <div>
              <Text>关联岗位 *</Text>
              <Select
                style={{ width: "100%" }}
                placeholder="选择岗位"
                value={form.jobPositionId}
                onChange={v => setForm({ ...form, jobPositionId: v })}
                options={jobs.map(j => ({ value: j.id, label: j.title }))}
                showSearch
                optionFilterProp="label"
              />
            </div>
          )}
          <div><Text>图谱名称 *</Text><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：2024版高级开发岗位能力图谱" /></div>
          <div><Text>描述</Text><Input.TextArea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} /></div>
          <Row gutter={16}>
            <Col span={12}><Text>版本</Text><InputNumber style={{ width: "100%" }} value={form.version} min={1} onChange={v => setForm({ ...form, version: v || 1 })} /></Col>
            <Col span={12}>
              <Text>激活状态</Text>
              <div><Switch checked={form.isActive} onChange={v => setForm({ ...form, isActive: v })} checkedChildren="激活" unCheckedChildren="未激活" /></div>
            </Col>
          </Row>
        </Space>
      </Modal>
    </div>
  );
}
