import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography,
  Spin,
  Alert,
  Button,
  Card,
  Empty,
  Select,
  Grid,
  Tag,
} from "antd";
import { listRelations } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getHeaders } from "@/utils/api-helpers";
import { getCurrentTenant } from "@/lib/tenant";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { useGraphCourse } from "@/hooks/use-graph-course";

const { Title, Text } = Typography;

const GRAPH_LABELS = {
  type: "类型",
  description: "描述",
  importance: "重要程度",
  subject: "主题",
  unit: "单元",
};

const KNOWLEDGE_TYPES: Record<string, string> = {
  subject: "学科",
  knowledge_unit: "知识单元",
  knowledge_cell: "知识点",
};

const IMPORTANCE_LEVELS: Record<string, string> = {
  normal: "一般",
  important: "重点",
  hard: "难点",
  simple: "简单",
  easy: "简单",
};

const CONNECTION_TYPES = {
  contain: "包含关系",
  order: "属序关系",
  related: "相关关系",
};

interface Course {
  id: string;
  title: string;
  description?: string;
}

interface KnowledgeResource {
  id: string;
  name: string;
  description?: string;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string;
  unit?: string;
  importanceLevel?: string;
  courseId: string;
  course?: Course;
  parentSubjectId?: string;
  parentUnitId?: string;
}

interface KnowledgeRelation {
  id: string;
  relationTypeId: string;
  sourceKnowledgeId: string;
  targetKnowledgeId: string;
  relationType: {
    id: string;
    name: string;
    displayName: string;
    description?: string;
  };
  sourceKnowledge: KnowledgeResource;
  targetKnowledge: KnowledgeResource;
}

interface GraphNode {
  id: string;
  name: string;
  category?: number;
  symbolSize?: number;
  value?: number;
  x?: number;
  y?: number;
  itemStyle?: {
    color?: string;
    borderColor?: string;
    borderWidth?: number;
  };
  label?: {
    show?: boolean;
    fontSize?: number;
    color?: string;
  };
  knowledgeData?: KnowledgeResource;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  category?: number;
  lineStyle?: {
    opacity?: number;
    width?: number;
    color?: string;
    curveness?: number;
  };
  relationData?: KnowledgeRelation;
}

interface TeacherGraphKnowledgeViewProps {
  courseId?: string;
}

