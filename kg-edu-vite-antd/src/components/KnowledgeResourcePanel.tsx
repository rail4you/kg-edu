import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Drawer,
  Typography,
  List,
  Card,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  Tabs,
  message,
  Input,
  Radio,
  Alert,
  App,
  Checkbox,
} from "antd";
import {
  FileTextOutlined,
  VideoCameraOutlined,
  ReadOutlined,
  BookOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import {
  listFiles,
  listVideos,
  listExercises,
  listHomeworks,
  listLinks,
  logFileView,
  logVideoView,
  logExerciseSubmit,
  logHomeworkSubmit,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import FilePreview from "@/components/FilePreview";
import VideoPlayerModal from "@/components/VideoPlayerModal";

const { Text, Title } = Typography;
const { TextArea } = Input;

// 题目类型翻译
const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  essay: "问答题",
  fill_in_blank: "填空题",
  term_definition: "名词解释",
  case_study: "案例题",
};

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

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType?: string;
  description?: string | null;
}

interface KnowledgeResourcePanelProps {
  open: boolean;
  onClose: () => void;
  knowledge: KnowledgeResource | null;
}

interface ResourceItem {
  id: string;
  title: string;
  type: "file" | "video" | "exercise" | "homework" | "link";
  filename?: string;
  path?: string;
  size?: number;
  fileType?: string;
  assetId?: string;
  thumbnail?: string;
  questionContent?: string;
  questionType?: string;
  options?: Record<string, any>;
  answer?: string;
  answerExplanation?: string;
  content?: string;
  url?: string;
  category?: string | null;
}

interface PreviewState {
  open: boolean;
  file: {
    url: string;
    name: string;
    type: string;
    size?: number;
  };
}

