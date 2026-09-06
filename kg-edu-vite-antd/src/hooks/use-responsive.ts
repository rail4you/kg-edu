import { Grid } from "antd";
import { useMemo } from "react";

export type ScreenSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

const { useBreakpoint } = Grid;

/**
 * 响应式 hook - 基于 antd Grid.useBreakpoint
 * 提供 isMobile / isTablet / isDesktop 三个常用判断
 */
export function useResponsive() {
  const screens = useBreakpoint();

  const isMobile = useMemo(() => !screens.md, [screens.md]);
  const isTablet = useMemo(() => screens.md && !screens.lg, [screens.md, screens.lg]);
  const isDesktop = useMemo(() => !!screens.lg, [screens.lg]);
  const isSmallMobile = useMemo(() => !screens.sm, [screens.sm]);

  return {
    screens,
    isMobile,
    isTablet,
    isDesktop,
    isSmallMobile,
  };
}

export default useResponsive;