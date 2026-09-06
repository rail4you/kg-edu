import { Empty } from "antd";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  description = "暂无数据",
  action,
}: EmptyStateProps) {
  return (
    <Empty
      image={icon ?? Empty.PRESENTED_IMAGE_SIMPLE}
      description={null}
      style={{ padding: "40px 0" }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#595959", fontSize: 14, marginBottom: 4 }}>
          {description}
        </div>
        {action && <div style={{ marginTop: 8 }}>{action}</div>}
      </div>
    </Empty>
  );
}
