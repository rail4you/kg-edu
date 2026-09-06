/* eslint-disable react-refresh/only-export-components */
/**
 * Branding React Context — 提供全局品牌配置
 * 所有组件通过此 context 获取应用名称、Logo 路径等信息
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { fetchBranding, type BrandingConfig, DEFAULT_BRANDING } from "@/config/branding";

const BrandingContext = createContext<{
  branding: BrandingConfig;
  refresh: () => Promise<void>;
}>({
  branding: DEFAULT_BRANDING,
  refresh: async () => {},
});

/** 动态更新 <title>、<link rel="icon"> */
function applyBrandingMeta(branding: BrandingConfig) {
  // 更新页面标题
  document.title = `${branding.app_name} · ${branding.app_title}`;

  // 更新 favicon
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) {
    link.href = branding.favicon;
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING);

  const refresh = async () => {
    const b = await fetchBranding(true);
    setBranding(b);
    applyBrandingMeta(b);
  };

  useEffect(() => {
    fetchBranding().then((b) => {
      setBranding(b);
      applyBrandingMeta(b);
    });
  }, []);

  return (
    <BrandingContext.Provider value={{ branding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingConfig {
  return useContext(BrandingContext).branding;
}

export function useBrandingContext() {
  return useContext(BrandingContext);
}
