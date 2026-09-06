import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Tag,
  Table,
  Button,
  Modal,
  Input,
  Spin,
  Empty,
  Space,
  message,
  Radio,
  Popover,
  Grid,
} from "antd";
import {
  VideoCameraOutlined,
  FileOutlined,
  FileTextOutlined,
  ReadOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  BookOutlined,
  BulbOutlined,
  LinkOutlined,
  FolderOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import {
  listFiles,
  listVideos,
  listExercises,
  listHomeworks,
  listCourses,
  listLinks,
  logFileView,
  logVideoView,
  logExerciseSubmit,
  logHomeworkSubmit,
  listChapters,
  listKnowledges,
} from "@/lib/ash_rpc";
import FilePreview from "@/components/FilePreview";
import { useAuth } from "@/auth/auth-context";
import { useSearchParams } from "react-router-dom";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import type { ColumnsType } from "antd/es/table";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface ResourceItem {
  id: string;
  title: string;
  type: "video" | "file" | "exercise" | "homework" | "link";
  filename?: string;
  playbackId?: string;
  assetId?: string;
  path?: string;
  size?: number;
  fileType?: string;
  knowledgeType?: string;
  description?: string;
  url?: string;
  category?: string;
  sourceType: "file" | "video" | "exercise" | "homework" | "link";
}

interface VideoDialogState {
  open: boolean;
  assetId: string | null;
  title: string;
}

interface PreviewDialogState {
  open: boolean;
  file: {
    url: string;
    name: string;
    type: string;
    size?: number;
  };
}

interface StudyDialogState {
  open: boolean;
  resource: ResourceItem | null;
  type: "exercise" | "homework" | null;
  answer: string;
  revealAnswer: boolean;
  hasSubmitted: boolean;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "video":
      return <VideoCameraOutlined />;
    case "file":
      return <FileTextOutlined />;
    case "exercise":
      return <ReadOutlined />;
    case "homework":
      return <BookOutlined />;
    case "link":
      return <LinkOutlined />;
    default:
      return <FileOutlined />;
  }
};

const getTypeTag = (type: string) => {
  const typeMap: Record<string, { label: string; color: string }> = {
    video: { label: "视频", color: "purple" },
    file: { label: "文件", color: "blue" },
    exercise: { label: "练习", color: "orange" },
    homework: { label: "作业", color: "cyan" },
    link: { label: "链接", color: "green" },
  };
  const config = typeMap[type] || { label: "资源", color: "default" };
  return (
    <Tag icon={getTypeIcon(type)} color={config.color}>
      {config.label}
    </Tag>
  );
};

