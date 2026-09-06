import React, { useMemo, useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import { Modal, Grid } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from "@ant-design/icons";
import {
  listRelations,
  listExercises,
  listFiles,
  listChapters,
  listKnowledges,
  listQuestions,
  listConnections,
  listMainAbilities,
  listSubAbilities,
  listUserCases,
  buildCSRFHeaders,
} from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

// ===== 图谱类型配置 =====
const GRAPH_TYPES = [
  { id: "tree", label: "树图", color: "#5B8FF9" },
  { id: "circle", label: "环图", color: "#5AD8A6" },
  { id: "knowledge", label: "层次结构图", color: "#F6BD16" },
  { id: "question", label: "问题图", color: "#D4537E" },
  { id: "ideological", label: "思政图谱", color: "#cf1322" },
  { id: "competency", label: "能力图谱", color: "#722ed1" },
];

// 截断文字，避免溢出
const truncate = (s: string | null | undefined, n: number) => {
  if (!s) return "";
  const v = String(s).trim();
  return v.length > n ? v.slice(0, n) + "…" : v;
};

// ============ 整体图谱渲染组件 ============
// 渲染单个图谱内容的核心组件，根据 graphType 切换数据 + 布局
export const PanoramaGraphInner: React.FC<{
  graphType: string;
  relations?: any[];
  questions?: any[];
  connections?: any[];
  mainAbilities?: any[];
  subAbilities?: any[];
  knowledges?: any[];
  chapters?: any[];
  files?: any[];
  hierarchyData?: any[]; // 嵌套层级（来自 /api/knowledge/hierarchy/nested）
  exercises?: any[];
  userCases?: any[];
  courseName?: string;
  // 渲染尺寸控制
  compact?: boolean; // true => 迷你图（用于网格/单图），false => 详情图（用于全屏/单图大图）
}> = ({
  graphType,
  relations = [],
  questions = [],
  connections = [],
  mainAbilities = [],
  subAbilities = [],
  knowledges = [],
  chapters = [],
  files = [],
  hierarchyData = [],
  exercises = [],
  userCases = [],
  courseName = "",
  chartBgColor = "transparent",
  compact = true,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 章节树（id / title / parentChapterId 构造）
  const chapterTree = useMemo(() => {
    if (!chapters.length) return { roots: [], byId: new Map<string, any>() };
    const byId = new Map<string, any>();
    chapters.forEach((c: any) => byId.set(c.id, { ...c, children: [] as any[] }));
    const roots: any[] = [];
    byId.forEach((c) => {
      if (c.parentChapterId && byId.has(c.parentChapterId)) {
        byId.get(c.parentChapterId).children.push(c);
      } else {
        roots.push(c);
      }
    });
    return { roots, byId };
  }, [chapters]);

  // 知识点按 chapterId 分组
  const knowledgesByChapter = useMemo(() => {
    const map = new Map<string, any[]>();
    knowledges.forEach((k: any) => {
      const cid = k.chapterId || "_root";
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid)!.push(k);
    });
    return map;
  }, [knowledges]);

  // 按 knowledgeType 分组
  const knowledgesByType = useMemo(() => {
    const map: Record<string, any[]> = {
      subject: [],
      knowledge_unit: [],
      knowledge_cell: [],
    };
    knowledges.forEach((k: any) => {
      const t = k.knowledgeType || "knowledge_cell";
      if (!map[t]) map[t] = [];
      map[t].push(k);
    });
    return map;
  }, [knowledges]);

  // 按 questionLevel 分组
  const questionsByLevel = useMemo(() => {
    const map: Record<string, any[]> = { global: [], concept: [], method: [] };
    questions.forEach((q: any) => {
      const lv = q.questionLevel || "concept";
      if (!map[lv]) map[lv] = [];
      map[lv].push(q);
    });
    return map;
  }, [questions]);

  // 初始化 / 销毁
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!chartInstance.current) chartInstance.current = echarts.init(chartRef.current);
    const ro = new ResizeObserver(() => chartInstance.current?.resize());
    ro.observe(chartRef.current);
    return () => {
      ro.disconnect();
    };
  }, [graphType, compact]);

  // 按 graphType 计算 option
  useEffect(() => {
    if (!chartRef.current) return;

    // ★ 问题图谱改用 HTML 渲染，不创建 ECharts 实例以节省资源 ★
    if (graphType === "question") {
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
      return;
    }

    // ★ 修复 ECharts `__edge` 空引用错误 ★
    // 在 graphType 或 compact 变化时彻底 dispose 并重建 chart 实例，
    // 避免 ECharts TreeView2 在不同结构（tree/radial/force 等）间共享内部 edge 引用。
    if (chartInstance.current) {
      chartInstance.current.dispose();
      chartInstance.current = null;
    }
    chartInstance.current = echarts.init(chartRef.current);
    const chart = chartInstance.current;
    if (!chart) return;
    chart.resize();

    const F = compact ? 1 : 2.2; // 尺寸缩放因子
    const nodeBase = (s: number) => Math.round(s * F);
    const fontSize = (s: number) => Math.round(s * Math.max(1, F * 0.9));
    const edgeWidth = compact ? 0.6 : 1.2;
    const edgeOpacity = 0.4;
    const labelShow = true;

    let option: any;

    switch (graphType) {
      case "tree": {
        // ★ 严格照搬 graph-tree.tsx 的 BRANCH_COLORS + LEVEL_STYLES 配色 ★
        const BRANCH_COLORS = [
          { bg: "#e8f0fe", text: "#1a3a6a", border: "#a0c0e8" },
          { bg: "#e6f4ea", text: "#1a4a2a", border: "#80c0a0" },
          { bg: "#f3e8fd", text: "#4a2a6a", border: "#b898d0" },
          { bg: "#fce8ef", text: "#6a2a3a", border: "#d0a0b0" },
          { bg: "#e0f7fa", text: "#1a4a5a", border: "#80c8d8" },
          { bg: "#fff8e1", text: "#5a4010", border: "#d0c080" },
        ];
        const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; fontSize: number; fontWeight: number; radius: number }> = {
          root: { bg: "#f0f4f8", text: "#1a3a5a", border: "#a0b8d0", fontSize: 13, fontWeight: 700, radius: 10 },
          depth_0: { bg: "#e8f0fe", text: "#1a3a6a", border: "#a0c0e8", fontSize: 10, fontWeight: 600, radius: 8 },
          depth_1: { bg: "#f0f5fa", text: "#2a3a4a", border: "#b8c8d8", fontSize: 9, fontWeight: 500, radius: 6 },
          depth_2: { bg: "#f0f8f0", text: "#1a3a10", border: "#a0c8a0", fontSize: 8, fontWeight: 500, radius: 5 },
        };
        const IMPORTANT_BORDER = "#f59e0b";
        const HARD_BORDER = "#ef4444";

        // 构造层级数据：课程 → 一级节点（学科/章节）→ 知识点
        const rootChapters = chapterTree.roots.slice(0, 6);
        // 兜底：如果没有章节数据，用 knowledge subject
        const firstLevel =
          rootChapters.length > 0
            ? rootChapters
            : knowledgesByType.subject.slice(0, 6).map((s: any) => ({ id: s.id, title: s.name }));

        const buildTreeData = (): any => {
          if (firstLevel.length === 0) {
            return {
              name: truncate(courseName, 8) || "课程",
              id: "tree-root",
              depth: -1,
              itemStyle: { color: LEVEL_STYLES.root.bg, borderColor: LEVEL_STYLES.root.border, borderWidth: 1.5 },
              label: { ...LEVEL_STYLES.root, color: LEVEL_STYLES.root.text, show: true, position: "inside" },
              children: [{ name: "暂无数据", depth: 0, itemStyle: { color: "#f5f5f5" }, label: { color: "#999", fontSize: 9, show: true, position: "inside" } }],
            };
          }

          const buildSubTree = (ch: any, depth: number, branchIdx: number): any => {
            const bc = BRANCH_COLORS[branchIdx % BRANCH_COLORS.length];
            const style = depth === 0 ? LEVEL_STYLES.depth_0 : LEVEL_STYLES[`depth_${Math.min(depth, 2)}`];
            const imp = ch.importanceLevel;
            const borderColor = imp === "important" ? IMPORTANT_BORDER : imp === "hard" ? HARD_BORDER : style.border;
            const name = (ch.title || ch.name || "节点").slice(0, 12);

            let children: any[] = [];
            if (depth === 0) {
              // 一级节点：取该章节下的单元/知识点
              const sub = (knowledgesByChapter.get(ch.id) || []).slice(0, 4);
              children = sub.length > 0
                ? sub.map((k: any) => buildSubTree({ id: k.id, title: k.name, importanceLevel: k.importanceLevel }, 1, branchIdx))
                : knowledgesByType.knowledge_unit.slice(0, 3).map((u: any) => buildSubTree({ id: u.id, title: u.name, importanceLevel: u.importanceLevel }, 1, branchIdx));
            } else if (depth === 1) {
              // 二级节点：取该知识点的 cell
              const cells = knowledgesByType.knowledge_cell.slice(0, 2).map((c: any) =>
                buildSubTree({ id: c.id, title: c.name, importanceLevel: c.importanceLevel }, 2, branchIdx)
              );
              children = cells;
            }

            return {
              name,
              id: ch.id,
              depth,
              importanceLevel: imp,
              symbol: "roundRect",
              symbolSize: depth === 0 ? [Math.max(80, name.length * 7 + 16), 24] : [Math.max(60, name.length * 7 + 12), 20],
              itemStyle: { color: style.bg, borderColor, borderWidth: 1.5 },
              label: {
                show: true,
                position: "inside",
                color: style.text,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                formatter: (p: any) => p.name || "",
              },
              children: children.length > 0 ? children : undefined,
            };
          };

          return {
            name: (courseName || "知识树").slice(0, 14),
            id: "tree-root",
            depth: -1,
            symbol: "roundRect",
            symbolSize: [Math.max(100, (courseName || "知识树").length * 9 + 24), 30],
            itemStyle: { color: LEVEL_STYLES.root.bg, borderColor: LEVEL_STYLES.root.border, borderWidth: 2 },
            label: {
              show: true,
              position: "inside",
              color: LEVEL_STYLES.root.text,
              fontSize: LEVEL_STYLES.root.fontSize,
              fontWeight: LEVEL_STYLES.root.fontWeight,
              formatter: (p: any) => p.name || "",
            },
            children: firstLevel.map((c: any, i: number) => buildSubTree(c, 0, i)),
          };
        };

        const treeData = [buildTreeData()];

        option = {
          tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            backgroundColor: "rgba(20,28,48,0.95)",
            borderColor: "rgba(100,120,160,0.35)",
            borderWidth: 1,
            padding: [3, 6],
            textStyle: { color: "rgba(230,235,245,0.92)", fontSize: 10 },
            formatter: (p: any) => p.name || "",
          },
          series: [
            {
              type: "tree",
              data: treeData,
              top: 4,
              bottom: 4,
              left: 4,
              right: 4,
              orient: "LR",
              layout: "orthogonal",
              initialTreeDepth: -1,
              roam: false,
              animation: false,
              expandAndCollapse: false,
              nodeScaleRatio: 0,
              emphasis: { focus: "adjacency" },
              lineStyle: { color: "#b8c0d0", width: 1, curveness: 0.4 },
            },
          ],
          backgroundColor: chartBgColor,
        };
        break;
      }

      case "circle": {
        // ★ 严格照搬 graph-circle.tsx（径向树）★
        const CIRCLE_COLORS = {
          root: "#E8593A",
          level1: ["#4a90e2", "#27ae60", "#9b59b6", "#e74c5e"],
          important: "#f39c12",
          hard: "#e74c5e",
        };
        const BASE_FONT_SIZES = { root: 24, depth0: 14, depth1: 15 };

        // 使用 hierarchyData（与 graph-circle.tsx 同源）作为数据源
        // ★ 限制首层节点数量，避免环图过于拥挤 ★
        const filteredHierarchy = (hierarchyData || [])
          .filter(
            (s: any) =>
              (s.childUnits && s.childUnits.length) || (s.childCells && s.childCells.length)
          )
          .slice(0, compact ? 6 : 10);

        // buildNode 严格按 graph-circle.tsx 的递归逻辑
        // ★ 仅构建 root + depth 1 两层，不再递归 depth 2+，确保环图只展示首层章节节点 ★
        const buildCircleNode = (kr: any, depth: number, colorIdx: number, inheritedColor?: string): any => {
          if (depth > 1) {
            // 防御性兜底：理论上不会到这里（外层调用已限制）
            return null;
          }

          const children: any[] = [];
          let color: string;
          if (depth === 0) {
            color = CIRCLE_COLORS.root;
          } else {
            // depth === 1
            color = CIRCLE_COLORS.level1[colorIdx % CIRCLE_COLORS.level1.length];
            const imp = kr.importanceLevel;
            if (imp === "important") color = CIRCLE_COLORS.important;
            else if (imp === "hard") color = CIRCLE_COLORS.hard;
          }

          // 只在 root（depth 0）递归挂载子节点，depth 1 节点不再扩展任何 children
          if (depth === 0) {
            if (kr.childUnits) kr.childUnits.forEach((u: any) => children.push(buildCircleNode(u, depth + 1, colorIdx, color)));
            if (kr.childCells) kr.childCells.forEach((c: any) => children.push(buildCircleNode(c, depth + 1, colorIdx, color)));
            if (kr.nestedChildCells) kr.nestedChildCells.forEach((c: any) => children.push(buildCircleNode(c, depth + 1, colorIdx, color)));
          }

          const name = (kr.name || "").length > 14 ? kr.name.slice(0, 14) + ".." : kr.name || "节点";

          return {
            name,
            id: kr.id,
            knowledgeData: kr,
            depth,
            children: children.length ? children : undefined,
            symbol: depth === 1 ? "roundRect" : "circle",
            symbolSize: depth === 0 ? (compact ? 50 : 115) : compact ? [44, 24] : [70, 45],
            itemStyle: {
              color,
              borderColor: "#fff",
              borderWidth: compact ? 2 : 3,
              shadowBlur: compact ? 8 : 12,
              shadowColor: `${color}66`,
            },
            // 根与 depth=1 节点自己配置 label 覆盖默认隐藏
            label: depth === 1
              ? {
                  show: true,
                  position: "inside",
                  color: "rgba(220,225,240,0.92)",
                  fontSize: compact ? 8 : 12,
                  fontWeight: 700,
                  rotate: 0,
                  textBorderColor: "rgba(255,255,255,0.7)",
                  textBorderWidth: 2,
                  formatter: (p: any) => p?.name || "",
                }
              : {
                  show: true,
                  position: "inside",
                  color: "#ffffff",
                  fontWeight: 800,
                  rotate: 0,
                  textBorderColor: "rgba(180,40,20,0.6)",
                  textBorderWidth: 3,
                  textShadowColor: "rgba(0,0,0,0.25)",
                  textShadowBlur: 6,
                  fontSize: compact ? 10 : 24,
                  formatter: (p: any) => p?.name || "",
                },
            emphasis: { focus: "none", label: { show: true, formatter: (p: any) => p?.name || "" } },
          };
        };

        // 构造 treeData：根节点 = 课程
        let treeData: any[] = [];
        if (filteredHierarchy.length > 0) {
          treeData = [
            {
              name: (courseName || "知识图谱").slice(0, 20),
              id: "circle-root",
              knowledgeData: { id: "circle-root", name: courseName || "知识图谱", knowledgeType: "subject", courseId: "" },
              children: filteredHierarchy.map((s: any, i: number) => buildCircleNode(s, 1, i)),
              symbol: "circle",
              symbolSize: compact ? 50 : 115,
              itemStyle: {
                color: CIRCLE_COLORS.root,
                borderColor: "#FF8C6B",
                borderWidth: compact ? 2 : 4,
                shadowBlur: compact ? 12 : 35,
                shadowColor: "rgba(232,89,58,0.6)",
              },
              label: {
                show: true,
                position: "inside",
                color: "#ffffff",
                fontWeight: 800,
                rotate: 0,
                textBorderColor: "rgba(180,40,20,0.6)",
                textBorderWidth: 3,
                textShadowColor: "rgba(0,0,0,0.25)",
                textShadowBlur: 6,
                fontSize: compact ? 10 : 24,
                formatter: (p: any) => p?.name || "",
              },
              emphasis: { focus: "none", label: { show: true, position: "inside", formatter: (p: any) => p?.name || "" } },
            },
          ];
        } else {
          // 无数据兜底
          treeData = [
            {
              name: courseName || "暂无数据",
              id: "circle-root",
              symbol: "circle",
              symbolSize: compact ? 50 : 100,
              itemStyle: { color: "#ccc" },
              label: { show: true, position: "inside", color: "rgba(180,190,210,0.7)", fontSize: compact ? 10 : 18, fontWeight: 700 },
              children: [{ name: "暂无节点", symbol: "circle", symbolSize: compact ? 18 : 35, itemStyle: { color: "rgba(255,255,255,0.15)" }, label: { show: true, position: "right", color: "rgba(180,190,210,0.6)", fontSize: compact ? 7 : 12 } }],
            },
          ];
        }

        // 字体缩放：compact 模式统一调小，detail 模式保持原参考值
        const labelFontSize = compact ? 7 : Math.max(8, Math.round(BASE_FONT_SIZES.depth1));
        const rootFontSize = compact ? 10 : Math.max(14, BASE_FONT_SIZES.root);

        option = {
          backgroundColor: chartBgColor,
          tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            backgroundColor: "rgba(20,28,48,0.95)",
            borderColor: "rgba(100,120,160,0.35)",
            borderWidth: 1,
            padding: [4, 8],
            textStyle: { color: "rgba(230,235,245,0.92)", fontSize: 10 },
            formatter: (params: any) => {
              if (!params.data?.knowledgeData) return params.name || "";
              const kd = params.data.knowledgeData;
              const types: Record<string, string> = { subject: "学科", knowledge_unit: "知识单元", knowledge_cell: "知识点" };
              let html = `<div style="font-weight:600">${kd.name}</div>`;
              html += `<div style="color:#666;font-size:10px">${types[kd.knowledgeType] || kd.knowledgeType}</div>`;
              return html;
            },
          },
          series: [
            {
              type: "tree",
              data: treeData,
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              layout: "radial",
              roam: false,
              // ★ 只显示根 + 第一级（depth 1），不展开第二级★
              initialTreeDepth: 1,
              expandAndCollapse: false,
              nodeScaleRatio: 0.15,
              animation: false,
              emphasis: { focus: "none" },
              lineStyle: { color: "#c0c0c0", width: compact ? 1 : 2, curveness: 0.5 },
              label: { show: false },
              // ★ 严格照搬 graph-circle.tsx 的 labelLayout：根/depth=1 保持水平，其余按径向旋转
              labelLayout: (params: any) => {
                if (!params.rect) return { hideOverlap: true };
                const chartEl = chartRef.current;
                if (!chartEl) return { hideOverlap: true };
                const cx = chartEl.clientWidth / 2;
                const cy = chartEl.clientHeight / 2;
                const lx = params.rect.x + params.rect.width / 2;
                const ly = params.rect.y + params.rect.height / 2;
                const rad = Math.atan2(ly - cy, lx - cx);
                const deg = (rad * 180) / Math.PI;
                if (Math.abs(lx - cx) < 10 && Math.abs(ly - cy) < 10) {
                  return { rotation: 0, hideOverlap: false };
                }
                if (params.data && params.data.depth === 1) {
                  return { rotation: 0, hideOverlap: false };
                }
                const rotation = lx < cx ? deg + 180 : deg;
                return { rotation, hideOverlap: false };
              },
              leaves: {
                label: {
                  show: true,
                  distance: compact ? 4 : 18,
                  color: "rgba(220,225,240,0.92)",
                  fontSize: labelFontSize,
                  fontWeight: 600,
                },
              },
            },
          ],
        };
        // rootFontSize 引用占位（保留与参考一致的命名以备缩放逻辑扩展）
        void rootFontSize;
        break;
      }

      case "knowledge": {
        // ★ 严格照搬 graph-knowledge.tsx ★
        // 数据源：只从 relations 派生节点和边
        // categories：按 relationType.displayName 分组，defaultColors 8 色轮询
        // 节点大小：importanceLevel → hard=35 / important=28 / normal=20 / simple=15
        // 节点颜色：所属关系类型的颜色
        const KNOWLEDGE_DEFAULT_COLORS = ["#5470c6", "#91cc75", "#fac858", "#ee6666", "#73c0de", "#3ba272", "#fc8452", "#9a60b4"];
        const KNOWLEDGE_TYPES: Record<string, string> = {
          subject: "学科",
          knowledge_unit: "知识单元",
          knowledge_cell: "知识点",
        };
        const IMPORTANCE_LEVELS: Record<string, string> = {
          normal: "一般",
          important: "重点",
          hard: "难点",
        };

        const getImportanceSize = (imp?: string | null): number => {
          if (!imp) return 20;
          switch (imp.toLowerCase()) {
            case "hard": return 35;
            case "important": return 28;
            case "normal": return 20;
            case "simple":
            case "easy": return 15;
            default: return 20;
          }
        };

        // 第一遍：扫一遍 relations 收集所有不重复的 relationType，作为 categories
        const rtMap = new Map<string, string>();
        relations.forEach((r: any) => {
          const key = r.relationType?.displayName || r.relationType?.name || "其他关系";
          if (!rtMap.has(key)) {
            rtMap.set(key, KNOWLEDGE_DEFAULT_COLORS[rtMap.size % KNOWLEDGE_DEFAULT_COLORS.length]);
          }
        });
        const categories: { name: string; itemStyle: { color: string } }[] = Array.from(
          rtMap.entries()
        ).map(([name, color]) => ({ name, itemStyle: { color } }));
        const getCategoryIdx = (r: any) =>
          categories.findIndex(
            (c) => c.name === (r.relationType?.displayName || r.relationType?.name || "其他关系")
          );

        // 第二遍：从 relations 中派生 nodes（每个唯一 knowledge id 出现一次，颜色取第一次出现的关系类别）
        const nodesMap = new Map<string, any>();
        const linksArr: any[] = [];
        const slicedRelations = relations.slice(0, compact ? 40 : 200);
        slicedRelations.forEach((r: any) => {
          const idx = Math.max(0, getCategoryIdx(r));
          const edgeColor = categories[idx]?.itemStyle.color || KNOWLEDGE_DEFAULT_COLORS[0];

          if (r.sourceKnowledge && !nodesMap.has(r.sourceKnowledgeId)) {
            const k = r.sourceKnowledge;
            nodesMap.set(r.sourceKnowledgeId, {
              id: r.sourceKnowledgeId,
              name: (k.name || "节点").slice(0, 10),
              category: idx,
              symbolSize: Math.max(
                6,
                Math.round(getImportanceSize(k.importanceLevel) * (compact ? 0.5 : 1))
              ),
              value: k.importanceLevel || "normal",
              itemStyle: { color: edgeColor, borderColor: "#fff", borderWidth: 2 },
              knowledgeData: k,
            });
          } else if (r.sourceKnowledge && nodesMap.has(r.sourceKnowledgeId)) {
            // 已存在：若新关系类型索引更靠前则升级 category
            const existing = nodesMap.get(r.sourceKnowledgeId);
            if (idx < existing.category) {
              existing.category = idx;
              existing.itemStyle.color = edgeColor;
            }
          }

          if (r.targetKnowledge && !nodesMap.has(r.targetKnowledgeId)) {
            const k = r.targetKnowledge;
            nodesMap.set(r.targetKnowledgeId, {
              id: r.targetKnowledgeId,
              name: (k.name || "节点").slice(0, 10),
              category: idx,
              symbolSize: Math.max(
                6,
                Math.round(getImportanceSize(k.importanceLevel) * (compact ? 0.5 : 1))
              ),
              value: k.importanceLevel || "normal",
              itemStyle: { color: edgeColor, borderColor: "#fff", borderWidth: 2 },
              knowledgeData: k,
            });
          } else if (r.targetKnowledge && nodesMap.has(r.targetKnowledgeId)) {
            const existing = nodesMap.get(r.targetKnowledgeId);
            if (idx < existing.category) {
              existing.category = idx;
              existing.itemStyle.color = edgeColor;
            }
          }

          if (r.sourceKnowledge && r.targetKnowledge) {
            linksArr.push({
              source: r.sourceKnowledgeId,
              target: r.targetKnowledgeId,
              lineStyle: {
                color: edgeColor,
                width: compact ? 0.6 : 1.5,
                curveness: 0.1,
                opacity: 0.7,
              },
            });
          }
        });

        const nodes = Array.from(nodesMap.values());

        // 用 category 给所有节点统一染色（确保 ECharts 使用 category 颜色）
        nodes.forEach((n: any) => {
          const cat = categories[n.category];
          if (cat) {
            n.itemStyle = { ...n.itemStyle, color: cat.itemStyle.color };
          }
          // 缩略图关闭标签避免挤；大图开启标签
          n.label = compact
            ? { show: false }
            : {
                show: true,
                position: "right",
                formatter: "{b}",
                fontSize: fontSize(9),
                color: "rgba(220,225,240,0.92)",
              };
        });

        const hasData = nodes.length > 0;

        option = {
          backgroundColor: chartBgColor,
          tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            hideDelay: 100,
            backgroundColor: "rgba(0,0,0,0.8)",
            textStyle: { color: "#fff", fontSize: 11 },
            borderColor: "transparent",
            formatter: (params: any) => {
              if (params.dataType === "node" && params.data?.knowledgeData) {
                const kd = params.data.knowledgeData;
                let html = `<strong>${kd.name}</strong><br/>`;
                html += `类型: ${KNOWLEDGE_TYPES[kd.knowledgeType] || kd.knowledgeType}<br/>`;
                if (kd.subject) html += `主题: ${kd.subject}<br/>`;
                if (kd.unit) html += `单元: ${kd.unit}<br/>`;
                if (kd.importanceLevel) html += `重要程度: ${IMPORTANCE_LEVELS[kd.importanceLevel.toLowerCase()] || kd.importanceLevel}`;
                return html;
              }
              if (params.dataType === "edge") {
                return params.data?.relationData?.relationType?.displayName || "关联";
              }
              return params.name || "";
            },
          },
          series: [
            {
              type: "graph",
              layout: "force",
              data: hasData ? nodes : [{ id: "x", name: "暂无", symbolSize: 14, itemStyle: { color: "#999" } }],
              links: linksArr,
              categories,
              roam: !compact,
              zoom: 1,
              force: {
                // 与 graph-knowledge.tsx 保持一致：repulsion 1000 / edgeLength 150
                // 缩略图按比例缩小
                repulsion: compact ? 200 : 1000,
                gravity: 0.1,
                edgeLength: compact ? 30 : 150,
                layoutAnimation: false,
              },
              draggable: !compact,
              top: 4,
              bottom: 4,
              left: 4,
              right: 4,
              label: {
                show: true,
                position: "right",
                formatter: "{b}",
                fontSize: fontSize(8),
                color: "rgba(220,225,240,0.92)",
              },
              labelLayout: { hideOverlap: false, moveOverlap: "shiftY" },
              emphasis: {
                focus: "adjacency",
                label: { show: true, fontSize: fontSize(9), fontWeight: "bold", color: "rgba(220,225,240,0.92)" },
                lineStyle: { width: 2, opacity: 0.8 },
              },
              // 与 graph-knowledge.tsx 一致：箭头方向
              lineStyle: { color: "source", curveness: 0.1, opacity: 0.7 },
              edgeSymbol: ["none", "arrow"],
              edgeSymbolSize: [0, compact ? 4 : 8],
            },
          ],
        };
        break;
      }

      case "question": {
        // ★ 问题图谱改用纯 HTML/CSS 渲染（不依赖 ECharts 节点定位） ★
        // 原因：ECharts `layout: "none"` 下 `x: "18%"` 百分比定位不可靠
        // 这里只给 ECharts 一个空 option，让 HTML 层接管可视化
        option = { series: [], backgroundColor: chartBgColor };
        break;
      }

      case "ideological": {
        // ★ 严格照搬 graph-ideological/IdeologicalGraphChart.tsx + useGraphData.ts 数据结构 ★
        // 数据：tag.includes("课程思政") 的知识点（红）+ 思政案例（橙）+ 知识点之间关系（蓝）
        const ideologicalKnowledges = knowledges.filter(
          (k: any) => k.tag && String(k.tag).includes("课程思政")
        );
        const nodes: any[] = [];
        const links: any[] = [];
        const nodeIds = new Set<string>();

        // 知识点节点（红色 #ef5350，symbolSize 50/32）
        ideologicalKnowledges.slice(0, compact ? 6 : 12).forEach((k: any) => {
          const nid = String(k.id);
          if (nodeIds.has(nid)) return;
          nodeIds.add(nid);
          nodes.push({
            id: nid,
            name: truncate(k.name, 10),
            description: k.description,
            category: 0,
            symbolSize: compact ? 16 : 50,
            itemStyle: { color: "#ef5350", borderColor: "#fff", borderWidth: 2 },
            label: { show: true, fontSize: fontSize(10), color: "rgba(220,225,240,0.92)" },
          });
        });

        // 思政案例节点（橙色 #ff9800，symbolSize 40/24）
        userCases.slice(0, compact ? 6 : 12).forEach((c: any) => {
          const cid = String(c.id);
          if (nodeIds.has(cid)) return;
          nodeIds.add(cid);
          nodes.push({
            id: cid,
            name: truncate(c.title, 10),
            category: 1,
            symbolSize: compact ? 12 : 40,
            itemStyle: { color: "#ff9800", borderColor: "#fff", borderWidth: 2 },
            label: { show: true, fontSize: fontSize(9), color: "rgba(220,225,240,0.92)" },
          });
          // 案例 → 知识点 边（灰色 #999）
          if (c.knowledgeResourceId) {
            const kid = String(c.knowledgeResourceId);
            if (nodeIds.has(kid)) {
              links.push({
                source: cid,
                target: kid,
                lineStyle: { color: "#999", width: compact ? 0.8 : 2, opacity: 0.6, curveness: 0.2 },
              });
            }
          }
        });

        // 知识点之间的边（蓝色 #5470c6）
        relations.forEach((r: any) => {
          const sid = String(r.sourceKnowledgeId);
          const tid = String(r.targetKnowledgeId);
          if (nodeIds.has(sid) && nodeIds.has(tid) && sid !== tid) {
            const name = r.relationType?.displayName || r.relationType?.name || "关联";
            links.push({
              source: sid,
              target: tid,
              name,
              relationData: { relationName: name },
              lineStyle: { color: "#5470c6", width: compact ? 0.8 : 2, opacity: 0.8, curveness: 0.1 },
            });
          }
        });

        const categories = [
          { name: "思政知识点", itemStyle: { color: "#ef5350" } },
          { name: "思政案例", itemStyle: { color: "#ff9800" } },
        ];

        const hasData = nodes.length > 0;
        if (!hasData) {
          nodes.length = 0;
          links.length = 0;
          nodes.push({ id: "x", name: "暂无思政数据", symbolSize: 14, itemStyle: { color: "#999" } });
        }

        option = {
          backgroundColor: chartBgColor,
          tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            backgroundColor: "rgba(0,0,0,0.8)",
            textStyle: { color: "#fff", fontSize: 11 },
            borderColor: "transparent",
            formatter: (params: any) => {
              if (params.dataType === "node") {
                const data = params.data;
                const cat = data.category !== undefined ? categories[data.category]?.name : "";
                return `<strong>${data.name}</strong><br/><span style="color:#ddd;font-size:10px">${cat}</span>`;
              }
              if (params.dataType === "edge") {
                return params.data?.relationData?.relationName || "关联";
              }
              return params.name || "";
            },
          },
          series: [
            {
              id: "ideological-graph",
              type: "graph",
              layout: "force",
              data: nodes,
              links,
              categories,
              roam: false,
              force: {
                repulsion: compact ? 120 : 1000,
                gravity: 0.1,
                edgeLength: compact ? 25 : 150,
                layoutAnimation: false,
              },
              draggable: false,
              top: 4,
              bottom: 4,
              left: 4,
              right: 4,
              label: {
                show: true,
                position: "right",
                formatter: (params: any) => params.data?.name || params.name,
                fontSize: fontSize(9),
                color: "rgba(220,225,240,0.92)",
              },
              labelLayout: { hideOverlap: true },
              emphasis: {
                focus: "adjacency",
                label: { show: true, fontSize: fontSize(10), fontWeight: "bold", color: "rgba(220,225,240,0.92)" },
                lineStyle: { width: 2, opacity: 0.8 },
              },
              lineStyle: { color: "source", curveness: 0.3, opacity: 0.6 },
              edgeSymbol: ["none", "arrow"],
              edgeSymbolSize: [0, compact ? 4 : 8],
            },
          ],
        };
        break;
      }

      case "competency": {
        // ★ 严格照搬 graph-competency.tsx 配色 + 节点大小 + 支撑层级连线 ★
        // 主能力 #5470c6 / 40px；子能力 #91cc75 / 30px；知识点 #fac858 / 20px
        // 边：主→子 #5470c6/2/0.6；子→知 primary:#722ed1/3/0.75, secondary:#13c2c2/2/0.7, practice:#91cc75/1.5/0.6
        const MAIN_COLOR = "#5470c6";
        const SUB_COLOR = "#91cc75";
        const KNOW_COLOR = "#fac858";

        // 支撑层级连线配色
        const supportLineConfig: Record<string, { width: number; color: string; opacity: number }> = {
          primary: { width: 3, color: "#722ed1", opacity: 0.75 },
          secondary: { width: 2, color: "#13c2c2", opacity: 0.7 },
          practice: { width: 1.5, color: "#91cc75", opacity: 0.6 },
        };
        const defaultSupportStyle = { width: 1.5, color: "#91cc75", opacity: 0.5 };
        const getSupportStyle = (level?: string | null) => supportLineConfig[level || ""] || defaultSupportStyle;

        // 节点/边尺寸系数
        const SIZE_FACTOR = compact ? 0.5 : 1;

        const nodes: any[] = [];
        const links: any[] = [];
        const nodeIds = new Set<string>();

        const subMap = new Map<string, any[]>();
        subAbilities.forEach((s: any) => {
          const mid = s.mainAbilityId;
          if (!subMap.has(mid)) subMap.set(mid, []);
          subMap.get(mid)!.push(s);
        });

        const mainLimit = compact ? 3 : 6;
        const subLimit = compact ? 2 : 3;
        const knowLimit = compact ? 2 : 3;
        const mainLimitList = mainAbilities.slice(0, mainLimit);
        const hasData = mainLimitList.length > 0;

        mainLimitList.forEach((m: any) => {
          const mid = String(m.id);
          if (nodeIds.has(mid)) return;
          nodeIds.add(mid);
          nodes.push({
            id: mid,
            name: (m.name || "主能力").slice(0, 10),
            category: 0,
            symbolSize: Math.max(10, Math.round(40 * SIZE_FACTOR)),
            itemStyle: { color: MAIN_COLOR, borderColor: "#fff", borderWidth: 3 },
            label: {
              show: true,
              fontSize: fontSize(10),
              color: "rgba(220,225,240,0.92)",
              fontWeight: "bold",
            },
          });

          const subs = (subMap.get(m.id) || []).slice(0, subLimit);
          subs.forEach((s: any) => {
            const sid = String(s.id);
            if (nodeIds.has(sid)) return;
            nodeIds.add(sid);
            nodes.push({
              id: sid,
              name: (s.name || "子能力").slice(0, 10),
              category: 1,
              symbolSize: Math.max(8, Math.round(30 * SIZE_FACTOR)),
              itemStyle: { color: SUB_COLOR, borderColor: "#fff", borderWidth: 2 },
              label: { show: true, fontSize: fontSize(9), color: "rgba(220,225,240,0.92)" },
            });
            // 主→子 边
            links.push({
              source: mid,
              target: sid,
              lineStyle: { color: MAIN_COLOR, width: 1, opacity: 0.6, curveness: 0.1 },
            });

            const ks = (s.knowledgeResources || []).slice(0, knowLimit);
            ks.forEach((k: any) => {
              const kid = String(k.id);
              if (nodeIds.has(kid)) return;
              nodeIds.add(kid);
              nodes.push({
                id: kid,
                name: (k.name || "知识点").slice(0, 8),
                category: 2,
                symbolSize: Math.max(6, Math.round(20 * SIZE_FACTOR)),
                itemStyle: { color: KNOW_COLOR, borderColor: "#fff", borderWidth: 2 },
                label: { show: true, fontSize: fontSize(8), color: "rgba(220,225,240,0.92)" },
              });
              // 子→知 边（按 supportLevel 配色；无数据时用默认）
              const supportLevel = s.supportLevel || "primary";
              const style = getSupportStyle(supportLevel);
              links.push({
                source: sid,
                target: kid,
                lineStyle: {
                  color: style.color,
                  width: compact ? 1 : Math.max(1, style.width - 1),
                  opacity: style.opacity,
                  curveness: 0.2,
                },
                supportLevel,
              });
            });
          });
        });

        if (!hasData) {
          nodes.length = 0;
          links.length = 0;
          nodes.push({ id: "x", name: "暂无", symbolSize: 12, itemStyle: { color: "#999" } });
        }

        option = {
          backgroundColor: chartBgColor,
          tooltip: {
            trigger: "item",
            triggerOn: "mousemove",
            backgroundColor: "rgba(0,0,0,0.8)",
            textStyle: { color: "#fff", fontSize: 11 },
            borderColor: "transparent",
            formatter: (params: any) => {
              if (params.dataType === "node") return params.data?.name || "";
              if (params.dataType === "edge") {
                const lv = params.data?.supportLevel;
                if (lv) return `支撑层级: ${lv === "primary" ? "主支撑" : lv === "secondary" ? "次支撑" : "实践"}`;
                return "能力关联";
              }
              return "";
            },
          },
          series: [
            {
              type: "graph",
              layout: "force",
              data: nodes,
              links,
              categories: hasData
                ? [
                    { name: "主能力", itemStyle: { color: MAIN_COLOR } },
                    { name: "子能力", itemStyle: { color: SUB_COLOR } },
                    { name: "知识点", itemStyle: { color: KNOW_COLOR } },
                  ]
                : [],
              roam: false,
              force: {
                repulsion: compact ? 70 : 140,
                gravity: 0.1,
                edgeLength: compact ? 16 : 28,
                layoutAnimation: false,
              },
              draggable: false,
              top: 4,
              bottom: 4,
              left: 4,
              right: 4,
              label: {
                show: true,
                position: "right",
                formatter: "{b}",
                fontSize: fontSize(9),
                color: "rgba(220,225,240,0.92)",
              },
              labelLayout: { hideOverlap: false, moveOverlap: "shiftY" },
              emphasis: {
                focus: "adjacency",
                label: { show: true, fontSize: fontSize(10), fontWeight: "bold", color: "rgba(220,225,240,0.92)" },
                lineStyle: { width: 2, opacity: 0.8 },
              },
              lineStyle: { color: "source", curveness: 0.2, opacity: 0.7 },
            },
          ],
        };
        break;
      }

      default:
        option = { series: [], backgroundColor: chartBgColor };
    }

    chart.setOption(option, true);
  }, [
    graphType,
    relations,
    questions,
    connections,
    mainAbilities,
    subAbilities,
    knowledges,
    hierarchyData,
    chapters,
    files,
    exercises,
    userCases,
    courseName,
    compact,
    chapterTree,
    knowledgesByChapter,
    knowledgesByType,
    questionsByLevel,
  ]);

  // 问题图谱用纯 HTML/CSS 渲染（不依赖 ECharts 节点定位）
  // 与 graph-question.tsx 中的 3 列布局对齐：global | concept | method
  const renderQuestionHtml = () => {
    if (graphType !== "question") return null;
    const levelCfg: Record<string, { color: string; label: string }> = {
      global: { color: "#D4537E", label: "全局" },
      concept: { color: "#5B8FF9", label: "概念" },
      method: { color: "#5AD8A6", label: "方法" },
    };
    const PER_LEVEL = compact ? 3 : 5;
    const totalQuestions =
      questionsByLevel.global.length + questionsByLevel.concept.length + questionsByLevel.method.length;

    if (totalQuestions === 0) {
      return (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
            fontSize: compact ? 11 : 14,
          }}
        >
          暂无问题数据
        </div>
      );
    }

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          inset: 0,
          zIndex: 10,
          background: compact ? "transparent" : "transparent",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: compact ? 4 : 8,
          padding: compact ? 4 : 8,
          pointerEvents: "none",
        }}
      >
        {(["global", "concept", "method"] as const).map((level) => {
          const cfg = levelCfg[level];
          const fullList = questionsByLevel[level] || [];
          const qs = fullList.slice(0, PER_LEVEL);
          const totalCount = fullList.length;
          return (
            <div
              key={level}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: compact ? 4 : 6,
                minWidth: 0,
              }}
            >
              {/* header */}
              <div
                style={{
                  padding: compact ? "3px 6px" : "5px 10px",
                  borderRadius: 4,
                  background: `${cfg.color}22`,
                  border: `1px solid ${cfg.color}55`,
                  color: cfg.color,
                  fontSize: compact ? 10 : 12,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {cfg.label} · {totalCount}
              </div>
              {/* question cards */}
              {qs.map((q: any, i: number) => {
                // 与 graph-question.tsx 一致：description 通常是问题正文，title 是简略标题
                const displayText =
                  (q.description && String(q.description).trim()) ||
                  (q.title && String(q.title).trim()) ||
                  "（无内容）";
                return (
                  <div
                    key={q.id || i}
                    title={q.description || q.title || ""}
                    style={{
                      padding: compact ? "6px 4px" : "8px 10px",
                      borderRadius: 6,
                      background: cfg.color,
                      color: "#fff",
                      fontSize: compact ? 9 : 12,
                      fontWeight: 500,
                      textAlign: "center",
                      boxShadow: `0 2px 6px ${cfg.color}40`,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minHeight: compact ? 22 : 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {truncate(displayText, compact ? 10 : 16)}
                  </div>
                );
              })}
              {qs.length === 0 && (
                <div
                  style={{
                    color: "#bbb",
                    fontSize: compact ? 9 : 11,
                    textAlign: "center",
                    padding: compact ? "8px 0" : "12px 0",
                  }}
                >
                  —
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      {/* ECharts 容器：仅在非问题图谱时显示（避免与 React DOM 操作冲突） */}
      <div
        ref={chartRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          width: "100%",
          height: "100%",
          display: graphType === "question" ? "none" : "block",
        }}
      />
      {/* 问题图谱：纯 HTML 层，与 ECharts 完全隔离防止 removeChild 冲突 */}
      {renderQuestionHtml()}
    </div>
  );
};

// ===== 全景图谱主组件 =====
interface PanoramaGraphProps {
  courseId: string;
  tenant: string;
  user: any;
  courseName: string;
  /** 初始定位的图谱类型 id（tree/circle/knowledge/question/ideological/competency），默认 tree */
  initialGraphId?: string;
  /** 挂载后是否立即进入全景（Modal）模式 */
  initialOpen?: boolean;
  /** 全景模式关闭回调（供外部同步关闭状态/卸载组件） */
  onPanoramaClose?: () => void;
  /** 传入后在全景标题栏显示"进入详情页"按钮 */
  onOpenDetail?: () => void;
  /**
   * 与 /dashboard/front 课程详情页同步的全景背景色（来自课程的 colorTheme）
   * 不传则用 is-blue 主题的兜底深蓝色 #132036 → #0f1a2b。
   */
  themeOverlayStart?: string; // e.g. "rgba(14, 22, 35, 0.84)"
  themeOverlayEnd?: string; // e.g. "rgba(35, 49, 70, 0.7)"
  /**
   * 课程详情页底色基线（.front-dashboard-page 的 CSS gradient 端点）
   * 不传则兜底 "#132036" → "#0f1a2b"
   */
  themeBaseStart?: string;
  themeBaseEnd?: string;
}

export default function PanoramaGraph({
  courseId,
  tenant,
  user,
  courseName,
  initialGraphId,
  initialOpen,
  onPanoramaClose,
  onOpenDetail,
  themeOverlayStart,
  themeOverlayEnd,
  themeBaseStart,
  themeBaseEnd,
}: PanoramaGraphProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  // 挂载时按 initialGraphId 定位初始图谱；配合外部 key 重挂载实现每次打开重新定位
  const initialTypeIndex = Math.max(
    0,
    GRAPH_TYPES.findIndex((g) => g.id === (initialGraphId || "tree")),
  );
  const [activeIndex, setActiveIndex] = useState(initialTypeIndex);
  const [panoramaOpen, setPanoramaOpen] = useState(Boolean(initialOpen));
  // 全景打开时直接聚焦到初始图谱类型的大图（“更具体的内容”），可返回网格切换
  const [focusType, setFocusType] = useState<string | null>(
    initialOpen && initialGraphId ? initialGraphId : null,
  );

  // ===== 数据查询 =====
  const { data: relationsReq } = useQuery({
    queryKey: ["panorama-relations", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listRelations({
        tenant,
        input: {},
        fields: [
          "id",
          "relationTypeId",
          "sourceKnowledgeId",
          "targetKnowledgeId",
          {
            relationType: ["id", "name", "displayName", "description"],
          },
          {
            sourceKnowledge: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "importanceLevel",
              "description",
            ],
          },
          {
            targetKnowledge: [
              "id",
              "name",
              "knowledgeType",
              "subject",
              "unit",
              "importanceLevel",
              "description",
            ],
          },
        ],
        filter: {
          or: [
            { sourceKnowledge: { courseId: { eq: courseId } } },
            { targetKnowledge: { courseId: { eq: courseId } } },
          ],
        },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: exercisesReq } = useQuery({
    queryKey: ["panorama-exercises", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listExercises({
        tenant,
        fields: ["id", "title"],
        filter: { courseId: { eq: courseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: filesReq } = useQuery({
    queryKey: ["panorama-files", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listFiles({
        tenant,
        fields: ["id", "filename", "fileType", "purpose"],
        filter: { courseId: { eq: courseId } },
        page: { limit: 80, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: chaptersReq } = useQuery({
    queryKey: ["panorama-chapters", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listChapters({
        tenant,
        fields: ["id", "title", "parentChapterId"],
        filter: { courseId: { eq: courseId } },
        page: { limit: 100, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: knowledgesReq } = useQuery({
    queryKey: ["panorama-knowledges", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listKnowledges({
        tenant,
        fields: [
          "id",
          "name",
          "knowledgeType",
          "subject",
          "unit",
          "tag",
          "chapterId",
          "parentSubjectId",
          "parentUnitId",
          "parentKnowledgeResourceId",
          "importanceLevel",
        ],
        filter: { courseId: { eq: courseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: questionsReq } = useQuery({
    queryKey: ["panorama-questions", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listQuestions({
        tenant,
        // 与 graph-question.tsx 同源：description 通常是问题正文（而非短标题）
        fields: [
          "id",
          "title",
          "description",
          "questionLevel",
          "tags",
          "knowledgeResourceId",
          {
            knowledgeResource: [
              "id",
              "name",
              "description",
              "importanceLevel",
              "knowledgeType",
            ],
          },
        ],
        filter: { courseId: { eq: courseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: connectionsReq } = useQuery({
    queryKey: ["panorama-connections", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listConnections({
        tenant,
        fields: ["id", "sourceQuestionId", "targetQuestionId", "connectionType"],
        filter: { courseId: { eq: courseId } },
        page: { limit: 60, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const { data: mainAbilitiesReq } = useQuery({
    queryKey: ["panorama-main-abilities", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await listMainAbilities({
        tenant,
        fields: ["id", "name", "description"],
        filter: { courseId: { eq: courseId } },
        page: { limit: 30, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId,
    retry: 1,
  });

  const mainAbilitiesData = (mainAbilitiesReq as any[]) || [];
  const mainAbilityIds = useMemo(
    () => mainAbilitiesData.map((ma: any) => ma.id),
    [mainAbilitiesData]
  );

  const { data: subAbilitiesReq } = useQuery({
    queryKey: ["panorama-sub-abilities", courseId, tenant, mainAbilityIds],
    queryFn: async () => {
      if (!courseId || mainAbilityIds.length === 0) return [];
      const result = await listSubAbilities({
        tenant,
        fields: ["id", "name", "mainAbilityId", { knowledgeResources: ["id", "name", "knowledgeType"] }],
        filter: { mainAbilityId: { in: mainAbilityIds } },
        page: { limit: 60, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!courseId && mainAbilityIds.length > 0,
    retry: 1,
  });

  // 嵌套层级（与 graph-circle.tsx 同源）
  const { data: hierarchyReq } = useQuery({
    queryKey: ["panorama-hierarchy", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      try {
        const tenantSchema = (getCurrentTenant() as any)?.schemaName || tenant;
        const response = await fetch(
          `/api/knowledge/hierarchy/nested?course_id=${courseId}&tenant=${tenantSchema}`,
          { headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } }
        );
        if (!response.ok) return [];
        const result = await response.json();
        if (result.success) return Array.isArray(result.data) ? result.data : [];
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!courseId,
    retry: 1,
  });

  // 思政案例（与 graph-ideological 同源）
  const { data: userCasesReq } = useQuery({
    queryKey: ["panorama-user-cases", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return [];
      try {
        const result = await listUserCases({
          tenant,
          fields: [
            "id",
            "title",
            "description",
            "content",
            "caseRelationName",
            "knowledgeResourceId",
            { knowledgeResource: ["id", "name", "courseId", "tag"] },
          ],
          filter: {
            knowledgeResource: { courseId: { eq: courseId } },
          },
          headers: user ? getHeaders(user) : undefined,
        });
        return result.success ? extractArrayData(result) : [];
      } catch {
        return [];
      }
    },
    enabled: !!courseId,
    retry: 1,
  });

  const relationsData: any[] = (relationsReq as any[]) || [];
  const exercisesData: any[] = (exercisesReq as any[]) || [];
  const filesData: any[] = (filesReq as any[]) || [];
  const userCasesData: any[] = (userCasesReq as any[]) || [];
  const chaptersData: any[] = (chaptersReq as any[]) || [];
  const knowledgesData: any[] = (knowledgesReq as any[]) || [];
  const questionsData: any[] = (questionsReq as any[]) || [];
  const connectionsData: any[] = (connectionsReq as any[]) || [];
  const subAbilitiesData: any[] = (subAbilitiesReq as any[]) || [];
  const hierarchyData: any[] = (hierarchyReq as any[]) || [];

  const currentGraph = GRAPH_TYPES[activeIndex];

  const goPrev = () => setActiveIndex((i) => (i - 1 + GRAPH_TYPES.length) % GRAPH_TYPES.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % GRAPH_TYPES.length);

  // 键盘左右键（全景展开时禁用切换）
  useEffect(() => {
    if (panoramaOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goPrev();
        e.preventDefault();
      }
      if (e.key === "ArrowRight") {
        goNext();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panoramaOpen]);

  // 由 colorTheme 推导出"与课程详情页一致"的全景背景渐变
  // 默认 fallback 走 is-blue 主题（与 .front-dashboard-page CSS 默认值一致）
  const overlayStart = themeOverlayStart || "rgba(14, 22, 35, 0.84)";
  const overlayEnd = themeOverlayEnd || "rgba(35, 49, 70, 0.7)";
  const baseStart = themeBaseStart || "#132036";
  const baseEnd = themeBaseEnd || "#0f1a2b";
  // 与 /dashboard/front 同源的双层背景：上层 theme overlay、下层 base gradient
  const panoramaBgImage = `linear-gradient(180deg, ${overlayStart} 0%, ${overlayEnd} 100%), linear-gradient(180deg, ${baseStart} 0%, ${baseEnd} 100%)`;
  const panoramaBgColor = baseStart;
  const innerBgImage = panoramaBgImage;
  const innerBgColor = baseStart;

  // 共享的数据 prop 集合
  const dataProps = {
    relations: relationsData,
    questions: questionsData,
    connections: connectionsData,
    mainAbilities: mainAbilitiesData,
    subAbilities: subAbilitiesData,
    knowledges: knowledgesData,
    chapters: chaptersData,
    files: filesData,
    hierarchyData,
    exercises: exercisesData,
    userCases: userCasesData,
    courseName,
    chartBgColor: "transparent", // 透明背景，继承自父级容器，与页面主题融为一体
  };

  // 关闭全屏焦点模式
  const closeFocus = () => setFocusType(null);

  // 全屏 Modal 关闭
  const handlePanoramaClose = () => {
    setPanoramaOpen(false);
    setFocusType(null);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {!panoramaOpen ? (
        /* ===== 单图谱模式 ===== */
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/10",
            minHeight: isMobile ? 220 : 260,
          }}
        >
          <PanoramaGraphInner graphType={currentGraph.id} {...dataProps} compact />

          {/* 图谱名称浮层 */}
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.45)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              padding: "3px 12px",
              borderRadius: 99,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              backdropFilter: "blur(4px)",
            }}
          >
            {currentGraph.label}
          </div>

          {/* 左右箭头 */}
          <button
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: 4,
              zIndex: 5,
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "var(--front-card-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              backdropFilter: "blur(4px)",
            }}
            onClick={goPrev}
            aria-label="上一个图谱"
          >
            <LeftOutlined />
          </button>
          <button
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              right: 4,
              zIndex: 5,
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "var(--front-card-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              backdropFilter: "blur(4px)",
            }}
            onClick={goNext}
            aria-label="下一个图谱"
          >
            <RightOutlined />
          </button>

          {/* 底部指示点 */}
          <div
            style={{
              position: "absolute",
              bottom: 30,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 3,
              pointerEvents: "none",
            }}
          >
            {GRAPH_TYPES.map((_, i) => (
              <div
                key={i}
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: i === activeIndex ? "#fff" : "rgba(255,255,255,0.3)",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>

          {/* 展开全景按钮：更醒目，靠右上角，带文字 */}
          <button
            onClick={() => setPanoramaOpen(true)}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              zIndex: 5,
              padding: "5px 10px",
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.32)",
              background: "rgba(15, 22, 38, 0.7)",
              color: "#ffffff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: 600,
              backdropFilter: "blur(6px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06) inset",
              transition: "all 0.18s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(40, 60, 100, 0.85)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.55)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(15, 22, 38, 0.7)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.32)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            title="展开全景图谱"
          >
            <FullscreenOutlined style={{ fontSize: 12 }} />
            <span>全屏</span>
          </button>
        </div>
      ) : (
        /* ===== 全景模式（Modal） ===== */
        <Modal
          open={panoramaOpen}
          onCancel={handlePanoramaClose}
          footer={null}
          width="90vw"
          centered
          destroyOnHidden={false}
          styles={{
            body: { padding: 0, background: "transparent", backgroundColor: "transparent" },
            content: {
              // 与 /dashboard/front 课程详情页完全一致：使用 colorTheme 的 overlay + base 双层
              backgroundImage: panoramaBgImage,
              backgroundColor: panoramaBgColor,
              backgroundSize: "cover",
              backgroundPosition: "center top",
              borderRadius: 12,
              overflow: "hidden",
              padding: 0,
            },
            wrapper: { background: "transparent" },
            header: { display: "none" },
            mask: { background: "rgba(8,12,28,0.78)", backdropFilter: "blur(6px)" },
          }}
          closeIcon={null}
        >
          <div
            style={{
              position: "relative",
              padding: isMobile ? 12 : 20,
              minHeight: isMobile ? "60vh" : "70vh",
              backgroundImage: innerBgImage,
              backgroundColor: innerBgColor,
              backgroundSize: "cover",
              backgroundPosition: "center top",
            }}
          >
            {/* 顶部标题栏 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FullscreenOutlined style={{ color: "#fff", fontSize: 16 }} />
                <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>
                  全景图谱 · {courseName || "课程"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {onOpenDetail ? (
                  <button
                    onClick={() => {
                      handlePanoramaClose();
                      onOpenDetail();
                    }}
                    style={{
                      height: 28,
                      padding: "0 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.28)",
                      background: "rgba(255,255,255,0.12)",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 12,
                      fontWeight: 600,
                      backdropFilter: "blur(4px)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.26)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "rgba(255,255,255,0.12)")
                    }
                    title="进入课程详情页"
                  >
                    <RightOutlined style={{ fontSize: 11 }} />
                    <span>进入详情页</span>
                  </button>
                ) : null}
                <button
                  onClick={handlePanoramaClose}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: "none",
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    backdropFilter: "blur(4px)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.3)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  title="收起全景图谱"
                >
                  <FullscreenExitOutlined />
                </button>
              </div>
            </div>

            {!focusType ? (
              /* ===== 3×3 网格模式 ===== */
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                {GRAPH_TYPES.map((gt) => (
                  <div
                    key={gt.id}
                    onClick={() => setFocusType(gt.id)}
                    style={{
                      aspectRatio: isMobile ? "4/3" : "5/4",
                      overflow: "hidden",
                      borderRadius: 8,
                      // 与 /dashboard/front 卡片一致：仿磨砂玻璃渐变
                      background:
                        "linear-gradient(180deg, rgba(33, 44, 61, 0.58) 0%, rgba(21, 31, 45, 0.38) 100%)",
                      border: "1px solid rgba(197, 214, 234, 0.16)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.35)";
                      e.currentTarget.style.borderColor = gt.color;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.borderColor = "rgba(197, 214, 234, 0.16)";
                    }}
                    title={`点击放大 ${gt.label}`}
                  >
                    <PanoramaGraphInner graphType={gt.id} {...dataProps} compact />
                    <span
                      style={{
                        position: "absolute",
                        bottom: 4,
                        left: 0,
                        right: 0,
                        textAlign: "center",
                        fontSize: 10,
                        color: "#fff",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        pointerEvents: "none",
                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                      }}
                    >
                      {gt.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              /* ===== 单图大图模式 ===== */
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <button
                    onClick={closeFocus}
                    style={{
                      padding: "4px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: "rgba(255,255,255,0.15)",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <LeftOutlined />
                    <span>返回网格</span>
                  </button>
                  <span style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    {GRAPH_TYPES.find((g) => g.id === focusType)?.label}
                  </span>
                  <div style={{ width: 80 }} />
                </div>
                <div
                  style={{
                    width: "100%",
                    height: isMobile ? "60vh" : "70vh",
                    minHeight: 320,
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <PanoramaGraphInner graphType={focusType} {...dataProps} compact={false} />
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
