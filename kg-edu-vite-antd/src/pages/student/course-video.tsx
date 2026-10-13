import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
  Button,
  Spin,
  Empty,
  Space,
  Avatar,
  Modal,
  Input,
  message,
  Popconfirm,
  Radio,
  Rate,
  Grid,
} from "antd";
import {
  PlayCircleOutlined,
  LinkOutlined,
  VideoCameraOutlined,
  MessageOutlined,
  PlusOutlined,
  DeleteOutlined,
  UserOutlined,
  SearchOutlined,
  BulbOutlined,
  BookOutlined,
  EditOutlined,
  FolderOutlined,
  FileTextOutlined,
  RobotOutlined,
  LeftOutlined,
  RightOutlined,
  EyeOutlined,
  CloseCircleFilled,
} from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  listCourses,
  listChapters,
  listLinksByCourse,
  listDiscussionsByCourse,
  createDiscussion,
  updateDiscussion,
  deleteDiscussion,
  listCourseInfos,
  listKnowledges,
  listExercises,
  listFiles,
  getUser,
} from "@/lib/ash_rpc";
import type { DiscussionResourceSchema } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import FilePreview from "@/components/FilePreview";
import VideoAnalysisPanel from "@/components/video/VideoAnalysisPanel";
import { ProtoCard, ProgressBar, PageHead } from "@/components/proto";
import { themeColors as colors } from "@/styles/theme";
import FaceMonitorDock, { type FaceMonitorHandle, type FaceScene } from "@/components/exam/FaceMonitorDock";
import FaceSettingsButton from "@/components/exam/FaceSettingsButton";
import { loadFaceSettings, saveFaceSettings, type FaceCheckSettings } from "@/lib/face-settings";

const { Title, Text, Paragraph } = Typography;

interface Video {
  id: string;
  title?: string;
  assetId?: string;
  playbackId?: string;
  duration?: number;
  chapterId?: string;
  thumbnail?: string;
}

interface Chapter {
  id: string;
  title: string;
  description?: string;
  sortOrder?: number;
  path?: string;
  parent_chapter_id?: string;
  parentChapterId?: string;
  videos?: Video[];
  subchapters?: Chapter[];
  children?: Chapter[];
}

const stripVideoNumber = (title: string | undefined): string => {
  if (!title) return "";
  const stripped = title.replace(/^\d+(\.\d+)+\s*/, "");
  return stripped || title;
};

// 从视频标题中提取数字编号用于排序，如 "1.2 设计表现的发展史" → [1, 2]
const extractTitleNumber = (title: string | undefined): number[] => {
  if (!title) return [9999];
  const match = title.match(/^(\d+(?:\.\d+)*)/);
  if (!match) return [9999];
  return match[1].split(".").map(Number);
};

// 按标题数字编号排序视频
const sortVideosByTitle = (videos: Video[]): Video[] => {
  return [...videos].sort((a, b) => {
    const numsA = extractTitleNumber(a.title);
    const numsB = extractTitleNumber(b.title);
    for (let i = 0; i < Math.max(numsA.length, numsB.length); i++) {
      const va = numsA[i] ?? 0;
      const vb = numsB[i] ?? 0;
      if (va !== vb) return va - vb;
    }
    return 0;
  });
};

const formatDuration = (seconds?: number): string => {
  if (!seconds) return "";
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
};

