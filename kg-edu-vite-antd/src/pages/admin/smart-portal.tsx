import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Input,
  Select,
  Switch,
  Space,
  Spin,
  Tooltip,
  Typography,
} from "antd";
import {
  CopyOutlined,
  DeleteOutlined,
  DragOutlined,
  EyeOutlined,
  SaveOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { listOrganizations } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import {
  fetchSmartPortalLayoutAdmin,
  saveSmartPortalLayout,
  type BlockType,
  type PortalBlock,
  type SmartPortalLayout,
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

const { Title, Text } = Typography;

interface OrgOption {
  id: string;
  name: string;
  schemaName?: string;
}

const WIDTH_OPTIONS = [
  { label: "1/2 宽（12）", value: 12 },
  { label: "1/3 宽（8）", value: 8 },
  { label: "2/3 宽（16）", value: 16 },
  { label: "1/4 宽（6）", value: 6 },
  { label: "3/4 宽（18）", value: 18 },
  { label: "整行（24）", value: 24 },
];

/* ------------------------- palette ------------------------- */

const PaletteItem: React.FC<{ type: BlockType; onAdd: (t: BlockType) => void }> = ({
  type,
  onAdd,
}) => {
  const def = BLOCK_REGISTRY[type];
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { source: "palette", type },
  });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.5 : 1 }
    : undefined;
  return (
    <div
      ref={setNodeRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 10px",
        border: "1px solid #eef1f6",
        borderRadius: 8,
        marginBottom: 8,
        cursor: "grab",
        background: "#fff",
        ...style,
      }}
      {...listeners}
      {...attributes}
      onClick={() => onAdd(type)}
    >
      <span style={{ fontSize: 16, color: "#1766d8" }}>{def.icon}</span>
      <span style={{ fontSize: 13 }}>{def.label}</span>
    </div>
  );
};

/* ----------------------- sortable row ---------------------- */

const BlockRow: React.FC<{
  block: PortalBlock;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}> = ({ block, selected, onSelect, onRemove, onDuplicate }) => {
  const def = BLOCK_REGISTRY[block.type];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id, data: { source: "canvas" } });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    border: selected ? "1px solid #1766d8" : "1px solid #eef1f6",
    borderRadius: 10,
    marginBottom: 10,
    background: selected ? "#f5f9ff" : "#fff",
  };
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect}>
      <span
        {...listeners}
        {...attributes}
        style={{ cursor: "grab", color: "#9aa8ba" }}
        onClick={(e) => e.stopPropagation()}
      >
        <DragOutlined />
      </span>
      <span style={{ fontSize: 16, color: "#1766d8" }}>{def?.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{block.title || def?.label}</div>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {def?.label} · 宽度 {block.span}/24
        </Text>
      </div>
      <Space onClick={(e) => e.stopPropagation()}>
        <Tooltip title="复制">
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={onDuplicate} />
        </Tooltip>
        <Tooltip title="删除">
          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={onRemove} />
        </Tooltip>
      </Space>
    </div>
  );
};

/* --------------------------- page -------------------------- */

