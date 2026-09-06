import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Typography,
  Card,
  Tag,
  Spin,
  Tooltip,
  Row,
  Col,
  message,
  Select,
  Input,
  Switch,
  Statistic,
  Progress,
  Table,
  Space,
  Empty,
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
} from "@ant-design/icons";
import * as echarts from "echarts";
import {
  listKnowledges,
  updateResource,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { useCourses } from "@/hooks/use-courses";

const { Text, Title } = Typography;

const COGNITIVE_LEVELS = [
  {
    id: "记忆",
    name: "记忆",
    color: "#4CAF50",
    icon: <BulbOutlined />,
    description: "回忆事实和基本概念",
  },
  {
    id: "理解",
    name: "理解",
    color: "#2196F3",
    icon: <ReadOutlined />,
    description: "解释意义和概念",
  },
  {
    id: "应用",
    name: "应用",
    color: "#FF9800",
    icon: <StarOutlined />,
    description: "在情境中使用信息",
  },
  {
    id: "分析",
    name: "分析",
    color: "#9C27B0",
    icon: <SearchOutlined />,
    description: "分解信息并发现关系",
  },
  {
    id: "评价",
    name: "评价",
    color: "#F44336",
    icon: <CheckCircleOutlined />,
    description: "判断和决策",
  },
  {
    id: "创造",
    name: "创造",
    color: "#795548",
    icon: <TrophyOutlined />,
    description: "产生新想法或产品",
  },
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
  parentId?: string | null;
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

export default function KnowledgeCognitiveGoals() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const { canEdit } = useEditPermission();

  const [selectedCourseId, setSelectedCourseId] = React.useState<string>("");
  const [showAllDimensioned, setShowAllDimensioned] = React.useState(false);
  const [searchText, setSearchText] = React.useState<string>("");
  const [showOnlyDimensioned, setShowOnlyDimensioned] = React.useState(false);
  const [expandedRowKeys, setExpandedRowKeys] = React.useState<React.Key[]>([]);

  const handleCourseSelect = (courseId: string | undefined) => {
    const id = courseId || "";
    setSelectedCourseId(id);
    setSearchText("");
    setShowOnlyDimensioned(false);
  };

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });
  const courses = coursesData;

  const {
    data: knowledgesData,
    isLoading: knowledgesLoading,
    refetch,
  } = useQuery({
    queryKey: ["knowledges-hierarchy", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${tenant}`,
        { headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } },
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
    staleTime: 5 * 60 * 1000,
  });

  const updateDimensionMutation = useMutation({
    mutationFn: async ({
      knowledgeId,
      dimension,
      knowledgeName,
    }: {
      knowledgeId: string;
      dimension: string | null;
      knowledgeName: string;
    }) => {
      const result = await updateResource({
        tenant,
        primaryKey: knowledgeId,
        input: { name: knowledgeName, dimension },
        fields: ["id", "name", "dimension"],
        headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } as Record<
          string,
          string
        >,
      });

      if (!result.success) {
        throw new Error(
          (result as any).errors?.[0]?.message || "Failed to update dimension",
        );
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["knowledges-hierarchy"],
      });
      message.success("认知维度更新成功！");
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  const knowledgeBySubject = React.useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return {};

    const grouped: { [subject: string]: KnowledgeRow[] } = {};
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        const row: KnowledgeRow = {
          id: item.id,
          name: item.name,
          knowledgeType: item.knowledgeType,
          subject: item.subject,
          unit: item.unit,
          dimension: item.dimension,
          courseId: item.courseId,
          sortPath: item.sortPath,
        };
        const subject = row.subject || "未分类";
        if (!grouped[subject]) {
          grouped[subject] = [];
        }
        grouped[subject].push(row);
        
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    return grouped;
  }, [knowledgesData]);

  const dimensionedKnowledges = React.useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];
    
    const result: KnowledgeRow[] = [];
    const flatten = (items: any[]) => {
      items.forEach((item) => {
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
        childArrays.forEach((children: any) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);
    
    return result;
  }, [knowledgesData]);

  const cognitiveDistribution = React.useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];

    const allNodes: any[] = [];
    const seenIds = new Set<string>();
    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);

        allNodes.push(item);
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    const distribution = COGNITIVE_LEVELS.map((level) => ({
      ...level,
      count: allNodes.filter((k) => k.dimension === level.id).length,
    }));

    return distribution;
  }, [knowledgesData]);

  const knowledgeStats = React.useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) {
      return { total: 0, dimensioned: 0, dimensionTypes: 0, bySubject: {}, percentage: 0 };
    }

    const allNodes: any[] = [];
    const bySubject: { [subject: string]: number } = {};
    const dimensionTypes = new Set<string>();
    const seenIds = new Set<string>();

    const flatten = (items: any[]) => {
      items.forEach((item) => {
        if (seenIds.has(item.id)) return;
        seenIds.add(item.id);

        allNodes.push(item);
        const subject = item.subject || "未分类";
        bySubject[subject] = (bySubject[subject] || 0) + 1;
        if (item.dimension) {
          dimensionTypes.add(item.dimension);
        }
        const childArrays = [
          item.childUnits,
          item.directCells,
          item.subjectCells,
          item.childCells,
          item.nestedChildCells,
        ];
        childArrays.forEach((children: any) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(knowledgesData);

    const total = allNodes.length;
    const dimensioned = allNodes.filter((k) => k.dimension).length;
    const percentage = total > 0 ? Math.round((dimensioned / total) * 100) : 0;

    return { total, dimensioned, dimensionTypes: dimensionTypes.size, bySubject, percentage };
  }, [knowledgesData]);

  const displayedDimensionedKnowledges = React.useMemo(() => {
    if (showAllDimensioned) return dimensionedKnowledges;
    return dimensionedKnowledges.slice(0, 5);
  }, [dimensionedKnowledges, showAllDimensioned]);

  const processedRows = React.useMemo(() => {
    if (!knowledgesData || !Array.isArray(knowledgesData)) return [];

    const seenIds = new Set<string>();
    const flattenAndTransform = (nodes: any[]): KnowledgeRow[] => {
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
            row.children.push(...flattenAndTransform(children));
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

  const filteredRows = React.useMemo(() => {
    if (!processedRows) return [];
    
    const searchLower = searchText.trim().toLowerCase();
    return filterTreeNodes(processedRows, searchLower, showOnlyDimensioned);
  }, [processedRows, searchText, showOnlyDimensioned]);

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

  const filteredRowCount = React.useMemo(() => countAllNodes(filteredRows), [filteredRows]);

  const handleDimensionClick = (
    knowledgeId: string,
    knowledgeName: string,
    dimension: string | null,
  ) => {
    updateDimensionMutation.mutate({
      knowledgeId,
      knowledgeName,
      dimension,
    });
  };

  const renderDimensionCell = (
    record: KnowledgeRow,
    level: (typeof COGNITIVE_LEVELS)[0],
  ) => {
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
            cursor: "pointer",
            margin: "0 auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!canEdit) return;
            handleDimensionClick(record.id, record.name, level.id);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = level.color;
            e.currentTarget.style.backgroundColor = "#f5f5f5";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#d9d9d9";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            +
          </Text>
        </div>
      );
    }

    return (
      <Tooltip title={`点击移除 ${level.name} 维度`}>
        <div
          style={{
            width: 36,
            height: 36,
            backgroundColor: level.color,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            position: "relative",
            margin: "0 auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (!canEdit) return;
            handleDimensionClick(record.id, record.name, null);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          {React.cloneElement(level.icon, {
            style: { fontSize: 18, color: "white" },
          })}
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

        const indentSize = record.knowledgeType === "subject" ? 0 : record.knowledgeType === "knowledge_unit" ? 24 : 48;

        return (
          <div style={{ paddingLeft: indentSize, display: "flex", alignItems: "center" }}>
            <Tooltip title={text} mouseEnterDelay={0.3}>
              <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</Text>
            </Tooltip>
            <Tag color="blue" style={{ marginLeft: 8, flexShrink: 0 }}>{typeMap[record.knowledgeType]}</Tag>
            {record.dimension && (
              <Tag
                color={
                  COGNITIVE_LEVELS.find((l) => l.id === record.dimension)
                    ?.color
                }
                style={{ flexShrink: 0 }}
              >
                {COGNITIVE_LEVELS.find((l) => l.id === record.dimension)
                  ?.name || record.dimension}
              </Tag>
            )}
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
      render: (_: unknown, record: KnowledgeRow) =>
        renderDimensionCell(record, level),
    })),
  ];

  const currentCourse = React.useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId);
  }, [courses, selectedCourseId]);

  React.useEffect(() => {
    if (selectedCourseId || courses.length === 0) return;
    if (courses[0]?.id) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  React.useEffect(() => {
    if (filteredRows.length > 0 && expandedRowKeys.length === 0) {
      const allIds = filteredRows
        .filter((r) => r.children && r.children.length > 0)
        .map((r) => r.id);
      setExpandedRowKeys(allIds);
    }
  }, [filteredRows, expandedRowKeys.length]);

  if (coursesLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: 16 }}>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          知识点认知维度管理
        </Title>
      </div>

      {/* 课程选择独立一行 */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space>
          <Text strong style={{ fontSize: 16 }}>
            课程选择：
          </Text>
          <Select
            style={{ minWidth: 280, fontSize: 15 }}
            placeholder={coursesLoading ? "加载中..." : "请选择课程"}
            value={selectedCourseId || undefined}
            onChange={handleCourseSelect}
            allowClear
            loading={coursesLoading}
            showSearch
            optionFilterProp="children"
            options={(
              courses.length > 0
                ? courses.map((course: any) => ({
                    label: course.title || `课程 (${course.id})`,
                    value: course.id,
                  }))
                : [{ label: "暂无课程", value: "no-course", disabled: true }]
            ) as any}
            disabled={coursesLoading || courses.length === 0}
          />
        </Space>
      </div>

      {selectedCourseId && (
        <div style={{ marginBottom: 16 }}>
          <Text
            style={{
              marginBottom: 12,
              fontWeight: 600,
              display: "block",
              fontSize: 18,
              lineHeight: "26px",
            }}
          >
            认知水平说明
          </Text>
          <Row gutter={[16, 16]}>
            {COGNITIVE_LEVELS.map((level) => (
              <Col xs={24} sm={12} md={8} key={level.id}>
                <Card
                  size="small"
                  style={{ height: "100%" }}
                  styles={{ body: { padding: 12 } }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 4,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 4,
                        backgroundColor: level.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                      }}
                    >
                      {React.cloneElement(level.icon, {
                        style: { fontSize: 20 },
                      })}
                    </div>
                    <Text style={{ fontWeight: 600, fontSize: 16, lineHeight: "24px" }}>
                      {level.name}
                    </Text>
                  </div>
                  <Text type="secondary" style={{ fontSize: 14, lineHeight: "22px" }}>
                    {level.description}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      )}

      {selectedCourseId && !knowledgesLoading && (
        <Card
          title={<span style={{ fontWeight: 600 }}>认知目标分布</span>}
          style={{ marginBottom: 16 }}
          styles={{ body: { padding: "16px 24px" } }}
        >
          <Row gutter={24}>
            <Col xs={24} lg={14}>
              <div
                ref={(el) => {
                  if (el && cognitiveDistribution.length > 0) {
                    const chart = echarts.init(el);
                    const funnelData = [...cognitiveDistribution]
                      .reverse()
                      .map((item) => ({
                        value: item.count || 1,
                        name: item.name,
                        itemStyle: { color: item.color },
                      }));
                    const option = {
                      tooltip: {
                        trigger: "item",
                        formatter: (params: any) => {
                          const item = cognitiveDistribution.find(
                            (d) => d.name === params.name,
                          );
                          const percent =
                            knowledgeStats.dimensioned > 0
                              ? Math.round(
                                  (params.value / knowledgeStats.dimensioned) * 100,
                                )
                              : 0;
                          return `<strong>${params.name}</strong><br/>知识点数: ${
                            item?.count || 0
                          }<br/>占比: ${percent}%`;
                        },
                      },
                      legend: {
                        orient: "vertical",
                        right: 10,
                        top: "center",
                        formatter: (name: string) => {
                          const item = cognitiveDistribution.find(
                            (d) => d.name === name,
                          );
                          return `${name}: ${item?.count || 0}`;
                        },
                      },
                      series: [
                        {
                          name: "认知目标金字塔",
                          type: "funnel",
                          left: "10%",
                          top: 30,
                          bottom: 30,
                          width: "60%",
                          min: 0,
                          max: Math.max(
                            ...cognitiveDistribution.map((d) => d.count),
                            1,
                          ),
                          minSize: "20%",
                          maxSize: "100%",
                          sort: "ascending",
                          gap: 2,
                          label: {
                            show: true,
                            position: "inside",
                            formatter: "{b}",
                            color: "#fff",
                            fontWeight: "bold",
                          },
                          labelLine: {
                            length: 10,
                            lineStyle: {
                              width: 1,
                              type: "solid",
                            },
                          },
                          itemStyle: {
                            borderColor: "#fff",
                            borderWidth: 1,
                          },
                          emphasis: {
                            label: {
                              fontSize: 14,
                            },
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
                  }
                }}
                style={{ width: "100%", height: 320 }}
              />
            </Col>
            <Col xs={24} lg={10}>
              <div style={{ marginBottom: 16 }}>
                <Statistic
                  title="认知目标覆盖率"
                  value={knowledgeStats.percentage}
                  suffix="%"
                  valueStyle={{
                    color:
                      knowledgeStats.percentage >= 80
                        ? "#3f8600"
                        : knowledgeStats.percentage >= 50
                          ? "#1890ff"
                          : "#cf1322",
                  }}
                />
                <Progress
                  percent={knowledgeStats.percentage}
                  strokeColor={
                    knowledgeStats.percentage >= 80
                      ? "#3f8600"
                      : knowledgeStats.percentage >= 50
                        ? "#1890ff"
                        : "#cf1322"
                  }
                  showInfo={false}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 14, lineHeight: "22px" }}>
                  知识点总数: {knowledgeStats.total}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: 14, lineHeight: "22px" }}>
                  已设置维度: {knowledgeStats.dimensioned}
                </Text>
              </div>
              <div style={{ marginTop: 16 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 10,
                    lineHeight: "24px",
                  }}
                >
                  各层级知识点数量
                </Text>
                {cognitiveDistribution.map((level) => (
                  <div
                    key={level.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      marginBottom: 6,
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: level.color,
                      }}
                    />
                    <Text style={{ fontSize: 14, lineHeight: "22px", flex: 1 }}>
                      {level.name}
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: 600, lineHeight: "22px" }}>
                      {level.count}
                    </Text>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  backgroundColor: "#fafafa",
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    display: "block",
                    marginBottom: 8,
                    lineHeight: "24px",
                  }}
                >
                  布鲁姆认知目标层级
                </Text>
                <Text type="secondary" style={{ fontSize: 14, lineHeight: "22px" }}>
                  低阶思维 → 高阶思维
                </Text>
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 4,
                  }}
                >
                  {COGNITIVE_LEVELS.map((level, index) => (
                    <React.Fragment key={level.id}>
                      <Tag color={level.color} style={{ margin: 0, fontSize: 13, lineHeight: "20px", paddingInline: 8 }}>
                        {level.name}
                      </Tag>
                      {index < COGNITIVE_LEVELS.length - 1 && (
                        <RightOutlined style={{ fontSize: 12, color: "#999" }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {!selectedCourseId ? (
        <Card style={{ padding: 32, textAlign: "center" }} styles={{ body: { padding: 32 } }}>
          <Title level={5} type="secondary">
            暂无课程
          </Title>
          <Text type="secondary">请先选择一个课程</Text>
        </Card>
      ) : knowledgesLoading ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 400,
            backgroundColor: "#f5f5f5",
          }}
        >
          <Spin size="large" />
        </div>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <div
            style={{
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f0f0f0",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Input.Search
                placeholder="搜索知识点名称/主题/单元"
                allowClear
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                }}
                style={{ width: 280 }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Switch
                  checked={showOnlyDimensioned}
                  onChange={(checked) => {
                    setShowOnlyDimensioned(checked);
                  }}
                  size="small"
                />
                <Text style={{ fontSize: 13 }}>只显示已设置维度的知识点</Text>
                {showOnlyDimensioned && (
                  <Tag color="green" style={{ marginLeft: 4 }}>
                    {dimensionedKnowledges.length} 条
                  </Tag>
                )}
              </div>
            </div>
            <Text type="secondary">共 {filteredRowCount} 条记录</Text>
          </div>
          {filteredRows.length > 0 ? (
            <Table
              columns={columns}
              dataSource={filteredRows}
              rowKey="id"
              loading={knowledgesLoading}
              pagination={false}
              scroll={{ x: 1000, y: 500 }}
              expandable={{
                expandedRowKeys,
                onExpand: (expanded, record) => {
                  if (expanded) {
                    setExpandedRowKeys([...expandedRowKeys, record.id]);
                  } else {
                    setExpandedRowKeys(
                      expandedRowKeys.filter((key) => key !== record.id),
                    );
                  }
                },
                indentSize: 24,
                showExpandColumn: true,
              }}
            />
          ) : (
            <div style={{ padding: 32, textAlign: "center" }}>
              <Text type="secondary">暂无知识点数据</Text>
            </div>
          )}
        </Card>
      )}

      {selectedCourseId && (
        <>
          <div style={{ marginTop: 24, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Tag color="blue">知识点总数: {knowledgeStats.total}</Tag>
            <Tag color="green">维度类型: {knowledgeStats.dimensionTypes}</Tag>
            <Tag color="orange">已设置维度: {knowledgeStats.dimensioned}</Tag>
            {Object.entries(knowledgeStats.bySubject).map(([subject, count]) => (
              <Tag key={subject}>
                {subject}: {count}
              </Tag>
            ))}
          </div>

          {dimensionedKnowledges.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Text style={{ marginBottom: 8, fontWeight: 600, display: "block" }}>
                已设置认知维度的知识点
              </Text>
              <Card size="small">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {displayedDimensionedKnowledges.map((knowledge) => {
                    const level = COGNITIVE_LEVELS.find(
                      (l) => l.id === knowledge.dimension,
                    );
                    return (
                      <Tag
                        key={knowledge.id}
                        color={level?.color}
                        style={{ padding: "4px 8px" }}
                      >
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
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
