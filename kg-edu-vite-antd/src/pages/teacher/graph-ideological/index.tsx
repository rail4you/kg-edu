import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Typography,
  Table,
  Button,
  Select,
  Tag,
  Space,
  Alert,
  Spin,
  Popconfirm,
  Empty,
  message,
  Input,
  Tabs,
  Grid,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { generateReport } from "@/lib/agent_api";

import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import IdeologicalGraphChart from "./IdeologicalGraphChart";
import {
  CaseDialog,
  RelationDialogs,
  CaseDetailDrawer,
} from "./components";
import {
  useCoursesQuery,
  useKnowledgeQuery,
  useCasesQuery,
  useResourcesQuery,
  useRelationTypesQuery,
  useRelationsQuery,
  useCaseMutations,
  useRelationMutations,
  useKnowledgeMutations,
  useGraphData,
} from "./hooks";
import {
  IdeopoliticalNode,
  IdeopoliticalCase,
  IdeopoliticalRelationRow,
  KnowledgePoint,
  CaseDetail,
  KnowledgeResource,
} from "./types";
import { knowledgeTypeMap } from "./constants";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text } = Typography;

interface KnowledgeCase {
  knowledge: string;
  case: string;
}

interface GraphIdeologicalViewProps {
  courseId?: string;
  hideManagement?: boolean; // 隐藏管理功能（思政案例、思政关系配置）
}

