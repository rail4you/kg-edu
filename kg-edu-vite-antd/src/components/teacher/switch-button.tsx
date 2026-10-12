import { useState, type ReactNode } from "react";
import { Button, Empty, Modal, Spin } from "antd";
import { SwapOutlined, CheckOutlined } from "@ant-design/icons";

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
 * 点击按钮打开列表，整行可点击切换当前项，右侧「切换」文案作为点击提示。
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

  const renderRow = (id: string | undefined, label: string) => {
    const active = (id ?? "") === (value ?? "");
    return (
      <div
        key={id ?? "__all__"}
        className={`switch-btn-row${active ? " is-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => {
          onChange(id);
          setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(id);
            setOpen(false);
          }
        }}
      >
        <span className="switch-btn-row__label">{label}</span>
        <span className="switch-btn-row__hint">
          {active ? (
            <>
              <CheckOutlined /> 当前
            </>
          ) : (
            "切换"
          )}
        </span>
      </div>
    );
  };

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
        width={640}
        styles={{ body: { padding: "12px 16px 20px" } }}
      >
        <style>{`
          .switch-btn-list { display: flex; flex-direction: column; gap: 10px; }
          .switch-btn-row {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 16px 20px; cursor: pointer;
            border: 1px solid var(--pu-line, #e5e7eb); border-radius: 12px;
            background: #fff; font-size: 16px; line-height: 1.4;
            transition: border-color .15s ease, background .15s ease, box-shadow .15s ease, transform .15s ease;
          }
          .switch-btn-row:hover {
            border-color: var(--theme-primary, #2573E6);
            background: rgba(37, 115, 230, .06);
            box-shadow: 0 4px 12px rgba(37, 115, 230, .12);
            transform: translateY(-1px);
          }
          .switch-btn-row:focus-visible {
            outline: 2px solid var(--theme-primary, #2573E6);
            outline-offset: 2px;
          }
          .switch-btn-row.is-active {
            border-color: var(--theme-primary, #2573E6);
            background: rgba(37, 115, 230, .08);
          }
          .switch-btn-row__label { color: #1f2937; font-weight: 500; }
          .switch-btn-row.is-active .switch-btn-row__label { color: var(--theme-primary, #2573E6); font-weight: 600; }
          .switch-btn-row__hint {
            display: inline-flex; align-items: center; gap: 4px;
            color: var(--theme-primary, #2573E6); font-size: 14px;
            opacity: .8; white-space: nowrap;
          }
          .switch-btn-row:hover .switch-btn-row__hint { opacity: 1; }
        `}</style>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : options.length === 0 && !allowAll ? (
          <Empty description="暂无可选项" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="switch-btn-list">
            {allowAll && renderRow(undefined, allLabel)}
            {options.map((o) => renderRow(o.id, o.label))}
          </div>
        )}
      </Modal>
    </>
  );
}

export default SwitchButton;
