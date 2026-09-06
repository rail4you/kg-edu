import React from "react";
import { Button, Tooltip } from "antd";
import type { ButtonProps } from "antd";
import { useEditPermission } from "@/hooks/use-edit-permission";

interface ReadonlyActionButtonProps extends ButtonProps {
  /** 只读态下的自定义提示文案，缺省使用全局状态文案 */
  readonlyText?: string;
  children?: React.ReactNode;
}

/**
 * 通用只读感知操作按钮：
 * - 当前为只读教师时自动禁用并灰色显示，hover 显示只读原因。
 * - 其余情况行为与普通 Button 一致。
 */
export function ReadonlyActionButton({
  readonlyText,
  disabled,
  title,
  onClick,
  children,
  ...rest
}: ReadonlyActionButtonProps) {
  const { canEdit, statusText } = useEditPermission();
  const locked = !canEdit;
  const tooltip = locked ? readonlyText || statusText || title : title;

  return (
    <Tooltip title={tooltip}>
      <Button {...rest} disabled={disabled || locked} onClick={locked ? undefined : onClick}>
        {children}
      </Button>
    </Tooltip>
  );
}
