import React, { useCallback, useMemo, useRef, useState } from "react";
import ReactFlow, {
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  Node,
  Edge,
  ConnectionMode,
  BackgroundVariant,
  getBezierPath,
  EdgeProps,
  Position,
  Handle,
} from "reactflow";
import "reactflow/dist/style.css";

import {
  Typography,
  Spin,
  Alert,
  Button,
  Tag,
  Space,
  Divider,
  Empty,
  Drawer,
  Input,
  List,
  Grid,
} from "antd";
import {
  BookOutlined,
  QuestionCircleOutlined,
  SearchOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import { QuestionLevelConfigModal } from "@/components/QuestionLevelConfigModal";

import { useQuery } from "@tanstack/react-query";
import {
  listQuestions,
  listConnections,
  listKnowledges,
  type QuestionResourceSchema,
  type QuestionConnectionResourceSchema,
  type ResourceResourceSchema,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { useGraphCourse } from "@/hooks/use-graph-course";
import { useQuestionLevelConfig } from "@/hooks/use-question-level-config";

const { Text } = Typography;

const CONNECTION_TYPE_LABELS = {
  hierarchy: "层级关系",
  dependency: "依赖关系",
  related: "相关关系",
} as const;

const NODE_HEIGHT = 100;
const NODE_MIN_WIDTH = 280;
const NODE_SPACING_Y = 150;

// 模块级常量，避免 useMemo 每次返回新的空数组引用导致无限渲染循环
const EMPTY_NODES: Node[] = [];
const EMPTY_EDGES: Edge[] = [];

const CONNECTION_TYPE_STYLES: Record<string, { strokeWidth: number; dashArray: string }> = {
  hierarchy: { strokeWidth: 5, dashArray: "none" },
  dependency: { strokeWidth: 5, dashArray: "8 4" },
  related: { strokeWidth: 5, dashArray: "4 4" },
};

function GradientEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  source,
  target,
}: EdgeProps) {
  const sourceColor = (data?.sourceColor as string) || "#999";
  const targetColor = (data?.targetColor as string) || "#999";
  const connStyle =
    CONNECTION_TYPE_STYLES[(data?.connectionType as string)] ||
    CONNECTION_TYPE_STYLES.hierarchy;

  const isLeftToRight = targetX > sourceX;
  const sourcePos = isLeftToRight ? Position.Right : Position.Left;
  const targetPos = isLeftToRight ? Position.Left : Position.Right;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition: sourcePos,
    targetX,
    targetY,
    targetPosition: targetPos,
    curvature: 0.3,
  });

  const gradientId = `grad-${id}`;

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor="#D4537E" stopOpacity={0.2} />
          <stop offset="50%" stopColor="#D4537E" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#D4537E" stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={connStyle.strokeWidth}
        strokeLinecap="round"
        className="react-flow__edge-interaction"
      />
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={connStyle.strokeWidth}
        strokeLinecap="round"
        className="react-flow__edge-path"
      />
      <circle
        cx={sourceX}
        cy={sourceY}
        r={5}
        fill="white"
        stroke={sourceColor}
        strokeWidth={2}
      />
      <circle
        cx={targetX}
        cy={targetY}
        r={5}
        fill="white"
        stroke={targetColor}
        strokeWidth={2}
      />
    </>
  );
}

const edgeTypes = {
  gradient: GradientEdge,
};

function QuestionNode({ data }: { data: { label: React.ReactNode } }) {
  return (
    <>
      <Handle type="source" position={Position.Left} id="left" style={{ background: "#fff", width: 8, height: 8, border: "2px solid #999" }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: "#fff", width: 8, height: 8, border: "2px solid #999" }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: "#fff", width: 8, height: 8, border: "2px solid #999" }} />
      <Handle type="target" position={Position.Right} id="right" style={{ background: "#fff", width: 8, height: 8, border: "2px solid #999" }} />
      {data.label}
    </>
  );
}

const nodeTypes = {
  question: QuestionNode,
};

interface QuestionDetailsPanelProps {
  question: QuestionResourceSchema | null;
  knowledgeData: ResourceResourceSchema | null;
  onKnowledgeClick: (knowledge: ResourceResourceSchema) => void;
  getLabel: (levelKey: string) => string;
  getColor: (levelKey: string) => string;
}

