import { useQuery } from "@tanstack/react-query";
import {
  fetchPortalConfig,
  type PortalConfig,
  type PortalLevel,
  type TemplatePage,
} from "@/lib/portal-config";

/** 固定导航：课程 + 微专业（首页智慧导航前两项固定） */
export const FIXED_NAV_ITEMS = [
  { key: "/courses", label: "课程" },
  { key: "/micro-majors", label: "微专业" },
];

export const MAX_NAV_ITEMS = 6;

export interface NavItem {
  key: string;
  label: string;
}

/** 门户配置（公开只读），缓存 60s */
export function usePortalConfig() {
  return useQuery({
    queryKey: ["portal-config"],
    queryFn: fetchPortalConfig,
    staleTime: 60_000,
  });
}

/** 首页导航：固定 2 项（课程/微专业）+ 动态模板页（按 sort_order，只含启用项，总数上限 6，多出不显示） */
export function usePortalNavItems(): NavItem[] {
  const { data } = usePortalConfig();
  const pages = data?.pages ?? [];
  const dynamic = pages
    .filter((p) => p.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ key: `/page/${p.slug}`, label: p.name }))
    .slice(0, MAX_NAV_ITEMS - FIXED_NAV_ITEMS.length);
  return [...FIXED_NAV_ITEMS, ...dynamic];
}

/** 学历层级标题映射：levelKey → { title, subtitle } */
export function useLevelTitleMap(): Record<string, { title: string; subtitle: string }> {
  const { data } = usePortalConfig();
  const map: Record<string, { title: string; subtitle: string }> = {};
  (data?.levels ?? []).forEach((level) => {
    map[level.levelKey] = { title: level.title, subtitle: level.subtitle };
  });
  return map;
}

/** 查找模板页（按 slug，含禁用的用于详情页校验） */
export function findTemplatePage(pages: TemplatePage[] | undefined, slug: string | undefined) {
  if (!slug) return undefined;
  return (pages ?? []).find((p) => p.slug === slug);
}

export type { PortalConfig, PortalLevel, TemplatePage };