export default function KnowledgeResourcePanel({ open, onClose, knowledge }: KnowledgeResourcePanelProps) {
  const { message } = App.useApp();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || currentTenant?.id || "";
  const [tabKey, setTabKey] = useState("files");
  const [previewState, setPreviewState] = useState<PreviewState>({
    open: false,
    file: { url: "", name: "", type: "" },
  });

  // 练习和作业状态
  const [selectedExercise, setSelectedExercise] = useState<ResourceItem | null>(null);
  const [exerciseAnswer, setExerciseAnswer] = useState("");
  const [showExerciseAnswer, setShowExerciseAnswer] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState<ResourceItem | null>(null);
  const [homeworkAnswer, setHomeworkAnswer] = useState("");
  const [showHomeworkAnswer, setShowHomeworkAnswer] = useState(false);

  // 视频播放状态
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ResourceItem | null>(null);

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["knowledge-files", knowledge?.id, tenant],
    queryFn: async () => {
      if (!knowledge?.id) return [];
      const result = await listFiles({
        tenant,
        fields: ["id", "filename", "path", "size", "fileType"],
        filter: { knowledgeResourceId: { eq: knowledge.id } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!knowledge?.id && !!tenant,
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ["knowledge-videos", knowledge?.id, tenant],
    queryFn: async () => {
      if (!knowledge?.id) return [];
      const result = await listVideos({
        tenant,
        fields: ["id", "title", "assetId", "thumbnail"],
        filter: { knowledgeResourceId: { eq: knowledge.id } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!knowledge?.id && !!tenant,
  });

  const { data: exercisesData, isLoading: exercisesLoading } = useQuery({
    queryKey: ["knowledge-exercises", knowledge?.id, tenant],
    queryFn: async () => {
      if (!knowledge?.id) return [];
      const result = await listExercises({
        tenant,
        fields: ["id", "title", "questionContent", "questionType", "options", "answer", "answerExplanation"],
        filter: { knowledgeResourceId: { eq: knowledge.id } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!knowledge?.id && !!tenant,
  });

  const { data: homeworksData, isLoading: homeworksLoading } = useQuery({
    queryKey: ["knowledge-homeworks", knowledge?.id, tenant],
    queryFn: async () => {
      if (!knowledge?.id) return [];
      const result = await listHomeworks({
        tenant,
        fields: ["id", "title", "content", "answer"],
        filter: { knowledgeResourceId: { eq: knowledge.id } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!knowledge?.id && !!tenant,
  });

  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ["knowledge-links", knowledge?.id, tenant],
    queryFn: async () => {
      if (!knowledge?.id) return [];
      const result = await listLinks({
        tenant,
        fields: ["id", "title", "url", "category"],
        filter: { knowledgeResourceId: { eq: knowledge.id } },
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!knowledge?.id && !!tenant,
  });

  const files = useMemo(() => {
    if (!filesData) return [];
    return filesData.map((file: any) => ({
      ...file,
      type: "file" as const,
      title: file.filename || "Untitled File",
    }));
  }, [filesData]);

  const videos = useMemo(() => {
    if (!videosData) return [];
    return videosData.map((video: any) => ({
      ...video,
      type: "video" as const,
      title: video.title || "Untitled Video",
    }));
  }, [videosData]);

  const exercises = useMemo(() => {
    if (!exercisesData) return [];
    return exercisesData.map((exercise: any) => ({
      ...exercise,
      type: "exercise" as const,
    }));
  }, [exercisesData]);

  const homeworks = useMemo(() => {
    if (!homeworksData) return [];
    return homeworksData.map((homework: any) => ({
      ...homework,
      type: "homework" as const,
    }));
  }, [homeworksData]);

  const links = useMemo(() => {
    if (!linksData) return [];
    return linksData.map((link: any) => ({
      ...link,
      type: "link" as const,
      title: link.title || link.url || "未命名链接",
    }));
  }, [linksData]);

  // 学习日志记录 mutations
  const logFileViewMutation = useMutation({
    mutationFn: async ({ fileId, action }: { fileId: string; action: string }) => {
      if (!user?.id) return;
      await logFileView({
        tenant,
        fields: ["id"],
        input: {
          userId: user.id,
          fileId,
          metadata: { action, knowledgeResourceId: knowledge?.id },
        },
        headers: getHeaders(user),
      });
    },
  });

  const logVideoViewMutation = useMutation({
    mutationFn: async (videoId: string) => {
      if (!user?.id) return;
      await logVideoView({
        tenant,
        fields: ["id"],
        input: {
          userId: user.id,
          videoId,
          metadata: { action: "study", knowledgeResourceId: knowledge?.id },
        },
        headers: getHeaders(user),
      });
    },
  });

  const logExerciseSubmitMutation = useMutation({
    mutationFn: async ({ exerciseId, answer }: { exerciseId: string; answer: string }) => {
      if (!user?.id) return;
      await logExerciseSubmit({
        tenant,
        fields: ["id"],
        input: {
          userId: user.id,
          exerciseId,
          answer,
          metadata: { knowledgeResourceId: knowledge?.id },
        },
        headers: getHeaders(user),
      });
    },
  });

  const logHomeworkSubmitMutation = useMutation({
    mutationFn: async ({ homeworkId, answer }: { homeworkId: string; answer: string }) => {
      if (!user?.id) return;
      await logHomeworkSubmit({
        tenant,
        fields: ["id"],
        input: {
          userId: user.id,
          homeworkId,
          answer,
          metadata: { knowledgeResourceId: knowledge?.id },
        },
        headers: getHeaders(user),
      });
    },
  });

  // 文件学习处理
  const handleStudyFile = async (item: ResourceItem) => {
    if (!user?.id) {
      message.warning("请先登录以记录学习活动");
      return;
    }

    if (item.path && item.filename) {
      await logFileViewMutation.mutateAsync({ fileId: item.id, action: "study" });
      
      // 根据文件名后缀识别文件类型
      const ext = item.filename.split(".").pop()?.toLowerCase() || "";
      const fileType = ext || item.fileType || "";
      
      setPreviewState({
        open: true,
        file: {
          url: item.path,
          name: item.filename,
          type: fileType,
          size: item.size,
        },
      });
      message.success("学习记录已保存");
    }
  };

  // 视频播放处理
  const handlePlayVideo = (video: ResourceItem) => {
    setSelectedVideo(video);
    setVideoModalOpen(true);
  };

  // 视频开始播放时记录学习活动
  const handleVideoPlayStart = async () => {
    if (!user?.id || !selectedVideo) {
      return;
    }
    try {
      await logVideoViewMutation.mutateAsync(selectedVideo.id);
      message.success("视频学习记录已保存");
    } catch (error) {
      console.error("Failed to log video view:", error);
    }
  };

  // 关闭视频播放弹窗
  const handleCloseVideoModal = () => {
    setVideoModalOpen(false);
    setSelectedVideo(null);
  };

  // 打开外部链接
  const handleOpenLink = (url?: string) => {
    if (!url) {
      message.warning("链接地址无效");
      return;
    }
    let fullUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      fullUrl = "https://" + url;
    }
    window.open(fullUrl, "_blank", "noopener,noreferrer");
  };

  // 文件下载处理
  const handleDownload = async (item: ResourceItem) => {
    if (!user?.id) {
      message.warning("请先登录以记录下载活动");
      return;
    }

    if (item.type === "file" && item.path && item.filename) {
      await logFileViewMutation.mutateAsync({ fileId: item.id, action: "download" });
      const link = document.createElement("a");
      link.href = item.path;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      message.success("下载记录已保存");
    }
  };

  // 开始练习
  const handleStartExercise = (exercise: ResourceItem) => {
    setSelectedExercise(exercise);
    setExerciseAnswer("");
  };

  // 提交练习答案
  const handleSubmitExercise = async () => {
    if (!user?.id || !selectedExercise) {
      return;
    }

    if (!exerciseAnswer.trim()) {
      message.warning("请输入答案后再提交");
      return;
    }

    try {
      await logExerciseSubmitMutation.mutateAsync({
        exerciseId: selectedExercise.id,
        answer: exerciseAnswer.trim(),
      });
      message.success("练习答案已提交并记录！");
      setShowExerciseAnswer(true);
    } catch (error) {
      console.error("Failed to submit exercise answer:", error);
      message.error("提交失败，请重试");
    }
  };

  // 取消练习
  const handleCancelExercise = () => {
    setSelectedExercise(null);
    setExerciseAnswer("");
    setShowExerciseAnswer(false);
  };

  // 开始作业
  const handleStartHomework = (homework: ResourceItem) => {
    setSelectedHomework(homework);
    setHomeworkAnswer("");
    setShowHomeworkAnswer(false);
  };

  // 提交作业答案
  const handleSubmitHomework = async () => {
    if (!user?.id || !selectedHomework) {
      return;
    }

    if (!homeworkAnswer.trim()) {
      message.warning("请输入答案后再提交");
      return;
    }

    try {
      await logHomeworkSubmitMutation.mutateAsync({
        homeworkId: selectedHomework.id,
        answer: homeworkAnswer.trim(),
      });
      setShowHomeworkAnswer(true);
      message.success("作业答案已提交并记录！");
    } catch (error) {
      console.error("Failed to submit homework answer:", error);
      message.error("提交失败，请重试");
    }
  };

  // 完成作业
  const handleFinishHomework = () => {
    setSelectedHomework(null);
    setHomeworkAnswer("");
    setShowHomeworkAnswer(false);
  };

  // 取消作业
  const handleCancelHomework = () => {
    setSelectedHomework(null);
    setHomeworkAnswer("");
    setShowHomeworkAnswer(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "file":
        return <FileTextOutlined />;
      case "video":
        return <VideoCameraOutlined />;
      case "exercise":
        return <ReadOutlined />;
      case "homework":
        return <BookOutlined />;
      case "link":
        return <LinkOutlined />;
      default:
        return <FileTextOutlined />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "file":
        return "blue";
      case "video":
        return "purple";
      case "exercise":
        return "orange";
      case "homework":
        return "cyan";
      case "link":
        return "geekblue";
      default:
        return "default";
    }
  };

  // 渲染练习答题界面
  const renderExerciseDetail = () => {
    if (!selectedExercise) return null;

    return (
      <Card
        title={
          <Space>
            <EditOutlined />
            <Text strong>{selectedExercise.title}</Text>
          </Space>
        }
        extra={
          <Button icon={<CloseCircleOutlined />} onClick={handleCancelExercise}>
            返回列表
          </Button>
        }
      >
        {selectedExercise.questionContent && (
          <div style={{ marginBottom: 24 }}>
            <Text strong>题目内容：</Text>
            <div
              style={{
                padding: 16,
                background: "#f5f5f5",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              {selectedExercise.questionContent}
            </div>
          </div>
        )}

        {selectedExercise.questionType && (
          <div style={{ marginBottom: 16 }}>
            <Tag color="blue">
              {QUESTION_TYPE_LABELS[selectedExercise.questionType] || selectedExercise.questionType}
            </Tag>
          </div>
        )}

        {/* 单选题/判断题选项 */}
        {["multiple_choice", "true_false"].includes(selectedExercise.questionType) && selectedExercise.options && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>请选择答案：</Text>
            <Radio.Group
              value={exerciseAnswer}
              onChange={(e) => setExerciseAnswer(e.target.value)}
              style={{ width: "100%" }}
            >
              {(() => {
                let optionsArray: any[] = [];

                if (Array.isArray(selectedExercise.options)) {
                  optionsArray = selectedExercise.options;
                } else if (typeof selectedExercise.options === "string") {
                  try {
                    const parsed = JSON.parse(selectedExercise.options);
                    optionsArray = Array.isArray(parsed) ? parsed : [];
                  } catch {
                    optionsArray = [];
                  }
                } else if (typeof selectedExercise.options === "object") {
                  if (selectedExercise.options.choices && Array.isArray(selectedExercise.options.choices)) {
                    optionsArray = selectedExercise.options.choices.map((choice: string, index: number) => {
                      const match = choice.match(/^([A-Za-z])\.\s*(.+)$/);
                      if (match) {
                        return { key: match[1], text: match[2] };
                      }
                      return { key: String.fromCharCode(65 + index), text: choice };
                    });
                  } else {
                    optionsArray = Object.entries(selectedExercise.options).map(([key, value]) => ({
                      key,
                      text: value,
                    }));
                  }
                }

                return optionsArray.map((option: any, index: number) => (
                  <Radio
                    key={option.key || index}
                    value={option.key || (typeof option === "string" ? option : option.text || String(index + 1))}
                    style={{ display: "block", marginBottom: 8 }}
                  >
                    {option.key ? `${option.key}. ` : ""}
                    {typeof option === "string" ? option : option.text || String(index + 1)}
                  </Radio>
                ));
              })()}
            </Radio.Group>
          </div>
        )}

        {/* 多选题选项 */}
        {selectedExercise.questionType === "multiple_response" && selectedExercise.options && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>请选择答案（可多选）：</Text>
            <Checkbox.Group
              value={exerciseAnswer ? exerciseAnswer.split(",").filter(Boolean) : []}
              onChange={(checkedValues) => setExerciseAnswer(checkedValues.sort().join(","))}
              style={{ width: "100%" }}
            >
              {(() => {
                let optionsArray: any[] = [];

                if (typeof selectedExercise.options === "string") {
                  try {
                    const parsed = JSON.parse(selectedExercise.options);
                    if (parsed.choices && Array.isArray(parsed.choices)) {
                      optionsArray = parsed.choices.map((choice: string, index: number) => {
                        const match = choice.match(/^([A-Za-z])\.\s*(.+)$/);
                        if (match) return { key: match[1].toUpperCase(), text: match[2] };
                        return { key: String.fromCharCode(65 + index), text: choice };
                      });
                    }
                  } catch { /* ignore */ }
                } else if (typeof selectedExercise.options === "object" && selectedExercise.options.choices) {
                  optionsArray = selectedExercise.options.choices.map((choice: string, index: number) => {
                    const match = choice.match(/^([A-Za-z])\.\s*(.+)$/);
                    if (match) return { key: match[1].toUpperCase(), text: match[2] };
                    return { key: String.fromCharCode(65 + index), text: choice };
                  });
                }

                return optionsArray.map((option: any, index: number) => (
                  <Checkbox
                    key={option.key || index}
                    value={option.key || String.fromCharCode(65 + index)}
                    style={{ display: "block", marginBottom: 8 }}
                  >
                    {option.key ? `${option.key}. ` : `${String.fromCharCode(65 + index)}. `}
                    {option.text || String(option)}
                  </Checkbox>
                ));
              })()}
            </Checkbox.Group>
          </div>
        )}

        {/* 问答题/填空题/名词解释/案例题输入 */}
        {!["multiple_choice", "true_false", "multiple_response"].includes(selectedExercise.questionType) && (
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: "block", marginBottom: 8 }}>请输入你的答案：</Text>
            <TextArea
              rows={selectedExercise.questionType === "case_study" ? 6 : 4}
              value={exerciseAnswer}
              onChange={(e) => setExerciseAnswer(e.target.value)}
              placeholder={
                selectedExercise.questionType === "fill_in_blank" ? "在此填入答案..." :
                selectedExercise.questionType === "term_definition" ? "请输入名词解释..." :
                selectedExercise.questionType === "case_study" ? "请输入案例分析..." :
                "在此输入答案..."
              }
            />
          </div>
        )}

        <Alert
          message="提示：答案将被记录到学习日志中"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* 提交后显示参考答案 */}
        {showExerciseAnswer && selectedExercise.answer && (
          <div style={{ marginBottom: 24 }}>
            <Alert
              message="您的练习已提交成功！以下是参考答案供您学习参考："
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Text strong style={{ display: "block", marginBottom: 8, color: "#52c41a" }}>
              参考答案：
            </Text>
            <div
              style={{
                padding: 16,
                background: "#f6ffed",
                borderRadius: 8,
                border: "1px solid #b7eb8f",
                color: "#389e0d",
              }}
            >
              {["multiple_choice", "true_false"].includes(selectedExercise.questionType) && selectedExercise.options
                ? (() => {
                    try {
                      const opts = typeof selectedExercise.options === "string"
                        ? JSON.parse(selectedExercise.options)
                        : selectedExercise.options;
                      if (opts && typeof opts.correctAnswer === "number") {
                        const letter = String.fromCharCode(65 + opts.correctAnswer);
                        const choices = opts.choices || opts.options;
                        if (choices && Array.isArray(choices)) {
                          const optionText = choices[opts.correctAnswer] || letter;
                          return `${letter}. ${optionText}`;
                        }
                      }
                    } catch {}
                    return selectedExercise.answer;
                  })()
                : selectedExercise.questionType === "multiple_response" && selectedExercise.options
                  ? (() => {
                      try {
                        const opts = typeof selectedExercise.options === "string"
                          ? JSON.parse(selectedExercise.options)
                          : selectedExercise.options;
                        if (opts && Array.isArray(opts.correctAnswers)) {
                          return opts.correctAnswers.map((idx: number) => {
                            const letter = String.fromCharCode(65 + idx);
                            const choices = opts.choices || [];
                            return choices[idx] ? `${letter}. ${choices[idx]}` : letter;
                          }).join("；");
                        }
                      } catch {}
                      return selectedExercise.answer;
                    })()
                  : selectedExercise.answer}
            </div>
            {selectedExercise.answerExplanation && (
              <div style={{ marginTop: 16 }}>
                <Text strong style={{ display: "block", marginBottom: 8, color: "#1890ff" }}>
                  答案解析：
                </Text>
                <div
                  style={{
                    padding: 16,
                    background: "#e6f7ff",
                    borderRadius: 8,
                    border: "1px solid #91d5ff",
                    color: "#096dd9",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {selectedExercise.answerExplanation}
                </div>
              </div>
            )}
          </div>
        )}

        <Space>
          {!showExerciseAnswer ? (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleSubmitExercise}
              disabled={!exerciseAnswer.trim()}
              loading={logExerciseSubmitMutation.isPending}
            >
              提交答案
            </Button>
          ) : null}
          <Button
            icon={<CloseCircleOutlined />}
            onClick={() => {
              setSelectedExercise(null);
              setExerciseAnswer("");
              setShowExerciseAnswer(false);
            }}
          >
            {showExerciseAnswer ? "关闭" : "返回列表"}
          </Button>
        </Space>
      </Card>
    );
  };

  // 渲染作业答题界面
  const renderHomeworkDetail = () => {
    if (!selectedHomework) return null;

    return (
      <Card
        title={
          <Space>
            <FileProtectOutlined />
            <Text strong>{selectedHomework.title}</Text>
          </Space>
        }
        extra={
          <Button
            icon={<CloseCircleOutlined />}
            onClick={showHomeworkAnswer ? handleFinishHomework : handleCancelHomework}
          >
            {showHomeworkAnswer ? "完成此作业" : "返回列表"}
          </Button>
        }
      >
        {selectedHomework.content && (
          <div style={{ marginBottom: 24 }}>
            <Text strong>作业内容：</Text>
            <div
              style={{
                padding: 16,
                background: "#f5f5f5",
                borderRadius: 8,
                marginTop: 8,
              }}
            >
              {selectedHomework.content}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <Text strong style={{ display: "block", marginBottom: 8 }}>请输入你的答案：</Text>
          <TextArea
            rows={4}
            value={homeworkAnswer}
            onChange={(e) => setHomeworkAnswer(e.target.value)}
            placeholder="在此输入答案..."
            disabled={showHomeworkAnswer}
          />
        </div>

        {/* 提交后显示参考答案 */}
        {showHomeworkAnswer && selectedHomework.answer && (
          <div style={{ marginBottom: 24 }}>
            <Alert
              message="您的作业已提交成功！以下是参考答案供您学习参考："
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Text strong style={{ display: "block", marginBottom: 8, color: "#52c41a" }}>
              参考答案：
            </Text>
            <div
              style={{
                padding: 16,
                background: "#f6ffed",
                borderRadius: 8,
                border: "1px solid #b7eb8f",
                color: "#389e0d",
              }}
            >
              {selectedHomework.questionType === "multiple_choice" && selectedHomework.options
                ? (() => {
                    try {
                      const opts = typeof selectedHomework.options === "string"
                        ? JSON.parse(selectedHomework.options)
                        : selectedHomework.options;
                      if (opts && typeof opts.correctAnswer === "number") {
                        const letter = String.fromCharCode(65 + opts.correctAnswer);
                        const choices = opts.choices || opts.options;
                        if (choices && Array.isArray(choices)) {
                          const optionText = choices[opts.correctAnswer] || letter;
                          return `${letter}. ${optionText}`;
                        }
                      }
                    } catch {}
                    return selectedHomework.answer;
                  })()
                : selectedHomework.answer}
            </div>
          </div>
        )}

        {!showHomeworkAnswer && (
          <Alert
            message="提示：提交答案后可查看参考答案，答案将被记录到学习日志中"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {showHomeworkAnswer && (
          <Alert
            message="答案解析"
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Space>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleSubmitHomework}
            disabled={!homeworkAnswer.trim() || showHomeworkAnswer}
            loading={logHomeworkSubmitMutation.isPending}
          >
            提交答案
          </Button>
          {!showHomeworkAnswer && (
            <Button icon={<CloseCircleOutlined />} onClick={handleCancelHomework}>
              返回列表
            </Button>
          )}
        </Space>
      </Card>
    );
  };

  // 渲染资源列表
  const renderResourceList = (resources: ResourceItem[], type: string) => {
    const isLoading =
      (type === "file" && filesLoading) ||
      (type === "video" && videosLoading) ||
      (type === "exercise" && exercisesLoading) ||
      (type === "homework" && homeworksLoading) ||
      (type === "link" && linksLoading);

    if (isLoading) {
      return (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Spin />
        </div>
      );
    }

    if (resources.length === 0) {
      return <Empty description="暂无资源" />;
    }

    return (
      <List
        dataSource={resources}
        renderItem={(item) => (
          <List.Item
            actions={[
              type === "file" && (
                <Button
                  key="study"
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => handleStudyFile(item)}
                >
                  学习
                </Button>
              ),
              type === "file" && (
                <Button
                  key="download"
                  type="link"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(item)}
                >
                  下载
                </Button>
              ),
              type === "video" && (
                <Button
                  key="study"
                  type="link"
                  icon={<PlayCircleOutlined />}
                  onClick={() => handlePlayVideo(item)}
                >
                  播放视频
                </Button>
              ),
              type === "exercise" && (
                <Button
                  key="start"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleStartExercise(item)}
                >
                  开始练习
                </Button>
              ),
              type === "homework" && (
                <Button
                  key="start"
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => handleStartHomework(item)}
                >
                  开始作业
                </Button>
              ),
              type === "link" && (
                <Button
                  key="open"
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={() => handleOpenLink(item.url)}
                >
                  打开链接
                </Button>
              ),
            ].filter(Boolean)}
          >
            <List.Item.Meta
              avatar={getTypeIcon(item.type)}
              title={
                <Space>
                  <Text strong>{item.title}</Text>
                  <Tag color={getTypeColor(item.type)}>
                    {item.type === "file" ? "文件" : item.type === "video" ? "视频" : item.type === "exercise" ? "练习" : item.type === "homework" ? "作业" : "链接"}
                  </Tag>
                  {item.type === "link" && item.category && (
                    <Tag color="default">{item.category}</Tag>
                  )}
                </Space>
              }
              description={
                <Space direction="vertical" size={0}>
                  {item.type === "file" && (
                    <Text type="secondary">
                      大小: {formatFileSize(item.size)} | 类型: {simplifyFileType(item.filename || item.title || "", item.fileType)}
                    </Text>
                  )}
                  {item.type === "video" && <Text type="secondary">视频资源</Text>}
                  {item.type === "exercise" && item.questionType && (
                    <Text type="secondary">
                      类型: {QUESTION_TYPE_LABELS[item.questionType] || item.questionType}
                    </Text>
                  )}
                  {item.type === "homework" && item.content && (
                    <Text type="secondary" ellipsis style={{ maxWidth: 300 }}>
                      {item.content.length > 50 ? `${item.content.substring(0, 50)}...` : item.content}
                    </Text>
                  )}
                  {item.type === "link" && item.url && (
                    <Text type="secondary" ellipsis style={{ maxWidth: 360, display: "block" }}>
                      {item.url}
                    </Text>
                  )}
                </Space>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  // 渲染练习列表（带答题界面）
  const renderExercisesTab = () => {
    if (selectedExercise) {
      return renderExerciseDetail();
    }
    return renderResourceList(exercises, "exercise");
  };

  // 渲染作业列表（带答题界面）
  const renderHomeworksTab = () => {
    if (selectedHomework) {
      return renderHomeworkDetail();
    }
    return renderResourceList(homeworks, "homework");
  };

  const tabItems = [
    {
      key: "files",
      label: (
        <span>
          <FileTextOutlined /> 文件 ({files.length})
        </span>
      ),
      children: renderResourceList(files, "file"),
    },
    {
      key: "videos",
      label: (
        <span>
          <VideoCameraOutlined /> 视频 ({videos.length})
        </span>
      ),
      children: renderResourceList(videos, "video"),
    },
    {
      key: "links",
      label: (
        <span>
          <LinkOutlined /> 链接 ({links.length})
        </span>
      ),
      children: renderResourceList(links, "link"),
    },
    {
      key: "exercises",
      label: (
        <span>
          <ReadOutlined /> 练习 ({exercises.length})
        </span>
      ),
      children: renderExercisesTab(),
    },
    {
      key: "homeworks",
      label: (
        <span>
          <BookOutlined /> 作业 ({homeworks.length})
        </span>
      ),
      children: renderHomeworksTab(),
    },
  ];

  return (
    <>
      <Drawer
        title={
          <div style={{ textAlign: "left" }}>
            <Title level={5} style={{ margin: 0 }}>{knowledge?.name || "知识点资源"}</Title>
            {knowledge?.description && (
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                {knowledge.description}
              </Text>
            )}
          </div>
        }
        placement="right"
        width={550}
        onClose={onClose}
        open={open}
      >
        {!knowledge ? (
          <Empty description="未选择知识点" />
        ) : (
          <Tabs
            activeKey={tabKey}
            onChange={(key) => {
              setTabKey(key);
              // 切换 tab 时重置答题状态
              setSelectedExercise(null);
              setSelectedHomework(null);
              setExerciseAnswer("");
              setHomeworkAnswer("");
              setShowHomeworkAnswer(false);
            }}
            items={tabItems}
          />
        )}
      </Drawer>

      <FilePreview
        open={previewState.open}
        onClose={() => setPreviewState({ ...previewState, open: false, file: { url: "", name: "", type: "" } })}
        file={previewState.file}
      />

      <VideoPlayerModal
        open={videoModalOpen}
        onClose={handleCloseVideoModal}
        video={selectedVideo ? {
          id: selectedVideo.id,
          title: selectedVideo.title,
          assetId: selectedVideo.assetId,
          thumbnail: selectedVideo.thumbnail,
        } : null}
        onPlayStart={handleVideoPlayStart}
      />
    </>
  );
}
