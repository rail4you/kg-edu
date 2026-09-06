import React from "react";
import { Card, Select, Tag } from "antd";
import { useResponsive } from "@/hooks/use-responsive";
import { ALL_TENANTS } from "@/hooks/use-tenant-filter";

export interface TenantLayoutOption {
  value: string;
  label: string;
}

interface TenantLayoutProps {
  /** 租户选项（含"全部租户"）。为空表示无需展示选择器（普通管理员） */
  tenants: TenantLayoutOption[];
  selected: string;
  onSelect: (value: string) => void;
  children: React.ReactNode;
}

/**
 * 管理端两栏布局：
 * - 桌面端：左侧租户列表侧栏 + 右侧内容
 * - 移动端：顶部租户下拉 + 内容
 */
export function TenantLayout({
  tenants,
  selected,
  onSelect,
  children,
}: TenantLayoutProps) {
  const { isMobile } = useResponsive();

  if (tenants.length === 0) return <>{children}</>;

  if (isMobile) {
    return (
      <div>
        <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: 8 } }}>
          <Select
            value={selected}
            onChange={onSelect}
            options={tenants}
            style={{ width: "100%" }}
            placeholder="选择租户"
          />
        </Card>
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: 16 }}>
      <Card style={{ width: 210, flexShrink: 0 }} styles={{ body: { padding: 6 } }}>
        <div
          style={{
            padding: "6px 10px 8px",
            fontWeight: 600,
            fontSize: 13,
            color: "#555",
            borderBottom: "1px solid #f0f0f0",
            marginBottom: 4,
          }}
        >
          租户筛选
        </div>
        {tenants.map((t) => {
          const active = selected === t.value;
          const isAll = t.value === ALL_TENANTS;
          return (
            <div
              key={t.value}
              onClick={() => onSelect(t.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 13,
                color: active ? "#fff" : "#333",
                background: active ? "#1677ff" : "transparent",
                marginBottom: 2,
                transition: "background 0.2s",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isAll && <Tag style={{ marginRight: 0, fontSize: 11 }}>全部</Tag>}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {t.label}
                </span>
              </span>
            </div>
          );
        })}
      </Card>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}
