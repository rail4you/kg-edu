/**
 * Proto UI —— 学生端「交互原型风格」通用组件
 *
 * 设计参照：易课程-完整交互原型.html
 * 仅负责样式与布局，不包含任何数据逻辑，替换时可直接套用。
 */
import React, { type CSSProperties, type ReactNode } from "react";

/* ---------------- 页面头部 ---------------- */

export interface PageHeadProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}

export function PageHead({ title, description, actions, eyebrow }: PageHeadProps) {
  return (
    <div className="pu-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow ? <div className="pu-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="pu-head__actions">{actions}</div> : null}
    </div>
  );
}

/* ---------------- 卡片 ---------------- */

export interface ProtoCardProps {
  children: ReactNode;
  title?: ReactNode;
  extra?: ReactNode;
  className?: string;
  style?: CSSProperties;
  soft?: boolean;
  onClick?: () => void;
}

export function ProtoCard({ children, title, extra, className = "", style, soft, onClick }: ProtoCardProps) {
  return (
    <section
      className={`pu-card${soft ? " pu-card--soft" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      onClick={onClick}
    >
      {(title || extra) && (
        <div className="pu-card-title">
          <h2>{title}</h2>
          {extra}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------- 指标卡 ---------------- */

export interface StatItem {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  desc?: ReactNode;
  icon?: ReactNode;
}

export function StatGrid({ items, columns = 4 }: { items: StatItem[]; columns?: number }) {
  const style: CSSProperties =
    columns === 4
      ? undefined
      : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return (
    <div className="pu-grid pu-grid--stats" style={style}>
      {items.map((it, i) => (
        <div className="pu-stat" key={i}>
          {it.icon ? <span className="pu-stat__icon">{it.icon}</span> : null}
          <div className="pu-stat__label">{it.label}</div>
          <div className="pu-stat__num">
            {it.value}
            {it.unit ? <small>{it.unit}</small> : null}
          </div>
          {it.desc ? <div className="pu-stat__desc">{it.desc}</div> : null}
        </div>
      ))}
    </div>
  );
}

/* ---------------- 下划线标签页 ---------------- */

export interface ProtoTabsProps<T extends string = string> {
  items: { id: T; label: ReactNode }[];
  active: T;
  onChange: (id: T) => void;
}

export function ProtoTabs<T extends string = string>({ items, active, onChange }: ProtoTabsProps<T>) {
  return (
    <div className="pu-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          role="tab"
          type="button"
          aria-selected={active === t.id}
          className={`pu-tabs__item${active === t.id ? " is-active" : ""}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- 列表项 ---------------- */

export interface ListItemProps {
  index?: number | string | ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  extra?: ReactNode;
  onClick?: () => void;
}

export function ListItem({ index, title, description, extra, onClick }: ListItemProps) {
  return (
    <div className="pu-item" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {index !== undefined && <span className="pu-item__num">{index}</span>}
      <div className="pu-item__body">
        {title ? <h3>{title}</h3> : null}
        {description ? <p>{description}</p> : null}
      </div>
      {extra}
    </div>
  );
}

/* ---------------- 标签 ---------------- */

export function ProtoTag({
  children,
  tone = "green",
  style,
}: {
  children: ReactNode;
  tone?: "green" | "blue" | "amber" | "gray" | "red";
  style?: CSSProperties;
}) {
  return <span className={`pu-tag pu-tag--${tone}`} style={style}>{children}</span>;
}

/* ---------------- 进度条 ---------------- */

export function ProgressBar({
  percent,
  small,
}: {
  percent: number;
  small?: boolean;
}) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`pu-progress${small ? " pu-progress--sm" : ""}`}>
      <i style={{ width: `${p}%` }} />
    </div>
  );
}

/* ---------------- 空态 ---------------- */

export function ProtoEmpty({
  title = "暂无数据",
  description,
  action,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="pu-empty">
      {description ? <p>{description}</p> : null}
      <h2>{title}</h2>
      {action}
    </div>
  );
}

/* ---------------- 指标小卡列表 ---------------- */

export function MetricList({ items }: { items: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="pu-metrics">
      {items.map((it, i) => (
        <div key={i}>
          <small>{it.label}</small>
          <strong>{it.value}</strong>
        </div>
      ))}
    </div>
  );
}
