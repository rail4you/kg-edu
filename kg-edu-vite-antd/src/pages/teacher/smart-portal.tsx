import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App,
  Button,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listUsers, listClasses } from "@/lib/ash_rpc";
import {
  createTeacherPortal,
  deleteTeacherPortal,
  fetchSmartPortalTemplate,
  fetchTeacherPortals,
  updateTeacherPortal,
  type BlockType,
  type PortalBlock,
  type SmartPortalConfig,
} from "@/lib/smart-portal";
import {
  BLOCK_LIST,
  BLOCK_REGISTRY,
  createBlock,
  hydrateBlock,
} from "@/components/smart-portal/registry";
import { ConfigForm } from "@/components/smart-portal/ConfigForm";
import { SmartPortalRenderer } from "@/components/smart-portal/SmartPortalRenderer";
import { useSmartPortalData } from "@/components/smart-portal/use-smart-portal-data";
import { AppPage } from "@/components/proto";
import {
  StudentTableSelect,
  type StudentOption,
  type ClassOption,
} from "@/components/teacher/student-table-select";

const { Text, Paragraph } = Typography;

const WIDTH_OPTIONS = [
  { label: "1/2 宽（12）", value: 12 },
  { label: "1/3 宽（8）", value: 8 },
  { label: "2/3 宽（16）", value: 16 },
  { label: "1/4 宽（6）", value: 6 },
  { label: "3/4 宽（18）", value: 18 },
  { label: "整行（24）", value: 24 },
];

const BLOCK_TYPE_OPTIONS = BLOCK_LIST.map((d) => ({ label: d.label, value: d.type }));

function formatTime(v?: string): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

/* ---------------------- 组件编辑器（主从布局） ---------------------- */

interface ComponentsEditorProps {
  blocks: PortalBlock[];
  onChange: (blocks: PortalBlock[]) => void;
  onPreview: () => void;
}

