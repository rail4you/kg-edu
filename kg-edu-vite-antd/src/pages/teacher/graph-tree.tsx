import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Spin,
  Alert,
  Empty,
  Input,
  Tooltip,
  Popover,
  Grid,
  Tag,
  Button,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { buildCSRFHeaders } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useGraphCourse } from "@/hooks/use-graph-course";
import { useCourses } from "@/hooks/use-courses";

const { Text } = Typography;

// ─── Color palette ────────────────────────────────────────────────────────────
const BRANCH_COLORS = [
  { bg: "#e8f0fe", text: "#1a3a6a", border: "#a0c0e8" },
  { bg: "#e6f4ea", text: "#1a4a2a", border: "#80c0a0" },
  { bg: "#f3e8fd", text: "#4a2a6a", border: "#b898d0" },
  { bg: "#fce8ef", text: "#6a2a3a", border: "#d0a0b0" },
  { bg: "#e0f7fa", text: "#1a4a5a", border: "#80c8d8" },
  { bg: "#fff8e1", text: "#5a4010", border: "#d0c080" },
];

const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string; fontSize: number; fontWeight: number; radius: number }> = {
  root:     { bg: "#f0f4f8", text: "#1a3a5a", border: "#a0b8d0", fontSize: 15, fontWeight: 700, radius: 10 },
  depth_0:  { bg: "#e8f0fe", text: "#1a3a6a", border: "#a0c0e8", fontSize: 12, fontWeight: 600, radius: 8 },
  depth_1:  { bg: "#f0f5fa", text: "#2a3a4a", border: "#b8c8d8", fontSize: 11, fontWeight: 500, radius: 6 },
  depth_2:  { bg: "#f0f8f0", text: "#1a3a10", border: "#a0c8a0", fontSize: 10, fontWeight: 500, radius: 5 },
  depth_3:  { bg: "#f5f5f3", text: "#383830", border: "#c0c0b8", fontSize: 10, fontWeight: 400, radius: 4 },
};

const SEARCH_HIGHLIGHT = { bg: "#fef2f2", text: "#dc2626", border: "#f87171" };
const IMPORTANT_BORDER = "#f59e0b";
const HARD_BORDER = "#ef4444";

const KNOWLEDGE_TYPES: Record<string, string> = {
  subject: "学科",
  knowledge_unit: "知识单元",
  knowledge_cell: "知识点",
};

const IMPORTANCE_LEVELS: Record<string, string> = {
  normal: "一般",
  important: "重点",
  hard: "难点",
  simple: "简单",
  easy: "简单",
};

// ─── Layout engine ────────────────────────────────────────────────────────────
const GAP_X = 32;
const GAP_Y = 8;

interface LayoutNode {
  id: string;
  label: string;
  w: number;
  h: number;
  children: LayoutNode[];
  side?: "left" | "right";
}

