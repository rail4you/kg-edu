import { ReactNode } from "react";
import { useResponsive } from "@/hooks/use-responsive";

interface ResponsiveToolbarProps {
  title: ReactNode;
  extra?: ReactNode;
}

/**
 * 响应式工具栏 - 在移动端将标题和操作按钮垂直堆叠，操作按钮占满宽度
 */
export function ResponsiveToolbar({ title, extra }: ResponsiveToolbarProps) {
  const { isMobile } = useResponsive();

  if (!isMobile) {
    return (
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>{title}</div>
        {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>{title}</div>
      {extra && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, width: "100%" }}>
          {extra}
        </div>
      )}
    </div>
  );
}

export default ResponsiveToolbar;