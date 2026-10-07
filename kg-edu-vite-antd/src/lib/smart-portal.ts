/**
 * 智慧门户 — 组件化 / 参数化的门户页面布局。
 *
 * 布局以全局单条 JSON 配置存储（`GET/PUT /api/smart-portal/layout`），
 * 由超级管理员在管理端编排；租户动态数据在渲染时按访问者租户拉取。
 */

export type BlockType =
  | "text"
  | "stats"
  | "chart"
  | "course-list"
  | "knowledge-points"
  | "carousel"
  | "image"
  | "video"
  | "icon-nav"
  | "table"
  | "search"
  | "date"
  | "ip"
  | "map"
  | "plugin";

export const BLOCK_TYPES: BlockType[] = [
  "text",
  "stats",
  "chart",
  "course-list",
  "knowledge-points",
  "carousel",
  "image",
  "video",
  "icon-nav",
  "table",
  "search",
  "date",
  "ip",
  "map",
  "plugin",
];

export interface PortalBlock {
  id: string;
  type: BlockType;
  title?: string;
  /** Ant Design 栅格宽度 1..24 */
  span: number;
  config: Record<string, unknown>;
}

export interface SmartPortalLayout {
  version: number;
  blocks: PortalBlock[];
}

export interface SmartPortalConfig {
  name: string;
  enabled: boolean;
  layout: SmartPortalLayout;
  updatedAt?: string;
}

export const DEFAULT_SPAN = 24;

let blockSeq = 0;
export function createBlockId(): string {
  blockSeq += 1;
  return `b_${Date.now().toString(36)}_${blockSeq.toString(36)}`;
}

function clampSpan(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (Number.isFinite(n) && n >= 1 && n <= 24) return Math.round(n);
  return DEFAULT_SPAN;
}

function normalizeBlock(raw: any): PortalBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type as BlockType;
  if (!BLOCK_TYPES.includes(type)) return null;
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : createBlockId(),
    type,
    title: typeof raw.title === "string" ? raw.title : "",
    span: clampSpan(raw.span),
    config: raw.config && typeof raw.config === "object" ? { ...raw.config } : {},
  };
}

export function normalizeLayout(raw: any): SmartPortalLayout {
  const blocksRaw = raw && typeof raw === "object" ? raw.blocks : null;
  const blocks = Array.isArray(blocksRaw)
    ? (blocksRaw.map(normalizeBlock).filter(Boolean) as PortalBlock[])
    : [];
  return {
    version: typeof raw?.version === "number" ? raw.version : 1,
    blocks,
  };
}

export const EMPTY_LAYOUT: SmartPortalLayout = { version: 1, blocks: [] };
export const EMPTY_CONFIG: SmartPortalConfig = {
  name: "智慧门户",
  enabled: true,
  layout: EMPTY_LAYOUT,
};

function parseConfig(result: any): SmartPortalConfig {
  const data = result?.data || {};
  return {
    name: data.name || "智慧门户",
    enabled: data.enabled !== false,
    layout: normalizeLayout(data.layout),
    updatedAt: data.updated_at,
  };
}

/** 公开读取智慧门户布局（学生端渲染） */
export async function fetchSmartPortalLayout(): Promise<SmartPortalConfig> {
  try {
    const resp = await fetch("/api/smart-portal/layout", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return EMPTY_CONFIG;
    const result = await resp.json();
    if (!result?.success || !result.data) return EMPTY_CONFIG;
    return parseConfig(result);
  } catch {
    return EMPTY_CONFIG;
  }
}

/** 管理端读取（当前与公开接口相同，保留独立函数便于后续鉴权区分） */
export async function fetchSmartPortalLayoutAdmin(
  headers: Record<string, string>
): Promise<SmartPortalConfig> {
  const resp = await fetch("/api/smart-portal/layout", {
    headers: { ...headers, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const result = await resp.json().catch(() => null);
  if (!resp.ok || !result?.success || !result.data) {
    throw new Error(result?.error || `HTTP ${resp.status}`);
  }
  return parseConfig(result);
}

/** 保存布局（仅超级管理员） */
export async function saveSmartPortalLayout(
  config: { name: string; enabled: boolean; layout: SmartPortalLayout },
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string; data?: SmartPortalConfig }> {
  try {
    const resp = await fetch("/api/smart-portal/layout", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          name: config.name,
          enabled: config.enabled,
          layout: normalizeLayout(config.layout),
        },
      }),
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success) {
      return { ok: true, data: parseConfig(result) };
    }
    return { ok: false, error: result?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}
