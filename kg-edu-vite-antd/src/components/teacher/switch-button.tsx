import { useState, type ReactNode } from "react";
import { Button, Empty, List, Modal, Spin } from "antd";
import { SwapOutlined } from "@ant-design/icons";

export interface SwitchOption {
  id: string;
  label: string;
}

export interface SwitchButtonProps {
  /** 弹窗标题，如「切换当前课程」 */
  title: string;
  /** 按钮文案，如「切换课程」 */
  buttonLabel: string;
  options: SwitchOption[];
  value?: string | null;
  onChange: (id: string | undefined) => void;
  loading?: boolean;
  /** 是否提供「全部」选项（清除筛选） */
  allowAll?: boolean;
  allLabel?: string;
  icon?: ReactNode;
  size?: "large" | "middle" | "small";
}

/**
 * 切换选择按钮 + 列表弹窗（对齐交互原型 chooseCourse()）。
 * 点击按钮打开一个列表，每行右侧「选择」按钮用于切换当前项。
 */
export function SwitchButton({
  title,
  buttonLabel,
  options,
  value,
  onChange,
  loading,
  allowAll,
  allLabel = "全部",
  icon,
  size,
}: SwitchButtonProps) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.id === value);

  return (
    <>
      <Button icon={icon ?? <SwapOutlined />} onClick={() => setOpen(true)} size={size}>
        {buttonLabel}
        {current ? `：${current.label}` : ""}
      </Button>
      <Modal
        title={title}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={520}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : options.length === 0 ? (
          <Empty description="暂无可选项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <>
            {allowAll && (
              <List.Item
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <span style={{ color: !value ? "#2859df" : undefined, fontWeight: !value ? 600 : 400 }}>
                  {allLabel}
                </span>
                <Button
                  size="small"
                  type="link"
                  onClick={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                >
                  选择
                </Button>
              </List.Item>
            )}
            <List
              dataSource={options}
              renderItem={(o) => (
                <List.Item
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                >
                  <span style={{ fontWeight: o.id === value ? 600 : 400 }}>
                    {o.label}
                  </span>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                  >
                    选择
                  </Button>
                </List.Item>
              )}
            />
          </>
        )}
      </Modal>
    </>
  );
}

export default SwitchButton;
