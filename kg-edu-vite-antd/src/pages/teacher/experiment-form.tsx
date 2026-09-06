import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Typography,
  Card,
  Input,
  Select,
  Spin,
  Alert,
  Progress,
  Tag,
  Space,
  message,
  InputNumber,
  Divider,
  Upload,
  Tree,
  Empty,
} from "antd";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  DeleteOutlined,
  UploadOutlined,
  FileTextOutlined,
  SearchOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { uploadFileViaServer } from "@/lib/oss-upload";
import {
  createExperiment,
  updateExperiment,
  getExperiment,
  listChapters,
  listKnowledges,
  listMainAbilities,
  addKnowledgeResourceToExperiment,
  removeKnowledgeResourceFromExperiment,
  addAbilityToExperiment,
  removeAbilityFromExperiment,
  listExperimentKnowledgeResources,
  listExperimentAbilities,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface FormData {
  title: string;
  description: string;
  courseId: string;
  chapterId: string;
  experimentType: "online" | "offline";
  difficultyLevel: "easy" | "medium" | "hard";
  durationHours: number;
  sortOrder: number;
  status: "draft" | "published" | "archived";
  objectives: string;
  requirements: string;
  equipment: string;
  guideTitle: string;
  guideUrl: string;
}

interface KnowledgeResource {
  id: string;
  name: string;
}

interface Ability {
  id: string;
  name: string;
}

const defaultFormData: FormData = {
  title: "",
  description: "",
  courseId: "",
  chapterId: "",
  experimentType: "online",
  difficultyLevel: "medium",
  durationHours: 2,
  sortOrder: 1,
  status: "draft",
  objectives: "",
  requirements: "",
  equipment: "",
  guideTitle: "",
  guideUrl: "",
};

interface KnowledgeTreeNode {
  id: string;
  key: string;
  label: string;
  title?: React.ReactNode;
  children?: KnowledgeTreeNode[];
}

interface KnowledgeTreeMultiSelectProps {
  value: KnowledgeResource[];
  onChange: (value: KnowledgeResource[]) => void;
  treeData: KnowledgeTreeNode[];
  disabled?: boolean;
}

function KnowledgeTreeMultiSelect({
  value,
  onChange,
  treeData,
  disabled = false,
}: KnowledgeTreeMultiSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpanded, setAutoExpanded] = useState(true);

  useEffect(() => {
    setExpandedKeys([]);
    setAutoExpanded(true);
  }, [treeData]);

  const allKeys = useMemo(() => {
    const getKeys = (nodes: KnowledgeTreeNode[]): React.Key[] => {
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
    nodes: KnowledgeTreeNode[],
    search: string,
  ): KnowledgeTreeNode[] => {
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
          } as KnowledgeTreeNode;
        }
        return null;
      })
      .filter((node): node is KnowledgeTreeNode => node !== null);
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
    const val = e.target.value;
    setSearchValue(val);
    if (val) {
      setAutoExpanded(true);
    }
  };

  const handleExpand = (keys: React.Key[]) => {
    setExpandedKeys(keys);
    setAutoExpanded(false);
  };

  const enhanceTreeData = (
    items: KnowledgeTreeNode[],
    search: string,
  ): any[] => {
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
      };
    });
  };

  const treeDataWithTitle = useMemo(
    () => enhanceTreeData(filteredItems, searchValue),
    [filteredItems, searchValue],
  );

  const selectedKeys = useMemo(
    () => value.map((v) => v.id),
    [value],
  );

  const handleSelect = (_selected: React.Key[], info: any) => {
    if (disabled) return;
    const nodeId = info.node.id || info.node.key;
    const nodeLabel = info.node.label;
    
    const exists = value.find((v) => v.id === nodeId);
    if (exists) {
      onChange(value.filter((v) => v.id !== nodeId));
    } else {
      onChange([...value, { id: nodeId, name: nodeLabel }]);
    }
  };

  const handleCheck = (checked: React.Key[]) => {
    const selectedIds = new Set(checked);
    const newSelected: KnowledgeResource[] = [];
    
    const findAndAdd = (nodes: KnowledgeTreeNode[]) => {
      for (const node of nodes) {
        if (selectedIds.has(node.id)) {
          newSelected.push({ id: node.id, name: node.label });
        }
        if (node.children) {
          findAndAdd(node.children);
        }
      }
    };
    findAndAdd(treeData);
    onChange(newSelected);
  };

  return (
    <div>
      <Input
        placeholder="搜索知识点"
        prefix={<SearchOutlined />}
        value={searchValue}
        onChange={handleSearchChange}
        style={{ marginBottom: 8 }}
        allowClear
        disabled={disabled}
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
            multiple
            expandedKeys={effectiveExpandedKeys}
            onExpand={handleExpand}
            onSelect={handleSelect}
            treeData={treeDataWithTitle}
            disabled={disabled}
          />
        ) : (
          <Empty description="暂无知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </div>
  );
}

