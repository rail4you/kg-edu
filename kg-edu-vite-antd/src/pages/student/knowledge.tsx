import { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Card,
  Space,
  Row,
  Col,
  Tabs,
  Tag,
  Button,
  Tooltip,
  Spin,
  Input,
} from "antd";
import {
  BulbOutlined,
  ApartmentOutlined,
  AppstoreOutlined,
  PartitionOutlined,
  SearchOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  listCourses,
  listRelations,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;

interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  description: string;
  level: number;
  connections: number;
  x?: number;
  y?: number;
  symbolSize?: number;
  value?: number;
}

interface KnowledgeConnection {
  source: string;
  target: string;
  type: string;
  strength: number;
}

interface Category {
  id: string;
  name: string;
  color: string;
  count: number;
}

export default function StudentKnowledgePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const [currentTab, setCurrentTab] = useState("0");
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    const stored = localStorage.getItem("selectedCourse");
    return stored || "";
  });

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Title level={4} style={{ marginBottom: 16, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text style={{ marginBottom: 24 }}>请登录以访问知识图谱。</Text>
        <Button type="primary" onClick={() => navigate("/login")}>
          登录
        </Button>
      </div>
    );
  }

  if (!currentTenant) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Title level={4} style={{ marginBottom: 16, color: "#faad14" }}>
          未选择组织
        </Title>
        <Text style={{ marginBottom: 24 }}>请选择一个组织以访问知识图谱。</Text>
        <Button type="primary" onClick={() => navigate("/dashboard")}>
          返回首页
        </Button>
      </div>
    );
  }

  return <KnowledgeContent 
    user={user}
    currentTenant={currentTenant}
    currentTab={currentTab}
    setCurrentTab={setCurrentTab}
    selectedNode={selectedNode}
    setSelectedNode={setSelectedNode}
    searchTerm={searchTerm}
    setSearchTerm={setSearchTerm}
    filterCategory={filterCategory}
    setFilterCategory={setFilterCategory}
    selectedCourseId={selectedCourseId}
    setSelectedCourseId={setSelectedCourseId}
  />;
}

