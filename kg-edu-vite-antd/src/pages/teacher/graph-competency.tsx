import React, { useRef, useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography,
  Spin,
  Alert,
  Tag,
  Button,
  Select,
  Input,
  Drawer,
  Descriptions,
  Tabs,
  Card,
  Modal,
  Table,
  Checkbox,
  Space,
  Popconfirm,
  message,
  Empty,
  List,
  Tooltip,
  Grid,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  CloseOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import ActionDropdown from "@/components/ActionDropdown";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import {
  listMainAbilities,
  listSubAbilities,
  createMainAbility,
  updateMainAbility,
  destroyMainAbility,
  createSubAbility,
  updateSubAbility,
  destroySubAbility,
  listAbilityRelations,
  getAbilityRelationsByCourse,
  createAbilityRelation,
  updateAbilityRelation,
  destroyAbilityRelation,
} from "@/lib/ash_rpc";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";

const { Title, Text } = Typography;
const { TextArea } = Input;

const knowledgeTypeMap: Record<string, string> = {
  subject: "主题",
  knowledge_unit: "知识单元",
  knowledge_cell: "知识点",
};

const SUPPORT_LEVEL_OPTIONS = [
  { value: "primary", label: "主支撑" },
  { value: "secondary", label: "次支撑" },
  { value: "practice", label: "实践" },
];

// 节点颜色（与子能力/知识点保持一致）
const ABILITY_NODE_COLOR = "#91cc75";
const KNOWLEDGE_NODE_COLOR = "#fac858";

// 支撑层级连线配色：与 job-competency-graph 一致
const supportLineConfig: Record<string, { width: number; color: string; opacity: number }> = {
  primary: { width: 3, color: "#722ed1", opacity: 0.75 },
  secondary: { width: 2, color: "#13c2c2", opacity: 0.7 },
  practice: { width: 1.5, color: ABILITY_NODE_COLOR, opacity: 0.6 },
};

const defaultSupportStyle = { width: 1.5, color: ABILITY_NODE_COLOR, opacity: 0.5 };

// 能力关联边配色：与支撑层级、父子连线区别开
const RELATION_EDGE_COLOR = "#fa541c";
const RELATION_EDGE_STYLE = { width: 2, color: RELATION_EDGE_COLOR, opacity: 0.85, curveness: 0.25 };

function renderAbilityName(name: string, type: string) {
  return (
    <Tooltip title={name}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
        <Tag color={type === "main" ? "blue" : "purple"} style={{ flexShrink: 0 }}>
          {type === "main" ? "主能力" : "子能力"}
        </Tag>
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
            flex: 1,
          }}
        >
          {name}
        </span>
      </span>
    </Tooltip>
  );
}

function getSupportStyle(level?: string | null) {
  if (!level) return defaultSupportStyle;
  return supportLineConfig[level] || defaultSupportStyle;
}

interface Course {
  id: string;
  title: string;
  description?: string;
}

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

interface AbilityRelation {
  id: string;
  sourceType: "main_ability" | "sub_ability";
  sourceId: string;
  targetType: "main_ability" | "sub_ability";
  targetId: string;
  courseId: string;
  description?: string | null;
  insertedAt?: string;
  updatedAt?: string;
}

interface AbilityOption {
  id: string;
  name: string;
  type: "main" | "sub";
  parentName?: string;
}

