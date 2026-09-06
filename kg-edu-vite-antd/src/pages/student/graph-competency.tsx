import React, { useRef, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography,
  Spin,
  Alert,
  Tag,
  Button,
  Select,
  Input,
  Space,
  Drawer,
  Descriptions,
  List,
  Grid,
} from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  CloseOutlined,
  BulbOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { listMainAbilities, listSubAbilities } from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface CompetencyNode {
  id: string;
  name: string;
  description?: string;
  category?: number;
  symbolSize?: number;
  value?: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  label?: {
    show?: boolean;
    fontSize?: number;
    color?: string;
    fontWeight?: string;
  };
}

interface CompetencyLink {
  source: string | CompetencyNode;
  target: string | CompetencyNode;
  category?: number;
  lineStyle?: {
    opacity?: number;
    width?: number;
    color?: string;
    curveness?: number;
  };
}

interface CompetencyGraphData {
  nodes: CompetencyNode[];
  links: CompetencyLink[];
  categories: Array<{ name: string; itemStyle: { color: string } }>;
}

interface StudentCompetencyGraphViewProps {
  courseId: string;
}

interface AbilityNodeInfo {
  id: string;
  name: string;
  type: "main" | "sub";
  description?: string;
  knowledgeResourceIds: string[];
}

