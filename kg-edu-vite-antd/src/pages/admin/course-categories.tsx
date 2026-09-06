import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Popconfirm,
  Select,
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
  fetchCourseCategoriesAdmin,
  saveCourseCategories,
  type CourseCategory,
  type CategoryCourseItem,
} from "@/lib/course-categories";
import { getAllCourses, listOrganizations } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text } = Typography;

interface OrgOption {
  id: string;
  name: string;
  schemaName: string;
}

interface CourseOption {
  id: string;
  title: string;
  publishStatus?: boolean | null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** 课程类别 — 首页推荐/新开等模块 + 课程列表页 Tab（超级管理员维护） */
export default function CourseCategoriesPage() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const headers = getAuthHeaders(user);
  const isSuperAdmin = user?.role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [organizations, setOrganizations] = useState<OrgOption[]>([]);
  // tenantSchema -> 该租户课程列表（用于选课下拉与名称展示）
  const [tenantCourses, setTenantCourses] = useState<Record<string, CourseOption[]>>({});
  // 每行选课器的当前选择：categoryIndex -> { tenant, courseId }
  const [picker, setPicker] = useState<Record<number, { tenant: string; courseId?: string }>>({});
  // 正在加载课程的租户
  const [loadingTenants, setLoadingTenants] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const [cats, orgs] = await Promise.all([
        fetchCourseCategoriesAdmin(headers),
        listOrganizations({
          tenant: "public",
          fields: ["id", "name", "schemaName"],
          headers,
        }),
      ]);
      setCategories([...cats].sort((a, b) => a.sortOrder - b.sortOrder));
      const orgOptions = (extractArrayData(orgs) as OrgOption[]).filter(
        (o) => o?.schemaName
      );
      setOrganizations(orgOptions);
      return cats;
    } catch (e: any) {
      message.error(e?.message || "加载失败");
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().then((cats) => {
      // 预加载已选课程所在租户的课程列表（用于展示课程名称）
      const tenants = Array.from(
        new Set(cats.flatMap((c) => c.items.map((i) => i.tenantSchema)).filter(Boolean))
      );
      tenants.forEach((t) => loadTenantCourses(t));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTenantCourses = async (tenant: string) => {
    if (tenantCourses[tenant] || loadingTenants.has(tenant)) return;
    setLoadingTenants((prev) => new Set(prev).add(tenant));
    try {
      const result = await getAllCourses({
        tenant,
        fields: ["id", "title", "publishStatus"],
        headers,
      });
      // 保留所有课程，未发布的在下拉中禁用并标注「未发布」，不可选择
      const list = (extractArrayData(result) as Array<CourseOption & { publishStatus?: boolean | null }>)
        .filter((c) => c?.id && c?.title)
        .map(({ id, title, publishStatus }) => ({ id, title, publishStatus }))
        .sort((a, b) => {
          // 已发布排前面，未发布排后面；同组按标题排序
          const aPub = a.publishStatus !== false ? 0 : 1;
          const bPub = b.publishStatus !== false ? 0 : 1;
          if (aPub !== bPub) return aPub - bPub;
          return a.title.localeCompare(b.title, "zh-CN");
        });
      setTenantCourses((prev) => ({ ...prev, [tenant]: list }));
    } catch {
      setTenantCourses((prev) => ({ ...prev, [tenant]: [] }));
    } finally {
      setLoadingTenants((prev) => {
        const next = new Set(prev);
        next.delete(tenant);
        return next;
      });
    }
  };

  const updateCategory = (index: number, patch: Partial<CourseCategory>) => {
    setCategories((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const moveCategory = (index: number, direction: -1 | 1) => {
    setCategories((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addCategory = () => {
    setCategories((prev) => [
      ...prev,
      {
        id: "",
        name: "新类别",
        slug: "",
        sortOrder: prev.length,
        enabled: true,
        items: [],
      },
    ]);
  };

  const removeCategory = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
    setPicker((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  };

  const addItem = (index: number) => {
    const p = picker[index];
    if (!p?.tenant || !p.courseId) {
      message.warning("请先选择租户和课程");
      return;
    }
    const selectedCourse = tenantCourses[p.tenant]?.find((c) => c.id === p.courseId);
    if (selectedCourse?.publishStatus === false) {
      message.warning("该课程未发布，无法添加到类别");
      return;
    }
    if (categories[index]?.items.some((i) => i.tenantSchema === p.tenant && i.courseId === p.courseId)) {
      message.warning("该课程已在类别中");
      return;
    }
    updateCategory(index, {
      items: [
        ...(categories[index]?.items || []),
        { id: "", tenantSchema: p.tenant, courseId: p.courseId, sortOrder: categories[index].items.length },
      ],
    });
    setPicker((prev) => ({ ...prev, [index]: { tenant: p.tenant } }));
  };

  const removeItem = (categoryIndex: number, itemIndex: number) => {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === categoryIndex
          ? { ...c, items: c.items.filter((_, j) => j !== itemIndex) }
          : c
      )
    );
  };

  const handleSave = async () => {
    if (!isSuperAdmin) {
      message.error("仅超级管理员可修改");
      return;
    }
    if (categories.some((c) => !c.name.trim())) {
      message.error("类别名称不能为空");
      return;
    }
    setSaving(true);
    const result = await saveCourseCategories(
      categories.map((c, i) => ({ ...c, name: c.name.trim(), sortOrder: i })),
      headers
    );
    setSaving(false);
    if (result.ok) {
      message.success("课程类别已保存");
      await load();
    } else {
      message.error(result.error || "保存失败");
    }
  };

  const orgName = useMemo(() => {
    const map: Record<string, string> = {};
    organizations.forEach((o) => {
      map[o.schemaName] = o.name;
    });
    return map;
  }, [organizations]);

  const getCourseOption = (tenant: string, courseId: string) =>
    tenantCourses[tenant]?.find((c) => c.id === courseId);

  const courseTitle = (tenant: string, courseId: string) => {
    const found = getCourseOption(tenant, courseId);
    if (found) return found.title;
    // 未加载完成前避免闪烁
    if (tenantCourses[tenant] === undefined) return "加载中…";
    // 已加载但找不到：可能是已删除或旧数据，沿用原兜底展示
    return "（未发布）";
  };

  const isCourseUnpublished = (tenant: string, courseId: string) => {
    const found = getCourseOption(tenant, courseId);
    if (found) return found.publishStatus === false;
    // 已加载但找不到：视为不可选的异常课程，同样标未发布以作提示
    if (tenantCourses[tenant] !== undefined) return true;
    return false;
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 80 }}>
        <Spin size="large" tip="加载课程类别..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0, marginBottom: 4 }}>
              门户课程类别
            </Title>
            <Text type="secondary">
              首页「推荐课程 / 新开课程」等模块与课程列表页 Tab（「全部课程」之外）均由这里的类别动态生成。
              每个类别可按租户挑选课程，未选课程时对应模块/ Tab 不展示课程
            </Text>
          </div>
          <Button icon={<PlusOutlined />} onClick={addCategory} disabled={!isSuperAdmin}>
            新增类别
          </Button>
        </div>

        {categories.length === 0 ? (
          <Empty description="暂无课程类别，点击「新增类别」创建" style={{ padding: 40 }} />
        ) : (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {categories.map((category, index) => (
              <div
                key={category.id || `new-${index}`}
                style={{
                  border: "1px solid #e8eef7",
                  borderRadius: 10,
                  padding: "16px 16px 8px",
                  background: "#fafcff",
                }}
              >
                {/* 类别头部 */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <Tag color={category.enabled ? "green" : "default"} style={{ minWidth: 40, textAlign: "center", margin: 0 }}>
                    {index + 1}
                  </Tag>
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => moveCategory(index, -1)}
                    disabled={index === 0 || !isSuperAdmin}
                    aria-label="上移"
                  />
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => moveCategory(index, 1)}
                    disabled={index === categories.length - 1 || !isSuperAdmin}
                    aria-label="下移"
                  />
                  <Input
                    style={{ width: 180 }}
                    value={category.name}
                    onChange={(e) => updateCategory(index, { name: e.target.value })}
                    placeholder="类别名称"
                    maxLength={20}
                    disabled={!isSuperAdmin}
                  />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    /courses?tab=
                  </Text>
                  <Input
                    style={{ width: 160 }}
                    size="small"
                    value={category.slug}
                    onChange={(e) => updateCategory(index, { slug: slugify(e.target.value) })}
                    placeholder="标识（英文）"
                    disabled={!isSuperAdmin}
                  />
                  <Switch
                    checked={category.enabled}
                    onChange={(checked) => updateCategory(index, { enabled: checked })}
                    checkedChildren="启用"
                    unCheckedChildren="隐藏"
                    disabled={!isSuperAdmin}
                  />
                  <Popconfirm
                    title="删除该类别？"
                    description="删除后首页模块与课程列表 Tab 将不再显示"
                    onConfirm={() => removeCategory(index)}
                    disabled={!isSuperAdmin}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} disabled={!isSuperAdmin}>
                      删除
                    </Button>
                  </Popconfirm>
                </div>

                {/* 已选课程 */}
                <div style={{ marginBottom: 10 }}>
                  <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
                    已选课程（{category.items.length}）
                  </Text>
                  {category.items.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      未选课程
                    </Text>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {category.items.map((item, itemIndex) => {
                        const unpublished = isCourseUnpublished(item.tenantSchema, item.courseId);
                        return (
                          <Tag
                            key={itemIndex}
                            closable={isSuperAdmin}
                            onClose={() => removeItem(index, itemIndex)}
                            style={{ padding: "2px 8px", borderRadius: 6 }}
                            color={unpublished ? "warning" : undefined}
                          >
                            {orgName[item.tenantSchema] || item.tenantSchema} · {courseTitle(item.tenantSchema, item.courseId)}
                            {unpublished && (
                              <span style={{ marginLeft: 6, color: "#d46b08", fontSize: 12 }}>未发布</span>
                            )}
                          </Tag>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 选课器 */}
                {isSuperAdmin && (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                    <Select
                      style={{ width: 260 }}
                      placeholder="选择租户"
                      value={picker[index]?.tenant}
                      onChange={(tenant) => {
                        setPicker((prev) => ({ ...prev, [index]: { tenant } }));
                        loadTenantCourses(tenant);
                      }}
                      options={organizations.map((o) => ({ label: o.name, value: o.schemaName }))}
                      showSearch
                      optionFilterProp="label"
                    />
                    <Select
                      style={{ width: 320 }}
                      placeholder={picker[index]?.tenant ? "选择课程" : "请先选择租户"}
                      value={picker[index]?.courseId}
                      onChange={(courseId) =>
                        setPicker((prev) => ({ ...prev, [index]: { ...prev[index], courseId } }))
                      }
                      options={(tenantCourses[picker[index]?.tenant || ""] || []).map((c) => ({
                        label: c.publishStatus === false ? `${c.title}（未发布）` : c.title,
                        value: c.id,
                        disabled: c.publishStatus === false,
                      }))}
                      showSearch
                      optionFilterProp="label"
                      notFoundContent={
                        loadingTenants.has(picker[index]?.tenant || "") ? <Spin size="small" /> : "该租户暂无课程"
                      }
                    />
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => addItem(index)}
                    >
                      添加
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </Space>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
          {!isSuperAdmin && <Text type="warning">仅超级管理员可修改课程类别</Text>}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            disabled={!isSuperAdmin}
          >
            保存类别
          </Button>
        </div>
      </Card>
    </div>
  );
}
