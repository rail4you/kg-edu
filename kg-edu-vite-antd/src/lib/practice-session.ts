/** 互动实践共享会话 — 教师创建、学生凭 token 加入的「互动故事」房间 */

export type PracticeRole = "teacher" | "student" | "ai";

export interface PracticeMessage {
  role: PracticeRole;
  content: string;
}

export interface PracticeSession {
  id: string;
  token: string;
  scenario: string;
  title?: string | null;
  course_id?: string | null;
  teacher_id?: string | null;
  student_id?: string | null;
  transcript: PracticeMessage[];
  score?: number | null;
  report?: string | null;
  status: "open" | "evaluated" | "closed";
  inserted_at?: string;
  updated_at?: string;
}

type Headers = Record<string, string>;

const jsonHeaders = (headers: Headers): Headers => ({
  "Content-Type": "application/json",
  ...headers,
});

function parseSession(raw: any): PracticeSession {
  return {
    id: raw?.id || "",
    token: raw?.token || "",
    scenario: raw?.scenario || "interactive_story",
    title: raw?.title ?? null,
    course_id: raw?.course_id ?? null,
    teacher_id: raw?.teacher_id ?? null,
    student_id: raw?.student_id ?? null,
    transcript: Array.isArray(raw?.transcript) ? raw.transcript : [],
    score: raw?.score ?? null,
    report: raw?.report ?? null,
    status: raw?.status || "open",
    inserted_at: raw?.inserted_at,
    updated_at: raw?.updated_at,
  };
}

/** 创建会话（教师） */
export async function createPracticeSession(
  input: { title?: string; courseId?: string; teacherId?: string; tenant: string },
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch("/api/practice-session", {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify(input),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

/** 按 token 读取会话 */
export async function fetchPracticeSession(
  token: string,
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(
      `/api/practice-session/${encodeURIComponent(token)}?tenant=${encodeURIComponent(tenant)}`,
      { headers, cache: "no-store" }
    );
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

/** 我的会话列表（role=teacher|student） */
export async function fetchMyPracticeSessions(
  role: "teacher" | "student",
  userId: string,
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data: PracticeSession[]; error?: string }> {
  try {
    const qs = new URLSearchParams({ role, userId, tenant }).toString();
    const resp = await fetch(`/api/practice-session/mine?${qs}`, { headers, cache: "no-store" });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: (r.data || []).map(parseSession) };
    return { ok: false, data: [], error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, data: [], error: e?.message || "网络错误" };
  }
}

/** 租户内所有互动故事会话（学生可加入，无需 token） */
export async function fetchTenantPracticeSessions(
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data: PracticeSession[]; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/tenant?tenant=${encodeURIComponent(tenant)}`, {
      headers,
      cache: "no-store",
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: (r.data || []).map(parseSession) };
    return { ok: false, data: [], error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, data: [], error: e?.message || "网络错误" };
  }
}

/** 学生加入会话 */export async function joinPracticeSession(
  token: string,
  studentId: string,
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/${encodeURIComponent(token)}/join`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ tenant, studentId }),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

/** 追加消息（师生/AI） */
export async function appendPracticeMessages(
  token: string,
  messages: PracticeMessage[],
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/${encodeURIComponent(token)}/messages`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ tenant, messages }),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

/** 触发 AI 评分（教师/参与者） */
export async function evaluatePracticeSession(  token: string,
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/${encodeURIComponent(token)}/evaluate`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ tenant }),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

export function practiceSessionLink(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/dashboard/ai-qa?token=${encodeURIComponent(token)}`;
}

/** 空会话生成 AI 开场白（幂等） */
export async function startPracticeSession(
  token: string,
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/${encodeURIComponent(token)}/start`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ tenant }),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}

/** 教师手动改分 / 覆盖报告 */
export async function gradePracticeSession(
  token: string,
  input: { score: number; report?: string },
  tenant: string,
  headers: Headers
): Promise<{ ok: boolean; data?: PracticeSession; error?: string }> {
  try {
    const resp = await fetch(`/api/practice-session/${encodeURIComponent(token)}/grade`, {
      method: "POST",
      headers: jsonHeaders(headers),
      body: JSON.stringify({ tenant, score: input.score, report: input.report }),
    });
    const r = await resp.json().catch(() => null);
    if (resp.ok && r?.success) return { ok: true, data: parseSession(r.data) };
    return { ok: false, error: r?.error || `HTTP ${resp.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}