export default function TeacherGraphCompetencyView() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const zoomRatio = useRef(1);
  const baseNodesRef = useRef<CompetencyNode[]>([]);
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [mobilePopoverOpen, setMobilePopoverOpen] = useState(false);
  const [mobilePopoverNode, setMobilePopoverNode] = useState<CompetencyNode | null>(null);
  const { canEdit } = useEditPermission();
  const [ctxMenuVisible, setCtxMenuVisible] = useState(false);
  const [ctxMenuPos, setCtxMenuPos] = useState({ x: 0, y: 0 });
  const [ctxMenuNode, setCtxMenuNode] = useState<CompetencyNode | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const zoomIn = useCallback(() => {
    if (!chartInstance.current) return;
    try {
      const opt = chartInstance.current.getOption() as any;
      const cur = opt?.series?.[0]?.zoom || 1;
      const next = Math.min(3, cur + 0.2);
      chartInstance.current.setOption({ series: [{ zoom: next }] });
      zoomRatio.current = next;
      setZoomPercent(Math.round(next * 100));
    } catch {}
  }, []);
  const zoomOut = useCallback(() => {
    if (!chartInstance.current) return;
    try {
      const opt = chartInstance.current.getOption() as any;
      const cur = opt?.series?.[0]?.zoom || 1;
      const next = Math.max(0.2, cur - 0.2);
      chartInstance.current.setOption({ series: [{ zoom: next }] });
      zoomRatio.current = next;
      setZoomPercent(Math.round(next * 100));
    } catch {}
  }, []);
  const zoomReset = useCallback(() => {
    if (!chartInstance.current) return;
    chartInstance.current.setOption({ series: [{ zoom: 1 }] });
    zoomRatio.current = 1;
    setZoomPercent(100);
  }, []);

  const tenant = currentTenant?.schemaName || "";

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<CompetencyNode | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showPanel, setShowPanel] = useState<boolean>(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedKnowledgePoint, setSelectedKnowledgePoint] = useState<{
    id: string;
    name: string;
    description?: string;
  } | null>(null);
  const [selectedAbilityNode, setSelectedAbilityNode] = useState<{
    id: string;
    name: string;
    type: "main" | "sub";
    description?: string;
    knowledgeResourceIds: string[];
  } | null>(null);
  const [currentKnowledgeResource, setCurrentKnowledgeResource] = useState<{
    id: string;
    name: string;
    knowledgeType: string;
    description?: string | null;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("graph");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"main" | "sub">("main");
  const [knowledgeDialogOpen, setKnowledgeDialogOpen] = useState(false);
  const [selectedSubAbilityForKnowledge, setSelectedSubAbilityForKnowledge] =
    useState<string>("");
  const [selectedKnowledgeResources, setSelectedKnowledgeResources] = useState<
    string[]
  >([]);
  const [managementSearchTerm, setManagementSearchTerm] = useState("");
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

  // 能力关联管理状态
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [editingRelation, setEditingRelation] = useState<AbilityRelation | null>(null);
  const [relationForm, setRelationForm] = useState<{
    sourceKey: string;
    targetKey: string;
    description: string;
  }>({ sourceKey: "", targetKey: "", description: "" });
  const [relationSearchTerm, setRelationSearchTerm] = useState("");

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description"],
  });

  useEffect(() => {
    console.log("viewingKnowledge changed:", viewingKnowledge);
  }, [viewingKnowledge]);

  const {
    data: mainAbilitiesData,
    isLoading: mainAbilitiesLoading,
    error: mainAbilitiesError,
  } = useQuery({
    queryKey: ["main-abilities", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await listMainAbilities({
        tenant,
        fields: ["id", "name", "description", "courseId"],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
    staleTime: 0,
  });

  const {
    data: subAbilitiesData,
    isLoading: subAbilitiesLoading,
    error: subAbilitiesError,
  } = useQuery({
    queryKey: ["sub-abilities", selectedCourseId, tenant, mainAbilitiesData],
    queryFn: async () => {
      if (!mainAbilitiesData || mainAbilitiesData.length === 0) {
        return [];
      }
      const mainAbilityIds = mainAbilitiesData.map((ma: any) => ma.id);
      const result = await listSubAbilities({
        tenant,
        fields: [
          "id",
          "name",
          "description",
          "mainAbilityId",
          { knowledgeResources: ["id", "name", "description", "knowledgeType"] },
        ],
        filter: {
          mainAbilityId: { in: mainAbilityIds },
        },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled:
      !!selectedCourseId &&
      !!tenant &&
      !!user &&
      !!mainAbilitiesData &&
      mainAbilitiesData.length > 0,
    staleTime: 0,
  });

  // 当前查看子能力的所有 join 记录（含 supportLevel），用于图谱与编辑
  const [viewJoinRecords, setViewJoinRecords] = useState<
    Array<{ id: string; subAbilityId: string; knowledgeResourceId: string; supportLevel: string; description?: string | null }>
  >([]);
  const [viewJoinLoading, setViewJoinLoading] = useState(false);
  // 新关联知识点时使用的支撑层级
  const [newLinkSupportLevel, setNewLinkSupportLevel] = useState<"primary" | "secondary" | "practice">("primary");
  // 编辑已有关联支撑层级的临时状态
  const [editingLinkSupport, setEditingLinkSupport] = useState<{
    joinId: string;
    supportLevel: "primary" | "secondary" | "practice";
  } | null>(null);

  const { data: managementSubAbilitiesData = [] } = useQuery({
    queryKey: ["management-sub-abilities", selectedCourseId, tenant],
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
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  // 加载当前课程的能力关联列表（能力关系管理 tab 使用 + 图谱"关联"边）
  const {
    data: abilityRelations = [],
    isLoading: abilityRelationsLoading,
    refetch: refetchAbilityRelations,
  } = useQuery({
    queryKey: ["ability-relations", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await getAbilityRelationsByCourse({
        tenant,
        input: { courseId: selectedCourseId },
        fields: [
          "id",
          "sourceType",
          "sourceId",
          "targetType",
          "targetId",
          "courseId",
          "description",
          "insertedAt",
          "updatedAt",
        ],
        headers: getHeaders(user),
      });
      const arr = extractArrayData(result);
      return (arr || []) as AbilityRelation[];
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
    staleTime: 0,
  });

  // 构建 (type, id) -> ability 的查找表，用于关联管理对话框与图谱关联边的源/目标名称解析
  const abilityLookup = React.useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; type: "main" | "sub"; parentName?: string }
    >();
    (mainAbilitiesData || []).forEach((m: MainAbility) => {
      map.set(`main|${m.id}`, { id: m.id, name: m.name, type: "main" });
    });
    (subAbilitiesData || []).forEach((s: SubAbility) => {
      const parent = (mainAbilitiesData || []).find(
        (m: MainAbility) => m.id === s.mainAbilityId,
      );
      map.set(`sub|${s.id}`, {
        id: s.id,
        name: s.name,
        type: "sub",
        parentName: parent?.name,
      });
    });
    return map;
  }, [mainAbilitiesData, subAbilitiesData]);

  // 加载所有子能力关联的 join 记录，用于按 supportLevel 渲染图谱边
  const { data: allJoinRecords = [] } = useQuery({
    queryKey: ["sub-ability-joins", selectedCourseId, tenant, managementSubAbilitiesData],
    queryFn: async () => {
      const subs = managementSubAbilitiesData || [];
      if (subs.length === 0) return [];
      const authHeaders = getHeaders(user);
      const allJoins: Array<{
        id: string;
        subAbilityId: string;
        knowledgeResourceId: string;
        supportLevel: string;
      }> = [];
      // 并发拉取每个子能力的 join 记录
      await Promise.all(
        subs.map(async (sub: any) => {
          try {
            const res = await fetch("/rpc/run", {
              method: "POST",
              headers: {
                ...authHeaders,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "get_joins_by_sub_ability",
                tenant,
                input: { sub_ability_id: sub.id },
                fields: ["id", "sub_ability_id", "knowledge_resource_id", "support_level"],
              }),
            });
            const json = await res.json();
            if (!json.success) return;
            let records = json.data;
            if (records && records.data) records = records.data;
            else if (records && records.results) records = records.results;
            if (!Array.isArray(records)) return;
            records.forEach((r: any) => {
              allJoins.push({
                id: r.id,
                subAbilityId: r.subAbilityId,
                knowledgeResourceId: r.knowledgeResourceId,
                supportLevel: r.supportLevel || "primary",
              });
            });
          } catch (e) {
            console.error("Failed to load joins for sub", sub.id, e);
          }
        }),
      );
      return allJoins;
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
    staleTime: 0,
  });

  // 构建支撑层级映射：key = `${subAbilityId}|${knowledgeResourceId}`
  const supportLevelMap = React.useMemo(() => {
    const m = new Map<string, string>();
    allJoinRecords.forEach((j) => {
      m.set(`${j.subAbilityId}|${j.knowledgeResourceId}`, j.supportLevel || "primary");
    });
    return m;
  }, [allJoinRecords]);

  const { data: knowledgeResourcesData = [] } = useQuery({
    queryKey: ["knowledge-resources", selectedCourseId, tenant],
    queryFn: async () => {
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${encodeURIComponent(tenant)}`,
        {
          headers: {
            ...getHeaders(user),
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
    enabled: !!selectedCourseId && !!tenant && !!user && knowledgeDialogOpen,
  });

  const {
    data: graphData,
    isLoading: graphLoading,
    error: graphError,
  } = useQuery({
    queryKey: [
      "teacher-competency-graph",
      selectedCourseId,
      mainAbilitiesData,
      subAbilitiesData,
      allJoinRecords,
      abilityRelations,
    ],
    queryFn: async (): Promise<CompetencyGraphData> => {
      if (!mainAbilitiesData || !Array.isArray(mainAbilitiesData)) {
        return { nodes: [], links: [], categories: [] };
      }

      const nodes: CompetencyNode[] = [];
      const links: CompetencyLink[] = [];
      const nodeIds = new Set<string>();
      const nodeMap = new Map<string, CompetencyNode>();

      if (mainAbilitiesData.length === 0) {
        return { nodes: [], links: [], categories: [] };
      }

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

          // 根据支撑层级决定连线颜色和粗细
          const supportLevel = supportLevelMap.get(`${subId}|${krId}`) || "primary";
          const style = getSupportStyle(supportLevel);
          links.push({
            source: subId,
            target: krId,
            lineStyle: {
              opacity: style.opacity,
              width: style.width,
              color: style.color,
              curveness: 0.2,
            },
            // 透传到 ECharts data 上，tooltip 可读取
            supportLevel,
          } as any);
        });
      });

      // 能力关联边：在所有能力节点就位后再添加，避免引用未创建节点
      (abilityRelations as AbilityRelation[]).forEach((rel) => {
        const sourceKey =
          rel.sourceType === "main_ability"
            ? `main|${rel.sourceId}`
            : `sub|${rel.sourceId}`;
        const targetKey =
          rel.targetType === "main_ability"
            ? `main|${rel.targetId}`
            : `sub|${rel.targetId}`;
        const sourceNode = abilityLookup.get(sourceKey);
        const targetNode = abilityLookup.get(targetKey);
        if (!sourceNode || !targetNode) return; // 源/目标被删除则跳过
        links.push({
          source: rel.sourceId,
          target: rel.targetId,
          lineStyle: {
            opacity: RELATION_EDGE_STYLE.opacity,
            width: RELATION_EDGE_STYLE.width,
            color: RELATION_EDGE_STYLE.color,
            curveness: RELATION_EDGE_STYLE.curveness,
            type: "dashed",
          },
          // 透传到 ECharts data，tooltip 可识别
          relation: true,
          relationLabel: rel.description ? `能力关联: ${rel.description}` : "能力关联",
          sourceName: sourceNode.name,
          targetName: targetNode.name,
          description: rel.description || undefined,
        } as any);
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
    enabled: !!selectedCourseId && !!mainAbilitiesData && !!subAbilitiesData,
    staleTime: 5 * 60 * 1000,
  });

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
        headers: getHeaders(user),
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
        headers: getHeaders(user),
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
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["main-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["management-sub-abilities"] });
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
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("创建成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["management-sub-abilities"] });
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
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("更新成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["management-sub-abilities"] });
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
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["management-sub-abilities"] });
    },
    onError: (error: any) => {
      message.error(error?.message || "操作失败");
    },
  });

  // ============ 能力关联 Mutations ============
  const createRelationMutation = useMutation({
    mutationFn: async (input: {
      sourceType: "main_ability" | "sub_ability";
      sourceId: string;
      targetType: "main_ability" | "sub_ability";
      targetId: string;
      description?: string;
    }) => {
      return createAbilityRelation({
        tenant,
        input: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetType: input.targetType,
          targetId: input.targetId,
          courseId: selectedCourseId,
          description: input.description,
        },
        fields: [
          "id",
          "sourceType",
          "sourceId",
          "targetType",
          "targetId",
          "courseId",
          "description",
        ],
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("关联创建成功");
      queryClient.invalidateQueries({ queryKey: ["ability-relations"] });
      handleCloseRelationDialog();
    },
    onError: (error: any) => {
      const msg =
        error?.errors?.[0]?.message || error?.message || "操作失败";
      message.error(msg);
    },
  });

  const updateRelationMutation = useMutation({
    mutationFn: async ({
      primaryKey,
      description,
    }: {
      primaryKey: string;
      description?: string;
    }) => {
      return updateAbilityRelation({
        tenant,
        primaryKey,
        input: { description: description ?? null },
        fields: ["id", "description"],
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("关联已更新");
      queryClient.invalidateQueries({ queryKey: ["ability-relations"] });
      handleCloseRelationDialog();
    },
    onError: (error: any) => {
      const msg =
        error?.errors?.[0]?.message || error?.message || "操作失败";
      message.error(msg);
    },
  });

  const destroyRelationMutation = useMutation({
    mutationFn: async (primaryKey: string) => {
      return destroyAbilityRelation({
        tenant,
        primaryKey,
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      message.success("关联已删除");
      queryClient.invalidateQueries({ queryKey: ["ability-relations"] });
    },
    onError: (error: any) => {
      const msg =
        error?.errors?.[0]?.message || error?.message || "操作失败";
      message.error(msg);
    },
  });

  // 解析 sourceKey/targetKey（"main|<id>" / "sub|<id>"）到具体类型与 ID
  const parseAbilityKey = (key: string) => {
    const [type, id] = key.split("|");
    return {
      type: type === "main" ? ("main_ability" as const) : ("sub_ability" as const),
      id,
    };
  };

  const handleOpenAddRelation = () => {
    setEditingRelation(null);
    setRelationForm({ sourceKey: "", targetKey: "", description: "" });
    setRelationDialogOpen(true);
  };

  const handleOpenEditRelation = (rel: AbilityRelation) => {
    setEditingRelation(rel);
    const sourceKey =
      rel.sourceType === "main_ability"
        ? `main|${rel.sourceId}`
        : `sub|${rel.sourceId}`;
    const targetKey =
      rel.targetType === "main_ability"
        ? `main|${rel.targetId}`
        : `sub|${rel.targetId}`;
    setRelationForm({
      sourceKey,
      targetKey,
      description: rel.description || "",
    });
    setRelationDialogOpen(true);
  };

  const handleCloseRelationDialog = () => {
    setRelationDialogOpen(false);
    setEditingRelation(null);
    setRelationForm({ sourceKey: "", targetKey: "", description: "" });
  };

  // 当源能力变化时，若目标能力与源能力相同则清空目标（避免自身关联）
  React.useEffect(() => {
    if (
      relationForm.sourceKey &&
      relationForm.targetKey &&
      relationForm.sourceKey === relationForm.targetKey
    ) {
      setRelationForm((prev) => ({ ...prev, targetKey: "" }));
    }
  }, [relationForm.sourceKey, relationForm.targetKey]);

  const handleSubmitRelation = () => {
    if (!relationForm.sourceKey || !relationForm.targetKey) {
      message.warning("请选择源能力与目标能力");
      return;
    }
    if (relationForm.sourceKey === relationForm.targetKey) {
      message.warning("源能力和目标能力不能相同");
      return;
    }
    const source = parseAbilityKey(relationForm.sourceKey);
    const target = parseAbilityKey(relationForm.targetKey);
    if (editingRelation) {
      updateRelationMutation.mutate({
        primaryKey: editingRelation.id,
        description: relationForm.description,
      });
    } else {
      createRelationMutation.mutate({
        sourceType: source.type,
        sourceId: source.id,
        targetType: target.type,
        targetId: target.id,
        description: relationForm.description || undefined,
      });
    }
  };

  const handleDeleteRelation = (rel: AbilityRelation) => {
    destroyRelationMutation.mutate(rel.id);
  };

  // 构造关联管理表格行
  const relationRows = React.useMemo(() => {
    return (abilityRelations as AbilityRelation[]).map((rel) => {
      const sourceKey =
        rel.sourceType === "main_ability"
          ? `main|${rel.sourceId}`
          : `sub|${rel.sourceId}`;
      const targetKey =
        rel.targetType === "main_ability"
          ? `main|${rel.targetId}`
          : `sub|${rel.targetId}`;
      const source = abilityLookup.get(sourceKey);
      const target = abilityLookup.get(targetKey);
      const nameOf = (info?: { name: string }) =>
        info?.name || "（已删除）";
      return {
        key: rel.id,
        id: rel.id,
        sourceName: nameOf(source),
        targetName: nameOf(target),
        sourceType: source?.type,
        targetType: target?.type,
        description: rel.description || "",
        raw: rel,
      };
    });
  }, [abilityRelations, abilityLookup]);

  const filteredRelationRows = React.useMemo(() => {
    if (!relationSearchTerm.trim()) return relationRows;
    const lower = relationSearchTerm.toLowerCase();
    return relationRows.filter(
      (r) =>
        r.sourceName.toLowerCase().includes(lower) ||
        r.targetName.toLowerCase().includes(lower) ||
        (r.description || "").toLowerCase().includes(lower),
    );
  }, [relationRows, relationSearchTerm]);

  const abilityOptions = React.useMemo<AbilityOption[]>(() => {
    const opts: AbilityOption[] = [];
    (mainAbilitiesData || []).forEach((m: MainAbility) => {
      opts.push({ id: m.id, name: m.name, type: "main" });
    });
    (subAbilitiesData || []).forEach((s: SubAbility) => {
      const parent = (mainAbilitiesData || []).find(
        (m: MainAbility) => m.id === s.mainAbilityId,
      );
      opts.push({
        id: s.id,
        name: s.name,
        type: "sub",
        parentName: parent?.name,
      });
    });
    return opts;
  }, [mainAbilitiesData, subAbilitiesData]);

  const handleNodeClick = useCallback((params: any) => {
    if (params.dataType === "node") {
      const nodeData = params.data as CompetencyNode;
      if (isMobile) {
        // 移动端：显示底部弹出选择
        params.event?.event?.preventDefault?.();
        setMobilePopoverNode(nodeData);
        setMobilePopoverOpen(true);
        return;
      }
      // 桌面端：直接处理点击
      setSelectedNode(nodeData);

      if (nodeData.category === 2) {
        setCurrentKnowledgeResource({
          id: nodeData.id,
          name: nodeData.name,
          knowledgeType: "知识点",
          description: nodeData.description,
        });
      } else if (nodeData.category === 0 || nodeData.category === 1) {
        const nodeId = nodeData.id;
        let knowledgeResourceIds: string[] = [];
        const abilityType: "main" | "sub" = nodeData.category === 0 ? "main" : "sub";

        if (nodeData.category === 1 && subAbilitiesData) {
          const subAbility = subAbilitiesData.find(
            (sub: SubAbility) => String(sub.id) === nodeId,
          );
          if (subAbility?.knowledgeResources) {
            knowledgeResourceIds = subAbility.knowledgeResources.map(
              (kr: KnowledgeResource) => kr.id,
            );
          }
        } else if (nodeData.category === 0 && mainAbilitiesData && subAbilitiesData) {
          const mainAbility = mainAbilitiesData.find(
            (ma: MainAbility) => String(ma.id) === nodeId,
          );
          if (mainAbility) {
            const relatedSubAbilities = subAbilitiesData.filter(
              (sub: SubAbility) => sub.mainAbilityId === mainAbility.id,
            );
            relatedSubAbilities.forEach((sub: SubAbility) => {
              if (sub.knowledgeResources) {
                const ids = sub.knowledgeResources.map(
                  (kr: KnowledgeResource) => kr.id,
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

  // 右键菜单
  const handleContextMenu = useCallback((params: any) => {
    if (params.dataType === "node") {
      params.event?.event?.preventDefault?.();
      setCtxMenuPos({ x: params.event.event?.clientX || 0, y: params.event.event?.clientY || 0 });
      setCtxMenuNode(params.data as CompetencyNode);
      setCtxMenuVisible(true);
    }
  }, []);

  // 右键菜单"查看详情"
  const handleCtxMenuDetail = useCallback(() => {
    if (!ctxMenuNode) return;
    setCtxMenuVisible(false);
    const nodeData = ctxMenuNode;
    setSelectedNode(nodeData);
    if (nodeData.category === 2) {
      setCurrentKnowledgeResource({ id: nodeData.id, name: nodeData.name, knowledgeType: "知识点", description: nodeData.description });
    } else if (nodeData.category === 0 || nodeData.category === 1) {
      setSelectedAbilityNode({
        id: nodeData.id,
        name: nodeData.name,
        type: nodeData.category === 0 ? "main" : "sub",
        description: nodeData.description,
        knowledgeResourceIds: [],
      });
      setDrawerOpen(true);
    }
  }, [ctxMenuNode]);

  const filteredGraphData = React.useMemo(() => {
    if (!graphData) return graphData;

    let filteredNodes = graphData.nodes;
    let filteredLinks = graphData.links;

    if (selectedCategory !== null) {
      const filteredNodeIds = new Set(
        filteredNodes
          .filter((node) => node.category === selectedCategory)
          .map((node) => node.id),
      );

      filteredNodes = filteredNodes.filter((node) =>
        filteredNodeIds.has(node.id),
      );
      filteredLinks = filteredLinks.filter(
        (link) =>
          filteredNodeIds.has(String(link.source)) &&
          filteredNodeIds.has(String(link.target)),
      );
    }

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      const searchNodeIds = new Set(
        filteredNodes
          .filter((node) => node.name.toLowerCase().includes(searchLower))
          .map((node) => node.id),
      );

      filteredNodes = filteredNodes.filter((node) =>
        searchNodeIds.has(node.id),
      );
      filteredLinks = filteredLinks.filter(
        (link) =>
          searchNodeIds.has(String(link.source)) &&
          searchNodeIds.has(String(link.target)),
      );
    }

    return {
      ...graphData,
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }, [graphData, selectedCategory, searchTerm]);

  React.useEffect(() => {
    if (!filteredGraphData || activeTab !== "graph") return;

    // 确保 DOM 元素准备好后再初始化图表
    const initChart = () => {
      if (!chartRef.current) {
        // 延迟重试
        setTimeout(initChart, 100);
        return;
      }

      // 检查容器是否有有效尺寸
      const container = chartRef.current;
      if (!container.offsetWidth || !container.offsetHeight) {
        setTimeout(initChart, 100);
        return;
      }

      // 检查是否有数据
      const hasData = filteredGraphData.nodes && filteredGraphData.nodes.length > 0;
      if (!hasData) {
        return;
      }

      const chart = echarts.getInstanceByDom(container);
      if (chart) {
        chart.dispose();
      }

      const newChart = echarts.init(container);
      newChart.showLoading();
      chartInstance.current = newChart;

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
                data.category !== undefined
                  ? filteredGraphData.categories[data.category]?.name
                  : "";
              const description = data.description
                ? `<br/><span style="color: #ccc; font-size: 11px;">${data.description}</span>`
                : "";
              return `<strong>${data.name}</strong><br/>${categoryName}${description}`;
            }
            if (params.dataType === "edge") {
              // 能力关联边：玫红色虚线，标签固定为"关联"
              if (params.data?.relation) {
                const sourceName =
                  params.data?.sourceName ||
                  String(params.data?.source || "");
                const targetName =
                  params.data?.targetName ||
                  String(params.data?.target || "");
                const labelText = params.data?.description
                  ? `能力关联: ${params.data.description}`
                  : "能力关联";
                return `<span style="display:inline-block;width:10px;height:2px;border-radius:1px;background:${RELATION_EDGE_COLOR};border-top:2px dashed ${RELATION_EDGE_COLOR};margin-right:6px"></span>${labelText}`;
              }
              const level = params.data?.supportLevel || "primary";
              const labelMap: Record<string, string> = {
                primary: "主支撑",
                secondary: "次支撑",
                practice: "实践",
              };
              const colorMap: Record<string, string> = {
                primary: "#722ed1",
                secondary: "#13c2c2",
                practice: ABILITY_NODE_COLOR,
              };
              const label = labelMap[level] || level;
              const color = colorMap[level] || "#999";
              return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px"></span>能力关系 · ${label}`;
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
        toolbox: {
          show: true,
          orient: "vertical",
          left: "right",
          top: "center",
          feature: {
            dataZoom: {
              show: true,
              title: { zoom: "区域缩放", back: "区域缩放还原" },
            },
            restore: {
              show: true,
              title: "还原",
            },
            saveAsImage: {
              show: true,
              title: "保存图片",
            },
          },
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
        // 自定义图形：右下角展示支撑层级图例
        graphic: [
          {
            type: "group",
            right: 16,
            bottom: 16,
            children: [
              {
                type: "rect",
                shape: { width: 208, height: 138, r: 8 },
                style: {
                  fill: "rgba(255,255,255,0.92)",
                  stroke: "#e8e8e8",
                  lineWidth: 1,
                },
              },
              {
                type: "text",
                left: 14,
                top: 8,
                style: {
                  text: "边类型（图例）",
                  font: "bold 12px sans-serif",
                  fill: "#333",
                },
              },
              {
                type: "line",
                shape: { x1: 14, y1: 28, x2: 44, y2: 28 },
                style: { stroke: "#722ed1", lineWidth: 3 },
              },
              {
                type: "text",
                left: 52,
                top: 22,
                style: { text: "主支撑", font: "12px sans-serif", fill: "#333" },
              },
              {
                type: "line",
                shape: { x1: 14, y1: 46, x2: 44, y2: 46 },
                style: { stroke: "#13c2c2", lineWidth: 2 },
              },
              {
                type: "text",
                left: 52,
                top: 40,
                style: { text: "次支撑", font: "12px sans-serif", fill: "#333" },
              },
              {
                type: "line",
                shape: { x1: 14, y1: 64, x2: 44, y2: 64 },
                style: { stroke: ABILITY_NODE_COLOR, lineWidth: 1.5 },
              },
              {
                type: "text",
                left: 52,
                top: 58,
                style: { text: "实践", font: "12px sans-serif", fill: "#333" },
              },
              {
                type: "line",
                shape: { x1: 14, y1: 86, x2: 44, y2: 86 },
                style: {
                  stroke: RELATION_EDGE_COLOR,
                  lineWidth: 2,
                  lineDash: [6, 4],
                },
              },
              {
                type: "text",
                left: 52,
                top: 80,
                style: {
                  text: "能力关联",
                  font: "12px sans-serif",
                  fill: RELATION_EDGE_COLOR,
                  fontWeight: "bold",
                },
              },
            ],
          },
        ],
        animation: true,
        animationDuration: 1500,
        animationEasingUpdate: "quinticInOut",
        series: [
          {
            id: "competency-graph",
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

      newChart.hideLoading();
      newChart.setOption(option as any);
      newChart.on("click", handleNodeClick);
      newChart.on("contextmenu", handleContextMenu);

      // 监听缩放事件，实现字体缩放
      const handleGraphRoam = () => {
        if (!chartInstance.current) return;
        try {
          // 通过 getOption 获取当前图表的实际缩放比例
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
              id: 'competency-graph',
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
          console.error('[GraphCompetency] zoom error:', e);
        }
      };

      newChart.on('graphRoam', handleGraphRoam);

      const handleResize = () => {
        newChart.resize();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        newChart.off('graphRoam', handleGraphRoam);
        newChart.dispose();
      };
    };

    initChart();
  }, [filteredGraphData, handleNodeClick, activeTab]);

  const treeData: TreeRow[] = React.useMemo(() => {
    const mainAbilities = mainAbilitiesData || [];
    const subAbilities = managementSubAbilitiesData || [];

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
  }, [mainAbilitiesData, managementSubAbilitiesData]);

  const availableKnowledgeResources = React.useMemo(() => {
    if (!knowledgeResourcesData) return [];

    const subAbilities = managementSubAbilitiesData || [];
    const subAbility = subAbilities.find(
      (sub: SubAbility) => sub.id === selectedSubAbilityForKnowledge,
    );
    const linkedIds =
      subAbility?.knowledgeResources?.map((kr: KnowledgeResource) => kr.id) ||
      [];

    return knowledgeResourcesData.filter((kr) => !linkedIds.includes(kr.id));
  }, [
    knowledgeResourcesData,
    managementSubAbilitiesData,
    selectedSubAbilityForKnowledge,
  ]);

  const flattenedData = React.useMemo(() => {
    if (!managementSearchTerm.trim()) {
      return treeData;
    }
    const searchLower = managementSearchTerm.toLowerCase();
    const filterTree = (data: TreeRow[]): TreeRow[] => {
      return data
        .map((item) => {
          const matched = item.name.toLowerCase().includes(searchLower);
          const filteredChildren = item.children ? filterTree(item.children) : undefined;
          if (matched || (filteredChildren && filteredChildren.length > 0)) {
            return {
              ...item,
              children: filteredChildren,
            };
          }
          return null;
        })
        .filter((item): item is TreeRow => item !== null);
    };
    return filterTree(treeData);
  }, [treeData, managementSearchTerm]);

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({ name: "", description: "" });
    setSelectedMainAbilityId("");
  };

  const handleOpenKnowledgeDialog = (subAbilityId: string) => {
    setSelectedSubAbilityForKnowledge(subAbilityId);
    setSelectedKnowledgeResources([]);
    setManagementSearchTerm("");
    setNewLinkSupportLevel("primary");
    setKnowledgeDialogOpen(true);
  };

  const handleCloseKnowledgeDialog = () => {
    setKnowledgeDialogOpen(false);
    setSelectedSubAbilityForKnowledge("");
    setSelectedKnowledgeResources([]);
    setManagementSearchTerm("");
    setNewLinkSupportLevel("primary");
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
    const authHeaders = getHeaders(user);

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
              support_level: newLinkSupportLevel,
            },
            fields: ["id", "sub_ability_id", "knowledge_resource_id", "support_level"],
          }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["management-sub-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["sub-ability-joins"] });
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
    const authHeaders = getHeaders(user);

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
      await queryClient.invalidateQueries({
        queryKey: ["management-sub-abilities"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sub-ability-joins"],
      });

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
        setViewJoinRecords((prev) =>
          prev.filter((r) => r.knowledgeResourceId !== knowledgeResourceId),
        );
      }

      message.success("取消关联成功");
    } catch (error) {
      console.error("Failed to unlink knowledge resource:", error);
      message.error("取消关联失败，请重试");
    }
  };

  const handleViewKnowledgeResources = async (subAbility: SubAbility) => {
    setViewingSubAbility(subAbility);
    setViewKnowledgeDialogOpen(true);
    setViewJoinLoading(true);
    try {
      const authHeaders = getHeaders(user);
      const res = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get_joins_by_sub_ability",
          tenant,
          input: { sub_ability_id: subAbility.id },
          fields: ["id", "sub_ability_id", "knowledge_resource_id", "support_level"],
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error("加载关联记录失败");
      let records = json.data;
      if (records && records.data) records = records.data;
      else if (records && records.results) records = records.results;
      if (!Array.isArray(records)) records = [];
      setViewJoinRecords(
        records.map((r: any) => ({
          id: r.id,
          subAbilityId: r.subAbilityId,
          knowledgeResourceId: r.knowledgeResourceId,
          supportLevel: r.supportLevel || "primary",
        })),
      );
    } catch (e) {
      console.error("Failed to load view join records:", e);
      setViewJoinRecords([]);
    } finally {
      setViewJoinLoading(false);
    }
  };

  const handleCloseViewKnowledgeDialog = () => {
    setViewKnowledgeDialogOpen(false);
    setViewingSubAbility(null);
    setViewJoinRecords([]);
    setEditingLinkSupport(null);
  };

  const handleUpdateLinkSupport = async (joinId: string, supportLevel: "primary" | "secondary" | "practice") => {
    try {
      const authHeaders = getHeaders(user);
      const res = await fetch("/rpc/run", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "update_join",
          tenant,
          primaryKey: joinId,
          input: { support_level: supportLevel },
          fields: ["id", "support_level"],
        }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.errors?.[0]?.message || "更新失败");
      }
      setViewJoinRecords((prev) =>
        prev.map((r) => (r.id === joinId ? { ...r, supportLevel } : r)),
      );
      await queryClient.invalidateQueries({ queryKey: ["sub-ability-joins"] });
      message.success("支撑层级已更新");
    } catch (e: any) {
      console.error("Failed to update support level:", e);
      message.error(e?.message || "更新支撑层级失败");
    } finally {
      setEditingLinkSupport(null);
    }
  };

  const handleViewKnowledge = (knowledge: KnowledgeResource) => {
    console.log("handleViewKnowledge called:", knowledge);
    setViewKnowledgeDialogOpen(false);
    setViewingSubAbility(null);
    setViewingKnowledge(knowledge);
  };

  const handleCloseKnowledgePanel = () => {
    console.log("handleCloseKnowledgePanel called");
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
      render: (description: string | null) => {
        if (!description) {
          return <Text type="secondary">-</Text>;
        }
        const isLongDescription = description.length > 30;
        return isLongDescription ? (
          <Tooltip title={description} mouseEnterDelay={0.3}>
            <Text type="secondary" ellipsis style={{ maxWidth: 230, cursor: "pointer" }}>
              {description.slice(0, 30)}...
            </Text>
          </Tooltip>
        ) : (
          <Text type="secondary" ellipsis style={{ maxWidth: 230 }}>
            {description}
          </Text>
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
      width: 100,
      render: (_: any, record: TreeRow) => {
        const isMain = record.type === "main";
        const items = [
          {
            key: "edit",
            label: "编辑",
            icon: <EditOutlined />,
            onClick: () => handleEdit(record),
          },
          ...(isMain
            ? [
                {
                  key: "addSub",
                  label: "添加子能力",
                  icon: <PlusOutlined />,
                  onClick: () => handleAddSub(record.id),
                },
              ]
            : [
                {
                  key: "linkKnowledge",
                  label: "关联知识点",
                  icon: <BookOutlined />,
                  onClick: () => handleOpenKnowledgeDialog(record.id),
                },
              ]),
          {
            key: "delete",
            label: (
              <Popconfirm
                title="确定删除?"
                description="此操作不可恢复"
                onConfirm={() => handleDelete(record)}
                okText="确定"
                cancelText="取消"
              >
                <span>删除</span>
              </Popconfirm>
            ),
            icon: <DeleteOutlined />,
            danger: true,
          },
        ];

        return canEdit ? <ActionDropdown items={items} /> : null;
      },
    },
  ];

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
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
          height: "100vh",
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

  const tabItems = [
    {
      key: "graph",
      label: "能力图谱",
      children: (
        <>
          {showPanel && selectedCourseId && (
            <div
              style={{
                height: 48,
                padding: "0 16px",
                backgroundColor: "white",
                borderBottom: "1px solid #e5e7eb",
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              <Input
                placeholder="搜索能力或知识点..."
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
                style={{ width: 200, flexShrink: 0 }}
              />

              <Select
                value={selectedCategory ?? undefined}
                placeholder="能力类型"
                style={{ width: 140, flexShrink: 0 }}
                onChange={(value) =>
                  setSelectedCategory(value === undefined ? null : value)
                }
                allowClear
                options={[
                  { label: "全部", value: undefined },
                  ...(graphData?.categories?.map((cat, index) => ({
                    label: cat.name,
                    value: index,
                  })) || []),
                ]}
              />

              <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Tag color="purple">主支撑</Tag>
                <Tag color="cyan">次支撑</Tag>
                <Tag color="green">实践</Tag>
              </span>

              {(selectedCategory !== null || searchTerm.trim()) && (
                <Tag
                  closable
                  onClose={() => {
                    setSelectedCategory(null);
                    setSearchTerm("");
                  }}
                  color="blue"
                >
                  清除筛选 ({filteredGraphData?.nodes?.length || 0} 个节点)
                </Tag>
              )}

              <div style={{ flex: 1 }} />
              <span style={{ color: "#999", fontSize: 12, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{zoomPercent}%</span>
              <button onClick={zoomOut} style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 5, color: "#333", padding: "4px 12px", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>−</button>
              <button onClick={zoomIn} style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 5, color: "#333", padding: "4px 12px", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>+</button>
              <button onClick={zoomReset} style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 5, color: "#333", padding: "4px 12px", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>⟳</button>
            </div>
          )}

          <div style={{ padding: 24 }}>
            {!currentTenant && (
              <Alert
                type="warning"
                message="⚠️ 未检测到租户信息，请先选择一个租户/组织"
                style={{
                  borderRadius: 12,
                  backgroundColor: "#fff3e0",
                  border: "1px solid #ffcc02",
                  marginBottom: 16,
                }}
              />
            )}

            {!selectedCourseId && (
              <Alert
                type="info"
                message="请选择一个课程来查看能力图谱"
                style={{
                  borderRadius: 12,
                  backgroundColor: "#e3f2fd",
                  border: "1px solid #bbdefb",
                  marginBottom: 16,
                }}
              />
            )}

            {(mainAbilitiesError || subAbilitiesError || graphError) && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 12,
                  backgroundColor: "#fef3f2",
                  border: "1px solid #f8d7da",
                  marginBottom: 16,
                }}
              >
                <Text type="secondary" strong>
                  加载数据时出错:{" "}
                  {(mainAbilitiesError ||
                    subAbilitiesError ||
                    graphError) instanceof Error
                    ? (mainAbilitiesError || subAbilitiesError || graphError)
                        ?.message
                    : "未知错误"}
                </Text>
              </div>
            )}

            {(graphLoading || mainAbilitiesLoading || subAbilitiesLoading) &&
              selectedCourseId && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: 24,
                    backgroundColor: "#e8f4fd",
                    border: "1px solid #bbdefb",
                    borderRadius: 12,
                    marginBottom: 16,
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
                style={{
                  borderRadius: 12,
                  backgroundColor: "#e3f2fd",
                  border: "1px solid #bbdefb",
                  marginBottom: 16,
                }}
              />
            )}
          </div>

          <div
            style={{
              flexGrow: 1,
              padding: 24,
              paddingTop: 0,
              position: "relative",
            }}
          >
            {selectedCourseId && graphData && (
              <div
                ref={chartRef}
                style={{
                  width: "100%",
                  height: "calc(100vh - 350px)",
                  minHeight: 400,
                  backgroundColor: "white",
                  borderRadius: 12,
                  border: "1px solid #e0e0e0",
                  overflow: "hidden",
                }}
              />
            )}
          </div>
        </>
      ),
    },
    {
      key: "management",
      label: "能力管理",
      children: (
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Input
              placeholder="搜索能力名称..."
              value={managementSearchTerm}
              onChange={(e) => setManagementSearchTerm(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#999" }} />}
              suffix={
                managementSearchTerm ? (
                  <CloseOutlined
                    style={{ color: "#999", cursor: "pointer" }}
                    onClick={() => setManagementSearchTerm("")}
                  />
                ) : null
              }
              style={{ minWidth: 250 }}
              allowClear
            />
            {selectedCourseId && canEdit && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddMain}
              >
                添加主能力
              </Button>
            )}
          </div>

          <Card
            style={{ height: "calc(100vh - 320px)" }}
            styles={{
              body: {
                height: "100%",
                display: "flex",
                flexDirection: "column",
              },
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
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <Spin size="large" />
              </div>
            ) : (
              <Table
                columns={columns}
                dataSource={flattenedData}
                rowKey="key"
                pagination={false}
                expandable={{
                  defaultExpandAllRows: true,
                  rowExpandable: (record) =>
                    record.type === "main" && !!record.children?.length,
                  indentSize: 28,
                }}
                scroll={{ x: 1000 }}
              />
            )}
          </Card>
        </div>
      ),
    },
    {
      key: "relations",
      label: "能力关系管理",
      children: (
        <div style={{ padding: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Input
              placeholder="搜索源/目标能力或描述..."
              value={relationSearchTerm}
              onChange={(e) => setRelationSearchTerm(e.target.value)}
              prefix={<SearchOutlined style={{ color: "#999" }} />}
              suffix={
                relationSearchTerm ? (
                  <CloseOutlined
                    style={{ color: "#999", cursor: "pointer" }}
                    onClick={() => setRelationSearchTerm("")}
                  />
                ) : null
              }
              style={{ minWidth: 280 }}
              allowClear
            />
            <Space>
              {selectedCourseId && canEdit && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleOpenAddRelation}
                  disabled={(mainAbilitiesData?.length || 0) === 0}
                >
                  新增能力关联
                </Button>
              )}
            </Space>
          </div>

          <Card
            style={{ height: "calc(100vh - 320px)" }}
            styles={{
              body: {
                height: "100%",
                display: "flex",
                flexDirection: "column",
              },
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
            ) : abilityRelationsLoading ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: 24,
                }}
              >
                <Spin size="large" />
              </div>
            ) : (
              <Table
                columns={[
                  {
                    title: "源能力",
                    dataIndex: "sourceName",
                    key: "sourceName",
                    width: 200,
                    render: (name: string, record: any) =>
                      renderAbilityName(name, record.sourceType),
                  },
                  {
                    title: "关联",
                    key: "edge",
                    width: 80,
                    align: "center",
                    render: () => (
                      <Tag
                        color="magenta"
                        style={{
                          backgroundColor: "rgba(235,47,150,0.08)",
                          color: RELATION_EDGE_COLOR,
                          border: `1px solid ${RELATION_EDGE_COLOR}`,
                        }}
                      >
                        关联
                      </Tag>
                    ),
                  },
                  {
                    title: "目标能力",
                    dataIndex: "targetName",
                    key: "targetName",
                    width: 200,
                    render: (name: string, record: any) =>
                      renderAbilityName(name, record.targetType),
                  },
                  {
                    title: "描述",
                    dataIndex: "description",
                    key: "description",
                    ellipsis: true,
                    render: (description: string) =>
                      description ? (
                        <Tooltip title={description} mouseEnterDelay={0.3}>
                          <Text type="secondary">{description}</Text>
                        </Tooltip>
                      ) : (
                        <Text type="secondary">-</Text>
                      ),
                  },
                  {
                    title: "操作",
                    key: "action",
                    width: 120,
                    render: (_: any, record: { raw: AbilityRelation }) => {
                      const items = [
                        {
                          key: "edit",
                          label: "编辑描述",
                          icon: <EditOutlined />,
                          onClick: () => handleOpenEditRelation(record.raw),
                        },
                        {
                          key: "delete",
                          label: (
                            <Popconfirm
                              title="确定删除该关联?"
                              description="此操作不可恢复"
                              onConfirm={() => handleDeleteRelation(record.raw)}
                              okText="确定"
                              cancelText="取消"
                            >
                              <span>删除</span>
                            </Popconfirm>
                          ),
                          icon: <DeleteOutlined />,
                          danger: true,
                        },
                      ];
                      return canEdit ? <ActionDropdown items={items} /> : null;
                    },
                  },
                ]}
                dataSource={filteredRelationRows}
                rowKey="key"
                pagination={false}
                locale={{
                  emptyText:
                    relationRows.length === 0 ? (
                      <Empty description="暂无能力关联，点击右上角'新增能力关联'开始" />
                    ) : (
                      <Empty description="没有匹配的关联" />
                    ),
                }}
                scroll={{ x: 900 }}
              />
            )}
          </Card>
        </div>
      ),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e0e0e0",
            backgroundColor: "white",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <Title
              level={4}
              style={{ margin: 0, fontWeight: 700, color: "#333" }}
            >
              能力图谱
            </Title>
            <Tag
              style={{
                backgroundColor: "#e3f2fd",
                color: "#1976d2",
                border: "none",
              }}
            >
              能力节点构建
            </Tag>
            <Tag
              style={{
                backgroundColor: "#e8f5e9",
                color: "#2e7d32",
                border: "none",
              }}
            >
              能力关系配置
            </Tag>
            <Tag
              style={{
                backgroundColor: "#fff3e0",
                color: "#f57c00",
                border: "none",
              }}
            >
              能力图谱展示
            </Tag>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {activeTab === "graph" && (
              <Button
                type="text"
                icon={<FilterOutlined />}
                onClick={() => setShowPanel(!showPanel)}
              />
            )}
          </div>
        </div>

        {/* 课程选择独立一行 */}
        <div style={{ padding: "12px 24px", backgroundColor: "white", borderBottom: "1px solid #e0e0e0" }}>
          <Space>
            <Text strong>课程选择：</Text>
            <Select
              value={selectedCourseId || undefined}
              placeholder="请选择课程"
              style={{ minWidth: 280 }}
              onChange={(value) => setSelectedCourseId(value || "")}
              allowClear
              loading={coursesLoading}
              options={
                Array.isArray(coursesData) && coursesData.length > 0
                  ? coursesData.map((course: Course) => ({
                      label: course.title,
                      value: course.id,
                    }))
                  : [{ label: "暂无课程", value: "" }]
              }
            />
          </Space>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{
            paddingLeft: 24,
            paddingRight: 24,
            backgroundColor: "white",
          }}
        />
      </div>

      <Drawer
        title={selectedAbilityNode ? `${selectedAbilityNode.name} - 关联资源` : currentKnowledgeResource ? `${currentKnowledgeResource.name} - 资源面板` : "知识点详情"}
        placement="right"
        width={600}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedKnowledgePoint(null);
          setSelectedAbilityNode(null);
          setCurrentKnowledgeResource(null);
        }}
        open={drawerOpen}
      >
        {selectedAbilityNode && !currentKnowledgeResource && (
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
                message="该能力尚未关联知识点，请先在能力管理中添加关联"
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
                      ?.flatMap((sub: SubAbility) =>
                        (sub.knowledgeResources || []).filter((kr) =>
                          selectedAbilityNode.knowledgeResourceIds.includes(kr.id),
                        ),
                      )
                      .filter((kr, index, arr) => arr.findIndex((k) => k.id === kr.id) === index) ||
                    []
                  }
                  renderItem={(item: KnowledgeResource) => (
                    <List.Item
                      style={{ cursor: "pointer" }}
                      onClick={() => setCurrentKnowledgeResource(item)}
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
            value={managementSearchTerm}
            onChange={(e) => setManagementSearchTerm(e.target.value)}
            prefix={<BookOutlined />}
          />

          <Space>
            <Text>支撑层级：</Text>
            <Select
              value={newLinkSupportLevel}
              onChange={(v) => setNewLinkSupportLevel(v)}
              style={{ width: 160 }}
              options={SUPPORT_LEVEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {newLinkSupportLevel === "primary" && "紫色实线（3px）"}
              {newLinkSupportLevel === "secondary" && "青色实线（2px）"}
              {newLinkSupportLevel === "practice" && "浅绿细线（1.5px）"}
            </Text>
          </Space>

          <div style={{ height: 360, overflow: "auto" }}>
            {availableKnowledgeResources.length > 0 ? (
              <Table
                dataSource={availableKnowledgeResources
                  .filter((kr) =>
                    kr.name
                      .toLowerCase()
                      .includes(managementSearchTerm.toLowerCase()),
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
                    render: (type: string) => knowledgeTypeMap[type] || type,
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
        width={700}
      >
        {viewingSubAbility?.knowledgeResources &&
        viewingSubAbility.knowledgeResources.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                padding: "12px 0",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Text type="secondary">
                共关联{" "}
                <strong>{viewingSubAbility.knowledgeResources.length}</strong>{" "}
                个知识点
              </Text>
              <span style={{ marginLeft: 8 }}>
                <Tag color="purple">主支撑</Tag>
                <Tag color="cyan">次支撑</Tag>
                <Tag color="green">实践</Tag>
              </span>
            </div>

            <div style={{ maxHeight: 500, overflow: "auto" }}>
              {viewingSubAbility.knowledgeResources.map(
                (kr: KnowledgeResource, index: number) => {
                  const joinRecord = viewJoinRecords.find(
                    (r) => r.knowledgeResourceId === kr.id,
                  );
                  const supportLevel = (joinRecord?.supportLevel || "primary") as
                    | "primary"
                    | "secondary"
                    | "practice";
                  const isEditing =
                    editingLinkSupport?.joinId === joinRecord?.id;
                  return (
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
                        style={{
                          flex: 1,
                          cursor: "pointer",
                          position: "relative",
                          zIndex: 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewKnowledge(kr);
                        }}
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
                            类型: {knowledgeTypeMap[kr.knowledgeType] || kr.knowledgeType}
                          </Text>
                        )}
                      </div>

                      <Space size="small" style={{ marginRight: 8 }}>
                        {isEditing && joinRecord ? (
                          <Select
                            size="small"
                            value={editingLinkSupport.supportLevel}
                            onChange={(v) =>
                              handleUpdateLinkSupport(joinRecord.id, v)
                            }
                            style={{ width: 110 }}
                            options={SUPPORT_LEVEL_OPTIONS.map((o) => ({
                              value: o.value,
                              label: o.label,
                            }))}
                            autoFocus
                            onBlur={() => setEditingLinkSupport(null)}
                          />
                        ) : joinRecord ? (
                          <Tooltip title="点击修改支撑层级">
                            <Tag
                              color={
                                supportLevel === "primary"
                                  ? "purple"
                                  : supportLevel === "secondary"
                                    ? "cyan"
                                    : "green"
                              }
                              style={{ cursor: "pointer", userSelect: "none" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!canEdit) return;
                                setEditingLinkSupport({
                                  joinId: joinRecord.id,
                                  supportLevel,
                                });
                              }}
                            >
                              {SUPPORT_LEVEL_OPTIONS.find(
                                (o) => o.value === supportLevel,
                              )?.label || supportLevel}
                            </Tag>
                          </Tooltip>
                        ) : viewJoinLoading ? (
                          <Tag>加载中...</Tag>
                        ) : null}
                      </Space>

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
                  );
                },
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

      {/* 能力关联新增/编辑对话框 */}
      <Modal
        title={
          editingRelation ? "编辑能力关联" : "新增能力关联"
        }
        open={relationDialogOpen}
        onCancel={handleCloseRelationDialog}
        onOk={handleSubmitRelation}
        okText={editingRelation ? "保存" : "创建"}
        cancelText="取消"
        okButtonProps={{
          disabled:
            !relationForm.sourceKey ||
            !relationForm.targetKey ||
            relationForm.sourceKey === relationForm.targetKey,
          loading:
            createRelationMutation.isPending ||
            updateRelationMutation.isPending,
        }}
        width={600}
        destroyOnClose
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
            <Text>
              <span style={{ color: "#ff4d4f" }}>*</span> 源能力
            </Text>
            <Select
              value={relationForm.sourceKey || undefined}
              placeholder="选择源能力（主能力 / 子能力）"
              showSearch
              optionFilterProp="label"
              style={{ width: "100%", marginTop: 8 }}
              onChange={(value) =>
                setRelationForm({ ...relationForm, sourceKey: value })
              }
              disabled={!!editingRelation}
              options={abilityOptions.map((o) => ({
                value: `${o.type}|${o.id}`,
                label:
                  o.type === "main"
                    ? `[主] ${o.name}`
                    : `[子] ${o.name}${o.parentName ? `（${o.parentName}）` : ""}`,
              }))}
            />
            {editingRelation && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                编辑模式下不可修改源/目标能力
              </Text>
            )}
          </div>

          <div style={{ textAlign: "center", color: RELATION_EDGE_COLOR }}>
            <Tag
              style={{
                backgroundColor: "rgba(235,47,150,0.08)",
                color: RELATION_EDGE_COLOR,
                border: `1px dashed ${RELATION_EDGE_COLOR}`,
              }}
            >
              ↓ 关联 ↓
            </Tag>
          </div>

          <div>
            <Text>
              <span style={{ color: "#ff4d4f" }}>*</span> 目标能力
            </Text>
            <Select
              value={relationForm.targetKey || undefined}
              placeholder={
                relationForm.sourceKey
                  ? "选择目标能力（已排除源能力自身）"
                  : "请先选择源能力"
              }
              showSearch
              optionFilterProp="label"
              style={{ width: "100%", marginTop: 8 }}
              onChange={(value) =>
                setRelationForm({ ...relationForm, targetKey: value })
              }
              disabled={!!editingRelation}
              notFoundContent={
                relationForm.sourceKey
                  ? "源能力之外没有更多可选能力"
                  : "暂无可选能力"
              }
              options={abilityOptions
                .filter(
                  (o) => `${o.type}|${o.id}` !== relationForm.sourceKey,
                )
                .map((o) => ({
                  value: `${o.type}|${o.id}`,
                  label:
                    o.type === "main"
                      ? `[主] ${o.name}`
                      : `[子] ${o.name}${o.parentName ? `（${o.parentName}）` : ""}`,
                }))}
            />
          </div>

          <div>
            <Text>关联备注（可选）</Text>
            <TextArea
              placeholder="为此关联添加备注说明"
              value={relationForm.description}
              onChange={(e) =>
                setRelationForm({
                  ...relationForm,
                  description: e.target.value,
                })
              }
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </Modal>

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
              onClick={handleCtxMenuDetail}
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
                    setCurrentKnowledgeResource({ id: nd.id, name: nd.name, knowledgeType: "知识点", description: nd.description });
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
        open={!!currentKnowledgeResource || !!viewingKnowledge}
        onClose={() => {
          setCurrentKnowledgeResource(null);
          setViewingKnowledge(null);
        }}
        knowledge={currentKnowledgeResource || viewingKnowledge}
      />
    </div>
  );
}