export default function AdminSmartPortal() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const headers = useMemo(() => getAuthHeaders(user) as Record<string, string>, [user]);
  const isSuperAdmin = user?.role === "super_admin";

  const [name, setName] = useState("智慧门户");
  const [enabled, setEnabled] = useState(true);
  const [blocks, setBlocks] = useState<PortalBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewTenant, setPreviewTenant] = useState<string>("");
  const [orgs, setOrgs] = useState<OrgOption[]>([]);

  const previewData = useSmartPortalData(preview ? previewTenant || undefined : undefined);
  const layout: SmartPortalLayout = { version: 1, blocks };
  const selectedBlock = blocks.find((b) => b.id === selectedId) || null;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const load = async () => {
    setLoading(true);
    try {
      const cfg = await fetchSmartPortalLayoutAdmin(headers);
      setName(cfg.name);
      setEnabled(cfg.enabled);
      setBlocks(cfg.layout.blocks.map(hydrateBlock));
    } catch (e: any) {
      message.error(e?.message || "加载智慧门户布局失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    listOrganizations({ tenant: "public", fields: ["id", "name", "schemaName"], headers })
      .then((r) => {
        const opts = (extractArrayData(r) as OrgOption[]).filter((o) => o?.schemaName);
        setOrgs(opts);
      })
      .catch(() => setOrgs([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const updateBlock = (id: string, patch: Partial<PortalBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const source = active.data.current?.source;

    if (source === "palette") {
      const type = active.data.current?.type as BlockType;
      if (!type) return;
      const newBlock = createBlock(type);
      setBlocks((prev) => {
        const overIdx = prev.findIndex((b) => b.id === over.id);
        const idx = overIdx >= 0 ? overIdx : prev.length;
        const next = [...prev];
        next.splice(idx, 0, newBlock);
        return next;
      });
      setSelectedId(newBlock.id);
      return;
    }

    if (active.id !== over.id) {
      setBlocks((prev) => {
        const oldIndex = prev.findIndex((b) => b.id === active.id);
        const newIndex = prev.findIndex((b) => b.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleAdd = (type: BlockType) => {
    const b = createBlock(type);
    setBlocks((prev) => [...prev, b]);
    setSelectedId(b.id);
  };

  const handleDuplicate = (block: PortalBlock) => {
    const copy = createBlock(block.type);
    copy.title = block.title;
    copy.span = block.span;
    copy.config = { ...block.config };
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === block.id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    setSelectedId(copy.id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveSmartPortalLayout({ name, enabled, layout }, headers);
      if (res.ok) {
        message.success("智慧门户布局已保存");
      } else {
        message.error(res.error || "保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  const { setNodeRef: setCanvasRef, isOver } = useDroppable({ id: "canvas" });

  if (!isSuperAdmin) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description="仅超级管理员可配置智慧门户" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <Title level={4} style={{ margin: 0 }}>
            智慧门户
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            拖放左侧组件到画布，配置参数后保存；学生端将在「智能门户」展示该页面。
          </Text>
        </div>
        <Space wrap>
          <span style={{ fontSize: 13 }}>
            启用 <Switch checked={enabled} onChange={setEnabled} />
          </span>
          <Button
            icon={<EyeOutlined />}
            type={preview ? "primary" : "default"}
            onClick={() => setPreview((v) => !v)}
          >
            {preview ? "退出预览" : "预览"}
          </Button>
          <Button icon={<UndoOutlined />} onClick={load}>
            重置
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>
      </div>

      {preview && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space>
            <Text style={{ fontSize: 13 }}>预览租户：</Text>
            <Select
              style={{ width: 260 }}
              placeholder="选择租户以加载动态数据"
              value={previewTenant || undefined}
              onChange={setPreviewTenant}
              options={orgs.map((o) => ({ label: o.name || o.schemaName!, value: o.schemaName! }))}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Space>
        </Card>
      )}

      <Spin spinning={loading}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* 组件面板 */}
            <Card size="small" title="组件" style={{ width: 220, flexShrink: 0 }}>
              {BLOCK_LIST.map((def) => (
                <PaletteItem key={def.type} type={def.type} onAdd={handleAdd} />
              ))}
            </Card>

            {/* 画布 / 预览 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {preview ? (
                <Card size="small">
                  <SmartPortalRenderer
                    layout={layout}
                    data={previewData.data ?? { courses: [], knowledgePoints: [], stats: { courses: 0, students: 0, videos: 0, exercises: 0 }, loading: false, errorSources: [] }}
                    loading={previewData.isFetching}
                    onNavigate={navigate}
                  />
                </Card>
              ) : (
                <div
                  ref={setCanvasRef}
                  style={{
                    minHeight: 320,
                    padding: 16,
                    borderRadius: 12,
                    border: isOver ? "2px dashed #1766d8" : "1px solid #eef1f6",
                    background: "#fafbfd",
                  }}
                >
                  {blocks.length === 0 ? (
                    <Empty
                      style={{ marginTop: 64 }}
                      description="从左侧拖入或点击组件开始搭建门户"
                    />
                  ) : (
                    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {blocks.map((block) => (
                        <BlockRow
                          key={block.id}
                          block={block}
                          selected={block.id === selectedId}
                          onSelect={() => setSelectedId(block.id)}
                          onRemove={() => {
                            setBlocks((prev) => prev.filter((b) => b.id !== block.id));
                            if (selectedId === block.id) setSelectedId(null);
                          }}
                          onDuplicate={() => handleDuplicate(block)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </div>
              )}
            </div>
          </div>
        </DndContext>
      </Spin>

      <Drawer
        title={selectedBlock ? `配置：${BLOCK_REGISTRY[selectedBlock.type]?.label}` : "配置组件"}
        width={380}
        open={!!selectedBlock}
        onClose={() => setSelectedId(null)}
      >
        {selectedBlock && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13 }}>标题</Text>
              <Input
                style={{ marginTop: 6 }}
                value={selectedBlock.title}
                onChange={(e) => updateBlock(selectedBlock.id, { title: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13 }}>宽度</Text>
              <Select
                style={{ width: "100%", marginTop: 6 }}
                value={selectedBlock.span}
                options={WIDTH_OPTIONS}
                onChange={(v) => updateBlock(selectedBlock.id, { span: v })}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 13 }}>布局名称</Text>
              <Input
                style={{ marginTop: 6 }}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <ConfigForm
              fields={BLOCK_REGISTRY[selectedBlock.type]?.configFields || []}
              config={selectedBlock.config}
              onChange={(patch) =>
                updateBlock(selectedBlock.id, {
                  config: { ...selectedBlock.config, ...patch },
                })
              }
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