export default function GraphIdeologicalView({ courseId: externalCourseId, hideManagement = false }: GraphIdeologicalViewProps) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();

  const tenantValue = currentTenant?.schemaName || "";

  // State
  const [internalCourseId, setInternalCourseId] = useState<string>("");
  // 使用外部传入的 courseId，如果没有则使用内部状态
  const selectedCourseId = externalCourseId || internalCourseId;
  const [knowledgeDrawerOpen, setKnowledgeDrawerOpen] = useState(false);
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState<KnowledgePoint | null>(null);
  const [caseDetailDrawerOpen, setCaseDetailDrawerOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseDetail | null>(null);
  // 右键菜单
  const [ctxMenuVisible, setCtxMenuVisible] = useState(false);
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 });
  const [ctxMenuData, setCtxMenuData] = useState<any>(null);
  // 移动端 Popover
  const [mobilePopoverOpen, setMobilePopoverOpen] = useState(false);
  const [mobilePopoverNode, setMobilePopoverNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("graph");
  const [showToolbox, setShowToolbox] = useState<boolean>(true);
  const [searchText, setSearchText] = useState<string>("");

  // Case dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    type: "knowledge" | "case";
    item?: any;
    isNew: boolean;
  } | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Relation dialog state
  const [relationCreateModalOpen, setRelationCreateModalOpen] = useState(false);
  const [relationUpdateModalOpen, setRelationUpdateModalOpen] = useState(false);
  const [relationDeleteConfirmOpen, setRelationDeleteConfirmOpen] = useState(false);
  const [selectedRelation, setSelectedRelation] = useState<IdeopoliticalRelationRow | null>(null);
  const [relationFormData, setRelationFormData] = useState({
    sourceKnowledgeId: "",
    targetKnowledgeId: "",
    relationTypeId: "",
  });

  // Report state
  const [showReport, setShowReport] = useState(false);
  const [reportContent, setReportContent] = useState("");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState("");

  // Data queries
  const { data: coursesData, isLoading: coursesLoading } = useCoursesQuery(user, tenantValue);
  const {
    data: knowledgeData,
    isLoading: knowledgeLoading,
  } = useKnowledgeQuery(selectedCourseId, user, tenantValue);
  const {
    data: casesData = [],
    isLoading: casesLoading,
  } = useCasesQuery(selectedCourseId, user, tenantValue);
  const { data: resourcesData, isLoading: resourcesLoading } = useResourcesQuery(
    selectedCourseId,
    user,
    tenantValue
  );
  const { data: relationTypesData, isLoading: relationTypesLoading } = useRelationTypesQuery(
    user,
    tenantValue
  );
  const {
    data: relationsData,
    isLoading: relationsLoading,
  } = useRelationsQuery(selectedCourseId, user, tenantValue);

  // Mutations
  const {
    createCaseMutation,
    updateCaseMutation,
    deleteCaseMutation,
  } = useCaseMutations(tenantValue, user, selectedCourseId);

  const {
    createRelationMutation,
    updateRelationMutation,
    deleteRelationMutation,
  } = useRelationMutations(tenantValue, user, selectedCourseId, () => {
    setRelationCreateModalOpen(false);
    resetRelationForm();
  });

  const {
    createKnowledgeMutation,
    updateKnowledgeMutation,
    deleteKnowledgeMutation,
  } = useKnowledgeMutations(tenantValue, user, selectedCourseId);

  // Processed data
  const processedRelations = React.useMemo(() => {
    if (!relationsData) return [];

    return relationsData.map((relation: any) => ({
      id: relation.id,
      relationTypeName: relation.relationType?.name || "",
      relationTypeDisplayName: relation.relationType?.displayName || "",
      sourceKnowledgeName: relation.sourceKnowledge?.name || "",
      targetKnowledgeName: relation.targetKnowledge?.name || "",
      sourceKnowledgeType: relation.sourceKnowledge?.knowledgeType
        ? knowledgeTypeMap[relation.sourceKnowledge.knowledgeType as keyof typeof knowledgeTypeMap]
        : "",
      targetKnowledgeType: relation.targetKnowledge?.knowledgeType
        ? knowledgeTypeMap[relation.targetKnowledge.knowledgeType as keyof typeof knowledgeTypeMap]
        : "",
      sourceKnowledgeId: relation.sourceKnowledgeId,
      targetKnowledgeId: relation.targetKnowledgeId,
      relationTypeId: relation.relationTypeId,
    }));
  }, [relationsData]);

  // Graph data
  const graphData = useGraphData(knowledgeData, casesData, processedRelations);

  // 搜索高亮：根据搜索词标记匹配的节点
  const searchLower = searchText.toLowerCase().trim();
  const highlightedGraphData = useMemo(() => {
    if (!searchLower || !graphData.nodes?.length) return graphData;
    const matchedIds = new Set<string>();
    graphData.nodes.forEach((node: any) => {
      if (node.name?.toLowerCase().includes(searchLower)) {
        matchedIds.add(node.id);
      }
    });
    // 也匹配边的关联节点
    graphData.links?.forEach((link: any) => {
      if (matchedIds.has(link.source) || matchedIds.has(link.target)) {
        // 标记关联节点也高亮（可选）
      }
    });
    const updatedNodes = graphData.nodes.map((node: any) => {
      const isMatch = matchedIds.has(node.id);
      if (isMatch) {
        return {
          ...node,
          itemStyle: {
            ...(node.itemStyle || {}),
            borderColor: "#f87171",
            borderWidth: 3,
            shadowBlur: 10,
            shadowColor: "rgba(239, 68, 68, 0.3)",
          },
          label: {
            ...(node.label || {}),
            color: "#dc2626",
            fontWeight: "bold",
          },
        };
      }
      return {
        ...node,
        itemStyle: {
          ...(node.itemStyle || {}),
          opacity: 0.4,
        },
        label: {
          ...(node.label || {}),
          color: "#999",
        },
      };
    });
    const updatedLinks = (graphData.links || []).map((link: any) => {
      const sourceMatch = matchedIds.has(link.source);
      const targetMatch = matchedIds.has(link.target);
      if (sourceMatch || targetMatch) {
        return { ...link, lineStyle: { ...(link.lineStyle || {}), opacity: 0.8, width: 2 } };
      }
      return { ...link, lineStyle: { ...(link.lineStyle || {}), opacity: 0.15 } };
    });
    return { ...graphData, nodes: updatedNodes, links: updatedLinks };
  }, [graphData, searchLower]);

  const ideopoliticalResources = React.useMemo(() => {
    if (!resourcesData?.flat || !knowledgeData) return [];
    const ideopoliticalIds = new Set(knowledgeData.map((k: any) => k.id));
    return resourcesData.flat.filter((r: KnowledgeResource) => ideopoliticalIds.has(r.id));
  }, [resourcesData, knowledgeData]);

  // Table columns - 根据 hideManagement 隐藏操作列
  const knowledgeColumns: TableColumnsType<any> = [
    { title: "知识点名称", dataIndex: "name", key: "name", width: 200, ellipsis: true },
    {
      title: "标签",
      dataIndex: "tag",
      key: "tag",
      width: 150,
      render: (value: string) => <Tag color="blue">{value || "无标签"}</Tag>,
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 300,
      ellipsis: true,
      render: (value: string) =>
        value ? (
          <Tooltip title={value} mouseEnterDelay={0.3}>
            <Text type="secondary">{value}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
  ];

  if (!hideManagement) {
    knowledgeColumns.push({
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditKnowledge(record)}
          />
          <Popconfirm
            title="确定要删除这个知识点吗？"
            onConfirm={() => handleDeleteKnowledge(record.id)}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  const casesColumns: TableColumnsType<IdeopoliticalCase> = [
    { title: "案例标题", dataIndex: "title", key: "title", width: 200, ellipsis: true },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 200,
      ellipsis: true,
      render: (value: string) => value || "-",
    },
    {
      title: "案例内容",
      dataIndex: "content",
      key: "content",
      width: 300,
      ellipsis: true,
      render: (value: string) => value || "-",
    },
    {
      title: "关联知识点",
      dataIndex: ["knowledgeResource", "name"],
      key: "knowledgeResource",
      width: 200,
      render: (_: any, record: IdeopoliticalCase) =>
        record?.knowledgeResource?.name || "未关联",
    },
    {
      title: "关联名称",
      dataIndex: "caseRelationName",
      key: "caseRelationName",
      width: 150,
      ellipsis: true,
      render: (value: string) => value || "-",
    },
  ];

  if (!hideManagement) {
    casesColumns.push({
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: IdeopoliticalCase) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record, "case")}
          />
          <Popconfirm
            title="确定要删除这个思政案例吗？"
            onConfirm={() => handleDelete(record.id, "case")}
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    });
  }

  const relationsColumns: TableColumnsType<IdeopoliticalRelationRow> = [
    {
      title: "关系类型",
      dataIndex: "relationTypeDisplayName",
      key: "relationTypeDisplayName",
      width: 150,
    },
    {
      title: "源知识",
      dataIndex: "sourceKnowledgeName",
      key: "sourceKnowledgeName",
      width: 250,
      render: (_: any, record: IdeopoliticalRelationRow) => (
        <div>
          <Text strong>{record.sourceKnowledgeName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.sourceKnowledgeType}
          </Text>
        </div>
      ),
    },
    {
      title: "目标知识",
      dataIndex: "targetKnowledgeName",
      key: "targetKnowledgeName",
      width: 250,
      render: (_: any, record: IdeopoliticalRelationRow) => (
        <div>
          <Text strong>{record.targetKnowledgeName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.targetKnowledgeType}
          </Text>
        </div>
      ),
    },
  ];

  if (!hideManagement) {
    relationsColumns.unshift({
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: IdeopoliticalRelationRow) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleUpdateRelation(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRelation(record)}
          />
        </Space>
      ),
    });
  }

  // Handlers
  const resetRelationForm = () => {
    setRelationFormData({
      sourceKnowledgeId: "",
      targetKnowledgeId: "",
      relationTypeId: "",
    });
  };

  const handleCreateRelation = () => {
    setRelationCreateModalOpen(true);
    resetRelationForm();
  };

  const confirmCreateRelation = () => {
    if (
      relationFormData.sourceKnowledgeId &&
      relationFormData.targetKnowledgeId &&
      relationFormData.relationTypeId &&
      relationFormData.sourceKnowledgeId !== relationFormData.targetKnowledgeId
    ) {
      const isDuplicate = processedRelations.some(
        (r) =>
          r.sourceKnowledgeId === relationFormData.sourceKnowledgeId &&
          r.targetKnowledgeId === relationFormData.targetKnowledgeId &&
          r.relationTypeId === relationFormData.relationTypeId
      );

      if (isDuplicate) {
        message.error("该关系已存在，请勿重复创建");
        return;
      }

      createRelationMutation.mutate(relationFormData);
    }
  };

  const handleUpdateRelation = (relation: IdeopoliticalRelationRow) => {
    setSelectedRelation(relation);
    setRelationFormData({
      sourceKnowledgeId: relation.sourceKnowledgeId,
      targetKnowledgeId: relation.targetKnowledgeId,
      relationTypeId: relation.relationTypeId,
    });
    setRelationUpdateModalOpen(true);
  };

  const confirmUpdateRelation = () => {
    if (
      selectedRelation &&
      relationFormData.sourceKnowledgeId &&
      relationFormData.targetKnowledgeId &&
      relationFormData.relationTypeId &&
      relationFormData.sourceKnowledgeId !== relationFormData.targetKnowledgeId
    ) {
      updateRelationMutation.mutate({
        id: selectedRelation.id,
        updateData: relationFormData,
      });
    }
  };

  const handleDeleteRelation = (relation: IdeopoliticalRelationRow) => {
    setSelectedRelation(relation);
    setRelationDeleteConfirmOpen(true);
  };

  const confirmDeleteRelation = () => {
    if (selectedRelation) {
      deleteRelationMutation.mutate(selectedRelation.id);
    }
  };

  const handleAdd = (type: "knowledge" | "case") => {
    if (type === "case") {
      setEditingItem({ type, isNew: true });
      setFormData({
        title: "",
        content: "",
        knowledgeResourceId: "",
        caseRelationName: "",
      });
      setDialogOpen(true);
    } else if (type === "knowledge") {
      setEditingItem({ type, isNew: true });
      setFormData({
        name: "",
        description: "",
        tag: "课程思政",
        subject: "",
        unit: "",
        importanceLevel: "normal",
      });
      setDialogOpen(true);
    }
  };

  const handleEdit = (item: any, type: "knowledge" | "case") => {
    if (type === "case") {
      setEditingItem({ type, item, isNew: false });
      setFormData({
        title: item.title,
        content: item.content,
        description: item.description || "",
        caseRelationName: item.caseRelationName || "",
      });
      setDialogOpen(true);
    } else if (type === "knowledge") {
      setEditingItem({ type, item, isNew: false });
      setFormData({
        name: item.name,
        description: item.description || "",
        tag: item.tag || "课程思政",
        subject: item.subject || "",
        unit: item.unit || "",
        importanceLevel: item.importanceLevel || "normal",
      });
      setDialogOpen(true);
    }
  };

  const handleEditKnowledge = (record: any) => {
    handleEdit(record, "knowledge");
  };

  const handleDeleteKnowledge = async (id: string) => {
    await deleteKnowledgeMutation.mutateAsync(id);
  };

  const handleDelete = async (id: string, type: "knowledge" | "case") => {
    if (type === "case") {
      await deleteCaseMutation.mutateAsync(id);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleFormSubmit = async () => {
    if (editingItem?.type === "case") {
      try {
        if (editingItem.isNew) {
          await createCaseMutation.mutateAsync(formData);
        } else {
          await updateCaseMutation.mutateAsync({
            id: editingItem.item.id,
            data: formData,
          });
        }
      } catch (_err) {
        // Error already handled by mutation's onError callback
        return;
      }
      handleDialogClose();
    } else if (editingItem?.type === "knowledge") {
      const knowledgeData = {
        name: formData.name || "",
        description: formData.description,
        tag: formData.tag,
        importanceLevel: formData.importanceLevel,
      };
      try {
        if (editingItem.isNew) {
          await createKnowledgeMutation.mutateAsync(knowledgeData);
        } else {
          await updateKnowledgeMutation.mutateAsync({
            id: editingItem.item.id,
            ...knowledgeData,
          });
        }
      } catch (_err) {
        // Error already handled by mutation's onError callback
        return;
      }
      handleDialogClose();
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGraphNodeClick = useCallback(
    (params: any) => {
      if (params.dataType === "node") {
        const nodeData = params.data as IdeopoliticalNode;
        if (isMobile) {
          // 移动端：显示底部弹出选择
          params.event?.event?.preventDefault?.();
          setMobilePopoverNode(nodeData);
          setMobilePopoverOpen(true);
          return;
        }
        // 桌面端：直接打开详情
        if (nodeData.category === 0) {
          setSelectedKnowledgePoint({
            id: nodeData.id,
            name: nodeData.name,
            description: nodeData.description,
            knowledgeType: "ideological",
          });
          setKnowledgeDrawerOpen(true);
        }
        if (nodeData.category === 1 && Array.isArray(casesData)) {
          const caseDetail = casesData.find((c: any) => c.id === nodeData.id);
          if (caseDetail) {
            setSelectedCase(caseDetail);
            setCaseDetailDrawerOpen(true);
          }
        }
      }
    },
    [casesData, isMobile]
  );

  // 右键菜单处理
  const handleGraphNodeContextMenu = useCallback(
    (params: any) => {
      if (params.dataType === "node") {
        params.event?.event?.preventDefault?.();
        setCtxMenuPos({ x: params.event.event?.clientX || 0, y: params.event.event?.clientY || 0 });
        setCtxMenuData(params.data);
        setCtxMenuVisible(true);
      }
    },
    []
  );

  const handleGenerateReport = useCallback(async () => {
    if (!knowledgeData || !casesData || !tenantValue) {
      setReportError("缺少必要数据，请先选择课程");
      return;
    }

    setIsGeneratingReport(true);
    setShowReport(false);
    setReportError("");
    setReportContent("");

    try {
      const knowledgeCases: KnowledgeCase[] = [];

      const casesByKnowledge: Map<string, any[]> = new Map();
      casesData.forEach((caseItem: any) => {
        if (caseItem.knowledgeResourceId) {
          const knowledgeId = String(caseItem.knowledgeResourceId);
          if (!casesByKnowledge.has(knowledgeId)) {
            casesByKnowledge.set(knowledgeId, []);
          }
          casesByKnowledge.get(knowledgeId)!.push(caseItem);
        }
      });

      knowledgeData.forEach((knowledge: any) => {
        const knowledgeId = String(knowledge.id);
        const relatedCases = casesByKnowledge.get(knowledgeId) || [];

        if (relatedCases.length > 0) {
          relatedCases.forEach((caseItem: any) => {
            knowledgeCases.push({
              knowledge: knowledge.name,
              case: caseItem.title || caseItem.description || caseItem.content || "无案例内容",
            });
          });
        } else {
          knowledgeCases.push({
            knowledge: knowledge.name,
            case: "暂无相关案例",
          });
        }
      });

      const result = await generateReport({
        knowledgeCases,
        orgSchema: tenantValue,
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        setReportContent((result.data as string) || "报告已生成，请到AI教案部分查看");
        setShowReport(true);
      } else {
        setReportError((result as any).message || "生成报告失败");
        setShowReport(true);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      setReportError(error instanceof Error ? error.message : "生成报告时发生错误");
      setShowReport(true);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [knowledgeData, casesData, tenantValue, user]);



  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="用户未登录，请登录以访问思政图谱。" />
      </div>
    );
  }

  // 让 Tabs 内容区自动撑满剩余空间
  const flexTabsStyle = {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties;

  return (
    <div
      style={{
        height: "100%",
        minHeight: hideManagement ? 0 : "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#fff",
      }}
    >
      {/* 课程选择独立一行 */}
      {!hideManagement && (
        <div style={{ padding: isMobile ? "8px 8px" : "12px 24px", backgroundColor: "white", borderBottom: "1px solid #e0e0e0" }}>
          <Space direction={isMobile ? "vertical" : "horizontal"} style={{ width: isMobile ? "100%" : "auto" }}>
            <Text strong style={{ fontSize: isMobile ? 13 : 14 }}>课程选择：</Text>
            <Select
              value={selectedCourseId || undefined}
              placeholder="请选择课程"
              style={{ width: isMobile ? "100%" : 280, minWidth: isMobile ? "100%" : 280 }}
              onChange={(value) => setInternalCourseId(value)}
              allowClear
              options={(Array.isArray(coursesData) ? coursesData : []).map((course: any) => ({
                label: course.title,
                value: course.id,
              }))}
            />
          </Space>
        </div>
      )}

      {/* 子 Tab 切换：思政图谱 / 思政知识点 / 思政案例 / 思政关系配置 */}
      {/* Tab 栏 */}
      <div style={{
        display: "flex",
        gap: 0,
        flexShrink: 0,
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        paddingLeft: isMobile ? 8 : 24,
        paddingRight: isMobile ? 8 : 24,
      }}>
        {[
          { key: "graph", label: "思政图谱" },
          { key: "knowledge", label: `思政知识点 (${knowledgeData?.length ?? 0})` },
          { key: "case", label: `思政案例 (${casesData?.length ?? 0})` },
          { key: "relation", label: `思政关系配置 (${processedRelations.length})` },
        ].map((tab) => (
          <button
            type="button"
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              border: "none",
              borderBottom: activeTab === tab.key ? `2px solid ${colors.primary}` : "2px solid transparent",
              background: "transparent",
              color: activeTab === tab.key ? colors.primary : "#5A5D66",
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: 14,
              cursor: "pointer",
              outline: "none",
              whiteSpace: "nowrap",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 — 条件渲染 + key 强制挂载/卸载 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div key={activeTab} style={{ width: "100%", height: "100%" }}>
          {activeTab === "graph" && (
            <IdeologicalGraphChart
              highlightedGraphData={highlightedGraphData}
              casesData={casesData}
              searchText={searchText}
              onNodeClick={handleGraphNodeClick}
              onNodeContextMenu={handleGraphNodeContextMenu}
            />
          )}
          {activeTab === "knowledge" && (
            <div style={{ padding: isMobile ? "8px 8px" : "16px 24px", overflow: "auto", height: "100%" }}>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center" }}>
                <Title level={5} style={{ margin: 0, fontSize: isMobile ? 14 : 18 }}>
                  带有"课程思政"标签的知识点 ({knowledgeData?.length || 0} 个)
                </Title>
                {!hideManagement && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd("knowledge")}>
                    添加知识点
                  </Button>
                )}
              </div>
              <Table
                columns={knowledgeColumns}
                dataSource={knowledgeData || []}
                rowKey="id"
                loading={knowledgeLoading}
                scroll={{ x: 800 }}
                pagination={{ pageSize: isMobile ? 5 : 10, showSizeChanger: !isMobile, showTotal: (total: number) => `共 ${total} 条` }}
              />
            </div>
          )}
          {activeTab === "case" && (
            <div style={{ padding: isMobile ? "8px 8px" : "16px 24px", overflow: "auto", height: "100%" }}>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center" }}>
                <Title level={5} style={{ margin: 0, fontSize: isMobile ? 14 : 18 }}>
                  思政案例列表 ({casesData?.length || 0} 个)
                </Title>
                {!hideManagement && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleAdd("case")}>
                    添加案例
                  </Button>
                )}
              </div>
              <Table
                columns={casesColumns}
                dataSource={casesData || []}
                rowKey="id"
                loading={casesLoading}
                scroll={{ x: 800 }}
                pagination={{ pageSize: isMobile ? 5 : 10, showSizeChanger: !isMobile, showTotal: (total: number) => `共 ${total} 条` }}
              />
            </div>
          )}
          {activeTab === "relation" && (
            <div style={{ padding: isMobile ? "8px 8px" : "16px 24px", overflow: "auto", height: "100%" }}>
              <div style={{ marginBottom: 12, display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, justifyContent: "space-between", alignItems: isMobile ? "stretch" : "center" }}>
                <Title level={5} style={{ margin: 0, fontSize: isMobile ? 14 : 18 }}>
                  思政知识点关系 ({processedRelations.length} 个)
                </Title>
                {!hideManagement && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateRelation}>
                    创建关系
                  </Button>
                )}
              </div>
              <Table
                columns={relationsColumns}
                dataSource={processedRelations}
                rowKey="id"
                loading={relationsLoading}
                scroll={{ x: 800 }}
                pagination={{ pageSize: isMobile ? 5 : 10, showSizeChanger: !isMobile, showTotal: (total: number) => `共 ${total} 条` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Case Dialog */}
      <CaseDialog
        open={dialogOpen}
        editingItem={editingItem}
        formData={formData}
        knowledgeData={knowledgeData || []}
        isLoading={
          createCaseMutation.isPending ||
          updateCaseMutation.isPending ||
          createKnowledgeMutation.isPending ||
          updateKnowledgeMutation.isPending
        }
        onClose={handleDialogClose}
        onSubmit={handleFormSubmit}
        onFormChange={handleFormChange}
      />

      {/* Relation Dialogs */}
      <RelationDialogs
        createModalOpen={relationCreateModalOpen}
        createLoading={createRelationMutation.isPending}
        createError={createRelationMutation.error as Error | null}
        relationFormData={relationFormData}
        relationTypesData={relationTypesData || []}
        relationTypesLoading={relationTypesLoading}
        knowledgeData={knowledgeData || []}
        resourcesLoading={resourcesLoading}
        onCreateClose={() => {
          setRelationCreateModalOpen(false);
          resetRelationForm();
        }}
        onCreateSubmit={confirmCreateRelation}
        onRelationFormChange={setRelationFormData}
        updateModalOpen={relationUpdateModalOpen}
        updateLoading={updateRelationMutation.isPending}
        updateError={updateRelationMutation.error as Error | null}
        selectedRelation={selectedRelation}
        onUpdateClose={() => {
          setRelationUpdateModalOpen(false);
          setSelectedRelation(null);
        }}
        onUpdateSubmit={confirmUpdateRelation}
        deleteModalOpen={relationDeleteConfirmOpen}
        deleteLoading={deleteRelationMutation.isPending}
        onDeleteClose={() => {
          setRelationDeleteConfirmOpen(false);
          setSelectedRelation(null);
        }}
        onDeleteSubmit={confirmDeleteRelation}
        relationsData={processedRelations}
      />

      {/* Case Detail Drawer */}
      <CaseDetailDrawer
        open={caseDetailDrawerOpen}
        caseDetail={selectedCase}
        onClose={() => setCaseDetailDrawerOpen(false)}
      />

      {/* 右键菜单 */}
      {ctxMenuVisible && ctxMenuData && (
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
              {ctxMenuData.name || ctxMenuData.label}
            </div>
            <div
              style={{ padding: "8px 14px", cursor: "pointer", fontSize: 13 }}
              onClick={() => {
                setCtxMenuVisible(false);
                const nd = ctxMenuData;
                if (nd.category === 0) {
                  setSelectedKnowledgePoint({ id: nd.id, name: nd.name, description: nd.description, knowledgeType: "ideological" });
                  setKnowledgeDrawerOpen(true);
                } else if (nd.category === 1) {
                  const cd = casesData.find((c: any) => c.id === nd.id);
                  if (cd) { setSelectedCase(cd); setCaseDetailDrawerOpen(true); }
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
              {mobilePopoverNode.name || mobilePopoverNode.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                block
                size="large"
                type="primary"
                onClick={() => {
                  setMobilePopoverOpen(false);
                  if (mobilePopoverNode.category === 0) {
                    setSelectedKnowledgePoint({ id: mobilePopoverNode.id, name: mobilePopoverNode.name, description: mobilePopoverNode.description, knowledgeType: "ideological" });
                    setKnowledgeDrawerOpen(true);
                  } else if (mobilePopoverNode.category === 1) {
                    const cd = casesData.find((c: any) => c.id === mobilePopoverNode.id);
                    if (cd) { setSelectedCase(cd); setCaseDetailDrawerOpen(true); }
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

      {/* Knowledge Resource Panel */}
      <KnowledgeResourcePanel
        open={knowledgeDrawerOpen}
        onClose={() => setKnowledgeDrawerOpen(false)}
        knowledge={selectedKnowledgePoint}
      />
    </div>
  );
}
