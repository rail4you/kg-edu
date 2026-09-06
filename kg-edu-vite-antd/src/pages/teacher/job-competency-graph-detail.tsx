import * as React from "react";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography, Card, Button, Input, Space, message, Spin, Tag, Empty, Tabs, Table, Drawer, Descriptions,
  Modal, Popconfirm, InputNumber, Select, Radio, Form, Row, Col, Checkbox, Tooltip, Alert,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  ArrowLeftOutlined, EditOutlined, DeleteOutlined, PlusOutlined, ApartmentOutlined,
  BookOutlined, FileSearchOutlined, AimOutlined, ApartmentOutlined as ApartmentIcon,
  SearchOutlined, FolderOutlined, FileTextOutlined, ReloadOutlined,
} from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  getJobCompetencyGraph,
  updateJobCompetencyGraph, deleteJobCompetencyGraph,
  listCoreTasksByGraph, createJobCoreTask, updateJobCoreTask, deleteJobCoreTask,
  listAbilitiesByGraph, createJobTaskAbility, updateJobTaskAbility, deleteJobTaskAbility,
  listLinksByGraph, createAbilityKnowledgeLink, updateAbilityKnowledgeLink, deleteAbilityKnowledgeLink,
  replaceAbilityKnowledgeLinks,
  getKnowledgeResourcesByNameAndImportance, getJobPosition, listCourses,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LEVEL_OPTIONS = [
  { value: "beginner", label: "初级" },
  { value: "intermediate", label: "中级" },
  { value: "advanced", label: "高级" },
];

const SUPPORT_LEVEL_OPTIONS = [
  { value: "primary", label: "主支撑" },
  { value: "secondary", label: "次支撑" },
  { value: "practice", label: "实践" },
];

// 节点层级配色：5 层节点
const NODE_COLORS = {
  job: "#C0392B",
  task: "#E67E22",
  ability: "#F39C12",
  knowledge: "#3498DB",
  course: "#1ABC9C",
};

