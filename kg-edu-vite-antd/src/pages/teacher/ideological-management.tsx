import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Alert,
  Tabs,
  Modal,
  Input,
  Select,
  Tag,
  Spin,
  Table,
  Space,
  message,
  Popconfirm,
} from "antd";
import type { TabsProps, TableColumnsType } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useCourses } from "@/hooks/use-courses";
import {
  listKnowledges,
  createUserCase,
  updateUserCase,
  destroyUserCase,
  listUserCases,
  listRelations,
  createRelation,
  destroyRelation,
  updateRelation,
  listRelationTypes,
  getFullHierarchy,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface IdeopoliticalKnowledge {
  id: string;
  name: string;
  subject: string;
  unit: string;
  tag: string;
  description: string;
  courseId: string;
}

interface IdeopoliticalCase {
  id: string;
  title: string;
  content: string;
  knowledgeResourceId: string;
  knowledgeResource?: {
    name: string;
  };
  courseId: string;
  caseRelationName?: string | null;
}

interface IdeopoliticalRelationRow {
  id: string;
  relationTypeName: string;
  relationTypeDisplayName: string;
  sourceKnowledgeName: string;
  targetKnowledgeName: string;
  sourceKnowledgeType: string;
  targetKnowledgeType: string;
  sourceKnowledgeId: string;
  targetKnowledgeId: string;
  relationTypeId: string;
}

interface RelationType {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
}

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string | null;
  unit?: string | null;
}

const knowledgeTypeMap = {
  subject: "主题",
  knowledge_unit: "知识单元",
  knowledge_cell: "知识点",
} as const;

const extractArrayData = (result: any): any[] => {
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
};

const getHeaders = (user: any): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const groupResourcesByHierarchy = (resources: KnowledgeResource[]) => {
  const subjects = resources.filter((r) => r.knowledgeType === "subject");
  const units = resources.filter((r) => r.knowledgeType === "knowledge_unit");
  const cells = resources.filter((r) => r.knowledgeType === "knowledge_cell");

  return { subjects, units, cells };
};

const getKnowledgeDisplayName = (
  knowledgeId: string,
  resources: KnowledgeResource[],
) => {
  if (!knowledgeId) return "请选择";

  const resource = resources.find((r) => r.id === knowledgeId);
  if (!resource) return knowledgeId;

  if (resource.knowledgeType === "subject") {
    return resource.name;
  } else if (resource.knowledgeType === "knowledge_unit") {
    return `${resource.subject || ""} - ${resource.name}`;
  } else {
    return `${resource.subject || ""} - ${resource.unit || ""} - ${resource.name}`;
  }
};

const renderKnowledgeOptions = (
  resources: KnowledgeResource[],
  excludedId?: string,
) => {
  const { subjects, units, cells } = groupResourcesByHierarchy(resources);

  const options: Array<{ label: string; value: string; disabled?: boolean }> =
    [];

  const filterExcluded = (resource: KnowledgeResource) =>
    resource.id !== excludedId;

  const filteredSubjects = subjects.filter(filterExcluded);
  if (filteredSubjects.length > 0) {
    options.push({
      label: "--- 主题 ---",
      value: "header-subjects",
      disabled: true,
    });
    filteredSubjects.forEach((resource) => {
      options.push({
        label: resource.name,
        value: resource.id,
      });
    });
  }

  const filteredUnits = units.filter(filterExcluded);
  if (filteredUnits.length > 0) {
    options.push({
      label: "--- 知识单元 ---",
      value: "header-units",
      disabled: true,
    });
    filteredUnits.forEach((resource) => {
      options.push({
        label: `${resource.subject || ""} - ${resource.name}`,
        value: resource.id,
      });
    });
  }

  const filteredCells = cells.filter(filterExcluded);
  if (filteredCells.length > 0) {
    options.push({
      label: "--- 知识点 ---",
      value: "header-cells",
      disabled: true,
    });
    filteredCells.forEach((resource) => {
      options.push({
        label: `${resource.subject || ""} - ${resource.unit || ""} - ${resource.name}`,
        value: resource.id,
      });
    });
  }

  return options;
};

