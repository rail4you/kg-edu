import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Spin,
  Alert,
  Tag,
  Tooltip,
  Card,
  Row,
  Col,
  Empty,
  Table,
  Input,
  Modal,
  Button,
  Divider,
  Pagination,
  Space,
  Statistic,
  Select,
  Grid,
  List,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PageHead, ProtoTabs } from "@/components/proto";
import {
  ApartmentOutlined,
  NodeIndexOutlined,
  GoldOutlined,
  QuestionCircleOutlined,
  BulbOutlined,
  HistoryOutlined,
  BookOutlined,
  TrophyOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
  FileOutlined,
  LeftOutlined,
  ReadOutlined,
  ClusterOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { listCourses, listRelations, listExercises, listFiles, listActivityLogs, getVideo, getExercise, getHomework } from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import TeacherGraphTreeView from "@/pages/teacher/graph-tree";
import TeacherGraphCircleView from "@/pages/teacher/graph-circle";
import TeacherGraphKnowledgeView from "@/pages/teacher/graph-knowledge";
import TeacherGraphQuestionView from "@/pages/teacher/graph-question";
import TeacherGraphIdeological from "@/pages/teacher/graph-ideological";
import StudentJobCompetencyGraph from "@/pages/student/job-competency-graph";
import { StudentCompetencyGraphView } from "@/pages/student/graph-competency";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text } = Typography;
const { useBreakpoint } = Grid;

