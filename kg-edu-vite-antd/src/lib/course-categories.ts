/**
 * 课程类别 — 首页推荐/新开等模块与课程列表页 Tab
 * 数据由超级管理员在后端维护，前端公开只读。
 */

export interface CategoryCourseItem {
  id: string;
  tenantSchema: string;
  courseId: string;
  sortOrder: number;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  enabled: boolean;
  items: CategoryCourseItem[];
}

/** 公开读取课程类别（无鉴权，只返回启用的类别） */
export async function fetchCourseCategories(): Promise<CourseCategory[]> {
  try {
    const resp = await fetch("/api/course-categories", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return [];
    const result = await resp.json();
    if (!result.success || !result.data) return [];
    return (result.data.categories || []).map(parseCategory);
  } catch {
    return [];
  }
}

/** 超级管理员读取课程类别（含禁用） */
export async function fetchCourseCategoriesAdmin(
  headers: Record<string, string>
): Promise<CourseCategory[]> {
  try {
    const resp = await fetch("/api/course-categories/admin", {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success || !result.data) {
      throw new Error(result?.error || `HTTP ${resp.status}`);
    }
    return (result.data.categories || []).map(parseCategory);
  } catch (e: any) {
    throw new Error(e?.message || "加载失败");
  }
}

/** 全量替换课程类别（含课程项，仅超级管理员） */
export async function saveCourseCategories(
  categories: CourseCategory[],
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("/api/course-categories", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          categories: categories.map((c) => ({
            id: c.id || undefined,
            name: c.name,
            slug: c.slug,
            sort_order: c.sortOrder,
            enabled: c.enabled,
            items: c.items.map((item, index) => ({
              id: item.id || undefined,
              tenant_schema: item.tenantSchema,
              course_id: item.courseId,
              sort_order: index,
            })),
          })),
        },
      }),
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success) return { ok: true };
    return { ok: false, error: result?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

function parseCategory(raw: any): CourseCategory {
  return {
    id: raw.id || "",
    name: raw.name || "",
    slug: raw.slug || "",
    sortOrder: raw.sort_order ?? 0,
    enabled: raw.enabled !== false,
    items: (raw.items || []).map((item: any) => ({
      id: item.id || "",
      tenantSchema: item.tenant_schema || "",
      courseId: item.course_id || "",
      sortOrder: item.sort_order ?? 0,
    })),
  };
}