function QuestionDetailsPanel({
  question,
  knowledgeData,
  onKnowledgeClick,
  getLabel,
  getColor,
}: QuestionDetailsPanelProps) {
  if (!question) return null;

  return (
    <Space direction="vertical" style={{ width: "100%" }} size="middle">
      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, display: "block", marginBottom: 4 }}
        >
          问题标题
        </Text>
        <Text strong style={{ fontSize: 15 }}>{question.title}</Text>
      </div>

      <Divider style={{ margin: "8px 0" }} />

      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, display: "block", marginBottom: 4 }}
        >
          问题级别
        </Text>
        <Tag
          style={{
            backgroundColor: getColor(question.questionLevel),
            color: "white",
            border: "none",
          }}
        >
          {getLabel(question.questionLevel)}
        </Tag>
      </div>

      {question.description && (
        <div>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            问题描述
          </Text>
          <Text type="secondary">{question.description}</Text>
        </div>
      )}

      <div>
        <Text
          type="secondary"
          style={{ fontSize: 12, display: "block", marginBottom: 4 }}
        >
          位置顺序
        </Text>
        <Text>{question.position}</Text>
      </div>

      {question.tags && question.tags.length > 0 && (
        <div>
          <Text
            type="secondary"
            style={{ fontSize: 12, display: "block", marginBottom: 4 }}
          >
            标签
          </Text>
          <Space wrap>
            {question.tags.map((tag, index) => (
              <Tag key={index}>{tag}</Tag>
            ))}
          </Space>
        </div>
      )}

      <Divider style={{ margin: "8px 0" }} />

      <div>
        <Text
          strong
          style={{ fontSize: 14, display: "block", marginBottom: 8 }}
        >
          <BookOutlined /> 关联知识点
        </Text>
        {knowledgeData ? (
          <List
            size="small"
            bordered
            dataSource={[knowledgeData]}
            renderItem={(item) => (
              <List.Item
                style={{ cursor: "pointer" }}
                onClick={() => onKnowledgeClick(item)}
              >
                <Space>
                  <BookOutlined />
                  <Text>{item.name}</Text>
                  <Tag color="blue">
                    {item.knowledgeType === "subject" ? "学科" : item.knowledgeType === "knowledge_unit" ? "知识单元" : "知识点"}
                  </Tag>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无关联知识点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </div>
    </Space>
  );
}

export default function TeacherGraphQuestionView({ courseId, hideManagement }: { courseId?: string; hideManagement?: boolean }) {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedQuestion, setSelectedQuestion] =
    React.useState<QuestionResourceSchema | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] =
    React.useState<ResourceResourceSchema | null>(null);
  const [isLayoutResetting, setIsLayoutResetting] = React.useState(false);
  const [searchText, setSearchText] = useState("");
  const [configModalOpen, setConfigModalOpen] = React.useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const reactFlowRef = useRef<any>(null);
  const { selectedCourseId, setSelectedCourseId } = useGraphCourse();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();
  const questionLevelConfig = useQuestionLevelConfig(selectedCourseId || undefined);
  const { getLabel: rawGetLabel, getColor: rawGetColor, getDescription: rawGetDescription, shouldSeed, seedDefaults, isSeeding, configs } = questionLevelConfig;

  // 安全包装：确保函数始终返回有效值
  const getLabel = useCallback((levelKey: string): string => {
    try {
      return rawGetLabel?.(levelKey) || levelKey;
    } catch {
      return levelKey;
    }
  }, [rawGetLabel]);

  const getColor = useCallback((levelKey: string): string => {
    try {
      return rawGetColor?.(levelKey) || "#999";
    } catch {
      return "#999";
    }
  }, [rawGetColor]);

  const getDescription = useCallback((levelKey: string): string => {
    try {
      return rawGetDescription?.(levelKey) || "";
    } catch {
      return "";
    }
  }, [rawGetDescription]);

  // Auto-seed defaults when no configs exist
  const seedExecutedRef = React.useRef(false);
  const seedCourseIdRef = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    // 课程切换时重置 seed 标志
    if (selectedCourseId !== seedCourseIdRef.current) {
      seedCourseIdRef.current = selectedCourseId;
      seedExecutedRef.current = false;
    }
    if (shouldSeed && !isSeeding && !seedExecutedRef.current) {
      seedExecutedRef.current = true;
      seedDefaults();
    }
  }, [shouldSeed, isSeeding, seedDefaults, selectedCourseId]);

  React.useEffect(() => {
    if (courseId && !selectedCourseId) {
      setSelectedCourseId(courseId);
    }
  }, [courseId, selectedCourseId, setSelectedCourseId]);

  const { data: questionsData, isLoading: questionsLoading } = useQuery({
    queryKey: [
      "teacher-question-graph",
      "questions",
      currentTenant?.schemaName,
      selectedCourseId,
    ],
    queryFn: () =>
      listQuestions({
        fields: [
          "id",
          "title",
          "description",
          "questionLevel",
          "position",
          "tags",
          "courseId",
          "knowledgeResourceId",
        ],
        filter: selectedCourseId
          ? { courseId: { eq: selectedCourseId } }
          : undefined,
        tenant: currentTenant?.schemaName || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    enabled: !!currentTenant?.schemaName && !!selectedCourseId,
  });

  const { data: knowledgeData } = useQuery({
    queryKey: [
      "teacher-question-graph",
      "knowledge",
      selectedQuestion?.knowledgeResourceId,
    ],
    queryFn: () =>
      listKnowledges({
        fields: [
          "id",
          "name",
          "description",
          "knowledgeType",
          "importanceLevel",
        ],
        filter: selectedQuestion?.knowledgeResourceId
          ? { id: { eq: selectedQuestion.knowledgeResourceId } }
          : undefined,
        tenant: currentTenant?.schemaName || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    enabled: !!currentTenant?.schemaName && !!selectedQuestion?.knowledgeResourceId,
  });

  const currentKnowledge = extractArrayData(knowledgeData)[0] as ResourceResourceSchema | null;

  const { data: connectionsData, isLoading: connectionsLoading } = useQuery({
    queryKey: [
      "teacher-question-graph",
      "connections",
      currentTenant?.schemaName,
      selectedCourseId,
    ],
    queryFn: () =>
      listConnections({
        fields: [
          "id",
          "connectionType",
          "sourceQuestionId",
          "targetQuestionId",
          "courseId",
        ],
        filter: selectedCourseId
          ? { courseId: { eq: selectedCourseId } }
          : undefined,
        tenant: currentTenant?.schemaName || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      }),
    enabled: !!currentTenant?.schemaName && !!selectedCourseId,
  });

  const questionNodes = useMemo(() => {
    if (!questionsData) return EMPTY_NODES;

    const questions: QuestionResourceSchema[] = extractArrayData(questionsData);

    if (questions.length === 0) return EMPTY_NODES;

    const searchLower = searchText.toLowerCase().trim();
    const filteredQuestions = searchLower
      ? questions.filter((q) =>
          q.title.toLowerCase().includes(searchLower) ||
          (q.description && q.description.toLowerCase().includes(searchLower))
        )
      : questions;

    if (filteredQuestions.length === 0) return EMPTY_NODES;

    const levelGroups = filteredQuestions.reduce<
      Record<string, QuestionResourceSchema[]>
    >((acc, question) => {
      if (!acc[question.questionLevel]) {
        acc[question.questionLevel] = [];
      }
      acc[question.questionLevel].push(question);
      return acc;
    }, {});

    const levelPositions = {
      global: { x: 50, y: 160 },
      concept: { x: 450, y: 160 },
      method: { x: 850, y: 160 },
    };

    const nodes: Node[] = [];

    const globalCount = levelGroups.global?.length || 0;
    const conceptCount = levelGroups.concept?.length || 0;
    const methodCount = levelGroups.method?.length || 0;

    // Header nodes with level-colored backgrounds
    const headerPositions: Record<string, { x: number; y: number }> = {
      global: { x: 70, y: 10 },
      concept: { x: 470, y: 10 },
      method: { x: 870, y: 10 },
    };
    const headerCounts: Record<string, number> = { global: globalCount, concept: conceptCount, method: methodCount };

    for (const levelKey of ["global", "concept", "method"] as const) {
      const color = getColor(levelKey);
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      nodes.push({
        id: `header-${levelKey}`,
        type: "default",
        data: {
          label: (
            <div className="text-center px-2 py-1">
              <div className="font-bold text-sm">{getLabel(levelKey)}</div>
              <div className="text-xs" style={{ opacity: 0.75, marginTop: 2 }}>{getDescription(levelKey)}</div>
            </div>
          ),
        },
        position: headerPositions[levelKey],
        style: {
          background: `rgba(${r}, ${g}, ${b}, 0.1)`,
          color: `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 40)})`,
          border: `1px solid rgba(${r}, ${g}, ${b}, 0.25)`,
          borderRadius: "8px",
          width: NODE_MIN_WIDTH,
        },
        draggable: false,
      });
    }

    // Question nodes with shadows
    Object.entries(levelGroups).forEach(([level, levelQuestions]) => {
      let cumulativeY = levelPositions[level as keyof typeof levelPositions].y;

      levelQuestions.forEach((question, index) => {
        const basePosition =
          levelPositions[level as keyof typeof levelPositions];
        const levelColor = getColor(level);

        // 计算预估高度：基础高度 + 每行约20px
        const text = question.description || question.title;
        const lines = Math.ceil(text.length / 20); // 每行约20个字符
        const tagsText = Array.isArray(question.tags) ? question.tags.join(" ") : "";
        const tagsLines = tagsText ? Math.ceil(tagsText.length / 25) : 0;
        const estimatedHeight = Math.max(80, 60 + (lines + tagsLines) * 20);

        nodes.push({
          id: question.id,
          type: "question",
          data: {
            label: (
              <div style={{
                padding: "10px 14px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                overflow: "visible",
              }}>
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: "20px", wordBreak: "break-word" }}>
                  {question.description || question.title}
                </div>
                {Array.isArray(question.tags) && question.tags.length > 0 && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", lineHeight: "16px", marginTop: 4 }}>
                    {question.tags.join(" ")}
                  </div>
                )}
              </div>
            ),
          },
          position: {
            x: basePosition.x,
            y: cumulativeY,
          },
          style: {
            background: levelColor,
            color: "white",
            border: "none",
            borderRadius: "12px",
            width: NODE_MIN_WIDTH,
            height: estimatedHeight,
            fontSize: "13px",
            cursor: "pointer",
            boxShadow: `0 4px 14px ${levelColor}40, 0 2px 6px ${levelColor}20`,
          },
        });

        // 累积高度：节点高度 + 间距
        cumulativeY += estimatedHeight + 30;
      });
    });

    return nodes;
  }, [questionsData, searchText, getLabel, getColor, getDescription]);

  const connectionEdges = useMemo(() => {
    if (!connectionsData || !questionsData) return EMPTY_EDGES;

    const connections = extractArrayData(connectionsData);
    const questions = extractArrayData(questionsData);

    if (connections.length === 0) return EMPTY_EDGES;

    const searchLower = searchText.toLowerCase().trim();
    const filteredQuestionIds = searchLower
      ? questions
          .filter((q: QuestionResourceSchema) =>
            q.title.toLowerCase().includes(searchLower) ||
            (q.description && q.description.toLowerCase().includes(searchLower))
          )
          .map((q: QuestionResourceSchema) => q.id)
      : null;

    return connections
      .filter((connection: QuestionConnectionResourceSchema) => {
        if (!filteredQuestionIds) return true;
        return (
          filteredQuestionIds.includes(connection.sourceQuestionId) ||
          filteredQuestionIds.includes(connection.targetQuestionId)
        );
      })
      .map((connection: QuestionConnectionResourceSchema) => {
        const sourceQuestion = questions.find(
          (q: QuestionResourceSchema) => q.id === connection.sourceQuestionId,
        );
        const targetQuestion = questions.find(
          (q: QuestionResourceSchema) => q.id === connection.targetQuestionId,
        );

        const sourceColor =
          getColor(sourceQuestion?.questionLevel || "global");
        const targetColor =
          getColor(targetQuestion?.questionLevel || "global");

        const sourceLevel = sourceQuestion?.questionLevel || "global";
        const targetLevel = targetQuestion?.questionLevel || "global";
        const levelOrder: Record<string, number> = { global: 0, concept: 1, method: 2 };
        const isLeftToRight = (levelOrder[sourceLevel] || 0) <= (levelOrder[targetLevel] || 0);

        return {
          id: connection.id,
          type: "gradient" as const,
          source: connection.sourceQuestionId,
          target: connection.targetQuestionId,
          sourceHandle: isLeftToRight ? "right" : "left",
          targetHandle: isLeftToRight ? "left" : "right",
          data: {
            sourceColor,
            targetColor,
            connectionType: connection.connectionType,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: targetColor,
            width: 20,
            height: 20,
          },
        };
      });
  }, [connectionsData, questionsData, searchText]);

  React.useEffect(() => {
    if (isLayoutResetting) {
      setNodes(questionNodes.map((node: Node) => ({
        ...node,
        style: {
          ...node.style,
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        },
      })));
    } else {
      setNodes(questionNodes);
    }
  }, [questionNodes, setNodes, isLayoutResetting]);

  React.useEffect(() => {
    if (isLayoutResetting) {
      setEdges(connectionEdges.map((edge: Edge) => ({
        ...edge,
        style: {
          ...edge.style,
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        },
      })));
    } else {
      setEdges(connectionEdges);
    }
  }, [connectionEdges, setEdges, isLayoutResetting]);

  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (node.id.startsWith("header-")) return;

      const questions = extractArrayData(questionsData);
      const question = questions.find(
        (q: QuestionResourceSchema) => q.id === node.id,
      );
      if (question) {
        setSelectedQuestion(question);
      }
    },
    [questionsData],
  );

  const handlePanelClose = useCallback(() => {
    setSelectedQuestion(null);
  }, []);

  const handleKnowledgeClick = useCallback((knowledge: ResourceResourceSchema) => {
    setSelectedKnowledge(knowledge);
    setSelectedQuestion(null);
  }, []);

  const handleKnowledgePanelClose = useCallback(() => {
    setSelectedKnowledge(null);
  }, []);

  const applyDagreLayout = useCallback(() => {
    setIsLayoutResetting(true);

    setNodes((currentNodes: Node[]) => {
      const layoutNodes = [...currentNodes];

      const headerNodes = layoutNodes.filter(
        (node) => node.id.startsWith("header-") || node.draggable === false,
      );
      const questionNodesList = layoutNodes.filter(
        (node) => !node.id.startsWith("header-") && node.draggable !== false,
      );

      const levelGroups = {
        global: [] as Node[],
        concept: [] as Node[],
        method: [] as Node[],
      };

      const questions = extractArrayData(questionsData);
      questionNodesList.forEach((node) => {
        const question = questions.find(
          (q: QuestionResourceSchema) => q.id === node.id,
        );
        if (question && question.questionLevel) {
          levelGroups[question.questionLevel as keyof typeof levelGroups].push(
            node,
          );
        } else {
          levelGroups.global.push(node);
        }
      });

      const levelPositions = {
        global: { x: 50, y: 160 },
        concept: { x: 450, y: 160 },
        method: { x: 850, y: 160 },
      };

      Object.entries(levelGroups).forEach(([level, nodes]) => {
        const basePosition =
          levelPositions[level as keyof typeof levelPositions];

        let cumulativeY = basePosition.y;
        nodes.forEach((node) => {
          // 从节点样式中获取高度
          const nodeHeight = (node.style?.height as number) || 80;
          node.position = {
            x: basePosition.x,
            y: cumulativeY,
          };
          cumulativeY += nodeHeight + 30;
        });
      });

      headerNodes.forEach((node) => {
        if (node.id === "header-global") {
          node.position = { x: 70, y: 10 };
        } else if (node.id === "header-concept") {
          node.position = { x: 470, y: 10 };
        } else if (node.id === "header-method") {
          node.position = { x: 870, y: 10 };
        }
      });

      return [...headerNodes, ...questionNodesList];
    });

    setTimeout(() => setIsLayoutResetting(false), 500);
  }, [setNodes, questionsData]);

  // Auto reset layout when data first loads for a course
  const hasAutoReset = React.useRef(false);
  const lastAutoResetCourseId = React.useRef<string | undefined>(undefined);
  React.useEffect(() => {
    // 当课程切换时，重置自动布局标志
    if (selectedCourseId !== lastAutoResetCourseId.current) {
      lastAutoResetCourseId.current = selectedCourseId;
      hasAutoReset.current = false;
    }
    if (questionsData && !hasAutoReset.current && selectedCourseId) {
      // 延迟一下确保节点已设置完成
      setTimeout(() => {
        hasAutoReset.current = true;
        applyDagreLayout();
      }, 300);
    }
  }, [questionsData, selectedCourseId]);

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="warning" message="请先选择租户才能查看问题图谱" showIcon />
      </div>
    );
  }

  const isLoading = questionsLoading || connectionsLoading;

  if (isLoading && selectedCourseId) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" tip="加载问题图谱中..." />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: "#ffffff",
      }}
    >
      <div
        style={{
          minHeight: isMobile ? 36 : 48,
          padding: isMobile ? "3px 6px" : "4px 16px",
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 4 : 16,
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "white",
          flexShrink: 0,
          flexWrap: isMobile ? "wrap" : "nowrap",
        }}
      >
        <Input
          placeholder="搜索..."
          prefix={<SearchOutlined style={{ color: "#999" }} />}
          style={{ flex: isMobile ? "1 1 auto" : undefined, width: isMobile ? undefined : 220, minWidth: isMobile ? 80 : undefined, maxWidth: isMobile ? undefined : 220 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
        <div style={{ flex: 1, minWidth: isMobile ? 0 : undefined }} />
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 4 }}>
          <span style={{ color: "#666", fontSize: isMobile ? 10 : 12, padding: isMobile ? "0 2px" : undefined }}>{zoomPercent}%</span>
          {[["−", -0.15], ["+", 0.15], ["⟳", "reset"]].map(([label, val]) => (
            <button key={label as string} onClick={() => {
              if (!reactFlowRef.current) return;
              try {
                if (val === "reset") {
                  reactFlowRef.current.fitView({ duration: 300, padding: 0.3 });
                } else if (val === -0.15) {
                  reactFlowRef.current.zoomOut({ duration: 300 });
                } else {
                  reactFlowRef.current.zoomIn({ duration: 300 });
                }
              } catch {}
            }}
              style={{ background: "#f5f5f5", border: "1px solid #d9d9d9", borderRadius: 4, color: "#333", padding: isMobile ? "3px 8px" : "4px 12px", cursor: "pointer", fontSize: isMobile ? 12 : 14, lineHeight: 1 }}>
              {label as string}
            </button>
          ))}
        </div>
        {!hideManagement && canEdit && (
          <Button
            icon={<SettingOutlined />}
            onClick={() => setConfigModalOpen(true)}
          >
            配置
          </Button>
        )}
      </div>

      <div style={{ flex: 1, position: "relative" }}>
        {selectedCourseId ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            edgeTypes={edgeTypes}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{
              padding: 0.3,
              includeHiddenNodes: false,
              maxZoom: 1,
              minZoom: 0.3,
            }}
            attributionPosition="bottom-left"
            onInit={(instance) => { reactFlowRef.current = instance; }}
            onMoveEnd={(_event, viewport) => { setZoomPercent(Math.round(viewport.zoom * 100)); }}
          >
            <MiniMap
              nodeColor={(node: Node) => {
                if (node.style?.background)
                  return node.style.background as string;
                return "#e5e7eb";
              }}
            />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <Empty description="请选择一个课程来查看问题图谱" />
          </div>
        )}
      </div>

      {selectedQuestion && (
        <Drawer
          title="问题详情"
          placement="right"
          width={420}
          onClose={handlePanelClose}
          open={!!selectedQuestion}
        >
          <QuestionDetailsPanel
            question={selectedQuestion}
            knowledgeData={currentKnowledge}
            onKnowledgeClick={handleKnowledgeClick}
            getLabel={getLabel}
            getColor={getColor}
          />
        </Drawer>
      )}

      <KnowledgeResourcePanel
        open={!!selectedKnowledge}
        onClose={handleKnowledgePanelClose}
        knowledge={selectedKnowledge}
      />

      <QuestionLevelConfigModal
        open={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        courseId={selectedCourseId}
      />
    </div>
  );
}
