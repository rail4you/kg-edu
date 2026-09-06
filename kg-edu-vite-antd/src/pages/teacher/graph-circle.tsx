import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildCSRFHeaders } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useGraphCourse } from "@/hooks/use-graph-course";
import { useCourses } from "@/hooks/use-courses";
import { Typography, Tag, Alert, Spin, Empty, Input, Grid, Popover, Button } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import * as echarts from "echarts";

const { Text } = Typography;

interface Course { id: string; title: string; }
interface KnowledgeResource {
  id: string; name: string; description?: string | null;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  importanceLevel?: string | null; courseId: string;
  parentSubjectId?: string | null; parentUnitId?: string | null;
  childUnits?: KnowledgeResource[] | null;
  childCells?: KnowledgeResource[] | null;
  nestedChildCells?: KnowledgeResource[] | null;
}
interface FilterFormData { name: string; importanceLevel: string; }

const COLORS = {
  root: "#E8593A",
  level1: ["#4a90e2", "#27ae60", "#9b59b6", "#e74c5e"],
  important: "#f39c12",
  hard: "#e74c5e",
};

// 基础字体大小配置
const BASE_FONT_SIZES = {
  root: 24,
  depth0: 14,
  depth1: 15,
  depth1Inside: 12,
};

export default function TeacherGraphCircleView({ courseId: propCourseId }: { courseId?: string } & Record<string, unknown>) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const zoomLevelRef = useRef(1);
  // 统一的缩放入口：zoomLevel 作为唯一事实来源，同时驱动显示与 ECharts 缩放。
  // 之前从 ECharts roam 缩放值异步读回，导致显示落后一步、换向时首步反而反向。
  const applyZoom = useCallback((nextRaw: number) => {
    const next = Math.round(Math.min(2, Math.max(0.5, nextRaw)) * 100) / 100;
    zoomLevelRef.current = next;
    setZoomLevel(next);
    chartInstance.current?.setOption({ series: [{ zoom: next }] });
  }, []);
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeResource | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isFilterMode, setIsFilterMode] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<FilterFormData>({ name: "", importanceLevel: "" });
  const { selectedCourseId } = useGraphCourse();
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuData, setContextMenuData] = useState<KnowledgeResource | null>(null);
  // 移动端 Popover 状态
  const [mobilePopoverOpen, setMobilePopoverOpen] = useState(false);
  const [mobilePopoverNode, setMobilePopoverNode] = useState<KnowledgeResource | null>(null);
  const mobilePopoverRef = useRef<HTMLDivElement>(null);
  const effectiveCourseId = selectedCourseId || propCourseId;
  const { courses } = useCourses({ fields: ["id", "title"] });
  const courseTitle = courses.find((c) => c.id === effectiveCourseId)?.title;

  const { data: hierarchyData, isLoading: hierarchyLoading, error: hierarchyError } = useQuery({
    queryKey: ["teacher-circle-graph", "knowledge-data", effectiveCourseId, currentTenant?.id],
    queryFn: async () => {
      if (!effectiveCourseId) return [];
      const response = await fetch(`/api/knowledge/hierarchy/nested?course_id=${effectiveCourseId}&tenant=${currentTenant?.schemaName}`, { headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } });
      if (!response.ok) throw new Error("Failed");
      const result = await response.json();
      if (result.success) return result.data || [];
      throw new Error(result.errors?.[0]?.message || "Failed");
    },
    enabled: !!effectiveCourseId,
  });

  // 客户端过滤树：递归保留匹配节点及其祖先
  const filterTree = useCallback((nodes: KnowledgeResource[], text: string): KnowledgeResource[] => {
    if (!text) return nodes;
    const lower = text.toLowerCase();
    function filter(nodes: KnowledgeResource[]): KnowledgeResource[] {
      return nodes.reduce<KnowledgeResource[]>((acc, node) => {
        const filteredUnits = node.childUnits ? filter(node.childUnits) : [];
        const filteredCells = node.childCells ? filter(node.childCells) : [];
        const filteredNested = node.nestedChildCells ? filter(node.nestedChildCells) : [];
        const nameMatch = node.name.toLowerCase().includes(lower);
        const hasMatchingDescendant = filteredUnits.length > 0 || filteredCells.length > 0 || filteredNested.length > 0;
        if (nameMatch || hasMatchingDescendant) {
          acc.push({
            ...node,
            childUnits: node.childUnits ? filter(node.childUnits) : null,
            childCells: node.childCells ? filter(node.childCells) : null,
            nestedChildCells: node.nestedChildCells ? filter(node.nestedChildCells) : null,
          });
        }
        return acc;
      }, []);
    }
    return filter(nodes);
  }, []);

  const rawHierarchyData = useMemo(() => Array.isArray(hierarchyData) ? hierarchyData : [], [hierarchyData]);
  const processedHierarchyData = useMemo(() => {
    if (isFilterMode && appliedFilters.name.trim()) {
      return filterTree(rawHierarchyData, appliedFilters.name.trim());
    }
    return rawHierarchyData;
  }, [rawHierarchyData, isFilterMode, appliedFilters.name, filterTree]);

  // 标签屏幕尺寸实测：zrender label 不随 setSymbolScale/nodeScale 缩放（on-screen ≈ 所设 fontSize）。
  // 因此字体随缩放线性放大即可：fontSize = baseSize × clamp(zoom, 0.5, 2)，
  // 到 200% 时达到最大（2×base），全程单调递增、顶部不回退、不出现 195%–200% 的平台期。
  const FONT_ZOOM_MIN = 0.5;
  const FONT_ZOOM_MAX = 2;
  const getScaledFontSize = (baseSize: number) => {
    const clamped = Math.max(FONT_ZOOM_MIN, Math.min(FONT_ZOOM_MAX, zoomLevel));
    return Math.max(8, Math.round(baseSize * clamped));
  };

  // 构建 chartData（基础尺寸，不依赖 zoom，zoom 缩放另做）
  const buildChartData = useCallback((data: KnowledgeResource[], title: string | undefined) => {
    if (!data.length) return null;

    function buildNode(kr: KnowledgeResource, depth: number, colorIdx: number, inheritedColor?: string): Record<string, unknown> {
      const children: Record<string, unknown>[] = [];
      let color: string;
      if (depth === 1) {
        color = COLORS.level1[colorIdx % COLORS.level1.length];
        const imp = kr.importanceLevel;
        if (imp === "important") color = COLORS.important;
        else if (imp === "hard") color = COLORS.hard;
      } else {
        color = inheritedColor || COLORS.level1[colorIdx % COLORS.level1.length];
      }

      if (kr.childUnits) kr.childUnits.forEach((u) => children.push(buildNode(u, depth + 1, colorIdx, color)));
      if (kr.childCells) kr.childCells.forEach((c) => children.push(buildNode(c, depth + 1, colorIdx, color)));
      if (kr.nestedChildCells) kr.nestedChildCells.forEach((c) => children.push(buildNode(c, depth + 1, colorIdx, color)));

      const isLeaf = !kr.childUnits?.length && !kr.childCells?.length && !kr.nestedChildCells?.length;
      const name = kr.name.length > 14 ? kr.name.slice(0, 14) + ".." : kr.name;

      return {
        name, id: kr.id, knowledgeData: kr, depth,
        children: children.length ? children : undefined,
        symbol: depth === 1 ? "roundRect" : "circle",
        symbolSize: depth === 0 ? 60 : depth === 1 ? [70, 45] : 35,
        itemStyle: { color, borderColor: "#fff", borderWidth: 3, shadowBlur: 12, shadowColor: `${color}66` },
        label: depth === 1
          ? { show: true, position: "inside", color: "#1a1a2e", fontSize: 12, fontWeight: 700, rotate: 0,
              textBorderColor: "rgba(255,255,255,0.7)", textBorderWidth: 2 }
          : undefined,
        emphasis: {
          focus: "none",
          label: { show: true, formatter: (params: any) => params?.name || "" },
        },
      };
    }

    return {
      name: (title || "知识图谱").slice(0, 20), id: "root",
      knowledgeData: { id: "root", name: title || "知识图谱", knowledgeType: "subject", courseId: "" } as KnowledgeResource,
      children: data.filter((s: KnowledgeResource) => s.childUnits?.length || s.childCells?.length).map((s: KnowledgeResource, i: number) => buildNode(s, 1, i)),
      symbol: "circle", symbolSize: 115,
      itemStyle: { color: COLORS.root, borderColor: "#FF8C6B", borderWidth: 4, shadowBlur: 35, shadowColor: "rgba(232,89,58,0.6)" },
      label: {
        show: true, position: "inside",
        color: "#ffffff", fontWeight: 800, rotate: 0,
        textBorderColor: "rgba(180,40,20,0.6)", textBorderWidth: 3,
        textShadowColor: "rgba(0,0,0,0.25)", textShadowBlur: 6,
        formatter: (params: any) => params?.name || "",
      },
      emphasis: {
        focus: "none",
        label: { show: true, position: "inside", formatter: (params: any) => params?.name || "" },
      },
    };
  }, []);

  const chartData = useMemo(() => {
    return buildChartData(processedHierarchyData, courseTitle);
  }, [processedHierarchyData, courseTitle, buildChartData]);

  // 追踪数据是否真正变化（非缩放引起），避免重置展开状态
  const dataKeyRef = useRef<string>("");
  const isInitRef = useRef(false);

  // 🔹 Effect 1: 数据变化时 — 完整重建树（full reset）
  useEffect(() => {
    if (!chartRef.current || !chartData) return;

    const dataKey = JSON.stringify(chartData);
    const isNewData = dataKey !== dataKeyRef.current;
    const isInit = !isInitRef.current;
    if (!isNewData && !isInit) return; // 数据没变且已初始化过，跳过

    dataKeyRef.current = dataKey;
    isInitRef.current = true;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    // 根节点标签注入（data 层面不加 label，改用 levels[0] 统一管理以便缩放更新）
    const option = {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item", triggerOn: "mousemove",
        backgroundColor: "rgba(255,255,255,0.96)", borderColor: "#e0e0e0", borderWidth: 1, padding: [8, 12],
        textStyle: { color: "#333", fontSize: 12 },
        formatter: (params: any) => {
          if (!params.data?.knowledgeData) return "";
          const kd = params.data.knowledgeData;
          const types: Record<string, string> = { subject: "学科", knowledge_unit: "知识单元", knowledge_cell: "知识点" };
          let html = `<div style="font-weight:600">${kd.name}</div>`;
          html += `<div style="color:#666;font-size:11px">${types[kd.knowledgeType] || kd.knowledgeType}</div>`;
          return html;
        },
      },
      series: [{
        type: "tree",
        data: [chartData],
        top: 0, bottom: 0, left: 0, right: 0,
        layout: "radial",
        // roam 使用 ECharts 原生缩放 — 不通过 setOption 改 zoom，避免树状态重置
        roam: true,
        zoom: zoomLevel,
        initialTreeDepth: isFilterMode ? 99 : 2,
        expandAndCollapse: true,
        nodeScaleRatio: 0.15, // 节点随 zoom 轻微缩放
        animationDuration: 500,
        animationDurationUpdate: 350,
        animationEasing: "cubicOut",
        animationEasingUpdate: "cubicInOut",
        emphasis: { focus: "none" },
        lineStyle: { color: "#c0c0c0", width: 2, curveness: 0.5 },
        // 默认不显示标签
        label: { show: false },
        labelLayout: function (params: any) {
          if (!params.rect) return { hideOverlap: true };
          const chartEl = chartRef.current;
          if (!chartEl) return { hideOverlap: true };
          const cx = chartEl.clientWidth / 2;
          const cy = chartEl.clientHeight / 2;
          const lx = params.rect.x + params.rect.width / 2;
          const ly = params.rect.y + params.rect.height / 2;
          // 计算径向角度
          const rad = Math.atan2(ly - cy, lx - cx);
          const deg = (rad * 180) / Math.PI;
          // 根节点保持水平
          if (Math.abs(lx - cx) < 10 && Math.abs(ly - cy) < 10) {
            return { rotation: 0, hideOverlap: false };
          }
          // 一级节点（roundRect）保持水平，文字不随径向旋转
          if (params.data && params.data.depth === 1) {
            return { rotation: 0, hideOverlap: false };
          }
          // 其他节点按径向旋转
          const rotation = lx < cx ? deg + 180 : deg;
          return { rotation, hideOverlap: false };
        },
        // leaves：叶子节点 + 折叠状态节点 自动显示标签
        leaves: {
          label: {
            show: true,
            distance: 18,
            color: "#1a1a2e",
            fontSize: getScaledFontSize(BASE_FONT_SIZES.depth1),
            fontWeight: 600,
          },
        },
      }],
    };

    chartInstance.current.setOption(option, true);
    // 数据重建后立即应用缩放字体，避免标签停留在默认字号
    applyZoomFonts();
  }, [chartData]);

  // 缩放时统一更新所有可见标签字体（根节点 + 一级节点 + 叶子/折叠节点）
  const applyZoomFonts = useCallback(() => {
    if (!chartInstance.current || !isInitRef.current) return;
    try {
      const chart = chartInstance.current;
      const model = chart.getModel();
      const seriesModel = model.getSeriesByIndex(0);
      if (!seriesModel) return;
      const data = seriesModel.getData();
      const tree = (data as any).tree;
      if (!tree) return;
      const leafFont = getScaledFontSize(BASE_FONT_SIZES.depth1);
      const rootFont = Math.max(BASE_FONT_SIZES.root, getScaledFontSize(BASE_FONT_SIZES.root));
      const depthOneFont = getScaledFontSize(BASE_FONT_SIZES.depth1Inside);

      // 遍历所有可见节点，统一按类型缩放标签字体
      // 注意：ECharts tree 会为 series.data 生成虚拟根节点，因此
      // 课程节点在内部树的 depth 为 1，章节节点 depth 为 2，
      // 需通过原始数据的 depth 字段识别章节节点
      data.eachItemGraphicEl((el: any, dataIndex: number) => {
        if (!el) return;
        const node = tree.getNodeByDataIndex(dataIndex);
        if (!node) return;
        const rawItem = data.getRawDataItem(node.dataIndex) as { depth?: number } | undefined;
        // 虚拟根节点的直接子节点 = 实际根节点（课程）
        const isRoot = node.parentNode === tree.root;
        // 章节节点：构建数据时 depth 字段为 1
        const isChapter = !!rawItem && rawItem.depth === 1;
        // 叶子/折叠节点
        const isLeafLike = !node.children || node.children.length === 0 || node.isExpand === false;

        let fontSize: number;
        if (isRoot) fontSize = rootFont;
        else if (isChapter) fontSize = depthOneFont;
        else if (isLeafLike) fontSize = leafFont;
        else return;

        const textEl = findLabelText(el);
        if (textEl) {
          // useStyle 全量替换 style（对已渲染元素更可靠），fallback setStyle
          const newStyle = Object.assign({}, textEl.style, { fontSize });
          if (typeof textEl.useStyle === 'function') {
            textEl.useStyle(newStyle);
          } else {
            textEl.setStyle?.('fontSize', fontSize);
          }
        }
      });
      // 强制 ZRender 刷新
      (chart as any).getZr()?.refresh?.();
    } catch {}
  }, [zoomLevel]);

  // 🔹 缩放变化时更新所有标签字体，零 setOption，零 render 周期
  useEffect(() => {
    applyZoomFonts();
  }, [applyZoomFonts]);

  /** 在 ECharts Symbol 元素树中递归查找 label 对应的 ZRender Text */
  function findLabelText(el: any): any {
    if (!el) return null;
    // 自身是 Text
    if (el.type === 'text') return el;
    // 直接 textContent
    let t = el.getTextContent?.();
    if (t) return t;
    // el 内部属性
    t = el._textContent;
    if (t) return t;
    // 遍历所有子节点（包括子孙）
    const stack = [el];
    const visited = new Set();
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur || visited.has(cur)) continue;
      visited.add(cur);
      t = cur.getTextContent?.();
      if (t) return t;
      if (cur.childAt) {
        for (let i = 0; i < 20; i++) {
          const c = cur.childAt(i);
          if (!c) break;
          if (c.type === 'text') return c;
          stack.push(c);
        }
      }
      // 尝试 children 数组
      if (Array.isArray(cur._children)) {
        for (const c of cur._children) {
          if (c && c.type === 'text') return c;
          stack.push(c);
        }
      }
    }
    return null;
  }

  // 提取一级知识点信息用于图例展示
  const firstLevelItems = useMemo(() => {
    return processedHierarchyData
      .filter((s: KnowledgeResource) => s.childUnits?.length || s.childCells?.length)
      .map((s: KnowledgeResource, i: number) => {
        const imp = s.importanceLevel;
        let color = COLORS.level1[i % COLORS.level1.length];
        if (imp === "important") color = COLORS.important;
        else if (imp === "hard") color = COLORS.hard;
        return { name: s.name, color };
      });
  }, [processedHierarchyData]);

  // 鼠标滚轮缩放 & 窗口 resize 监听
  useEffect(() => {
    if (!chartInstance.current || !chartRef.current) return;

    // 在 DOM capture 阶段拦截滚轮事件，统一由 applyZoom 控制缩放。
    // 缩放完全由 zoomLevel 决定（不再依赖 ECharts roam 异步读回），
    // 既避免显示滞后一步，也让方向切换时首个事件立即按当前方向生效。
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!chartInstance.current) return;
      // deltaY < 0 上滚放大，deltaY > 0 下滚缩小（沿用 ECharts 原生手感）
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      applyZoom(zoomLevelRef.current * factor);
    };
    const chartDom = chartRef.current;
    chartDom.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);
    const ro = new ResizeObserver(() => chartInstance.current?.resize());
    if (chartRef.current) ro.observe(chartRef.current);

    return () => {
      window.removeEventListener("resize", handleResize);
      ro.disconnect();
      chartDom.removeEventListener('wheel', handleWheel, { capture: true } as any);
    };
  }, [chartData, applyZoom]);

  // 右键菜单关闭（document 级别）
  useEffect(() => {
    if (!contextMenuVisible) return;
    const close = () => setContextMenuVisible(false);
    const timer = setTimeout(() => document.addEventListener('click', close), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', close);
    };
  }, [contextMenuVisible]);

  // 注册 ECharts 点击和右键事件
  useEffect(() => {
    if (!chartInstance.current) return;
    
    const handleClick = (params: any) => {
      if (!params.data?.knowledgeData || params.data.id === "root") return;
      if (isMobile) {
        // 移动端：显示 Popover 选择展开还是查看详情
        params.event?.event?.preventDefault?.();
        setMobilePopoverNode(params.data.knowledgeData);
        setMobilePopoverOpen(true);
      }
      // 桌面端：左键点击由 ECharts 内置 expandAndCollapse 处理，不做额外操作
    };
    
    const handleCtx = (params: any) => {
      if (params.data?.knowledgeData && params.data.id !== "root") {
        params.event?.event?.preventDefault?.();
        setContextMenuPosition({
          x: params.event.event?.clientX || 0,
          y: params.event.event?.clientY || 0,
        });
        setContextMenuData(params.data.knowledgeData);
        setContextMenuVisible(true);
      }
    };
    chartInstance.current.on("click", handleClick);
    chartInstance.current.on("contextmenu", handleCtx);
    return () => {
      chartInstance.current?.off("click", handleClick);
      chartInstance.current?.off("contextmenu", handleCtx);
    };
  }, [chartData, isMobile]);

  const handleContextMenuItemClick = useCallback((action: string) => {
    if (!contextMenuData) return;
    setContextMenuVisible(false);
    if (action === "detail") { setSelectedKnowledge(contextMenuData); setDrawerOpen(true); }
  }, [contextMenuData]);

  const handleCloseDrawer = useCallback(() => { setDrawerOpen(false); setSelectedKnowledge(null); }, []);
  const clearAllFilters = useCallback(() => { setAppliedFilters({ name: "", importanceLevel: "" }); setIsFilterMode(false); }, []);

  const resetZoom = useCallback(() => {
    applyZoom(1);
  }, [applyZoom]);

  if (authLoading) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: 16 }}><Spin size="large" /><Text type="secondary">加载中...</Text></div>;
  if (!user) return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}><Alert type="error" message="请登录" /></div>;

  return (
    <div style={{ display: "flex", height: "100%", backgroundColor: "#fff" }}>
      <div style={{ flexGrow: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ minHeight: isMobile ? 36 : 48, padding: isMobile ? "3px 6px" : "4px 16px", display: "flex", alignItems: "center", gap: isMobile ? 4 : 12, backgroundColor: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0, flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <Input placeholder="搜索..." prefix={<SearchOutlined style={{ color: "#999" }} />}
            style={{ flex: isMobile ? "1 1 auto" : undefined, width: isMobile ? undefined : 220, minWidth: isMobile ? 80 : undefined, maxWidth: isMobile ? undefined : 220 }}
            value={appliedFilters.name}
            onChange={(e) => { setAppliedFilters(prev => ({ ...prev, name: e.target.value })); setIsFilterMode(e.target.value.trim() !== ""); }}
            allowClear onClear={() => { setAppliedFilters({ name: "", importanceLevel: "" }); setIsFilterMode(false); }} />
          {isFilterMode && <Tag color="orange" closable onClose={clearAllFilters} style={{ flexShrink: 0 }}>搜索中</Tag>}
          <div style={{ flex: 1, minWidth: isMobile ? 0 : undefined }} />
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 4 }}>
            <span style={{ color: "#666", fontSize: isMobile ? 10 : 12, padding: isMobile ? "0 2px" : undefined }}>{Math.round(zoomLevel * 100)}%</span>
            {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
              <button
                key={label as string}
                onClick={() => {
                  if (val === "reset") {
                    applyZoom(1);
                  } else if (val === -0.15) {
                    applyZoom(zoomLevelRef.current - 0.15);
                  } else {
                    applyZoom(zoomLevelRef.current + 0.15);
                  }
                }}
                style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 4, color: "#333", padding: isMobile ? "3px 8px" : "4px 12px", cursor: "pointer", fontSize: isMobile ? 12 : 14, lineHeight: 1 }}
              >
                {label as string}
              </button>
            ))}
          </div>
        </div>

        {firstLevelItems.length > 0 && (
          <div
            style={{
              padding: "8px 16px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              alignItems: "center",
              borderBottom: "1px solid #f0f0f0",
              backgroundColor: "#fafbfc",
              flexShrink: 0,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>图例：</Text>
            {firstLevelItems.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: item.color,
                    flexShrink: 0,
                    boxShadow: `0 0 4px ${item.color}88`,
                  }}
                />
                <span style={{ fontSize: 12, color: "#333" }}>{item.name}</span>
              </div>
            ))}
          </div>
        )}

        {!effectiveCourseId ? (
          <div style={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}><Empty description="请选择课程" /></div>
        ) : (
          <>
            {(hierarchyError || hierarchyLoading) && (
            <div style={{ padding: "8px 16px" }}>
              {hierarchyError && <Alert type="error" message={`错误: ${hierarchyError instanceof Error ? hierarchyError.message : "未知"}`} style={{ marginBottom: 16 }} />}
              {hierarchyLoading && <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}><Spin size="large" /><Text>加载中...</Text></div>}
            </div>
            )}
            <div style={{ flexGrow: 1, position: "relative" }}>
              <div ref={chartRef} style={{ width: "100%", height: "100%", minHeight: 520, background: "#fff", overflow: "hidden" }} />
            </div>
          </>
        )}
      </div>

      {contextMenuVisible && contextMenuData && (
        <div style={{ position: "fixed", left: contextMenuPosition.x, top: contextMenuPosition.y, backgroundColor: "#fff", borderRadius: 6, boxShadow: "0 2px 10px rgba(0,0,0,0.1)", padding: "4px 0", zIndex: 1000, minWidth: 130 }}
          onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #f0f0f0", fontSize: 11 }}>
            <Tag color="blue">{contextMenuData.knowledgeType === "subject" ? "学科" : contextMenuData.knowledgeType === "knowledge_unit" ? "知识单元" : "知识点"}</Tag>
            <span style={{ fontWeight: 500, marginLeft: 4 }}>{contextMenuData.name}</span>
          </div>
          <div style={{ padding: "6px 12px", cursor: "pointer", fontSize: 12 }} onClick={() => handleContextMenuItemClick("detail")}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f5f5")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            查看详情
          </div>
        </div>
      )}

      {/* 移动端 Popover：点击节点弹出操作选择 */}
      {isMobile && mobilePopoverOpen && mobilePopoverNode && (
        <>
          <div
            style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, inset: 0, zIndex: 999, background: "rgba(0,0,0,0.3)" }}
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
            <div style={{ fontSize: 15, fontWeight: 700, color: "#333", marginBottom: 4 }}>
              {mobilePopoverNode.name}
            </div>
            <Tag color="blue" style={{ marginBottom: 16 }}>
              {mobilePopoverNode.knowledgeType === "subject" ? "学科" : mobilePopoverNode.knowledgeType === "knowledge_unit" ? "知识单元" : "知识点"}
            </Tag>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                block
                size="large"
                onClick={() => {
                  setMobilePopoverOpen(false);
                  setSelectedKnowledge(mobilePopoverNode);
                  setDrawerOpen(true);
                }}
                style={{ borderRadius: 10, height: 48, fontSize: 15 }}
              >
                查看知识点详情
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

      <KnowledgeResourcePanel open={drawerOpen} onClose={handleCloseDrawer} knowledge={selectedKnowledge} />
    </div>
  );
}