export default function TeacherGraphKnowledgeView({
  courseId,
}: TeacherGraphKnowledgeViewProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const zoomRatio = useRef(1);
  const [zoomPercent, setZoomPercent] = useState(50);
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const { selectedCourseId } = useGraphCourse();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [selectedKnowledge, setSelectedKnowledge] =
    useState<KnowledgeResource | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRelationTypes, setSelectedRelationTypes] = useState<string[]>([]);
  // 右键菜单
  const [ctxMenuVisible, setCtxMenuVisible] = useState(false);
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 });
  const [ctxMenuNode, setCtxMenuNode] = useState<KnowledgeResource | null>(null);
  // 移动端 Popover
  const [mobilePopoverOpen, setMobilePopoverOpen] = useState(false);
  const [mobilePopoverNode, setMobilePopoverNode] = useState<KnowledgeResource | null>(null);
  const isMobileRef = useRef(isMobile);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);

  const effectiveCourseId = selectedCourseId || courseId;

  const {
    data: relationsData,
    isLoading: relationsLoading,
    error: relationsError,
  } = useQuery({
    queryKey: [
      "teacher-knowledge-graph",
      "relations",
      effectiveCourseId,
      currentTenant?.id,
    ],
    queryFn: async () => {
      if (!effectiveCourseId) return null;

      const result = await listRelations({
        tenant: currentTenant?.schemaName || "",
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          {
            relationType: ["id", "name", "displayName", "description"],
          },
          {
            sourceKnowledge: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "importanceLevel",
              "description",
              "courseId",
              "parentSubjectId",
              "parentUnitId",
            ],
          },
          {
            targetKnowledge: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "importanceLevel",
              "description",
              "courseId",
              "parentSubjectId",
              "parentUnitId",
            ],
          },
        ],
        filter: {
          or: [
            { sourceKnowledge: { courseId: { eq: effectiveCourseId } } },
            { targetKnowledge: { courseId: { eq: effectiveCourseId } } },
          ],
        },
        headers: getHeaders(user),
      });

      let relations: any[] = [];
      if (Array.isArray(result.data)) {
        relations = result.data;
      } else if (
        result.data &&
        typeof result.data === "object" &&
        "data" in result.data
      ) {
        relations = (result.data as any).data;
      } else if (
        result.data &&
        typeof result.data === "object" &&
        "results" in result.data
      ) {
        relations = (result.data as any).results;
      }

      const relationTypeMap = new Map<string, { name: string; displayName: string; color: string }>();
      const defaultColors = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"];
      
      const getCategoryName = (relation: KnowledgeRelation): string => {
        return relation.relationType?.displayName || relation.relationType?.name || "其他关系";
      };

      relations.forEach((relation: KnowledgeRelation, index: number) => {
        const categoryName = getCategoryName(relation);
        if (!relationTypeMap.has(categoryName)) {
          const colorIndex = relationTypeMap.size % defaultColors.length;
          relationTypeMap.set(categoryName, {
            name: categoryName,
            displayName: categoryName,
            color: defaultColors[colorIndex],
          });
        }
      });

      const categories = Array.from(relationTypeMap.values()).map(c => ({
        name: c.displayName,
        itemStyle: { color: c.color },
      }));

      const nodesMap = new Map<string, GraphNode>();
      const links: GraphLink[] = [];

      const getImportanceSize = (importanceLevel?: string): number => {
        if (!importanceLevel) return 20;
        switch (importanceLevel.toLowerCase()) {
          case "hard":
            return 35;
          case "important":
            return 28;
          case "normal":
            return 20;
          case "simple":
          case "easy":
            return 15;
          default:
            return 20;
        }
      };

      const getRelationTypeIndex = (relation: KnowledgeRelation): number => {
        const categoryName = getCategoryName(relation);
        const index = categories.findIndex(c => c.name === categoryName);
        return index >= 0 ? index : 0;
      };

      relations.forEach((relation: KnowledgeRelation, index: number) => {
        if (
          !nodesMap.has(relation.sourceKnowledgeId) &&
          relation.sourceKnowledge
        ) {
          const categoryIndex = getRelationTypeIndex(relation);
          nodesMap.set(relation.sourceKnowledgeId, {
            id: relation.sourceKnowledgeId,
            name: relation.sourceKnowledge.name,
            category: categoryIndex,
            symbolSize: getImportanceSize(
              relation.sourceKnowledge.importanceLevel,
            ),
            value: Math.random() * 100,
            itemStyle: {
              color: categories[categoryIndex].itemStyle.color,
              borderColor: "#fff",
              borderWidth: 2,
            },
            knowledgeData: relation.sourceKnowledge,
          });
        }

        if (
          !nodesMap.has(relation.targetKnowledgeId) &&
          relation.targetKnowledge
        ) {
          const categoryIndex = getRelationTypeIndex(relation);
          nodesMap.set(relation.targetKnowledgeId, {
            id: relation.targetKnowledgeId,
            name: relation.targetKnowledge.name,
            category: categoryIndex,
            symbolSize: getImportanceSize(
              relation.targetKnowledge.importanceLevel,
            ),
            value: Math.random() * 100,
            itemStyle: {
              color: categories[categoryIndex].itemStyle.color,
              borderColor: "#fff",
              borderWidth: 2,
            },
            knowledgeData: relation.targetKnowledge,
          });
        }

        const relationTypeIndex = getRelationTypeIndex(relation);

        // 获取关系类型的显示名称
        const relationLabel = relation.relationType?.displayName || relation.relationType?.name || "关联";

        links.push({
          source: relation.sourceKnowledgeId,
          target: relation.targetKnowledgeId,
          category: relationTypeIndex,
          lineStyle: {
            opacity: 0.6,
            width: 2,
            color: categories[relationTypeIndex].itemStyle.color,
            curveness: 0.1,
          },
          relationData: relation,
        });
      });

      const nodes = Array.from(nodesMap.values());

      return { nodes, links, categories };
    },
    enabled: !!effectiveCourseId && !!currentTenant && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const filteredRelationsData = useMemo(() => {
    if (!relationsData) return null;
    if (selectedRelationTypes.length === 0) return relationsData;

    const filteredLinks = relationsData.links?.filter((link: GraphLink) => {
      const relationTypeName = link.relationData?.relationType?.displayName || 
                              link.relationData?.relationType?.name || "";
      return selectedRelationTypes.includes(relationTypeName);
    }) || [];

    const filteredNodeIds = new Set<string>();
    filteredLinks.forEach((link: GraphLink) => {
      if (typeof link.source === "string") {
        filteredNodeIds.add(link.source);
      }
      if (typeof link.target === "string") {
        filteredNodeIds.add(link.target);
      }
    });

    const filteredNodes = relationsData.nodes?.filter((node: GraphNode) => 
      filteredNodeIds.has(node.id)
    ) || [];

    return {
      ...relationsData,
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [relationsData, selectedRelationTypes]);

  const handleRelationTypeFilterChange = (values: string[]) => {
    setSelectedRelationTypes(values);
  };

  const handleClearFilter = () => {
    setSelectedRelationTypes([]);
  };

  const handleNodeClick = (params: any) => {
    if (params.dataType === "node") {
      const nodeData = params.data as GraphNode;
      if (nodeData.knowledgeData) {
        if (isMobileRef.current) {
          params.event?.event?.preventDefault?.();
          setMobilePopoverNode(nodeData.knowledgeData);
          setMobilePopoverOpen(true);
        } else {
          setSelectedKnowledge(nodeData.knowledgeData);
          setDrawerOpen(true);
        }
      }
    }
    if (params.dataType === "edge") {
      const edgeData = params.data as GraphLink;
      if (edgeData.relationData?.relationType) {
        const relationTypeName = edgeData.relationData.relationType.displayName || 
                                  edgeData.relationData.relationType.name;
        setSelectedRelationTypes(prev => {
          if (!prev.includes(relationTypeName)) {
            return [relationTypeName];
          }
          return prev;
        });
      }
    }
  };

  // 右键菜单处理
  const handleContextMenu = (params: any) => {
    if (params.dataType === "node") {
      const nodeData = params.data as GraphNode;
      if (nodeData.knowledgeData) {
        params.event?.event?.preventDefault?.();
        setCtxMenuPos({ x: params.event.event?.clientX || 0, y: params.event.event?.clientY || 0 });
        setCtxMenuNode(nodeData.knowledgeData);
        setCtxMenuVisible(true);
      }
    }
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedKnowledge(null);
  };

  useEffect(() => {
    if (!filteredRelationsData || !chartRef.current) return;

    if (!filteredRelationsData.nodes || filteredRelationsData.nodes.length === 0) {
      console.warn("No nodes to display in the graph");
      return;
    }

    // 确保彻底清除旧实例，避免事件冲突导致拖拽失效
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }
    const existingInstance = echarts.getInstanceByDom(chartRef.current);
    if (existingInstance) {
      existingInstance.dispose();
    }
    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;

    chart.showLoading();

    // 基础字体大小配置
    const BASE_FONT_SIZES = {
      label: 11,
      emphasis: 12,
      edgeLabel: 9,
    };

    const getScaledFontSize = (baseSize: number) => {
      return Math.max(8, Math.round(baseSize * zoomRatio.current));
    };

    const option = {
      backgroundColor: "#ffffff",
      tooltip: {
        trigger: "item",
        triggerOn: "mousemove",
        hideDelay: 100,
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const data = params.data as GraphNode;
            const knowledgeData = data.knowledgeData;
            if (knowledgeData) {
              let content = `<strong>${data.name}</strong><br/>`;
              content += `${GRAPH_LABELS.type}: ${KNOWLEDGE_TYPES[knowledgeData.knowledgeType] || knowledgeData.knowledgeType}<br/>`;
              if (knowledgeData.subject)
                content += `${GRAPH_LABELS.subject}: ${knowledgeData.subject}<br/>`;
              if (knowledgeData.unit)
                content += `${GRAPH_LABELS.unit}: ${knowledgeData.unit}<br/>`;
              if (knowledgeData.importanceLevel)
                content += `${GRAPH_LABELS.importance}: ${IMPORTANCE_LEVELS[knowledgeData.importanceLevel.toLowerCase()] || knowledgeData.importanceLevel}<br/>`;
              if (knowledgeData.description) {
                content += `${GRAPH_LABELS.description}: ${knowledgeData.description.substring(0, 50)}${knowledgeData.description.length > 50 ? "..." : ""}`;
              }
              return content;
            }
            return data.name;
          }
          if (params.dataType === "edge") {
            const data = params.data as GraphLink;
            if (data.relationData?.relationType) {
              return (
                data.relationData.relationType.displayName ||
                data.relationData.relationType.name
              );
            }
            return CONNECTION_TYPES.related;
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
          data: filteredRelationsData.categories?.map((c: any) => c.name) || [],
          orient: "vertical",
          left: 50,
          top: 20,
          textStyle: {
            fontSize: 12,
            color: "#333",
          },
        },
      ],
      animation: true,
      animationDuration: 1500,
      animationEasingUpdate: "quinticInOut" as const,
      series: [
        {
          type: "graph",
          layout: "force",
          data: filteredRelationsData.nodes || [],
          links: filteredRelationsData.links || [],
          categories: filteredRelationsData.categories || [],
          roam: true,
          zoom: 0.5,
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
            hideOverlap: false,
            moveOverlap: "shiftY",
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
        },
      ],
    };

    chart.hideLoading();
    chart.setOption(option);
    chart.on("click", handleNodeClick);
    chart.on("contextmenu", handleContextMenu);

    // 监听缩放事件，实现字体缩放
    const handleMouseWheel = () => {
      if (!chartInstance.current) return;
      try {
        const opt = chartInstance.current.getOption();
        const seriesOption = (opt as any).series?.[0];
        if (seriesOption) {
          const currentZoom = seriesOption.zoom || 1;
          zoomRatio.current = currentZoom;
          setZoomPercent(Math.round(currentZoom * 100));

          chartInstance.current.setOption({
            series: [{
              label: {
                fontSize: getScaledFontSize(BASE_FONT_SIZES.label),
              },
              emphasis: {
                label: {
                  fontSize: getScaledFontSize(BASE_FONT_SIZES.emphasis),
                },
              },
            }],
          });

          updateGraphicLabels();
        }
      } catch (e) {
        // 静默处理
      }
    };

    chart.getZr().on('mousewheel', handleMouseWheel);

    // 使用 graphic 组件绘制边标签
    const updateGraphicLabels = () => {
      try {
        const seriesModel = (chart as any).getModel().getSeries()[0];
        if (!seriesModel) return;

        const data = seriesModel.getData();
        if (!data || !data._itemLayouts) return;

        // 获取节点位置
        const nodePositions: Record<string, { x: number; y: number }> = {};
        for (let i = 0; i < data._itemLayouts.length; i++) {
          const layout = data._itemLayouts[i];
          const itemModel = data.getItemModel(i);
          const name = itemModel.get('name');
          if (name) {
            nodePositions[name] = { x: layout.x, y: layout.y };
          }
        }

        // 使用 filteredRelationsData 创建标签
        const graphicElements: any[] = [];
        if (filteredRelationsData?.links) {
          filteredRelationsData.links.forEach((link: any, idx: number) => {
            const sourcePos = nodePositions[link.source];
            const targetPos = nodePositions[link.target];
            if (sourcePos && targetPos) {
              const midX = (sourcePos.x + targetPos.x) / 2;
              const midY = (sourcePos.y + targetPos.y) / 2;
              const label = link.relationData?.relationType?.displayName ||
                           link.relationData?.relationType?.name || "关联";

              graphicElements.push({
                type: 'text',
                id: `edge_label_${idx}`,
                position: [midX, midY],
                silent: true,
                style: {
                  text: label,
                  fontSize: getScaledFontSize(BASE_FONT_SIZES.edgeLabel),
                  fill: '#666',
                  backgroundColor: 'rgba(255,255,255,0.7)',
                  padding: [1, 3],
                  borderRadius: 2,
                },
                z: 50,
              });
            }
          });
        }

        if (graphicElements.length > 0) {
          chart.setOption({
            graphic: {
              elements: graphicElements
            }
          });
        }
      } catch (e) {
        // 静默处理
      }
    };

    // 延迟执行，等待布局完成
    setTimeout(updateGraphicLabels, 1500);

    // 监听节点拖动事件来更新标签
    const updateLabelsOnDrag = () => {
      updateGraphicLabels();
    };
    chart.on('drag', updateLabelsOnDrag);
    chart.on('dragend', updateLabelsOnDrag);
    chart.on('dataZoom', updateLabelsOnDrag);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener("resize", handleResize);

    const resizeObserver = new ResizeObserver(() => {
      chart.resize();
    });
    if (chartRef.current) {
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      chart.getZr().off('mousewheel', handleMouseWheel);
      chart.dispose();
    };
  }, [relationsData, selectedRelationTypes]);

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
          message="用户未登录，请登录以访问知识图谱。"
          style={{ borderRadius: 12 }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        backgroundColor: "#fff",
      }}
    >
      <div
        style={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            minHeight: isMobile ? 36 : 48,
            padding: isMobile ? "3px 6px" : "4px 16px",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 4 : 12,
            backgroundColor: "white",
            borderBottom: "1px solid #e5e7eb",
            flexShrink: 0,
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          {relationsData && relationsData.categories && relationsData.categories.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 12, flexShrink: 0 }}>
              <Select
                mode="multiple"
                placeholder="选择关系类型"
                style={{ width: isMobile ? 140 : 180 }}
                value={selectedRelationTypes}
                onChange={handleRelationTypeFilterChange}
                options={relationsData.categories.map((cat: any) => ({
                  label: cat.name,
                  value: cat.name,
                }))}
                allowClear
              />
              {selectedRelationTypes.length > 0 && (
                <Button size="small" onClick={handleClearFilter}>
                  清除筛选
                </Button>
              )}
            </div>
          )}
          <div style={{ flex: 1, minWidth: isMobile ? 0 : undefined }} />
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 4 }}>
            <span style={{ color: "#666", fontSize: isMobile ? 10 : 12, padding: isMobile ? "0 2px" : undefined }}>{zoomPercent}%</span>
            {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
              <button key={label as string} onClick={() => {
                if (!chartInstance.current) return;
                try {
                  const opt = chartInstance.current.getOption() as any;
                  const cur = opt?.series?.[0]?.zoom || 0.5;
                  const next = val === "reset" ? 0.5 : Math.max(0.1, Math.min(3, cur + (val as number)));
                  chartInstance.current.setOption({ series: [{ zoom: next }] });
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

        {(relationsError || (relationsLoading && effectiveCourseId)) && (
          <div style={{ padding: "8px 16px" }}>
            {relationsError && (
              <Alert
                type="error"
                message={`加载知识关系时出错: ${relationsError instanceof Error ? relationsError.message : "未知错误"}`}
                style={{ marginBottom: 8 }}
              />
            )}

            {relationsLoading && effectiveCourseId && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, justifyContent: "center" }}>
                <Spin />
                <Text type="secondary">正在加载知识关系...</Text>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            flexGrow: 1,
            position: "relative",
          }}
        >
          {!effectiveCourseId ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "white",
              }}
            >
              <Empty description="请选择一个课程来查看知识关系图谱" />
            </div>
          ) : filteredRelationsData && filteredRelationsData.nodes?.length > 0 ? (
            <div
              ref={chartRef}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "white",
                overflow: "hidden",
              }}
            />
          ) : filteredRelationsData && filteredRelationsData.nodes?.length === 0 ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "white",
              }}
            >
              <Empty description="该课程暂无知识关系数据" />
            </div>
          ) : null}

          {drawerOpen && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                backgroundColor: "#e6f7ff",
                color: "#1890ff",
                padding: "4px 16px",
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 500,
                boxShadow: "0 2px 8px rgba(24, 144, 255, 0.2)",
              }}
            >
              资源面板已展开
            </div>
          )}
        </div>
      </div>

      {/* 右键菜单 */}
      {ctxMenuVisible && ctxMenuNode && (
        <>
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, inset: 0, zIndex: 999 }} onClick={() => setCtxMenuVisible(false)} />
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
                setSelectedKnowledge(ctxMenuNode);
                setDrawerOpen(true);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              查看知识点详情
            </div>
          </div>
        </>
      )}

      {/* 移动端底部弹出 */}
      {isMobile && mobilePopoverOpen && mobilePopoverNode && (
        <>
          <div
            style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, inset: 0, zIndex: 999, background: "rgba(0,0,0,0.3)" }}
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
                  setSelectedKnowledge(mobilePopoverNode);
                  setDrawerOpen(true);
                }}
                style={{ borderRadius: 10, height: 48, fontSize: 15 }}
              >
                查看知识点详情
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
        open={drawerOpen}
        onClose={handleCloseDrawer}
        knowledge={selectedKnowledge}
      />
    </div>
  );
}
