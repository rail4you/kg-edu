import * as React from "react";
import { useState } from "react";
import { Row, Col, Card, Empty, Spin } from "antd";
import type { SmartPortalLayout } from "@/lib/smart-portal";
import { BLOCK_REGISTRY, hydrateBlock } from "./registry";
import type { SmartPortalData } from "./use-smart-portal-data";
import { PortalQueryContext } from "./portal-context";

interface SmartPortalRendererProps {
  layout: SmartPortalLayout;
  data: SmartPortalData;
  loading?: boolean;
  onNavigate?: (path: string) => void;
}

/** 按 12 栅格渲染智慧门户布局；未知组件类型自动跳过 */
export const SmartPortalRenderer: React.FC<SmartPortalRendererProps> = ({
  layout,
  data,
  loading,
  onNavigate,
}) => {
  const [query, setQuery] = useState("");

  if (!layout.blocks.length) {
    return <Empty description="门户暂无内容，请前往管理端配置" style={{ padding: 48 }} />;
  }

  return (
    <PortalQueryContext.Provider value={{ query, setQuery }}>
      <Spin spinning={!!loading}>
        <Row gutter={[24, 24]} align="stretch">
          {layout.blocks.map((block) => {
            const def = BLOCK_REGISTRY[block.type];
            if (!def) return null;
            const hydrated = hydrateBlock(block);
            const Render = def.Render;
            return (
              <Col span={24} key={block.id}>
                <Card
                  size="small"
                  title={
                    block.type === "ai-practice" ? undefined : hydrated.title || undefined
                  }
                  style={{ height: "100%", borderLeft: "none" }}
                  styles={{
                    body: {
                      height:
                        block.type === "ai-practice" || !hydrated.title
                          ? "100%"
                          : "calc(100% - 39px)",
                    },
                  }}
                >
                  <Render block={hydrated} data={data} onNavigate={onNavigate} />
                </Card>
              </Col>
            );
          })}
        </Row>
      </Spin>
    </PortalQueryContext.Provider>
  );
};
