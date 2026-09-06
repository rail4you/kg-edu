import { ReactNode } from "react";
import { Button, Dropdown, Space } from "antd";
import { EllipsisOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";

interface SecondaryAction {
  key: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface CompactToolbarProps {
  /** 主要操作按钮（始终显示） */
  primaryAction?: ReactNode;
  /** 次要操作（折叠到"更多"菜单中） */
  secondaryActions?: SecondaryAction[];
  /** 额外显示在右侧的自定义节点（桌面端） */
  extra?: ReactNode;
}

/**
 * 紧凑工具栏 - 移动端只显示主按钮，次要操作折叠到 Ellipsis 菜单中
 */
export function CompactToolbar({
  primaryAction,
  secondaryActions,
  extra,
}: CompactToolbarProps) {
  if (!secondaryActions || secondaryActions.length === 0) {
    return (
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        {primaryAction && <div style={{ flex: 1 }}>{primaryAction}</div>}
        {extra}
      </div>
    );
  }

  const menuItems: MenuProps["items"] = secondaryActions.map((action) => ({
    key: action.key,
    icon: action.icon,
    label: action.label,
    onClick: action.onClick,
    danger: action.danger,
    disabled: action.disabled,
  }));

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        width: "100%",
        alignItems: "center",
      }}
    >
      {primaryAction && <div style={{ flex: 1 }}>{primaryAction}</div>}
      <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
        <Button
          icon={<EllipsisOutlined />}
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        />
      </Dropdown>
      {extra}
    </div>
  );
}

export default CompactToolbar;
