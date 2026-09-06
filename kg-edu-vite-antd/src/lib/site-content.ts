/**
 * 站点内容配置 — 平台简介 / 联系我们 / 隐私条款
 * 数据由超级管理员在后端维护，前端公开只读。
 */

export interface SiteContent {
  aboutIntro: string;
  contactEmail: string;
  contactAddress: string;
  contactHours: string;
  privacyPolicy: string;
}

const EMPTY: SiteContent = {
  aboutIntro: "",
  contactEmail: "",
  contactAddress: "",
  contactHours: "",
  privacyPolicy: "",
};

/** 公开读取站点内容（无鉴权） */
export async function fetchSiteContent(): Promise<SiteContent> {
  try {
    const resp = await fetch("/api/site-content", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return EMPTY;
    const result = await resp.json();
    if (!result.success || !result.data) return EMPTY;
    const d = result.data;
    return {
      aboutIntro: d.about_intro || "",
      contactEmail: d.contact_email || "",
      contactAddress: d.contact_address || "",
      contactHours: d.contact_hours || "",
      privacyPolicy: d.privacy_policy || "",
    };
  } catch {
    return EMPTY;
  }
}

/** 超级管理员更新站点内容 */
export async function saveSiteContent(
  content: SiteContent,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const resp = await fetch("/api/site-content", {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          about_intro: content.aboutIntro,
          contact_email: content.contactEmail,
          contact_address: content.contactAddress,
          contact_hours: content.contactHours,
          privacy_policy: content.privacyPolicy,
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