export default function CourseVideoPage() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [searchParams] = useSearchParams();
  // 优先级：URL 查询参数（来自 front 页面链接） > localStorage
  const selectedCourseId =
    searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";
  // 注意: selectedCourse 在 courses 查询完成后才可用，教师查询依赖 enabled 条件守卫

  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTab, setCurrentTab] = useState("1");
  const [chapterTab, setChapterTab] = useState("note");
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [chapterSearchText, setChapterSearchText] = useState("");

  const [discussionModalVisible, setDiscussionModalVisible] = useState(false);
  const [editDiscussionModalVisible, setEditDiscussionModalVisible] = useState(false);
  const [editingDiscussion, setEditingDiscussion] = useState<DiscussionResourceSchema | null>(null);
  const [evaluationRating, setEvaluationRating] = useState<number>(5);
  const [discussionContent, setDiscussionContent] = useState("");

  // 课程笔记：按章节保存到 localStorage
  const notesKey =
    user?.id && selectedCourseId
      ? `course_video_notes:${currentTenant?.schemaName || ""}:${user.id}:${selectedCourseId}`
      : "";
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState("");
  const [hasVideoAnalysis, setHasVideoAnalysis] = useState(false);

  const mainVideoRef = useRef<HTMLVideoElement>(null);

  // 人脸监控抓拍
  const [faceMonitorOn, setFaceMonitorOn] = useState(false);
  const faceDockRef = useRef<FaceMonitorHandle>(null);
  const playedVideosRef = useRef<Set<string>>(new Set());
  const [faceSettings, setFaceSettings] = useState<FaceCheckSettings>(() => loadFaceSettings());
  const [faceOk, setFaceOk] = useState<boolean | null>(null);
  // 「不允许学习」模式下，识别失败即禁用右侧学习内容
  const faceBlocked = faceMonitorOn && faceSettings.mode === "block" && faceOk === false;

  useEffect(() => {
    saveFaceSettings(faceSettings);
  }, [faceSettings]);

  const handleFaceViolation = useCallback((scene: FaceScene) => {
    const el = mainVideoRef.current;
    if (el && !el.paused) el.pause();
    message.warning(`人脸识别失败（${scene}），请正对摄像头后继续播放`);
  }, []);

  // 进入课程时抓拍（开启监控后）
  useEffect(() => {
    if (!faceMonitorOn || !selectedCourseId) return;
    const t = window.setTimeout(() => faceDockRef.current?.captureNode("entry"), 1500);
    return () => window.clearTimeout(t);
  }, [faceMonitorOn, selectedCourseId]);

  // 观看进度持久化：记录已观看视频、每个视频的播放位置、最后观看的视频
  interface CourseProgress {
    completed: string[];
    positions: Record<string, number>;
    lastVideoId?: string;
  }
  const emptyProgress: CourseProgress = { completed: [], positions: {} };
  const progressKey =
    user?.id && selectedCourseId
      ? `course_video_progress:${currentTenant?.schemaName || ""}:${user.id}:${selectedCourseId}`
      : "";
  const [progress, setProgress] = useState<CourseProgress>(emptyProgress);
  const progressRef = useRef<CourseProgress>(emptyProgress);

  const updateProgress = useCallback(
    (updater: (p: CourseProgress) => CourseProgress) => {
      const next = updater(progressRef.current);
      progressRef.current = next;
      setProgress(next);
      if (progressKey) {
        try {
          localStorage.setItem(progressKey, JSON.stringify(next));
        } catch {
          /* ignore quota errors */
        }
      }
    },
    [progressKey],
  );

  useEffect(() => {
    let loaded: CourseProgress = emptyProgress;
    if (progressKey) {
      try {
        const raw = localStorage.getItem(progressKey);
        if (raw) loaded = { completed: [], positions: {}, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
    }
    progressRef.current = loaded;
    setProgress(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressKey]);

  const completedSet = useMemo(() => new Set(progress.completed), [progress.completed]);
  const markCompleted = useCallback(
    (videoId: string) => {
      updateProgress((p) =>
        p.completed.includes(videoId) ? p : { ...p, completed: [...p.completed, videoId] },
      );
    },
    [updateProgress],
  );

  // 视频完成：需先开启人脸监控并通过识别（含截图记录），失败则不计入完成
  const completeVideo = useCallback(
    async (videoId: string) => {
      if (!faceMonitorOn) {
        message.warning("请先开启人脸监控后再完成本节视频");
        return false;
      }
      const pass = await faceDockRef.current?.verify("video_end");
      if (!pass) {
        message.error("人脸识别未通过，本节完成进度未记录");
        return false;
      }
      markCompleted(videoId);
      message.success("人脸识别通过，本节已完成");
      return true;
    },
    [faceMonitorOn, markCompleted],
  );

  const stopMainVideo = useCallback(() => {
    const el = mainVideoRef.current;
    if (el) {
      if (currentVideo) {
        updateProgress((p) => ({
          ...p,
          positions: { ...p.positions, [currentVideo.id]: el.currentTime },
        }));
      }
      el.pause();
      el.currentTime = 0;
    }
    setIsPlaying(false);
  }, [currentVideo, updateProgress]);

  const [previewDialog, setPreviewDialog] = useState<{
    open: boolean;
    file: { url: string; name: string; type: string; size?: number };
  }>({ open: false, file: { url: "", name: "", type: "" } });

  const [studyDialog, setStudyDialog] = useState<{
    open: boolean;
    resource: any;
    type: "exercise" | "homework" | null;
    answer: string;
    revealAnswer: boolean;
    hasSubmitted: boolean;
  }>({ open: false, resource: null, type: null, answer: "", revealAnswer: false, hasSubmitted: false });

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses-video", currentTenant?.id],
    queryFn: () =>
      listCourses({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "title", "description", "imageUrl", "teacherId", "major", "semester"],
        headers: getAuthHeaders(user),
      }),
    enabled: !!currentTenant && !!user,
  });

  const courses = coursesData?.success
    ? Array.isArray(coursesData.data)
      ? coursesData.data
      : (coursesData.data as any)?.results || []
    : [];

  const selectedCourse = courses.find((c: any) => c.id === selectedCourseId);
  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters-videos", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listChapters({
            tenant: currentTenant?.schemaName || "",
            fields: [
              "id",
              "title",
              "description",
              "sortOrder",
              "path",
              "parentChapterId",
              { videos: ["id", "title", "assetId", "playbackId", "duration", "chapterId", "thumbnail"] },
            ],
            filter: { courseId: { eq: selectedCourseId } },
            sort: "+sortOrder",
            page: { limit: 100, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const chapters: Chapter[] = chaptersData?.success
    ? Array.isArray(chaptersData.data)
      ? chaptersData.data
      : (chaptersData.data as any)?.results || []
    : [];

  const allVideos: Video[] = chapters.flatMap((chapter) => chapter.videos || []);

  const buildChapterTree = (chs: Chapter[]): any[] => {
    const chapterMap = new Map<string, any>();
    chs.forEach((chapter) => {
      const sortedVideos = sortVideosByTitle(chapter.videos || []);
      chapterMap.set(chapter.id, { ...chapter, videos: sortedVideos, children: [] });
    });
    const rootNodes: any[] = [];
    chs.forEach((chapter) => {
      const node = chapterMap.get(chapter.id);
      const parentId = (chapter as any).parent_chapter_id || chapter.parentChapterId;
      if (!parentId) {
        rootNodes.push(node);
      } else {
        const parentNode = chapterMap.get(parentId);
        if (parentNode) {
          parentNode.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    });
    return rootNodes;
  };

  const chapterTree = buildChapterTree(chapters);

  const filterChaptersBySearch = (nodes: any[], keyword: string): any[] => {
    if (!keyword.trim()) return nodes;
    const lower = keyword.toLowerCase();
    return nodes.reduce((acc: any[], node) => {
      const titleMatch = node.title?.toLowerCase().includes(lower);
      const videoMatch = node.videos?.some((v: Video) => v.title?.toLowerCase().includes(lower));
      const filteredChildren = node.children ? filterChaptersBySearch(node.children, keyword) : [];
      if (titleMatch || videoMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
      }
      return acc;
    }, []);
  };

  const filteredChapterTree = chapterTree;
  const searchedChapterTree = chapterSearchText.trim()
    ? filterChaptersBySearch(filteredChapterTree, chapterSearchText)
    : filteredChapterTree;

  const flatVideoItems = useMemo(() => {
    const items: { video: Video; chapterTitle: string; path: string[] }[] = [];
    const walk = (nodes: any[], path: string[]) => {
      for (const n of nodes) {
        const p = [...path, n.title];
        (n.videos || []).forEach((v: Video) => items.push({ video: v, chapterTitle: n.title, path: p }));
        if (n.children?.length) walk(n.children, p);
      }
    };
    walk(searchedChapterTree, []);
    return items;
  }, [searchedChapterTree]);

  // 含视频的章节列表（用章节名，时间取该章节所有视频总时长）
  const chaptersWithVideos = useMemo(() => {
    const out: { chapter: any; videos: Video[]; totalDuration: number }[] = [];
    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        const videos = (n.videos || []) as Video[];
        if (videos.length > 0) {
          const totalDuration = videos.reduce((sum, v) => sum + (v.duration || 0), 0);
          out.push({ chapter: n, videos, totalDuration });
        }
        if (n.children?.length) walk(n.children);
      }
    };
    walk(searchedChapterTree);
    return out;
  }, [searchedChapterTree]);

  // 课程详细信息（教学目标、课程结构等）
  const { data: courseInfoData } = useQuery({
    queryKey: ["courseInfo-video", selectedCourseId, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const result = await listCourseInfos({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "courseHighlights", "courseIntroduction", "courseStructure", "background", "objectives", "target"],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getAuthHeaders(user),
      });
      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });
  const courseInfo = courseInfoData;

  // 主讲教师
  const { data: creatorData } = useQuery({
    queryKey: ["user-video", selectedCourse?.teacherId, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourse?.teacherId) return null;
      const result = await getUser({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge"],
        input: { id: selectedCourse.teacherId },
        headers: getAuthHeaders(user),
      });
      return result?.success ? result.data : null;
    },
    enabled: !!selectedCourse?.teacherId && !!currentTenant && !!user,
  });
  const courseCreator = creatorData;

  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ["course-links", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listLinksByCourse({
            tenant: currentTenant?.schemaName || "",
            input: { courseId: selectedCourseId },
            fields: ["id", "title", "url", "category"],
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const links = linksData?.success
    ? Array.isArray(linksData.data)
      ? linksData.data
      : (linksData.data as any)?.results || []
    : [];

  // 章节资源 / 练习：教师端配置数据（知识点按章节归属，习题/文件挂到知识点）
  const { data: knowledgesData } = useQuery({
    queryKey: ["course-knowledges-video", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listKnowledges({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "chapterId"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 500, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });
  const knowledges = knowledgesData?.success ? extractArrayData(knowledgesData) : [];
  const knowledgeChapterMap = useMemo(() => {
    const map: Record<string, string> = {};
    (knowledges as any[]).forEach((k) => {
      if (k?.id && k?.chapterId) map[k.id] = k.chapterId;
    });
    return map;
  }, [knowledges]);

  const { data: exercisesData } = useQuery({
    queryKey: ["course-exercises-video", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listExercises({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", "questionContent", "questionType", "options", "answer", "answerExplanation", "knowledgeResourceId"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 500, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });
  const exercises = exercisesData?.success ? extractArrayData(exercisesData) : [];

  const { data: filesData } = useQuery({
    queryKey: ["course-files-video", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listFiles({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "filename", "fileType", "path", "assetId", "knowledgeResourceId"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 500, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });
  const files = filesData?.success ? extractArrayData(filesData) : [];

  const currentChapterId = currentVideo?.chapterId || chapters[0]?.id || "";
  const currentChapter = chapters.find((c) => c.id === currentChapterId) || null;
  const currentChapterTitle = currentChapter?.title || "";

  const chapterExercises = useMemo(
    () => (exercises as any[]).filter((e) => knowledgeChapterMap[e.knowledgeResourceId] === currentChapterId),
    [exercises, knowledgeChapterMap, currentChapterId],
  );
  const chapterFiles = useMemo(
    () => (files as any[]).filter((f) => knowledgeChapterMap[f.knowledgeResourceId] === currentChapterId),
    [files, knowledgeChapterMap, currentChapterId],
  );
  const chapterVideos = useMemo(
    () => allVideos.filter((v) => v.chapterId === currentChapterId),
    [allVideos, currentChapterId],
  );

  // 笔记：按课程+章节从 localStorage 读取
  useEffect(() => {
    if (!notesKey) {
      setNotes({});
      return;
    }
    try {
      const raw = localStorage.getItem(notesKey);
      setNotes(raw ? JSON.parse(raw) : {});
    } catch {
      setNotes({});
    }
  }, [notesKey]);

  // 切换章节时载入该章节草稿
  useEffect(() => {
    setNoteDraft(notes[currentChapterId] || "");
  }, [currentChapterId, notes]);

  const saveNote = () => {
    if (!notesKey || !currentChapterId) return;
    const next = { ...notes, [currentChapterId]: noteDraft };
    setNotes(next);
    try {
      localStorage.setItem(notesKey, JSON.stringify(next));
      message.success("笔记已保存");
    } catch {
      message.error("笔记保存失败");
    }
  };

  // 当前视频是否有 AI 解析结果（有则在最后一个 tab 显示）
  useEffect(() => {
    let active = true;
    setHasVideoAnalysis(false);
    if (!currentVideo?.id || !currentTenant?.schemaName) return;
    const qs = `tenant=${encodeURIComponent(currentTenant.schemaName)}&videoType=video&videoId=${encodeURIComponent(currentVideo.id)}`;
    fetch(`/api/video-analysis/by-video?${qs}`, { headers: getAuthHeaders(user) as Record<string, string> })
      .then((r) => r.json())
      .then((meta) => {
        if (active) setHasVideoAnalysis(meta?.data?.status === "done");
      })
      .catch(() => {
        if (active) setHasVideoAnalysis(false);
      });
    return () => {
      active = false;
    };
  }, [currentVideo?.id, currentTenant?.schemaName, user]);

  const { data: discussionsData, isLoading: discussionsLoading } = useQuery({
    queryKey: ["discussions", selectedCourseId, currentTenant?.id],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const result = await listDiscussionsByCourse({
        tenant: currentTenant?.schemaName || "",
        input: { courseId: selectedCourseId },
        fields: ["id", "title", "content", "status", "rating", "insertedAt", { user: ["id", "name", "email"] }],
        headers: getAuthHeaders(user),
      });
      return result;
    },
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const discussions: DiscussionResourceSchema[] = discussionsData?.success
    ? Array.isArray(discussionsData.data)
      ? discussionsData.data
      : (discussionsData.data as any)?.results || []
    : [];

  // 检查当前用户是否已评价
  const myDiscussion = discussions.find((d: any) => (d as any).user?.id === user?.id);
  const hasEvaluated = !!myDiscussion;

  const createDiscussionMutation = useMutation({
    mutationFn: async (data: { content: string; rating: number }) => {
      const result = await createDiscussion({
        tenant: currentTenant?.schemaName || "",
        input: {
          title: "课程评价",
          content: data.content,
          rating: data.rating,
          courseId: selectedCourseId,
          userId: user?.id,
        },
        fields: ["id", "title", "content", "rating"],
        headers: getAuthHeaders(user),
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "创建失败");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussions", selectedCourseId, currentTenant?.id] });
      message.success("评价发布成功");
      setDiscussionModalVisible(false);
      setEvaluationRating(5);
      setDiscussionContent("");
    },
    onError: (error: any) => {
      message.error(error?.message || "发布失败");
    },
  });

  const deleteDiscussionMutation = useMutation({
    mutationFn: async (discussionId: string) => {
      const result = await deleteDiscussion({
        tenant: currentTenant?.schemaName || "",
        primaryKey: discussionId,
        headers: getAuthHeaders(user),
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "删除失败");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussions", selectedCourseId, currentTenant?.id] });
      message.success("删除成功");
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  const updateDiscussionMutation = useMutation({
    mutationFn: async (data: { id: string; content: string; rating: number }) => {
      const result = await updateDiscussion({
        tenant: currentTenant?.schemaName || "",
        primaryKey: data.id,
        input: {
          title: "课程评价",
          content: data.content,
        },
        fields: ["id", "title", "content", "rating"],
        headers: getAuthHeaders(user),
      });
      if (!result.success) {
        throw new Error((result as any).errors?.[0]?.message || "更新失败");
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discussions", selectedCourseId, currentTenant?.id] });
      message.success("评价更新成功");
      setEditDiscussionModalVisible(false);
      setEditingDiscussion(null);
      setEvaluationRating(5);
      setDiscussionContent("");
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const handleCreateDiscussion = () => {
    if (!discussionContent.trim()) {
      message.error("请输入评价内容");
      return;
    }
    if (!evaluationRating) {
      message.error("请选择评分");
      return;
    }
    createDiscussionMutation.mutate({ content: discussionContent.trim(), rating: evaluationRating });
  };

  useEffect(() => {
    if (currentVideo || allVideos.length === 0) return;
    const saved = progress.lastVideoId
      ? allVideos.find((v) => v.id === progress.lastVideoId)
      : undefined;
    setCurrentVideo(saved || allVideos[0]);
  }, [allVideos, currentVideo, progress.lastVideoId]);

  const handleShare = () => {
    setShareModalVisible(true);
  };

  const handleCopyLink = (link: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = link;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    try {
      const successful = document.execCommand("copy");
      if (successful) {
        message.success("链接已复制到剪贴板");
        setShareModalVisible(false);
      } else {
        message.error("复制失败，请手动复制");
      }
    } catch (err) {
      console.error("Failed to copy URL:", err);
      message.error("复制失败，请手动复制");
    }
    document.body.removeChild(textArea);
  };

  const getShareLink = () => {
    const baseUrl = window.location.origin + "/dashboard/course-video";
    const params = new URLSearchParams();
    if (selectedCourseId) params.set("course", selectedCourseId);
    if (currentVideo?.id) params.set("video", currentVideo.id);
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  const getShareText = () => {
    if (!currentVideo) return "";
    return `【课程视频】${stripVideoNumber(currentVideo.title) || "未知视频"} - 来自${selectedCourse?.title || "智慧教学系统"}`;
  };

  const getVideoUrl = (video: Video) => {
    return video.assetId || "";
  };

  const horizontalTabs = [
    { key: "1", label: "课程视频", icon: <PlayCircleOutlined /> },
    { key: "0", label: "课程简介", icon: <BookOutlined /> },
    { key: "3", label: "课程评价", icon: <MessageOutlined /> },
  ];

  // 视频下方「基于章节」的分栏 tab（课程笔记优先，AI 解析最后且仅有数据时显示）
  const chapterTabs = [
    { key: "note", label: "课程笔记", icon: <EditOutlined /> },
    { key: "resource", label: "学习资料", icon: <FolderOutlined /> },
    { key: "exercise", label: "章节练习", icon: <FileTextOutlined /> },
    ...(hasVideoAnalysis ? [{ key: "ai", label: "AI 解析", icon: <RobotOutlined /> }] : []),
  ];

  // ==================== 渲染视频播放器 ====================
  const renderVideoPlayer = () => {
    // 限制播放区高度（按 16:9 反推最大宽度），避免视频过高把下方元数据挤出视口
    const stageStyle: React.CSSProperties = { width: "min(100%, calc(48vh * 16 / 9))", margin: "0 auto" };

    if (allVideos.length === 0 || !currentVideo) {
      return (
        <div
          style={{
            ...stageStyle,
            aspectRatio: "16 / 9",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            borderRadius: 16,
          }}
        >
          <VideoCameraOutlined style={{ fontSize: 48, color: "#475569", marginBottom: 16 }} />
          <Text style={{ color: "#94a3b8", fontSize: 14 }}>该课程暂无视频内容</Text>
        </div>
      );
    }

    if (isPlaying) {
      return (
        <div style={{ ...stageStyle, position: "relative", borderRadius: 16, overflow: "hidden", background: "#000" }}>
          <div style={{ position: "relative", paddingTop: "56.25%" }}>
            <video
              ref={mainVideoRef}
              key={currentVideo.id}
              controls
              autoPlay
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
              src={getVideoUrl(currentVideo)}
              onLoadedMetadata={(e) => {
                const el = e.currentTarget;
                const pos = progressRef.current.positions[currentVideo.id] || 0;
                if (pos > 0 && (!el.duration || pos < el.duration - 1)) {
                  el.currentTime = pos;
                }
              }}
              onTimeUpdate={(e) => {
                const el = e.currentTarget;
                const t = el.currentTime;
                const saved = progressRef.current.positions[currentVideo.id] || 0;
                if (Math.abs(t - saved) >= 5) {
                  updateProgress((p) => ({
                    ...p,
                    positions: { ...p.positions, [currentVideo.id]: t },
                  }));
                }
              }}
              onPlay={() => {
                const id = currentVideo.id;
                const played = playedVideosRef.current.has(id);
                faceDockRef.current?.captureNode(played ? "video_resume" : "video_start");
                playedVideosRef.current.add(id);
              }}
              onPause={() => faceDockRef.current?.captureNode("video_playing")}
              onSeeked={() => faceDockRef.current?.captureNode("video_playing")}
              onEnded={() => {
                completeVideo(currentVideo.id);
              }}
            >
              您的浏览器不支持视频播放
            </video>
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          ...stageStyle,
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          cursor: "pointer",
        }}
        onClick={() => setIsPlaying(true)}
      >
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          {currentVideo.thumbnail ? (
            <img
              src={currentVideo.thumbnail}
              alt={currentVideo.title}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                background: "linear-gradient(135deg, #1a365d 0%, #2c5282 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <VideoCameraOutlined style={{ fontSize: 48, color: "rgba(255,255,255,0.2)" }} />
            </div>
          )}
          {/* 遮罩 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              inset: 0,
              background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.05) 50%, transparent 100%)",
            }}
          />
          {/* 播放按钮 */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translate(-50%, -50%) scale(1.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translate(-50%, -50%) scale(1)";
            }}
          >
            <PlayCircleOutlined style={{ fontSize: 32, color: colors.primary }} />
          </div>
          {/* 底部标题 */}
          {currentVideo.title && (
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 20px", zIndex: 2 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                {stripVideoNumber(currentVideo.title)}
              </Text>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==================== 渲染 Tab 内容 ====================
  const renderTabContent = () => {
    // 课程视频 Tab（主 Tab）
    if (currentTab === "1") {
      // === 两栏布局：左侧章节（含视频），右侧视频播放 ===
      const watchedCount = flatVideoItems.filter((it) => completedSet.has(it.video.id)).length;
      const progressPct = flatVideoItems.length > 0 ? Math.round((watchedCount / flatVideoItems.length) * 100) : 0;

      const activeChapter = chaptersWithVideos.find((c) => c.videos.some((v) => v.id === currentVideo?.id));
      const activeChapterTitle = activeChapter?.chapter?.title;
      const activeVideos = activeChapter?.videos || [];
      const videoIndex = activeVideos.findIndex((v) => v.id === currentVideo?.id);

      const playVideo = (video: Video) => {
        const el = mainVideoRef.current;
        // 点击/打开视频：保存当前播放位置（完成状态需人脸识别通过后记录）
        updateProgress((p) => ({
          ...p,
          positions: el && currentVideo ? { ...p.positions, [currentVideo.id]: el.currentTime } : p.positions,
          lastVideoId: video.id,
        }));
        setCurrentVideo(video);
        setIsPlaying(true);
      };

      return (
        <div style={{ height: "100%", display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden", background: colors.pageBg }}>
          {/* 左侧：章节目录 */}
          <div
            style={{
              width: isMobile ? "100%" : 280,
              flexShrink: 0,
              background: "#fff",
              borderRight: isMobile ? undefined : `1px solid ${colors.border}`,
              borderBottom: isMobile ? `1px solid ${colors.border}` : undefined,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxHeight: isMobile ? 260 : undefined,
            }}
          >
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: colors.textPrimary }}>章节目录</h3>
              <Input
                size="small"
                style={{ marginTop: 8 }}
                placeholder="搜索章节..."
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                allowClear
                value={chapterSearchText}
                onChange={(e) => setChapterSearchText(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
              {chaptersWithVideos.length === 0 ? (
                <Empty description="暂无视频" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
              ) : (
                chaptersWithVideos.map(({ chapter, videos, totalDuration }) => {
                  const active = chapter.id === currentVideo?.chapterId;
                  const allDone = videos.length > 0 && videos.every((v) => completedSet.has(v.id));
                  return (
                    <button
                      key={chapter.id}
                      type="button"
                      onClick={() => playVideo(videos[0])}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        cursor: "pointer",
                        padding: "8px 10px",
                        borderRadius: 8,
                        marginBottom: 2,
                        background: active ? `${colors.primary}12` : "transparent",
                        color: active ? colors.primary : colors.textPrimary,
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                      }}
                    >
                      <span style={{ width: 14, color: allDone ? colors.primary : "#c0c4cc" }}>
                        {allDone ? "✓" : ""}
                      </span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {chapter.title}
                      </span>
                      {totalDuration ? (
                        <span style={{ fontSize: 11, color: colors.textSecondary }}>{formatDuration(totalDuration)}</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: `1px solid ${colors.border}` }}>
              <ProgressBar percent={progressPct} />
              <div style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary }}>课程完成进度 {progressPct}%</div>
            </div>
          </div>

          {/* 右侧：视频 + 章节分栏 */}
          <div style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", padding: isMobile ? 12 : 20, display: "flex", flexDirection: "column", gap: 12, pointerEvents: faceBlocked ? "none" : "auto" }}>
            {faceBlocked && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 20,
                  pointerEvents: "auto",
                  background: "rgba(255,255,255,0.78)",
                  backdropFilter: "blur(1px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  textAlign: "center",
                  padding: 24,
                }}
              >
                <CloseCircleFilled style={{ fontSize: 42, color: "#ff4d4f" }} />
                <Title level={5} style={{ margin: 0 }}>
                  人脸识别失败，学习已暂停
                </Title>
                <Text type="secondary">请正对摄像头，识别通过后自动恢复</Text>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650, color: colors.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {stripVideoNumber(currentVideo?.title) || "未命名视频"}
              </h3>
              {activeVideos.length > 1 ? (
                <span style={{ flexShrink: 0, fontSize: 12, color: colors.textSecondary }}>
                  本章共 {activeVideos.length} 个视频
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              {renderVideoPlayer()}
            </div>

            {activeVideos.length > 1 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
                <Button
                  shape="circle"
                  size="small"
                  icon={<LeftOutlined />}
                  disabled={videoIndex <= 0}
                  onClick={() => videoIndex > 0 && playVideo(activeVideos[videoIndex - 1])}
                />
                <span style={{ fontSize: 12, color: colors.textSecondary }}>{videoIndex + 1} / {activeVideos.length}</span>
                <Button
                  shape="circle"
                  size="small"
                  icon={<RightOutlined />}
                  disabled={videoIndex < 0 || videoIndex >= activeVideos.length - 1}
                  onClick={() => {
                    if (currentVideo) completeVideo(currentVideo.id);
                    if (videoIndex >= 0 && videoIndex < activeVideos.length - 1) {
                      playVideo(activeVideos[videoIndex + 1]);
                    }
                  }}
                />
              </div>
            ) : null}

            {/* 基于章节的分栏：课程笔记 / 学习资料 / 章节练习 / AI 解析 */}
            <ProtoCard>
              <div className="pu-tabs" style={{ marginBottom: 16, marginTop: 0 }}>
                {chapterTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`pu-tabs__item${chapterTab === t.key ? " is-active" : ""}`}
                    onClick={() => setChapterTab(t.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 2px",
                      whiteSpace: "nowrap",
                      background: "transparent",
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
              {renderChapterPanel()}
            </ProtoCard>
          </div>
        </div>
      );
    }

    // 课程简介
    if (currentTab === "0") {
      return (
        <div style={{ padding: isMobile ? "12px" : "28px 32px", overflow: "auto", height: "100%", minHeight: 0, background: colors.pageBg }}>
          {/* 课程标题区 */}
          <div style={{
            background: "#fff",
            borderRadius: 14,
            padding: isMobile ? "16px" : "26px 30px",
            marginBottom: 16,
            border: "1px solid var(--pu-line)",
          }}>
            {/* 标签行 */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {selectedCourse?.major && (
                <span style={{
                  fontSize: 12, fontWeight: 700, padding: "5px 14px",
                  borderRadius: 20, background: `${colors.primary}12`, color: colors.primary,
                  border: `1px solid ${colors.primary}30`,
                }}>
                  {selectedCourse.major}
                </span>
              )}
              {selectedCourse?.semester && (
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 14px",
                  borderRadius: 20, background: "#edf0f5", color: "#666",
                }}>
                  {selectedCourse.semester}
                </span>
              )}
              {courseCreator && (
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: "5px 14px",
                  borderRadius: 20, background: "#edf0f5", color: "#666",
                }}>
                  <UserOutlined style={{ marginRight: 4, fontSize: 11 }} />
                  {courseCreator.name}
                  {courseCreator.jobTitle && <span style={{ marginLeft: 6, color: "#999" }}>· {courseCreator.jobTitle}</span>}
                </span>
              )}
            </div>

            {/* 主标题 - 大号突出显示 */}
            <h1 style={{
              fontSize: isMobile ? 20 : 28,
              fontWeight: 800,
              color: colors.textPrimary,
              margin: "0 0 16px 0",
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
              fontFamily: "'Manrope', 'PingFang SC', 'Microsoft YaHei', sans-serif",
            }}>
              {selectedCourse?.title || "课程标题"}
            </h1>

            {/* 课程描述 - 中号字号 */}
            <Paragraph style={{
              color: "#4a5568",
              lineHeight: 1.8,
              fontSize: 15,
              marginBottom: 0,
            }}>
              {selectedCourse?.description || courseInfo?.courseIntroduction || "暂无课程介绍"}
            </Paragraph>
          </div>

          {/* 内容卡片区 */}
          {[
            { key: "background", label: "课程背景" },
            { key: "objectives", label: "教学目标" },
            { key: "target", label: "目标学员" },
            { key: "courseStructure", label: "课程结构" },
            { key: "courseHighlights", label: "课程亮点" },
          ].map(({ key, label }) => {
            const content = courseInfo?.[key];
            if (!content) return null;
            return (
              <div key={key} style={{
                background: "#fff",
                borderRadius: 14,
                padding: isMobile ? "14px" : "22px 26px",
                marginBottom: isMobile ? 10 : 16,
                border: "1px solid var(--pu-line)",
              }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 650,
                  color: "var(--pu-ink)",
                  marginBottom: 14,
                }}>
                  {label}
                </div>
                <Paragraph style={{
                  color: colors.textPrimary,
                  lineHeight: 1.9,
                  fontSize: 14,
                  marginBottom: 0,
                  whiteSpace: "pre-wrap",
                }}>
                  {content}
                </Paragraph>
              </div>
            );
          })}

          {/* 空状态 */}
          {!courseInfo?.background && !courseInfo?.objectives && !courseInfo?.target && !courseInfo?.courseStructure && !courseInfo?.courseHighlights && (
            !selectedCourse?.description && !courseInfo?.courseIntroduction && (
              <Empty description={<span style={{ color: colors.textSecondary }}>暂无课程介绍信息</span>} />
            )
          )}
        </div>
      );
    }

    // 课程评价
    if (currentTab === "3") {
      return (
        <div style={{ padding: "24px 28px", background: colors.pageBg, height: "100%", overflow: "auto" }}>
          {/* 评价规则说明 */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 8,
            marginBottom: 20,
            padding: "12px 16px",
            background: `${colors.primary}08`,
            borderRadius: 10,
            border: `1px solid ${colors.primary}20`,
          }}>
            <BulbOutlined style={{ color: colors.primary, fontSize: 16 }} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>
              每门课程只能发表一次评价，发布后可修改内容
            </Text>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", marginBottom: 20 }}>
            {hasEvaluated ? (
              <Button icon={<EditOutlined />} onClick={() => {
                setEditingDiscussion(myDiscussion);
                setEvaluationRating(myDiscussion.rating || 5);
                setDiscussionContent(myDiscussion.content || "");
                setEditDiscussionModalVisible(true);
              }}>
                修改我的评价
              </Button>
            ) : (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setDiscussionModalVisible(true)}>
                发表评价
              </Button>
            )}
          </div>
          {discussionsLoading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Spin size="large" />
            </div>
          ) : discussions.length === 0 ? (
            <Empty description={<span style={{ color: colors.textSecondary }}>暂无课程评价，快来发表第一个评价吧</span>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {discussions.map((discussion) => (
                <div
                  key={discussion.id}
                  style={{
                    padding: 18,
                    borderRadius: 14,
                    background: "#fff",
                    border: "1px solid var(--pu-line)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ marginBottom: 8 }}>
                        <Rate disabled value={discussion.rating || 5} style={{ fontSize: 14 }} />
                        <Text style={{ marginLeft: 8, color: colors.textSecondary, fontSize: 13 }}>
                          {discussion.rating || 5} 分
                        </Text>
                      </div>
                      <Paragraph
                        ellipsis={{ rows: 2, expandable: true, symbol: "展开" }}
                        style={{ margin: 0, color: colors.textPrimary, fontSize: 14, lineHeight: 1.8 }}
                      >
                        {discussion.content}
                      </Paragraph>
                    </div>
                    {(discussion as any).user?.id === user?.id && (
                      <Popconfirm
                        title="确定删除此评价？"
                        onConfirm={() => deleteDiscussionMutation.mutate(discussion.id)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="text" danger icon={<DeleteOutlined />} size="small" />
                      </Popconfirm>
                    )}
                  </div>
                  <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: colors.primary }} />
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {(discussion as any).user?.id === user?.id
                          ? user?.displayName || user?.email?.split("@")[0] || "我"
                          : (discussion as any).user?.name || (discussion as any).user?.email?.split("@")[0] || "匿名用户"}
                      </Text>
                    </Space>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                      {discussion.insertedAt ? new Date(discussion.insertedAt).toLocaleString("zh-CN") : ""}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  // 视频下方「基于章节」的分栏内容（课程笔记 / 学习资料 / 章节练习 / AI 解析）
  const renderChapterPanel = () => {
    // 学习资料（教师端配置：章节文件 / 相关链接）
    if (chapterTab === "resource") {
      const empty = chapterFiles.length === 0 && links.length === 0;
      const rowStyle: React.CSSProperties = {
        display: "flex", alignItems: "center", gap: 14, padding: 14,
        background: "#fff", borderRadius: 10, border: "1px solid var(--pu-line)",
      };
      return (
        <div style={{ padding: isMobile ? "12px" : "24px 28px", background: colors.pageBg, height: "100%", overflow: "auto" }}>
          {currentChapterTitle ? (
            <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>当前章节：{currentChapterTitle}</div>
          ) : null}
          {empty ? (
            <Empty description={<span style={{ color: colors.textSecondary }}>该章节暂无学习资料</span>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {chapterFiles.map((f) => (
                <div key={f.id} style={rowStyle}>
                  <Avatar style={{ background: "#0ea5e9", borderRadius: 10 }} icon={<FolderOutlined />} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.textPrimary, display: "block", fontWeight: 500 }}>{f.filename}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{(f.fileType || "文件").toUpperCase()}</Text>
                  </div>
                  <Button
                    type="link"
                    onClick={() =>
                      setPreviewDialog({
                        open: true,
                        file: {
                          url: f.path || f.assetId || "",
                          name: f.filename,
                          type: (f.filename?.split(".").pop() || "").toLowerCase(),
                        },
                      })
                    }
                  >
                    预览
                  </Button>
                </div>
              ))}
              {links.map((link: any) => (
                <div key={link.id} style={rowStyle}>
                  <Avatar style={{ background: colors.primary, borderRadius: 10 }} icon={<LinkOutlined />} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: colors.textPrimary, display: "block", fontWeight: 500 }}>{link.title}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{link.url}</Text>
                  </div>
                  <Button type="link" onClick={() => window.open(link.url, "_blank")}>访问</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // 章节练习（教师端配置：该章节知识点下的习题）
    if (chapterTab === "exercise") {
      return (
        <div style={{ padding: isMobile ? "12px" : "24px 28px", background: colors.pageBg, height: "100%", overflow: "auto" }}>
          {currentChapterTitle ? (
            <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>当前章节：{currentChapterTitle}</div>
          ) : null}
          {chapterExercises.length === 0 ? (
            <Empty description={<span style={{ color: colors.textSecondary }}>该章节暂无练习</span>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {chapterExercises.map((ex: any, idx: number) => {
                const options = ex.options && typeof ex.options === "object"
                  ? Object.entries(ex.options as Record<string, unknown>)
                  : [];
                return (
                  <div key={ex.id} style={{ background: "#fff", borderRadius: 10, border: "1px solid var(--pu-line)", padding: 16 }}>
                    <div style={{ fontWeight: 600, color: colors.textPrimary, marginBottom: 8 }}>
                      {idx + 1}. {ex.title || "练习"}
                    </div>
                    <Paragraph style={{ whiteSpace: "pre-wrap", color: colors.textPrimary, marginBottom: options.length ? 10 : 12 }}>
                      {ex.questionContent}
                    </Paragraph>
                    {options.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                        {options.map(([key, val]) => (
                          <div key={key} style={{ fontSize: 13, color: colors.textSecondary }}>{key}. {String(val)}</div>
                        ))}
                      </div>
                    )}
                    {ex.answer ? (
                      <details>
                        <summary style={{ cursor: "pointer", color: colors.primary, fontSize: 13 }}>查看答案</summary>
                        <div style={{ marginTop: 8, fontSize: 13, color: colors.textPrimary, whiteSpace: "pre-wrap" }}>
                          {ex.answer}
                          {ex.answerExplanation ? (
                            <div style={{ marginTop: 6, color: colors.textSecondary }}>解析：{ex.answerExplanation}</div>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 课程笔记（按章节，保存到 localStorage）
    if (chapterTab === "note") {
      return (
        <div style={{ padding: isMobile ? "12px" : "24px 28px", background: colors.pageBg, height: "100%", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              {currentChapterTitle ? `当前章节：${currentChapterTitle}` : "选择一个章节以记录笔记"}
            </div>
            <Button type="primary" onClick={saveNote} disabled={!currentChapterId}>保存笔记</Button>
          </div>
          <Input.TextArea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="记录此刻的理解与灵感……"
            autoSize={{ minRows: 10, maxRows: 22 }}
            style={{ fontSize: 14, lineHeight: 1.9 }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
            笔记按章节保存在本地浏览器（localStorage），不会上传。
          </div>
        </div>
      );
    }

    // AI 解析（有数据时才作为最后一个 tab 展示）
    if (chapterTab === "ai") {
      return (
        <div style={{ padding: isMobile ? "12px" : "24px 28px", background: colors.pageBg, height: "100%", overflow: "auto" }}>
          {currentVideo ? (
            <VideoAnalysisPanel
              videoId={currentVideo.id}
              tenant={currentTenant?.schemaName || ""}
              headers={getAuthHeaders(user) as Record<string, string>}
              onSeek={(sec) => {
                if (mainVideoRef.current) {
                  mainVideoRef.current.currentTime = sec;
                  mainVideoRef.current.play().catch(() => {});
                }
              }}
            />
          ) : (
            <Empty description={<span style={{ color: colors.textSecondary }}>请先选择一个视频</span>} />
          )}
        </div>
      );
    }

    return null;
  };

  // ==================== 页面入口检查 ====================
  if (!currentTenant || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.pageBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Title level={4} style={{ color: colors.textPrimary, marginBottom: 16 }}>
          未选择组织
        </Title>
        <Text style={{ color: colors.textSecondary }}>请选择一个组织以查看课程视频</Text>
      </div>
    );
  }

  if (coursesLoading || chaptersLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.pageBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!selectedCourseId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: colors.pageBg,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <PlayCircleOutlined style={{ fontSize: 64, color: "#d9d9d9", marginBottom: 24 }} />
        <Title level={3} style={{ color: colors.textPrimary, marginBottom: 12 }}>
          未选择课程
        </Title>
        <Text style={{ color: colors.textSecondary, marginBottom: 24 }}>请先在首页选择一门课程</Text>
        <Button type="primary" onClick={() => (window.location.href = "/dashboard/front")}>
          前往选择课程
        </Button>
      </div>
    );
  }

  // ==================== 主渲染 ====================
  return (
    <div
      style={{
        height: isMobile ? "100%" : "calc(100vh - 64px)",
        background: colors.pageBg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* 页头：面包屑 + 标题 + 描述 */}
      <div style={{ flexShrink: 0, padding: isMobile ? "10px 8px 0" : "14px 16px 0" }}>
        <PageHead
          title="课程视频"
          description="观看章节视频，掌握课程内容并记录学习进度。"
        />
      </div>
      {/* 顶部导航栏：课程名 + Tab 切换 */}
      <div
        style={{
          flexShrink: 0,
          padding: isMobile ? "8px 8px" : "10px 16px 0",
          background: colors.pageBg,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: "1px solid var(--pu-line)",
            padding: isMobile ? "6px 10px" : "4px 18px",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 10 : 26,
            overflowX: "auto",
          }}
        >
          {horizontalTabs.map((tab) => {
            const isActive = currentTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  if (currentTab === "1") {
                    stopMainVideo();
                  }
                  setCurrentTab(tab.key);
                }}
                className={`pu-tabs__item${isActive ? " is-active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? 4 : 6,
                  padding: isMobile ? "10px 2px" : "14px 2px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  fontSize: isMobile ? 12 : 14,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
          <Button
            size="small"
            type={faceMonitorOn ? "primary" : "default"}
            icon={<EyeOutlined />}
            style={{ marginLeft: "auto", flexShrink: 0 }}
            onClick={() => setFaceMonitorOn((v) => !v)}
          >
            {faceMonitorOn ? "监控中" : "监控"}
          </Button>
          <FaceSettingsButton settings={faceSettings} onChange={setFaceSettings} />
        </div>
      </div>

      {/* Tab 内容区域 - 带边框容器 */}
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", padding: isMobile ? "0 8px 16px" : "12px 16px 16px" }}>
        <div style={{
          height: "100%",
          borderRadius: 14,
          border: "1px solid var(--pu-line)",
          overflow: "hidden",
        }}>
          {renderTabContent()}
        </div>
      </div>

      {/* 分享弹窗 */}
      <Modal
        title="分享视频"
        open={shareModalVisible}
        onCancel={() => setShareModalVisible(false)}
        footer={null}
        centered
      >
        <div style={{ padding: "16px 0" }}>
          {currentVideo ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">分享链接</Text>
                <Input
                  value={getShareLink()}
                  readOnly
                  suffix={
                    <Button type="link" onClick={() => handleCopyLink(getShareLink())} style={{ padding: 0 }}>
                      复制
                    </Button>
                  }
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary">分享文案</Text>
                <Input.TextArea value={getShareText()} readOnly rows={2} />
              </div>
              <Button type="primary" block onClick={() => handleCopyLink(getShareLink())}>
                一键复制分享
              </Button>
            </>
          ) : (
            <Empty description="请先选择一个视频" />
          )}
        </div>
      </Modal>

      {/* 评价弹窗 */}
      <Modal
        title="发表评价"
        open={discussionModalVisible}
        onCancel={() => {
          setDiscussionModalVisible(false);
          setEvaluationRating(5);
          setDiscussionContent("");
        }}
        onOk={handleCreateDiscussion}
        confirmLoading={createDiscussionMutation.isPending}
        okText="发布"
        cancelText="取消"
        centered
      >
        <div style={{ padding: "16px 0" }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ marginBottom: 8, display: "block" }}>
              评分 *
            </Text>
            <Rate value={evaluationRating} onChange={setEvaluationRating} style={{ fontSize: 24 }} />
            <Text style={{ marginLeft: 12, color: colors.textSecondary }}>{evaluationRating} 分</Text>
          </div>
          <div>
            <Text strong style={{ marginBottom: 8, display: "block" }}>
              评价内容 *
            </Text>
            <Input.TextArea
              placeholder="请输入评价内容"
              value={discussionContent}
              onChange={(e) => setDiscussionContent(e.target.value)}
              rows={4}
              maxLength={5000}
              showCount
            />
          </div>
        </div>
      </Modal>

      {/* 修改评价弹窗 */}
      <Modal
        title="修改评价"
        open={editDiscussionModalVisible}
        onCancel={() => {
          setEditDiscussionModalVisible(false);
          setEditingDiscussion(null);
          setEvaluationRating(5);
          setDiscussionContent("");
        }}
        onOk={() => {
          if (!discussionContent.trim()) {
            message.error("请输入评价内容");
            return;
          }
          if (editingDiscussion) {
            updateDiscussionMutation.mutate({
              id: editingDiscussion.id,
              content: discussionContent.trim(),
              rating: evaluationRating,
            });
          }
        }}
        confirmLoading={updateDiscussionMutation.isPending}
        okText="保存修改"
        cancelText="取消"
        centered
      >
        <div style={{ padding: "16px 0" }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ marginBottom: 8, display: "block" }}>
              评分（评分发布后不可修改）
            </Text>
            <Rate value={editingDiscussion?.rating || 5} disabled style={{ fontSize: 24 }} />
            <Text style={{ marginLeft: 12, color: colors.textSecondary }}>{editingDiscussion?.rating || 5} 分</Text>
          </div>
          <div>
            <Text strong style={{ marginBottom: 8, display: "block" }}>
              评价内容 *
            </Text>
            <Input.TextArea
              placeholder="请输入评价内容"
              value={discussionContent}
              onChange={(e) => setDiscussionContent(e.target.value)}
              rows={4}
              maxLength={5000}
              showCount
            />
          </div>
        </div>
      </Modal>

      {/* 文件预览弹窗 */}
      <FilePreview
        open={previewDialog.open}
        onClose={() => setPreviewDialog({ open: false, file: { url: "", name: "", type: "" } })}
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

      {/* 习题/作业弹窗 */}
      <Modal
        open={studyDialog.open}
        onCancel={() =>
          setStudyDialog({ open: false, resource: null, type: null, answer: "", revealAnswer: false, hasSubmitted: false })
        }
        title={`${studyDialog.type === "exercise" ? "练习" : "作业"} - ${studyDialog.resource?.title || ""}`}
        footer={[
          <Button
            key="cancel"
            onClick={() =>
              setStudyDialog({ open: false, resource: null, type: null, answer: "", revealAnswer: false, hasSubmitted: false })
            }
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            onClick={async () => {
              if (!user?.id || !studyDialog.resource || !studyDialog.type || !studyDialog.answer.trim()) {
                message.warning("请输入答案后再提交");
                return;
              }
              setStudyDialog((prev) => ({ ...prev, revealAnswer: true, hasSubmitted: true }));
              message.success("答案已提交并记录！");
            }}
            disabled={!studyDialog.answer.trim() || studyDialog.hasSubmitted}
          >
            {studyDialog.hasSubmitted ? "已提交" : "提交答案"}
          </Button>,
        ]}
        width={700}
        centered
      >
        {studyDialog.resource && (
          <div>
            {studyDialog.type === "exercise" && studyDialog.resource.questionContent && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>题目内容：</Title>
                <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}>
                  {studyDialog.resource.questionContent}
                </div>
              </div>
            )}
            {studyDialog.type === "homework" && studyDialog.resource.content && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>作业内容：</Title>
                <div style={{ padding: "8px 12px", background: "#fafafa", borderRadius: 4, border: `1px solid ${colors.border}`, fontSize: 13 }}>
                  {studyDialog.resource.content}
                </div>
              </div>
            )}
            {studyDialog.type === "exercise" && studyDialog.resource.questionType === "multiple_choice" ? (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>请选择你的答案：</Title>
                <Radio.Group
                  value={studyDialog.answer}
                  onChange={(e) => setStudyDialog({ ...studyDialog, answer: e.target.value })}
                  disabled={studyDialog.hasSubmitted}
                >
                  <Space direction="vertical">
                    {["A", "B", "C", "D"].map((letter) => (
                      <Radio key={letter} value={letter}>{letter}</Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </div>
            ) : (
              <>
                <Title level={5}>请输入你的答案：</Title>
                <Input.TextArea
                  rows={4}
                  value={studyDialog.answer}
                  onChange={(e) => setStudyDialog({ ...studyDialog, answer: e.target.value })}
                  placeholder="在此输入答案..."
                  disabled={studyDialog.hasSubmitted}
                />
              </>
            )}
            {studyDialog.hasSubmitted && (
              <div style={{ marginTop: 16, padding: "12px 16px", background: "#f6ffed", borderColor: "#b7eb8f", borderRadius: 8, border: "1px solid #b7eb8f" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <BulbOutlined style={{ color: "#52c41a", marginRight: 8 }} />
                  <Text strong>参考答案：</Text>
                </div>
                <Paragraph style={{ marginTop: 8 }}>
                  {studyDialog.resource.answer || "暂无参考答案"}
                </Paragraph>
              </div>
            )}
          </div>
        )}
      </Modal>

      <FaceMonitorDock
        ref={faceDockRef}
        enabled={faceMonitorOn}
        courseId={selectedCourseId || null}
        videoId={currentVideo?.id || null}
        videoName={currentVideo?.title || null}
        settings={faceSettings}
        onViolation={handleFaceViolation}
        onFaceStatus={setFaceOk}
        onClose={() => setFaceMonitorOn(false)}
      />
    </div>
  );
}