export default function ExperimentForm() {
  const { user, tenant, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { id } = useParams();

  const isEditMode = id !== "new" && id !== undefined;
  const experimentId = isEditMode ? id : null;

  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [selectedKnowledgeResources, setSelectedKnowledgeResources] = useState<
    KnowledgeResource[]
  >([]);
  const [selectedAbilities, setSelectedAbilities] = useState<Ability[]>([]);
  const [uploadProgress, setUploadProgress] = useState(false);

  const { courses: coursesResult, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  const { data: chaptersResult } = useQuery({
    queryKey: ["chapters", formData.courseId, tenant],
    queryFn: async () => {
      if (!formData.courseId) return [];

      const result = await listChapters({
        tenant: tenant || "",
        fields: ["id", "title"],
        filter: { courseId: { eq: formData.courseId } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const chapters = Array.isArray(result.data)
          ? result.data
          : result.data.results || result.data.data || [];
        return chapters;
      }
      return [];
    },
    enabled: !!formData.courseId && !!user,
  });

  const { data: knowledgeResourcesResult } = useQuery({
    queryKey: ["knowledge-hierarchy", formData.courseId, tenant],
    queryFn: async () => {
      if (!formData.courseId) return [];

      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${formData.courseId}&tenant=${tenant}`,
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
    enabled: !!formData.courseId && !!user && !!tenant,
    staleTime: 5 * 60 * 1000,
  });

  const knowledgeTreeData = React.useMemo(() => {
    if (!knowledgeResourcesResult || !Array.isArray(knowledgeResourcesResult)) return [];

    const convertToTree = (node: any): any => {
      const childArrays = [
        node.childUnits,
        node.directCells,
        node.subjectCells,
        node.childCells,
        node.nestedChildCells,
      ];

      const children: any[] = [];
      childArrays.forEach((arr) => {
        if (Array.isArray(arr)) {
          arr.forEach((child: any) => {
            children.push(convertToTree(child));
          });
        }
      });

      return {
        id: node.id,
        value: node.id,
        title: node.name,
        label: node.name,
        children: children.length > 0 ? children : undefined,
      };
    };

    return knowledgeResourcesResult.map((node: any) => convertToTree(node));
  }, [knowledgeResourcesResult]);

  const { data: mainAbilitiesResult } = useQuery({
    queryKey: ["main-abilities", formData.courseId, tenant],
    queryFn: async () => {
      if (!formData.courseId) return [];

      const result = await listMainAbilities({
        tenant: tenant || "",
        fields: ["id", "name"],
        filter: { courseId: { eq: formData.courseId } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const abilities = Array.isArray(result.data)
          ? result.data
          : result.data.results || result.data.data || [];
        return abilities;
      }
      return [];
    },
    enabled: !!formData.courseId && !!user,
  });

  const { data: experimentData, isLoading: isLoadingExperiment } = useQuery({
    queryKey: ["experiment", experimentId, tenant],
    queryFn: async () => {
      if (!experimentId) return null;

      const result = await getExperiment({
        tenant: tenant || "",
        fields: [
          "id",
          "title",
          "description",
          "experimentType",
          "durationHours",
          "difficultyLevel",
          "status",
          "sortOrder",
          "objectives",
          "requirements",
          "equipment",
          "guideTitle",
          "guideUrl",
          "courseId",
          "chapterId",
        ],
        filter: { id: { eq: experimentId } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        return result.data;
      }
      return null;
    },
    enabled: !!experimentId && !!user,
  });

  const { data: experimentKnowledgeResources } = useQuery({
    queryKey: ["experiment-knowledge-resources", experimentId, tenant],
    queryFn: async () => {
      if (!experimentId) return [];

      const result = await listExperimentKnowledgeResources({
        tenant: tenant || "",
        fields: [
          "id",
          "experimentId",
          "knowledgeResourceId",
          { knowledgeResource: ["id", "name"] },
        ],
        filter: { experiment: { id: { eq: experimentId } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const items = Array.isArray(result.data)
          ? result.data
          : result.data.results || result.data.data || [];
        return items;
      }
      return [];
    },
    enabled: !!experimentId && !!user,
  });

  const { data: experimentAbilities } = useQuery({
    queryKey: ["experiment-abilities", experimentId, tenant],
    queryFn: async () => {
      if (!experimentId) return [];

      const result = await listExperimentAbilities({
        tenant: tenant || "",
        fields: [
          "id",
          "abilityType",
          "mainAbilityId",
          "subAbilityId",
          { mainAbility: ["id", "name"] },
          { subAbility: ["id", "name", { mainAbility: ["id", "name"] }] },
        ],
        filter: { experiment: { id: { eq: experimentId } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const items = Array.isArray(result.data)
          ? result.data
          : result.data.results || result.data.data || [];
        return items;
      }
      return [];
    },
    enabled: !!experimentId && !!user,
  });

  useEffect(() => {
    if (experimentData) {
      const expData = Array.isArray(experimentData)
        ? experimentData[0]
        : experimentData;
      if (expData) {
        setFormData({
          title: expData.title || "",
          description: expData.description || "",
          courseId: expData.courseId || "",
          chapterId: expData.chapterId || "",
          experimentType: expData.experimentType || "online",
          difficultyLevel: expData.difficultyLevel || "medium",
          durationHours: expData.durationHours || 2,
          sortOrder: expData.sortOrder || 1,
          status: expData.status || "draft",
          objectives: expData.objectives || "",
          requirements: expData.requirements || "",
          equipment: expData.equipment || "",
          guideTitle: expData.guideTitle || "",
          guideUrl: expData.guideUrl || "",
        });
      }
    }
  }, [experimentData]);

  useEffect(() => {
    if (
      experimentKnowledgeResources &&
      Array.isArray(experimentKnowledgeResources)
    ) {
      const resources = experimentKnowledgeResources
        .map((item: any) => item.knowledgeResource)
        .filter(Boolean);
      setSelectedKnowledgeResources(
        resources.map((kr: any) => ({
          id: kr.id,
          name: kr.name,
        })),
      );
    }
  }, [experimentKnowledgeResources]);

  useEffect(() => {
    if (experimentAbilities && Array.isArray(experimentAbilities)) {
      const abilities: Ability[] = [];
      experimentAbilities.forEach((ea: any) => {
        if (ea.abilityType === "main_ability" && ea.mainAbility) {
          abilities.push({
            id: ea.mainAbility.id,
            name: ea.mainAbility.name,
          });
        }
      });
      setSelectedAbilities(abilities);
    }
  }, [experimentAbilities]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return createExperiment({
        tenant: tenant || "",
        fields: ["id", "title"],
        input: {
          title: data.title,
          description: data.description || undefined,
          courseId: data.courseId,
          chapterId: data.chapterId || undefined,
          experimentType: data.experimentType,
          difficultyLevel: data.difficultyLevel,
          durationHours: data.durationHours,
          sortOrder: data.sortOrder,
          status: data.status,
          objectives: data.objectives || undefined,
          requirements: data.requirements || undefined,
          equipment: data.equipment || undefined,
          guideTitle: data.guideTitle || undefined,
          guideUrl: data.guideUrl || undefined,
          createdById: user!.id,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
    },
    onSuccess: async (result) => {
      if (result.success && result.data) {
        const newExperimentId = result.data.id;

        for (const kr of selectedKnowledgeResources) {
          await addKnowledgeResourceToExperiment({
            tenant: tenant || "",
            primaryKey: newExperimentId,
            fields: ["id"],
            input: { knowledgeResourceId: kr.id },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
        }

        for (const ability of selectedAbilities) {
          await addAbilityToExperiment({
            tenant: tenant || "",
            primaryKey: newExperimentId,
            fields: ["id"],
            input: {
              abilityType: "main_ability",
              mainAbilityId: ability.id,
            },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
        }

        message.success("创建成功");
        queryClient.invalidateQueries({ queryKey: ["experiments"] });
        navigate(`/teacher/dashboard/experiment-management?courseId=${formData.courseId}`);
      } else {
        message.error(
          "创建失败：" +
            (result.errors?.map((e) => e.message).join(", ") || "未知错误"),
        );
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const result = await updateExperiment({
        tenant: tenant || "",
        fields: ["id", "title"],
        primaryKey: id,
        input: {
          title: data.title,
          description: data.description || undefined,
          chapterId: data.chapterId || undefined,
          experimentType: data.experimentType,
          difficultyLevel: data.difficultyLevel,
          durationHours: data.durationHours,
          sortOrder: data.sortOrder,
          status: data.status,
          objectives: data.objectives || undefined,
          requirements: data.requirements || undefined,
          equipment: data.equipment || undefined,
          guideTitle: data.guideTitle || undefined,
          guideUrl: data.guideUrl || undefined,
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (!result.success) {
        return result;
      }

      const existingKrResult = await listExperimentKnowledgeResources({
        tenant: tenant || "",
        fields: ["id", "knowledgeResourceId"],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      const existingKr =
        existingKrResult.success && existingKrResult.data
          ? Array.isArray(existingKrResult.data)
            ? existingKrResult.data
            : existingKrResult.data.results || existingKrResult.data.data || []
          : [];

      const existingKrIds = new Set(
        existingKr.map((kr: any) => kr.knowledgeResourceId),
      );

      for (const kr of selectedKnowledgeResources) {
        if (!existingKrIds.has(kr.id)) {
          await addKnowledgeResourceToExperiment({
            tenant: tenant || "",
            primaryKey: id,
            fields: ["id"],
            input: { knowledgeResourceId: kr.id },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
        }
      }

      for (const kr of existingKr) {
        if (
          !selectedKnowledgeResources.find(
            (skr) => skr.id === kr.knowledgeResourceId,
          )
        ) {
          await removeKnowledgeResourceFromExperiment({
            tenant: tenant || "",
            primaryKey: id,
            fields: ["id"],
            input: { knowledgeResourceId: kr.knowledgeResourceId },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
        }
      }

      const existingEaResult = await listExperimentAbilities({
        tenant: tenant || "",
        fields: ["id", "abilityType", "mainAbilityId", "subAbilityId"],
        filter: { experiment: { id: { eq: id } } },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      const existingEa =
        existingEaResult.success && existingEaResult.data
          ? Array.isArray(existingEaResult.data)
            ? existingEaResult.data
            : existingEaResult.data.results || existingEaResult.data.data || []
          : [];

      const existingMainAbilityIds = new Set(
        existingEa
          .filter(
            (ea: any) => ea.abilityType === "main_ability" && ea.mainAbilityId,
          )
          .map((ea: any) => ea.mainAbilityId),
      );

      for (const ability of selectedAbilities) {
        if (!existingMainAbilityIds.has(ability.id)) {
          await addAbilityToExperiment({
            tenant: tenant || "",
            primaryKey: id,
            fields: ["id"],
            input: {
              abilityType: "main_ability",
              mainAbilityId: ability.id,
            },
            headers: getAuthHeaders(user) as Record<string, string>,
          });
        }
      }

      for (const ea of existingEa) {
        const shouldRemove =
          ea.abilityType === "main_ability"
            ? !selectedAbilities.find((a) => a.id === ea.mainAbilityId)
            : true;

        if (shouldRemove) {
          if (ea.abilityType === "main_ability") {
            await removeAbilityFromExperiment({
              tenant: tenant || "",
              primaryKey: id,
              fields: [],
              input: { mainAbilityId: ea.mainAbilityId },
              headers: getAuthHeaders(user) as Record<string, string>,
            });
          } else {
            await removeAbilityFromExperiment({
              tenant: tenant || "",
              primaryKey: id,
              fields: [],
              input: { subAbilityId: ea.subAbilityId },
              headers: getAuthHeaders(user) as Record<string, string>,
            });
          }
        }
      }

      return result;
    },
    onSuccess: () => {
      message.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["experiments"] });
      queryClient.invalidateQueries({ queryKey: ["experiment", experimentId] });
      queryClient.invalidateQueries({
        queryKey: ["experiment-knowledge-resources", experimentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["experiment-abilities", experimentId],
      });
      navigate(`/teacher/dashboard/experiment-management?courseId=${formData.courseId}`);
    },
  });

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      message.warning("请输入实验名称");
      return;
    }
    if (!formData.courseId) {
      message.warning("请选择所属课程");
      return;
    }

    if (isEditMode && experimentId) {
      updateMutation.mutate({ id: experimentId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (authLoading || (isEditMode && isLoadingExperiment)) {
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
      <div style={{ padding: 24 }}>
        <Alert message="用户未登录，请登录以访问实验管理。" type="error" />
      </div>
    );
  }

  const courses = Array.isArray(coursesResult) ? coursesResult : [];
  const chapters = Array.isArray(chaptersResult) ? chaptersResult : [];
  const knowledgeResources = Array.isArray(knowledgeResourcesResult)
    ? knowledgeResourcesResult
    : [];
  const mainAbilities = Array.isArray(mainAbilitiesResult)
    ? mainAbilitiesResult
    : [];

  // Show loading state when loading courses
  if (coursesLoading && !isEditMode) {
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard/experiment-management")}
          >
            返回
          </Button>
          <Title
            level={3}
            style={{ margin: 0, fontWeight: 700, color: "#333" }}
          >
            {isEditMode ? "编辑实验" : "创建实验"}
          </Title>
        </div>
      </div>

      <div style={{ flexGrow: 1, padding: 24, overflow: "auto" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <Card style={{ padding: 24 }}>
            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              基本信息
            </Title>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <Text type="secondary">
                  实验名称 <Text type="danger">*</Text>
                </Text>
                <Input
                  placeholder="请输入实验名称"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div>
                <Text type="secondary">实验描述</Text>
                <TextArea
                  placeholder="请输入实验描述"
                  rows={3}
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">
                    所属课程 <Text type="danger">*</Text>
                  </Text>
                  <Select
                    placeholder="请选择课程"
                    value={formData.courseId || undefined}
                    onChange={(value) => {
                      setFormData({
                        ...formData,
                        courseId: value,
                        chapterId: "",
                      });
                      setSelectedKnowledgeResources([]);
                      setSelectedAbilities([]);
                    }}
                    disabled={isEditMode}
                    style={{ width: "100%", marginTop: 4 }}
                    options={courses.map((course: any) => ({
                      label: course.title,
                      value: course.id,
                    }))}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <Text type="secondary">所属章节</Text>
                  <Select
                    placeholder="请选择章节"
                    value={formData.chapterId || undefined}
                    onChange={(value) =>
                      setFormData({ ...formData, chapterId: value })
                    }
                    disabled={!formData.courseId}
                    style={{ width: "100%", marginTop: 4 }}
                    allowClear
                    options={chapters.map((chapter: any) => ({
                      label: chapter.title,
                      value: chapter.id,
                    }))}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">
                    实验类型 <Text type="danger">*</Text>
                  </Text>
                  <Select
                    value={formData.experimentType}
                    onChange={(value) =>
                      setFormData({ ...formData, experimentType: value })
                    }
                    style={{ width: "100%", marginTop: 4 }}
                    options={[
                      { label: "线上（虚拟实验室）", value: "online" },
                      { label: "线下（实体实验室）", value: "offline" },
                    ]}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <Text type="secondary">
                    难度级别 <Text type="danger">*</Text>
                  </Text>
                  <Select
                    value={formData.difficultyLevel}
                    onChange={(value) =>
                      setFormData({ ...formData, difficultyLevel: value })
                    }
                    style={{ width: "100%", marginTop: 4 }}
                    options={[
                      { label: "简单", value: "easy" },
                      { label: "中等", value: "medium" },
                      { label: "困难", value: "hard" },
                    ]}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Text type="secondary">预计学时（小时）</Text>
                  <InputNumber
                    min={0}
                    step={0.5}
                    value={formData.durationHours}
                    onChange={(value) =>
                      setFormData({ ...formData, durationHours: value || 0 })
                    }
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <Text type="secondary">排序序号</Text>
                  <InputNumber
                    min={1}
                    value={formData.sortOrder}
                    onChange={(value) =>
                      setFormData({ ...formData, sortOrder: value || 1 })
                    }
                    style={{ width: "100%", marginTop: 4 }}
                  />
                </div>
              </div>

              <div>
                <Text type="secondary">
                  发布状态 <Text type="danger">*</Text>
                </Text>
                <Select
                  value={formData.status}
                  onChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                  style={{ width: "100%", marginTop: 4 }}
                  options={[
                    { label: "草稿", value: "draft" },
                    { label: "已发布", value: "published" },
                    { label: "已归档", value: "archived" },
                  ]}
                />
              </div>
            </div>

            <Divider />

            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              详细信息
            </Title>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <Text type="secondary">实验目标</Text>
                <TextArea
                  placeholder="描述本实验的教学目标和学习成果"
                  rows={3}
                  value={formData.objectives}
                  onChange={(e) =>
                    setFormData({ ...formData, objectives: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div>
                <Text type="secondary">实验要求</Text>
                <TextArea
                  placeholder="描述实验的前置条件和学生需要具备的知识"
                  rows={2}
                  value={formData.requirements}
                  onChange={(e) =>
                    setFormData({ ...formData, requirements: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div>
                <Text type="secondary">所需设备/环境</Text>
                <TextArea
                  placeholder="描述实验所需的硬件设备或软件环境"
                  rows={2}
                  value={formData.equipment}
                  onChange={(e) =>
                    setFormData({ ...formData, equipment: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>
            </div>

            <Divider />

            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              实验指导书
            </Title>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <Text type="secondary">指导书标题</Text>
                <Input
                  placeholder="请输入指导书标题"
                  value={formData.guideTitle}
                  onChange={(e) =>
                    setFormData({ ...formData, guideTitle: e.target.value })
                  }
                  style={{ marginTop: 4 }}
                />
              </div>

              <div
                style={{
                  border: "2px dashed #ccc",
                  borderRadius: 8,
                  padding: 24,
                  textAlign: "center",
                  background: "#fafafa",
                }}
              >
                <Upload
                  accept=".pdf,.doc,.docx,.txt"
                  showUploadList={false}
                  beforeUpload={async (file) => {
                    try {
                      setUploadProgress(true);

                      const result = await uploadFileViaServer(file);

                      setFormData({
                        ...formData,
                        guideTitle: formData.guideTitle || file.name,
                        guideUrl: result.url,
                      });

                      setUploadProgress(false);
                      message.success("上传成功");
                    } catch (error) {
                      console.error("Upload failed:", error);
                      message.error(
                        "文件上传失败: " +
                          (error instanceof Error
                            ? error.message
                            : "未知错误"),
                      );
                      setUploadProgress(false);
                    }
                    return false;
                  }}
                >
                  <Button icon={<UploadOutlined />} style={{ marginBottom: 8 }}>
                    选择文件
                  </Button>
                </Upload>
                <Text type="secondary" style={{ display: "block" }}>
                  支持的格式: PDF, DOC, DOCX, TXT
                </Text>
                {uploadProgress && (
                  <div style={{ marginTop: 16 }}>
                    <Progress percent={50} status="active" />
                    <Text type="secondary">上传中...</Text>
                  </div>
                )}
                {formData.guideUrl && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      background: "#e8f5e9",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <FileTextOutlined style={{ color: "#52c41a" }} />
                      <Text style={{ fontWeight: 500, color: "#52c41a" }}>
                        {formData.guideTitle || "已上传文件"}
                      </Text>
                    </div>
                    <Button
                      size="small"
                      danger
                      onClick={() =>
                        setFormData({
                          ...formData,
                          guideUrl: "",
                          guideTitle: "",
                        })
                      }
                    >
                      删除
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Divider />

            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              知识点关联
            </Title>

            <div style={{ marginBottom: 24 }}>
              <KnowledgeTreeMultiSelect
                value={selectedKnowledgeResources}
                onChange={setSelectedKnowledgeResources}
                treeData={knowledgeTreeData}
                disabled={!formData.courseId}
              />

              {selectedKnowledgeResources.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedKnowledgeResources.map((kr) => (
                    <Tag
                      key={kr.id}
                      closable
                      onClose={() => {
                        setSelectedKnowledgeResources(
                          selectedKnowledgeResources.filter(
                            (skr) => skr.id !== kr.id,
                          ),
                        );
                      }}
                    >
                      {kr.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无选择知识点（请先选择课程）</Text>
              )}
            </div>

            <Divider />

            <Title level={5} style={{ marginBottom: 16, fontWeight: 600 }}>
              主能力关联
            </Title>

            <div style={{ marginBottom: 24 }}>
              <Select
                placeholder="添加主能力"
                value={undefined}
                onChange={(value) => {
                  if (value && !selectedAbilities.find((a) => a.id === value)) {
                    const ability = mainAbilities.find((a) => a.id === value);
                    if (ability) {
                      setSelectedAbilities([
                        ...selectedAbilities,
                        { id: ability.id, name: ability.name },
                      ]);
                    }
                  }
                }}
                disabled={!formData.courseId}
                style={{ width: "100%", marginBottom: 16 }}
                options={mainAbilities
                  .filter(
                    (a) => !selectedAbilities.find((sa) => sa.id === a.id),
                  )
                  .map((a) => ({
                    label: a.name,
                    value: a.id,
                  }))}
              />

              {selectedAbilities.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {selectedAbilities.map((ability) => (
                    <Tag
                      key={ability.id}
                      color="blue"
                      closable
                      onClose={() => {
                        setSelectedAbilities(
                          selectedAbilities.filter((a) => a.id !== ability.id),
                        );
                      }}
                    >
                      {ability.name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <Text type="secondary">暂无选择主能力（请先选择课程）</Text>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 16,
                marginTop: 32,
              }}
            >
              <Button
                onClick={() => navigate("/teacher/dashboard/experiment-management")}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                取消
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={createMutation.isPending || updateMutation.isPending}
              >
                保存
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
