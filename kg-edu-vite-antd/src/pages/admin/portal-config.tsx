import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
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

const { Title, Text } = Typography;
const { TextArea } = Input;

/** 学历层级固定键（与课程 education_level 保持一致） */
const LEVEL_META: { levelKey: string; defaultTitle: string }[] = [
  { levelKey: "graduate", defaultTitle: "研究生" },
  { levelKey: "undergraduate", defaultTitle: "本科" },
  { levelKey: "higher_vocational", defaultTitle: "高职" },
  { levelKey: "secondary_vocational", defaultTitle: "中职" },
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 门户配置 — 学历层级名称 + 模板页（首页导航动态内容） */
export default function PortalConfigPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingLevels, setSavingLevels] = useState(false);
  const [savingPages, setSavingPages] = useState(false);

  const isSuperAdmin = user?.role === "super_admin";
  const headers = getAuthHeaders(user);

  // 层级（固定 4 行）
  const [levels, setLevels] = useState<PortalLevel[]>([]);
  // 模板页（可增删排序）
  const [pages, setPages] = useState<TemplatePage[]>([]);

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

  const updatePage = (index: number, patch: Partial<TemplatePage>) => {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addPage = () => {
    setPages((prev) => [
      ...prev,
      {
        id: "",
        name: "新模板页",
        slug: "",
        overview: "",
        content: "",
        sortOrder: prev.length,
        enabled: true,
      },
    ]);
  };

  const removePage = (index: number) => {
    setPages((prev) => prev.filter((_, i) => i !== index));
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

  const handleSavePages = async () => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改");
      return;
    }
    if (pages.some((p) => !p.name.trim())) {
      message.error("模板页名称不能为空");
      return;
    }
    const slugSet = new Set<string>();
    for (const p of pages) {
      const slug = slugify(p.slug) || p.slug;
      if (slugSet.has(slug)) {
        message.error(`访问标识「${slug}」重复，请修改后再保存`);
        return;
      }
      slugSet.add(slug);
    }
    setSavingPages(true);
    const result = await savePortalPages(
      pages.map((p, i) => ({ ...p, name: p.name.trim(), sortOrder: i })),
      headers
    );
    setSavingPages(false);
    if (result.ok) {
      message.success("模板页已保存");
      await load();
    } else {
      message.error(result.error || "保存失败");
    }
  };

  const levelValues = useMemo(() => {
    const map = new Map(levels.map((l) => [l.levelKey, l]));
    return LEVEL_META.map((meta) => map.get(meta.levelKey) || { levelKey: meta.levelKey, title: meta.defaultTitle, subtitle: "", sortOrder: 0, id: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载门户配置..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ============ 学历层级名称 ============ */}
      <Card>
        <div style={{ marginBottom: 20 }}>
          <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
            学历层级名称
          </Title>
          <Text type="secondary">
            首页四个学历层级（研究生 / 本科 / 高职 / 中职）的展示名称，可自由修改
          </Text>
        </div>

        <Form layout="vertical" disabled={!isSuperAdmin}>
          {levelValues.map((level) => (
            <div
              key={level.levelKey}
              style={{ maxWidth: 480, marginBottom: 16 }}
            >
              <Form.Item label="层级名称" style={{ margin: 0 }} required>
                <Input
                  value={level.title}
                  onChange={(e) => updateLevel(level.levelKey, "title", e.target.value)}
                  placeholder="层级名称"
                  maxLength={20}
                />
              </Form.Item>
            </div>
          ))}

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
      </Card>

      {/* ============ 模板页管理 ============ */}
      <Card>
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
              模板页管理
            </Title>
            <Text type="secondary">
              首页导航固定「课程 / 微专业」两项，其后按下方顺序展示模板页，总数上限 6 项（多出不显示）。
              每个模板页包含名称、概述与实际内容，访问链接为 /page/访问标识
            </Text>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">
                实际内容支持 Markdown：## 标题、- 列表、**加粗**、[链接](https://…)
              </Text>
            </div>
          </div>
          <Button icon={<PlusOutlined />} onClick={addPage} disabled={!isSuperAdmin}>
            新增模板页
          </Button>
        </div>

        <Form layout="vertical" disabled={!isSuperAdmin} style={{ width: "100%" }}>
          {pages.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
              暂无模板页，点击「新增模板页」创建
            </div>
          ) : (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {pages.map((page, index) => (
              <div
                key={page.id || `new-${index}`}
                style={{
                  border: "1px solid #e8eef7",
                  borderRadius: 10,
                  padding: "16px 16px 8px",
                  background: "#fafcff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <Tag color={page.enabled ? "green" : "default"} style={{ minWidth: 48, textAlign: "center", margin: 0 }}>
                    {index + 1}
                  </Tag>
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
                  <span style={{ fontSize: 13, color: "#666", minWidth: 120 }}>顺序：第 {index + 1} 位</span>
                  <div style={{ flex: 1 }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    /page/
                  </Text>
                  <Input
                    style={{ width: 200 }}
                    size="small"
                    value={page.slug}
                    onChange={(e) => updatePage(index, { slug: slugify(e.target.value) })}
                    placeholder="访问标识（英文，留空自动生成）"
                    disabled={!isSuperAdmin}
                  />
                  <Switch
                    checked={page.enabled}
                    onChange={(checked) => updatePage(index, { enabled: checked })}
                    checkedChildren="启用"
                    unCheckedChildren="隐藏"
                    disabled={!isSuperAdmin}
                  />
                  <Popconfirm
                    title="删除该模板页？"
                    description="删除后首页导航将不再显示该页面"
                    onConfirm={() => removePage(index)}
                    disabled={!isSuperAdmin}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!isSuperAdmin}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>

                <Form.Item label="名称" style={{ marginBottom: 12 }} required>
                  <Input
                    value={page.name}
                    onChange={(e) => updatePage(index, { name: e.target.value })}
                    placeholder="如：教学资源库"
                    maxLength={30}
                    disabled={!isSuperAdmin}
                  />
                </Form.Item>

                <Form.Item label="概述" style={{ marginBottom: 12 }} required>
                  <TextArea
                    value={page.overview}
                    onChange={(e) => updatePage(index, { overview: e.target.value })}
                    placeholder="页面概述，一两句话介绍页面内容"
                    autoSize={{ minRows: 2, maxRows: 3 }}
                    disabled={!isSuperAdmin}
                  />
                </Form.Item>

                <Form.Item label="实际内容" style={{ marginBottom: 8 }}>
                  <TextArea
                    value={page.content}
                    onChange={(e) => updatePage(index, { content: e.target.value })}
                    placeholder={"## 章节标题\n\n段落内容……"}
                    autoSize={{ minRows: 4 }}
                    disabled={!isSuperAdmin}
                  />
                </Form.Item>
              </div>
            ))}
            </Space>
          )}
        </Form>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
          {!isSuperAdmin && <Text type="warning">仅超级管理员可修改门户配置</Text>}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={savingPages}
            onClick={handleSavePages}
            disabled={!isSuperAdmin}
          >
            保存模板页
          </Button>
        </div>
      </Card>
    </div>
  );
}