const ComponentsEditor: React.FC<ComponentsEditorProps> = ({ blocks, onChange, onPreview }) => {
  const [selectedId, setSelectedId] = useState<string | null>(blocks[0]?.id ?? null);
  const [addType, setAddType] = useState<BlockType | undefined>(undefined);

  const selected = blocks.find((b) => b.id === selectedId) || null;

  useEffect(() => {
    if (selectedId && !blocks.some((b) => b.id === selectedId)) {
      setSelectedId(blocks[0]?.id ?? null);
    }
  }, [blocks, selectedId]);

  const addBlock = () => {
    if (!addType) return;
    const b = createBlock(addType);
    onChange([...blocks, b]);
    setSelectedId(b.id);
    setAddType(undefined);
  };

  const updateBlock = (id: string, patch: Partial<PortalBlock>) => {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const [item] = next.splice(idx, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* 左：组件列表 */}
      <div style={{ width: 300, flexShrink: 0 }}>
        <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
          <Select
            style={{ flex: 1 }}
            placeholder="选择组件类型"
            value={addType}
            onChange={setAddType}
            options={BLOCK_TYPE_OPTIONS}
            showSearch
            optionFilterProp="label"
          />
          <Button type="primary" icon={<PlusOutlined />} disabled={!addType} onClick={addBlock}>
            添加
          </Button>
        </Space.Compact>

        <div
          style={{
            border: "1px solid #eef1f6",
            borderRadius: 10,
            background: "#fafbfd",
            padding: 8,
            maxHeight: 420,
            overflowY: "auto",
          }}
        >
          {blocks.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无组件，请先添加" style={{ margin: "32px 0" }} />
          ) : (
            blocks.map((block) => {
              const def = BLOCK_REGISTRY[block.type];
              const active = block.id === selectedId;
              return (
                <div
                  key={block.id}
                  onClick={() => setSelectedId(block.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: 8,
                    cursor: "pointer",
                    border: active ? "1px solid #1766d8" : "1px solid transparent",
                    background: active ? "#f0f7ff" : "#fff",
                  }}
                >
                  <span style={{ color: "#1766d8" }}>{def?.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {block.title || def?.label}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {def?.label}
                    </Text>
                  </div>
                  <Tag style={{ marginInlineEnd: 0 }}>{block.span}/24</Tag>
                </div>
              );
            })
          )}
        </div>

        <Button
          block
          size="small"
          icon={<ReloadOutlined />}
          style={{ marginTop: 8 }}
          onClick={async () => {
            const tpl = await fetchSmartPortalTemplate(getAuthHeaders() as Record<string, string>);
            onChange(tpl.layout.blocks.map(hydrateBlock));
            setSelectedId(tpl.layout.blocks[0]?.id ?? null);
          }}
        >
          载入默认 6 实践模板
        </Button>
      </div>

      {/* 右：组件配置 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected ? (
          <Empty description="从左侧选择组件进行配置" style={{ marginTop: 64 }} />
        ) : (
          <div
            style={{
              border: "1px solid #eef1f6",
              borderRadius: 10,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Space>
                <span style={{ color: "#1766d8", fontSize: 16 }}>{BLOCK_REGISTRY[selected.type]?.icon}</span>
                <Text strong style={{ fontSize: 15 }}>{BLOCK_REGISTRY[selected.type]?.label}</Text>
              </Space>
              <Space size={4}>
                <Tooltip title="上移">
                  <Button size="small" type="text" icon={<ArrowUpOutlined />} onClick={() => move(selected.id, -1)} />
                </Tooltip>
                <Tooltip title="下移">
                  <Button size="small" type="text" icon={<ArrowDownOutlined />} onClick={() => move(selected.id, 1)} />
                </Tooltip>
                <Tooltip title="预览门户">
                  <Button size="small" type="text" icon={<EyeOutlined />} onClick={onPreview} />
                </Tooltip>
                <Popconfirm title="删除该组件？" onConfirm={() => removeBlock(selected.id)}>
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 14 }}>标题</Text>
              <Input
                style={{ marginTop: 6 }}
                value={selected.title}
                onChange={(e) => updateBlock(selected.id, { title: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 14 }}>宽度</Text>
              <Select
                style={{ width: "100%", marginTop: 6 }}
                value={selected.span}
                options={WIDTH_OPTIONS}
                onChange={(v) => updateBlock(selected.id, { span: v })}
              />
            </div>

            <ConfigForm
              fields={BLOCK_REGISTRY[selected.type]?.configFields || []}
              config={selected.config}
              onChange={(patch) =>
                updateBlock(selected.id, { config: { ...selected.config, ...patch } })
              }
            />
          </div>
        )}
      </div>
    </div>
  );
};

/* ----------------------------- 页面 ----------------------------- */

export default function TeacherSmartPortal() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = useMemo(() => getAuthHeaders(user) as Record<string, string>, [user]);
  const teacherId = user?.id as string | undefined;

  const [portals, setPortals] = useState<SmartPortalConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SmartPortalConfig | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  const [name, setName] = useState("智慧门户");
  const [enabled, setEnabled] = useState(true);
  const [blocks, setBlocks] = useState<PortalBlock[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const previewData = useSmartPortalData();
  const previewLayout = useMemo(() => ({ version: 1, blocks }), [blocks]);

  const { data: students = [] } = useQuery({
    queryKey: ["smart-portal-students", tenant],
    enabled: !!tenant,
    queryFn: async () => {
      const r = await listUsers({
        tenant,
        fields: ["id", "name", "email", "classId"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        headers,
      });
      if (!(r as any)?.success) return [];
      const data = (r as any).data;
      return (Array.isArray(data) ? data : []) as StudentOption[];
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["smart-portal-classes", tenant],
    enabled: !!tenant,
    queryFn: async () => {
      const r = await listClasses({ tenant, fields: ["id", "name"], sort: "+name", headers });
      if (!(r as any)?.success) return [];
      const data = (r as any).data;
      return (Array.isArray(data) ? data : data?.results || []) as ClassOption[];
    },
  });

  // 每个学生只能分配到一个门户：过滤掉已分配到其他门户的学生
  const candidateStudents = useMemo(() => {
    const assignedElsewhere = new Set<string>();
    portals.forEach((p) => {
      if (p.id === editing?.id) return;
      (p.studentIds || []).forEach((id) => assignedElsewhere.add(id));
    });
    return students.filter((s) => !assignedElsewhere.has(s.id));
  }, [students, portals, editing]);

  const load = async () => {
    if (!teacherId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setPortals(await fetchTeacherPortals(teacherId, headers));
    } catch (e) {
      message.error((e as Error)?.message || "加载智慧门户列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  const openCreate = () => {
    setEditing(null);
    setName("智慧门户");
    setEnabled(true);
    setBlocks([]);
    setStudentIds([]);
    setActiveTab("components");
    setModalOpen(true);
  };

  const openEdit = (p: SmartPortalConfig) => {
    setEditing(p);
    setName(p.name);
    setEnabled(p.enabled);
    setBlocks(p.layout.blocks.map(hydrateBlock));
    setStudentIds(p.studentIds || []);
    setActiveTab("basic");
    setModalOpen(true);
  };

  const openDuplicate = (p: SmartPortalConfig) => {
    setEditing(null);
    setName(`${p.name}（副本）`);
    setEnabled(p.enabled);
    setBlocks(p.layout.blocks.map(hydrateBlock));
    setStudentIds([]);
    setActiveTab("basic");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!teacherId) {
      message.error("未获取到教师信息");
      return;
    }
    if (!name.trim()) {
      message.warning("请填写门户名称");
      setActiveTab("basic");
      return;
    }
    setSaving(true);
    try {
      const payload = { teacherId, name: name.trim(), enabled, layout: previewLayout, studentIds };
      const res = editing?.id
        ? await updateTeacherPortal(editing.id, payload, headers)
        : await createTeacherPortal(payload, headers);
      if (res.ok) {
        message.success(editing ? "门户已更新" : "门户已创建");
        setModalOpen(false);
        await load();
      } else {
        message.error(res.error || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: SmartPortalConfig) => {
    if (!p.id) return;
    const res = await deleteTeacherPortal(p.id, headers);
    if (res.ok) {
      message.success("门户已删除");
      await load();
    } else {
      message.error(res.error || "删除失败");
    }
  };

  const columns = [
    {
      title: "门户名称",
      dataIndex: "name",
      key: "name",
      render: (_: unknown, p: SmartPortalConfig) => (
        <Space>
          <span style={{ fontWeight: 500 }}>{p.name}</span>
          {!p.enabled && <Tag color="default">已停用</Tag>}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 90,
      render: (v: boolean) => (v ? <Tag color="green">启用</Tag> : <Tag color="red">停用</Tag>),
    },
    {
      title: "组件",
      key: "blocks",
      width: 140,
      render: (_: unknown, p: SmartPortalConfig) => {
        const total = p.layout.blocks.length;
        const practice = p.layout.blocks.filter((b) => b.type === "ai-practice").length;
        return (
          <Text type="secondary">
            {total} 个{total > 0 ? `（AI 实践 ${practice}）` : ""}
          </Text>
        );
      },
    },
    {
      title: "分配学生",
      key: "students",
      width: 110,
      render: (_: unknown, p: SmartPortalConfig) => (
        <Space size={4}>
          <TeamOutlined style={{ color: "#8c8c8c" }} />
          <span>{(p.studentIds || []).length} 人</span>
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 180,
      render: (v?: string) => <Text type="secondary">{formatTime(v)}</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: unknown, p: SmartPortalConfig) => (
        <Space size={4}>
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openEdit(p)}>
            编辑
          </Button>
          <Button size="small" type="link" icon={<CopyOutlined />} onClick={() => openDuplicate(p)}>
            复制
          </Button>
          <Popconfirm title="确认删除该门户？" onConfirm={() => handleDelete(p)}>
            <Button size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppPage
      title="智慧门户"
      description="为学生配置 AI 实践门户：按学生分配门户，学生端即可看到对应功能"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;智慧门户</>}
      actions={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建门户
        </Button>
      }
    >
      <Table
        rowKey="id"
        loading={loading}
        dataSource={portals}
        columns={columns}
        pagination={false}
        locale={{
          emptyText: (
            <Empty description="还没有智慧门户，点击右上角「新建门户」开始配置" style={{ padding: 24 }} />
          ),
        }}
      />

      <Modal
        className="smart-portal-form-modal"
        open={modalOpen}
        title={editing ? "编辑智慧门户" : "新建智慧门户"}
        width={1040}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
        styles={{ body: { maxHeight: "68vh", overflowY: "auto", paddingTop: 8 } }}
      >
        <style>{`
          .smart-portal-form-modal .ant-modal-title { font-size: 18px; }
          .smart-portal-form-modal .ant-tabs-tab { font-size: 15px; }
          .smart-portal-form-modal .ant-input,
          .smart-portal-form-modal .ant-input-affix-wrapper,
          .smart-portal-form-modal .ant-select-single .ant-select-selector {
            height: 40px; font-size: 15px;
          }
          .smart-portal-form-modal .ant-select-single .ant-select-selection-item,
          .smart-portal-form-modal .ant-select-single .ant-select-selection-placeholder {
            font-size: 15px; line-height: 38px;
          }
          .smart-portal-form-modal .ant-select-multiple .ant-select-selector {
            min-height: 40px; font-size: 15px;
          }
          .smart-portal-form-modal .ant-space-compact .ant-btn,
          .smart-portal-form-modal .ant-space-compact .ant-select-single .ant-select-selector,
          .smart-portal-form-modal .ant-space-compact .ant-input { height: 40px; }
          .smart-portal-form-modal .ant-btn { font-size: 15px; height: 40px; }
          .smart-portal-form-modal .ant-btn-sm { height: 28px; font-size: 13px; }
          .smart-portal-form-modal .ant-tag { font-size: 13px; }
          .smart-portal-form-modal .ant-form-item-label > label { font-size: 15px; }
          .smart-portal-form-modal .ant-form-item-explain,
          .smart-portal-form-modal .ant-form-item-extra { font-size: 13px; }
          .smart-portal-form-modal .ant-table { font-size: 15px; }
          .smart-portal-form-modal .ant-table-thead > tr > th,
          .smart-portal-form-modal .ant-table-tbody > tr > td { font-size: 15px; padding: 13px 16px; }
          .smart-portal-form-modal .ant-empty-description { font-size: 14px; }
        `}</style>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "basic",
              label: "基本信息",
              children: (
                <div style={{ maxWidth: 520 }}>
                  <div style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 15 }}>门户名称</Text>
                    <Input
                      style={{ marginTop: 6 }}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如：餐厅实践门户"
                    />
                  </div>
                  <Space>
                    <Text style={{ fontSize: 15 }}>启用</Text>
                    <Switch checked={enabled} onChange={setEnabled} />
                  </Space>
                  <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 12 }}>
                    启用后，被分配到的学生才能在学生端看到该门户。
                  </Paragraph>
                </div>
              ),
            },
            {
              key: "components",
              label: `门户组件（${blocks.length}）`,
              children: (
                <ComponentsEditor
                  blocks={blocks}
                  onChange={setBlocks}
                  onPreview={() => setPreviewOpen(true)}
                />
              ),
            },
            {
              key: "students",
              label: `分配学生（${studentIds.length}）`,
              children: (
                <div>
                  <Text style={{ fontSize: 15 }}>选择可查看该门户的学生</Text>
                  <div style={{ marginTop: 8 }}>
                    <StudentTableSelect
                      students={candidateStudents}
                      classes={classes}
                      value={studentIds}
                      onChange={setStudentIds}
                      loading={loading}
                      emptyText="暂无可分配的学生（可能已分配到其他门户）"
                    />
                  </div>
                  <Paragraph type="secondary" style={{ fontSize: 13, marginTop: 12 }}>
                    每个学生只能分配到一个门户，已分配到其他门户的学生不再显示；未分配学生的门户仅用于配置/预览。
                  </Paragraph>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      <Modal
        open={previewOpen}
        title="门户预览"
        width={1000}
        footer={null}
        onCancel={() => setPreviewOpen(false)}
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <SmartPortalRenderer
          layout={previewLayout}
          data={
            previewData.data ?? {
              courses: [],
              knowledgePoints: [],
              stats: { courses: 0, students: 0, videos: 0, exercises: 0 },
              loading: false,
              errorSources: [],
            }
          }
          loading={previewData.isFetching}
          onNavigate={navigate}
        />
      </Modal>
    </AppPage>
  );
}