export default function ResourcePage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || currentTenant?.id || "";

  const [videoDialog, setVideoDialog] = useState<VideoDialogState>({
    open: false,
    assetId: null,
    title: "",
  });
  const [previewDialog, setPreviewDialog] = useState<PreviewDialogState>({
    open: false,
    file: { url: "", name: "", type: "" },
  });
  const [studyDialog, setStudyDialog] = useState<StudyDialogState>({
    open: false,
    resource: null,
    type: null,
    answer: "",
    revealAnswer: false,
    hasSubmitted: false,
  });
  const [tabValue, setTabValue] = useState(0);
  const [viewMode, setViewMode] = useState<"table" | "matrix">("matrix");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchParams] = useSearchParams();
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    // 优先级：URL 查询参数（来自 front 页面链接） > localStorage
    const urlCourseId = searchParams.get("courseId");
    const stored = localStorage.getItem("selectedCourse");
    return urlCourseId || stored || "";
  });

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourse", selectedCourseId);
    }
  }, [selectedCourseId]);

  const { data: coursesData } = useQuery({
    queryKey: ["courses", user?.id, tenant],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: ["id", "title", "description"],
        sort: "title",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!user && !!tenant,
  });

  const courses = useMemo(() => Array.isArray(coursesData) ? coursesData : (coursesData || []), [coursesData]);

  const currentCourse = useMemo(() => {
    if (!selectedCourseId || !Array.isArray(courses) || courses.length === 0) return null;
    return courses.find((course: any) => course.id === selectedCourseId);
  }, [selectedCourseId, courses]);

  const { data: filesData } = useQuery({
    queryKey: ["files", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listFiles({
        tenant,
        fields: ["id", "filename", "path", "size", "fileType", "knowledgeResourceId"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        sort: "-filename",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listChapters({
        tenant,
        fields: ["id", "title", "courseId"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        sort: "title",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const { data: videosData } = useQuery({
    queryKey: ["videos-list", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listVideos({
        tenant,
        fields: ["id", "title", "assetId", "chapterId"],
        sort: "-title",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listExercises({
        tenant,
        fields: ["id", "title", "questionContent", "questionType", "options", "answer", "aiType", "knowledgeResourceId"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        sort: "-title",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const { data: homeworksData } = useQuery({
    queryKey: ["homeworks", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listHomeworks({
        tenant,
        fields: ["id", "title", "content", "answer", "score", "chapterId"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        sort: "-title",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const { data: linksData } = useQuery({
    queryKey: ["links", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listLinks({
        tenant,
        fields: ["id", "title", "url", "category", "courseId"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        sort: "title",
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  // 获取知识点数据用于映射 exercise → chapter
  const { data: knowledgesData } = useQuery({
    queryKey: ["knowledges", selectedCourseId, user?.id, tenant],
    queryFn: async () => {
      const result = await listKnowledges({
        tenant,
        fields: ["id", "chapterId", "name"],
        filter: selectedCourseId ? { courseId: { eq: selectedCourseId } } : undefined,
        page: { limit: 500, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant,
  });

  const files = useMemo(() => {
    if (!filesData) return [];
    return filesData.map((file: any) => ({
      ...file,
      type: "file" as const,
      sourceType: "file" as const,
      title: file.filename || "Untitled File",
    }));
  }, [filesData]);

  const videos = useMemo(() => {
    if (!videosData) return [];
    const courseChapterIds = chaptersData
      ? chaptersData
          .filter((chapter: any) => chapter.courseId === selectedCourseId)
          .map((chapter: any) => chapter.id)
      : [];
    const filteredVideos =
      courseChapterIds.length > 0
        ? videosData.filter((video: any) => video.chapterId && courseChapterIds.includes(video.chapterId))
        : [];
    return filteredVideos.map((video: any) => ({
      ...video,
      type: "video" as const,
      sourceType: "video" as const,
      title: video.title || "Untitled Video",
      filename: video.title || "Untitled Video",
      assetId: video.assetId || undefined,
    }));
  }, [videosData, selectedCourseId, chaptersData]);

  const exercises = useMemo(() => {
    if (!exercisesData) return [];
    return exercisesData.map((exercise: any) => ({
      ...exercise,
      type: "exercise" as const,
      sourceType: "exercise" as const,
    }));
  }, [exercisesData]);

  const homeworks = useMemo(() => {
    if (!homeworksData) return [];
    return homeworksData.map((homework: any) => ({
      ...homework,
      type: "homework" as const,
      sourceType: "homework" as const,
    }));
  }, [homeworksData]);

  const links = useMemo(() => {
    if (!linksData) return [];
    return linksData.map((link: any) => ({
      ...link,
      type: "link" as const,
      sourceType: "link" as const,
      title: link.title || "Untitled Link",
    }));
  }, [linksData]);

  const allResources = useMemo(() => {
    return [...files, ...videos, ...exercises, ...homeworks, ...links];
  }, [files, videos, exercises, homeworks, links]);

  // 知识点 → 章节 映射
  const knowledgeToChapter = useMemo(() => {
    const map = new Map<string, string>();
    if (knowledgesData) {
      knowledgesData.forEach((k: any) => {
        if (k.id && k.chapterId) {
          map.set(k.id, k.chapterId);
        }
      });
    }
    return map;
  }, [knowledgesData]);

  // 获取资源对应的章节 ID
  const getResourceChapterId = (resource: ResourceItem): string | null => {
    if (resource.type === "video") return (resource as any).chapterId || null;
    if (resource.type === "homework") return (resource as any).chapterId || null;
    if (resource.type === "exercise" || resource.type === "file") {
      const krId = (resource as any).knowledgeResourceId;
      if (krId) return knowledgeToChapter.get(krId) || null;
    }
    return null;
  };

  // 章节排序列表
  const sortedChapters = useMemo(() => {
    if (!chaptersData) return [];
    return [...chaptersData]
      .filter((c: any) => c.courseId === selectedCourseId)
      .sort((a: any, b: any) => {
        const na = Number(a.displayNumber || a.title?.match(/^\d+/)?.[0] || 999);
        const nb = Number(b.displayNumber || b.title?.match(/^\d+/)?.[0] || 999);
        return na - nb;
      });
  }, [chaptersData, selectedCourseId]);

  const getTabResources = (tabIndex: number): ResourceItem[] => {
    let resources: ResourceItem[] = [];

    switch (tabIndex) {
      case 0:
        resources = allResources.filter(
          (resource) => !searchQuery.trim() || resource.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      case 1:
        resources = files.filter(
          (file) => !searchQuery.trim() || file.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      case 2:
        resources = videos.filter(
          (video) => !searchQuery.trim() || video.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      case 3:
        resources = exercises.filter(
          (exercise) => !searchQuery.trim() || exercise.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      case 4:
        resources = homeworks.filter(
          (homework) => !searchQuery.trim() || homework.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      case 5:
        resources = links.filter(
          (link) => !searchQuery.trim() || link.title.toLowerCase().includes(searchQuery.toLowerCase())
        );
        break;
      default:
        resources = allResources;
    }

    return resources;
  };

  // 按章节分组的资源矩阵数据
  const chapterMatrix = useMemo(() => {
    const matrix: Record<string, ResourceItem[]> = { _unassigned: [] };
    sortedChapters.forEach((ch: any) => { matrix[ch.id] = []; });

    const items = tabValue === 0 ? allResources : getTabResources(tabValue);
    const filtered = searchQuery.trim()
      ? items.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : items;

    filtered.forEach((resource: ResourceItem) => {
      const chapterId = getResourceChapterId(resource);
      if (chapterId && matrix[chapterId]) {
        matrix[chapterId].push(resource);
      } else {
        matrix._unassigned.push(resource);
      }
    });
    return matrix;
  }, [allResources, sortedChapters, tabValue, searchQuery, knowledgeToChapter]);

  const handleDownload = (path: string, filename: string) => {
    const link = document.createElement("a");
    link.href = path;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVideoPlay = (assetId: string, title: string) => {
    setVideoDialog({
      open: true,
      assetId,
      title,
    });
  };

  const handleFilePreview = (resource: ResourceItem) => {
    if (resource.path && resource.filename) {
      setPreviewDialog({
        open: true,
        file: {
          url: resource.path,
          name: resource.filename,
          type: resource.fileType || "",
          size: resource.size,
        },
      });
    }
  };

  const handleResourceAction = async (resource: ResourceItem, action: "preview" | "download" | "study") => {
    if (!user?.id) {
      message.warning("请先登录以记录学习活动");
      return;
    }

    switch (resource.type) {
      case "file":
        if (action === "study") {
          handleFilePreview(resource);
        } else if (resource.path && resource.filename) {
          handleDownload(resource.path, resource.filename);
          await logFileView({
            tenant,
            fields: ["id"],
            input: {
              userId: user.id,
              fileId: resource.id,
              metadata: { action: "download", filename: resource.filename },
            },
            headers: getHeaders(user),
          });
        }
        break;
      case "video":
        if (action === "study" && resource.assetId) {
          handleVideoPlay(resource.assetId, resource.title);
          await logVideoView({
            tenant,
            fields: ["id"],
            input: {
              userId: user.id,
              videoId: resource.id,
              metadata: { action: "study", title: resource.title },
            },
            headers: getHeaders(user),
          });
        }
        break;
      case "exercise":
        if (action === "study") {
          setStudyDialog({
            open: true,
            resource,
            type: "exercise",
            answer: "",
            revealAnswer: false,
            hasSubmitted: false,
          });
        }
        break;
      case "homework":
        if (action === "study") {
          setStudyDialog({
            open: true,
            resource,
            type: "homework",
            answer: "",
            revealAnswer: false,
            hasSubmitted: false,
          });
        }
        break;
      case "link":
        if (action === "study" && resource.url) {
          window.open(resource.url, "_blank", "noopener,noreferrer");
        }
        break;
      default:
        break;
    }
  };

  const handleStudySubmit = async () => {
    if (!user?.id || !studyDialog.resource || !studyDialog.type) {
      return;
    }

    const { resource, type, answer } = studyDialog;

    if (!answer.trim()) {
      message.warning("请输入答案后再提交");
      return;
    }

    try {
      const metadata = { answer: JSON.stringify({ answer: answer.trim() }) };

      if (type === "exercise") {
        await logExerciseSubmit({
          tenant,
          fields: ["id"],
          input: {
            userId: user.id,
            exerciseId: resource.id,
            answer: answer.trim(),
            metadata,
          },
          headers: getHeaders(user),
        });
      } else if (type === "homework") {
        await logHomeworkSubmit({
          tenant,
          fields: ["id"],
          input: {
            userId: user.id,
            homeworkId: resource.id,
            answer: answer.trim(),
            metadata,
          },
          headers: getHeaders(user),
        });
      }

      // 提交成功后，显示参考答案
      setStudyDialog((prev) => ({
        ...prev,
        revealAnswer: true,
        hasSubmitted: true,
      }));

      message.success("答案已提交并记录！");
    } catch (error) {
      console.error("Failed to submit answer:", error);
      message.error("提交失败，请重试");
    }
  };

  const columns: ColumnsType<ResourceItem> = [
    {
      title: "资源名称",
      dataIndex: "title",
      key: "title",
      width: "40%",
      ellipsis: true,
      render: (title: string, record: ResourceItem) => {
        if (record.type === "exercise") {
          const exerciseData = exercises?.find(e => e.id === record.id);
          if (exerciseData) {
            const cleanOptionPrefix = (text: string, letter: string): string => {
              const trimmed = text.trim();
              if (trimmed.match(new RegExp(`^${letter}[.、．)\\s]`, "i"))) {
                return trimmed.replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
              }
              return trimmed;
            };

            const parseExerciseOptions = (exercise: any) => {
              const raw = exercise.options;
              if (!raw) return null;
              const opts = typeof raw === "string" ? JSON.parse(raw) : raw;
              if (opts.choices && Array.isArray(opts.choices)) {
                return opts.choices.map((c: string, i: number) => ({
                  label: String.fromCharCode(65 + i),
                  text: cleanOptionPrefix(String(c), String.fromCharCode(65 + i)),
                }));
              }
              const letters = Object.keys(opts).filter(k => /^[A-Z]$/.test(k)).sort();
              if (letters.length > 0) {
                return letters.map(l => ({ label: l, text: cleanOptionPrefix(opts[l], l) }));
              }
              return null;
            };

            const getExerciseAnswer = (exercise: any, optList: { label: string; text: string }[] | null) => {
              const raw = exercise.options;
              const answer = exercise.answer || "";
              if (!answer) return "";
              let letter = "";
              if (raw) {
                const opts = typeof raw === "string" ? JSON.parse(raw) : raw;
                if (typeof opts.correctAnswer === "number") {
                  letter = String.fromCharCode(65 + opts.correctAnswer);
                }
              }
              if (!letter) {
                if (/^[A-Z]$/.test(answer)) {
                  letter = answer;
                } else {
                  const num = parseInt(answer, 10);
                  if (!isNaN(num) && num >= 1) letter = String.fromCharCode(64 + num);
                }
              }
              if (!letter) return answer;
              if (optList) {
                const found = optList.find(o => o.label === letter);
                if (found) return `${letter}. ${found.text}`;
              }
              return letter;
            };

            let optionList: { label: string; text: string }[] | null = null;
            let answerDisplay = "";
            try {
              optionList = parseExerciseOptions(exerciseData);
              answerDisplay = getExerciseAnswer(exerciseData, optionList);
            } catch {}

            return (
              <Popover
                content={
                  <div style={{ maxWidth: 400, maxHeight: 400, overflow: "auto" }}>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 14 }}>{exerciseData.title}</Text>
                    </div>
                    {exerciseData.questionContent && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>题目内容:</Text>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{exerciseData.questionContent}</div>
                      </div>
                    )}
                    {optionList && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>选项:</Text>
                        <div style={{ marginTop: 4 }}>
                          {optionList.map((opt, idx) => (
                            <div
                              key={idx}
                              style={{
                                padding: "4px 8px",
                                marginBottom: 4,
                                fontSize: 13,
                                backgroundColor: "#fafafa",
                                borderRadius: 4,
                                border: "1px solid #e8e8e8",
                              }}
                            >
                              <Text strong>{opt.label}. </Text>
                              <Text>{opt.text}</Text>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {answerDisplay && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>答案:</Text>
                        <div style={{ marginTop: 4, fontSize: 13, color: "#52c41a", fontWeight: "bold" }}>{answerDisplay}</div>
                      </div>
                    )}
                  </div>
                }
                trigger="hover"
                mouseEnterDelay={0.3}
              >
                <span style={{ cursor: "pointer", color: "#2573E6" }}>{title}</span>
              </Popover>
            );
          }
        }
        if (record.type === "homework") {
          const homeworkData = homeworks?.find(h => h.id === record.id);
          if (homeworkData) {
            return (
              <Popover
                content={
                  <div style={{ maxWidth: 400, maxHeight: 300, overflow: "auto" }}>
                    <div style={{ marginBottom: 12 }}>
                      <Text strong style={{ fontSize: 14 }}>{homeworkData.title}</Text>
                    </div>
                    {homeworkData.content && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>作业内容:</Text>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{homeworkData.content}</div>
                      </div>
                    )}
                    {homeworkData.score && (
                      <div style={{ marginBottom: 12 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>满分:</Text>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{homeworkData.score}</div>
                      </div>
                    )}
                  </div>
                }
                trigger="hover"
                mouseEnterDelay={0.3}
              >
                <span style={{ cursor: "pointer", color: "#2573E6" }}>{title}</span>
              </Popover>
            );
          }
        }
        return title;
      },
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 140,
      render: (type: string) => getTypeTag(type),
    },
    {
      title: "大小",
      dataIndex: "size",
      key: "size",
      width: 140,
      render: (size?: number) => formatFileSize(size),
    },
    {
      title: "操作",
      key: "action",
      width: 180,
      render: (_: any, record: ResourceItem) => (
        <Space size="small">
          {record.type === "file" && (
            <>
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleResourceAction(record, "study")}
              />
              <Button
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleResourceAction(record, "download")}
              />
            </>
          )}
          {record.type === "video" && (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => handleResourceAction(record, "study")}
            />
          )}
          {(record.type === "exercise" || record.type === "homework") && (
            <Button size="small" icon={<BookOutlined />} onClick={() => handleResourceAction(record, "study")} />
          )}
          {record.type === "link" && (
            <Button size="small" icon={<LinkOutlined />} onClick={() => handleResourceAction(record, "study")} />
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: "0", label: `全部 (${allResources.length})` },
    { key: "1", label: `文件 (${files.length})` },
    { key: "2", label: `视频 (${videos.length})` },
    { key: "3", label: `练习 (${exercises.length})` },
    { key: "4", label: `作业 (${homeworks.length})` },
    { key: "5", label: `链接 (${links.length})` },
  ];

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  const totalCount = allResources.length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.background }}>
      <div style={{ flexGrow: 1, overflow: "auto", padding: isMobile ? "12px" : "24px 32px" }}>
      {!selectedCourseId && (
        <div style={{
          background: "#FFFFFF",
          borderRadius: 12,
          padding: 64,
          textAlign: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <Empty description="未选择课程，请先从其他页面选择一个课程以查看学习资源" />
        </div>
      )}

      {selectedCourseId && (
        <>
          {/* 紧凑统计卡片 - 移动端 2x2 网格 */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: isMobile ? 6 : 16, marginBottom: isMobile ? 8 : 20 }}>
            {[
              { key: 0, label: "全部资源", val: totalCount, icon: <FolderOutlined />, bg: "rgba(37,115,230,0.04)", color: colors.primary, tabKey: 0 },
              { key: 1, label: "文件资源", val: files.length, icon: <FileTextOutlined />, bg: "rgba(37,115,230,0.04)", color: colors.primary, tabKey: 1 },
              { key: 2, label: "在线视频", val: videos.length, icon: <VideoCameraOutlined />, bg: "rgba(16,185,129,0.04)", color: "#10B981", tabKey: 2 },
              { key: 3, label: "练习题", val: exercises.length + homeworks.length, icon: <ReadOutlined />, bg: "rgba(209,105,0,0.04)", color: "#D16900", tabKey: 3 },
            ].map((item) => (
              <div key={item.key}
                onClick={() => { setTabValue(item.tabKey); setCurrentPage(1); }}
                style={{
                  background: item.bg,
                  borderRadius: isMobile ? 10 : 12,
                  padding: isMobile ? "10px 12px" : 20,
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 8 : 14,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: isMobile ? 36 : 44, height: isMobile ? 36 : 44, borderRadius: isMobile ? 8 : 10,
                  background: "#FFFFFF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                }}>
                  {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: isMobile ? 16 : 20, color: item.color } })}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, lineHeight: 1.15, color: colors.textPrimary }}>{item.val}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color: colors.textSecondary }}>{item.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* 资源列表 - 搜索 + Tab + 表格 */}
          <div style={{
            background: "#FFFFFF",
            borderRadius: 12,
            padding: isMobile ? "12px" : "20px 24px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {/* 标题行 + 搜索 */}
            <div style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              alignItems: isMobile ? "stretch" : "center",
              justifyContent: "space-between",
              marginBottom: 16,
              gap: 8,
            }}>
              <div>
                <h2 style={{
                  fontSize: isMobile ? 16 : 18,
                  fontWeight: 700,
                  fontFamily: "'Manrope', sans-serif",
                  color: colors.textPrimary,
                  margin: 0,
                }}>
                  资源列表
                </h2>
                <p style={{ fontSize: isMobile ? 12 : 13, color: colors.textSecondary, margin: "4px 0 0" }}>
                  当前课程的全部学习资源
                </p>
              </div>
              <Input.Search
                placeholder="搜索资源..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: isMobile ? "100%" : 260 }}
                allowClear
              />
            </div>

            {/* Tab 切换 - 紧凑药丸风格 */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: 3,
              background: "#F3F4F5",
              borderRadius: 9999,
              width: isMobile ? "100%" : "fit-content",
              overflowX: isMobile ? "auto" : "visible",
              marginBottom: isMobile ? 8 : 16,
              scrollbarWidth: "none",
            }}>
              {tabItems.map((tab) => (
                <div
                  key={tab.key}
                  onClick={() => { setTabValue(Number(tab.key)); setCurrentPage(1); }}
                  style={{
                    padding: isMobile ? "5px 12px" : "6px 16px",
                    cursor: "pointer",
                    fontSize: isMobile ? 12 : 13,
                    fontWeight: String(tabValue) === tab.key ? 600 : 400,
                    color: String(tabValue) === tab.key ? "#FFFFFF" : colors.textSecondary,
                    borderRadius: 9999,
                    background: String(tabValue) === tab.key ? colors.primary : "transparent",
                    transition: "all 0.2s ease",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => {
                    if (String(tabValue) !== tab.key) {
                      (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.5)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (String(tabValue) !== tab.key) {
                      (e.currentTarget as HTMLDivElement).style.background = "transparent";
                    }
                  }}
                >
                  {tab.label}
                </div>
              ))}
            </div>

            <div style={{ overflowX: "auto" }}>
            <Table
              columns={columns}
              dataSource={getTabResources(tabValue)}
              rowKey="id"
              pagination={{
                current: currentPage,
                pageSize: isMobile ? 5 : 10,
                onChange: (page) => setCurrentPage(page),
                showSizeChanger: false,
                size: isMobile ? "small" : "default",
                style: { marginBottom: 0 },
              }}
              size={isMobile ? "small" : "default"}
              scroll={{ x: isMobile ? 600 : undefined }}
              locale={{ emptyText: <Empty description="暂无资源" /> }}
            />
            </div>
          </div>
        </>
      )}
      </div>

      <Modal
        open={videoDialog.open}
        onCancel={() => setVideoDialog({ ...videoDialog, open: false })}
        title={videoDialog.title}
        footer={null}
        width={800}
      >
        {videoDialog.assetId && (
          <video src={videoDialog.assetId} controls autoPlay style={{ width: "100%", maxHeight: 500 }}>
            您的浏览器不支持视频播放。
          </video>
        )}
      </Modal>

      <FilePreview
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ ...previewDialog, open: false, file: { url: "", name: "", type: "" } })}
        file={previewDialog.file}
        onDownload={() => {
          if (previewDialog.file.url && previewDialog.file.name) {
            const link = document.createElement("a");
            link.href = previewDialog.file.url;
            link.download = previewDialog.file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />

      <Modal
        open={studyDialog.open}
        onCancel={() =>
          setStudyDialog({
            open: false,
            resource: null,
            type: null,
            answer: "",
            revealAnswer: false,
            hasSubmitted: false,
          })
        }
        title={`${studyDialog.type === "exercise" ? "练习学习" : "作业学习"} - ${studyDialog.resource?.title}`}
        footer={[
          <Button
            key="cancel"
            onClick={() =>
              setStudyDialog({
                open: false,
                resource: null,
                type: null,
                answer: "",
                revealAnswer: false,
                hasSubmitted: false,
              })
            }
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={handleStudySubmit}
            disabled={!studyDialog.answer.trim() || studyDialog.hasSubmitted}
          >
            {studyDialog.hasSubmitted ? "已提交" : "提交答案"}
          </Button>,
        ]}
        width={700}
      >
        {studyDialog.resource && (
          <div>
            {studyDialog.type === "exercise" && (studyDialog.resource as any).questionContent && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>题目内容：</Title>
                <Card size="small">
                  <Text>{(studyDialog.resource as any).questionContent}</Text>
                </Card>
                {/* 选择题显示选项列表 */}
                {(studyDialog.resource as any).questionType === "multiple_choice" && (studyDialog.resource as any).options && (() => {
                  try {
                    const rawOpts = typeof (studyDialog.resource as any).options === "string"
                      ? JSON.parse((studyDialog.resource as any).options)
                      : (studyDialog.resource as any).options;
                    if (rawOpts && Array.isArray(rawOpts.choices)) {
                      return (
                        <div style={{ marginTop: 12 }}>
                          <Text strong>选项：</Text>
                          <div style={{ marginTop: 8 }}>
                            {rawOpts.choices.map((choice: string, idx: number) => {
                              const letter = String.fromCharCode(65 + idx);
                              const cleaned = String(choice).trim().replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
                              return (
                              <div
                                key={idx}
                                style={{
                                  padding: "8px 12px",
                                  marginBottom: 4,
                                  background: "#fafafa",
                                  borderRadius: 4,
                                  border: "1px solid #e8e8e8",
                                }}
                              >
                                <Text>
                                  <strong>{letter}.</strong> {cleaned || choice}
                                </Text>
                              </div>
                            );})}
                          </div>
                        </div>
                      );
                    }
                    const letters = Object.keys(rawOpts || {}).filter((k: string) => /^[A-Z]$/.test(k)).sort();
                    if (letters.length > 0) {
                      return (
                        <div style={{ marginTop: 12 }}>
                          <Text strong>选项：</Text>
                          <div style={{ marginTop: 8 }}>
                            {letters.map((letter: string) => {
                              const cleaned = String(rawOpts[letter]).trim().replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
                              return (
                              <div
                                key={letter}
                                style={{
                                  padding: "8px 12px",
                                  marginBottom: 4,
                                  background: "#fafafa",
                                  borderRadius: 4,
                                  border: "1px solid #e8e8e8",
                                }}
                              >
                                <Text>
                                  <strong>{letter}.</strong> {cleaned || rawOpts[letter]}
                                </Text>
                              </div>
                            );})}
                          </div>
                        </div>
                      );
                    }
                  } catch {
                    // 解析失败
                  }
                  return null;
                })()}
              </div>
            )}

            {studyDialog.type === "homework" && (studyDialog.resource as any).content && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>作业内容：</Title>
                <Card size="small">
                  <Text>{(studyDialog.resource as any).content}</Text>
                </Card>
              </div>
            )}

            {/* 选择题用单选按钮选择答案 */}
            {studyDialog.type === "exercise" && (studyDialog.resource as any).questionType === "multiple_choice" ? (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>请选择你的答案：</Title>
                <Radio.Group
                  value={studyDialog.answer}
                  onChange={(e) => setStudyDialog({ ...studyDialog, answer: e.target.value })}
                  disabled={studyDialog.hasSubmitted}
                >
                  <Space direction="vertical">
                    {["A", "B", "C", "D"].map((letter, idx) => (
                      <Radio key={letter} value={letter}>
                        {letter}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            ) : (
              <>
                <Title level={5}>请输入你的答案：</Title>
                <TextArea
                  rows={4}
                  value={studyDialog.answer}
                  onChange={(e) => setStudyDialog({ ...studyDialog, answer: e.target.value })}
                  placeholder="在此输入答案..."
                  disabled={studyDialog.hasSubmitted}
                />
              </>
            )}

            {studyDialog.hasSubmitted && (
              <Card size="small" style={{ marginTop: 16, background: "#f6ffed", borderColor: "#b7eb8f" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <BulbOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                  <Text strong>参考答案：</Text>
                </div>
                <Paragraph style={{ marginTop: 8 }}>
                  {studyDialog.type === "exercise" && (studyDialog.resource as any).questionType === "multiple_choice"
                    ? (() => {
                        const answer = (studyDialog.resource as any).answer;
                        if (!answer) return "暂无参考答案";
                        let letter = "";
                        if (/^[A-Z]$/.test(answer)) {
                          letter = answer;
                        } else {
                          try {
                            const rawOpts = typeof (studyDialog.resource as any).options === "string"
                              ? JSON.parse((studyDialog.resource as any).options)
                              : (studyDialog.resource as any).options;
                            if (rawOpts && typeof rawOpts.correctAnswer === "number") {
                              letter = String.fromCharCode(65 + rawOpts.correctAnswer);
                            }
                          } catch {}
                          if (!letter) {
                            const num = parseInt(answer, 10);
                            if (!isNaN(num) && num >= 1) letter = String.fromCharCode(64 + num);
                          }
                        }
                        if (!letter) return answer;
                        try {
                          const rawOpts = typeof (studyDialog.resource as any).options === "string"
                            ? JSON.parse((studyDialog.resource as any).options)
                            : (studyDialog.resource as any).options;
                          if (rawOpts && Array.isArray(rawOpts.choices)) {
                            const idx = letter.charCodeAt(0) - 65;
                            if (rawOpts.choices[idx] != null) {
                              const cleaned = String(rawOpts.choices[idx]).trim().replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
                              return `${letter}. ${cleaned || rawOpts.choices[idx]}`;
                            }
                          }
                          if (rawOpts && rawOpts[letter]) {
                            const cleaned = String(rawOpts[letter]).trim().replace(new RegExp(`^${letter}[.、．)\\s]+`, "i"), "").trim();
                            return `${letter}. ${cleaned || rawOpts[letter]}`;
                          }
                        } catch {}
                        return letter;
                      })()
                    : (studyDialog.resource as any).answer || "暂无参考答案"}
                </Paragraph>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
