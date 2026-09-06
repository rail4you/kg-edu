import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Typography,
  Card,
  Alert,
  Modal,
  Input,
  Tag,
  Spin,
  Select,
  Table,
  Checkbox,
  Space,
  Popconfirm,
  message,
  Empty,
  Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import {
  listMainAbilities,
  createMainAbility,
  updateMainAbility,
  destroyMainAbility,
  listSubAbilities,
  createSubAbility,
  updateSubAbility,
  destroySubAbility,
} from "@/lib/ash_rpc";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface MainAbility {
  id: string;
  name: string;
  description?: string | null;
  courseId: string;
  subAbilities?: SubAbility[];
}

interface SubAbility {
  id: string;
  name: string;
  description?: string | null;
  mainAbilityId: string;
  knowledgeResources?: KnowledgeResource[];
}

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType: string;
  description?: string | null;
}

interface Course {
  id: string;
  title: string;
  description?: string | null;
}

interface TreeRow {
  id: string;
  name: string;
  description?: string | null;
  type: "main" | "sub";
  mainAbilityId?: string;
  key: string;
  children?: TreeRow[];
  knowledgeResources?: KnowledgeResource[];
}

export default function CompetencyManagement() {
  const { user, loading: authLoading } = useAuth();
  const { canEdit } = useEditPermission();
  const queryClient = useQueryClient();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"main" | "sub">("main");
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [selectedSubAbilityForKnowledge, setSelectedSubAbilityForKnowledge] =
    useState<string>("");
  const [selectedKnowledgeResources, setSelectedKnowledgeResources] = useState<
    string[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewKnowledgeDialogOpen, setViewKnowledgeDialogOpen] = useState(false);
  const [viewingSubAbility, setViewingSubAbility] = useState<SubAbility | null>(
    null,
  );
  const [viewingKnowledge, setViewingKnowledge] = useState<KnowledgeResource | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<
    MainAbility | SubAbility | null
  >(null);
  const [selectedMainAbilityId, setSelectedMainAbilityId] =
    useState<string>("");
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  const {
    data: mainAbilitiesData = [],
    isLoading: mainAbilitiesLoading,
    refetch: refetchMainAbilities,
  } = useQuery({
    queryKey: ["main-abilities", selectedCourseId],
    queryFn: async () => {
      const result = await listMainAbilities({
        tenant,
        fields: ["id", "name", "description", "courseId"],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!user && !!tenant,
  });

  const { data: subAbilitiesData = [] } = useQuery({
    queryKey: ["sub-abilities", selectedCourseId],
    queryFn: async () => {
      const result = await listSubAbilities({
        tenant,
        fields: [
          "id",
          "name",
          "description",
          "mainAbilityId",
          { knowledgeResources: ["id", "name", "knowledgeType"] },
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!user && !!tenant,
  });

  const { data: knowledgeResourcesData = [] } = useQuery({
    queryKey: ["knowledge-resources", selectedCourseId],
    queryFn: async () => {
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${encodeURIComponent(tenant)}`,
        {
          headers: {
            ...(getAuthHeaders(user) as Record<string, string>),
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch knowledge resources");
      }

      const result = await response.json();

      const flattenResources = (nodes: any[]): KnowledgeResource[] => {
        const resources: KnowledgeResource[] = [];
        const seenIds = new Set<string>();

        const traverse = (node: any) => {
          if (seenIds.has(node.id)) return;
          seenIds.add(node.id);

          resources.push({
            id: node.id,
            name: node.name,
            knowledgeType: node.knowledgeType,
          });

          [
            "childUnits",
            "directCells",
            "subjectCells",
            "childCells",
            "nestedChildCells",
          ].forEach((key) => {
            if (node[key] && Array.isArray(node[key])) {
              node[key].forEach(traverse);
            }
          });
        };

        if (Array.isArray(result)) {
          result.forEach(traverse);
        } else if (Array.isArray(result.data)) {
          result.data.forEach(traverse);
        }

        return resources;
      };

      return flattenResources(result);
    },
    enabled: !!selectedCourseId && knowledgeDialogOpen && !!user && !!tenant,
  });

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setSelectedMainAbilityId("");
  };

  const createMainMutation = useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      return createMainAbility({
        tenant,
        input: {
          name: input.name,
          description: input.description,
          courseId: selectedCourseId,
        },
        fields: ["id", "name", "description", "courseId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("创建成功");
      queryClient.invalidateQueries({ queryKey: ["main-abilities"] });
      handleDialogClose();
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const updateMainMutation = useMutation({
    mutationFn: async ({
      primaryKey,
      input,
    }: {
      primaryKey: string;
      input: { name: string; description?: string };
    }) => {
      return updateMainAbility({
        tenant,
        primaryKey,
        input,
        fields: ["id", "name", "description", "courseId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["main-abilities"] });
      handleDialogClose();
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const destroyMainMutation = useMutation({
    mutationFn: async (primaryKey: string) => {
      return destroyMainAbility({
        tenant,
        primaryKey,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["main-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const createSubMutation = useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      mainAbilityId: string;
    }) => {
      return createSubAbility({
        tenant,
        input,
        fields: ["id", "name", "description", "mainAbilityId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("创建成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      handleDialogClose();
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const updateSubMutation = useMutation({
    mutationFn: async ({
      primaryKey,
      input,
    }: {
      primaryKey: string;
      input: { name: string; description?: string };
    }) => {
      return updateSubAbility({
        tenant,
        primaryKey,
        input,
        fields: ["id", "name", "description", "mainAbilityId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      handleDialogClose();
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const destroySubMutation = useMutation({
    mutationFn: async (primaryKey: string) => {
      return destroySubAbility({
        tenant,
        primaryKey,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  const treeData: TreeRow[] = React.useMemo(() => {
    const mainAbilities = Array.isArray(mainAbilitiesData) ? mainAbilitiesData : [];
    const subAbilities = Array.isArray(subAbilitiesData) ? subAbilitiesData : [];

    if (!mainAbilities.length) return [];

    return mainAbilities.map((main: MainAbility) => {
      const mainSubAbilities = subAbilities.filter(
        (sub: SubAbility) => sub.mainAbilityId === main.id,
      );
      return {
        id: main.id,
        name: main.name,
        description: main.description,
        type: "main" as const,
        key: main.id,
        children: mainSubAbilities.map((sub: SubAbility) => ({
          id: sub.id,
          name: sub.name,
          description: sub.description,
          type: "sub" as const,
          mainAbilityId: main.id,
          key: sub.id,
          knowledgeResources: sub.knowledgeResources,
        })),
      };
    });
  }, [mainAbilitiesData, subAbilitiesData]);

  const availableKnowledgeResources = React.useMemo(() => {
    if (!knowledgeResourcesData) return [];

    const subAbilities = subAbilitiesData?.success ? subAbilitiesData.data : [];
    const subAbility = subAbilities.find(
      (sub: SubAbility) => sub.id === selectedSubAbilityForKnowledge,
    );
    const linkedIds =
      subAbility?.knowledgeResources?.map((kr: KnowledgeResource) => kr.id) ||
      [];

    return knowledgeResourcesData.filter((kr) => !linkedIds.includes(kr.id));
  }, [
    knowledgeResourcesData,
    subAbilitiesData,
    selectedSubAbilityForKnowledge,
  ]);

  const flattenedData = React.useMemo(() => {
    const result: TreeRow[] = [];
    treeData.forEach((main) => {
      result.push(main);
      if (main.children) {
        main.children.forEach((sub) => {
          result.push(sub);
        });
      }
    });
    return result;
  }, [treeData]);

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

  if (!user || !currentTenant) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="用户未登录，请登录以访问能力图谱管理。" />
      </div>
    );
  }

  const handleOpenKnowledgeDialog = (subAbilityId: string) => {
    setSelectedSubAbilityForKnowledge(subAbilityId);
    setSelectedKnowledgeResources([]);
    setSearchTerm("");
    setKnowledgeDialogOpen(true);
  };

  const handleCloseKnowledgeDialog = () => {
    setKnowledgeDialogOpen(false);
    setSelectedSubAbilityForKnowledge("");
    setSelectedKnowledgeResources([]);
    setSearchTerm("");
  };

  const handleToggleKnowledgeResource = (resourceId: string) => {
    setSelectedKnowledgeResources((prev) =>
      prev.includes(resourceId)
        ? prev.filter((id) => id !== resourceId)
        : [...prev, resourceId],
    );
  };

  const handleSaveKnowledgeLinks = async () => {
    const toLink = selectedKnowledgeResources;
    const authHeaders = getAuthHeaders(user) as Record<string, string>;

    try {
      for (const knowledgeResourceId of toLink) {
        await fetch("/rpc/run", {
          method: "POST",
          headers: {
            ...authHeaders,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "create_join",
            tenant,
            input: {
              sub_ability_id: selectedSubAbilityForKnowledge,
              knowledge_resource_id: knowledgeResourceId,
            },
            fields: ["id", "sub_ability_id", "knowledge_resource_id"],
          }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      message.success("关联成功");
      handleCloseKnowledgeDialog();
    } catch (error) {
      console.error("Failed to save knowledge links:", error);
      message.error("保存知识点关联失败，请重试");
    }
  };

  const handleUnlinkKnowledgeResource = async (
    subAbilityId: string,
    knowledgeResourceId: string,
  ) => {
    const authHeaders = getAuthHeaders(user) as Record<string, string>;

    try {
      const findResponse = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get_joins_by_sub_ability",
          tenant,
          input: {
            sub_ability_id: subAbilityId,
          },
          fields: ["id", "sub_ability_id", "knowledge_resource_id"],
        }),
      });

      const findResult = await findResponse.json();

      if (!findResult.success) {
        throw new Error(
          findResult.errors?.[0]?.message || "Failed to find join record",
        );
      }

      let joinRecords = findResult.data;
      if (findResult.data && findResult.data.data) {
        joinRecords = findResult.data.data;
      } else if (findResult.data && findResult.data.results) {
        joinRecords = findResult.data.results;
      }

      if (!joinRecords || !Array.isArray(joinRecords)) {
        throw new Error("Invalid data structure returned");
      }

      const joinRecord = joinRecords.find(
        (record: any) => record.knowledgeResourceId === knowledgeResourceId,
      );

      if (!joinRecord) {
        throw new Error("Join record not found");
      }

      const deleteResponse = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "destroy_join",
          tenant,
          primaryKey: joinRecord.id,
          fields: [],
        }),
      });

      const deleteResult = await deleteResponse.json();

      if (!deleteResult.success) {
        throw new Error(
          deleteResult.errors?.[0]?.message || "Failed to delete join record",
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });

      if (viewingSubAbility && viewingSubAbility.id === subAbilityId) {
        setViewingSubAbility((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            knowledgeResources:
              prev.knowledgeResources?.filter(
                (kr) => kr.id !== knowledgeResourceId,
              ) || [],
          };
        });
      }

      message.success("取消关联成功");
    } catch (error) {
      console.error("Failed to unlink knowledge resource:", error);
      message.error("取消关联失败，请重试");
    }
  };

  const handleViewKnowledgeResources = (subAbility: SubAbility) => {
    setViewingSubAbility(subAbility);
    setViewKnowledgeDialogOpen(true);
  };

  const handleCloseViewKnowledgeDialog = () => {
    setViewKnowledgeDialogOpen(false);
    setViewingSubAbility(null);
    setViewingKnowledge(null);
  };

  const handleViewKnowledge = (knowledge: KnowledgeResource) => {
    setViewingKnowledge(knowledge);
  };

  const handleCloseKnowledgePanel = () => {
    setViewingKnowledge(null);
  };

  const handleAddMain = () => {
    setDialogType("main");
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

  const handleAddSub = (mainAbilityId: string) => {
    setDialogType("sub");
    setEditingItem(null);
    setSelectedMainAbilityId(mainAbilityId);
    setFormData({ name: "", description: "" });
    setDialogOpen(true);
  };

  const handleEdit = (row: TreeRow) => {
    if (row.type === "main") {
      setDialogType("main");
      setEditingItem(row as unknown as MainAbility);
      setFormData({ name: row.name, description: row.description || "" });
    } else {
      setDialogType("sub");
      setEditingItem(row as unknown as SubAbility);
      setSelectedMainAbilityId(row.mainAbilityId!);
      setFormData({ name: row.name, description: row.description || "" });
    }
    setDialogOpen(true);
  };

  const handleDelete = (row: TreeRow) => {
    if (row.type === "main") {
      destroyMainMutation.mutate(row.id);
    } else {
      destroySubMutation.mutate(row.id);
    }
  };

  const handleFormSubmit = () => {
    if (!formData.name || formData.name.trim() === "") {
      message.warning("请输入能力名称");
      return;
    }

    if (dialogType === "main") {
      if (editingItem) {
        updateMainMutation.mutate({
          primaryKey: editingItem.id,
          input: {
            name: formData.name,
            description: formData.description || undefined,
          },
        });
      } else {
        const payload = {
          name: formData.name,
          description: formData.description || undefined,
        };
        createMainMutation.mutate(payload);
      }
    } else {
      if (editingItem) {
        updateSubMutation.mutate({
          primaryKey: editingItem.id,
          input: {
            name: formData.name,
            description: formData.description || undefined,
          },
        });
      } else {
        const payload = {
          name: formData.name,
          description: formData.description || undefined,
          mainAbilityId: selectedMainAbilityId,
        };
        createSubMutation.mutate(payload);
      }
    }
  };

  const columns: TableColumnsType<TreeRow> = [
    {
      title: "能力名称",
      dataIndex: "name",
      key: "name",
      width: 300,
      render: (name: string, record: TreeRow) => {
        const isMain = record.type === "main";
        return (
          <Space size={4} style={{ maxWidth: "100%" }}>
            {isMain ? (
              <Tag color="blue" style={{ flexShrink: 0 }}>主能力</Tag>
            ) : (
              <Tag color="purple" style={{ flexShrink: 0 }}>子能力</Tag>
            )}
            <Tooltip title={name} mouseEnterDelay={0.3}>
              <Text style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{name}</Text>
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
      width: 250,
      render: (description: string | null, record: TreeRow) => {
        if (!description) {
          return <Text type="secondary">-</Text>;
        }
        const isLongDescription = description.length > 30;
        return isLongDescription ? (
          <Tooltip title={description} mouseEnterDelay={0.3}>
            <Text type="secondary" style={{ cursor: "pointer" }}>
              {description.slice(0, 30)}...
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary">{description}</Text>
        );
      },
    },
    {
      title: "关联知识点",
      dataIndex: "knowledgeResources",
      key: "knowledgeResources",
      width: 200,
      render: (
        knowledgeResources: KnowledgeResource[] | undefined,
        record: TreeRow,
      ) => {
        if (record.type === "main") {
          return <Text type="secondary">-</Text>;
        }

        const resources = knowledgeResources || [];
        const count = resources.length;

        if (count === 0) {
          return (
            <Text type="secondary" style={{ fontStyle: "italic" }}>
              未关联
            </Text>
          );
        }

        return (
          <Tag
            color="cyan"
            style={{ cursor: "pointer" }}
            onClick={() =>
              handleViewKnowledgeResources(record as unknown as SubAbility)
            }
          >
            {count} 个知识点
          </Tag>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 300,
      render: (_: any, record: TreeRow) => {
        const isMain = record.type === "main";
        return (
          <Space wrap>
            <ReadonlyActionButton
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            >
              编辑
            </ReadonlyActionButton>
            {isMain ? (
              <ReadonlyActionButton
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleAddSub(record.id)}
              >
                添加子能力
              </ReadonlyActionButton>
            ) : (
              <ReadonlyActionButton
                type="link"
                size="small"
                icon={<BookOutlined />}
                onClick={() => handleOpenKnowledgeDialog(record.id)}
              >
                关联知识点
              </ReadonlyActionButton>
            )}
            <Popconfirm
              title="确定删除?"
              description="此操作不可恢复"
              onConfirm={() => handleDelete(record)}
              okText="确定"
              cancelText="取消"
            >
              <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </ReadonlyActionButton>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: 24,
          backgroundColor: "white",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Title level={4} style={{ marginBottom: 16, color: "#333" }}>
          能力图谱管理
        </Title>
        <Space size="middle">
          <Select
            style={{ minWidth: 300 }}
            placeholder="选择课程"
            value={selectedCourseId || undefined}
            onChange={(value) => setSelectedCourseId(value)}
            loading={coursesLoading}
            options={
              (Array.isArray(coursesData) ? coursesData : coursesData).map(
                (course: Course) => ({
                  label: course.title,
                  value: course.id,
                }),
              )
            }
          />
          {selectedCourseId && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddMain}
              style={canEdit ? undefined : { display: "none" }}
            >
              添加主能力
            </Button>
          )}
        </Space>
      </div>

      <div style={{ flexGrow: 1, padding: 24 }}>
        <Card
          style={{ height: "100%" }}
          styles={{
            body: { height: "100%", display: "flex", flexDirection: "column" },
          }}
        >
          {!selectedCourseId ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
              }}
            >
              <Text type="secondary" style={{ fontSize: 16 }}>
                请先选择课程
              </Text>
            </div>
          ) : mainAbilitiesLoading ? (
            <div
              style={{ display: "flex", justifyContent: "center", padding: 24 }}
            >
              <Spin size="large" />
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={flattenedData}
              rowKey="key"
              pagination={false}
              indentSize={24}
              expandable={{
                defaultExpandAllRows: true,
                rowExpandable: (record) =>
                  record.type === "main" && !!record.children?.length,
                expandedRowRender: (record) => {
                  if (record.type === "main" && record.children) {
                    return (
                      <Table
                        columns={columns.filter(
                          (col) => col.key !== "action" || true,
                        )}
                        dataSource={record.children}
                        rowKey="key"
                        pagination={false}
                        showHeader={false}
                        size="small"
                      />
                    );
                  }
                  return null;
                },
              }}
              scroll={{ x: 1000 }}
            />
          )}
        </Card>
      </div>

      <Modal
        title={`${editingItem ? "编辑" : "添加"}${dialogType === "main" ? "主能力" : "子能力"}`}
        open={dialogOpen}
        onCancel={handleDialogClose}
        onOk={handleFormSubmit}
        okText="保存"
        cancelText="取消"
        okButtonProps={{ disabled: !formData.name.trim() }}
        width={500}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div>
            <Text>能力名称</Text>
            <Input
              placeholder="请输入能力名称"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              style={{ marginTop: 8 }}
              autoFocus
            />
          </div>
          <div>
            <Text>描述</Text>
            <TextArea
              placeholder="能力描述（可选）"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="关联知识点"
        open={knowledgeDialogOpen}
        onCancel={handleCloseKnowledgeDialog}
        onOk={handleSaveKnowledgeLinks}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            marginTop: 16,
          }}
        >
          <Input
            placeholder="输入知识点名称进行搜索"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            prefix={<BookOutlined />}
          />

          <div style={{ height: 400, overflow: "auto" }}>
            {availableKnowledgeResources.length > 0 ? (
              <Table
                dataSource={availableKnowledgeResources
                  .filter((kr) =>
                    kr.name.toLowerCase().includes(searchTerm.toLowerCase()),
                  )
                  .map((kr) => ({
                    ...kr,
                    selected: selectedKnowledgeResources.includes(kr.id),
                  }))}
                columns={[
                  {
                    title: "选择",
                    key: "selected",
                    width: 80,
                    render: (
                      _: any,
                      record: KnowledgeResource & { selected: boolean },
                    ) => (
                      <Checkbox
                        checked={record.selected}
                        onChange={() =>
                          handleToggleKnowledgeResource(record.id)
                        }
                      />
                    ),
                  },
                  { title: "知识点名称", dataIndex: "name", key: "name" },
                  {
                    title: "类型",
                    dataIndex: "knowledgeType",
                    key: "knowledgeType",
                  },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
              />
            ) : (
              <Empty
                description={
                  knowledgeResourcesData && knowledgeResourcesData.length > 0
                    ? "所有知识点都已关联"
                    : "暂无知识点数据"
                }
              />
            )}
          </div>

          <Text type="secondary">
            已选择 {selectedKnowledgeResources.length} 个知识点
          </Text>
        </div>
      </Modal>

      <Modal
        title={`查看关联知识点 - ${viewingSubAbility?.name}`}
        open={viewKnowledgeDialogOpen}
        onCancel={handleCloseViewKnowledgeDialog}
        footer={<Button onClick={handleCloseViewKnowledgeDialog}>关闭</Button>}
        width={600}
      >
        {viewingSubAbility?.knowledgeResources &&
        viewingSubAbility.knowledgeResources.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}
            >
              <Text type="secondary">
                共关联{" "}
                <strong>{viewingSubAbility.knowledgeResources.length}</strong>{" "}
                个知识点
              </Text>
            </div>

            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {viewingSubAbility.knowledgeResources.map(
                (kr: KnowledgeResource, index: number) => (
                  <div
                    key={kr.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 0",
                      borderBottom:
                        index ===
                        viewingSubAbility.knowledgeResources!.length - 1
                          ? "none"
                          : "1px solid #f0f0f0",
                      transition: "background-color 0.2s",
                    }}
                  >
                    <div 
                      style={{ flex: 1, cursor: "pointer" }}
                      onClick={() => handleViewKnowledge(kr)}
                    >
                      <Text
                        strong
                        style={{
                          display: "block",
                          marginBottom: kr.knowledgeType ? 4 : 0,
                          color: "#1890ff",
                        }}
                      >
                        {kr.name}
                      </Text>
                      {kr.knowledgeType && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          类型: {kr.knowledgeType}
                        </Text>
                      )}
                    </div>
                    <Popconfirm
                      title="确定要取消关联这个知识点吗？"
                      onConfirm={() =>
                        handleUnlinkKnowledgeResource(
                          viewingSubAbility!.id,
                          kr.id,
                        )
                      }
                      okText="确定"
                      cancelText="取消"
                    >
                      <ReadonlyActionButton
                        type="text"
                        size="small"
                        danger
                        icon={<CloseOutlined />}
                      />
                    </Popconfirm>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 48,
            }}
          >
            <Text type="secondary">未关联任何知识点</Text>
          </div>
        )}
      </Modal>

      <KnowledgeResourcePanel
        open={!!viewingKnowledge}
        onClose={handleCloseKnowledgePanel}
        knowledge={viewingKnowledge}
      />
    </div>
  );
}
