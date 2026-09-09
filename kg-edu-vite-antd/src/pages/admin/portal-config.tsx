import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableProps,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  fetchPortalConfigAdmin,
  savePortalLevels,
  savePortalPages,
  type PortalLevel,
  type TemplatePage,
} from "@/lib/portal-config";
import {
  QUICK_NAV_ICON_OPTIONS,
  getQuickNavIconSrc,
  normalizeQuickNavIcon,
} from "@/components/home/quick-nav-icons";

const { Title, Text } = Typography;
const { TextArea } = Input;

/** 学历层级固定键（与课程 education_level 保持一致），按学历由高到低排列，顺序固定 */
const LEVEL_META: { levelKey: string; defaultTitle: string; desc: string }[] = [
  { levelKey: "graduate", defaultTitle: "研究生", desc: "最高层级，面向学术型 / 专业学位研究生，显示在首页学科分类面板首位" },
  { levelKey: "undergraduate", defaultTitle: "本科", desc: "第 2 层级，面向本科 13 个学科门类" },
  { levelKey: "higher_vocational", defaultTitle: "高职", desc: "第 3 层级，面向高职热门专业大类" },
  { levelKey: "secondary_vocational", defaultTitle: "中职", desc: "第 4 层级，面向中职动手技能型课程" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 弹窗表单内的图标选择器（选中态跟随表单 icon 字段） */
function PageIconPicker({
  form,
  disabled,
}: {
  form: ReturnType<typeof Form.useForm>[0];
  disabled: boolean;
}) {
  const icon = Form.useWatch("icon", form);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
        gap: 8,
      }}
    >
      {QUICK_NAV_ICON_OPTIONS.map((option) => {
        const selected = icon === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => form.setFieldsValue({ icon: option.value })}
            disabled={disabled}
            title={option.label}
            style={{
              width: "100%",
              height: 84,
              borderRadius: 10,
              border: selected ? "2px solid #2f7cf6" : "1px solid #e8eef7",
              background: selected ? "#eef4ff" : "#fff",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              padding: 6,
            }}
          >
            <img
              src={option.src}
              alt={option.label}
              style={{ width: 32, height: 32, objectFit: "contain" }}
              draggable={false}
            />
            <span
              style={{
                fontSize: 11,
                lineHeight: 1.3,
                color: selected ? "#2f7cf6" : "#666",
                textAlign: "center",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "break-word",
                maxWidth: "100%",
              }}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** 弹窗表单内的标识符实时链接提示 */
function SlugLinkHint({ form }: { form: ReturnType<typeof Form.useForm>[0] }) {
  const slug = Form.useWatch("slug", form);
  const normalized = slugify(slug || "");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div>
        网页链接中的唯一标识，只能使用小写英文 / 拼音 / 数字 / 连字符，决定页面的访问地址。
      </div>
      <div>
        示例：教学资源库填 <Text code>resources</Text>，地址即为{" "}
        <Text code>/page/resources</Text>。
      </div>
      <div>页面发布后请勿随意修改，否则已分享出去的旧链接将失效。</div>
      {normalized ? (
        <div>
          当前访问链接：<Text code>/page/{normalized}</Text>
        </div>
      ) : (
        <div>保存后可通过 /page/标识符 访问该页面。</div>
      )}
    </div>
  );
}

type PageRow = TemplatePage & { key: string };

/** 门户配置 — 学历层级名称 + 模板页（首页导航动态内容） */
export default function PortalConfigPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingLevels, setSavingLevels] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";
  const headers = getAuthHeaders(user);

  // 层级（固定 4 行）
  const [levels, setLevels] = useState<PortalLevel[]>([]);
  // 模板页（表格展示，弹窗新建/编辑，底部统一保存）
  const [pages, setPages] = useState<TemplatePage[]>([]);

  // 新建/编辑弹窗：editingIndex 为 null 表示新建，modalData 为表单初始值
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [modalKey, setModalKey] = useState(0);
  const [modalData, setModalData] = useState({
    name: "",
    slug: "",
    overview: "",
    content: "",
    icon: "",
    enabled: true,
  });
  const [pageForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const config = await fetchPortalConfigAdmin(headers);
      const levelMap = new Map(config.levels.map((l) => [l.levelKey, l]));
      // 按固定顺序补全缺失层级
      setLevels(
        LEVEL_META.map((meta, index) => {
          const existing = levelMap.get(meta.levelKey);
          return (
            existing || {
              id: "",
              levelKey: meta.levelKey,
              title: meta.defaultTitle,
              subtitle: "",
              sortOrder: index,
            }
          );
        })
      );
      setPages([...config.pages].sort((a, b) => a.sortOrder - b.sortOrder));
    } catch (e: any) {
      message.error(e?.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateLevel = (levelKey: string, field: "title" | "subtitle", value: string) => {
    setLevels((prev) => prev.map((l) => (l.levelKey === levelKey ? { ...l, [field]: value } : l)));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const next = [...pages];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    void persistPages(next, { silent: true });
  };

  const removePage = (index: number) => {
    void persistPages(
      pages.filter((_, i) => i !== index),
      { successMessage: "模板页已删除" }
    );
  };

  const togglePageEnabled = (index: number, checked: boolean) => {
    void persistPages(
      pages.map((p, i) => (i === index ? { ...p, enabled: checked } : p)),
      { silent: true }
    );
  };

  const openCreateModal = () => {
    setEditingIndex(null);
    setModalData({ name: "", slug: "", overview: "", content: "", icon: "", enabled: true });
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const openEditModal = (index: number) => {
    setEditingIndex(index);
    const page = pages[index];
    // 快照当前行数据作为表单初始值（配合 key 强制重挂载，保证每次打开都填充）
    setModalData({
      name: page.name,
      slug: page.slug,
      overview: page.overview,
      content: page.content,
      icon: page.icon,
      enabled: page.enabled,
    });
    setModalKey((k) => k + 1);
    setModalOpen(true);
  };

  const handleModalOk = async () => {
    const values = await pageForm.validateFields();
    const patch = {
      name: (values.name || "").trim(),
      slug: slugify(values.slug || ""),
      overview: (values.overview || "").trim(),
      content: values.content || "",
      icon: normalizeQuickNavIcon(values.icon),
      enabled: values.enabled !== false,
    };
    const next =
      editingIndex === null
        ? [...pages, { id: "", sortOrder: pages.length, ...patch }]
        : pages.map((p, i) => (i === editingIndex ? { ...p, ...patch } : p));
    const ok = await persistPages(next);
    if (ok) setModalOpen(false);
  };

  const handleSaveLevels = async () => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改");
      return;
    }
    if (levels.some((l) => !l.title.trim())) {
      message.error("层级名称不能为空");
      return;
    }
    setSavingLevels(true);
    const result = await savePortalLevels(
      levels.map((l, i) => ({ ...l, title: l.title.trim(), sortOrder: i })),
      headers
    );
    setSavingLevels(false);
    if (result.ok) {
      message.success("学历层级名称已保存");
    } else {
      message.error(result.error || "保存失败");
    }
  };

  /** 直接持久化整表（新建/编辑/排序/启用/删除共用）：校验通过则保存并重载 */
  const persistPages = async (
    next: TemplatePage[],
    opts?: { silent?: boolean; successMessage?: string }
  ): Promise<boolean> => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改");
      return false;
    }
    if (next.some((p) => !p.name.trim())) {
      message.error("模板页名称不能为空");
      return false;
    }
    // 快捷导航上限：固定 2 项 + 启用模板页最多 6 项（与首页 MAX_NAV_ITEMS = 8 对应）
    const enabledCount = next.filter((p) => p.enabled).length;
    if (enabledCount > 6) {
      message.error(`启用的模板页为 ${enabledCount} 项，首页快捷导航最多展示 6 项，请先隐藏多余页面再保存`);
      return false;
    }
    // 图标必须从内置图标中选择（不允许留空走自动匹配）
    const missingIconIndex = next.findIndex((p) => !normalizeQuickNavIcon(p.icon));
    if (missingIconIndex >= 0) {
      message.error(
        `第 ${missingIconIndex + 1} 项「${next[missingIconIndex].name || "未命名"}」尚未选择快捷导航图标，请从内置图标中选择`
      );
      return false;
    }
    const slugSet = new Set<string>();
    for (let i = 0; i < next.length; i++) {
      const p = next[i];
      const slug = slugify(p.slug);
      if (!slug) {
        message.error(`第 ${i + 1} 项「${p.name || "未命名"}」尚未填写网页标识符，请输入英文或拼音`);
        return false;
      }
      if (slugSet.has(slug)) {
        message.error(`访问标识「${slug}」重复，请修改后再保存`);
        return false;
      }
      slugSet.add(slug);
    }
    const result = await savePortalPages(
      next.map((p, i) => ({
        ...p,
        name: p.name.trim(),
        icon: normalizeQuickNavIcon(p.icon),
        sortOrder: i,
      })),
      headers
    );
    if (result.ok) {
      if (!opts?.silent) message.success(opts?.successMessage || "模板页已保存");
      await load();
      return true;
    }
    message.error(result.error || "保存失败");
    await load();
    return false;
  };

  const levelValues = useMemo(() => {
    const map = new Map(levels.map((l) => [l.levelKey, l]));
    return LEVEL_META.map((meta) => map.get(meta.levelKey) || { levelKey: meta.levelKey, title: meta.defaultTitle, subtitle: "", sortOrder: 0, id: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  const enabledCount = pages.filter((p) => p.enabled).length;

  const pageColumns: TableProps<PageRow>["columns"] = [
    {
      title: "序号",
      width: 64,
      render: (_: unknown, _record: PageRow, index: number) => (
        <Tag color={pages[index]?.enabled ? "green" : "default"} style={{ minWidth: 40, textAlign: "center", margin: 0 }}>
          {index + 1}
        </Tag>
      ),
    },
    {
      title: "图标",
      width: 72,
      render: (_: unknown, record: PageRow) => {
        const option = QUICK_NAV_ICON_OPTIONS.find((o) => o.value === record.icon);
        return (
          <img
            src={option?.src || getQuickNavIconSrc(`/page/${record.slug}`, record.icon)}
            alt={option?.label || record.name}
            title={option?.label || record.name}
            style={{ width: 34, height: 34, objectFit: "contain", display: "block" }}
            draggable={false}
          />
        );
      },
    },
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
    },
    {
      title: "网页标识符",
      width: 220,
      render: (_: unknown, record: PageRow) => <Text code>/page/{record.slug}</Text>,
    },
    {
      title: "状态",
      width: 100,
      render: (_: unknown, _record: PageRow, index: number) => (
        <Switch
          checked={pages[index]?.enabled}
          onChange={(checked) => togglePageEnabled(index, checked)}
          checkedChildren="启用"
          unCheckedChildren="隐藏"
          disabled={!isSuperAdmin}
        />
      ),
    },
    {
      title: "操作",
      width: 260,
      render: (_: unknown, _record: PageRow, index: number) => (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button
            size="small"
            icon={<ArrowUpOutlined />}
            onClick={() => movePage(index, -1)}
            disabled={index === 0 || !isSuperAdmin}
            aria-label="上移"
          />
          <Button
            size="small"
            icon={<ArrowDownOutlined />}
            onClick={() => movePage(index, 1)}
            disabled={index === pages.length - 1 || !isSuperAdmin}
            aria-label="下移"
          />
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(index)}>
            编辑
          </Button>
          <Popconfirm
            title="删除该模板页？"
            description="删除后首页导航将不再显示该页面"
            onConfirm={() => removePage(index)}
            disabled={!isSuperAdmin}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!isSuperAdmin}
            >
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载门户配置..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
      <Tabs
        defaultActiveKey="levels"
        items={[
          {
            key: "levels",
            label: "学历层级名称",
            children: (
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 20 }}>
                  <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
                    学历层级名称
                  </Title>
                  <Text type="secondary">
                    首页四个学历层级由高到低固定排列（研究生 → 本科 → 高职 → 中职），各层级的展示名称可自由修改，顺序不可调整
                  </Text>
                </div>

                <Form layout="vertical" disabled={!isSuperAdmin}>
                  {LEVEL_META.map((meta, i) => {
                    const level = levelValues[i];
                    return (
                      <div
                        key={meta.levelKey}
                        style={{ maxWidth: 560, marginBottom: 16 }}
                      >
                        <Form.Item
                          label={`第 ${i + 1} 层级 · 默认「${meta.defaultTitle}」`}
                          style={{ margin: 0 }}
                          required
                          extra={meta.desc}
                        >
                          <Input
                            value={level.title}
                            onChange={(e) => updateLevel(meta.levelKey, "title", e.target.value)}
                            placeholder="层级展示名称"
                            maxLength={20}
                          />
                        </Form.Item>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                    {!isSuperAdmin && <Text type="warning">仅超级管理员可修改门户配置</Text>}
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={savingLevels}
                      onClick={handleSaveLevels}
                      disabled={!isSuperAdmin}
                    >
                      保存层级名称
                    </Button>
                  </div>
                </Form>
              </div>
            ),
          },
          {
            key: "pages",
            label: "模板页管理",
            children: (
              <div style={{ paddingTop: 8 }}>
                <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div>
                    <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
                      模板页管理
                    </Title>
                    <Text type="secondary">
                      首页导航固定「课程 / 微专业」两项，其后按下方顺序展示模板页，启用项最多展示 6 项。
                      每项可修改名称、更换图标，访问链接为 /page/网页标识符；所有操作保存后即时生效
                    </Text>
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        实际内容支持 Markdown：## 标题、- 列表、**加粗**、[链接](https://…)
                      </Text>
                    </div>
                  </div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} disabled={!isSuperAdmin}>
                    新增模板页
                  </Button>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <Tag color={enabledCount > 6 ? "red" : "blue"}>
                    已启用 {enabledCount} / 6 项
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                    共 {pages.length} 项 · 用 ↑ ↓ 调整顺序 · 点击「编辑」修改名称、标识符与图标
                  </Text>
                </div>

                <Table<PageRow>
                  rowKey="key"
                  columns={pageColumns}
                  dataSource={pages.map((p, i) => ({ ...p, key: p.id || `new-${i}` }))}
                  pagination={false}
                  locale={{ emptyText: "暂无模板页，点击「新增模板页」创建" }}
                />
                {!isSuperAdmin && (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <Text type="warning">仅超级管理员可修改门户配置</Text>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
      </Card>

      {/* ============ 新建 / 编辑模板页弹窗 ============ */}
      <Modal
        key={modalKey}
        title={editingIndex === null ? "新增模板页" : `编辑模板页：${pages[editingIndex]?.name || ""}`}
        open={modalOpen}
        onOk={handleModalOk}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        width={880}
        destroyOnClose
      >
        <Form form={pageForm} layout="vertical" disabled={!isSuperAdmin} initialValues={modalData}>
          <Form.Item
            label="名称"
            name="name"
            rules={[{ required: true, message: "请输入模板页名称" }]}
          >
            <Input placeholder="如：教学资源库" maxLength={30} />
          </Form.Item>

          <Form.Item
            label="网页标识符"
            name="slug"
            rules={[{ required: true, message: "请输入英文或拼音作为网页标识符" }]}
            extra={<SlugLinkHint form={pageForm} />}
          >
            <Input
              onChange={(e) => pageForm.setFieldsValue({ slug: slugify(e.target.value) })}
              placeholder="请输入英文或拼音作为网页标识符，如：resources"
              maxLength={40}
              prefix={<LinkOutlined style={{ color: "#2f7cf6" }} />}
              style={{ fontWeight: 600 }}
            />
          </Form.Item>

          <Form.Item
            label="快捷导航图标"
            name="icon"
            rules={[{ required: true, message: "请从内置图标中选择" }]}
            extra="必须从下方内置图标中选择，保存后首页快捷导航即时更换"
          >
            <PageIconPicker form={pageForm} disabled={!isSuperAdmin} />
          </Form.Item>

          <Form.Item label="概述" name="overview" required>
            <TextArea
              placeholder="页面概述，一两句话介绍页面内容"
              autoSize={{ minRows: 2, maxRows: 3 }}
            />
          </Form.Item>

          <Form.Item label="实际内容" name="content">
            <TextArea
              placeholder={"## 章节标题\n\n段落内容……"}
              autoSize={{ minRows: 4 }}
            />
          </Form.Item>

          <Form.Item label="状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="隐藏" disabled={!isSuperAdmin} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