interface Position {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

/**
 * 计算子树的实际紧凑高度：每个子节点只占自身子树需要的高度。
 */
function subtreeHeight(node: LayoutNode): number {
  if (!node.children || node.children.length === 0) return node.h;
  let total = 0;
  node.children.forEach((c, i) => {
    total += subtreeHeight(c);
    if (i < node.children.length - 1) total += GAP_Y;
  });
  return Math.max(node.h, total);
}

/**
 * 紧凑布局：节点居中于 (cx, cy)，子节点围绕 cy 紧密排列。
 */
function layoutNode(
  node: LayoutNode,
  cx: number,
  cy: number,
  dir: number,
  positions: Record<string, Position>,
) {
  // 将节点居中放置在 (cx, cy)
  positions[node.id] = {
    x: cx - node.w / 2,
    y: cy - node.h / 2,
    w: node.w,
    h: node.h,
    cx,
    cy,
  };

  if (!node.children || node.children.length === 0) return;

  // 计算每个子节点的子树高度，紧密排列
  const childHeights = node.children.map((c) => subtreeHeight(c));
  let totalH = 0;
  childHeights.forEach((ch, i) => {
    totalH += ch;
    if (i < childHeights.length - 1) totalH += GAP_Y;
  });

  // 从 cy 向上下两侧均匀展开
  let cursor = cy - totalH / 2;
  node.children.forEach((child, i) => {
    const childH = childHeights[i];
    const childCy = cursor + childH / 2;
    const childCx = cx + dir * (node.w / 2 + GAP_X + child.w / 2);
    layoutNode(child, childCx, childCy, dir, positions);
    cursor += childH + GAP_Y;
  });
}

/**
 * 根节点布局：左右分支分别紧凑排列。
 */
function buildLayout(tree: LayoutNode): Record<string, Position> {
  const positions: Record<string, Position> = {};
  positions[tree.id] = { x: -tree.w / 2, y: -tree.h / 2, w: tree.w, h: tree.h, cx: 0, cy: 0 };

  const rightChildren = tree.children.filter((c) => c.side === "right");
  const leftChildren = tree.children.filter((c) => c.side === "left");
  const rootGap = GAP_Y * 3;

  if (rightChildren.length > 0) {
    const childHeights = rightChildren.map((c) => subtreeHeight(c));
    let totalH = 0;
    childHeights.forEach((ch, i) => {
      totalH += ch;
      if (i < childHeights.length - 1) totalH += rootGap;
    });
    let cursor = -totalH / 2;
    rightChildren.forEach((child, i) => {
      const childH = childHeights[i];
      const childCy = cursor + childH / 2;
      const childCx = tree.w / 2 + GAP_X + child.w / 2;
      layoutNode(child, childCx, childCy, +1, positions);
      cursor += childH + rootGap;
    });
  }

  if (leftChildren.length > 0) {
    const childHeights = leftChildren.map((c) => subtreeHeight(c));
    let totalH = 0;
    childHeights.forEach((ch, i) => {
      totalH += ch;
      if (i < childHeights.length - 1) totalH += rootGap;
    });
    let cursor = -totalH / 2;
    leftChildren.forEach((child, i) => {
      const childH = childHeights[i];
      const childCy = cursor + childH / 2;
      const childCx = -(tree.w / 2 + GAP_X + child.w / 2);
      layoutNode(child, childCx, childCy, -1, positions);
      cursor += childH + rootGap;
    });
  }

  return positions;
}

function gatherAll(node: LayoutNode, arr: LayoutNode[] = []): LayoutNode[] {
  arr.push(node);
  (node.children || []).forEach((c) => gatherAll(c, arr));
  return arr;
}

function gatherEdges(node: LayoutNode, edges: [string, string][] = []): [string, string][] {
  (node.children || []).forEach((child) => {
    edges.push([node.id, child.id]);
    gatherEdges(child, edges);
  });
  return edges;
}

function makePath(fromPos: Position, toPos: Position, dir: number): string {
  const x1 = dir > 0 ? fromPos.x + fromPos.w : fromPos.x;
  const y1 = fromPos.y + fromPos.h / 2;
  const x2 = dir > 0 ? toPos.x : toPos.x + toPos.w;
  const y2 = toPos.y + toPos.h / 2;
  const cp = Math.abs(x2 - x1) * 0.45;
  return `M${x1},${y1} C${x1 + dir * cp},${y1} ${x2 - dir * cp},${y2} ${x2},${y2}`;
}

function getSide(nodeId: string, tree: LayoutNode): "left" | "right" | "root" {
  if (nodeId === tree.id) return "root";
  function search(node: LayoutNode, side: "left" | "right"): "left" | "right" | null {
    if (node.id === nodeId) return side;
    for (const c of node.children || []) {
      const found = search(c, side);
      if (found) return found;
    }
    return null;
  }
  for (const child of tree.children) {
    const s = search(child, child.side || "right");
    if (s) return s;
  }
  return "right";
}

// ─── Interfaces ───────────────────────────────────────────────────────────────
interface Course {
  id: string;
  title: string;
  description?: string;
}

interface KnowledgeResource {
  id: string;
  name: string;
  description?: string | null;
  knowledgeType: "subject" | "knowledge_unit" | "knowledge_cell";
  subject?: string | null;
  unit?: string | null;
  importanceLevel?: string | null;
  courseId: string;
  course?: Course | null;
  parentSubjectId?: string | null;
  parentUnitId?: string | null;
  parentKnowledgeResourceId?: string | null;
  childUnits?: KnowledgeResource[] | null;
  childCells?: KnowledgeResource[] | null;
  nestedChildCells?: KnowledgeResource[] | null;
  directCells?: KnowledgeResource[] | null;
  subjectCells?: KnowledgeResource[] | null;
  sortPath?: string | null;
  displayOrder?: number | null;
}

interface InternalTreeNode {
  id: string;
  label: string;
  knowledgeData: KnowledgeResource;
  children: InternalTreeNode[];
  depth: number;
}

// ─── Tree building ────────────────────────────────────────────────────────────
function buildInternalTree(
  data: KnowledgeResource[],
  courseTitle: string | undefined,
): InternalTreeNode | null {
  if (!data || data.length === 0) return null;

  const visited = new Set<string>();

  const buildNode = (kr: KnowledgeResource, depth: number): InternalTreeNode | null => {
    // 全局去重：同一个 ID 只挂载一次，重复的完全跳过
    if (visited.has(kr.id)) return null;
    visited.add(kr.id);

    const children: InternalTreeNode[] = [];
    const kt = kr.knowledgeType;

    if (kt === "subject") {
      // 学科 → 知识单元
      if (kr.childUnits && Array.isArray(kr.childUnits)) {
        kr.childUnits.forEach((unit) => {
          const n = buildNode(unit, depth + 1);
          if (n) children.push(n);
        });
      }
    } else if (kt === "knowledge_unit") {
      // 知识单元 → 知识点
      if (kr.childCells && Array.isArray(kr.childCells)) {
        kr.childCells.forEach((cell) => {
          const n = buildNode(cell, depth + 1);
          if (n) children.push(n);
        });
      }
    } else if (kt === "knowledge_cell") {
      // 知识点 → 嵌套子知识点（递归）
      if (kr.nestedChildCells && Array.isArray(kr.nestedChildCells)) {
        kr.nestedChildCells.forEach((cell) => {
          const n = buildNode(cell, depth + 1);
          if (n) children.push(n);
        });
      }
    }

    return { id: kr.id, label: kr.name, knowledgeData: kr, children, depth };
  };

  const childNodes = data
    .map((subject) => buildNode(subject, 0))
    .filter((n): n is InternalTreeNode => n !== null);

  return {
    id: "__root__",
    label: courseTitle || "知识树",
    knowledgeData: null as any,
    children: childNodes,
    depth: -1,
  };
}

// ─── Search helpers ───────────────────────────────────────────────────────────
function nodeMatchesSearch(node: InternalTreeNode, searchLower: string): boolean {
  if (!searchLower) return false;
  if (node.label.toLowerCase().includes(searchLower)) return true;
  if (node.knowledgeData?.description?.toLowerCase().includes(searchLower)) return true;
  return false;
}

function subtreeHasMatch(node: InternalTreeNode, searchLower: string): boolean {
  if (nodeMatchesSearch(node, searchLower)) return true;
  return node.children.some((child) => subtreeHasMatch(child, searchLower));
}

function filterTree(node: InternalTreeNode, searchLower: string): InternalTreeNode | null {
  if (!searchLower) return node;
  const filteredChildren = node.children
    .map((child) => filterTree(child, searchLower))
    .filter((n): n is InternalTreeNode => n !== null);
  if (nodeMatchesSearch(node, searchLower) || filteredChildren.length > 0) {
    return { ...node, children: filteredChildren };
  }
  return null;
}

// ─── Convert InternalTreeNode to LayoutNode ───────────────────────────────────
function toLayoutNode(node: InternalTreeNode): LayoutNode {
  const charWidth = 14;
  const w = Math.max(80, Math.min(220, node.label.length * charWidth + 24));
  const h = node.depth === -1 ? 56 : node.depth === 0 ? 44 : node.depth === 1 ? 34 : 30;
  return {
    id: node.id,
    label: node.label,
    w,
    h,
    children: node.children.map(toLayoutNode),
  };
}

function assignSides(tree: LayoutNode): LayoutNode {
  const half = Math.ceil(tree.children.length / 2);
  return {
    ...tree,
    children: tree.children.map((child, i) => ({
      ...child,
      side: i < half ? "right" : "left",
    })),
  };
}

// ─── Get node style ───────────────────────────────────────────────────────────
function getNodeStyle(depth: number, branchIndex: number, isHighlighted: boolean) {
  if (isHighlighted) {
    return { ...SEARCH_HIGHLIGHT, fontSize: depth === -1 ? 15 : depth === 0 ? 12 : 11, fontWeight: depth === -1 ? 700 : 600, radius: 8 };
  }
  if (depth === -1) return LEVEL_STYLES.root;
  if (depth === 0) {
    const bc = BRANCH_COLORS[branchIndex % BRANCH_COLORS.length];
    return { bg: bc.bg, text: bc.text, border: bc.border, fontSize: 12, fontWeight: 600, radius: 8 };
  }
  const key = `depth_${Math.min(depth, 3)}`;
  return LEVEL_STYLES[key] || LEVEL_STYLES.depth_3;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TeacherGraphTreeView({ courseId: propCourseId, knowledgeId }: { courseId?: string; knowledgeId?: string } & Record<string, any>) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const { selectedCourseId: hookCourseId } = useGraphCourse();
  const selectedCourseId = propCourseId || hookCourseId;
  const { courses } = useCourses({ fields: ["id", "title"] });
  const courseTitle = courses.find((c) => c.id === selectedCourseId)?.title;

  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeResource | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const [scale, setScale] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const dragThreshold = 5;
  const containerRef = useRef<HTMLDivElement>(null);

  // 保持 panRef 与 pan 状态同步
  useEffect(() => {
    if (!draggingRef.current) {
      panRef.current.x = pan.x;
      panRef.current.y = pan.y;
    }
  }, [pan]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);

  // ─── Data fetching ────────────────────────────────────────────────────────
  const {
    data: hierarchyData,
    isLoading: hierarchyLoading,
    error: hierarchyError,
  } = useQuery({
    queryKey: ["teacher-tree-graph", "knowledge-data", selectedCourseId, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const tenant = currentTenant?.schemaName || "";
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${selectedCourseId}&tenant=${tenant}`,
        { headers: { ...buildCSRFHeaders(), ...getAuthHeaders(user) } },
      );
      if (!response.ok) throw new Error(`Failed to fetch hierarchy: ${response.statusText}`);
      const result = await response.json();
      if (result && typeof result === "object" && Array.isArray(result.data)) return result.data;
      if (Array.isArray(result)) return result;
      return [];
    },
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    staleTime: 5 * 60 * 1000,
  });

  const processedHierarchyData = useMemo(() => {
    if (!hierarchyData || !Array.isArray(hierarchyData)) return [];
    const sortByPath = (a?: KnowledgeResource | null, b?: KnowledgeResource | null) => {
      return (a?.sortPath || "").localeCompare(b?.sortPath || "");
    };
    const processChildren = (items: KnowledgeResource[] | undefined): KnowledgeResource[] => {
      if (!items || !Array.isArray(items)) return [];
      return items
        .map((item) => ({
          ...item,
          childCells: item.childCells ? processChildren(item.childCells) : undefined,
          nestedChildCells: item.nestedChildCells ? processChildren(item.nestedChildCells) : undefined,
        }))
        .sort(sortByPath);
    };
    return hierarchyData
      .map((subject: KnowledgeResource) => ({
        ...subject,
        childUnits: subject.childUnits
          ? subject.childUnits
              .map((unit: KnowledgeResource) => ({
                ...unit,
                childCells: unit.childCells ? processChildren(unit.childCells) : undefined,
                nestedChildCells: unit.nestedChildCells ? processChildren(unit.nestedChildCells) : undefined,
              }))
              .sort(sortByPath)
          : subject.childUnits,
      }))
      .sort(sortByPath);
  }, [hierarchyData]);

  const internalTree = useMemo(
    () => buildInternalTree(processedHierarchyData, courseTitle),
    [processedHierarchyData, courseTitle],
  );

  const filteredTree = useMemo(() => {
    if (!internalTree) return null;
    const sl = searchText.toLowerCase().trim();
    if (!sl) return internalTree;
    return filterTree(internalTree, sl);
  }, [internalTree, searchText]);

  // 初始只展开一级节点（depth 0）
  useEffect(() => {
    if (!internalTree) return;
    const collapsed = new Set<string>();
    function markCollapsed(node: InternalTreeNode, currentDepth: number) {
      if (currentDepth >= 1 && node.children.length > 0) {
        collapsed.add(node.id);
      }
      node.children.forEach((child) => markCollapsed(child, currentDepth + 1));
    }
    internalTree.children.forEach((child) => markCollapsed(child, 0));
    collapsed.delete(internalTree.id);
    setCollapsedNodes(collapsed);
  }, [internalTree]);

  // ─── Layout computation ───────────────────────────────────────────────────
  const layoutTree = useMemo(() => {
    if (!filteredTree) return null;
    function applyCollapse(node: InternalTreeNode): InternalTreeNode {
      if (collapsedNodes.has(node.id)) {
        return { ...node, children: [] };
      }
      return { ...node, children: node.children.map(applyCollapse) };
    }
    const collapsedTree = applyCollapse(filteredTree);
    return assignSides(toLayoutNode(collapsedTree));
  }, [filteredTree, collapsedNodes]);

  const positions = useMemo(() => {
    if (!layoutTree) return {};
    return buildLayout(layoutTree);
  }, [layoutTree]);

  const allLayoutNodes = useMemo(() => {
    if (!layoutTree) return [];
    return gatherAll(layoutTree);
  }, [layoutTree]);

  const allEdges = useMemo(() => {
    if (!layoutTree) return [];
    return gatherEdges(layoutTree);
  }, [layoutTree]);

  const nodeMetaMap = useMemo(() => {
    if (!filteredTree) return new Map<string, InternalTreeNode>();
    const map = new Map<string, InternalTreeNode>();
    function walk(node: InternalTreeNode) {
      map.set(node.id, node);
      node.children.forEach(walk);
    }
    walk(filteredTree);
    return map;
  }, [filteredTree]);

  // 外部 knowledgeId 跳转：自动选中对应知识点
  useEffect(() => {
    if (!knowledgeId || !filteredTree) return;
    const meta = nodeMetaMap.get(knowledgeId);
    if (meta?.knowledgeData) {
      // 自动展开父节点路径
      const expandParents = (node: InternalTreeNode) => {
        collapsedNodes.forEach((id) => {
          const n = nodeMetaMap.get(id);
          // 简单处理：移除所有一级折叠，让节点可见
        });
      };
      setCollapsedNodes((prev) => {
        const next = new Set(prev);
        next.delete(knowledgeId);
        // 展开根节点的子节点（一级折叠全部打开）
        if (filteredTree) {
          filteredTree.children.forEach((child) => next.delete(child.id));
        }
        return next;
      });
      setInfoCardNode(meta);
      setHighlightedNodeId(knowledgeId);
    }
  }, [knowledgeId, filteredTree]);

  const branchIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!layoutTree) return map;
    layoutTree.children.forEach((child, i) => {
      function mark(node: LayoutNode, idx: number) {
        map.set(node.id, idx);
        (node.children || []).forEach((c) => mark(c, idx));
      }
      mark(child, i);
    });
    return map;
  }, [layoutTree]);

  // ─── Viewport ──────────────────────────────────────────────────────────────
  const bounds = useMemo(() => {
    const posArr = Object.values(positions);
    if (posArr.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    posArr.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.w);
      maxY = Math.max(maxY, p.y + p.h);
    });
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, [positions]);

  const hasPannedRef = useRef(false);
  const hasCenteredRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || bounds.w === 0) return;
    // 数据就绪后仅在首次居中视图，用户拖拽/展开节点后不再自动居中
    if (!hasCenteredRef.current && !hasPannedRef.current) {
      hasCenteredRef.current = true;
      setPan({
        x: el.clientWidth / 2 - (bounds.minX + bounds.w / 2) * scale,
        y: el.clientHeight / 2 - (bounds.minY + bounds.h / 2) * scale,
      });
    }
  }, [bounds]);

  // ─── Interaction ───────────────────────────────────────────────────────────
  // ─── Drag interaction ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const getClientPos = (e: MouseEvent | TouchEvent): { cx: number; cy: number } => {
      if ('touches' in e && e.touches.length > 0) {
        return { cx: e.touches[0].clientX, cy: e.touches[0].clientY };
      }
      return { cx: (e as MouseEvent).clientX, cy: (e as MouseEvent).clientY };
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      if ((e.target as HTMLElement).closest('.mindmap-node')) return;
      e.preventDefault();
      const { cx, cy } = getClientPos(e);
      draggingRef.current = false;
      lastPos.current = { x: cx, y: cy };
      dragStart.current = { x: cx, y: cy };
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragStart.current) return;
      const { cx, cy } = getClientPos(e);
      if (!draggingRef.current) {
        const dx = cx - dragStart.current.x;
        const dy = cy - dragStart.current.y;
        if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold) return;
        draggingRef.current = true;
        hasPannedRef.current = true;
        document.body.classList.add('is-panning');
      }
      panRef.current.x += cx - lastPos.current.x;
      panRef.current.y += cy - lastPos.current.y;
      lastPos.current = { x: cx, y: cy };
      // Direct DOM update (no React re-render needed during drag)
      const te = el.querySelector('.mindmap-transform') as HTMLElement;
      if (te) {
        te.style.left = panRef.current.x + 'px';
        te.style.top = panRef.current.y + 'px';
      }
    };

    const endDrag = () => {
      if (draggingRef.current) {
        document.body.classList.remove('is-panning');
        // Sync final position to React state
        setPan({ x: panRef.current.x, y: panRef.current.y });
      }
      draggingRef.current = false;
      dragStart.current = null;
    };

    el.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("mouseleave", endDrag);
    document.addEventListener("blur", endDrag);
    el.addEventListener("touchstart", onDown, { passive: false });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", endDrag);

    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", endDrag);
      document.removeEventListener("mouseleave", endDrag);
      document.removeEventListener("blur", endDrag);
      el.removeEventListener("touchstart", onDown);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", endDrag);
    };
  }, [filteredTree]);

  // Safety cleanup: ensure body cursor is reset on mount
  useEffect(() => {
    document.body.classList.remove('is-panning');
    return () => {
      document.body.classList.remove('is-panning');
    };
  }, []);
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    setScale((s) => Math.max(0.2, Math.min(2.5, s * delta)));
  }, []);

  const canvasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => { el.removeEventListener("wheel", onWheel); };
  }, [onWheel, filteredTree]);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // 浮动详情卡片状态（环图风格：点击先显示小卡片，再点"查看详情"打开面板）
  const [infoCardNode, setInfoCardNode] = useState<InternalTreeNode | null>(null);
  // 高亮节点（跳转后取消卡片时保持焦点）
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      const meta = nodeMetaMap.get(nodeId);
      if (!meta) return;
      setHighlightedNodeId(null);
      if (isMobile) {
        // 移动端：所有节点都显示底部浮动详情卡片
        setInfoCardNode(meta);
      } else if (meta.children.length > 0) {
        // 桌面端：非叶子节点展开/收起
        toggleCollapse(nodeId);
      } else if (meta.knowledgeData) {
        // 桌面端：叶子节点显示浮动详情卡片
        setInfoCardNode(meta);
      }
    },
    [nodeMetaMap, toggleCollapse, isMobile],
  );

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => {
      const meta = nodeMetaMap.get(nodeId);
      if (meta?.knowledgeData) {
        setSelectedKnowledge(meta.knowledgeData);
        setDrawerOpen(true);
        setHighlightedNodeId(null);
      }
    },
    [nodeMetaMap],
  );

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedKnowledge(null);
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("contextmenu", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
    };
  }, [contextMenu]);

  const searchLower = searchText.toLowerCase().trim();

  // ─── Auth guards ──────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: 16 }}>
        <Spin size="large" />
        <Text type="secondary">正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", flexDirection: "column", gap: 16 }}>
        <Alert type="error" message="用户未登录，请登录以访问知识图谱。" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ width: "100%", height: "100%", minHeight: 0, display: "flex", flexDirection: "column", background: "#f0f2f5", fontFamily: "'Microsoft YaHei','PingFang SC','Noto Sans SC',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", }}>
      <style>{`body.is-panning { cursor: grabbing !important; user-select: none; } body.is-panning * { cursor: grabbing !important; } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      {/* Toolbar */}
      <div style={{ minHeight: isMobile ? 36 : 48, background: "#fff", display: "flex", alignItems: "center", padding: isMobile ? "3px 6px" : "4px 16px", gap: isMobile ? 4 : 12, flexShrink: 0, borderBottom: "1px solid #e5e7eb", zIndex: 10, flexWrap: isMobile ? "wrap" : "nowrap" }}>
        <Input
          placeholder="搜索..."
          prefix={<SearchOutlined style={{ color: "#999" }} />}
          style={{ flex: isMobile ? "1 1 auto" : undefined, width: isMobile ? undefined : 220, minWidth: isMobile ? 80 : undefined, maxWidth: isMobile ? undefined : 220 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        {!isMobile && searchText && (
          <Text style={{ color: "#888", fontSize: 12, whiteSpace: "nowrap" }}>{allLayoutNodes.length - 1} 个节点</Text>
        )}
        <div style={{ flex: 1, minWidth: isMobile ? 0 : undefined }} />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 4 }}>
          <span style={{ color: "#666", fontSize: isMobile ? 10 : 12, padding: isMobile ? "0 2px" : undefined }}>{Math.round(scale * 100)}%</span>
          {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
            <button
              key={label as string}
              onClick={() => val === "reset" ? setScale(1.0) : setScale((s) => Math.max(0.2, Math.min(2.5, s + (val as number))))}
              style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 4, color: "#333", padding: isMobile ? "3px 8px" : "4px 12px", cursor: "pointer", fontSize: isMobile ? 12 : 14, lineHeight: 1 }}
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Canvas */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {!selectedCourseId ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <Empty description="请选择一个课程来查看知识关系图谱" />
            </div>
          ) : hierarchyError ? (
            <div style={{ padding: 24 }}>
              <Alert type="error" message={`加载知识树时出错: ${hierarchyError instanceof Error ? hierarchyError.message : "未知错误"}`} />
            </div>
          ) : hierarchyLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 24, justifyContent: "center", height: "100%" }}>
              <Spin size="large" />
              <Text>正在加载知识树...</Text>
            </div>
          ) : processedHierarchyData.length === 0 ? (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
              <Empty description={searchText ? "未找到匹配的知识点" : "该课程暂无知识节点数据"} />
            </div>
          ) : filteredTree && allLayoutNodes.length > 0 ? (
            <div
              ref={(el) => { containerRef.current = el; canvasRef.current = el; }}
              style={{ flex: 1, minHeight: 0, minWidth: 0, width: "100%", height: "100%", overflow: "hidden", cursor: "grab", background: "linear-gradient(135deg, #e8ecf1 0%, #f0f2f5 50%, #eef0f5 100%)" }}

            >
              <div className="mindmap-transform" style={{
                position: "absolute",
                left: pan.x,
                top: pan.y,
                zoom: scale,
                willChange: "left, top, zoom",
              }}>
                {/* SVG edges */}
                <svg style={{ position: "absolute", top: 0, left: 0, overflow: "visible", pointerEvents: "none" }} shapeRendering="geometricPrecision" textRendering="geometricPrecision">
                  {allEdges.map(([fromId, toId]) => {
                    const fp = positions[fromId];
                    const tp = positions[toId];
                    if (!fp || !tp) return null;
                    const side = getSide(toId, layoutTree!);
                    const dir = side === "left" ? -1 : 1;
                    const bIdx = branchIndexMap.get(toId) ?? 0;
                    const meta = nodeMetaMap.get(toId);
                    const depth = meta?.depth ?? 0;
                    const s = getNodeStyle(depth, bIdx, false);
                    return (
                      <path key={`${fromId}-${toId}`} d={makePath(fp, tp, dir)} fill="none" stroke={s.border} strokeWidth={1.6} opacity={0.65} strokeLinecap="round" />
                    );
                  })}
                </svg>

                {/* Nodes */}
                {allLayoutNodes.map((lnode) => {
                  const p = positions[lnode.id];
                  if (!p) return null;
                  const meta = nodeMetaMap.get(lnode.id);
                  const depth = meta?.depth ?? -1;
                  const bIdx = branchIndexMap.get(lnode.id) ?? 0;
                  const isHighlighted = searchLower ? (meta ? nodeMatchesSearch(meta, searchLower) : false) : highlightedNodeId === lnode.id;
                  const s = getNodeStyle(depth, bIdx, isHighlighted);
                  const isRoot = lnode.id === "__root__";
                  const hasChildren = meta ? meta.children.length > 0 : lnode.children.length > 0;
                  const isCollapsed = collapsedNodes.has(lnode.id);
                  const importanceLevel = meta?.knowledgeData?.importanceLevel;

                  let borderColor = s.border;
                  let nodeBg = s.bg;
                  let nodeText = s.text;
                  let extraShadow = "";
                  let importanceBadge: string | null = null;
                  if (!isHighlighted && importanceLevel) {
                    if (importanceLevel === "important") {
                      borderColor = IMPORTANT_BORDER;
                      nodeBg = "#fef3c7";
                      nodeText = "#92400e";
                      extraShadow = "0 0 0 2px rgba(245,158,11,0.25)";
                      importanceBadge = "重点";
                    } else if (importanceLevel === "hard") {
                      borderColor = HARD_BORDER;
                      nodeBg = "#fee2e2";
                      nodeText = "#991b1b";
                      extraShadow = "0 0 0 2px rgba(239,68,68,0.25)";
                      importanceBadge = "难点";
                    }
                  }

                  const openPanel = () => {
                    if (meta?.knowledgeData) {
                      setSelectedKnowledge(meta.knowledgeData);
                      setDrawerOpen(true);
                    }
                  };

                  return (
                    <Popover
                      key={lnode.id}
                      content={meta?.knowledgeData ? (
                        <div style={{ maxWidth: 220 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>{lnode.label}</div>
                          {meta.knowledgeData.knowledgeType && (
                            <div style={{ fontSize: 12, color: "#666" }}>类型: {KNOWLEDGE_TYPES[meta.knowledgeData.knowledgeType] || meta.knowledgeData.knowledgeType}</div>
                          )}
                          {meta.knowledgeData.description && (
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                              {meta.knowledgeData.description.length > 80 ? `${meta.knowledgeData.description.slice(0, 80)}...` : meta.knowledgeData.description}
                            </div>
                          )}
                          {importanceLevel && (
                            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>重要程度: {IMPORTANCE_LEVELS[importanceLevel.toLowerCase()] || importanceLevel}</div>
                          )}
                          <div
                            onClick={(e) => { e.stopPropagation(); openPanel(); }}
                            style={{ color: "#2573e6", marginTop: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "center", padding: "4px 0", borderTop: "1px solid #f0f0f0" }}
                          >
                            查看资源详情 →
                          </div>
                        </div>
                      ) : undefined}
                      placement="top"
                      trigger={isMobile ? [] : "hover"}
                    >
                      <div
                        className="mindmap-node"
                        style={{
                          position: "absolute", left: p.x, top: p.y, width: p.w, height: p.h,
                          background: nodeBg, color: nodeText, border: importanceBadge ? `2px solid ${borderColor}` : `1.5px solid ${borderColor}`, borderRadius: s.radius,
                          fontSize: s.fontSize, fontWeight: importanceBadge ? 600 : s.fontWeight,
                          display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center",
                          padding: "3px 10px", lineHeight: 1.4, whiteSpace: "pre-wrap", wordBreak: "break-word",
                          cursor: "pointer",
                          boxShadow: `${isRoot ? "0 2px 12px #0003" : isHighlighted ? "0 0 8px rgba(239,68,68,0.3)" : "0 1px 3px rgba(0,0,0,0.06)"}${extraShadow ? `, ${extraShadow}` : ""}`,
                          transition: "box-shadow .15s", userSelect: "none",
                          WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale",
                          letterSpacing: "0.01em",
                        }}
                        onClick={() => handleNodeClick(lnode.id)}
                        onDoubleClick={() => handleNodeDoubleClick(lnode.id)}
                        onContextMenu={(e) => handleContextMenu(e, lnode.id)}
                      >
                        <span>{lnode.label}</span>
                        {importanceBadge && (
                          <span style={{
                            marginLeft: 4, padding: "0 4px", borderRadius: 3, fontSize: 8, lineHeight: "16px",
                            background: importanceBadge === "重点" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                            color: importanceBadge === "重点" ? "#b45309" : "#dc2626",
                            fontWeight: 700, flexShrink: 0,
                          }}>
                            {importanceBadge}
                          </span>
                        )}
                        {hasChildren && !isRoot && (
                          <span style={{
                            position: "absolute", right: 3, top: "50%", transform: "translateY(-50%)",
                            fontSize: 9, color: nodeText + "99", lineHeight: 1,
                          }}>
                            {isCollapsed ? "+" : "−"}
                          </span>
                        )}
                      </div>
                    </Popover>
                  );
                })}
              </div>

              {/* Right-click context menu */}
              {contextMenu && (() => {
                const ctxMeta = nodeMetaMap.get(contextMenu.nodeId);
                const ctxHasChildren = ctxMeta ? ctxMeta.children.length > 0 : false;
                const ctxIsCollapsed = collapsedNodes.has(contextMenu.nodeId);
                const ctxIsRoot = contextMenu.nodeId === "__root__";
                return (
                  <div
                    style={{
                      position: "fixed", left: contextMenu.x, top: contextMenu.y,
                      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 1000, minWidth: 160,
                      padding: "4px 0", overflow: "hidden",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {ctxMeta?.knowledgeData && (
                      <div
                        style={{ padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#333", display: "flex", alignItems: "center", gap: 8 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        onClick={() => {
                          handleNodeDoubleClick(contextMenu.nodeId);
                          setContextMenu(null);
                        }}
                      >
                        <span style={{ fontSize: 14 }}>📄</span> 查看资源详情
                      </div>
                    )}
                    {ctxHasChildren && !ctxIsRoot && (
                      <div
                        style={{ padding: "8px 16px", cursor: "pointer", fontSize: 13, color: "#333", display: "flex", alignItems: "center", gap: 8 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        onClick={() => {
                          toggleCollapse(contextMenu.nodeId);
                          setContextMenu(null);
                        }}
                      >
                        <span style={{ fontSize: 14 }}>{ctxIsCollapsed ? "📂" : "📁"}</span>
                        {ctxIsCollapsed ? "展开子节点" : "收起子节点"}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* Legend */}
      <div style={{ minHeight: isMobile ? 22 : 36, background: "#f8f9fa", borderTop: "1px solid #ddd", display: "flex", alignItems: "center", padding: isMobile ? "1px 4px" : "0 16px", gap: isMobile ? 4 : 20, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, background: LEVEL_STYLES.root.bg, border: `1px solid ${LEVEL_STYLES.root.border}`, borderRadius: 2 }} />
          <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>根节点</span>
        </div>
        {BRANCH_COLORS.slice(0, 3).map((bc, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, background: bc.bg, border: `1px solid ${bc.border}`, borderRadius: 2 }} />
            <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>{i === 0 ? "一级分支" : ""}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, background: LEVEL_STYLES.depth_1.bg, border: `1px solid ${LEVEL_STYLES.depth_1.border}`, borderRadius: 2 }} />
          <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>二级节点</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, background: LEVEL_STYLES.depth_2.bg, border: `1px solid ${LEVEL_STYLES.depth_2.border}`, borderRadius: 2 }} />
          <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>三级节点</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, background: "#fef3c7", border: `2px solid ${IMPORTANT_BORDER}`, borderRadius: 2 }} />
          <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>重点</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, background: "#fee2e2", border: `2px solid ${HARD_BORDER}`, borderRadius: 2 }} />
          <span style={{ fontSize: isMobile ? 10 : 11, color: "#555" }}>难点</span>
        </div>
        {!isMobile && <><div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: "#999" }}>{isMobile ? "拖拽移动 · 单击折叠/展开 · 单击叶子节点查看资源" : "滚轮缩放 · 拖拽平移 · 单击折叠/展开 · 右键查看详情"}</span></>}
      </div>

      {/* 详情卡片 - 桌面端居中弹出，移动端底部滑出 */}
      {infoCardNode && (
        <>
          <div
            style={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0, inset: 0, zIndex: 999, background: "rgba(0,0,0,0.3)" } as React.CSSProperties}
            onClick={() => {
              if (infoCardNode.id === knowledgeId) {
                setHighlightedNodeId(knowledgeId);
              } else {
                setHighlightedNodeId(null);
              }
              setInfoCardNode(null);
            }}
          />
          <div style={isMobile ? {
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000,
            background: "#fff", borderRadius: "16px 16px 0 0",
            padding: "20px 16px 32px", maxHeight: "70vh", overflow: "auto",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.18)",
          } : {
            position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 1000,
            background: "#fff", borderRadius: 16,
            padding: "24px 28px", maxWidth: 360, width: "calc(100vw - 48px)",
            maxHeight: "80vh", overflow: "auto",
            boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
          }}>
            {isMobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: "#ddd", margin: "0 auto 16px" }} />}
            <div style={{ fontSize: isMobile ? 15 : 14, fontWeight: 700, color: "#333", marginBottom: 8 }}>
              {infoCardNode.label}
            </div>
            {infoCardNode.knowledgeData && (
              <>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  <Tag style={{ margin: 0, fontSize: 11 }}>
                    {KNOWLEDGE_TYPES[infoCardNode.knowledgeData.knowledgeType] || infoCardNode.knowledgeData.knowledgeType}
                  </Tag>
                  {infoCardNode.knowledgeData.importanceLevel && (
                    <Tag style={{ margin: 0, fontSize: 11 }} color={infoCardNode.knowledgeData.importanceLevel === "important" ? "orange" : infoCardNode.knowledgeData.importanceLevel === "hard" ? "red" : "default"}>
                      {IMPORTANCE_LEVELS[infoCardNode.knowledgeData.importanceLevel.toLowerCase()] || infoCardNode.knowledgeData.importanceLevel}
                    </Tag>
                  )}
                </div>
                {infoCardNode.knowledgeData.description && (
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 12, lineHeight: 1.5 }}>
                    {infoCardNode.knowledgeData.description.length > 100
                      ? `${infoCardNode.knowledgeData.description.slice(0, 100)}...`
                      : infoCardNode.knowledgeData.description}
                  </div>
                )}
              </>
            )}
            {infoCardNode.children.length > 0 && (
              <div style={{ fontSize: 12, color: "#999", marginBottom: 12 }}>
                含 {infoCardNode.children.length} 个子节点
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 6 }}>
              {infoCardNode.children.length > 0 && (
                <Button
                  block={isMobile} size={isMobile ? "large" : "middle"}
                  onClick={() => {
                    toggleCollapse(infoCardNode.id);
                    setInfoCardNode(null);
                    if (infoCardNode.id !== knowledgeId) setHighlightedNodeId(null);
                  }}
                  style={{ borderRadius: isMobile ? 10 : 8, height: isMobile ? 48 : 34, fontSize: isMobile ? 15 : 13 }}
                >
                  {collapsedNodes.has(infoCardNode.id) ? "展开子节点" : "收起子节点"}
                </Button>
              )}
              {infoCardNode.knowledgeData && (
                <Button
                  block={isMobile} size={isMobile ? "large" : "middle"} type="primary"
                  onClick={() => {
                    setSelectedKnowledge(infoCardNode.knowledgeData);
                    setDrawerOpen(true);
                    setInfoCardNode(null);
                    setHighlightedNodeId(null);
                  }}
                  style={{ borderRadius: isMobile ? 10 : 8, height: isMobile ? 48 : 34, fontSize: isMobile ? 15 : 13 }}
                >
                  查看资源详情
                </Button>
              )}
              <Button
                block={isMobile} size={isMobile ? "large" : "middle"}
                onClick={() => {
                  setInfoCardNode(null);
                  if (infoCardNode.id === knowledgeId) {
                    setHighlightedNodeId(knowledgeId);
                  }
                }}
                style={{ borderRadius: isMobile ? 10 : 8, height: isMobile ? 48 : 34, fontSize: isMobile ? 15 : 13 }}
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
