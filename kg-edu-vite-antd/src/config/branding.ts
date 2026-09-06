/**
 * 品牌配置 — 支持部署时通过后端 API /api/branding 动态加载
 * 如果后端接口不可用（如开发环境），则使用默认值
 */

export interface BrandingConfig {
  app_name: string;
  app_title: string;
  app_description: string;
  app_copyright: string;
  logo_light: string;
  logo_dark: string;
  favicon: string;
}

export const DEFAULT_BRANDING: BrandingConfig = {
  app_name: "易课程",
  app_title: "智慧教学系统",
  app_description: "融合知识图谱与人工智能技术的智慧教学平台",
  app_copyright: "易课程 © 2026 - 融合知识图谱与人工智能技术 | 智慧教学平台",
  logo_light: "/logo/yike-home-light.png",
  logo_dark: "/logo/yike-home.png",
  favicon: "/favicon/favicon.ico",
};

let cachedBranding: BrandingConfig | null = null;

/**
 * 从后端 API 获取品牌配置（带缓存）
 * 缓存时间：1 小时，或者页面刷新后重新获取
 */
export async function fetchBranding(force = false): Promise<BrandingConfig> {
  if (cachedBranding && !force) return cachedBranding;

  try {
    const res = await fetch("/api/branding", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: BrandingConfig = await res.json();
    cachedBranding = { ...DEFAULT_BRANDING, ...data };
    return cachedBranding!;
  } catch {
    // 接口不可用时使用默认值
    if (!cachedBranding) cachedBranding = DEFAULT_BRANDING;
    return cachedBranding!;
  }
}

/** 强制刷新品牌配置（保存后调用） */
export async function refreshBranding(): Promise<BrandingConfig> {
  cachedBranding = null;
  return fetchBranding(true);
}

/** 清除缓存（登出等场景） */
export function clearBrandingCache() {
  cachedBranding = null;
}

/** 同步获取当前缓存的品牌配置 */
export function getCachedBranding(): BrandingConfig {
  return cachedBranding ?? DEFAULT_BRANDING;
}

/** 超级管理员保存品牌配置 */
export async function saveBranding(
  config: BrandingConfig,
  headers: Record<string, string>
): Promise<{ ok: boolean; error?: string; data?: BrandingConfig }> {
  try {
    const resp = await fetch("/api/branding", {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          app_name: config.app_name,
          app_title: config.app_title,
          app_description: config.app_description,
          app_copyright: config.app_copyright,
          logo_light: config.logo_light,
          logo_dark: config.logo_dark,
          favicon: config.favicon,
        },
      }),
    });
    const result = await resp.json().catch(() => null);
    if (resp.ok && result?.success) {
      cachedBranding = null;
      const data = result.data ? { ...DEFAULT_BRANDING, ...result.data } : config;
      cachedBranding = data;
      return { ok: true, data };
    }
    return { ok: false, error: result?.error || `HTTP ${resp.status}` };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    return { ok: false, error: e?.message || "网络错误" };
  }
}
