import * as React from "react";
import { useRef, useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Typography,
  Card,
  Spin,
  Tag,
  Empty,
  Select,
  Input,
  Space,
  Drawer,
  Descriptions,
  Alert,
  Grid,
  Button,
} from "antd";
import {
  ApartmentOutlined,
  SearchOutlined,
  BookOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import {
  listMajors,
  listJobPositions,
  getPositionsByMajor,
  listJobCompetencyGraphs,
  listGraphsByJobPosition,
  listCoreTasksByGraph,
  listAbilitiesByGraph,
  listLinksByGraph,
  getJobPosition,
  listCourses,
} from "@/lib/ash_rpc";

const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

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

const NODE_COLORS = {
  job: "#C0392B",
  task: "#E67E22",
  ability: "#F39C12",
  knowledge: "#3498DB",
  course: "#1ABC9C",
};

function buildIconDataUri(paths: string[], color: string): string {
  const iconPaths = paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">${iconPaths}</svg>`;
  return `image://data:image/svg+xml;base64,${btoa(svg)}`;
}

function buildJobIconDataUri(): string {
  const paths = ["M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0", "M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"];
  const bg = NODE_COLORS.job;
  const iconPaths = paths
    .map(
      (d) =>
        `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
    <rect x="1" y="1" width="22" height="22" rx="8" ry="8" fill="${bg}" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    ${iconPaths}
  </svg>`;
  return `image://data:image/svg+xml;base64,${btoa(svg)}`;
}

const NODE_ICONS = {
  job: buildJobIconDataUri(),
  task: buildIconDataUri(
    [
      "M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2",
      "M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2",
      "M9 12l.01 0",
      "M13 12l2 0",
      "M9 16l.01 0",
      "M13 16l2 0",
    ],
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
  course: buildIconDataUri(["M7 4v16l13 -8l-13 -8"], NODE_COLORS.course),
};

const JOB_SYMBOL_SIZE = 54;
const NODE_SYMBOL_SIZE = 40;

const CATEGORIES = [
  { name: "岗位", itemStyle: { color: NODE_COLORS.job } },
  { name: "核心任务", itemStyle: { color: NODE_COLORS.task } },
  { name: "能力点", itemStyle: { color: NODE_COLORS.ability } },
  { name: "知识点", itemStyle: { color: NODE_COLORS.knowledge } },
  { name: "课程", itemStyle: { color: NODE_COLORS.course } },
];

export default function StudentJobCompetencyGraph() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = useMemo(() => getHeaders(user), [user]);
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";

  const [majorId, setMajorId] = useState<string | undefined>(undefined);
  const [jobId, setJobId] = useState<string | undefined>(undefined);
  const [graphId, setGraphId] = useState<string | undefined>(undefined);

  const [searchText, setSearchText] = useState("");
  const [filterTaskId, setFilterTaskId] = useState<string | undefined>(undefined);

  const [vizDrawerOpen, setVizDrawerOpen] = useState(false);
  const [vizNode, setVizNode] = useState<any>(null);
  const [vizKnowledgeId, setVizKnowledgeId] = useState<string | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [chartTick, setChartTick] = useState(0);

  // course major (用于过滤专业列表，仅显示当前课程所属专业)
  const { data: courseRes } = useQuery({
    queryKey: ["student-job-graph-course-major", tenant, courseId],
    queryFn: async () => {
      if (!courseId || !tenant) return null;
      const r = await listCourses({ tenant, fields: ["id", "major", "title"], filter: { id: { eq: courseId } }, headers });
      const data = (r as any)?.data;
      const list = (data?.results || data || []);
      return Array.isArray(list) ? list[0] || null : (data || null);
    },
    enabled: !!tenant && !!courseId,
  });
  const courseMajorName: string = (courseRes as any)?.major?.trim() || "";

  // majors
  const { data: majorsRes } = useQuery({
    queryKey: ["student-job-graph-majors", tenant],
    queryFn: async () => {
      const r = await listMajors({ tenant, fields: ["id", "name"], headers });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant,
  });
  const allMajors: any[] = useMemo(() => (Array.isArray(majorsRes) ? majorsRes : []), [majorsRes]);
  // 按当前课程专业过滤：课程有专业时仅展示匹配该专业的专业，无匹配则为空（不回退展示全部）
  const majors: any[] = useMemo(() => {
    if (courseMajorName) {
      return allMajors.filter((m: any) => (m.name || "").trim() === courseMajorName);
    }
    return allMajors;
  }, [allMajors, courseMajorName]);

  // auto-select first major (优先已匹配的当前课程专业)
  useEffect(() => {
    if (majors.length > 0 && (!majorId || !majors.find((m) => m.id === majorId))) {
      setMajorId(majors[0].id);
    }
    if (majors.length === 0) {
      setMajorId(undefined);
    }
  }, [majors, majorId]);

  // jobs：仅当选中专业后才加载该专业下岗位，未选专业时为空
  const { data: jobsRes } = useQuery({
    queryKey: ["student-job-graph-jobs", tenant, majorId],
    queryFn: async () => {
      if (!majorId) return [];
      const r = await getPositionsByMajor({
        tenant,
        input: { majorId },
        fields: ["id", "title", "majorId"],
        headers,
      });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant && !!majorId,
  });
  const jobs: any[] = useMemo(() => (Array.isArray(jobsRes) ? jobsRes : []), [jobsRes]);

  useEffect(() => {
    if (jobs.length > 0 && (!jobId || !jobs.find((j) => j.id === jobId))) {
      setJobId(jobs[0].id);
      setGraphId(undefined);
    }
    if (jobs.length === 0) {
      setJobId(undefined);
      setGraphId(undefined);
    }
  }, [jobs]);

  // graphs
  const { data: graphsRes, isLoading: graphsLoading } = useQuery({
    queryKey: ["student-job-graphs", tenant, jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const r = await listGraphsByJobPosition({
        tenant,
        input: { jobPositionId: jobId },
        fields: ["id", "name", "description", "isActive", "version", "jobPositionId"],
        headers,
      });
      const data = (r as any)?.data;
      return r?.success ? (data?.results || data || []) : [];
    },
    enabled: !!tenant && !!jobId,
  });
  const graphs: any[] = useMemo(() => (Array.isArray(graphsRes) ? graphsRes : []), [graphsRes]);

  useEffect(() => {
    if (graphs.length > 0 && (!graphId || !graphs.find((g) => g.id === graphId))) {
      const latest = [...graphs].sort((a, b) => (b.version || 1) - (a.version || 1))[0];
      setGraphId(latest.id);
    }
    if (graphs.length === 0) setGraphId(undefined);
  }, [graphs]);

  // job detail
  const { data: jobRes } = useQuery({
    queryKey: ["student-job-for-graph", jobId, tenant],
    queryFn: async () => {
      if (!jobId) return null;
      const r = await getJobPosition({ tenant, input: { id: jobId }, fields: ["id", "title", "description"], headers });
      return (r as any)?.success ? (r as any).data : null;
    },
    enabled: !!jobId && !!tenant,
  });
  const job = jobRes || null;

  const { data: tasksRes } = useQuery({
    queryKey: ["student-graph-tasks", graphId, tenant],
    queryFn: async () => {
      if (!graphId) return [];
      const r = await listCoreTasksByGraph({
        tenant,
        input: { graphId: graphId! },
        fields: ["id", "title", "description"],
        headers,
      });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const tasks: any[] = useMemo(() => (Array.isArray(tasksRes) ? tasksRes : []), [tasksRes]);

  const { data: abilitiesRes } = useQuery({
    queryKey: ["student-graph-abilities", graphId, tenant],
    queryFn: async () => {
      if (!graphId) return [];
      const r = await listAbilitiesByGraph({
        tenant,
        input: { graphId: graphId! },
        fields: ["id", "name", "description", "level", "coreTaskId"],
        headers,
      });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const abilities: any[] = useMemo(() => (Array.isArray(abilitiesRes) ? abilitiesRes : []), [abilitiesRes]);

  const { data: linksRes } = useQuery({
    queryKey: ["student-graph-links", graphId, tenant],
    queryFn: async () => {
      if (!graphId) return [];
      const r = await listLinksByGraph({
        tenant,
        input: { graphId: graphId! },
        fields: [
          "id",
          "abilityId",
          "knowledgeResourceId",
          "supportLevel",
          "weight",
          "description",
          { knowledgeResource: ["id", "name", "description", "courseId", { course: ["id", "title"] }] },
        ],
        headers,
      });
      const data = (r as any)?.data;
      return (r as any)?.success ? (data?.results || data || []) : [];
    },
    enabled: !!graphId && !!tenant,
  });
  const links: any[] = useMemo(() => (Array.isArray(linksRes) ? linksRes : []), [linksRes]);

  const vizData = useMemo(() => {
    if (!job || !graphId) return null;
    const searchLower = searchText.toLowerCase().trim();
    const filteredTaskIds = filterTaskId ? new Set([filterTaskId]) : null;
    const hasSearch = searchLower !== "" || filteredTaskIds !== null;
    const nodes: any[] = [];
    const linksArr: any[] = [];

    nodes.push({
      id: `job:${job.id}`,
      name: job.title,
      category: 0,
      symbol: NODE_ICONS.job,
      symbolSize: JOB_SYMBOL_SIZE,
      itemStyle: { color: NODE_COLORS.job, borderColor: "transparent", borderWidth: 0, shadowBlur: 0 },
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
      linksArr.push({
        source: `job:${job.id}`,
        target: `task:${t.id}`,
        lineStyle: { opacity: 0.7, width: 2.5, color: NODE_COLORS.job },
      });
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
            badge: {
              fontSize: 10,
              color: "#fff",
              backgroundColor: NODE_COLORS.ability,
              padding: [1, 6],
              borderRadius: 4,
              fontWeight: "bold",
            },
          },
          formatter: (p: any) => {
            const lvl = LEVEL_OPTIONS.find((o) => o.value === p.data?.rawData?.level);
            if (lvl) return `{name|${p.name}}{badge|${lvl.label}}`;
            return p.name;
          },
        },
        rawType: "ability",
        rawData: a,
      });
      linksArr.push({
        source: `task:${a.coreTaskId}`,
        target: `ability:${a.id}`,
        lineStyle: { opacity: 0.55, width: 2, color: NODE_COLORS.task },
      });
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
      const supportConfig: Record<string, { width: number; color: string }> = {
        primary: { width: 3, color: "#722ed1" },
        secondary: { width: 2, color: "#13c2c2" },
        practice: { width: 1.5, color: NODE_COLORS.ability },
      };
      const slCfg = supportConfig[l.supportLevel] || supportConfig.practice;
      linksArr.push({
        source: `ability:${l.abilityId}`,
        target: `knowledge:${l.knowledgeResourceId}`,
        lineStyle: { opacity: 0.6, width: slCfg.width, color: slCfg.color },
      });
      if (l.knowledgeResource?.course) {
        linksArr.push({
          source: `knowledge:${l.knowledgeResourceId}`,
          target: `course:${l.knowledgeResource.course.id}`,
          lineStyle: { opacity: 0.4, width: 1, type: "dashed", color: NODE_COLORS.knowledge },
        });
      }
    }

    if (hasSearch) {
      const matchedNodeIds = new Set<string>();
      for (const n of nodes) {
        if (
          (searchLower === "" || n.name.toLowerCase().includes(searchLower)) &&
          (filteredTaskIds === null ||
            n.rawType === "job" ||
            (n.rawType === "task" && filteredTaskIds.has(n.rawData?.id)) ||
            (n.rawType === "ability" &&
              filteredTaskIds.has(
                tasks.find((t) => abilities.find((a) => a.id === n.rawData?.id)?.coreTaskId === t.id)?.id,
              )) ||
            (n.rawType === "knowledge" &&
              links.some(
                (l) =>
                  l.knowledgeResourceId === n.rawData?.id &&
                  filteredTaskIds.has(
                    tasks.find((t) => abilities.find((a) => a.id === l.abilityId)?.coreTaskId === t.id)?.id,
                  ),
              )) ||
            (n.rawType === "course" &&
              links.some(
                (l) =>
                  l.knowledgeResource?.courseId === n.rawData?.id &&
                  filteredTaskIds.has(
                    tasks.find((t) => abilities.find((a) => a.id === l.abilityId)?.coreTaskId === t.id)?.id,
                  ),
              )))
        ) {
          matchedNodeIds.add(n.id);
        }
      }
      const filteredNodes = nodes.filter((n) => matchedNodeIds.has(n.id));
      const filteredNodeIds = new Set(filteredNodes.map((n) => n.id));
      const filteredLinks = linksArr.filter(
        (l) => filteredNodeIds.has(l.source as string) && filteredNodeIds.has(l.target as string),
      );
      return { nodes: filteredNodes, links: filteredLinks };
    }

    return { nodes, links: linksArr };
  }, [job, graphId, tasks, abilities, links, searchText, filterTaskId]);

  useEffect(() => {
    if (!vizData || !chartRef.current) return;
    const container = chartRef.current;
    if (!container.style.height) container.style.height = "520px";
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      const rafId = requestAnimationFrame(() => setChartTick((t) => t + 1));
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
                ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #eee"><span style="color:#f39c12;font-weight:bold">等级</span><span style="margin-left:8px">${LEVEL_OPTIONS.find((o) => o.value === d.rawData.level)?.label || d.rawData.level}</span></div>`
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
      legend: {
        data: CATEGORIES.map((c) => c.name),
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
      animation: true,
      animationDuration: 1200,
      animationEasingUpdate: "quinticInOut",
      series: [
        {
          name: "岗位能力图谱",
          type: "graph",
          layout: "force",
          categories: CATEGORIES,
          data: vizData.nodes,
          links: vizData.links,
          roam: true,
          initialLayout: "circular",
          force: { repulsion: 500, gravity: 0.08, edgeLength: [80, 160], friction: 0.15, layoutAnimation: true },
          draggable: true,
          label: { show: true, position: "right", formatter: "{b}" },
          labelLayout: { hideOverlap: true },
          emphasis: {
            focus: "adjacency",
            label: { show: true, fontSize: 14, fontWeight: "bold" },
            lineStyle: { width: 3, opacity: 0.9 },
          },
          blur: { lineStyle: { opacity: 0.15 } },
          lineStyle: { curveness: 0.15, opacity: 0.5 },
          edgeSymbol: ["none", "arrow"],
          edgeSymbolSize: [0, 6],
        },
      ],
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

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
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
  }, [vizData, chartTick]);

  if (!tenant) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Alert type="warning" message="未检测到租户信息" />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 0, height: 0, background: "#f5f5f5" }}>
      {/* 左侧数据侧边栏：选择专业/岗位/图谱 */}
      {isMobile ? (
        <div style={{ background: "#fff", padding: 8, borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>所属专业</div>
            {majors.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa0a6", padding: "6px 0" }}>当前课程暂无匹配专业</div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1c1e", padding: "2px 0" }}>{majors[0].name}</div>
            )}
            <Select
              placeholder="选择岗位"
              value={jobId}
              onChange={(v) => { setJobId(v); setGraphId(undefined); }}
              style={{ width: "100%" }}
              options={jobs.map((j) => ({ value: j.id, label: j.title }))}
              notFoundContent={jobs.length === 0 ? (majors.length === 0 ? "暂无匹配专业" : "该专业暂无岗位") : undefined}
            />
            <Select
              placeholder={graphsLoading ? "加载中..." : "选择图谱"}
              value={graphId}
              onChange={setGraphId}
              style={{ width: "100%" }}
              options={graphs.map((g) => ({ value: g.id, label: g.name }))}
              notFoundContent={jobId ? "该岗位暂无图谱" : "请先选择岗位"}
              loading={graphsLoading}
            />
          </div>
        </div>
      ) : (
        <div style={{ width: 268, flexShrink: 0, background: "#fff", borderRight: "1px solid #f0f0f0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #f0f0f0", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #C0392B 0%, #8e2a22 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, flexShrink: 0 }}>
              <ApartmentOutlined />
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#1a1c1e", lineHeight: 1.1 }}>选择图谱</span>
              <span style={{ fontSize: 11, color: "#8a9199" }}>{majors.length === 0 ? "暂无匹配专业" : majors[0].name} · {jobs.length} 个岗位</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid #f0f0f0", background: "#fafbfc" }}>
            <div style={{ fontSize: 12, color: "#374151", marginBottom: 8, fontWeight: 700, letterSpacing: 0.3 }}>所属专业</div>
            {majors.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9aa0a6", padding: "6px 0" }}>当前课程暂无匹配专业</div>
            ) : (
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1c1e", padding: "6px 10px", background: "#fff", borderRadius: 8, border: "1px solid #eef2f7" }}>{majors[0].name}</div>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", paddingTop: 4 }}>
            <div style={{ padding: "8px 14px 6px", fontSize: 10, color: "#9aa0a6", fontWeight: 700, letterSpacing: 0.8 }}>岗位列表</div>
            {jobs.length === 0 ? (
              <div style={{ padding: "10px 14px", fontSize: 12, color: "#9aa0a6" }}>暂无岗位</div>
            ) : (
              <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 4 }}>
                {jobs.map((j) => {
                  const isActive = j.id === jobId;
                  return (
                    <div
                      key={j.id}
                      onClick={() => { setJobId(j.id); setGraphId(undefined); }}
                      style={{
                        padding: "9px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: isActive ? "#eef2ff" : "#fff",
                        border: isActive ? "1px solid #c7d2fe" : "1px solid #eef2f7",
                        boxShadow: isActive ? "0 1px 6px rgba(37,115,230,0.08)" : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <span style={{ width: 28, height: 28, borderRadius: 7, background: isActive ? "#2573E6" : "#f1f5f9", color: isActive ? "#fff" : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>
                        <ApartmentOutlined />
                      </span>
                      <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "#1e3a8a" : "#1f2428", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{j.title}</span>
                      {isActive && <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#2573E6", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ padding: "14px 14px 6px", fontSize: 10, color: "#9aa0a6", fontWeight: 700, letterSpacing: 0.8, marginTop: 4, borderTop: "1px solid #f5f5f5" }}>图谱</div>
            {graphsLoading ? (
              <div style={{ padding: 12, textAlign: "center" }}><Spin size="small" /></div>
            ) : graphs.length === 0 ? (
              <div style={{ padding: "8px 14px", fontSize: 12, color: "#9aa0a6" }}>{jobId ? "该岗位暂无图谱" : "请先选择岗位"}</div>
            ) : (
              <div style={{ padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {graphs.map((g) => {
                  const isActive = g.id === graphId;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setGraphId(g.id)}
                      style={{
                        padding: "10px 10px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: isActive ? "#f0f7ff" : "#fff",
                        border: isActive ? "1px solid #bfdbfe" : "1px solid #eef2f7",
                        boxShadow: isActive ? "0 1px 6px rgba(37,115,230,0.08)" : "none",
                        transition: "all 0.15s",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                      onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                      onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                    >
                      <div style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "#1e40af" : "#1f2428", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
                      {isActive && <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#2573E6", flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {graphId && (
            <div style={{ padding: 10, borderTop: "1px solid #f0f0f0", background: "#fafafa" }}>
              <div style={{ fontSize: 11, color: "#999", marginBottom: 6, fontWeight: 600 }}>统计</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Tag color="#E67E22" style={{ margin: 0, fontSize: 11 }}>{tasks.length} 任务</Tag>
                <Tag color="#F39C12" style={{ margin: 0, fontSize: 11 }}>{abilities.length} 能力</Tag>
                <Tag color="#3498DB" style={{ margin: 0, fontSize: 11 }}>{links.length} 知识点</Tag>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 右侧：搜索 + 图谱 */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "#fff", overflow: "hidden" }}>
        {/* 统计 + 搜索（仅当已选图谱） */}
        {graphId && (
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              padding: isMobile ? "8px" : "8px 12px",
              borderBottom: "1px solid #f0f0f0",
              background: "#fafafa",
              flexShrink: 0,
            }}
          >
            <Space size="small" wrap>
              <Tag color={NODE_COLORS.job}>岗位</Tag>
              <Tag color={NODE_COLORS.task}>核心任务 {tasks.length}</Tag>
              <Tag color={NODE_COLORS.ability}>能力点 {abilities.length}</Tag>
              <Tag color={NODE_COLORS.knowledge}>知识点 {links.length}</Tag>
            </Space>
            <div style={{ flex: 1 }} />
            <Input
              prefix={<SearchOutlined />}
              placeholder="搜索节点..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: isMobile ? "100%" : 180 }}
              allowClear
              size="small"
            />
            <Select
              allowClear
              placeholder="按任务过滤"
              style={{ width: isMobile ? "100%" : 160 }}
              value={filterTaskId}
              onChange={setFilterTaskId}
              options={tasks.map((t) => ({ value: t.id, label: t.title }))}
              size="small"
            />
            {(searchText || filterTaskId) && (
              <Button size="small" onClick={() => { setSearchText(""); setFilterTaskId(undefined); }}>
                重置
              </Button>
            )}
          </div>
        )}

        {/* 图谱区域 */}
        <div style={{ flex: 1, minHeight: 400, position: "relative", background: "#fff" }}>
          {!jobId && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 48 }}>
              <Empty description="左侧选择专业与岗位以查看能力图谱" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
          {jobId && !graphId && !graphsLoading && graphs.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 48 }}>
              <Empty description="该岗位暂无能力图谱，请联系教师创建" />
            </div>
          )}
          {graphsLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Spin />
            </div>
          )}
          {vizData && vizData.nodes.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", padding: 48 }}>
              <Empty description="图谱暂无数据" />
            </div>
          )}
          {vizData && vizData.nodes.length > 0 && (
            <div ref={chartRef} style={{ width: "100%", height: "100%", minHeight: 520 }} />
          )}
          {!vizData && graphId && tasks.length === 0 && !graphsLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <Spin tip="加载图谱..." />
            </div>
          )}
        </div>
      </div>

      {/* 节点详情抽屉 */}
      <Drawer
        title={
          vizNode
            ? `${({ job: "岗位", task: "核心任务", ability: "能力点", knowledge: "知识点", course: "课程" } as any)[vizNode.rawType] || "详情"} · ${vizNode.name}`
            : "详情"
        }
        open={vizDrawerOpen}
        onClose={() => {
          setVizDrawerOpen(false);
          setVizNode(null);
          setVizKnowledgeId(null);
        }}
        width={isMobile ? "100%" : 480}
      >
        {vizNode && vizNode.rawType !== "knowledge" && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="类型">
              {({ job: "岗位", task: "核心任务", ability: "能力点", course: "课程" } as any)[vizNode.rawType] || vizNode.rawType}
            </Descriptions.Item>
            <Descriptions.Item label="名称">{vizNode.name}</Descriptions.Item>
            {vizNode.rawData?.level && (
              <Descriptions.Item label="等级">{LEVEL_OPTIONS.find((o) => o.value === vizNode.rawData.level)?.label || vizNode.rawData.level}</Descriptions.Item>
            )}
            <Descriptions.Item label="描述">{vizNode.rawData?.description || "暂无描述"}</Descriptions.Item>
          </Descriptions>
        )}
        {vizNode && vizNode.rawType === "knowledge" && vizKnowledgeId && (
          <div>
            <Alert type="info" showIcon message="知识点详情" description="点击下方可查看关联的教学资源" style={{ marginBottom: 12 }} />
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="知识点">{vizNode.name}</Descriptions.Item>
              <Descriptions.Item label="描述">{vizNode.rawData?.description || "暂无描述"}</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 知识点资源面板（复用） */}
      <KnowledgeResourcePanel
        open={vizDrawerOpen && !!vizKnowledgeId && vizNode?.rawType === "knowledge"}
        onClose={() => {
          setVizDrawerOpen(false);
          setVizKnowledgeId(null);
          setVizNode(null);
        }}
        knowledge={
          vizKnowledgeId
            ? {
                id: vizKnowledgeId,
                name: vizNode?.name || "",
                description: vizNode?.rawData?.description || null,
              }
            : null
        }
      />
    </div>
  );
}