export default function IdeologicalManagement() {
  const { user, loading: authLoading } = useAuth();
  const { canEdit } = useEditPermission();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const [tabValue, setTabValue] = useState("0");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const [relationCreateModalOpen, setRelationCreateModalOpen] = useState(false);
  const [relationUpdateModalOpen, setRelationUpdateModalOpen] = useState(false);
  const [relationDeleteConfirmOpen, setRelationDeleteConfirmOpen] =
    useState(false);
  const [selectedRelation, setSelectedRelation] =
    useState<IdeopoliticalRelationRow | null>(null);
  const [relationFormData, setRelationFormData] = useState({
    sourceKnowledgeId: "",
    targetKnowledgeId: "",
    relationTypeId: "",
  });

  const tenant = currentTenant?.schemaName || "";

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <Alert type="error" message="用户未登录，请登录以访问思政图谱管理。" />
    );
  }

  const { courses: coursesData = [], loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  const {
    data: knowledgeData = [],
    isLoading: knowledgeLoading,
    refetch: refetchKnowledge,
  } = useQuery({
    queryKey: ["ideopolitical-knowledge", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) {
        return [];
      }

      const result = await listKnowledges({
        tenant,
        fields: [
          "id",
          "name",
          "subject",
          "unit",
          "tag",
          "description",
          "courseId",
        ],
        filter: {
          courseId: { eq: selectedCourseId },
        },
        headers: getHeaders(user),
      });

      const allData = extractArrayData(result);
      const filteredData = allData.filter(
        (k: any) => k.tag && k.tag.includes("课程思政"),
      );
      return filteredData;
    },
    enabled: !!selectedCourseId && !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: casesData,
    isLoading: casesLoading,
    refetch: refetchCases,
  } = useQuery({
    queryKey: ["ideopolitical-cases", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) {
        return [];
      }

      const result = await listUserCases({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "content",
          "caseRelationName",
          "knowledgeResourceId",
          { knowledgeResource: ["id", "name", "courseId"] },
        ],
        filter: {
          knowledgeResource: {
            courseId: { eq: selectedCourseId },
          },
        },
        headers: getHeaders(user),
      });

      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const createCaseMutation = useMutation({
    mutationFn: async (data: any) => {
      const result = await createUserCase({
        tenant,
        input: {
          title: data.title,
          content: data.content,
          knowledgeResourceId: data.knowledgeResourceId,
          caseRelationName: data.caseRelationName || null,
        },
        fields: [
          "id",
          "title",
          "content",
          "knowledgeResourceId",
          "caseRelationName",
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "Failed to create case");
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例创建成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-cases"] });
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({});
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateCaseMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const result = await updateUserCase({
        tenant,
        primaryKey: id,
        input: {
          title: data.title,
          content: data.content,
          description: data.description || "",
          caseRelationName: data.caseRelationName || null,
        },
        fields: [
          "id",
          "title",
          "content",
          "knowledgeResourceId",
          "caseRelationName",
        ],
        headers: getHeaders(user),
      });

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "Failed to update case");
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例更新成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-cases"] });
      setDialogOpen(false);
      setEditingItem(null);
      setFormData({});
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteCaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyUserCase({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });

      if (!result.success) {
        throw new Error(result.errors?.[0]?.message || "Failed to delete case");
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("案例删除成功");
      queryClient.invalidateQueries({ queryKey: ["ideopolitical-cases"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  const { data: resourcesData = [], isLoading: resourcesLoading } = useQuery({
    queryKey: ["ideopolitical-resources", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const result = await getFullHierarchy({
        tenant,
        input: { courseId: selectedCourseId },
        fields: [
          "id",
          "name",
          "knowledgeType",
          "subject",
          "unit",
          {
            childUnits: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              {
                childCells: ["id", "name", "knowledgeType", "subject", "unit"],
              },
            ],
          },
        ],
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to fetch knowledge resources",
        );
      }

      const flatResources: any[] = [];
      const hierarchyData = result.data;

      if (Array.isArray(hierarchyData)) {
        hierarchyData.forEach((subject: any) => {
          flatResources.push({
            id: subject.id,
            name: subject.name,
            knowledgeType: subject.knowledgeType,
            subject: subject.subject,
            unit: subject.unit,
          });

          if (subject.childUnits && Array.isArray(subject.childUnits)) {
            subject.childUnits.forEach((unit: any) => {
              flatResources.push({
                id: unit.id,
                name: unit.name,
                knowledgeType: unit.knowledgeType,
                subject: unit.subject,
                unit: unit.unit,
              });

              if (unit.childCells && Array.isArray(unit.childCells)) {
                unit.childCells.forEach((cell: any) => {
                  flatResources.push({
                    id: cell.id,
                    name: cell.name,
                    knowledgeType: cell.knowledgeType,
                    subject: cell.subject,
                    unit: cell.unit,
                  });
                });
              }
            });
          }
        });
      }

      return flatResources;
    },
    enabled: !!selectedCourseId && !!tenant,
    staleTime: 10 * 60 * 1000,
  });

  const { data: relationTypesData, isLoading: relationTypesLoading } = useQuery(
    {
      queryKey: ["relation-types"],
      queryFn: async () => {
        const result = await listRelationTypes({
          tenant,
          fields: ["id", "name", "displayName", "description"],
          sort: "displayName",
          headers: buildCSRFHeaders() as Record<string, string>,
        });

        if (!result.success) {
          throw new Error(
            result.errors?.[0]?.message || "Failed to fetch relation types",
          );
        }
        return extractArrayData(result);
      },
      enabled: !!tenant,
      staleTime: 10 * 60 * 1000,
    },
  );

  const {
    data: relationsData,
    isLoading: relationsLoading,
    refetch: refetchRelations,
  } = useQuery({
    queryKey: ["ideopolitical-relations", selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return [];

      const result = await listRelations({
        tenant,
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          {
            relationType: ["id", "name", "displayName"],
          },
          {
            sourceKnowledge: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "tag",
            ],
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
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to fetch knowledge relations",
        );
      }

      const allRelations = extractArrayData(result);
      const filteredRelations = allRelations.filter(
        (r: any) =>
          r.sourceKnowledge?.tag && r.sourceKnowledge.tag.includes("课程思政"),
      );
      return filteredRelations;
    },
    enabled: !!selectedCourseId && !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const createRelationMutation = useMutation({
    mutationFn: async (data: typeof relationFormData) => {
      const result = await createRelation({
        tenant,
        input: {
          sourceKnowledgeId: data.sourceKnowledgeId,
          targetKnowledgeId: data.targetKnowledgeId,
          relationTypeId: data.relationTypeId,
        },
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
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to create knowledge relation",
        );
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系创建成功");
      queryClient.invalidateQueries({
        queryKey: ["ideopolitical-relations", selectedCourseId],
      });
      setRelationCreateModalOpen(false);
      resetRelationForm();
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      updateData: typeof relationFormData;
    }) => {
      const result = await updateRelation({
        tenant,
        primaryKey: data.id,
        input: {
          relationTypeId: data.updateData.relationTypeId,
          sourceKnowledgeId: data.updateData.sourceKnowledgeId,
          targetKnowledgeId: data.updateData.targetKnowledgeId,
        },
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
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to update knowledge relation",
        );
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系更新成功");
      queryClient.invalidateQueries({
        queryKey: ["ideopolitical-relations", selectedCourseId],
      });
      setRelationUpdateModalOpen(false);
      setSelectedRelation(null);
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteRelationMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyRelation({
        tenant,
        primaryKey: id,
        headers: buildCSRFHeaders() as Record<string, string>,
      });

      if (!result.success) {
        throw new Error(
          result.errors?.[0]?.message || "Failed to delete knowledge relation",
        );
      }

      return result.data;
    },
    onSuccess: () => {
      message.success("关系删除成功");
      queryClient.invalidateQueries({
        queryKey: ["ideopolitical-relations", selectedCourseId],
      });
      setRelationDeleteConfirmOpen(false);
      setSelectedRelation(null);
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  const knowledgeColumns: TableColumnsType<IdeopoliticalKnowledge> = [
    { title: "知识点名称", dataIndex: "name", key: "name", width: 200, ellipsis: true },
    {
      title: "标签",
      dataIndex: "tag",
      key: "tag",
      width: 150,
      render: (value: string) => <Tag color="blue">{value || "无标签"}</Tag>,
    },
    { title: "学科", dataIndex: "subject", key: "subject", width: 150 },
    { title: "单元", dataIndex: "unit", key: "unit", width: 150 },
    { title: "描述", dataIndex: "description", key: "description", width: 300, ellipsis: true },
  ];

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
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: IdeopoliticalCase) => (
        <Space>
          <ReadonlyActionButton
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record, "case")}
          />
          <Popconfirm
            title="确定要删除这个思政案例吗？"
            onConfirm={() => handleDelete(record.id, "case")}
          >
            <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const processedRelations = React.useMemo(() => {
    if (!relationsData) return [];

    return relationsData.map((relation: any) => ({
      id: relation.id,
      relationTypeName: relation.relationType?.name || "",
      relationTypeDisplayName: relation.relationType?.displayName || "",
      sourceKnowledgeName: relation.sourceKnowledge?.name || "",
      targetKnowledgeName: relation.targetKnowledge?.name || "",
      sourceKnowledgeType: relation.sourceKnowledge?.knowledgeType
        ? knowledgeTypeMap[
            relation.sourceKnowledge
              .knowledgeType as keyof typeof knowledgeTypeMap
          ]
        : "",
      targetKnowledgeType: relation.targetKnowledge?.knowledgeType
        ? knowledgeTypeMap[
            relation.targetKnowledge
              .knowledgeType as keyof typeof knowledgeTypeMap
          ]
        : "",
      sourceKnowledgeId: relation.sourceKnowledgeId,
      targetKnowledgeId: relation.targetKnowledgeId,
      relationTypeId: relation.relationTypeId,
    }));
  }, [relationsData]);

  const ideopoliticalResources = React.useMemo(() => {
    if (!resourcesData || !knowledgeData) return [];
    const ideopoliticalIds = new Set(knowledgeData.map((k: any) => k.id));
    return resourcesData.filter((r: KnowledgeResource) =>
      ideopoliticalIds.has(r.id),
    );
  }, [resourcesData, knowledgeData]);

  const relationsColumns: TableColumnsType<IdeopoliticalRelationRow> = [
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: any, record: IdeopoliticalRelationRow) => (
        <Space>
          <ReadonlyActionButton
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleUpdateRelation(record)}
          />
          <ReadonlyActionButton
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRelation(record)}
          />
        </Space>
      ),
    },
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
    }
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
      if (editingItem.isNew) {
        await createCaseMutation.mutateAsync(formData);
      } else {
        await updateCaseMutation.mutateAsync({
          id: editingItem.item.id,
          data: formData,
        });
      }
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const renderKnowledgeTab = () => {
    if (!selectedCourseId) {
      return <Alert type="info" message="请先选择一个课程" />;
    }

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Title level={5}>
            带有"课程思政"标签的知识点 ({knowledgeData?.length || 0} 个)
          </Title>
        </div>

        <Table
          columns={knowledgeColumns}
          dataSource={knowledgeData || []}
          rowKey="id"
          loading={knowledgeLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </div>
    );
  };

  const renderCasesTab = () => {
    if (!selectedCourseId) {
      return <Alert type="info" message="请先选择一个课程" />;
    }

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Title level={5}>思政案例列表 ({casesData?.length || 0} 个)</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleAdd("case")}
            loading={createCaseMutation.isPending}
            style={canEdit ? undefined : { display: "none" }}
          >
            添加案例
          </Button>
        </div>

        <Table
          columns={casesColumns}
          dataSource={casesData || []}
          rowKey="id"
          loading={casesLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </div>
    );
  };

  const renderRelationsTab = () => {
    if (!selectedCourseId) {
      return <Alert type="info" message="请先选择一个课程" />;
    }

    return (
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Title level={5}>
            思政知识点关系 ({processedRelations.length} 个)
          </Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateRelation}
            loading={createRelationMutation.isPending}
            style={canEdit ? undefined : { display: "none" }}
          >
            创建关系
          </Button>
        </div>

        <Table
          columns={relationsColumns}
          dataSource={processedRelations}
          rowKey="id"
          loading={relationsLoading}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </div>
    );
  };

  const tabItems: TabsProps["items"] = [
    {
      key: "0",
      label: "思政知识点",
      children: renderKnowledgeTab(),
    },
    {
      key: "1",
      label: "思政案例",
      children: renderCasesTab(),
    },
    {
      key: "2",
      label: "思政关系配置",
      children: renderRelationsTab(),
    },
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: 24,
          background: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Title
          level={3}
          style={{ fontWeight: 700, marginBottom: 16, color: "#333" }}
        >
          思政图谱管理
        </Title>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Tag color="blue" style={{ fontWeight: 500 }}>
            思政知识点管理
          </Tag>
          <Tag color="purple" style={{ fontWeight: 500 }}>
            思政案例管理
          </Tag>

          <Select
            value={selectedCourseId || undefined}
            placeholder="选择课程"
            style={{ minWidth: 200, marginLeft: "auto" }}
            onChange={(value) => setSelectedCourseId(value)}
            options={(Array.isArray(coursesData) ? coursesData : []).map((course: any) => ({
              label: course.title,
              value: course.id,
            }))}
          />
        </div>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        <Card style={{ height: "100%" }}>
          <Tabs activeKey={tabValue} onChange={setTabValue} items={tabItems} />
        </Card>
      </div>

      <Modal
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{editingItem?.isNew ? "添加" : "编辑"}思政案例</span>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={handleDialogClose}
            />
          </div>
        }
        open={dialogOpen}
        onCancel={handleDialogClose}
        onOk={handleFormSubmit}
        closable={false}
        confirmLoading={
          createCaseMutation.isPending || updateCaseMutation.isPending
        }
        okText={editingItem?.isNew ? "创建" : "保存"}
        cancelText="取消"
        width={720}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 16,
          }}
        >
          {editingItem?.isNew ? (
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>
                关联知识点
              </label>
              <Select
                value={formData.knowledgeResourceId || undefined}
                placeholder="选择知识点"
                style={{ width: "100%" }}
                onChange={(value) =>
                  handleFormChange("knowledgeResourceId", value)
                }
                options={knowledgeData?.map((knowledge: any) => ({
                  label: knowledge.name,
                  value: knowledge.id,
                }))}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: "block", marginBottom: 4 }}>
                关联知识点
              </label>
              <Input
                value={editingItem?.item?.knowledgeResource?.name || "未关联"}
                disabled
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                案例创建后不能更改关联的知识点
              </Text>
            </div>
          )}

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              案例标题
            </label>
            <Input
              value={formData.title || ""}
              onChange={(e) => handleFormChange("title", e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              案例描述
            </label>
            <TextArea
              rows={3}
              value={formData.description || ""}
              onChange={(e) => handleFormChange("description", e.target.value)}
              placeholder="简短描述这个案例..."
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              关联名称
            </label>
            <Input
              value={formData.caseRelationName || ""}
              onChange={(e) =>
                handleFormChange("caseRelationName", e.target.value)
              }
              placeholder="输入与知识点的关联关系名称..."
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              例如：包含、体现、印证等
            </Text>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              案例内容
            </label>
            <TextArea
              rows={6}
              value={formData.content || ""}
              onChange={(e) => handleFormChange("content", e.target.value)}
              placeholder="详细描述案例内容..."
            />
          </div>
        </div>
      </Modal>

      <Modal
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>创建思政知识关系</span>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRelationCreateModalOpen(false)}
            />
          </div>
        }
        open={relationCreateModalOpen}
        onCancel={() => setRelationCreateModalOpen(false)}
        onOk={confirmCreateRelation}
        closable={false}
        confirmLoading={createRelationMutation.isPending}
        okText="创建"
        cancelText="取消"
        okButtonProps={{
          disabled:
            !relationFormData.sourceKnowledgeId ||
            !relationFormData.targetKnowledgeId ||
            !relationFormData.relationTypeId,
        }}
        width={720}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingTop: 8,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              关系类型 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.relationTypeId || undefined}
              placeholder="选择关系类型"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  relationTypeId: value,
                }))
              }
              loading={relationTypesLoading}
              options={(relationTypesData || [])?.map(
                (relationType: RelationType) => ({
                  label: `${relationType.displayName} (${relationType.name})`,
                  value: relationType.id,
                }),
              )}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              源知识 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.sourceKnowledgeId || undefined}
              placeholder="选择源知识"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  sourceKnowledgeId: value,
                  targetKnowledgeId:
                    prev.targetKnowledgeId === value
                      ? ""
                      : prev.targetKnowledgeId,
                }))
              }
              loading={resourcesLoading}
              options={
                ideopoliticalResources
                  ? renderKnowledgeOptions(
                      ideopoliticalResources,
                      relationFormData.targetKnowledgeId,
                    )
                  : []
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              目标知识 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.targetKnowledgeId || undefined}
              placeholder="选择目标知识"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  targetKnowledgeId: value,
                }))
              }
              loading={resourcesLoading}
              options={
                ideopoliticalResources
                  ? renderKnowledgeOptions(
                      ideopoliticalResources,
                      relationFormData.sourceKnowledgeId,
                    )
                  : []
              }
            />
          </div>
        </div>
        {createRelationMutation.isError && (
          <Alert
            type="error"
            message={`创建失败: ${createRelationMutation.error instanceof Error ? createRelationMutation.error.message : "未知错误"}`}
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      <Modal
        title={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>更新思政知识关系</span>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setRelationUpdateModalOpen(false)}
            />
          </div>
        }
        open={relationUpdateModalOpen}
        onCancel={() => setRelationUpdateModalOpen(false)}
        onOk={confirmUpdateRelation}
        closable={false}
        confirmLoading={updateRelationMutation.isPending}
        okText="更新"
        cancelText="取消"
        okButtonProps={{
          disabled:
            !relationFormData.sourceKnowledgeId ||
            !relationFormData.targetKnowledgeId ||
            !relationFormData.relationTypeId,
        }}
        width={720}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            paddingTop: 8,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              关系类型 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.relationTypeId || undefined}
              placeholder="选择关系类型"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  relationTypeId: value,
                }))
              }
              loading={relationTypesLoading}
              options={(relationTypesData || [])?.map(
                (relationType: RelationType) => ({
                  label: `${relationType.displayName} (${relationType.name})`,
                  value: relationType.id,
                }),
              )}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              源知识 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.sourceKnowledgeId || undefined}
              placeholder="选择源知识"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  sourceKnowledgeId: value,
                  targetKnowledgeId:
                    prev.targetKnowledgeId === value
                      ? ""
                      : prev.targetKnowledgeId,
                }))
              }
              loading={resourcesLoading}
              options={
                ideopoliticalResources
                  ? renderKnowledgeOptions(
                      ideopoliticalResources,
                      relationFormData.targetKnowledgeId,
                    )
                  : []
              }
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 4 }}>
              目标知识 <span style={{ color: "red" }}>*</span>
            </label>
            <Select
              value={relationFormData.targetKnowledgeId || undefined}
              placeholder="选择目标知识"
              style={{ width: "100%" }}
              onChange={(value) =>
                setRelationFormData((prev) => ({
                  ...prev,
                  targetKnowledgeId: value,
                }))
              }
              loading={resourcesLoading}
              options={
                ideopoliticalResources
                  ? renderKnowledgeOptions(
                      ideopoliticalResources,
                      relationFormData.sourceKnowledgeId,
                    )
                  : []
              }
            />
          </div>
        </div>
        {updateRelationMutation.isError && (
          <Alert
            type="error"
            message={`更新失败: ${updateRelationMutation.error instanceof Error ? updateRelationMutation.error.message : "未知错误"}`}
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>

      <Modal
        title="确认删除"
        open={relationDeleteConfirmOpen}
        onCancel={() => setRelationDeleteConfirmOpen(false)}
        onOk={confirmDeleteRelation}
        confirmLoading={deleteRelationMutation.isPending}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>
          确定要删除知识关系 "{selectedRelation?.sourceKnowledgeName} →{" "}
          {selectedRelation?.targetKnowledgeName}" 吗？此操作无法撤销。
        </p>
      </Modal>
    </div>
  );
}
