import * as React from "react";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Typography,
  Row,
  Col,
  Tag,
  Spin,
  Tooltip,
  Button,
  Switch,
  Table,
  Input,
  Empty,
  Grid,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BulbOutlined,
  ReadOutlined,
  StarOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  TrophyOutlined,
  DownOutlined,
  RightOutlined,
  PlusOutlined,
  MinusOutlined,
  AppstoreOutlined,
  TagOutlined,
  PercentageOutlined,
  FundOutlined,
} from "@ant-design/icons";
import * as echarts from "echarts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listKnowledges, buildCSRFHeaders } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";

const { Text } = Typography;

const COGNITIVE_LEVELS = [
  { id: "记忆", name: "记忆", color: "#4CAF50", icon: <BulbOutlined />, description: "回忆事实和基本概念" },
  { id: "理解", name: "理解", color: "#2196F3", icon: <ReadOutlined />, description: "解释意义和概念" },
  { id: "应用", name: "应用", color: "#FF9800", icon: <StarOutlined />, description: "在情境中使用信息" },
  { id: "分析", name: "分析", color: "#9C27B0", icon: <SearchOutlined />, description: "分解信息并发现关系" },
  { id: "评价", name: "评价", color: "#F44336", icon: <CheckCircleOutlined />, description: "判断和决策" },
  { id: "创造", name: "创造", color: "#795548", icon: <TrophyOutlined />, description: "产生新想法或产品" },
];

interface KnowledgeRow {
  id: string;
  name: string;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string | null;
  unit?: string | null;
  dimension: string | null;
  courseId: string;
  sortPath?: string | null;
  children?: KnowledgeRow[];
}

function extractArrayData(result: any): any[] {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (result?.success && result.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
    if ("data" in result.data && Array.isArray(result.data.data))
      return result.data.data;
  }
  if (result?.data) {
    if (Array.isArray(result.data)) return result.data;
    if ("results" in result.data && Array.isArray(result.data.results))
      return result.data.results;
  }
  return [];
}

function CognitiveDistributionChart({ data, totalCount }: { data: { name: string; value: number; color: string }[]; totalCount: number }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    const funnelData = [...data].reverse().map((item) => ({
      value: item.value || 1,
      name: item.name,
      itemStyle: { color: item.color },
    }));

    const maxValue = Math.max(...data.map((d) => d.value), 1);

    const option = {
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const item = data.find((d) => d.name === params.name);
          const percent = totalCount > 0 ? Math.round((item?.value || 0) / totalCount * 100) : 0;
          return `<strong>${params.name}</strong><br/>知识点数: ${item?.value || 0}<br/>占比: ${percent}%`;
        },
      },
      legend: {
        orient: "vertical" as const,
        right: 10,
        top: "center",
        formatter: (name: string) => {
          const item = data.find((d) => d.name === name);
          return `${name}: ${item?.value || 0}`;
        },
      },
      series: [
        {
          name: "认知目标金字塔",
          type: "funnel" as const,
          left: "10%",
          top: 30,
          bottom: 30,
          width: "55%",
          min: 0,
          max: maxValue,
          minSize: "20%",
          maxSize: "100%",
          sort: "ascending" as const,
          gap: 2,
          label: {
            show: true,
            position: "inside" as const,
            formatter: "{b}",
            color: "#fff",
            fontWeight: "bold",
          },
          labelLine: {
            length: 10,
            lineStyle: { width: 1, type: "solid" as const },
          },
          itemStyle: {
            borderColor: "#fff",
            borderWidth: 1,
          },
          emphasis: {
            label: { fontSize: 14 },
          },
          data: funnelData,
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data, totalCount]);

  return <div ref={chartRef} style={{ width: "100%", height: 320 }} />;
}

function CognitivePieChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    const chartData = data.filter((item) => item.value > 0);
    const total = chartData.reduce((sum, item) => sum + item.value, 0);

    const option = {
      tooltip: {
        trigger: "item",
        formatter: (params: any) => {
          const percent = total > 0 ? Math.round((params.value / total) * 100) : 0;
          return `<strong>${params.name}</strong><br/>数量: ${params.value}<br/>占比: ${percent}%`;
        },
      },
      legend: {
        orient: "vertical" as const,
        right: 10,
        top: "center",
        formatter: (name: string) => {
          const item = chartData.find((d) => d.name === name);
          return `${name}: ${item?.value || 0}`;
        },
      },
      series: [
        {
          name: "认知目标分布",
          type: "pie" as const,
          radius: ["40%", "70%"],
          center: ["40%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: "{b}: {c}",
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: "bold",
            },
          },
          labelLine: {
            show: true,
          },
          data: chartData.map((item) => ({
            value: item.value,
            name: item.name,
            itemStyle: { color: item.color },
          })),
        },
      ],
    };

    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [data]);

  return <div ref={chartRef} style={{ width: "100%", height: 320 }} />;
}

export default function StudentKnowledgeCognitiveGoals() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const [searchParams] = useSearchParams();
  const urlCourseId = searchParams.get("courseId");
  const urlTenant = searchParams.get("tenant");
  const tenant = urlTenant || currentTenant?.schemaName || "";
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    return urlCourseId || localStorage.getItem("selectedCourse") || "";
  });
  const [showAllDimensioned, setShowAllDimensioned] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [showOnlyDimensioned, setShowOnlyDimensioned] = useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  const hasInitializedCourse = useRef(false);

  useEffect(() => {
    if (!selectedCourseId && hasInitializedCourse.current === false) {
      const storedCourseId = localStorage.getItem("selectedCourse");
      if (storedCourseId) {
        hasInitializedCourse.current = true;
        setSelectedCourseId(storedCourseId);
      }
    }
  }, [selectedCourseId]);

  // 同步前台 ?courseId=xxx 跳转（与 front 的知识体系面板保持一致）
  useEffect(() => {
    if (urlCourseId && urlCourseId !== selectedCourseId) {
      setSelectedCourseId(urlCourseId);
      localStorage.setItem("selectedCourse", urlCourseId);
    }
  }, [urlCourseId]);

  const handleCourseChange = (value: string) => {
    queryClient.invalidateQueries({ queryKey: ["student-knowledges-hierarchy"] });
    queryClient.removeQueries({ queryKey: ["student-knowledges-hierarchy"] });
    setSelectedCourseId(value);
    setSearchText("");
    setShowOnlyDimensioned(false);
    localStorage.setItem("selectedCourse", value);
  };

  const { data: knowledgesData = [], isLoading, refetch } = useQuery({
    queryKey: ["student-knowledges-hierarchy", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId || !tenant || !user) return [];

      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${tenant}`,
        { headers: { ...buildCSRFHeaders(), ...getHeaders(user) } },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
      }

      const result = await response.json();
      if (result && typeof result === "object" && Array.isArray(result.data)) {
        return result.data;
      } else if (Array.isArray(result)) {
        return result;
      }
      return [];
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const currentCourseName = useMemo(() => {
    return localStorage.getItem("selectedCourseName") || "当前课程";
  }, []);

  const typeMap = {
    subject: "主题",
    knowledge_unit: "单元",
    knowledge_cell: "知识点",
  };

  const processedRows = useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];

    const flattenAndTransform = (nodes: any[], seenIds: Set<string> = new Set()): KnowledgeRow[] => {
      const result: KnowledgeRow[] = [];
      
      nodes.forEach((node: any) => {
        if (seenIds.has(node.id)) return;
        seenIds.add(node.id);
        
        const row: KnowledgeRow = {
          id: node.id,
          name: node.name,
          knowledgeType: node.knowledgeType,
          subject: node.subject,
          unit: node.unit,
          dimension: node.dimension,
          courseId: node.courseId,
          sortPath: node.sortPath,
          children: [],
        };
        
        const childArrays = [
          node.childUnits,
          node.directCells,
          node.subjectCells,
          node.childCells,
          node.nestedChildCells,
        ];
        
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) {
            row.children = row.children || [];
            row.children.push(...flattenAndTransform(children, seenIds));
          }
        });
        
        if (row.children && row.children.length === 0) {
          delete row.children;
        }
        
        result.push(row);
      });
      
      return result;
    };

    return flattenAndTransform(knowledgesData);
  }, [knowledgesData]);

  const filterTreeNodes = (nodes: KnowledgeRow[], searchLower: string, showOnlyDim: boolean): KnowledgeRow[] => {
    const result: KnowledgeRow[] = [];
    nodes.forEach((node) => {
      const matchesSearch = !searchLower || 
        node.name.toLowerCase().includes(searchLower) ||
        (node.subject && node.subject.toLowerCase().includes(searchLower)) ||
        (node.unit && node.unit.toLowerCase().includes(searchLower));
      
      const matchesDimension = !showOnlyDim || node.dimension;
      
      const filteredChildren = node.children ? filterTreeNodes(node.children, searchLower, showOnlyDim) : [];
      
      if (matchesSearch && matchesDimension) {
        result.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      } else if (filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    });
    return result;
  };

  const filteredRows = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    return filterTreeNodes(processedRows, searchLower, showOnlyDimensioned);
  }, [processedRows, searchText, showOnlyDimensioned]);

  useEffect(() => {
    if (filteredRows.length === 0) return;
    
    const getFirstLevelParentIds = (nodes: KnowledgeRow[]): string[] => {
      const ids: string[] = [];
      nodes.forEach((node) => {
        if (node.children && node.children.length > 0) {
          ids.push(node.id);
        }
      });
      return ids;
    };
    const firstLevelIds = getFirstLevelParentIds(filteredRows);
    setExpandedRowKeys(firstLevelIds);
  }, [knowledgesData]);

  const countAllNodes = (nodes: KnowledgeRow[]): number => {
    let count = 0;
    nodes.forEach((node) => {
      count += 1;
      if (node.children) {
        count += countAllNodes(node.children);
      }
    });
    return count;
  };

  const filteredRowCount = useMemo(() => countAllNodes(filteredRows), [filteredRows]);

  const cognitiveStats = useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return { total: 0, dimensioned: 0, percentage: 0 };

    const allNodes: any[] = [];
    const seenIds = new Set<string>();
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        allNodes.push(item);
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    const total = allNodes.length;
    const dimensioned = allNodes.filter((k) => k.dimension).length;
    const percentage = total > 0 ? Math.round((dimensioned / total) * 100) : 0;

    return { total, dimensioned, percentage };
  }, [knowledgesData]);

  const cognitiveDistribution = useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];

    const allNodes: any[] = [];
    const seenIds = new Set<string>();
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        allNodes.push(item);
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    return COGNITIVE_LEVELS.map((level) => ({
      ...level,
      count: allNodes.filter((k) => k.dimension === level.id).length,
    }));
  }, [knowledgesData]);

  const chartData = useMemo(() => {
    return COGNITIVE_LEVELS.map((level) => ({
      name: level.name,
      value: cognitiveDistribution.find(d => d.id === level.id)?.count || 0,
      color: level.color,
    }));
  }, [cognitiveDistribution]);

  const dimensionedKnowledges = useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];
    
    const result: KnowledgeRow[] = [];
    const seenIds = new Set<string>();
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        if (item.dimension) {
          result.push({
            id: item.id,
            name: item.name,
            knowledgeType: item.knowledgeType,
            subject: item.subject,
            unit: item.unit,
            dimension: item.dimension,
            courseId: item.courseId,
            sortPath: item.sortPath,
          });
        }
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);
    
    return result;
  }, [knowledgesData]);

  const subjectDistribution = useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];
    
    const subjectCounts: Record<string, number> = {};
    const seenIds = new Set<string>();
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);
        const subject = item.subject || "其他";
        subjectCounts[subject] = (subjectCounts[subject] || 0) + 1;
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    return Object.entries(subjectCounts).map(([subject, count]) => ({ subject, count }));
  }, [knowledgesData]);

  const displayedDimensionedKnowledges = useMemo(() => {
    if (showAllDimensioned) return dimensionedKnowledges;
    return dimensionedKnowledges.slice(0, 5);
  }, [dimensionedKnowledges, showAllDimensioned]);

  useEffect(() => {
    if (filteredRows.length > 0 && expandedRowKeys.length === 0) {
      const getAllParentIds = (nodes: KnowledgeRow[]): string[] => {
        const ids: string[] = [];
        nodes.forEach((node) => {
          if (node.children && node.children.length > 0) {
            ids.push(node.id);
            ids.push(...getAllParentIds(node.children));
          }
        });
        return ids;
      };
      const allParentIds = getAllParentIds(filteredRows);
      setExpandedRowKeys(allParentIds);
    }
  }, [filteredRows]);

  const handleExpand = (expanded: boolean, record: KnowledgeRow) => {
    if (expanded) {
      setExpandedRowKeys((prev) => {
        if (prev.includes(record.id)) return prev;
        return [...prev, record.id];
      });
    } else {
      setExpandedRowKeys((prev) => prev.filter((key) => key !== record.id));
    }
  };

  const renderDimensionCell = (record: KnowledgeRow, level: typeof COGNITIVE_LEVELS[0]) => {
    const hasDimension = record.dimension === level.id;

    if (!hasDimension) {
      return (
        <div
          style={{
            width: 36,
            height: 36,
            border: "2px dashed #d9d9d9",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto",
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
        </div>
      );
    }

    return (
      <Tooltip title={`该知识点已设置为 ${level.name} 维度`}>
        <div
          style={{
            width: 36,
            height: 36,
            backgroundColor: level.color,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            margin: "0 auto",
          }}
        >
          <span style={{ fontSize: 16, color: "white" }}>✓</span>
          <span
            style={{
              position: "absolute",
              bottom: -2,
              right: -2,
              backgroundColor: "white",
              color: level.color,
              borderRadius: "50%",
              width: 14,
              height: 14,
              fontSize: 9,
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          >
            {COGNITIVE_LEVELS.findIndex((l) => l.id === level.id) + 1}
          </span>
        </div>
      </Tooltip>
    );
  };

  const columns: ColumnsType<KnowledgeRow> = [
    {
      title: "知识点",
      dataIndex: "name",
      key: "name",
      width: 320,
      render: (text: string, record: KnowledgeRow) => {
        const typeMap = {
          subject: "学科",
          knowledge_unit: "单元",
          knowledge_cell: "知识点",
        };

        const isExpanded = expandedRowKeys.includes(record.id);
        const hasChildren = !!(record.children && record.children.length > 0);
        const indentSize = record.knowledgeType === "subject" ? 0 : record.knowledgeType === "knowledge_unit" ? 24 : 48;

        const handleToggleExpand = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (hasChildren) {
            if (isExpanded) {
              setExpandedRowKeys((prev) => prev.filter((key) => key !== record.id));
            } else {
              setExpandedRowKeys((prev) => {
                if (prev.includes(record.id)) return prev;
                return [...prev, record.id];
              });
            }
          }
        };

        return (
          <div style={{ paddingLeft: indentSize }}>
            <div style={{ display: "inline-flex", alignItems: "center", maxWidth: "100%" }}>
              {hasChildren ? (
                <span
                  style={{
                    cursor: "pointer",
                    fontSize: 14,
                    userSelect: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    backgroundColor: "#fafafa",
                    marginRight: 4,
                  }}
                  onClick={handleToggleExpand}
                >
                  {isExpanded ? (
                    <MinusOutlined style={{ fontSize: 10 }} />
                  ) : (
                    <PlusOutlined style={{ fontSize: 10 }} />
                  )}
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 20,
                    height: 20,
                    marginRight: 4,
                  }}
                />
              )}
              <Tooltip title={text} mouseEnterDelay={0.3}>
                <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</Text>
              </Tooltip>
              <Tag color="blue" style={{ marginLeft: 8, flexShrink: 0 }}>{typeMap[record.knowledgeType]}</Tag>
              {record.dimension && (
                <Tag color={COGNITIVE_LEVELS.find((l) => l.id === record.dimension)?.color} style={{ marginLeft: 4, flexShrink: 0 }}>
                  {COGNITIVE_LEVELS.find((l) => l.id === record.dimension)?.name || record.dimension}
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    ...COGNITIVE_LEVELS.map((level) => ({
      title: level.name,
      dataIndex: level.id,
      key: level.id,
      width: 80,
      align: "center" as const,
      render: (_: unknown, record: KnowledgeRow) => renderDimensionCell(record, level),
    })),
  ];

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  // 统计卡片配置
  const statsCards = [
    { label: "知识点总数", value: cognitiveStats.total, icon: <AppstoreOutlined />, bg: "rgba(37, 115, 230, 0.08)", color: colors.primary },
    { label: "已设维度", value: cognitiveStats.dimensioned, icon: <TagOutlined />, bg: "rgba(82, 196, 26, 0.08)", color: "#389e0d" },
    { label: "目标覆盖率", value: `${cognitiveStats.percentage}%`, icon: <PercentageOutlined />, bg: "rgba(250, 173, 20, 0.08)", color: cognitiveStats.percentage >= 80 ? "#389e0d" : cognitiveStats.percentage >= 50 ? colors.primary : "#cf1322" },
    { label: "认知层级", value: cognitiveDistribution.length, icon: <BulbOutlined />, bg: "rgba(114, 46, 209, 0.08)", color: "#722ed1" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.pageBg, overflow: "hidden" }}>
      {/* 统计卡片 */}
      <div style={{ padding: isMobile ? "12px 8px 0" : "16px 20px 0", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 6 : 10, marginBottom: isMobile ? 10 : 14 }}>
          {statsCards.map((item) => (
            <div
              key={item.label}
              style={{
                background: item.bg,
                borderRadius: 12,
                padding: isMobile ? "8px 10px" : "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: isMobile ? 8 : 12,
              }}
            >
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}
              >
                {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: 18, color: item.color } })}
              </div>
              <div>
                <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 700, lineHeight: 1.15, color: "#191c1d" }}>{item.value}</div>
                <div style={{ fontSize: 12, color: "#757780", fontWeight: 500 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 认知层级条 */}
        {cognitiveStats.total > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr 1fr 1fr", gap: isMobile ? 4 : 6, marginBottom: isMobile ? 10 : 14 }}>
            {COGNITIVE_LEVELS.map((level) => {
              const count = cognitiveDistribution.find(d => d.id === level.id)?.count || 0;
              return (
                <div
                  key={level.id}
                  style={{
                    background: "#fff",
                    borderRadius: 8,
                    padding: isMobile ? "6px 8px" : "8px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: level.color,
                    flexShrink: 0,
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, color: "#757780", fontWeight: 600 }}>{level.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: level.color, lineHeight: 1.2 }}>{count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 图表 + 表格区域 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: isMobile ? "0 8px 16px" : "0 20px 16px" }}>
        {!selectedCourseId ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
            <div style={{ textAlign: "center", padding: 48, borderRadius: 16, background: "#fff", boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)", maxWidth: 360 }}>
              <div
                style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: `${colors.primary}10`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                <BulbOutlined style={{ fontSize: 32, color: colors.primary }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d", marginBottom: 6 }}>请先选择一个课程</div>
              <div style={{ color: "#757780" }}>选择课程后将显示该课程的认知目标数据</div>
            </div>
          </div>
        ) : (
          <>
            {/* 图表行 */}
            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col xs={24} md={12}>
                <div style={{
                  borderRadius: 12, background: "#fff", padding: 16,
                  boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)", height: "100%",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#191c1d", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <FundOutlined style={{ color: colors.primary, fontSize: 14 }} />
                    认知目标层级
                  </div>
                  <CognitiveDistributionChart data={chartData} totalCount={dimensionedKnowledges.length} />
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div style={{
                  borderRadius: 12, background: "#fff", padding: 16,
                  boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)", height: "100%",
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#191c1d", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <TagOutlined style={{ color: "#389e0d", fontSize: 14 }} />
                    认知目标分布
                  </div>
                  <CognitivePieChart data={chartData} />
                </div>
              </Col>
            </Row>

            {/* 知识点表格 */}
            <div style={{
              borderRadius: 12, background: "#fff",
              boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)", marginBottom: 12,
            }}>
              <div
                style={{
                  padding: isMobile ? "10px" : "12px 16px",
                  display: "flex",
                  flexDirection: isMobile ? "column" : "row",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "stretch" : "center",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Input
                    placeholder="搜索知识点"
                    prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                    allowClear
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: isMobile ? "100%" : 260, borderRadius: 8 }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Switch
                      checked={showOnlyDimensioned}
                      onChange={(checked) => setShowOnlyDimensioned(checked)}
                      size="small"
                    />
                    <Text style={{ fontSize: 13, color: "#757780" }}>
                      只显示已设维度
                    </Text>
                    {showOnlyDimensioned && (
                      <Tag color="green" style={{ marginLeft: 4 }}>
                        {dimensionedKnowledges.length}
                      </Tag>
                    )}
                  </div>
                </div>
                <Text style={{ fontSize: 12, color: "#757780" }}>
                  共 {filteredRowCount} 条
                </Text>
              </div>
              {filteredRows.length > 0 ? (
                <Table
                  columns={columns}
                  dataSource={filteredRows}
                  rowKey="id"
                  loading={isLoading}
                  pagination={false}
                  scroll={{ x: isMobile ? 700 : 1000, y: isMobile ? 300 : 400 }}
                  expandable={{
                    expandedRowKeys,
                    onExpand: handleExpand,
                    indentSize: 0,
                    showExpandColumn: false,
                  }}
                />
              ) : (
                <div style={{ padding: 32, textAlign: "center" }}>
                  <Empty description="暂无知识点数据" />
                </div>
              )}
            </div>

            {/* 已设维度知识点标签 */}
            {dimensionedKnowledges.length > 0 && (
              <div style={{
                borderRadius: 12, background: "#fff", padding: 16,
                boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#191c1d", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <TagOutlined style={{ color: "#389e0d", fontSize: 14 }} />
                  已设置认知维度的知识点
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {displayedDimensionedKnowledges.map((knowledge) => {
                    const level = COGNITIVE_LEVELS.find((l) => l.id === knowledge.dimension);
                    return (
                      <Tag key={knowledge.id} color={level?.color} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 13 }}>
                        {knowledge.name} ({level?.name})
                      </Tag>
                    );
                  })}
                </div>
                {dimensionedKnowledges.length > 5 && (
                  <div style={{ marginTop: 12, textAlign: "center" }}>
                    <Button
                      type="link"
                      onClick={() => setShowAllDimensioned(!showAllDimensioned)}
                      icon={showAllDimensioned ? <RightOutlined /> : <DownOutlined />}
                    >
                      {showAllDimensioned
                        ? "收起"
                        : `显示更多 (${dimensionedKnowledges.length - 5} 个)`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
