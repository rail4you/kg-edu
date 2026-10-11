/**
 * 智慧门户 — 组件化 / 参数化的门户页面布局。
 *
 * 教师端配置存于租户 schema（每位教师一条），可分配给学生；
 * 学生端读取分配给自己的配置。旧版全局布局接口保留兼容。
 */

import { getCurrentTenant } from "@/lib/tenant";

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
  | "plugin"
  | "ai-practice";

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
  "ai-practice",
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
  id?: string;
  teacherId?: string;
  name: string;
  enabled: boolean;
  layout: SmartPortalLayout;
  insertedAt?: string;
  updatedAt?: string;
  /** 已分配该门户的学生 id 列表（教师端配置） */
  studentIds?: string[];
  /** 学生端读取时标记该门户是否为教师主动分配 */
  assigned?: boolean;
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

function parseConfigData(data: any): SmartPortalConfig {
  const d = data || {};
  return {
    id: d.id,
    teacherId: d.teacher_id,
    name: d.name || "智慧门户",
    enabled: d.enabled !== false,
    layout: normalizeLayout(d.layout),
    insertedAt: d.inserted_at,
    updatedAt: d.updated_at,
    studentIds: Array.isArray(d.student_ids) ? d.student_ids.map(String) : [],
    assigned: d.assigned === true,
  };
}

function parseConfig(result: any): SmartPortalConfig {
  return parseConfigData(result?.data || {});
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

/* ------------------------------------------------------------------ *
 * 教师端 / 学生端智慧门户（租户内，每位教师可创建多个门户）
 * ------------------------------------------------------------------ */

function currentTenantSchema(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem("tenant") || getCurrentTenant()?.schemaName || "";
}

function withTenant(url: string): string {
  const t = currentTenantSchema();
  if (!t) return url;
  return `${url}${url.includes("?") ? "&" : "?"}orgSchema=${encodeURIComponent(t)}`;
}

/** 新建门户时的默认模板（含 6 个 AI 实践 + 展示模块） */
export async function fetchSmartPortalTemplate(
  headers: Record<string, string>
): Promise<SmartPortalConfig> {
  try {
    const resp = await fetch(withTenant("/api/smart-portal/config"), {
      headers: { ...headers, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const result = await resp.json().catch(() => null);
    if (!resp.ok || !result?.success || !result.data) return EMPTY_CONFIG;
    return parseConfig(result);
  } catch {
    return EMPTY_CONFIG;
  }
}

/** 教师端读取自己创建的门户列表 */
export async function fetchTeacherPortals(
  teacherId: string,
  headers: Record<string, string>
): Promise<SmartPortalConfig[]> {
  const resp = await fetch(
    withTenant(`/api/smart-portal/configs?teacherId=${encodeURIComponent(teacherId)}`),
    {
      headers: { ...headers, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    }
  );
  const result = await resp.json().catch(() => null);
  if (!resp.ok || !result?.success) {
    throw new Error(result?.error || `HTTP ${resp.status}`);
  }
  return Array.isArray(result.data) ? result.data.map(parseConfigData) : [];
}

export interface TeacherPortalPayload {
  teacherId?: string;
  name: string;
  enabled: boolean;
  layout: SmartPortalLayout;
  studentIds: string[];
}

/** 新建门户 */
export async function createTeacherPortal(
  payload: TeacherPortalPayload,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string; data?: SmartPortalConfig }> {
  return portalRequest("POST", "/api/smart-portal/configs", payload, headers);
}

/** 更新门户 */
export async function updateTeacherPortal(
  id: string,
  payload: TeacherPortalPayload,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string; data?: SmartPortalConfig }> {
  return portalRequest("PUT", `/api/smart-portal/configs/${encodeURIComponent(id)}`, payload, headers);
}

/** 删除门户 */
export async function deleteTeacherPortal(
  id: string,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch(withTenant(`/api/smart-portal/configs/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers,
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success) return { ok: true };
    return { ok: false, error: result?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

async function portalRequest(
  method: "POST" | "PUT",
  url: string,
  payload: TeacherPortalPayload,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string; data?: SmartPortalConfig }> {
  try {
    const resp = await fetch(withTenant(url), {
      method,
      headers,
      body: JSON.stringify({
        data: {
          teacherId: payload.teacherId,
          name: payload.name,
          enabled: payload.enabled,
          layout: normalizeLayout(payload.layout),
          studentIds: payload.studentIds,
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

/** 学生端读取被分配到的智慧门户（无分配时返回默认布局） */
export async function fetchStudentSmartPortal(
  studentId: string | undefined,
  headers: Record<string, string>
): Promise<SmartPortalConfig> {
  try {
    const qs = studentId ? `?studentId=${encodeURIComponent(studentId)}` : "";
    const resp = await fetch(withTenant(`/api/smart-portal/student${qs}`), {
      headers: { ...headers, Accept: "application/json" },
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
