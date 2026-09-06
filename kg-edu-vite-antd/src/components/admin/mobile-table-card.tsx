import { ReactNode } from "react";
import { Card, Space, Typography, Empty } from "antd";
import { useResponsive } from "@/hooks/use-responsive";

const { Text } = Typography;

export interface MobileCardField {
  /** 字段显示标签 */
  label: string;
  /** 字段取值 */
  value: ReactNode;
  /** 是否占整行 */
  fullRow?: boolean;
}

export interface MobileTableCardProps<T> {
  /** 数据源 */
  dataSource: T[];
  /** 字段定义 */
  fields: (item: T, index: number) => MobileCardField[];
  /** 标题（如姓名/学号） */
  title?: (item: T) => ReactNode;
  /** 副标题（如描述） */
  subtitle?: (item: T) => ReactNode;
  /** 卡片右上角徽标 */
  extra?: (item: T) => ReactNode;
  /** 底部操作按钮区 */
  actions?: (item: T) => ReactNode;
  /** 点击卡片 */
  onItemClick?: (item: T) => void;
  /** 空状态文案 */
  emptyText?: string;
  /** 加载中 */
  loading?: boolean;
}

/**
 * 移动端表格的卡片视图 - 在 < md 屏幕下替代表格展示数据
 */
export function MobileTableCard<T>({
  dataSource,
  fields,
  title,
  subtitle,
  extra,
  actions,
  onItemClick,
  emptyText = "暂无数据",
  loading,
}: MobileTableCardProps<T>) {
  const { isMobile } = useResponsive();

  if (!isMobile) {
    return null;
  }

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: "center" }}>
        <Text type="secondary">加载中...</Text>
      </div>
    );
  }

  if (dataSource.length === 0) {
    return <Empty description={emptyText} style={{ padding: "32px 0" }} />;
  }

  return (
    <Space direction="vertical" size={10} style={{ width: "100%" }}>
      {dataSource.map((item, index) => {
        const fieldList = fields(item, index);
        const titleNode = title?.(item);
        const subtitleNode = subtitle?.(item);
        const extraNode = extra?.(item);
        const actionsNode = actions?.(item);
        const itemKey = (item as unknown as { id?: string | number }).id ?? index;

        return (
          <Card
            key={itemKey}
            size="small"
            style={{
              borderRadius: 10,
              boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              cursor: onItemClick ? "pointer" : "default",
            }}
            styles={{ body: { padding: 12 } }}
            onClick={onItemClick ? () => onItemClick(item) : undefined}
          >
            {(titleNode || extraNode) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: titleNode || subtitleNode ? 8 : 0,
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  {titleNode && (
                    <Text strong style={{ fontSize: 14, display: "block" }} ellipsis>
                      {titleNode}
                    </Text>
                  )}
                  {subtitleNode && (
                    <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                      {subtitleNode}
                    </Text>
                  )}
                </div>
                {extraNode && <div style={{ flexShrink: 0 }}>{extraNode}</div>}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {fieldList
                .filter((f) => f.value !== undefined && f.value !== null && f.value !== "")
                .map((field, fi) => (
                  <div
                    key={fi}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      fontSize: 13,
                      alignItems: "flex-start",
                    }}
                  >
                    <Text type="secondary" style={{ flexShrink: 0 }}>
                      {field.label}
                    </Text>
                    <div
                      style={{
                        textAlign: "right",
                        minWidth: 0,
                        flex: 1,
                        wordBreak: "break-word",
                      }}
                    >
                      {field.value}
                    </div>
                  </div>
                ))}
            </div>

            {actionsNode && (
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 10,
                  borderTop: "1px solid #f0f0f0",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  flexWrap: "wrap",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {actionsNode}
              </div>
            )}
          </Card>
        );
      })}
    </Space>
  );
}

export default MobileTableCard;