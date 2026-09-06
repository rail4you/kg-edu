/**
 * 门户配置 — 学历层级（研究生/本科/高职/中职）与模板页（导航动态页面）
 * 数据由超级管理员在后端维护，前端公开只读。
 */

export interface PortalLevel {
  id: string;
  levelKey: string;
  title: string;
  subtitle: string;
  sortOrder: number;
}

export interface TemplatePage {
  id: string;
  name: string;
  slug: string;
  overview: string;
  content: string;
  sortOrder: number;
  enabled: boolean;
}

export interface PortalConfig {
  levels: PortalLevel[];
  pages: TemplatePage[];
}

const EMPTY: PortalConfig = { levels: [], pages: [] };

/** 公开读取门户配置（无鉴权，只返回启用的模板页） */
export async function fetchPortalConfig(): Promise<PortalConfig> {
  try {
    const resp = await fetch("/api/portal-config", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return EMPTY;
    const result = await resp.json();
    if (!result.success || !result.data) return EMPTY;
    return {
      levels: (result.data.levels || []).map(parseLevel),
      pages: (result.data.pages || []).map(parsePage),
    };
  } catch {
    return EMPTY;
  }
}

/** 超级管理员读取门户配置（含禁用的模板页） */
export async function fetchPortalConfigAdmin(
  headers: Record<string, string>
): Promise<PortalConfig> {
  try {
    const resp = await fetch("/api/portal-config/admin", {
      headers,
      signal: AbortSignal.timeout(8000),
    });
    const result = await resp.json();
    if (!resp.ok || !result.success || !result.data) {
      throw new Error(result?.error || `HTTP ${resp.status}`);
    }
    return {
      levels: (result.data.levels || []).map(parseLevel),
      pages: (result.data.pages || []).map(parsePage),
    };
  } catch (e: any) {
    throw new Error(e?.message || "加载失败");
  }
}

/** 批量保存学历层级（仅超级管理员） */
export async function savePortalLevels(
  levels: PortalLevel[],
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("/api/portal-config/levels", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          levels: levels.map((l) => ({
            level_key: l.levelKey,
            title: l.title,
            subtitle: l.subtitle,
            sort_order: l.sortOrder,
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

/** 全量替换模板页（含排序/新增/删除，仅超级管理员） */
export async function savePortalPages(
  pages: TemplatePage[],
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("/api/portal-config/pages", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          pages: pages.map((p) => ({
            id: p.id || undefined,
            name: p.name,
            slug: p.slug,
            overview: p.overview,
            content: p.content,
            sort_order: p.sortOrder,
            enabled: p.enabled,
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

function parseLevel(raw: any): PortalLevel {
  return {
    id: raw.id || "",
    levelKey: raw.level_key || "",
    title: raw.title || "",
    subtitle: raw.subtitle || "",
    sortOrder: raw.sort_order ?? 0,
  };
}

function parsePage(raw: any): TemplatePage {
  return {
    id: raw.id || "",
    name: raw.name || "",
    slug: raw.slug || "",
    overview: raw.overview || "",
    content: raw.content || "",
    sortOrder: raw.sort_order ?? 0,
    enabled: raw.enabled !== false,
  };
}