export function StudentCompetencyGraphView({ courseId }: StudentCompetencyGraphViewProps) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const zoomRatio = useRef(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const baseNodesRef = useRef<CompetencyNode[]>([]);
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showPanel, setShowPanel] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState<{
    id: string;
    name: string;
    description?: string | null;
  } | null>(null);
  const [selectedAbilityNode, setSelectedAbilityNode] = useState<AbilityNodeInfo | null>(null);
  const [mobilePopoverOpen, setMobilePopoverOpen] = useState(false);
  const [mobilePopoverNode, setMobilePopoverNode] = useState<CompetencyNode | null>(null);
  const [ctxMenuVisible, setCtxMenuVisible] = useState(false);
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 });
  const [ctxMenuNode, setCtxMenuNode] = useState<CompetencyNode | null>(null);

  const tenant = currentTenant?.schemaName || "";

  const { data: mainAbilitiesData, isLoading: mainAbilitiesLoading, error: mainAbilitiesError } = useQuery({
    queryKey: ["student-main-abilities", courseId, tenant],
    queryFn: async () => {
      if (!tenant) {
        throw new Error("No tenant selected");
      }
      const result = await listMainAbilities({
        tenant,
        fields: ["id", "name", "description", "courseId"],
        filter: { courseId: { eq: courseId } },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!courseId && !!tenant && !!user,
    staleTime: 0,
  });

  const { data: subAbilitiesData, isLoading: subAbilitiesLoading, error: subAbilitiesError } = useQuery({
    queryKey: ["student-sub-abilities", courseId, tenant, mainAbilitiesData],
    queryFn: async () => {
      if (!tenant) {
        throw new Error("No tenant selected");
      }
      if (!mainAbilitiesData || mainAbilitiesData.length === 0) {
        return [];
      }

      const mainAbilityIds = mainAbilitiesData.map((ma: any) => ma.id);
      const result = await listSubAbilities({
        tenant,
        fields: ["id", "name", "description", "mainAbilityId", { knowledgeResources: ["id", "name", "description"] }],
        filter: {
          mainAbilityId: { in: mainAbilityIds },
        },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!courseId && !!tenant && !!user && !!mainAbilitiesData && mainAbilitiesData.length > 0,
    staleTime: 0,
  });

  const { data: graphData, isLoading: graphLoading, error: graphError } = useQuery({
    queryKey: ["student-competency-graph", courseId, mainAbilitiesData, subAbilitiesData],
    queryFn: async (): Promise<CompetencyGraphData> => {
      if (!mainAbilitiesData || !Array.isArray(mainAbilitiesData)) {
        return { nodes: [], links: [], categories: [] };
      }

      const nodes: CompetencyNode[] = [];
      const links: CompetencyLink[] = [];
      const nodeIds = new Set<string>();

      if (mainAbilitiesData.length === 0) {
        return { nodes: [], links: [], categories: [] };
      }

      const nodeMap = new Map<string, CompetencyNode>();

      mainAbilitiesData.forEach((main: any) => {
        const nodeId = String(main.id);
        nodeIds.add(nodeId);
        const node: CompetencyNode = {
          id: nodeId,
          name: main.name,
          description: main.description,
          category: 0,
          symbolSize: 40,
          itemStyle: {
            color: "#5470c6",
            borderColor: "#fff",
            borderWidth: 3,
          },
          label: {
            show: true,
            fontSize: 14,
            fontWeight: "bold",
            color: "#333",
          },
        };
        nodes.push(node);
        nodeMap.set(nodeId, node);
      });

      const subAbilities = subAbilitiesData || [];
      subAbilities.forEach((sub: any) => {
        const subId = String(sub.id);
        nodeIds.add(subId);
        const node: CompetencyNode = {
          id: subId,
          name: sub.name,
          description: sub.description,
          category: 1,
          symbolSize: 30,
          itemStyle: {
            color: "#91cc75",
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: true,
            fontSize: 12,
            color: "#333",
          },
        };
        nodes.push(node);
        nodeMap.set(subId, node);

        if (sub.mainAbilityId) {
          const mainId = String(sub.mainAbilityId);
          if (nodeIds.has(mainId)) {
            links.push({
              source: mainId,
              target: subId,
              lineStyle: {
                opacity: 0.6,
                width: 2,
                color: "#5470c6",
                curveness: 0.1,
              },
            });
          }
        }

        const knowledgeResources = sub.knowledgeResources || [];
        knowledgeResources.forEach((kr: any) => {
          const krId = String(kr.id);

          if (!nodeIds.has(krId)) {
            nodeIds.add(krId);
            const krNode: CompetencyNode = {
              id: krId,
              name: kr.name,
              description: kr.description,
              category: 2,
              symbolSize: 20,
              itemStyle: {
                color: "#fac858",
                borderColor: "#fff",
                borderWidth: 2,
              },
              label: {
                show: true,
                fontSize: 11,
                color: "#333",
              },
            };
            nodes.push(krNode);
            nodeMap.set(krId, krNode);
          }

          links.push({
            source: subId,
            target: krId,
            lineStyle: {
              opacity: 0.4,
              width: 1,
              color: "#91cc75",
              curveness: 0.2,
            },
          });
        });
      });

      return {
        nodes,
        links,
        categories: [
          { name: "主能力", itemStyle: { color: "#5470c6" } },
          { name: "子能力", itemStyle: { color: "#91cc75" } },
          { name: "知识点", itemStyle: { color: "#fac858" } },
        ],
      };
    },
    enabled: !!courseId && !!mainAbilitiesData && !!subAbilitiesData,
    staleTime: 5 * 60 * 1000,
  });

  const handleNodeClick = useCallback((params: any) => {
    if (params.dataType === "node") {
      const nodeData = params.data as CompetencyNode;
      if (isMobile) {
        params.event?.event?.preventDefault?.();
        setMobilePopoverNode(nodeData);
        setMobilePopoverOpen(true);
        return;
      }
      setSelectedNode(nodeData);

      if (nodeData.category === 2) {
        setSelectedKnowledgePoint({
          id: nodeData.id,
          name: nodeData.name,
          description: nodeData.description,
        });
        setDrawerOpen(true);
      } else if (nodeData.category === 0 || nodeData.category === 1) {
        const nodeId = nodeData.id;
        let knowledgeResourceIds: string[] = [];
        const abilityType: "main" | "sub" = nodeData.category === 0 ? "main" : "sub";

        if (nodeData.category === 1 && subAbilitiesData) {
          const subAbility = subAbilitiesData.find(
            (sub: any) => String(sub.id) === nodeId,
          );
          if (subAbility?.knowledgeResources) {
            knowledgeResourceIds = subAbility.knowledgeResources.map(
              (kr: any) => kr.id,
            );
          }
        } else if (nodeData.category === 0 && mainAbilitiesData && subAbilitiesData) {
          const mainAbility = mainAbilitiesData.find(
            (ma: any) => String(ma.id) === nodeId,
          );
          if (mainAbility) {
            const relatedSubAbilities = subAbilitiesData.filter(
              (sub: any) => sub.mainAbilityId === mainAbility.id,
            );
            relatedSubAbilities.forEach((sub: any) => {
              if (sub.knowledgeResources) {
                const ids = sub.knowledgeResources.map(
                  (kr: any) => kr.id,
                );
                knowledgeResourceIds.push(...ids);
              }
            });
          }
        }

        setSelectedAbilityNode({
          id: nodeId,
          name: nodeData.name,
          type: abilityType,
          description: nodeData.description,
          knowledgeResourceIds,
        });
        setDrawerOpen(true);
      }
    }
  }, [subAbilitiesData, mainAbilitiesData, isMobile]);

  const handleContextMenu = useCallback((params: any) => {
    if (params.dataType === "node") {
      params.event?.event?.preventDefault?.();
      setCtxMenuPos({ x: params.event.event?.clientX || 0, y: params.event.event?.clientY || 0 });
      setCtxMenuNode(params.data as CompetencyNode);
      setCtxMenuVisible(true);
    }
  }, []);

  const filteredGraphData = React.useMemo(() => {
    if (!graphData) return graphData;

    let filteredNodes = graphData.nodes;
    let filteredLinks = graphData.links;

    if (selectedCategory !== null) {
      const filteredNodeIds = new Set(
        filteredNodes.filter((node) => node.category === selectedCategory).map((node) => node.id)
      );

      filteredNodes = filteredNodes.filter((node) => filteredNodeIds.has(node.id));
      filteredLinks = filteredLinks.filter(
        (link) =>
          filteredNodeIds.has(String(link.source)) && filteredNodeIds.has(String(link.target))
      );
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const searchNodeIds = new Set(
        filteredNodes.filter((node) => node.name.toLowerCase().includes(searchLower)).map((node) => node.id)
      );

      filteredNodes = filteredNodes.filter((node) => searchNodeIds.has(node.id));
      filteredLinks = filteredLinks.filter(
        (link) =>
          searchNodeIds.has(String(link.source)) && searchNodeIds.has(String(link.target))
      );
    }

    return {
      ...graphData,
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, selectedCategory, searchTerm]);

  React.useEffect(() => {
    if (!filteredGraphData || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    chart.showLoading();
    chartInstance.current = chart;

    // 基础字体大小配置
    const BASE_FONT_SIZES = {
      label: 11,
      emphasis: 12,
    };

    // 保存原始节点数据，用于缩放时计算
    baseNodesRef.current = (filteredGraphData.nodes || []).map((node) => ({
      ...node,
      _baseSymbolSize: node.symbolSize || 20,
      _baseFontSize: node.label?.fontSize || BASE_FONT_SIZES.label,
    }));

    const getScaledFontSize = (baseSize: number) => {
      return Math.max(8, Math.round(baseSize * zoomRatio.current));
    };

    const option = {
      backgroundColor: "#ffffff",
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const data = params.data as CompetencyNode;
            const categoryName =
              data.category !== undefined ? graphData?.categories[data.category]?.name : "";
            return `<strong>${data.name}</strong><br/>${categoryName}`;
          }
          if (params.dataType === "edge") {
            return "能力关系";
          }
          return "";
        },
        backgroundColor: "rgba(0,0,0,0.8)",
        textStyle: {
          color: "#fff",
          fontSize: 12,
        },
        borderColor: "transparent",
      },
      legend: [
        {
          data: filteredGraphData.categories?.map((c) => c.name) || [],
          orient: "vertical",
          left: 20,
          top: 20,
          textStyle: {
            fontSize: 12,
            color: "#333",
          },
        },
      ],
      animation: true,
      animationDuration: 1500,
      animationEasingUpdate: "quinticInOut",
      series: [
        {
          id: "student-competency-graph",
          name: "能力图谱",
          type: "graph",
          layout: "force",
          data: filteredGraphData.nodes || [],
          links: filteredGraphData.links || [],
          categories: filteredGraphData.categories || [],
          roam: true,
          force: {
            repulsion: 1000,
            gravity: 0.1,
            edgeLength: 150,
            layoutAnimation: true,
          },
          draggable: true,
          label: {
            show: true,
            position: "right",
            formatter: "{b}",
            fontSize: getScaledFontSize(BASE_FONT_SIZES.label),
            color: "#333",
          },
          labelLayout: {
            hideOverlap: true,
          },
          emphasis: {
            focus: "adjacency",
            label: {
              show: true,
              fontSize: getScaledFontSize(BASE_FONT_SIZES.emphasis),
              fontWeight: "bold",
              color: "#333",
            },
            lineStyle: {
              width: 3,
              opacity: 0.8,
            },
          },
          lineStyle: {
            color: "source",
            curveness: 0.3,
            opacity: 0.6,
          },
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [0, 8],
          edgeLabel: {
            show: false,
          },
        },
      ],
    };

    chart.hideLoading();
    chart.setOption(option as any);
    chart.on("click", handleNodeClick);
    chart.on("contextmenu", handleContextMenu);

    // 监听缩放事件，实现字体缩放
    const handleGraphRoam = () => {
      if (!chartInstance.current) return;
      try {
        const opt = chartInstance.current.getOption() as any;
        const series = opt?.series?.[0];
        if (!series) return;

        const currentZoom = series.zoom || 1;
        zoomRatio.current = currentZoom;
        setZoomPercent(Math.round(currentZoom * 100));

        const scaledFontSize = getScaledFontSize(BASE_FONT_SIZES.label);
        const scaledEmphasisFontSize = getScaledFontSize(BASE_FONT_SIZES.emphasis);

        // 基于原始节点数据计算缩放后的 fontSize
        const updatedData = baseNodesRef.current.map((node: any) => ({
          ...node,
          label: {
            ...node.label,
            fontSize: getScaledFontSize(node._baseFontSize || BASE_FONT_SIZES.label),
          },
        }));

        chartInstance.current.setOption({
          series: [{
            id: 'student-competency-graph',
            data: updatedData,
            label: {
              fontSize: scaledFontSize,
            },
            emphasis: {
              label: {
                fontSize: scaledEmphasisFontSize,
              },
            },
          }],
        });
      } catch (e) {
        console.error('[StudentGraphCompetency] zoom error:', e);
      }
    };

    chart.on('graphRoam', handleGraphRoam);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.off('graphRoam', handleGraphRoam);
      chart.dispose();
    };
  }, [filteredGraphData, handleNodeClick, graphData]);

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Spin size="large" />
        <Text type="secondary">正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <Alert
          type="error"
          message="用户未登录，请登录以访问能力图谱。"
          style={{
            borderRadius: 12,
            backgroundColor: "rgba(239, 68, 68, 0.05)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      
      {showPanel && (
        <div
          style={{
            minHeight: isMobile ? 36 : 48,
            padding: isMobile ? "3px 6px" : "4px 16px",
            backgroundColor: "white",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            gap: isMobile ? 4 : 12,
            alignItems: "center",
            flexWrap: isMobile ? "wrap" : "nowrap",
            flexShrink: 0,
          }}
        >
          <Input
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            prefix={<SearchOutlined style={{ color: "#999" }} />}
            suffix={
              searchTerm ? (
                <CloseOutlined
                  style={{ color: "#999", cursor: "pointer" }}
                  onClick={() => setSearchTerm("")}
                />
              ) : null
            }
            style={{ flex: isMobile ? "1 1 auto" : undefined, width: isMobile ? undefined : 200, minWidth: isMobile ? 80 : undefined, maxWidth: isMobile ? undefined : 200 }}
          />

          <Select
            value={selectedCategory ?? undefined}
            placeholder="能力类型"
            style={{ width: isMobile ? 120 : 120, minWidth: isMobile ? 100 : undefined, flexShrink: 0 }}
            onChange={(value) => setSelectedCategory(value === undefined ? null : value)}
            allowClear
            options={[
              { label: "全部", value: undefined },
              ...(graphData?.categories?.map((cat, index) => ({
                label: cat.name,
                value: index,
              })) || []),
            ]}
          />

          {(selectedCategory !== null || searchTerm.trim()) && (
            <Tag
              closable
              onClose={() => {
                setSelectedCategory(null);
                setSearchTerm("");
              }}
              color="blue"
              style={{ flexShrink: 0 }}
            >
              清除筛选 ({filteredGraphData?.nodes?.length || 0} 个节点)
            </Tag>
          )}
          <div style={{ flex: 1, minWidth: isMobile ? 0 : undefined }} />
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 4 }}>
            <span style={{ color: "#666", fontSize: isMobile ? 10 : 12, padding: isMobile ? "0 2px" : undefined }}>{zoomPercent}%</span>
            {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
              <button key={label as string} onClick={() => {
                if (!chartInstance.current) return;
                try {
                  const opt = chartInstance.current.getOption() as any;
                  const cur = opt?.series?.[0]?.zoom || 1;
                  const next = val === "reset" ? 1 : Math.max(0.2, Math.min(3, cur + (val as number)));
                  chartInstance.current.setOption({ series: [{ id: 'student-competency-graph', zoom: next }] });
                  zoomRatio.current = next;
                  setZoomPercent(Math.round(next * 100));
                } catch {}
              }}
                style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 4, color: "#333", padding: isMobile ? "3px 8px" : "4px 12px", cursor: "pointer", fontSize: isMobile ? 12 : 14, lineHeight: 1 }}>
                {label as string}
              </button>
            ))}
          </div>
        </div>
      )}

      {!currentTenant && (
        <Alert
          type="warning"
          message="未检测到租户信息，请先选择一个租户/组织"
          style={{ marginBottom: 16 }}
        />
      )}

      {(mainAbilitiesError || subAbilitiesError || graphError) && (
        <Alert
          type="error"
          message={`加载数据时出错: ${(mainAbilitiesError || subAbilitiesError || graphError) instanceof Error
            ? (mainAbilitiesError || subAbilitiesError || graphError)?.message
            : "未知错误"}`}
          style={{ marginBottom: 16 }}
        />
      )}

      {(graphLoading || mainAbilitiesLoading || subAbilitiesLoading) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: 24,
            justifyContent: "center",
          }}
        >
          <Spin />
          <Text type="secondary">正在加载能力图谱数据...</Text>
        </div>
      )}

      {selectedNode && (
        <Alert
          type="info"
          message={
            <span>
              已选中能力节点: <strong>{selectedNode.name}</strong>
            </span>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {courseId && graphData && (
          <div
            ref={chartRef}
            style={{
              width: "100%",
              height: "100%",
              minHeight: 300,
              backgroundColor: "white",
              overflow: "hidden",
            }}
          />
        )}
      </div>

      {/* 右键菜单 */}
      {ctxMenuVisible && ctxMenuNode && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 999 }} onClick={() => setCtxMenuVisible(false)} />
          <div
            style={{
              position: "fixed", left: ctxMenuPos.x, top: ctxMenuPos.y, zIndex: 1000,
              backgroundColor: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              padding: "4px 0", minWidth: 150,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "8px 14px", borderBottom: "1px solid #f0f0f0", fontSize: 12, fontWeight: 600 }}>
              {ctxMenuNode.name}
            </div>
            <div
              style={{ padding: "8px 14px", cursor: "pointer", fontSize: 13 }}
              onClick={() => {
                setCtxMenuVisible(false);
                const nd = ctxMenuNode;
                setSelectedNode(nd);
                if (nd.category === 2) {
                  setSelectedKnowledgePoint({ id: nd.id, name: nd.name, description: nd.description });
                  setDrawerOpen(true);
                } else {
                  setSelectedAbilityNode({ id: nd.id, name: nd.name, type: nd.category === 0 ? "main" : "sub", description: nd.description, knowledgeResourceIds: [] });
                  setDrawerOpen(true);
                }
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              查看详情
            </div>
          </div>
        </>
      )}

      {/* 移动端底部弹出 */}
      {isMobile && mobilePopoverOpen && mobilePopoverNode && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.3)" }}
            onClick={() => setMobilePopoverOpen(false)}
          />
          <div
            style={{
              position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
              background: "#fff", borderRadius: "16px 16px 0 0", padding: "20px 16px 32px",
              boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd", margin: "0 auto 16px" }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "#333", marginBottom: 8 }}>
              {mobilePopoverNode.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                block
                size="large"
                type="primary"
                onClick={() => {
                  setMobilePopoverOpen(false);
                  const nd = mobilePopoverNode;
                  setSelectedNode(nd);
                  if (nd.category === 2) {
                    setSelectedKnowledgePoint({ id: nd.id, name: nd.name, description: nd.description });
                    setDrawerOpen(true);
                  } else {
                    setSelectedAbilityNode({ id: nd.id, name: nd.name, type: nd.category === 0 ? "main" : "sub", description: nd.description, knowledgeResourceIds: [] });
                    setDrawerOpen(true);
                  }
                }}
                style={{ borderRadius: 10, height: 48, fontSize: 15 }}
              >
                查看详情
              </Button>
              <Button
                block
                size="large"
                onClick={() => setMobilePopoverOpen(false)}
                style={{ borderRadius: 10, height: 48, fontSize: 15 }}
              >
                取消
              </Button>
            </div>
          </div>
        </>
      )}

      <KnowledgeResourcePanel
        open={drawerOpen && !!selectedKnowledgePoint && !selectedAbilityNode}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedKnowledgePoint(null);
        }}
        knowledge={selectedKnowledgePoint}
      />

      <Drawer
        title={selectedAbilityNode ? `${selectedAbilityNode.name} - 关联资源` : "能力详情"}
        placement="right"
        width={isMobile ? "100%" : 600}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAbilityNode(null);
          setSelectedKnowledgePoint(null);
        }}
        open={drawerOpen && !!selectedAbilityNode}
      >
        {selectedAbilityNode && (
          <div>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="类型">
                {selectedAbilityNode.type === "main" ? "主能力" : "子能力"}
              </Descriptions.Item>
              <Descriptions.Item label="名称">
                {selectedAbilityNode.name}
              </Descriptions.Item>
              <Descriptions.Item label="描述">
                {selectedAbilityNode.description || "暂无描述"}
              </Descriptions.Item>
            </Descriptions>
            {selectedAbilityNode.knowledgeResourceIds.length === 0 ? (
              <Alert
                type="warning"
                message="该能力暂无关联的知识点"
                showIcon
              />
            ) : (
              <div>
                <Text strong style={{ marginBottom: 8, display: "block" }}>
                  关联的知识点（共 {selectedAbilityNode.knowledgeResourceIds.length} 个）
                </Text>
                <List
                  size="small"
                  bordered
                  dataSource={
                    subAbilitiesData
                      ?.flatMap((sub: any) =>
                        (sub.knowledgeResources || []).filter((kr: any) =>
                          selectedAbilityNode.knowledgeResourceIds.includes(kr.id),
                        ),
                      )
                      .filter((kr: any, index: number, arr: any[]) => arr.findIndex((k: any) => k.id === kr.id) === index) ||
                    []
                  }
                  renderItem={(item: any) => (
                    <List.Item
                      style={{ cursor: "pointer" }}
                      onClick={() => {
                        setSelectedKnowledgePoint({
                          id: item.id,
                          name: item.name,
                          description: item.description,
                        });
                        setSelectedAbilityNode(null);
                      }}
                    >
                      <Space>
                        <BookOutlined />
                        <Text>{item.name}</Text>
                      </Space>
                    </List.Item>
                  )}
                />
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function Page() {
  const [searchParams] = useSearchParams();
  const [courseId, setCourseId] = useState<string>(() => {
    const stored = localStorage.getItem("selectedCourse");
    return stored || "";
  });

  useEffect(() => {
    const courseIdParam = searchParams.get("courseId");
    if (courseIdParam) {
      setCourseId(courseIdParam);
      localStorage.setItem("selectedCourse", courseIdParam);
    }
  }, [searchParams]);

  return courseId ? (
    <StudentCompetencyGraphView courseId={courseId} />
  ) : (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
        background: "linear-gradient(135deg, #2573E6 0%, #4A90D9 50%, #7AB8F5 100%)",
        color: "white",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: 700, marginBottom: "1rem" }}>能力图谱</h1>
      <p style={{ fontSize: "1.2rem", opacity: 0.9 }}>请先选择一个课程以查看能力图谱</p>
    </div>
  );
}
