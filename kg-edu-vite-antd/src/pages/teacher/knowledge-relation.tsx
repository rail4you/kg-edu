import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Card,
  Typography,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Modal,
  Form,
  Empty,
  Tree,
  Input,
  Row,
  Col,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { TreeDataNode } from "antd";
import {
  PartitionOutlined,
  PlusOutlined,
  DeleteOutlined,
  BookOutlined,
  SearchOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import {
  listRelations,
  listRelationTypes,
  listKnowledges,
  createRelation,
  destroyRelation,
  type ResourceResourceSchema,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface Relation {
  id: string;
  relationTypeId: string;
  relationTypeName: string;
  sourceKnowledgeId: string;
  targetKnowledgeId: string;
  sourceKnowledgeName: string;
  targetKnowledgeName: string;
}

interface KnowledgeResource extends ResourceResourceSchema {
  children?: KnowledgeResource[];
}

interface KnowledgeTreeItem {
  id: string;
  key: string | number;
  label: string;
  title?: React.ReactNode;
  children?: KnowledgeTreeItem[];
  knowledgeData: KnowledgeResource;
  icon?: React.ReactNode;
}

interface KnowledgeTreeSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  treeData: KnowledgeTreeItem[];
  placeholder?: string;
}

function KnowledgeTreeSelect({
  value,
  onChange,
  treeData,
  placeholder = "选择知识点",
}: KnowledgeTreeSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpanded, setAutoExpanded] = useState(true);

  useEffect(() => {
    setExpandedKeys([]);
    setAutoExpanded(true);
  }, [treeData]);

  const allKeys = useMemo(() => {
    const getKeys = (nodes: KnowledgeTreeItem[]): React.Key[] => {
      const keys: React.Key[] = [];
      nodes.forEach((node) => {
        keys.push(node.key);
        if (node.children) {
          keys.push(...getKeys(node.children));
        }
      });
      return keys;
    };
    return getKeys(treeData);
  }, [treeData]);

  const filterTree = (
    nodes: KnowledgeTreeItem[],
    search: string,
  ): KnowledgeTreeItem[] => {
    if (!search) return nodes;
    const searchLower = search.toLowerCase();
    return nodes
      .map((node) => {
        const label = node.label || node.title?.toString() || "";
        const match = label.toLowerCase().includes(searchLower);
        const filteredChildren = node.children
          ? filterTree(node.children, search)
          : undefined;
        if (match || (filteredChildren && filteredChildren.length > 0)) {
          return {
            ...node,
            children: filteredChildren,
          } as KnowledgeTreeItem;
        }
        return null;
      })
      .filter((node): node is KnowledgeTreeItem => node !== null);
  };

  const filteredItems = useMemo(
    () => filterTree(treeData, searchValue),
    [treeData, searchValue],
  );

  const effectiveExpandedKeys = useMemo(() => {
    if (searchValue) {
      return allKeys;
    }
    if (expandedKeys.length > 0) {
      return expandedKeys;
    }
    if (autoExpanded && treeData.length > 0) {
      return allKeys;
    }
    return [];
  }, [searchValue, expandedKeys, autoExpanded, treeData, allKeys]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value) {
      setAutoExpanded(true);
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
    setAutoExpanded(false);
  };

  const handleSelect = (selectedKeys: React.Key[]) => {
    if (!selectedKeys.length) return;
    const itemId = selectedKeys[0] as string;
    if (onChange) {
      onChange(itemId);
    }
  };

  const enhanceTreeData = (
    items: KnowledgeTreeItem[],
    search: string,
  ): KnowledgeTreeItem[] => {
    return items.map((item) => {
      const label = item.label || item.title?.toString() || "";
      let titleNode: React.ReactNode = (
        <span style={{ fontSize: 14, lineHeight: 1.8 }}>{label}</span>
      );
      if (search) {
        const index = label.toLowerCase().indexOf(search.toLowerCase());
        if (index > -1) {
          const beforeStr = label.substring(0, index);
          const matchStr = label.substring(index, index + search.length);
          const afterStr = label.substring(index + search.length);
          titleNode = (
            <span style={{ fontSize: 14, lineHeight: 1.8 }}>
              {beforeStr}
              <span
                style={{
                  background: "#ffe58f",
                  color: "#1F1F1F",
                  padding: "0 2px",
                  borderRadius: 2,
                }}
              >
                {matchStr}
              </span>
              {afterStr}
            </span>
          );
        }
      }
      return {
        ...item,
        title: titleNode,
        icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
        children: item.children
          ? enhanceTreeData(item.children, search)
          : undefined,
      } as KnowledgeTreeItem;
    });
  };

  const treeDataWithTitle = useMemo(
    () => enhanceTreeData(filteredItems, searchValue),
    [filteredItems, searchValue],
  );

  const selectedKeys = value ? [value] : [];

  const selectedNode = useMemo(() => {
    const findNode = (
      nodes: KnowledgeTreeItem[],
      id: string,
    ): KnowledgeTreeItem | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(treeData, value || "");
  }, [treeData, value]);

  return (
    <div>
      <Input
        placeholder="搜索知识点"
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={handleSearchChange}
        style={{ marginBottom: 8 }}
        allowClear
      />
      <div
        style={{
          border: "1px solid #d9d9d9",
          borderRadius: 4,
          maxHeight: 300,
          overflow: "auto",
          padding: 8,
        }}
      >
        {treeDataWithTitle.length > 0 ? (
          <Tree
            showIcon
            expandedKeys={effectiveExpandedKeys}
            onExpand={handleExpand}
            selectedKeys={selectedKeys}
            onSelect={handleSelect}
            treeData={treeDataWithTitle}
          />
        ) : (
          <Empty description="暂无知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
      {selectedNode && (
        <div style={{ marginTop: 8, color: "#666" }}>
          已选择: <strong>{selectedNode.label}</strong>
        </div>
      )}
    </div>
  );
}

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

export default function KnowledgeRelationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { canEdit } = useEditPermission();
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [filterRelationTypeId, setFilterRelationTypeId] = useState<string>("");
  const [filterCourseId, setFilterCourseId] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    sourceKnowledgeId: "",
    targetKnowledgeId: "",
    relationTypeId: "",
  });

  const tenant = currentTenant?.schemaName || "";

  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (filterCourseId) {
      setSelectedCourseId(filterCourseId);
    }
  }, [filterCourseId]);

  const { data: relations = [], isLoading: relationsLoading } = useQuery({
    queryKey: ["relations", filterCourseId, filterRelationTypeId, tenant],
    queryFn: async () => {
      const input: { courseId?: string; relationTypeId?: string } = {};
      if (filterCourseId) {
        input.courseId = filterCourseId;
      }
      if (filterRelationTypeId) {
        input.relationTypeId = filterRelationTypeId;
      }
      const result = await listRelations({
        tenant,
        input,
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          { relationType: ["name", "displayName"] },
          { sourceKnowledge: ["name"] },
          { targetKnowledge: ["name"] },
        ],
        headers: getHeaders(user),
      });
      return extractArrayData(result).map((r: any) => ({
        id: r.id,
        relationTypeId: r.relationTypeId,
        relationTypeName:
          r.relationType?.displayName || r.relationType?.name || "-",
        sourceKnowledgeId: r.sourceKnowledgeId,
        sourceKnowledgeName: r.sourceKnowledge?.name || "-",
        targetKnowledgeId: r.targetKnowledgeId,
        targetKnowledgeName: r.targetKnowledge?.name || "-",
      }));
    },
    enabled: !!tenant && !!user,
  });

  const { data: relationTypes = [] } = useQuery({
    queryKey: ["relation-types", tenant],
    queryFn: async () => {
      const result = await listRelationTypes({
        tenant,
        fields: ["id", "name", "displayName"],
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const { data: knowledges = [] } = useQuery({
    queryKey: ["knowledges", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const filter = { courseId: { eq: selectedCourseId } };
      const result = await listKnowledges({
        tenant,
        filter,
        fields: ["id", "name"],
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const { data: hierarchyData = [] } = useQuery({
    queryKey: ["knowledge-hierarchy", selectedCourseId, tenant],
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

  const knowledgeTreeData = useMemo(() => {
    if (!hierarchyData || hierarchyData.length === 0) return [];

    const globalSeenIds = new Set<string>();

    const convertToTree = (node: any): KnowledgeTreeItem | null => {
      if (!node.id || globalSeenIds.has(node.id)) {
        return null;
      }
      globalSeenIds.add(node.id);

      const childArrays = [
        node.childUnits,
        node.directCells,
        node.subjectCells,
        node.childCells,
        node.nestedChildCells,
      ];

      const children: KnowledgeTreeItem[] = [];
      childArrays.forEach((arr) => {
        if (Array.isArray(arr)) {
          arr.forEach((child: any) => {
            const childNode = convertToTree(child);
            if (childNode) {
              children.push(childNode);
            }
          });
        }
      });

      return {
        id: node.id,
        key: node.id,
        label: node.name,
        title: node.name,
        children: children.length > 0 ? children : undefined,
        knowledgeData: node,
        icon: <BookOutlined style={{ color: "#0056D2", fontSize: 16 }} />,
      };
    };

    const treeItems = hierarchyData
      .map((node: any) => convertToTree(node))
      .filter((item): item is KnowledgeTreeItem => item !== null);
    return treeItems;
  }, [hierarchyData]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const isDuplicate = relations.some(
        (r) =>
          r.sourceKnowledgeId === data.sourceKnowledgeId &&
          r.targetKnowledgeId === data.targetKnowledgeId &&
          r.relationTypeId === data.relationTypeId
      );

      if (isDuplicate) {
        throw new Error("该关系已存在，请勿重复创建");
      }

      const result = await createRelation({
        tenant,
        input: {
          sourceKnowledgeId: data.sourceKnowledgeId,
          targetKnowledgeId: data.targetKnowledgeId,
          relationTypeId: data.relationTypeId,
        },
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to create");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations"] });
      message.success("创建成功");
      setCreateModalOpen(false);
      setFormData({ sourceKnowledgeId: "", targetKnowledgeId: "", relationTypeId: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyRelation({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to delete");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations"] });
      message.success("删除成功");
    },
  });

  const columns: ColumnsType<Relation> = [
    {
      title: "关系类型",
      dataIndex: "relationTypeName",
      key: "relationTypeName",
      width: 150,
    },
    {
      title: "源知识点",
      dataIndex: "sourceKnowledgeName",
      key: "sourceKnowledgeName",
      ellipsis: true,
    },
    {
      title: "目标知识点",
      dataIndex: "targetKnowledgeName",
      key: "targetKnowledgeName",
      ellipsis: true,
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_, r) => (
        <Popconfirm
          title="确定删除？"
          onConfirm={() => deleteMutation.mutate(r.id)}
        >
          <ReadonlyActionButton type="link" danger icon={<DeleteOutlined />}>
            删除
          </ReadonlyActionButton>
        </Popconfirm>
      ),
    },
  ];

  if (!user)
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );

  return (
    <div className="kr-page-wrap" style={{ padding: 24, maxWidth: 1800, margin: "0 auto" }}>
      <style>{`@media(max-width:768px){.kr-mobile-hide{display:none!important}.kr-action-text{display:none!important}.kr-page-wrap{padding:12px!important}.kr-page-wrap .ant-table-cell{padding:6px 4px!important}.kr-filter-bar{flex-direction:column;align-items:stretch!important}.kr-filter-bar .ant-select{width:100%!important;margin-bottom:8px}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <PartitionOutlined style={{ fontSize: 24, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          知识关系管理
        </Title>
      </div>
      <Text type="secondary">管理知识点之间的关联关系</Text>

      <Card style={{ marginTop: 20 }}>
        <div className="kr-filter-bar" style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Title level={5} style={{ margin: 0, marginBottom: 12 }}>
            关系列表 ({relations.length})
          </Title>
          <Space>
            <Select
              style={{ width: 240 }}
              placeholder="选择课程"
              value={filterCourseId || undefined}
              onChange={setFilterCourseId}
              loading={coursesLoading}
              allowClear
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
            />
            <Select
              style={{ width: 180 }}
              placeholder="关系类型"
              value={filterRelationTypeId || undefined}
              onChange={setFilterRelationTypeId}
              allowClear
              options={relationTypes.map((t: any) => ({ value: t.id, label: t.displayName || t.name }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              disabled={!filterCourseId}
              style={canEdit ? undefined : { display: "none" }}
            >
              添加关系
            </Button>
            {(filterCourseId || filterRelationTypeId) && (
              <Button 
                onClick={() => {
                  setFilterCourseId("");
                  setFilterRelationTypeId("");
                }}
              >
                清除过滤
              </Button>
            )}
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={relations}
          rowKey="id"
          loading={relationsLoading}
          size="small"
          pagination={{ pageSize: 10, size: "small" }}
        />
      </Card>

      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        title="添加知识关系"
        onOk={() => createMutation.mutate(formData)}
        confirmLoading={createMutation.isPending}
        width={900}
      >
        <Form layout="vertical">
          <Form.Item label="课程" required>
            <Select
              value={selectedCourseId || undefined}
              onChange={setSelectedCourseId}
              loading={coursesLoading}
              options={courses.map((c) => ({ value: c.id, label: c.title }))}
              placeholder="选择课程"
            />
          </Form.Item>
          <Form.Item label="关系类型" required>
            <Select
              value={formData.relationTypeId || undefined}
              onChange={(v) => setFormData({ ...formData, relationTypeId: v })}
              options={relationTypes.map((t: any) => ({
                value: t.id,
                label: t.displayName || t.name,
              }))}
              placeholder="选择关系类型"
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="源知识点" required>
                <KnowledgeTreeSelect
                  value={formData.sourceKnowledgeId || undefined}
                  onChange={(v) =>
                    setFormData({ ...formData, sourceKnowledgeId: v })
                  }
                  treeData={knowledgeTreeData}
                  placeholder="选择源知识点"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="目标知识点" required>
                <KnowledgeTreeSelect
                  value={formData.targetKnowledgeId || undefined}
                  onChange={(v) =>
                    setFormData({ ...formData, targetKnowledgeId: v })
                  }
                  treeData={knowledgeTreeData}
                  placeholder="选择目标知识点"
                />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
