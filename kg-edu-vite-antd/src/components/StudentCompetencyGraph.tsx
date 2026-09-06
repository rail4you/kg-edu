import React, { useRef, useEffect, useMemo, useCallback, useState } from "react";
import * as echarts from "echarts";
import { Card, Empty, Spin, Typography, Drawer, Descriptions, Divider, Tag, Space } from "antd";
import { BulbOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

const CATEGORY_MAP: Record<string, { label: string }> = {
  professional: { label: "专业能力" },
  general: { label: "通用能力" },
  practical: { label: "实践能力" },
};

const ECHARTS_COLORS = {
  professional: { main: "#4A90D9", light: "#8AB8E8" },
  general: { main: "#5B8C5A", light: "#8FBF8E" },
  practical: { main: "#D4894A", light: "#E8B88A" },
};

const CATEGORY_KEYS = Object.keys(CATEGORY_MAP);

interface CompetencyNode {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
  level?: number;
  weight?: number | null;
  parentId?: string | null;
  children?: CompetencyNode[];
}

interface GraphNode {
  id: string;
  name: string;
  description?: string;
  category: number;
  level: number;
  symbolSize: number;
  itemStyle: { color: string; borderColor: string; borderWidth: number };
  label: { show: boolean; fontSize: number; fontWeight: string; color: string };
}

interface GraphLink {
  source: string;
  target: string;
  lineStyle: { opacity: number; width: number; color: string; curveness: number };
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  categories: Array<{ name: string; itemStyle: { color: string } }>;
}

interface StudentCompetencyGraphProps {
  competencies: CompetencyNode[];
  loading?: boolean;
}

export default function StudentCompetencyGraph({ competencies, loading }: StudentCompetencyGraphProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Build graph data from competencies
  const graphData: GraphData | null = useMemo(() => {
    if (!competencies || !Array.isArray(competencies) || competencies.length === 0) return null;

    const categoryIndexMap: Record<string, number> = {};
    CATEGORY_KEYS.forEach((key, idx) => { categoryIndexMap[key] = idx; });

    // Collect all nodes (flatten tree)
    const seen = new Set<string>();
    const allNodes: Array<{ id: string; name: string; description?: string | null; category: string; parentId: string | null }> = [];

    const collectNodes = (list: CompetencyNode[]) => {
      for (const n of list) {
        if (!seen.has(n.id)) {
          seen.add(n.id);
          allNodes.push({ id: n.id, name: n.name, description: n.description, category: n.category || "professional", parentId: n.parentId || null });
        }
        if (n.children && n.children.length > 0) {
          collectNodes(n.children);
        }
      }
    };
    collectNodes(competencies);

    if (allNodes.length === 0) return null;

    // Build child count map
    const childCountMap = new Map<string, number>();
    for (const n of allNodes) {
      if (n.parentId) {
        childCountMap.set(n.parentId, (childCountMap.get(n.parentId) || 0) + 1);
      }
    }

    // Calculate depth for each node
    const depthMap = new Map<string, number>();
    const getDepth = (id: string): number => {
      if (depthMap.has(id)) return depthMap.get(id)!;
      const node = allNodes.find(n => n.id === id);
      if (!node || !node.parentId) { depthMap.set(id, 0); return 0; }
      const d = getDepth(node.parentId) + 1;
      depthMap.set(id, d);
      return d;
    };
    for (const n of allNodes) getDepth(n.id);

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    for (const n of allNodes) {
      const catIdx = categoryIndexMap[n.category] ?? 0;
      const colors = ECHARTS_COLORS[n.category] || ECHARTS_COLORS.professional;
      const depth = depthMap.get(n.id) || 0;
      const childCount = childCountMap.get(n.id) || 0;
      const symbolSize = depth === 0 ? Math.max(50, 40 + childCount * 5) : depth === 1 ? 35 : 25;

      nodes.push({
        id: n.id,
        name: n.name,
        description: n.description || undefined,
        category: catIdx,
        level: depth,
        symbolSize,
        itemStyle: {
          color: depth === 0 ? colors.main : colors.light,
          borderColor: "#fff",
          borderWidth: depth === 0 ? 3 : 2,
        },
        label: {
          show: true,
          fontSize: depth === 0 ? 14 : depth === 1 ? 12 : 11,
          fontWeight: depth === 0 ? "bold" : "normal",
          color: "#333",
        },
      });

      if (n.parentId) {
        const parentCat = allNodes.find(p => p.id === n.parentId)?.category || "professional";
        const parentColors = ECHARTS_COLORS[parentCat] || ECHARTS_COLORS.professional;
        links.push({
          source: n.parentId,
          target: n.id,
          lineStyle: {
            opacity: 0.6,
            width: depth <= 1 ? 2.5 : 1.5,
            color: parentColors.main,
            curveness: 0.15,
          },
        });
      }
    }

    const categories = CATEGORY_KEYS.map(key => ({
      name: CATEGORY_MAP[key].label,
      itemStyle: { color: ECHARTS_COLORS[key]?.main || "#4A90D9" },
    }));

    return { nodes, links, categories };
  }, [competencies]);

  // Render ECharts
  useEffect(() => {
    if (!graphData || !chartRef.current) return;

    const container = chartRef.current;
    if (!container.offsetWidth || !container.offsetHeight) return;

    const oldChart = echarts.getInstanceByDom(container);
    if (oldChart) oldChart.dispose();

    const chart = echarts.init(container);
    chartInstance.current = chart;

    const option = {
      backgroundColor: "#fff",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(255,255,255,0.96)",
        borderColor: "#e8e8e8",
        borderWidth: 1,
        textStyle: { color: "#333", fontSize: 13 },
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const d = params.data as GraphNode;
            const catKey = CATEGORY_KEYS[d.category] || "professional";
            const catLabel = CATEGORY_MAP[catKey].label;
            const desc = d.description ? `<br/><span style="color:#666;font-size:12px">${d.description}</span>` : "";
            return `<div style="padding:4px 0">
              <strong style="font-size:14px">${d.name}</strong><br/>
              <span style="color:#888;font-size:11px">${catLabel}</span>
              ${desc}
            </div>`;
          }
          return "";
        },
      },
      toolbox: {
        show: true,
        orient: "vertical",
        right: 16,
        top: "center",
        feature: {
          dataZoom: { show: true, title: { zoom: "区域缩放", back: "还原" } },
          restore: { show: true, title: "还原" },
          saveAsImage: { show: true, title: "保存图片" },
        },
      },
      legend: [{
        data: graphData.categories.map(c => c.name),
        orient: "vertical",
        left: 16,
        top: 16,
        textStyle: { fontSize: 12, color: "#666" },
      }],
      animation: true,
      animationDuration: 1200,
      animationEasingUpdate: "quinticInOut",
      series: [{
        name: "能力图谱",
        type: "graph",
        layout: "force",
        data: graphData.nodes,
        links: graphData.links,
        categories: graphData.categories,
        roam: true,
        force: {
          repulsion: 600,
          gravity: 0.05,
          edgeLength: [100, 180],
          layoutAnimation: true,
        },
        draggable: true,
        label: {
          show: true,
          position: "right",
          formatter: "{b}",
          fontSize: 12,
          color: "#333",
        },
        labelLayout: { hideOverlap: true },
        emphasis: {
          focus: "adjacency",
          label: { show: true, fontSize: 14, fontWeight: "bold" },
          lineStyle: { width: 3, opacity: 0.9 },
        },
        lineStyle: { color: "source", curveness: 0.2, opacity: 0.5 },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 8],
      }],
    };

    chart.setOption(option as any);

    const handleNodeClick = (params: any) => {
      if (params.dataType === "node") {
        const nodeData = params.data as GraphNode;
        const findComp = (list: CompetencyNode[]): CompetencyNode | null => {
          for (const c of list) {
            if (c.id === nodeData.id) return c;
            if (c.children) {
              const found = findComp(c.children);
              if (found) return found;
            }
          }
          return null;
        };
        const comp = findComp(competencies);
        if (comp) {
          setSelectedNode(comp);
          setDrawerOpen(true);
        }
      }
    };

    chart.on("click", handleNodeClick);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.off("click", handleNodeClick);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [graphData, competencies]);

  const hasGraph = graphData !== null && graphData.nodes.length > 0;

  if (loading) {
    return (
      <Card style={{ textAlign: "center" }}>
        <div style={{ padding: "60px 0" }}><Spin size="large" /></div>
      </Card>
    );
  }

  if (!hasGraph) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Space direction="vertical" size={4}>
              <Text type="secondary">
                教师暂未配置能力图谱
              </Text>
            </Space>
          }
        />
      </Card>
    );
  }

  return (
    <>
      <Card
        style={{ overflow: "hidden" }}
        styles={{ body: { padding: 0 } }}
      >
        <div
          ref={chartRef}
          style={{
            width: "100%",
            height: "calc(100vh - 520px)",
            minHeight: 400,
          }}
        />
      </Card>

      {/* Node Detail Drawer */}
      <Drawer
        title={selectedNode?.name || "能力详情"}
        placement="right"
        width={420}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedNode(null); }}
      >
        {selectedNode && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="能力名称">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="能力类别">
                <Tag color={
                  selectedNode.category === "professional" ? "blue" :
                  selectedNode.category === "general" ? "green" : "orange"
                }>
                  {CATEGORY_MAP[selectedNode.category || "professional"]?.label || selectedNode.category}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="层级">
                {selectedNode.level === 0 ? "一级能力" : selectedNode.level === 1 ? "二级能力" : "三级能力"}
              </Descriptions.Item>
              {selectedNode.weight && (
                <Descriptions.Item label="权重">{selectedNode.weight}</Descriptions.Item>
              )}
            </Descriptions>

            {selectedNode.description && (
              <div style={{ marginBottom: 16 }}>
                <Text strong><BulbOutlined style={{ marginRight: 6 }} />描述</Text>
                <Paragraph style={{ marginTop: 8, color: "#666", lineHeight: 1.8 }}>
                  {selectedNode.description}
                </Paragraph>
              </div>
            )}

            {selectedNode.children && selectedNode.children.length > 0 && (
              <div>
                <Divider orientation="left" style={{ fontSize: 13 }}>
                  子能力 ({selectedNode.children.length})
                </Divider>
                {selectedNode.children.map((child) => (
                  <Card
                    key={child.id}
                    size="small"
                    style={{
                      marginBottom: 8,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setSelectedNode(child);
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong>{child.name}</Text>
                      <Tag color={
                        child.category === "professional" ? "blue" :
                        child.category === "general" ? "green" : "orange"
                      }>
                        {CATEGORY_MAP[child.category || "professional"]?.label}
                      </Tag>
                    </div>
                    {child.description && (
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4, lineHeight: 1.6 }}>
                        {child.description.length > 80 ? child.description.slice(0, 80) + "..." : child.description}
                      </Text>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}