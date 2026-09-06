import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography, Card, Button, Input, Space, message, Spin, Tag, Empty,
  Drawer, Descriptions, Divider,
} from "antd";
import {
  RobotOutlined, ThunderboltOutlined,
  BulbOutlined, ExperimentOutlined, HistoryOutlined,
  ApartmentOutlined, ArrowLeftOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCompetenciesByMajor } from "@/lib/ash_rpc";
import { generateCompetencyGraph } from "@/lib/agent_api";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CATEGORY_MAP: Record<string, { label: string }> = {
  professional: { label: "专业能力" },
  general: { label: "通用能力" },
  practical: { label: "实践能力" },
};

// ECharts palette — muted, cohesive single-hue variations
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
  aiGenerated?: boolean;
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

export default function MajorCompetency() {
  const { majorId } = useParams<{ majorId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const [customPrompt, setCustomPrompt] = useState("");
  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Fetch existing competencies
  const { data: competencies, isLoading } = useQuery({
    queryKey: ["competencies", majorId, tenant],
    queryFn: async () => {
      const r = await getCompetenciesByMajor({
        tenant,
        input: { majorId: majorId! },
        fields: ["id", "name", "category", "level", "description", "weight", "aiGenerated", "parentId", { children: ["id", "name", "category", "level", "description", "weight", "aiGenerated", "parentId"] }],
        headers,
      });
      return r?.success ? (r.data?.results || r.data || []) : [];
    },
    enabled: !!majorId && !!tenant,
  });

  // AI generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      return await generateCompetencyGraph({
        orgSchema: tenant!,
        majorId: majorId!,
        customPrompt,
      }, headers);
    },
    onSuccess: (data) => {
      if (data.success) {
        message.success(data.message || "能力图谱生成成功");
        queryClient.invalidateQueries({ queryKey: ["competencies"] });
        setCustomPrompt("");
      } else {
        message.error(data.message || "生成失败");
      }
    },
    onError: (error: any) => {
      message.error(error?.message || "生成失败，请重试");
    },
  });

  // Build graph data from competencies
  const graphData: GraphData | null = useMemo(() => {
    if (!competencies || !Array.isArray(competencies) || competencies.length === 0) return null;

    const categoryIndexMap: Record<string, number> = {};
    CATEGORY_KEYS.forEach((key, idx) => { categoryIndexMap[key] = idx; });

    const seen = new Set<string>();
    const allNodes: Array<{ id: string; name: string; description?: string | null; category: string; parentId: string | null }> = [];
    for (const n of competencies) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        allNodes.push({ id: n.id, name: n.name, description: n.description, category: n.category || "professional", parentId: n.parentId || null });
      }
      if (n.children) {
        for (const c of n.children) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            allNodes.push({ id: c.id, name: c.name, description: c.description, category: c.category || "professional", parentId: c.parentId || null });
          }
        }
      }
    }

    if (allNodes.length === 0) return null;

    const childCountMap = new Map<string, number>();
    for (const n of allNodes) {
      if (n.parentId) {
        childCountMap.set(n.parentId, (childCountMap.get(n.parentId) || 0) + 1);
      }
    }

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
          repulsion: 800,
          gravity: 0.05,
          edgeLength: [120, 200],
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
    chart.on("click", handleNodeClick);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.off("click", handleNodeClick);
      chart.dispose();
      chartInstance.current = null;
    };
  }, [graphData]);

  const handleNodeClick = useCallback((params: any) => {
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
      const comp = competencies ? findComp(competencies) : null;
      if (comp) {
        setSelectedNode(comp);
        setDrawerOpen(true);
      }
    }
  }, [competencies]);

  // Stats
  const stats = useMemo(() => {
    if (!competencies) return { total: 0, aiGenerated: 0, categories: {} as Record<string, number> };
    let total = 0;
    let aiGenerated = 0;
    const categories: Record<string, number> = {};

    const count = (list: CompetencyNode[]) => {
      for (const c of list) {
        total++;
        if (c.aiGenerated) aiGenerated++;
        const cat = c.category || "professional";
        categories[cat] = (categories[cat] || 0) + 1;
        if (c.children) count(c.children);
      }
    };
    count(competencies);
    return { total, aiGenerated, categories };
  }, [competencies]);

  const hasGraph = graphData !== null && graphData.nodes.length > 0;

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/teacher/dashboard/major-detail/${majorId}`)}
          style={{ padding: "4px 0" }}
        >
          返回专业管理
        </Button>
      </div>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12, flexShrink: 0 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>能力图谱构建</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>基于 AI 分析专业与岗位数据，自动生成能力素质图谱</Text>
        </div>
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
          size="large"
        >
          {generateMutation.isPending ? "AI 生成中..." : hasGraph ? "重新生成" : "AI 生成图谱"}
        </Button>
      </div>

      {/* Stats + Prompt — inline bar */}
      {hasGraph && !generateMutation.isPending && (
        <div style={{ display: "flex", gap: 20, alignItems: "center", marginBottom: 16, flexShrink: 0, flexWrap: "wrap" }}>
          {Object.entries(CATEGORY_MAP).map(([key, val]) => {
            const count = stats.categories[key] || 0;
            if (count === 0) return null;
            return (
              <span key={key} style={{ fontSize: 13 }}>
                <Text type="secondary">{val.label}</Text>
                <Text strong style={{ marginLeft: 4 }}>{count}</Text>
              </span>
            );
          })}
          <span style={{ fontSize: 13 }}>
            <Text type="secondary">总计</Text>
            <Text strong style={{ marginLeft: 4 }}>{stats.total}</Text>
          </span>
          <span style={{ fontSize: 13 }}>
            <Text type="secondary">AI 生成</Text>
            <Text strong style={{ marginLeft: 4 }}>{stats.aiGenerated}</Text>
          </span>
        </div>
      )}

      {/* Prompt section */}
      <Card
        style={{ marginBottom: 16, flexShrink: 0 }}
        styles={{ body: { padding: "14px 20px" } }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <RobotOutlined style={{ fontSize: 16, marginTop: 8, color: "#999" }} />
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
              <Text strong style={{ fontSize: 13 }}>自定义要求</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>（可选）</Text>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <TextArea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                placeholder="补充你对能力图谱的特殊要求，如关注方向、行业标准..."
                rows={2}
                maxLength={1000}
                showCount
                style={{ flex: 1 }}
              />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 2 }}>
                <Tag style={{ cursor: "pointer" }} onClick={() => setCustomPrompt("请重点分析本专业的核心技术能力，同时考虑行业最新发展趋势")}>
                  关注核心技术
                </Tag>
                <Tag style={{ cursor: "pointer" }} onClick={() => setCustomPrompt("请结合企业岗位需求分析，注重实践操作能力的培养")}>
                  注重实践能力
                </Tag>
                <Tag style={{ cursor: "pointer" }} onClick={() => setCustomPrompt("请按照国家工程教育认证标准构建能力图谱")}>
                  认证标准
                </Tag>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {generateMutation.isPending && (
        <Card style={{ marginBottom: 16, textAlign: "center", flexShrink: 0 }}>
          <div style={{ padding: "40px 0" }}>
            <Spin size="large" />
            <div style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 15 }}>AI 正在分析专业数据和岗位信息...</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 13 }}>正在生成能力素质图谱，请稍候</Text>
            </div>
          </div>
        </Card>
      )}

      {/* Graph or Empty State */}
      {isLoading ? (
        <Card style={{ textAlign: "center" }}>
          <div style={{ padding: "60px 0" }}><Spin size="large" /></div>
        </Card>
      ) : hasGraph && !generateMutation.isPending ? (
        <Card
          style={{ overflow: "hidden" }}
          styles={{ body: { padding: 0 } }}
        >
          <div
            ref={chartRef}
            style={{
              width: "100%",
              height: "calc(100vh - 340px)",
              minHeight: 400,
            }}
          />
        </Card>
      ) : !generateMutation.isPending ? (
        <Card style={{ textAlign: "center" }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Text type="secondary">
                  点击上方「AI 生成图谱」按钮，基于专业信息和岗位数据自动生成能力素质图谱
                </Text>
              </Space>
            }
          />
        </Card>
      ) : null}

      {/* Node Detail Drawer */}
      <Drawer
        title={selectedNode?.name || "能力详情"}
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setSelectedNode(null); }}
      >
        {selectedNode && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="能力名称">{selectedNode.name}</Descriptions.Item>
              <Descriptions.Item label="能力类别">
                {CATEGORY_MAP[selectedNode.category || "professional"]?.label || selectedNode.category}
              </Descriptions.Item>
              <Descriptions.Item label="层级">
                {selectedNode.level === 0 ? "一级能力" : selectedNode.level === 1 ? "二级能力" : "三级能力"}
              </Descriptions.Item>
              <Descriptions.Item label="权重">
                {selectedNode.weight || 1.0}
              </Descriptions.Item>
              <Descriptions.Item label="来源">
                {selectedNode.aiGenerated ? "AI 生成" : "手动创建"}
              </Descriptions.Item>
            </Descriptions>

            {selectedNode.description && (
              <div style={{ marginBottom: 16 }}>
                <Text strong>描述</Text>
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
                    onClick={() => setSelectedNode(child)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong>{child.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {CATEGORY_MAP[child.category || "professional"]?.label}
                      </Text>
                    </div>
                    {child.description && (
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4, lineHeight: 1.6 }}>
                        {child.description.length > 100 ? child.description.slice(0, 100) + "..." : child.description}
                      </Text>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