const simplifyFileType = (filename: string, fileType?: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (ext === "pptx" || ext === "ppt") return "PPT";
  if (ext === "xlsx" || ext === "xls") return "Excel";
  if (ext === "docx" || ext === "doc") return "Word";
  if (ext === "pdf") return "PDF";
  if (ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif") return "图片";
  if (ext === "txt") return "文本";
  if (ext === "zip" || ext === "rar" || ext === "tar" || ext === "gz") return "压缩包";
  if (ext === "mp4" || ext === "avi" || ext === "mov" || ext === "wmv") return "视频";
  if (ext === "mp3" || ext === "wav" || ext === "ogg") return "音频";
  if (!fileType) return ext || "未知";
  const type = fileType.toLowerCase();
  if (type.includes("pdf") || type === "application/pdf") return "PDF";
  if (type.includes("word") || type.includes("doc") || type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "Word";
  if (type.includes("excel") || type.includes("sheet") || type.includes("xls") || type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return "Excel";
  if (type.includes("powerpoint") || type.includes("presentationml")) return "PPT";
  if (type.includes("image") || type.includes("jpg") || type.includes("png") || type.includes("jpeg") || type.includes("gif"))
    return "图片";
  if (type.includes("text") || type.includes("txt")) return "文本";
  if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz") || type.includes("compressed"))
    return "压缩包";
  if (type.includes("video") || type.startsWith("video/")) return "视频";
  if (type.includes("audio") || type.startsWith("audio/")) return "音频";
  const parts = fileType.split("/");
  if (parts.length >= 2) {
    return parts[parts.length - 1].split(".")[0].toUpperCase();
  }
  return ext || fileType;
};

/** 顶级同级 Tab：知识图谱 / 岗位能力图谱 */
const MAIN_TABS = [
  { value: "knowledge", label: "知识图谱" },
  { value: "job", label: "岗位能力图谱" },
] as const;
type MainTabKey = typeof MAIN_TABS[number]["value"];

/** 知识图谱下的视图 */
const KNOWLEDGE_TABS = [
  { key: "tree", label: "树图", icon: <ApartmentOutlined /> },
  { key: "circle", label: "环图", icon: <NodeIndexOutlined /> },
  { key: "knowledge", label: "层次结构图", icon: <GoldOutlined /> },
  { key: "competency", label: "能力图谱", icon: <TrophyOutlined /> },
  { key: "question", label: "问题图", icon: <QuestionCircleOutlined /> },
  { key: "ideological", label: "思政图谱", icon: <BookOutlined /> },
  { key: "activity", label: "学习数据历史", icon: <HistoryOutlined /> },
] as const;
type KnowledgeViewKey = typeof KNOWLEDGE_TABS[number]["key"];

// Helper functions for activity history
const getActionTypeLabel = (actionType: string) => {
  switch (actionType) {
    case "video_view":
      return "视频观看";
    case "exercise_submit":
      return "练习提交";
    case "homework_submit":
      return "作业提交";
    case "file_view":
      return "文件查看";
    default:
      return actionType;
  }
};

const getActionTypeColor = (actionType: string) => {
  void actionType;
  return "blue";
};

const getResourceTypeLabel = (resourceType: string) => {
  switch (resourceType?.toLowerCase()) {
    case "video":
      return "视频";
    case "exercise":
      return "练习";
    case "homework":
      return "作业";
    case "file":
      return "文件";
    default:
      return resourceType || "-";
  }
};

const getResourceTypeColor = (resourceType: string) => {
  void resourceType;
  return "blue";
};

const getQuestionTypeLabel = (questionType: string) => {
  switch (questionType) {
    case "multiple_choice":
      return "单选题";
    case "multiple_response":
      return "多选题";
    case "true_false":
      return "判断题";
    case "essay":
      return "问答题";
    case "fill_blank":
    case "fill_in_blank":
      return "填空题";
    case "term_definition":
      return "名词解释";
    case "case_study":
      return "案例题";
    default:
      return questionType || "-";
  }
};

const getAiTypeLabel = (aiType: string) => {
  switch (aiType) {
    case "ai_generated":
      return "AI生成";
    case "manual":
      return "手动创建";
    default:
      return aiType || "-";
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString("zh-CN");
};

function ActivityHistoryView({ courseId }: { courseId: string }) {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [resourceDetails, setResourceDetails] = useState<Map<string, any>>(new Map());
  const [loadingResources, setLoadingResources] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [homeworkAnswerModal, setHomeworkAnswerModal] = useState<{
    open: boolean;
    answer: string;
    title: string;
  }>({ open: false, answer: "", title: "" });
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");

  const pageSize = 10;

  // Function to fetch resource details
  const fetchResourceDetails = async (resourceType: string, resourceId: string) => {
    if (!resourceId || !resourceType) {
      return null;
    }

    const normalizedResourceType = resourceType.toLowerCase();

    try {
      let response;
      switch (normalizedResourceType) {
        case "video":
          response = await getVideo({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "duration", "chapterId"],
            filter: { id: { eq: resourceId } },
            page: { limit: 1 },
            headers: getHeaders(user),
          });
          if (response.success && Array.isArray(response.data) && response.data[0]) {
            return response.data[0];
          }
          if (response.success && (response.data as any)?.results?.[0]) {
            return (response.data as any).results[0];
          }
          return null;
        case "exercise":
          response = await getExercise({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "questionType", "aiType", "knowledgeResourceId", "answer", "questionContent", "options"],
            input: { id: resourceId },
            headers: getHeaders(user),
          });
          break;
        case "homework":
          response = await getHomework({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "score", "chapterId", "knowledgeResourceId", "content", "answer"],
            input: { id: resourceId },
            headers: getHeaders(user),
          });
          break;
        case "file":
          response = await listFiles({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "filename", "fileType"],
            filter: { id: { eq: resourceId } },
            page: { limit: 1 },
            headers: getHeaders(user),
          });
          if (response.success && response.data.results?.[0]) {
            return response.data.results[0];
          }
          return null;
        default:
          return null;
      }

      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching ${resourceType} details:`, error);
      return null;
    }
  };

  // Fetch user's activity logs (load more for client-side search)
  const { data: activityLogsData, isLoading } = useQuery({
    queryKey: ["user-activity-logs", user?.id, courseId],
    queryFn: () => {
      if (!user?.id) return { success: true, data: { results: [], count: 0 } };

      const filter: any = {
        userId: { eq: user.id },
      };

      return listActivityLogs({
        tenant: currentTenant?.schemaName || "public",
        fields: ["id", "actionType", "resourceType", "resourceId", "insertedAt", "metadata"],
        filter,
        sort: "-insertedAt",
        page: { limit: 500, offset: 0 },
        headers: getHeaders(user),
      });
    },
    enabled: !!user?.id && !!currentTenant,
  });

  const allActivityLogs = useMemo(() => {
    if (!activityLogsData?.success) return [];
    const data = (activityLogsData as any).data;
    if (Array.isArray(data?.results)) return data.results;
    if (Array.isArray(data)) return data;
    return [];
  }, [activityLogsData]);

  // Filter logs by search term and filters
  const filteredLogs = useMemo(() => {
    let logs = allActivityLogs;

    if (activityTypeFilter !== "all") {
      logs = logs.filter((log: any) => log.actionType === activityTypeFilter);
    }
    if (resourceTypeFilter !== "all") {
      logs = logs.filter((log: any) => log.resourceType?.toLowerCase() === resourceTypeFilter);
    }
    if (!searchTerm.trim()) return logs;

    const term = searchTerm.toLowerCase().trim();
    return logs.filter((log: any) => {
      if (getActionTypeLabel(log.actionType).toLowerCase().includes(term)) return true;
      if (getResourceTypeLabel(log.resourceType).toLowerCase().includes(term)) return true;
      const cacheKey = `${log.resourceType}-${log.resourceId}`;
      const details = resourceDetails.get(cacheKey);
      if (details?.title?.toLowerCase().includes(term)) return true;
      return false;
    });
  }, [allActivityLogs, searchTerm, resourceDetails, activityTypeFilter, resourceTypeFilter]);

  // Paginate filtered results
  const activityLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  const totalCount = filteredLogs.length;

  // Load resource details when activity logs change
  useEffect(() => {
    const loadResourceDetails = async () => {
      for (const log of allActivityLogs) {
        const cacheKey = `${log.resourceType}-${log.resourceId}`;

        if (!resourceDetails.has(cacheKey) && !loadingResources.has(cacheKey)) {
          setLoadingResources((prev) => new Set(prev).add(cacheKey));

          fetchResourceDetails(log.resourceType, log.resourceId).then((details) => {
            setResourceDetails((prev) => new Map(prev).set(cacheKey, details));
            setLoadingResources((prev) => {
              const next = new Set(prev);
              next.delete(cacheKey);
              return next;
            });
          });
        }
      }
    };

    if (allActivityLogs.length > 0) {
      loadResourceDetails();
    }
  }, [allActivityLogs]);

  const getResourceDisplay = (log: any) => {
    const cacheKey = `${log.resourceType}-${log.resourceId}`;
    const details = resourceDetails.get(cacheKey);
    const isLoading = loadingResources.has(cacheKey);

    if (isLoading) {
      return { name: "加载中...", detail: null };
    }

    if (!details) {
      return { name: log.resourceId?.slice(0, 8) + "..." || "未知资源", detail: null };
    }

    switch (log.resourceType?.toLowerCase()) {
      case "video":
        return {
          name: details.title || "未命名视频",
          detail: details.duration ? `时长: ${details.duration}分钟` : null,
        };
      case "exercise":
        return {
          name: details.title || "未命名练习",
          detail: details.questionType ? `类型: ${getQuestionTypeLabel(details.questionType)}` : null,
        };
      case "homework":
        return {
          name: details.title || "未命名作业",
          detail: details.score ? `满分: ${details.score}分` : null,
        };
      case "file":
        return {
          name: details.filename || details.title || "未命名文件",
          detail: details.fileType ? `类型: ${simplifyFileType(details.filename || "", details.fileType)}` : null,
        };
      default:
        return {
          name: details.title || details.name || log.resourceId?.slice(0, 8) + "..." || "未知资源",
          detail: null,
        };
    }
  };

  const handleRowClick = async (log: any) => {
    setSelectedLog(log);
    setDetailModalOpen(true);

    const cacheKey = `${log.resourceType}-${log.resourceId}`;
    setLoadingResources((prev) => new Set(prev).add(cacheKey));

    try {
      const details = await fetchResourceDetails(log.resourceType, log.resourceId);
      setResourceDetails((prev) => new Map(prev).set(cacheKey, details));
    } catch (error) {
      console.error("Failed to fetch resource details:", error);
      setResourceDetails((prev) => new Map(prev).set(cacheKey, null));
    } finally {
      setLoadingResources((prev) => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  };

  const handleCloseModal = () => {
    setDetailModalOpen(false);
    setSelectedLog(null);
  };

  // Auto-show answer reference when homework submission log is clicked
  useEffect(() => {
    if (selectedLog && selectedLog.resourceType?.toLowerCase() === "homework") {
      const cacheKey = `${selectedLog.resourceType}-${selectedLog.resourceId}`;
      const details = resourceDetails.get(cacheKey);

      if (details && details.answer && !loadingResources.has(cacheKey)) {
        setTimeout(() => {
          setHomeworkAnswerModal({
            open: true,
            answer: details.answer,
            title: details.title || "作业参考答案",
          });
        }, 1000);
      }
    }
  }, [selectedLog, resourceDetails, loadingResources]);

  const renderDetailContent = () => {
    if (!selectedLog) return null;

    const cacheKey = `${selectedLog.resourceType}-${selectedLog.resourceId}`;
    const details = resourceDetails.get(cacheKey);
    const isLoading = loadingResources.has(cacheKey);

    if (isLoading) {
      return (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">加载中...</Text>
          </div>
        </div>
      );
    }

    if (!details) {
      return (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Text type="secondary">无法加载资源详情</Text>
          <div style={{ marginTop: 8 }}>
            <Text code>资源ID: {selectedLog.resourceId}</Text>
          </div>
        </div>
      );
    }

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <Text type="secondary">资源类型</Text>
            <div>
              <Tag color={getResourceTypeColor(selectedLog.resourceType)}>
                {getResourceTypeLabel(selectedLog.resourceType)}
              </Tag>
            </div>
          </Col>
          <Col span={12}>
            <Text type="secondary">活动时间</Text>
            <div>
              <Text strong>{formatDate(selectedLog.insertedAt)}</Text>
            </div>
          </Col>
        </Row>

        <Divider />

        {/* Video Details */}
        {selectedLog.resourceType?.toLowerCase() === "video" && (
          <div>
            <Title level={5}>
              <PlayCircleOutlined style={{ marginRight: 8, color: "#2573E6" }} />
              视频详情
            </Title>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">标题</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {details.title || "未命名视频"}
                </Text>
              </div>
            </div>
            {details.duration && (
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">时长</Text>
                <div>
                  <Text>{details.duration} 分钟</Text>
                </div>
              </div>
            )}
          </div>
        )}

        {/* File Details */}
        {selectedLog.resourceType?.toLowerCase() === "file" && (
          <div>
            <Title level={5}>
              <FileOutlined style={{ marginRight: 8, color: "#2573E6" }} />
              文件详情
            </Title>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">文件标识</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {details.title || "查看的文件"}
                </Text>
              </div>
            </div>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}>
                <Text type="secondary">文件类型</Text>
                <div>
                  <Tag color="blue">文档文件</Tag>
                </div>
              </Col>
              <Col span={12}>
                <Text type="secondary">活动状态</Text>
                <div>
                  <Tag color="blue">已查看</Tag>
                </div>
              </Col>
            </Row>
          </div>
        )}

        {/* Exercise Details */}
        {selectedLog.resourceType?.toLowerCase() === "exercise" && (
          <div>
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8, color: "#2573E6" }} />
              练习题详情
            </Title>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">练习标题</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {details.title || "未命名练习"}
                </Text>
              </div>
            </div>
            <Row gutter={16} style={{ marginTop: 12 }}>
              {details.questionType && (
                <Col span={12}>
                  <Text type="secondary">题目类型</Text>
                  <div>
                    <Tag color="blue">
                      {getQuestionTypeLabel(details.questionType)}
                    </Tag>
                  </div>
                </Col>
              )}
              {details.aiType && (
                <Col span={12}>
                  <Text type="secondary">生成方式</Text>
                  <div>
                    <Tag color={details.aiType === "ai_generated" ? "blue" : "default"}>
                      {getAiTypeLabel(details.aiType)}
                    </Tag>
                  </div>
                </Col>
              )}
            </Row>

            {details.questionContent && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">题目内容</Text>
                <Card size="small" style={{ marginTop: 8, background: "#fafafa" }}>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{details.questionContent}</Text>
                </Card>
              </div>
            )}

            {details.options && details.options.choices && Array.isArray(details.options.choices) && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">答案选项</Text>
                <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
                  {details.options.choices.map((choice: string, index: number) => (
                    <Col span={12} key={index}>
                      <Card
                        size="small"
                        style={{
                          background:
                            details.answer === choice ? "rgba(37, 115, 230, 0.1)" : "#fafafa",
                          border:
                            details.answer === choice
                              ? "1px solid #2573E6"
                              : "1px solid #edf0f5",
                        }}
                      >
                        <Text>
                          <Text strong>{String.fromCharCode(65 + index)}.</Text> {choice}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {selectedLog.metadata?.answer && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">用户答案</Text>
                <Card
                  size="small"
                  style={{ marginTop: 8, background: "rgba(24, 144, 255, 0.05)" }}
                >
                  <Text style={{ color: "#2573E6" }}>{selectedLog.metadata.answer}</Text>
                </Card>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <Text type="secondary">参考答案</Text>
              {details.answer ? (
                <Card
                  size="small"
                  style={{ marginTop: 8, background: "rgba(37, 115, 230, 0.05)" }}
                >
                  {(() => {
                    const answerLetter = details.answer.toString().toUpperCase();
                    const options = details.options;
                    
                    if (!options) {
                      return <Text style={{ color: "#2573E6" }}>{details.answer}</Text>;
                    }

                    const getOptionText = (letter: string): string => {
                      const upperLetter = letter.toUpperCase();
                      const numKey = String(upperLetter.charCodeAt(0) - 64);
                      return options[numKey] || options[upperLetter] || options[letter] || letter;
                    };

                    const answerText = answerLetter.split('').map(letter => {
                      const optionText = getOptionText(letter);
                      return `${letter}. ${optionText}`;
                    }).join('，');

                    return <Text style={{ color: "#2573E6" }}>{answerText}</Text>;
                  })()}
                </Card>
              ) : (
                <Card
                  size="small"
                  style={{ marginTop: 8, background: "#fafafa" }}
                >
                  <Text type="secondary">暂无参考答案</Text>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Homework Details */}
        {selectedLog.resourceType?.toLowerCase() === "homework" && (
          <div>
            <Title level={5}>
              <FileTextOutlined style={{ marginRight: 8, color: "#2573E6" }} />
              作业详情
            </Title>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">作业标题</Text>
              <div>
                <Text strong style={{ fontSize: 16 }}>
                  {details.title || "未命名作业"}
                </Text>
              </div>
            </div>

            {details.score && (
              <Card
                size="small"
                style={{
                  marginTop: 12,
                  textAlign: "center",
                  background: "rgba(37, 115, 230, 0.05)",
                  maxWidth: 150,
                }}
              >
                <Text type="secondary">满分</Text>
                <div>
                  <Text strong style={{ fontSize: 24, color: "#2573E6" }}>
                    {details.score}
                  </Text>
                  <Text type="secondary"> 分</Text>
                </div>
              </Card>
            )}

            {details.content && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">作业内容</Text>
                <Card size="small" style={{ marginTop: 8, background: "#fafafa" }}>
                  <Text style={{ whiteSpace: "pre-wrap" }}>{details.content}</Text>
                </Card>
              </div>
            )}

            <Row gutter={16} style={{ marginTop: 16 }}>
              {details.chapterId && (
                <Col span={12}>
                  <Text type="secondary">所属章节</Text>
                  <div>
                    <Text code>{details.chapterId.slice(0, 8)}...</Text>
                  </div>
                </Col>
              )}
              {details.knowledgeResourceId && (
                <Col span={12}>
                  <Text type="secondary">关联知识点</Text>
                  <div>
                    <Text code>{details.knowledgeResourceId.slice(0, 12)}...</Text>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        )}

        <Divider />

        <div>
          <Text type="secondary" style={{ fontSize: 13 }}>
            资源ID: {selectedLog.resourceId}
          </Text>
        </div>
      </div>
    );
  };

  const columns: ColumnsType<any> = [
    {
      title: "活动类型",
      dataIndex: "actionType",
      key: "actionType",
      width: 100,
      render: (actionType: string) => (
        <Tag color={getActionTypeColor(actionType)}>{getActionTypeLabel(actionType)}</Tag>
      ),
    },
    {
      title: "资源",
      key: "resourceName",
      render: (_: any, record: any) => {
        const resourceDisplay = getResourceDisplay(record);
        return (
          <div style={{ maxWidth: "100%" }}>
            <Tooltip title={resourceDisplay.name} mouseEnterDelay={0.3}>
              <Text strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{resourceDisplay.name}</Text>
            </Tooltip>
            {resourceDisplay.detail && (
              <Tooltip title={resourceDisplay.detail} mouseEnterDelay={0.3}>
                <Text type="secondary" style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {resourceDisplay.detail}
                </Text>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "时间",
      dataIndex: "insertedAt",
      key: "insertedAt",
      width: 150,
      render: (date: string) => formatDate(date),
    },
  ];

  return (
    <div style={{ width: "100%", height: "100%", maxWidth: "100%", overflowY: "auto", overflowX: "hidden", paddingTop: isMobile ? 4 : 16, fontSize: 15 }}>
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : allActivityLogs.length === 0 ? (
        <Empty description="暂无活动记录" style={{ padding: 48 }} />
      ) : (
        <div style={{ width: "100%" }}>
          {/* 搜索过滤栏 */}
          <div style={{ borderRadius: isMobile ? 6 : 12, background: "#fff", padding: isMobile ? 8 : 14, marginBottom: isMobile ? 6 : 12, boxShadow: isMobile ? "none" : "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: 10,
              }}
            >
              <Input
                placeholder="搜索活动..."
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                style={{ width: isMobile ? "100%" : 250, borderRadius: 8 }}
                allowClear
              />
              <Select
                placeholder="筛选活动类型"
                value={activityTypeFilter}
                onChange={(v) => { setActivityTypeFilter(v); setPage(1); }}
                style={{ width: isMobile ? "100%" : 130 }}
                options={[
                  { value: "all", label: "全部" },
                  { value: "video_view", label: "视频观看" },
                  { value: "exercise_submit", label: "练习提交" },
                  { value: "homework_submit", label: "作业提交" },
                  { value: "file_view", label: "文件查看" },
                ]}
              />
            </div>
          </div>

          {/* 活动表格 */}
          <div style={{ borderRadius: isMobile ? 6 : 12, background: "#fff", boxShadow: isMobile ? "none" : "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <Table
              columns={columns}
              dataSource={activityLogs}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={isMobile ? { x: 640 } : undefined}
              onRow={(record) => ({
                onClick: () => handleRowClick(record),
                style: { cursor: "pointer" },
              })}
            />

            {totalCount > pageSize && (
              <div style={{ textAlign: "center", marginTop: 16, paddingBottom: 12 }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={totalCount}
                  onChange={setPage}
                  showSizeChanger={false}
                  showTotal={(total) => `共 ${total} 条记录`}
                  size="small"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Resource Detail Modal */}
      <Modal
        open={detailModalOpen}
        onCancel={handleCloseModal}
        footer={
          <Button type="primary" onClick={handleCloseModal}>
            关闭
          </Button>
        }
        width={700}
        title={
          selectedLog && (
            <Space>
              {selectedLog.resourceType?.toLowerCase() === "video" && (
                <PlayCircleOutlined style={{ color: "#2573E6" }} />
              )}
              {selectedLog.resourceType?.toLowerCase() === "exercise" && (
                <FileTextOutlined style={{ color: "#2573E6" }} />
              )}
              {selectedLog.resourceType?.toLowerCase() === "homework" && (
                <FileTextOutlined style={{ color: "#2573E6" }} />
              )}
              {selectedLog.resourceType?.toLowerCase() === "file" && (
                <FileOutlined style={{ color: "#2573E6" }} />
              )}
              <span>{selectedLog ? getActionTypeLabel(selectedLog.actionType) : ""} - 资源详情</span>
            </Space>
          )
        }
      >
        {renderDetailContent()}
      </Modal>

      {/* Homework Answer Reference Modal */}
      <Modal
        open={homeworkAnswerModal.open}
        onCancel={() => setHomeworkAnswerModal({ open: false, answer: "", title: "" })}
        footer={
          <Button
            type="primary"
            style={{ background: "#2573E6", borderColor: "#2573E6" }}
            onClick={() => setHomeworkAnswerModal({ open: false, answer: "", title: "" })}
          >
            我已了解
          </Button>
        }
        width={600}
        title={
          <Space>
            <FileTextOutlined style={{ color: "#2573E6" }} />
            <span>{homeworkAnswerModal.title}</span>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">您已提交作业，以下是参考答案供您学习参考：</Text>
        </div>
        <Card
          style={{
            background: "rgba(37, 115, 230, 0.02)",
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          <Text style={{ whiteSpace: "pre-wrap", color: "#2573E6" }}>
            {homeworkAnswerModal.answer}
          </Text>
        </Card>
        <div style={{ marginTop: 16, padding: 12, background: "#eaf0ff", borderRadius: 4 }}>
          <Text style={{ color: "#2573E6" }}>
            答案解析
          </Text>
        </div>
      </Modal>
    </div>
  );
}

export default function Page() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const returnUrl = searchParams.get("returnUrl");
  const currentTenant = getCurrentTenant();

  // 主 Tab：知识图谱 / 岗位能力图谱（同级）
  const initialMain = (searchParams.get("main") as MainTabKey) || (searchParams.get("tab") === "job-competency" ? "job" : "knowledge");
  const [mainTab, setMainTab] = useState<MainTabKey>(MAIN_TABS.some((t) => t.value === initialMain) ? (initialMain as MainTabKey) : "knowledge");
  // 知识图谱子视图
  const initialView = searchParams.get("view") || searchParams.get("tab") || "tree";
  const [activeView, setActiveView] = useState<KnowledgeViewKey>(
    KNOWLEDGE_TABS.some((t) => t.key === initialView) ? (initialView as KnowledgeViewKey) : "tree"
  );

  // 同步 URL：main / view / tab 兼容
  useEffect(() => {
    const mainParam = searchParams.get("main") as MainTabKey | null;
    const viewParam = searchParams.get("view") || searchParams.get("tab");
    if (mainParam && MAIN_TABS.some((t) => t.value === mainParam) && mainParam !== mainTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMainTab(mainParam);
    }
    if (viewParam && KNOWLEDGE_TABS.some((t) => t.key === viewParam) && viewParam !== activeView) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveView(viewParam as KnowledgeViewKey);
      if (mainTab !== "knowledge") setMainTab("knowledge");
    }
    // 兼容旧链接 ?tab=job-competency
    if (searchParams.get("tab") === "job-competency" && mainTab !== "job") {
      setMainTab("job");
    }
  }, [searchParams, mainTab, activeView]);

  const handleMainChange = (v: MainTabKey) => {
    setMainTab(v);
    const params = new URLSearchParams(searchParams);
    params.set("main", v);
    // 清理旧 tab 参数避免冲突
    params.delete("tab");
    if (v === "knowledge") params.set("view", activeView);
    else params.delete("view");
    setSearchParams(params, { replace: true });
  };
  const handleViewChange = (v: KnowledgeViewKey) => {
    setActiveView(v);
    const params = new URLSearchParams(searchParams);
    params.set("main", "knowledge");
    params.set("view", v);
    params.delete("tab");
    setSearchParams(params, { replace: true });
  };

  const courseIdFromUrl = searchParams.get("courseId");
  const storedCourseId = localStorage.getItem("selectedCourse");
  const courseId = courseIdFromUrl || storedCourseId || "";

  useEffect(() => {
    if (courseId) {
      localStorage.setItem("selectedCourse", courseId);
    }
  }, [courseId]);

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["course-name", courseId, currentTenant?.id],
    queryFn: () =>
      courseId
        ? listCourses({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "knowledgeResourcesCount"],
            filter: { id: { eq: courseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!courseId && !!currentTenant,
    retry: 1,
  });

  const courseInfo = (() => {
    if (!coursesData?.success) return null;
    const data = (coursesData as any).data;
    if (!data) return null;
    if (Array.isArray(data)) return data[0];
    if ("results" in data && Array.isArray(data.results)) return data.results[0];
    if ("data" in data && Array.isArray(data.data)) return data.data[0];
    return null;
  })();

  const courseName = courseInfo?.title || null;

  const { data: knowledgeRelationsData } = useQuery({
    queryKey: ["knowledge-relations-count", courseId, currentTenant?.id],
    queryFn: async () => {
      if (!courseId) return { success: false, data: [] };
      const result = await listRelations({
        tenant: currentTenant?.schemaName || "public",
        fields: ["id"],
        filter: {
          or: [
            { sourceKnowledge: { courseId: { eq: courseId } } },
            { targetKnowledge: { courseId: { eq: courseId } } },
          ],
        },
        page: { limit: 1000 },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!courseId && !!currentTenant,
    retry: 1,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-count", courseId, currentTenant?.id],
    queryFn: () =>
      courseId
        ? listExercises({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id"],
            filter: { courseId: { eq: courseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!courseId && !!currentTenant,
    retry: 1,
  });

  const { data: filesData } = useQuery({
    queryKey: ["files-count", courseId, currentTenant?.id],
    queryFn: () =>
      courseId
        ? listFiles({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id"],
            filter: { courseId: { eq: courseId } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!courseId && !!currentTenant,
    retry: 1,
  });

  const knowledgePointsCount = courseInfo?.knowledgeResourcesCount || 0;
  const knowledgeRelationsCount = extractArrayData(knowledgeRelationsData).length;
  const exercisesCount = extractArrayData(exercisesData).length;
  const filesCount = extractArrayData(filesData).length;

  const renderKnowledgeContent = () => {
    if (activeView === "ideological") {
      return <TeacherGraphIdeological courseId={courseId} hideManagement />;
    }

    if (!courseId) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: 300 }}>
          <div style={{ textAlign: "center", padding: 48, borderRadius: 16, background: "#fff", boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)", maxWidth: 360 }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: 18,
                background: `${colors.primary}10`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <BulbOutlined style={{ fontSize: 32, color: colors.primary }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d", marginBottom: 6 }}>请先选择一个课程</div>
            <div style={{ color: "#757780" }}>左侧选择课程后将显示该课程的知识图谱</div>
          </div>
        </div>
      );
    }

    switch (activeView) {
      case "tree":
        return <TeacherGraphTreeView courseId={courseId} knowledgeId={searchParams.get("knowledgeId") || undefined} />;
      case "circle":
        return <TeacherGraphCircleView courseId={courseId} />;
      case "knowledge":
        return <TeacherGraphKnowledgeView courseId={courseId} />;
      case "competency":
        return <StudentCompetencyGraphView courseId={courseId} />;
      case "question":
        return <TeacherGraphQuestionView courseId={courseId} hideManagement />;
      case "activity":
        return <ActivityHistoryView courseId={courseId} />;
      default:
        return (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Text type="secondary">该视图正在开发中，敬请期待。</Text>
          </div>
        );
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="error"
          message="用户未登录，请登录以访问知识图谱。"
        />
      </div>
    );
  }

  return (
    <div
      className="pu-page-fill"
      style={{
        flex: 1,
        minHeight: 0,
        height: 0,
      }}
    >
      {returnUrl && (
        <Button
          type="text"
          icon={<LeftOutlined />}
          onClick={() => navigate(returnUrl)}
          style={{ paddingLeft: 0, marginBottom: 4, color: colors.primary, fontWeight: 600 }}
        >
          返回推荐
        </Button>
      )}
      <PageHead
        title="图谱总览"
        description="把知识、能力与资源连接起来，形成清晰的学习路径。"
      />
      <ProtoTabs
        items={MAIN_TABS.map((t) => ({ id: t.value, label: t.label }))}
        active={mainTab}
        onChange={(v) => handleMainChange(v as MainTabKey)}
      />

      {/* 主体：布局不变（课程侧边栏 / 岗位图谱） */}
      {mainTab === "job" ? (
        // 岗位能力图谱：自带左侧数据侧边栏（专业→岗位→图谱）
        <div style={{ flex: 1, minHeight: 0, height: 0, display: "flex", flexDirection: "column", padding: isMobile ? 0 : 0 }}>
          <div style={{
            flex: 1,
            minHeight: 0,
            height: 0,
            borderRadius: isMobile ? 0 : 14,
            background: "#fff",
            overflow: "hidden",
            border: isMobile ? "none" : "1px solid var(--pu-line)",
            display: "flex",
            flexDirection: "column",
          }}>
            <StudentJobCompetencyGraph />
          </div>
        </div>
      ) : (
        // 知识图谱：左侧图谱类型导航 + 右侧当前课程图谱
        <div
          style={{
            flex: 1,
            minHeight: isMobile ? 0 : 400,
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? 0 : 10,
          }}
        >
          {/* 左侧：图谱类型（竖排，之前设计） */}
          {isMobile ? (
            <div style={{ width: "100%", marginBottom: 4, background: "#fff", padding: "8px", borderRadius: 8 }}>
              <Select
                value={activeView}
                onChange={(v) => handleViewChange(v as KnowledgeViewKey)}
                style={{ width: "100%" }}
                options={KNOWLEDGE_TABS.map((t) => ({ value: t.key, label: t.label }))}
              />
            </div>
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              width: 190,
              background: "#fff",
              borderRadius: 14,
              border: "1px solid var(--pu-line)",
              padding: 8,
              gap: 3,
              height: "fit-content",
              position: "sticky",
              top: 6,
            }}>
              {KNOWLEDGE_TABS.map((tab) => {
                const isActive = activeView === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => handleViewChange(tab.key as KnowledgeViewKey)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 13px",
                      borderRadius: 8,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: isActive ? 650 : 400,
                      color: isActive ? colors.primary : "#596b84",
                      background: isActive ? "#eaf0ff" : "transparent",
                      transition: "all 0.15s",
                      whiteSpace: "nowrap",
                      textAlign: "left" as const,
                      width: "100%",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f2f5fb";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 右侧：当前课程图谱内容 */}
          <div style={{
            flex: 1,
            minHeight: isMobile ? 0 : 480,
            borderRadius: isMobile ? 0 : 14,
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            border: isMobile ? "none" : "1px solid var(--pu-line)",
          }}>
            {!isMobile && courseId && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 18px", borderBottom: "1px solid var(--pu-line)", background: "#f6f8fc" }}>
                <ClusterOutlined style={{ color: colors.primary, fontSize: 16 }} />
                <span style={{ fontSize: 15, color: "#5f6368" }}>当前课程</span>
                <Tag style={{ margin: 0, fontSize: 15, background: `${colors.primary}0a`, color: colors.primary, border: `1px solid ${colors.primary}20`, borderRadius: 6, padding: "0 8px", fontWeight: 600 }}>
                  {courseName || "加载中..."}
                </Tag>
                <div style={{ flex: 1 }} />
                <span style={{ fontSize: 14, color: "#999", display: "flex", gap: 6 }}>
                  {knowledgePointsCount} 知识点 · {knowledgeRelationsCount} 关联
                </span>
              </div>
            )}
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              <div key={activeView} style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, inset: 0 }}>
                {renderKnowledgeContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