// 构建纯图标 SVG（Tabler 风格线条，无背景）
function buildIconDataUri(paths: string[], color: string): string {
  const iconPaths = paths.map(d =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${iconPaths}</svg>`;
  return `image://data:image/svg+xml;base64,${btoa(svg)}`;
}

// 构建带卡片背景的岗位图标
function buildJobIconDataUri(): string {
  const paths = ["M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0", "M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"];
  const bg = NODE_COLORS.job;
  const iconPaths = paths.map(d =>
    `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`
  ).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <rect x="1" y="1" width="22" height="22" rx="8" ry="8" fill="${bg}" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    ${iconPaths}
  </svg>`;
  return `image://data:image/svg+xml;base64,${btoa(svg)}`;
}

// 节点图标（从 zip 提取的 Tabler 图标路径）
const NODE_ICONS = {
  job: buildJobIconDataUri(),
  task: buildIconDataUri(
    ["M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2", "M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2", "M9 12l.01 0", "M13 12l2 0", "M9 16l.01 0", "M13 16l2 0"],
    NODE_COLORS.task,
  ),
  ability: buildIconDataUri(
    ["M12 7a5 5 0 1 0 5 5", "M13 3.055a9 9 0 1 0 7.941 7.945", "M15 6v3h3l3 -3h-3v-3l-3 3", "M15 9l-3 3"],
    NODE_COLORS.ability,
  ),
  knowledge: buildIconDataUri(
    ["M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12", "M19 16h-12a2 2 0 0 0 -2 2", "M9 8h6"],
    NODE_COLORS.knowledge,
  ),
  course: buildIconDataUri(
    ["M7 4v16l13 -8l-13 -8"],
    NODE_COLORS.course,
  ),
};

// Node 尺寸 — 岗位大一些突出，其他统一
const JOB_SYMBOL_SIZE = 54;
const NODE_SYMBOL_SIZE = 40;

// legend 与 categories 对应：每个 category 配置一个图标（圆点 + 颜色）
const CATEGORIES = [
  { name: "岗位", itemStyle: { color: NODE_COLORS.job } },
  { name: "核心任务", itemStyle: { color: NODE_COLORS.task } },
  { name: "能力点", itemStyle: { color: NODE_COLORS.ability } },
  { name: "知识点", itemStyle: { color: NODE_COLORS.knowledge } },
  { name: "课程", itemStyle: { color: NODE_COLORS.course } },
];

interface CoreTask {
  id: string;
  title: string;
  description?: string | null;
}
interface Ability {
  id: string;
  name: string;
  description?: string | null;
  level?: string | null;
  coreTaskId: string;
}
interface Link {
  id: string;
  abilityId: string;
  knowledgeResourceId: string;
  supportLevel: string;
  weight: number;
  description?: string | null;
  knowledgeResource?: {
    id: string;
    name: string;
    description?: string | null;
    courseId: string;
    course?: { id: string; title: string } | null;
  } | null;
}

export default function TeacherJobCompetencyGraphDetail() {
  const { graphId } = useParams<{ graphId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  const [activeTab, setActiveTab] = useState("visualization");
  const [editGraphOpen, setEditGraphOpen] = useState(false);
  const [editingGraph, setEditingGraph] = useState({ name: "", description: "", isActive: true, version: 1 });

  // 任务
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CoreTask | null>(null);
  const [taskForm, setTaskForm] = useState({ title: "", description: "" });

  // 能力
  const [abilityDrawerOpen, setAbilityDrawerOpen] = useState(false);
  const [editingAbility, setEditingAbility] = useState<Ability | null>(null);
  const [abilityFilterTask, setAbilityFilterTask] = useState<string | undefined>();
  const [abilityForm, setAbilityForm] = useState<{ name: string; description: string; level?: "beginner" | "intermediate" | "advanced"; coreTaskId?: string }>({ name: "", description: "", level: undefined, coreTaskId: undefined });

  // 知识关联
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [linkForm, setLinkForm] = useState<{ abilityId?: string; knowledgeResourceId?: string; supportLevel: "primary" | "secondary" | "practice"; description: string; courseId?: string }>({ supportLevel: "primary", description: "" });
  const [linkSearch, setLinkSearch] = useState("");
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [linkCourseFilter, setLinkCourseFilter] = useState<string | undefined>();
  const [linkCourseList, setLinkCourseList] = useState<any[]>([]);
  // 知识选择弹窗多选
  const [knowledgeModalOpen, setKnowledgeModalOpen] = useState(false);
  const [knowledgeCourseFilter, setKnowledgeCourseFilter] = useState<string | undefined>();
  const [knowledgeList, setKnowledgeList] = useState<any[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  // 知识点配置弹窗：关联的 ability
  const [configAbilityId, setConfigAbilityId] = useState<string | null>(null);
  const [configAbilityName, setConfigAbilityName] = useState("");

  // AI 生成
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTaskCount, setAiTaskCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPreview, setAiPreview] = useState<{ tasks: any[] } | null>(null);

  // 图谱搜索
  const [graphSearchText, setGraphSearchText] = useState("");
  const [graphSearchTask, setGraphSearchTask] = useState<string | undefined>();

  // 可视化节点详情
  const [vizDrawerOpen, setVizDrawerOpen] = useState(false);
  const [vizNode, setVizNode] = useState<any>(null);
  const [vizKnowledgeId, setVizKnowledgeId] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // ===== 数据加载 =====
  const { data: graphRes, isLoading: graphLoading } = useQuery({
    queryKey: ["job-graph", graphId, tenant],
    queryFn: async () => {
      const r = await getJobCompetencyGraph({ tenant, input: { id: graphId! }, fields: ["id", "name", "description", "isActive", "version", "jobPositionId"], headers });
      return r;
    },
    enabled: !!graphId && !!tenant,
  });
  const graph = (graphRes as any)?.success ? (graphRes as any).data : null;

  const { data: jobRes } = useQuery({
    queryKey: ["job-for-graph", graph?.jobPositionId, tenant],
    queryFn: async () => {
      if (!graph?.jobPositionId) return null;
      const r = await getJobPosition({ tenant, input: { id: graph.jobPositionId }, fields: ["id", "title", "description"], headers });
      return (r as any)?.success ? (r as any).data : null;
    },
    enabled: !!graph?.jobPositionId && !!tenant,
  });
  const job = jobRes || null;

  const { data: tasksRes } = useQuery({
    queryKey: ["graph-tasks", graphId, tenant],
    queryFn: async () => {
      const r = await listCoreTasksByGraph({ tenant, input: { graphId: graphId! }, fields: ["id", "title", "description"], headers });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const tasks: CoreTask[] = useMemo(() => (Array.isArray(tasksRes) ? tasksRes : []), [tasksRes]);

  const { data: abilitiesRes } = useQuery({
    queryKey: ["graph-abilities", graphId, tenant],
    queryFn: async () => {
      const r = await listAbilitiesByGraph({ tenant, input: { graphId: graphId! }, fields: ["id", "name", "description", "level", "coreTaskId"], headers });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const abilities: Ability[] = useMemo(() => (Array.isArray(abilitiesRes) ? abilitiesRes : []), [abilitiesRes]);

  const { data: linksRes } = useQuery({
    queryKey: ["graph-links", graphId, tenant],
    queryFn: async () => {
      const r = await listLinksByGraph({ tenant, input: { graphId: graphId! }, fields: ["id", "abilityId", "knowledgeResourceId", "supportLevel", "weight", "description", { knowledgeResource: ["id", "name", "description", "courseId", { course: ["id", "title"] }] }], headers });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const links: Link[] = useMemo(() => (Array.isArray(linksRes) ? linksRes : []), [linksRes]);

  // ===== Mutations =====
  const updateGraphMutation = useMutation({
    mutationFn: async () => await updateJobCompetencyGraph({ tenant, primaryKey: graphId!, input: editingGraph, fields: ["id"], headers }),
    onSuccess: () => { message.success("已更新"); queryClient.invalidateQueries({ queryKey: ["job-graph", graphId] }); setEditGraphOpen(false); },
    onError: (e: any) => { message.error(e?.message || "更新失败"); },
  });

  const deleteGraphMutation = useMutation({
    mutationFn: async () => {
      const r = await deleteJobCompetencyGraph({ tenant, primaryKey: graphId!, headers });
      if (!r.success) throw new Error((r as any).errors?.[0]?.message || "删除失败");
      return r;
    },
    onSuccess: () => { message.success("已删除"); navigate("/teacher/dashboard/job-competency-graphs"); },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const saveTaskMutation = useMutation({
    mutationFn: async () => {
      if (editingTask) return await updateJobCoreTask({ tenant, primaryKey: editingTask.id, input: taskForm, fields: ["id"], headers });
      return await createJobCoreTask({ tenant, input: { ...taskForm, graphId, jobPositionId: graph.jobPositionId }, fields: ["id"], headers });
    },
    onSuccess: () => { message.success(editingTask ? "已更新" : "已添加"); queryClient.invalidateQueries({ queryKey: ["graph-tasks"] }); setTaskDrawerOpen(false); setEditingTask(null); },
    onError: (e: any) => { message.error(e?.message || "保存失败"); },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteJobCoreTask({ tenant, primaryKey: id, headers });
      if (!r.success) throw new Error((r as any).errors?.[0]?.message || "删除失败");
      return r;
    },
    onSuccess: () => {
      message.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["graph-tasks"] });
      // 级联删除也会删除能力点和关联，所以一并刷新
      queryClient.invalidateQueries({ queryKey: ["graph-abilities"] });
      queryClient.invalidateQueries({ queryKey: ["graph-links"] });
    },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const saveAbilityMutation = useMutation({
    mutationFn: async () => {
      if (!abilityForm.coreTaskId && !editingAbility) throw new Error("请选择所属任务");
      if (editingAbility) return await updateJobTaskAbility({ tenant, primaryKey: editingAbility.id, input: { name: abilityForm.name, description: abilityForm.description, level: abilityForm.level }, fields: ["id"], headers });
      return await createJobTaskAbility({ tenant, input: { name: abilityForm.name, description: abilityForm.description, level: abilityForm.level, coreTaskId: abilityForm.coreTaskId!, graphId }, fields: ["id"], headers });
    },
    onSuccess: () => { message.success(editingAbility ? "已更新" : "已添加"); queryClient.invalidateQueries({ queryKey: ["graph-abilities"] }); setAbilityDrawerOpen(false); setEditingAbility(null); },
    onError: (e: any) => { message.error(e?.message || "保存失败"); },
  });
  const deleteAbilityMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteJobTaskAbility({ tenant, primaryKey: id, headers });
      if (!r.success) throw new Error((r as any).errors?.[0]?.message || "删除失败");
      return r;
    },
    onSuccess: () => {
      message.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["graph-abilities"] });
      // 级联删除也会删除知识点关联
      queryClient.invalidateQueries({ queryKey: ["graph-links"] });
    },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  const saveLinkMutation = useMutation({
    mutationFn: async () => {
      if (!linkForm.abilityId || !linkForm.knowledgeResourceId) throw new Error("请选择能力点和知识点");
      if (editingLink) {
        return await updateAbilityKnowledgeLink({ tenant, primaryKey: editingLink.id, input: { supportLevel: linkForm.supportLevel, description: linkForm.description }, fields: ["id"], headers });
      }
      return await createAbilityKnowledgeLink({ tenant, input: { abilityId: linkForm.abilityId, knowledgeResourceId: linkForm.knowledgeResourceId, graphId, supportLevel: linkForm.supportLevel, description: linkForm.description }, fields: ["id"], headers });
    },
    onSuccess: () => { message.success(editingLink ? "已更新" : "已添加"); queryClient.invalidateQueries({ queryKey: ["graph-links"] }); setLinkDrawerOpen(false); setEditingLink(null); setSelectedKnowledgeIds([]); },
    onError: (e: any) => { message.error(e?.message || "保存失败"); },
  });
  const deleteLinkMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await deleteAbilityKnowledgeLink({ tenant, primaryKey: id, headers });
      if (!r.success) throw new Error((r as any).errors?.[0]?.message || "删除失败");
      return r;
    },
    onSuccess: () => { message.success("已删除"); queryClient.invalidateQueries({ queryKey: ["graph-links"] }); },
    onError: (e: Error) => { message.error(e.message || "删除失败"); },
  });

  // 批量替换某 ability 的所有知识关联
  const replaceLinksMutation = useMutation({
    mutationFn: async ({ abilityId, linkIds }: { abilityId: string; linkIds: string[] }) => {
      // linkIds 现在是 knowledgeResourceId 列表
      const newLinks = linkIds.map(krId => ({
        knowledge_resource_id: krId,
        support_level: "primary",
      }));
      const r = await replaceAbilityKnowledgeLinks({ tenant, input: { abilityId, graphId, links: newLinks }, headers });
      if (!r.success) throw new Error((r as any).errors?.[0]?.message || "替换失败");
      return r;
    },
    onSuccess: () => { message.success("知识点关联已更新"); queryClient.invalidateQueries({ queryKey: ["graph-links"] }); },
    onError: (e: Error) => { message.error(e.message || "替换失败"); },
  });

  // 远程搜索知识点 — 用 ref 持有最新 headers，避免 useCallback 引用变化导致 useEffect 无限触发
  const headersRef = useRef(headers);
  useEffect(() => { headersRef.current = headers; }, [headers]);

  // 加载课程列表（用于下拉筛选）
  const { data: coursesRes } = useQuery({
    queryKey: ["all-courses", tenant],
    queryFn: async () => {
      const r = await listCourses({ tenant, fields: ["id", "title"], headers });
      const data = (r as any)?.data;
      return r?.success ? (Array.isArray(data) ? data : (data?.results || [])) : [];
    },
    enabled: !!tenant,
  });
  useEffect(() => {
    if (coursesRes) setLinkCourseList(coursesRes);
  }, [coursesRes]);

  const searchKnowledge = useCallback(async (kw: string) => {
    if (!tenant) return;
    const r = await getKnowledgeResourcesByNameAndImportance({
      tenant,
      input: { name: kw || undefined, courseId: linkCourseFilter },
      fields: ["id", "name", "description", "courseId", { course: ["id", "title"] }],
      headers: headersRef.current,
    });
    if ((r as any)?.success) {
      const data = (r as any).data;
      setLinkSearchResults(Array.isArray(data) ? data : (data?.results || []));
    } else {
      setLinkSearchResults([]);
    }
  }, [tenant, linkCourseFilter]);

  useEffect(() => {
    const t = setTimeout(() => { searchKnowledge(linkSearch); }, 300);
    return () => clearTimeout(t);
  }, [linkSearch, linkCourseFilter, searchKnowledge]);

  // 加载知识点层次数据（用于弹窗中的树形选择）
  const { data: knowledgeHierarchy = [] } = useQuery({
    queryKey: ["knowledge-hierarchy", knowledgeCourseFilter, tenant],
    queryFn: async () => {
      if (!knowledgeCourseFilter || !tenant) return [];
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${knowledgeCourseFilter}&tenant=${tenant}`,
        { headers: { ...headersRef.current } },
      );
      if (!response.ok) throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
      const result = await response.json();
      if (result && typeof result === "object" && Array.isArray(result.data)) return result.data;
      if (Array.isArray(result)) return result;
      return [];
    },
    enabled: !!knowledgeCourseFilter && !!tenant && knowledgeModalOpen,
  });

  // 将层次结构展开为扁平列表（带层级缩进）
  const knowledgeTreeData = useMemo(() => {
    const flattenTree = (nodes: any[], level: number = 0): any[] => {
      const result: any[] = [];
      for (const n of nodes) {
        result.push({ ...n, _level: level, _isLeaf: !n.childUnits?.length && !n.childCells?.length && !n.nestedChildCells?.length });
        if (n.childUnits) result.push(...flattenTree(n.childUnits, level + 1));
        if (n.childCells) result.push(...flattenTree(n.childCells, level + 1));
        if (n.nestedChildCells) result.push(...flattenTree(n.nestedChildCells, level + 1));
        if (n.directCells) result.push(...flattenTree(n.directCells, level + 1));
        if (n.subjectCells) result.push(...flattenTree(n.subjectCells, level + 1));
      }
      return result;
    };
    return flattenTree(knowledgeHierarchy);
  }, [knowledgeHierarchy]);

  // 展开树形表的全部行
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  useEffect(() => {
    if (knowledgeTreeData.length > 0 && expandedRowIds.length === 0) {
      setExpandedRowIds(knowledgeTreeData.map(r => r.id));
    }
  }, [knowledgeTreeData]);

  // ===== ECharts 可视化数据 =====
  const vizData = useMemo(() => {
    if (!job) return null;

    // 搜索过滤
    const searchLower = graphSearchText.toLowerCase().trim();
    const filteredTaskIds = graphSearchTask ? new Set([graphSearchTask]) : null;
    const matchedNodeIds = new Set<string>();

    // 如果没有搜索条件，显示全部
    const hasSearch = searchLower !== "" || filteredTaskIds !== null;

    const nodes: any[] = [];
    const linksArr: any[] = [];

    // 使用 Tabler Icons 风格的 SVG 数据 URI（从设计文件提取）
    // 使用纯 SVG 图标路径
    const iconSvgs = NODE_ICONS;

    nodes.push({
      id: `job:${job.id}`,
      name: job.title,
      category: 0,
      symbol: NODE_ICONS.job,
      symbolSize: JOB_SYMBOL_SIZE,
      itemStyle: {
        color: NODE_COLORS.job,
        borderColor: "transparent",
        borderWidth: 0,
        shadowBlur: 0,
      },
      label: {
        show: true,
        fontSize: 14,
        fontWeight: "bold",
        color: "#333",
        position: "bottom",
        distance: 8,
        formatter: (p: any) => `${p.name}`,
      },
      rawType: "job",
      rawData: job,
    });

    for (const t of tasks) {
      nodes.push({
        id: `task:${t.id}`,
        name: t.title,
        category: 1,
        symbol: NODE_ICONS.task,
        symbolSize: NODE_SYMBOL_SIZE,
        itemStyle: {
          color: NODE_COLORS.task,
          borderColor: "#fff",
          borderWidth: 3.5,
          shadowBlur: 10,
          shadowColor: "rgba(230,126,34,0.4)",
        },
        label: {
          show: true,
          fontSize: 13,
          fontWeight: "bold",
          color: "#333",
          position: "bottom",
          distance: 6,
          formatter: (p: any) => `${p.name}`,
        },
        rawType: "task",
        rawData: t,
      });
      linksArr.push({ source: `job:${job.id}`, target: `task:${t.id}`, lineStyle: { opacity: 0.7, width: 2.5, color: NODE_COLORS.job } });
    }
    for (const a of abilities) {
      nodes.push({
        id: `ability:${a.id}`,
        name: a.name,
        category: 2,
        symbol: NODE_ICONS.ability,
        symbolSize: NODE_SYMBOL_SIZE,
        itemStyle: {
          color: NODE_COLORS.ability,
          borderColor: "#fff",
          borderWidth: 3,
          shadowBlur: 8,
          shadowColor: "rgba(241,196,15,0.35)",
        },
        label: {
          show: true,
          fontSize: 12,
          color: "#555",
          position: "bottom",
          distance: 4,
          rich: {
            name: { fontSize: 12, color: "#555", padding: [0, 4, 0, 0] },
            badge: { fontSize: 10, color: "#fff", backgroundColor: NODE_COLORS.ability, padding: [1, 6], borderRadius: 4, fontWeight: "bold" },
          },
          formatter: (p: any) => {
            const lvl = LEVEL_OPTIONS.find(o => o.value === p.data?.rawData?.level);
            if (lvl) return `{name|${p.name}}{badge|${lvl.label}}`;
            return p.name;
          },
        },
        rawType: "ability",
        rawData: a,
      });
      linksArr.push({ source: `task:${a.coreTaskId}`, target: `ability:${a.id}`, lineStyle: { opacity: 0.55, width: 2, color: NODE_COLORS.task } });
    }
    const seenK = new Set<string>();
    const seenC = new Set<string>();
    for (const l of links) {
      if (l.knowledgeResource && !seenK.has(l.knowledgeResource.id)) {
        seenK.add(l.knowledgeResource.id);
        nodes.push({
          id: `knowledge:${l.knowledgeResource.id}`,
          name: l.knowledgeResource.name,
          category: 3,
          symbol: NODE_ICONS.knowledge,
          symbolSize: NODE_SYMBOL_SIZE,
          itemStyle: {
            color: NODE_COLORS.knowledge,
            borderColor: "#fff",
            borderWidth: 2.5,
            shadowBlur: 6,
            shadowColor: "rgba(52,152,219,0.3)",
          },
          label: {
            show: true,
            fontSize: 11,
            color: "#555",
            position: "bottom",
            distance: 3,
            formatter: (p: any) => `${p.name}`,
          },
          rawType: "knowledge",
          rawData: l.knowledgeResource,
        });
      }
      if (l.knowledgeResource?.course && !seenC.has(l.knowledgeResource.course.id)) {
        seenC.add(l.knowledgeResource.course.id);
        nodes.push({
          id: `course:${l.knowledgeResource.course.id}`,
          name: l.knowledgeResource.course.title,
          category: 4,
          symbol: NODE_ICONS.course,
          symbolSize: NODE_SYMBOL_SIZE,
          itemStyle: {
            color: NODE_COLORS.course,
            borderColor: "#fff",
            borderWidth: 2,
            shadowBlur: 4,
            shadowColor: "rgba(133,193,233,0.25)",
          },
          label: {
            show: true,
            fontSize: 10,
            color: "#555",
            position: "bottom",
            distance: 2,
            formatter: (p: any) => `${p.name}`,
          },
          rawType: "course",
          rawData: l.knowledgeResource.course,
        });
      }
      const supportConfig: Record<string, { width: number; color: string; type?: string }> = {
        primary: { width: 3, color: "#722ed1" },
        secondary: { width: 2, color: "#13c2c2" },
        practice: { width: 1.5, color: NODE_COLORS.ability },
      };
      const slCfg = supportConfig[l.supportLevel] || supportConfig.practice;
      linksArr.push({ source: `ability:${l.abilityId}`, target: `knowledge:${l.knowledgeResourceId}`, lineStyle: { opacity: 0.6, width: slCfg.width, color: slCfg.color } });
      if (l.knowledgeResource?.course) {
        linksArr.push({ source: `knowledge:${l.knowledgeResourceId}`, target: `course:${l.knowledgeResource.course.id}`, lineStyle: { opacity: 0.4, width: 1, type: "dashed", color: NODE_COLORS.knowledge } });
      }
    }

    // 搜索过滤
    if (hasSearch) {
      for (const n of nodes) {
        if (
          (searchLower === "" || n.name.toLowerCase().includes(searchLower)) &&
          (filteredTaskIds === null ||
            n.rawType === "job" ||
            (n.rawType === "task" && filteredTaskIds.has(n.rawData?.id)) ||
            (n.rawType === "ability" && filteredTaskIds.has(tasks.find(t => abilities.find(a => a.id === n.rawData?.id)?.coreTaskId === t.id)?.id)) ||
            (n.rawType === "knowledge" && links.some(l => l.knowledgeResourceId === n.rawData?.id && filteredTaskIds.has(tasks.find(t => abilities.find(a => a.id === l.abilityId)?.coreTaskId === t.id)?.id))) ||
            (n.rawType === "course" && links.some(l => l.knowledgeResource?.courseId === n.rawData?.id && filteredTaskIds.has(tasks.find(t => abilities.find(a => a.id === l.abilityId)?.coreTaskId === t.id)?.id)))
          )
        ) {
          matchedNodeIds.add(n.id);
        }
      }
      const filteredNodes = nodes.filter(n => matchedNodeIds.has(n.id));
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredLinks = linksArr.filter(l => filteredNodeIds.has(l.source as string) && filteredNodeIds.has(l.target as string));
      return { nodes: filteredNodes, links: filteredLinks };
    }

    return { nodes, links: linksArr };
  }, [job, tasks, abilities, links, graphSearchText, graphSearchTask]);

  // 用一个递增 tick 在容器尺寸为 0 时强制重跑 effect
  const [chartTick, setChartTick] = useState(0);

  useEffect(() => {
    if (activeTab !== "visualization" || !vizData || !chartRef.current) return;
    const container = chartRef.current;
    // 强制给容器一个固定最小高度（外层有 width: 100% / min-height: 480px，这里兜底）
    if (!container.style.height) {
      container.style.height = "520px";
    }

    // 如果容器当前 offsetWidth/Height 为 0，说明 Tabs 还没完全展开，下一帧再跑 effect
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      const rafId = requestAnimationFrame(() => setChartTick(t => t + 1));
      return () => cancelAnimationFrame(rafId);
    }

    const oldChart = echarts.getInstanceByDom(container);
    if (oldChart) oldChart.dispose();
    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    chartInstance.current = chart;

    const option: any = {
      backgroundColor: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: "#fafbfc" },
        { offset: 1, color: "#f0f2f5" },
      ]),
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(255,255,255,0.98)",
        borderColor: NODE_COLORS.job,
        borderWidth: 2,
        extraCssText: "border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.12);",
        textStyle: { color: "#333", fontSize: 13 },
        formatter: (params: any) => {
          if (params.dataType === "node") {
            const d = params.data;
            const typeConfig: Record<string, { label: string; icon: string; color: string }> = {
              job: { label: "岗位", icon: "👤", color: NODE_COLORS.job },
              task: { label: "核心任务", icon: "📋", color: NODE_COLORS.task },
              ability: { label: "能力点", icon: "⚡", color: NODE_COLORS.ability },
              knowledge: { label: "知识点", icon: "💡", color: NODE_COLORS.knowledge },
              course: { label: "课程", icon: "📚", color: NODE_COLORS.course },
            };
            const cfg = typeConfig[d.rawType] || { label: "未知", icon: "📌", color: "#999" };
            const desc = d.rawData?.description || "";
            const level =
              d.rawType === "ability" && d.rawData?.level
                ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee"><span style="color:#f39c12;font-weight:bold">等级</span><span style="margin-left:8px">${LEVEL_OPTIONS.find(o => o.value === d.rawData.level)?.label || d.rawData.level}</span></div>`
                : "";
            return `<div style="min-width:180px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <span style="font-size:20px">${cfg.icon}</span>
                <span style="background:${cfg.color};color:#fff;font-size:11px;padding:2px 10px;border-radius:10px;font-weight:bold">${cfg.label}</span>
              </div>
              <div style="font-size:15px;font-weight:bold;color:#222;margin-bottom:4px">${d.name}</div>
              ${level}
              ${desc ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee;color:#666;font-size:12px;line-height:1.5">${desc.slice(0, 120)}${desc.length > 120 ? "..." : ""}</div>` : ""}
            </div>`;
          }
          return "";
        },
      },
      toolbox: {
        show: true, orient: "vertical", right: 16, top: "center",
        feature: {
          dataZoom: { show: true, title: { zoom: "区域缩放", back: "还原" } },
          restore: { show: true, title: "还原" },
          saveAsImage: { show: true, title: "保存图片" },
        },
      },
      legend: {
        data: CATEGORIES.map(c => c.name),
        orient: "vertical",
        left: 16,
        top: 16,
        backgroundColor: "rgba(255,255,255,0.9)",
        borderColor: "#e8e8e8",
        borderWidth: 1,
        borderRadius: 8,
        padding: [12, 16],
        textStyle: { fontSize: 13, color: "#555" },
        icon: "circle",
        itemWidth: 12,
        itemHeight: 12,
        itemGap: 10,
      },
      animation: true, animationDuration: 1200, animationEasingUpdate: "quinticInOut",
      series: [{
        name: "岗位能力图谱",
        type: "graph",
        layout: "force",
        categories: CATEGORIES,
        data: vizData.nodes,
        links: vizData.links,
        roam: true,
        // 给节点一个初始圆形布局，防止 force 在节点很少时把它们收敛到中心 (0,0)
        // 用户拖拽后 force 会接管
        initialLayout: "circular",
        force: {
          repulsion: 500,
          gravity: 0.08,
          edgeLength: [80, 160],
          friction: 0.15,
          layoutAnimation: true,
        },
        draggable: true,
        label: { show: true, position: "right", formatter: "{b}" },
        labelLayout: { hideOverlap: true },
        emphasis: { focus: "adjacency", label: { show: true, fontSize: 14, fontWeight: "bold" }, lineStyle: { width: 3, opacity: 0.9 } },
        blur: { lineStyle: { opacity: 0.15 } },
        lineStyle: { curveness: 0.15, opacity: 0.5 },
        edgeSymbol: ["none", "arrow"],
        edgeSymbolSize: [0, 6],
      }],
    };

    chart.setOption(option);



    chart.on("click", (params: any) => {
      if (params.dataType === "node") {
        setVizNode(params.data);
        if (params.data.rawType === "knowledge") {
          setVizKnowledgeId(params.data.rawData?.id || null);
        } else {
          setVizKnowledgeId(null);
        }
        setVizDrawerOpen(true);
      }
    });

    // Application search filter via dispatch action
    (chart as any).__searchText = "";
    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    // 监听容器自身尺寸变化（Tabs 切换 / 抽屉展开等情况）
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => chart.resize());
      resizeObserver.observe(container);
    }
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      chart.dispose();
      chartInstance.current = null;
    };
  }, [activeTab, vizData, chartTick]);

  // ===== 任务表格列 =====
  const taskColumns: TableColumnsType<CoreTask> = [
    { title: "任务名称", dataIndex: "title", key: "title", ellipsis: true },
    { title: "描述", dataIndex: "description", key: "description", ellipsis: true, render: (v: string) => v || "-" },
    {
      title: "操作", key: "actions", width: 160, render: (_: unknown, r: CoreTask) => (
        <Space>
          <ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => { setEditingTask(r); setTaskForm({ title: r.title, description: r.description || "" }); setTaskDrawerOpen(true); }} />
          <Popconfirm title="确定删除？将级联删除该任务下的能力点。" onConfirm={() => deleteTaskMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ===== 能力表格列 =====
  const filteredAbilities = useMemo(() => abilityFilterTask ? abilities.filter(a => a.coreTaskId === abilityFilterTask) : abilities, [abilities, abilityFilterTask]);
  const abilityColumns: TableColumnsType<Ability> = [
    { title: "能力名称", dataIndex: "name", key: "name", ellipsis: true },
    { title: "所属任务", dataIndex: "coreTaskId", key: "coreTaskId", render: (v: string) => tasks.find(t => t.id === v)?.title || "-" },
    { title: "等级", dataIndex: "level", key: "level", render: (v: string) => LEVEL_OPTIONS.find(o => o.value === v)?.label || "-" },
    {
      title: "操作", key: "actions", width: 260, render: (_: unknown, r: Ability) => (
        <Space>
          <ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => { setEditingAbility(r); setAbilityForm({ name: r.name, description: r.description || "", level: (r.level || undefined) as any, coreTaskId: r.coreTaskId }); setAbilityDrawerOpen(true); }} />
          <Popconfirm title="确定删除？将级联删除其知识点关联。" onConfirm={() => deleteAbilityMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          <ReadonlyActionButton size="small" icon={<BookOutlined />} onClick={() => {
            setConfigAbilityId(r.id);
            setConfigAbilityName(r.name);
            // 预勾选已关联的知识点
            const existingIds = links.filter(l => l.abilityId === r.id).map(l => l.knowledgeResourceId);
            setSelectedKnowledgeIds(existingIds);
            setKnowledgeModalOpen(true);
            setKnowledgeCourseFilter(undefined);
          }}>配置知识点</ReadonlyActionButton>
        </Space>
      ),
    },
  ];

  // ===== 知识关联表格列 =====
  const linkColumns: TableColumnsType<Link> = [
    { title: "能力点", dataIndex: "abilityId", key: "abilityId", render: (v: string) => abilities.find(a => a.id === v)?.name || "-" },
    { title: "知识点", dataIndex: "knowledgeResourceId", key: "knowledgeResourceId", render: (v: string, r: Link) => {
      const name = r.knowledgeResource?.name || v;
      return <Tooltip title={name} mouseEnterDelay={0.3}><Text style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Text></Tooltip>;
    } },
    { title: "对应课程", key: "course", render: (_: unknown, r: Link) => r.knowledgeResource?.course?.title || "-" },
    { title: "支撑层级", dataIndex: "supportLevel", key: "supportLevel", render: (v: string) => <Tag>{SUPPORT_LEVEL_OPTIONS.find(o => o.value === v)?.label || v}</Tag> },
    {
      title: "操作", key: "actions", width: 140, render: (_: unknown, r: Link) => (
        <Space>
          <ReadonlyActionButton size="small" icon={<EditOutlined />} onClick={() => {
            setEditingLink(r);
            setLinkForm({ abilityId: r.abilityId, knowledgeResourceId: r.knowledgeResourceId, supportLevel: r.supportLevel as any, description: r.description || "", courseId: r.knowledgeResource?.courseId });
            setLinkDrawerOpen(true);
          }} />
          <Popconfirm title="确定删除？" onConfirm={() => deleteLinkMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (graphLoading) return <div style={{ padding: 80, textAlign: "center" }}><Spin size="large" /></div>;
  if (!graph) return <div style={{ padding: 80, textAlign: "center" }}><Empty description="图谱不存在或加载失败" /></div>;

  const statsInline = (
    <Space size="large" style={{ marginBottom: 12 }}>
      <span><Text type="secondary">岗位</Text> <Text strong>{job?.title || "-"}</Text></span>
      <span><Text type="secondary">任务</Text> <Text strong>{tasks.length}</Text></span>
      <span><Text type="secondary">能力点</Text> <Text strong>{abilities.length}</Text></span>
      <span><Text type="secondary">知识点关联</Text> <Text strong>{links.length}</Text></span>
    </Space>
  );

  return (
    <div style={{ padding: "20px 24px" }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/teacher/dashboard/job-competency-graphs")} style={{ padding: "4px 0", marginBottom: 12 }}>返回图谱列表</Button>

      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space>
              <ApartmentIcon style={{ fontSize: 22, color: "#C0392B" }} />
              <Title level={4} style={{ margin: 0 }}>{graph.name}</Title>
              {graph.isActive ? <Tag color="green">激活</Tag> : <Tag>未激活</Tag>}
              <Tag>v{graph.version || 1}</Tag>
            </Space>
            <div style={{ marginTop: 6, color: "#666" }}>{graph.description || "暂无描述"}</div>
            <div style={{ marginTop: 8 }}>{statsInline}</div>
          </Col>
          <Col>
            <Space>
              <Button type="primary" ghost icon={<ApartmentOutlined />} onClick={() => { setAiModalOpen(true); setAiTaskCount(5); }} style={canEdit ? undefined : { display: "none" }}>AI 生成</Button>
              <ReadonlyActionButton icon={<EditOutlined />} onClick={() => { setEditingGraph({ name: graph.name, description: graph.description || "", isActive: graph.isActive, version: graph.version }); setEditGraphOpen(true); }}>编辑</ReadonlyActionButton>
              <Popconfirm title="确定删除该图谱？将级联删除所有任务/能力/知识点关联。" onConfirm={() => deleteGraphMutation.mutate()}>
                <ReadonlyActionButton danger icon={<DeleteOutlined />}>删除</ReadonlyActionButton>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "tasks",
              label: <span><AimOutlined /> 核心任务</span>,
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingTask(null); setTaskForm({ title: "", description: "" }); setTaskDrawerOpen(true); }} style={canEdit ? undefined : { display: "none" }}>添加任务</Button>
                  </div>
                  <Table columns={taskColumns} dataSource={tasks} rowKey="id" pagination={false} />
                </div>
              ),
            },
            {
              key: "abilities",
              label: <span><FileSearchOutlined /> 能力点</span>,
              children: (
                <div>
                  <Space style={{ marginBottom: 12 }}>
                    <Select
                      allowClear
                      placeholder="按任务过滤"
                      style={{ width: 240 }}
                      value={abilityFilterTask}
                      onChange={setAbilityFilterTask}
                      options={tasks.map(t => ({ value: t.id, label: t.title }))}
                    />
                    <Button type="primary" icon={<PlusOutlined />} disabled={tasks.length === 0} onClick={() => {
                      setEditingAbility(null);
                      setAbilityForm({ name: "", description: "", level: undefined, coreTaskId: abilityFilterTask || tasks[0]?.id });
                      setAbilityDrawerOpen(true);
                    }} style={canEdit ? undefined : { display: "none" }}>添加能力点</Button>
                  </Space>
                  <Table columns={abilityColumns} dataSource={filteredAbilities} rowKey="id" pagination={false} />
                </div>
              ),
            },
            {
              key: "links",
              label: <span><BookOutlined /> 编辑知识点关联</span>,
              children: (
                <div>
                  <Table columns={linkColumns} dataSource={links} rowKey="id" pagination={{ pageSize: 20 }} />
                </div>
              ),
            },
            {
              key: "visualization",
              label: <span><ApartmentOutlined /> 可视化</span>,
              children: vizData ? (
                <div>
                  <div style={{ marginBottom: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <Input
                      prefix={<SearchOutlined />}
                      placeholder="搜索节点名称..."
                      value={graphSearchText}
                      onChange={e => setGraphSearchText(e.target.value)}
                      style={{ width: 240 }}
                      allowClear
                    />
                    <Select
                      allowClear
                      placeholder="按任务过滤"
                      style={{ width: 200 }}
                      value={graphSearchTask}
                      onChange={setGraphSearchTask}
                      options={tasks.map(t => ({ value: t.id, label: t.title }))}
                    />
                    <Space size="small">
                      <Tag color={NODE_COLORS.job}>岗位</Tag>
                      <Tag color={NODE_COLORS.task}>核心任务</Tag>
                      <Tag color={NODE_COLORS.ability}>能力点</Tag>
                      <Tag color={NODE_COLORS.knowledge}>知识点</Tag>
                      <Tag color={NODE_COLORS.course}>课程</Tag>
                      <Tag icon={<FileTextOutlined />} color="purple">主支撑</Tag>
                      <Tag icon={<BookOutlined />} color="cyan">次支撑</Tag>
                    </Space>
                    <Button size="small" onClick={() => { setGraphSearchText(""); setGraphSearchTask(undefined); }}>重置</Button>
                  </div>
                  <div ref={chartRef} style={{ width: "100%", height: "calc(100vh - 380px)", minHeight: 420 }} />
                </div>
              ) : (
                <Empty description="加载中或无图谱数据" />
              ),
            },
          ]}
        />
      </Card>

      {/* AI 生成图谱 */}
      <Modal
        title="AI 生成能力图谱"
        open={aiModalOpen}
        onCancel={() => {
          setAiModalOpen(false);
          setAiPreview(null);
        }}
        width={720}
        okText={
          aiGenerating
            ? "正在生成..."
            : aiPreview
              ? "确认生成"
              : "预览"
        }
        cancelText="取消"
        okButtonProps={{
          loading: aiGenerating,
          disabled: !graph?.jobPositionId,
          type: aiPreview ? "primary" : "default",
          danger: aiPreview && (tasks.length > 0 || abilities.length > 0),
        }}
        onOk={async () => {
          // AI 接口公共调用：带 250s 超时 + AbortController
          const callAi = async (previewOnly: boolean) => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 600_000);
            try {
              const res = await fetch("/api/job-competency-graph/ai-generate", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  ...headers,
                },
                body: JSON.stringify({
                  tenant,
                  jobPositionId: graph.jobPositionId,
                  graphId,
                  taskCount: aiTaskCount,
                  previewOnly,
                }),
                signal: controller.signal,
              });
              const data = await res.json();
              return data;
            } finally {
              clearTimeout(timeout);
            }
          };

          // 已有预览 → 提交落库
          if (aiPreview) {
            try {
              setAiGenerating(true);
              const data = await callAi(false);
              if (data.success) {
                setAiModalOpen(false);
                setAiPreview(null);
                queryClient.invalidateQueries({ queryKey: ["graph-tasks"] });
                queryClient.invalidateQueries({ queryKey: ["graph-abilities"] });
                queryClient.invalidateQueries({ queryKey: ["graph-links"] });
                const summary = `已生成 ${data.data?.taskCount || 0} 个任务、${data.data?.abilityCount || 0} 个能力点`;
                message.success(summary, 3);
                if (!(data.data?.linkCount > 0)) {
                  setTimeout(() => {
                    message.info("知识点暂未自动关联，请到「能力点」表格中点击「配置知识点」手动关联", 6);
                  }, 500);
                }
              } else {
                message.error(data.message || "生成失败");
              }
            } catch (e: any) {
              if (e?.name === "AbortError") {
                message.error("请求超时（超过 250 秒），请尝试减少生成任务数量");
              } else {
                message.error(e?.message || "请求失败");
              }
            } finally {
              setAiGenerating(false);
            }
            return;
          }

          // 进入预览模式：调用后端 API（previewOnly=true）
          try {
            setAiGenerating(true);
            const data = await callAi(true);
            if (data.success) {
              setAiPreview({
                tasks: data.data?.previewData?.tasks || [],
              });
            } else {
              message.error(data.message || "预览失败");
            }
          } catch (e: any) {
            if (e?.name === "AbortError") {
              message.error("请求超时（超过 250 秒），请尝试减少生成任务数量");
            } else {
              message.error(e?.message || "请求失败");
            }
          } finally {
            setAiGenerating(false);
          }
        }}
      >
        {!aiPreview ? (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Alert
              type="info"
              showIcon
              message="AI 将先预览再生成"
              description={
                tasks.length > 0 || abilities.length > 0
                  ? "AI 重新生成会覆盖当前图谱下的核心任务、能力点及其知识点关联，可先查看预览再确认。"
                  : "点击「预览」查看 AI 即将生成的内容。"
              }
            />
            <div>
              <Text>岗位：</Text>
              <Text strong>{job?.title || "-"}</Text>
            </div>
            <div>
              <Text>生成任务数量：</Text>
              <InputNumber
                min={2}
                max={15}
                value={aiTaskCount}
                onChange={v => setAiTaskCount(v || 2)}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>
            <div style={{ color: "#888", fontSize: 12 }}>
              AI 将分析岗位信息，生成核心任务和能力点，并自动匹配已有课程的知识点。
            </div>
          </Space>
        ) : (
          <div>
            {tasks.length > 0 || abilities.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={
                  <span>
                    生成 AI 任务会覆盖当前已有任务（核心任务 <strong>{tasks.length}</strong> 个、能力点 <strong>{abilities.length}</strong> 个）
                  </span>
                }
              />
            ) : null}
            <div
              style={{
                maxHeight: 480,
                overflowY: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 6,
                padding: 8,
                background: "#fafafa",
              }}
            >
              {aiPreview.tasks.map((task, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    marginBottom: 8,
                    background: "#fff",
                    borderRadius: 6,
                    border: "1px solid #eee",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Tag color="blue">任务 {idx + 1}</Tag>
                    <Text strong style={{ fontSize: 14 }}>{task.title}</Text>
                  </div>
                  {task.description ? (
                    <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
                      {task.description}
                    </div>
                  ) : null}
                  {task.abilities && task.abilities.length > 0 ? (
                    <div style={{ paddingLeft: 12, borderLeft: "2px solid #e6f4ff" }}>
                      {task.abilities.map((a, ai) => (
                        <div
                          key={ai}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                            fontSize: 12,
                          }}
                        >
                          <Tag color={
                            a.level === "advanced" ? "red" :
                            a.level === "intermediate" ? "orange" : "green"
                          }>
                            {a.level === "advanced" ? "高级" :
                             a.level === "intermediate" ? "中级" : "初级"}
                          </Tag>
                          <Text strong>{a.name}</Text>
                          {a.description ? (
                            <Text type="secondary" style={{ fontSize: 12 }}>· {a.description}</Text>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button onClick={() => setAiPreview(null)} icon={<ReloadOutlined />}>
                重新生成
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 编辑图谱 */}
      <Modal title="编辑图谱" open={editGraphOpen} onCancel={() => setEditGraphOpen(false)} onOk={() => updateGraphMutation.mutate()} confirmLoading={updateGraphMutation.isPending}>
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>图谱名称 *</Text><Input value={editingGraph.name} onChange={e => setEditingGraph({ ...editingGraph, name: e.target.value })} /></div>
          <div><Text>描述</Text><TextArea value={editingGraph.description} onChange={e => setEditingGraph({ ...editingGraph, description: e.target.value })} rows={3} /></div>
          <Row gutter={16}>
            <Col span={12}><Text>版本</Text><InputNumber style={{ width: "100%" }} value={editingGraph.version} min={1} onChange={v => setEditingGraph({ ...editingGraph, version: v || 1 })} /></Col>
            <Col span={12}><Text>激活</Text><div style={{ paddingTop: 4 }}><Radio.Group value={editingGraph.isActive} onChange={e => setEditingGraph({ ...editingGraph, isActive: e.target.value })}><Radio value={true}>激活</Radio><Radio value={false}>未激活</Radio></Radio.Group></div></Col>
          </Row>
        </Space>
      </Modal>

      {/* 任务 Drawer */}
      <Drawer
        title={editingTask ? "编辑任务" : "添加任务"}
        open={taskDrawerOpen}
        onClose={() => { setTaskDrawerOpen(false); setEditingTask(null); }}
        width={480}
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={() => { setTaskDrawerOpen(false); setEditingTask(null); }}>取消</Button>
            <Button type="primary" loading={saveTaskMutation.isPending} onClick={() => saveTaskMutation.mutate()}>保存</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>任务名称 *</Text><Input value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></div>
          <div><Text>描述</Text><TextArea value={taskForm.description} onChange={e => setTaskForm({ ...taskForm, description: e.target.value })} rows={3} /></div>
        </Space>
      </Drawer>

      {/* 能力 Drawer */}
      <Drawer
        title={editingAbility ? "编辑能力点" : "添加能力点"}
        open={abilityDrawerOpen}
        onClose={() => { setAbilityDrawerOpen(false); setEditingAbility(null); }}
        width={480}
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={() => { setAbilityDrawerOpen(false); setEditingAbility(null); }}>取消</Button>
            <Button type="primary" loading={saveAbilityMutation.isPending} onClick={() => saveAbilityMutation.mutate()}>保存</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div><Text>能力点名称 *</Text><Input value={abilityForm.name} onChange={e => setAbilityForm({ ...abilityForm, name: e.target.value })} /></div>
          <div>
            <Text>所属任务 *</Text>
            <Select style={{ width: "100%" }} value={abilityForm.coreTaskId} onChange={v => setAbilityForm({ ...abilityForm, coreTaskId: v })} options={tasks.map(t => ({ value: t.id, label: t.title }))} placeholder="选择任务" />
          </div>
          <div><Text>描述</Text><TextArea value={abilityForm.description} onChange={e => setAbilityForm({ ...abilityForm, description: e.target.value })} rows={3} /></div>
          <div>
            <Text>等级</Text>
            <Select allowClear style={{ width: "100%" }} value={abilityForm.level} onChange={v => setAbilityForm({ ...abilityForm, level: v as any })} options={LEVEL_OPTIONS} placeholder="选择等级" />
          </div>
        </Space>
      </Drawer>

      {/* 知识关联 Drawer (仅用于编辑单条关联) */}
      <Drawer
        title={editingLink ? "编辑知识关联" : "添加知识关联"}
        open={linkDrawerOpen}
        onClose={() => { setLinkDrawerOpen(false); setEditingLink(null); }}
        width={520}
        footer={
          <Space style={{ float: "right" }}>
            <Button onClick={() => { setLinkDrawerOpen(false); setEditingLink(null); }}>取消</Button>
            <Button type="primary" loading={saveLinkMutation.isPending} onClick={() => saveLinkMutation.mutate()}>保存</Button>
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <div>
            <Text>能力点 *</Text>
            <Select style={{ width: "100%" }} value={linkForm.abilityId} onChange={v => setLinkForm({ ...linkForm, abilityId: v })} options={abilities.map(a => ({ value: a.id, label: a.name }))} placeholder="选择能力点" disabled={!!editingLink} />
          </div>
          <div>
            <Text>知识点 *</Text>
            {!editingLink ? (
              <>
                <Input.Search placeholder="按名称搜索知识点..." value={linkSearch} onChange={e => setLinkSearch(e.target.value)} style={{ marginBottom: 8 }} />
                <Select
                  showSearch
                  style={{ width: "100%" }}
                  placeholder="选择知识点"
                  value={linkForm.knowledgeResourceId}
                  onChange={v => setLinkForm({ ...linkForm, knowledgeResourceId: v })}
                  filterOption={false}
                  options={linkSearchResults.map((k: any) => ({ value: k.id, label: k.course ? `${k.name} (${k.course.title})` : k.name }))}
                />
              </>
            ) : (
              <Input value={links.find(l => l.id === editingLink.id)?.knowledgeResource?.name || ""} disabled />
            )}
          </div>
          <div>
            <Text>支撑层级</Text>
            <Radio.Group value={linkForm.supportLevel} onChange={e => setLinkForm({ ...linkForm, supportLevel: e.target.value })}>
              {SUPPORT_LEVEL_OPTIONS.map(o => <Radio.Button key={o.value} value={o.value}>{o.label}</Radio.Button>)}
            </Radio.Group>
          </div>
          <div><Text>说明</Text><TextArea value={linkForm.description} onChange={e => setLinkForm({ ...linkForm, description: e.target.value })} rows={2} /></div>
        </Space>
      </Drawer>

      {/* 知识点配置弹窗（从能力表打开，多选，批量替换） */}
      <Modal
        title={configAbilityName ? `配置「${configAbilityName}」的知识点关联` : "配置知识点"}
        open={knowledgeModalOpen}
        onCancel={() => { setKnowledgeModalOpen(false); setConfigAbilityId(null); setSelectedKnowledgeIds([]); }}
        width={760}
        confirmLoading={replaceLinksMutation.isPending}
        okText="保存"
        onOk={async () => {
          if (!configAbilityId || selectedKnowledgeIds.length === 0) {
            message.warning("请至少选择一个知识点");
            return;
          }
          await replaceLinksMutation.mutateAsync({ abilityId: configAbilityId, linkIds: selectedKnowledgeIds });
          setKnowledgeModalOpen(false);
          setConfigAbilityId(null);
          setSelectedKnowledgeIds([]);
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <Select
            allowClear
            placeholder="请先选择课程以加载知识点"
            style={{ width: "100%" }}
            value={knowledgeCourseFilter}
            onChange={v => {
              setKnowledgeCourseFilter(v);
              setSelectedKnowledgeIds([]);
              setExpandedRowIds([]);
            }}
            options={linkCourseList.map((c: any) => ({ value: c.id, label: c.title }))}
          />
        </div>
        {!knowledgeCourseFilter ? (
          <Empty description="请先选择课程" />
        ) : (
          <Table
            rowKey="id"
            dataSource={knowledgeTreeData}
            loading={knowledgeHierarchy.length === 0}
            size="small"
            pagination={false}
            expandable={{
              defaultExpandAllRows: true,
              expandedRowKeys: expandedRowIds,
              onExpandedRowChange: (expandedKeys: readonly React.Key[]) => {
                // 当展开/折叠时更新状态
              },
              rowExpandable: () => false, // 用扁平列表，不嵌套展开
            }}
            showHeader={false}
            columns={[
              {
                dataIndex: "id",
                key: "name",
                render: (id: string, r: any) => (
                  <div style={{ paddingLeft: r._level * 24, display: "flex", alignItems: "center", gap: 8 }}>
                    <Checkbox
                      checked={selectedKnowledgeIds.includes(id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedKnowledgeIds([...selectedKnowledgeIds, id]);
                        } else {
                          setSelectedKnowledgeIds(selectedKnowledgeIds.filter(s => s !== id));
                        }
                      }}
                    />
                    <FolderOutlined style={{ color: r.knowledgeType === "subject" ? "#faad14" : r.knowledgeType === "knowledge_unit" ? "#1677ff" : "#52c41a", fontSize: 14 }} />
                    <span style={{ fontWeight: r._level <= 1 ? "bold" : "normal", color: r._level <= 1 ? "#333" : "#666" }}>
                      {r.name}
                    </span>
                    {r.description && (
                      <span style={{ color: "#999", fontSize: 12, marginLeft: 4 }}>
                        — {r.description.slice(0, 30)}{r.description.length > 30 ? "..." : ""}
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
            scroll={{ y: 400 }}
          />
        )}
      </Modal>

      {/* 知识点资源面板（独立 Drawer，由 KnowledgeResourcePanel 自己管理） */}
      {vizNode?.rawType === "knowledge" && vizKnowledgeId && (
        <KnowledgeResourcePanel
          open={vizDrawerOpen}
          onClose={() => { setVizDrawerOpen(false); setVizKnowledgeId(null); }}
          knowledge={{
            id: vizNode.rawData.id,
            name: vizNode.name,
            description: vizNode.rawData?.description || "",
            knowledgeType: vizNode.rawData?.knowledgeType || "knowledge_cell",
          }}
        />
      )}

      {/* 非知识点节点详情 Drawer */}
      <Drawer
        title={
          <Space>
            {vizNode?.name || "节点详情"}
          </Space>
        }
        open={vizDrawerOpen && vizNode?.rawType !== "knowledge"}
        onClose={() => { setVizDrawerOpen(false); setVizKnowledgeId(null); }}
        width={480}
      >
        {vizNode && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">
              {{"job": "岗位", "task": "核心任务", "ability": "能力点", "course": "课程"}[vizNode.rawType] || vizNode.rawType}
            </Descriptions.Item>
            {vizNode.rawType === "ability" && (
              <Descriptions.Item label="所属任务">
                {tasks.find(t => t.id === vizNode.rawData?.coreTaskId)?.title || "-"}
              </Descriptions.Item>
            )}
            {vizNode.rawData?.description && (
              <Descriptions.Item label="描述">
                <Paragraph style={{ margin: 0, marginBottom: 0 }}>{vizNode.rawData.description}</Paragraph>
              </Descriptions.Item>
            )}
            {vizNode.rawType === "ability" && (
              <Descriptions.Item label="等级">
                {LEVEL_OPTIONS.find(o => o.value === vizNode.rawData?.level)?.label || "-"}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