interface KnowledgeContentProps {
  user: any;
  currentTenant: any;
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  selectedNode: KnowledgeNode | null;
  setSelectedNode: (node: KnowledgeNode | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  selectedCourseId: string;
  setSelectedCourseId: (id: string) => void;
}

function KnowledgeContent({
  user,
  currentTenant,
  currentTab,
  setCurrentTab,
  selectedNode,
  setSelectedNode,
  searchTerm,
  setSearchTerm,
  filterCategory,
  setFilterCategory,
  selectedCourseId,
  setSelectedCourseId,
}: KnowledgeContentProps) {
  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["course-name", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listCourses({
            tenant: currentTenant?.schemaName || currentTenant?.id,
            fields: ["id", "title", "knowledgeResourcesCount"],
            filter: { id: { eq: selectedCourseId } },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant,
    retry: 1,
  });

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ["knowledge-hierarchy", selectedCourseId, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${currentTenant?.id}`,
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
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: relationsData, isLoading: relationsLoading } = useQuery({
    queryKey: ["knowledge-relations", selectedCourseId, user?.id, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourseId) {
        return { success: false, data: [] };
      }

      try {
        const result = await listRelations({
          tenant: currentTenant?.schemaName || currentTenant?.id,
          fields: [
            "id",
            "relationTypeId",
            "sourceKnowledgeId",
            "targetKnowledgeId",
            {
              relationType: ["id", "name", "displayName"],
            },
            {
              sourceKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
            },
            {
              targetKnowledge: ["id", "name", "knowledgeType", "subject", "unit"],
            },
          ],
          filter: {
            or: [
              { sourceKnowledge: { courseId: { eq: selectedCourseId } } },
              { targetKnowledge: { courseId: { eq: selectedCourseId } } },
            ],
          },
          sort: "-id",
          page: { limit: 1000 },
          headers: getAuthHeaders(user),
        });

        if (!result.success) {
          return { success: false, data: [] };
        }

        return {
          success: true,
          data: (result.data as any)?.results || result.data || [],
        };
      } catch (error) {
        console.error("Error in knowledge relations query:", error);
        return { success: false, data: [] };
      }
    },
    enabled: !!selectedCourseId && !!currentTenant,
    retry: 1,
  });

  const courseInfo =
    coursesData?.success && coursesData.data
      ? Array.isArray(coursesData.data)
        ? coursesData.data[0]
        : ((coursesData.data as any).results?.[0] || (coursesData.data as any).data?.[0])
      : null;

  const courseName = courseInfo?.title || null;
  const knowledgeResourcesCount = courseInfo?.knowledgeResourcesCount || 0;

  const flattenedKnowledgeItems = useMemo(() => {
    if (!knowledgeData || !Array.isArray(knowledgeData)) return [];

    const flatItems: any[] = [];
    const seenIds = new Set<string>();

    const flattenHierarchy = (node: any): void => {
      if (seenIds.has(node.id)) return;
      seenIds.add(node.id);

      flatItems.push(node);

      const childArrays = [
        node.childUnits,
        node.directCells,
        node.subjectCells,
        node.childCells,
        node.nestedChildCells,
      ];
      childArrays.forEach((children) => {
        if (Array.isArray(children)) {
          children.forEach((child: any) => flattenHierarchy(child));
        }
      });
    };

    knowledgeData.forEach((node: any) => flattenHierarchy(node));
    return flatItems;
  }, [knowledgeData]);

  const knowledgeItems = flattenedKnowledgeItems;
  const knowledgeRelations = relationsData?.success
    ? Array.isArray(relationsData.data)
      ? relationsData.data
      : []
    : [];

  const knowledgePointsCount = knowledgeResourcesCount;
  const knowledgeRelationsCount = relationsData?.success
    ? Array.isArray(relationsData.data)
      ? relationsData.data.length
      : relationsData.data?.results?.length || 0
    : 0;

  const subjectCount = useMemo(() => {
    return knowledgeItems.filter((item: any) => item.knowledgeType === "subject").length;
  }, [knowledgeItems]);

  const unitCount = useMemo(() => {
    return knowledgeItems.filter((item: any) => item.knowledgeType === "knowledge_unit").length;
  }, [knowledgeItems]);

  const cellCount = useMemo(() => {
    return knowledgeItems.filter((item: any) => item.knowledgeType === "knowledge_cell").length;
  }, [knowledgeItems]);

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourse", selectedCourseId);
    }
  }, [selectedCourseId]);

  const categories = useMemo(() => {
    if (!selectedCourseId || knowledgeItems.length === 0) return [];

    const categoryMap = new Map<string, Category>();
    knowledgeItems.forEach((item: any) => {
      if (!item.subject) return;
      const categoryName = item.subject;
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          id: categoryName.replace(/\s+/g, "-"),
          name: categoryName,
          color: ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272"][
            categoryMap.size % 6
          ],
          count: 0,
        });
      }
      categoryMap.get(categoryName)!.count++;
    });

    return Array.from(categoryMap.values());
  }, [knowledgeItems, selectedCourseId]);

  const knowledgeGraph = useMemo(() => {
    if (!selectedCourseId || knowledgeItems.length === 0) {
      return { nodes: [], connections: [] };
    }

    const nodes: KnowledgeNode[] = (knowledgeItems || []).map((item: any, index: number) => {
      const category = categories.find((c) => c.name === item.subject);
      const level =
        item.knowledgeType === "subject" ? 1 : item.knowledgeType === "knowledge_unit" ? 2 : 3;

      const angle = (Math.PI * 2 * index) / knowledgeItems.length;
      const radius = 100 + Math.random() * 150;

      return {
        id: item.id,
        name: item.name,
        category: category?.id || "",
        description: item.description || `${item.name}的详细描述`,
        level: level,
        connections: knowledgeRelations.filter(
          (r: any) => r.sourceKnowledgeId === item.id || r.targetKnowledgeId === item.id
        ).length,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        symbolSize: 10 + level * 3,
        value: Math.random() * 100,
      };
    });

    const connections: KnowledgeConnection[] = (knowledgeRelations || []).map((relation: any) => ({
      source: relation.sourceKnowledgeId,
      target: relation.targetKnowledgeId,
      type: "related",
      strength: 0.5 + Math.random() * 0.5,
    }));

    return { nodes, connections };
  }, [knowledgeItems, knowledgeRelations, categories, selectedCourseId]);

  const filteredNodes = knowledgeGraph.nodes.filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || node.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setFilterCategory("all");
  };

  const handleNodeClick = (node: KnowledgeNode) => {
    setSelectedNode(node);
  };

  const tabItems = [
    {
      key: "0",
      label: (
        <span>
          <AppstoreOutlined />
          分类浏览
        </span>
      ),
    },
    {
      key: "1",
      label: (
        <span>
          <PartitionOutlined />
          层次结构
        </span>
      ),
    },
  ];

  const gradientBg = "#F8F9FA";
  const cardStyle: React.CSSProperties = {
    padding: 24,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    border: '1px solid #E0E0E0',
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: gradientBg,
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ padding: "32px 0" }}>
          <Title level={2} style={{ fontWeight: 700, marginBottom: 8, color: "#333" }}>
            知识图谱系统 - {currentTenant?.name || "默认组织"}
          </Title>

          {selectedCourseId && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <Text style={{ color: "#666" }}>当前课程:</Text>
              {coursesLoading ? (
                <Spin size="small" />
              ) : (
                <Tag
                  style={{
                    backgroundColor: "#e6f7ff",
                    color: "colors.primary",
                    border: "1px solid #91d5ff",
                  }}
                >
                  {courseName || "加载中..."}
                </Tag>
              )}
            </div>
          )}

          {!selectedCourseId && (
            <Card
              style={{
                ...cardStyle,
                textAlign: "center",
              }}
              styles={{ body: { padding: 32 } }}
            >
              <Title level={5} style={{ color: "#333", fontWeight: 600, marginBottom: 16 }}>
                未选择课程
              </Title>
              <Text style={{ color: "#666" }}>
                请先从其他页面选择一个课程以查看其知识图谱和关系数据
              </Text>
            </Card>
          )}
        </div>

        {selectedCourseId && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={12} sm={8}>
              <Card style={cardStyle} styles={{ body: { padding: 24 } }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "#e6f7ff",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <BulbOutlined style={{ color: colors.primary, fontSize: 24 }} />
                  </div>
                  <div>
                    <Text style={{ color: "#666" }}>主题数量</Text>
                    <div style={{ fontWeight: 700, color: "#333", fontSize: 24 }}>
                      {knowledgeLoading ? "-" : subjectCount}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={8}>
              <Card style={cardStyle} styles={{ body: { padding: 24 } }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "#f6ffed",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ApartmentOutlined style={{ color: "#52c41a", fontSize: 24 }} />
                  </div>
                  <div>
                    <Text style={{ color: "#666" }}>单元数量</Text>
                    <div style={{ fontWeight: 700, color: "#333", fontSize: 24 }}>
                      {knowledgeLoading ? "-" : unitCount}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>

            <Col xs={12} sm={8}>
              <Card style={cardStyle} styles={{ body: { padding: 24 } }}>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      backgroundColor: "#fffbe6",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <AppstoreOutlined style={{ color: "#faad14", fontSize: 24 }} />
                  </div>
                  <div>
                    <Text style={{ color: "#666" }}>知识点数量</Text>
                    <div style={{ fontWeight: 700, color: "#333", fontSize: 24 }}>
                      {knowledgeLoading ? "-" : cellCount}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {selectedCourseId ? (
          <Card
            style={{
              borderRadius: 8,
              backgroundColor: "#ffffff",
              border: '1px solid #E0E0E0',
            }}
            styles={{ body: { padding: 0 } }}
          >
            <Tabs
              activeKey={currentTab}
              onChange={setCurrentTab}
              items={tabItems}
              style={{ marginBottom: 0 }}
              tabBarStyle={{
                marginBottom: 0,
                paddingLeft: 16,
                borderBottom: "1px solid #E0E0E0",
              }}
            />

            {knowledgeLoading || relationsLoading ? (
              <div style={{ padding: 64, textAlign: "center" }}>
                <Spin />
                <Text style={{ color: "#666", display: "block", marginTop: 16 }}>
                  正在加载知识数据...
                </Text>
              </div>
            ) : knowledgeItems.length === 0 ? (
              <div style={{ padding: 64, textAlign: "center" }}>
                <Title level={5} style={{ color: "#333", fontWeight: 600, marginBottom: 16 }}>
                  该课程暂无知识数据
                </Title>
                <Text style={{ color: "#666" }}>
                  请联系管理员添加课程知识点和关系数据
                </Text>
              </div>
            ) : currentTab === "0" ? (
              <CategoryBrowser
                categories={categories}
                nodes={filteredNodes}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filterCategory={filterCategory}
                setFilterCategory={setFilterCategory}
                resetFilters={resetFilters}
                onNodeClick={handleNodeClick}
                selectedNode={selectedNode}
              />
            ) : (
              <HierarchyView
                nodes={filteredNodes}
                categories={categories}
                onNodeClick={handleNodeClick}
              />
            )}
          </Card>
        ) : (
          <Card
            style={{
              ...cardStyle,
              textAlign: "center",
            }}
            styles={{ body: { padding: 64 } }}
          >
            <BulbOutlined style={{ fontSize: 64, color: "#999", marginBottom: 24 }} />
            <Title level={4} style={{ color: "#333", fontWeight: 600, marginBottom: 16 }}>
              请选择一个课程
            </Title>
            <Text style={{ color: "#666" }}>
              选择课程后将显示该课程的知识图谱和关系数据
            </Text>
          </Card>
        )}
      </div>
    </div>
  );
}

interface CategoryBrowserProps {
  categories: Category[];
  nodes: KnowledgeNode[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterCategory: string;
  setFilterCategory: (category: string) => void;
  resetFilters: () => void;
  onNodeClick: (node: KnowledgeNode) => void;
  selectedNode: KnowledgeNode | null;
}

const CategoryBrowser: React.FC<CategoryBrowserProps> = ({
  categories,
  nodes,
  searchTerm,
  setSearchTerm,
  filterCategory,
  setFilterCategory,
  resetFilters,
  onNodeClick,
  selectedNode,
}) => {
  const [visibleCount, setVisibleCount] = useState(12);
  const displayedNodes = nodes.slice(0, visibleCount);
  const hasMore = nodes.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 12);
  };

  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, filterCategory]);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ width: "100%", marginBottom: 24 }} size={16}>
        <Input
          placeholder="搜索知识点..."
          prefix={<SearchOutlined style={{ color: "#999" }} />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            border: "1px solid #E0E0E0",
            color: "#333",
          }}
        />
        <Tooltip title="重置筛选">
          <Button
            icon={<ReloadOutlined />}
            onClick={resetFilters}
            style={{
              backgroundColor: "#ffffff",
              color: "#333",
              border: "1px solid #E0E0E0",
            }}
          />
        </Tooltip>
      </Space>

      <div style={{ marginBottom: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Tag
          onClick={() => setFilterCategory("all")}
          style={{
            backgroundColor: filterCategory === "all" ? "colors.primary" : "#fafafa",
            color: filterCategory === "all" ? "#fff" : "#333",
            border: "1px solid #E0E0E0",
            cursor: "pointer",
          }}
        >
          全部
        </Tag>
        {categories.map((category) => (
          <Tag
            key={category.id}
            onClick={() => setFilterCategory(category.id)}
            style={{
              backgroundColor:
                filterCategory === category.id ? "colors.primary" : "#fafafa",
              color: filterCategory === category.id ? "#fff" : "#333",
              border: "1px solid #E0E0E0",
              cursor: "pointer",
            }}
          >
            {category.name} ({category.count})
          </Tag>
        ))}
      </div>

      <Title level={5} style={{ color: "#333", fontWeight: 600, marginBottom: 16 }}>
        找到 {nodes.length} 个知识点
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={16}>
          <Row gutter={[16, 16]}>
            {displayedNodes.map((node) => (
              <Col xs={12} md={8} key={node.id}>
                <Card
                  onClick={() => onNodeClick(node)}
                  style={{
                    cursor: "pointer",
                    borderRadius: 8,
                    backgroundColor:
                      selectedNode?.id === node.id
                        ? "#e6f7ff"
                        : "#ffffff",
                    border:
                      selectedNode?.id === node.id
                        ? "2px solid colors.primary"
                        : '1px solid #E0E0E0',
                    transition: "all 0.3s ease",
                  }}
                  styles={{ body: { padding: 16 } }}
                  hoverable
                >
                    <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    <Text
                      strong
                      style={{ color: "#333", fontSize: 16, display: "block" }}
                      ellipsis
                    >
                      {node.name}
                    </Text>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{
                        color: "#666",
                        marginBottom: 0,
                      }}
                    >
                      {node.description}
                    </Paragraph>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Button type="default" onClick={handleLoadMore} icon={<ReloadOutlined />}>
                展开更多 ({nodes.length - visibleCount} 个)
              </Button>
            </div>
          )}
        </Col>

        <Col xs={24} md={8}>
          {selectedNode ? (
            <Card
              style={{
                borderRadius: 8,
                backgroundColor: "#ffffff",
                border: '2px solid #2573E6',
              }}
              styles={{ body: { padding: 24 } }}
            >
              <Title level={5} style={{ color: "#333", fontWeight: 600, marginBottom: 16 }}>
                节点详情
              </Title>
              <Space direction="vertical" style={{ width: "100%" }} size={16}>
                <div>
                  <Text style={{ color: "#666", fontSize: 12 }}>名称</Text>
                  <br />
                  <Text style={{ color: "#333", fontWeight: 600, fontSize: 16 }}>{selectedNode.name}</Text>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Tag color={selectedNode.level === 1 ? "blue" : selectedNode.level === 2 ? "green" : "orange"}>
                    {selectedNode.level === 1 ? "主题" : selectedNode.level === 2 ? "知识单元" : "知识点"}
                  </Tag>
                  <Tag color="purple">
                    关联 {selectedNode.connections} 个
                  </Tag>
                </div>
                <div>
                  <Text style={{ color: "#666", fontSize: 12 }}>描述</Text>
                  <br />
                  <Text style={{ color: "#666", lineHeight: 1.6 }}>
                    {selectedNode.description}
                  </Text>
                </div>
              </Space>
            </Card>
          ) : (
            <Card
              style={{
                borderRadius: 8,
                backgroundColor: "#ffffff",
                border: '1px solid #E0E0E0',
              }}
              styles={{ body: { padding: 24 } }}
            >
              <Title level={5} style={{ color: "#333", fontWeight: 600, marginBottom: 8 }}>
                节点信息
              </Title>
              <Text style={{ color: "#666" }}>点击节点查看详细信息</Text>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

interface HierarchyViewProps {
  nodes: KnowledgeNode[];
  categories: Category[];
  onNodeClick: (node: KnowledgeNode) => void;
}

const HierarchyView: React.FC<HierarchyViewProps> = ({ nodes, categories, onNodeClick }) => {
  const nodesByLevel = [1, 2, 3, 4].map((level) => nodes.filter((node) => node.level === level));

  const levelNames = ["基础概念", "核心理论", "应用方法", "专业技能"];

  return (
    <div style={{ padding: 24 }}>
      <Card
        style={{
          borderRadius: 8,
          backgroundColor: "#e6f7ff",
          border: '1px solid #E0E0E0',
          marginBottom: 24,
        }}
        styles={{ body: { padding: 16 } }}
      >
        <Text style={{ color: "#333", textAlign: "center", display: "block" }}>
          层次结构视图展示了知识点的层级关系，从基础概念到专业技能的递进关系。
        </Text>
      </Card>

      <Space direction="vertical" style={{ width: "100%" }} size={24}>
        {nodesByLevel.map((levelNodes, index) => (
          <div key={index}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: "colors.primary",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {index + 1}
              </div>
              <Title level={4} style={{ color: "#333", fontWeight: 600, margin: 0 }}>
                {levelNames[index]}
              </Title>
            </div>

            <Row gutter={[16, 16]}>
              {levelNodes.slice(0, 8).map((node) => (
                <Col xs={12} sm={6} key={node.id}>
                  <Card
                    onClick={() => onNodeClick(node)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 8,
                      backgroundColor: "#ffffff",
                      border: '1px solid #E0E0E0',
                      borderLeftWidth: 4,
                      borderLeftColor:
                        categories.find((c) => c.id === node.category)?.color || "colors.primary",
                      transition: "all 0.3s ease",
                    }}
                    styles={{ body: { padding: 16 } }}
                    hoverable
                  >
                    <Space direction="vertical" style={{ width: "100%" }} size={8}>
                      <Text style={{ color: "#333", fontWeight: 600, fontSize: 14 }} ellipsis>
                        {node.name}
                      </Text>
                      <Tag
                        style={{
                          backgroundColor: "#fafafa",
                          color: "#666",
                          border: "1px solid #E0E0E0",
                          fontSize: 12,
                        }}
                      >
                        {categories.find((c) => c.id === node.category)?.name || node.category}
                      </Tag>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        ))}
      </Space>
    </div>
  );
};
