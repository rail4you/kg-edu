import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
  Row,
  Col,
  Button,
  Spin,
  Empty,
  Modal,
} from "antd";
import {
  BookOutlined,
  PlayCircleOutlined,
  FolderOutlined,
  EyeOutlined,
  ReadOutlined,
  PaperClipOutlined,
  CaretRightOutlined,
  CheckCircleOutlined,
  VideoCameraOutlined,
  ScheduleOutlined,
  TeamOutlined,
  PictureOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  listCourses,
  listChapters,
  listFiles,
  getFullHierarchy,
  listLinks,
  listVideos,
  listCourseVideos,
  listBooks,
  listAssignmentsByCourse,
  updateCourse,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import FilePreview from "@/components/FilePreview";
import { themeColors as colors } from "@/styles/theme";
import "@/styles/student-course-intro.css";

const { Title, Text, Paragraph } = Typography;

// Design system tokens (from Stitch prototype)
const ds = {
  bg: "#f8f9fa",
  surface: "#ffffff",
  surfaceLow: "#f3f4f5",
  surfaceHigh: "#e7e8e9",
  primary: colors.primary,
  primaryLight: "rgba(37, 115, 230, 0.06)",
  primaryBorder: "rgba(37, 115, 230, 0.12)",
  onSurface: "#191c1d",
  onSurfaceVariant: "#424754",
  muted: "#757780",
  outline: "rgba(114, 128, 150, 0.15)",
  radiusXL: 16,
  radiusLG: 12,
  radiusMD: 8,
  shadow: "0 8px 32px rgba(0, 88, 190, 0.04)",
  shadowSm: "0 2px 8px rgba(0, 88, 190, 0.03)",
};

export default function CourseIntroPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const selectedCourseId = localStorage.getItem("selectedCourse") || "";
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string; isPdf?: boolean } | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [imageSlideIndex, setImageSlideIndex] = useState(0);
  // mediaMode: "auto" = show images if available, else video poster; "video" = show video player/poster
  const [mediaMode, setMediaMode] = useState<"auto" | "video">("auto");

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses-intro", currentTenant?.id],
    queryFn: () =>
      listCourses({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "title", "description", "imageUrl", "teacherId", "major", "publishStatus", "browseCount", "semesterHours"],
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

  const incrementBrowseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourseId || !currentTenant) return;
      const result = await updateCourse({
        tenant: currentTenant.schemaName,
        primaryKey: selectedCourseId,
        input: {
          title: selectedCourse?.title || "",
          browseCount: (selectedCourse?.browseCount || 0) + 1,
          teacherId: selectedCourse?.teacherId || "",
        },
        fields: ["id", "browseCount"],
        headers: getAuthHeaders(user),
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses-intro", currentTenant?.id] });
    },
  });

  React.useEffect(() => {
    if (selectedCourseId && currentTenant && user) {
      incrementBrowseMutation.mutate();
    }
  }, [selectedCourseId]);

  const { data: chaptersData, isLoading: chaptersLoading } = useQuery({
    queryKey: ["chapters-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listChapters({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", "description", "sortOrder", "courseId", "path", "parentChapterId"],
            filter: { courseId: { eq: selectedCourseId } },
            sort: "+path",
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const chapters = chaptersData?.success
    ? Array.isArray(chaptersData.data)
      ? chaptersData.data
      : (chaptersData.data as any)?.results || []
    : [];

  const chapterTree = React.useMemo(() => {
    if (!chapters.length) return [];
    const map: Record<string, any> = {};
    const roots: any[] = [];
    chapters.forEach((chapter: any) => {
      map[chapter.id] = { ...chapter, key: chapter.id, title: chapter.title, children: [] };
    });
    chapters.forEach((chapter: any) => {
      if (chapter.parentChapterId && map[chapter.parentChapterId]) {
        map[chapter.parentChapterId].children.push(map[chapter.id]);
      } else {
        roots.push(map[chapter.id]);
      }
    });
    const sortByPath = (items: any[]): any[] =>
      items.sort((a, b) => (a.path && b.path ? a.path.localeCompare(b.path) : 0)).map(item => ({
        ...item,
        children: item.children.length ? sortByPath(item.children) : [],
      }));
    return sortByPath(roots);
  }, [chapters]);

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ["knowledge-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? getFullHierarchy({
            tenant: currentTenant?.schemaName || "",
            input: { courseId: selectedCourseId },
            fields: [
              "id", "name", "knowledgeType",
              { childUnits: ["id", "name", "knowledgeType", { childCells: ["id", "name", "knowledgeType"] }] },
            ],
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) {
        const hierarchyData = Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
        const flatItems: any[] = [];
        const seenIds = new Set<string>();
        hierarchyData.forEach((subject: any) => {
          if (!seenIds.has(subject.id)) { flatItems.push(subject); seenIds.add(subject.id); }
          if (subject.childUnits && Array.isArray(subject.childUnits)) {
            subject.childUnits.forEach((unit: any) => {
              if (!seenIds.has(unit.id)) { flatItems.push(unit); seenIds.add(unit.id); }
              if (unit.childCells && Array.isArray(unit.childCells)) {
                unit.childCells.forEach((cell: any) => {
                  if (!seenIds.has(cell.id)) { flatItems.push(cell); seenIds.add(cell.id); }
                });
              }
            });
          }
        });
        return flatItems.reduce(
          (acc, item) => {
            switch (item.knowledgeType) {
              case "subject": acc.subjects++; break;
              case "knowledge_unit": acc.units++; break;
              case "knowledge_cell": acc.cells++; break;
              default: acc.other++;
            }
            acc.total++;
            return acc;
          },
          { subjects: 0, units: 0, cells: 0, other: 0, total: 0 }
        );
      }
      return { subjects: 0, units: 0, cells: 0, other: 0, total: 0 };
    },
  });

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["files-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listFiles({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "filename"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) return Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
      return [];
    },
  });

  const { data: linksData, isLoading: linksLoading } = useQuery({
    queryKey: ["links-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listLinks({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) return Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
      return [];
    },
  });

  const { data: videosData, isLoading: videosLoading } = useQuery({
    queryKey: ["videos-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listVideos({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", { chapter: ["courseId"] }],
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) {
        const videos = Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
        return videos.filter((v: any) => v.chapter?.courseId === selectedCourseId);
      }
      return [];
    },
  });

  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listBooks({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", "author", "publisher", "coverImage", "attachment"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) return Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
      return [];
    },
  });

  const { data: courseAlbumVideos } = useQuery({
    queryKey: ["courseAlbumVideos-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listCourseVideos({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "name", "mediaType", "videoUrl", "imageUrl", "courseId"],
            filter: { courseId: { eq: selectedCourseId } },
            sort: "+name",
            page: { limit: 100, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) return Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
      return [];
    },
  });

  const albumItems: any[] = courseAlbumVideos || [];
  const albumVideos = albumItems.filter((v: any) => (v.mediaType || "video") === "video");
  const albumImages = albumItems.filter((v: any) => v.mediaType === "image");
  const activeVideo = albumVideos[activeVideoIndex] || null;

  // Auto-rotate image slideshow every 4 seconds
  React.useEffect(() => {
    if (albumImages.length <= 1) return;
    const timer = setInterval(() => {
      setImageSlideIndex((prev) => (prev + 1) % albumImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [albumImages.length]);

  // Teacher data for teaching team section
  const { data: assignmentsData } = useQuery({
    queryKey: ["assignments-intro", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listAssignmentsByCourse({
            tenant: currentTenant?.schemaName || "",
            input: { courseId: selectedCourseId },
            fields: ["id", "role", { teacher: ["id", "name", "email"] }],
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
    select: (data) => {
      if (data?.success && data.data) return Array.isArray(data.data) ? data.data : (data.data as any)?.results || [];
      return [];
    },
  });

  const teachers = (assignmentsData || [])
    .filter((a: any) => a.teacher)
    .map((a: any) => ({
      id: a.teacher.id,
      name: a.teacher.name || a.teacher.email || "教师",
      role: a.role || "教师",
    }));

  const handleSelectVideo = (index: number) => {
    setActiveVideoIndex(index);
    setIsPlaying(false);
    setMediaMode("video");
  };

  const isLoading =
    coursesLoading || chaptersLoading || knowledgeLoading || filesLoading || linksLoading || videosLoading || booksLoading;

  const handleStartLearning = () => {
    navigate(`/dashboard/graph?courseId=${selectedCourseId}`);
  };

  const handleViewResources = () => {
    navigate(`/dashboard/resource?courseId=${selectedCourseId}`);
  };

  const generateChapterNumber = (path: string | null): string => {
    if (!path) return "";
    const parts: string[] = [];
    for (let i = 0; i < path.length; i += 4) {
      const part = path.substring(i, i + 4);
      const num = parseInt(part, 10);
      if (!isNaN(num)) parts.push(num.toString());
    }
    if (path.length === 4) return parts[0] || "";
    return parts.join(".");
  };

  const renderChapterCards = (nodes: any[], level: number = 0) => {
    const levelStyles = [
      { bg: "rgba(37, 115, 230, 0.05)", color: colors.primary, accent: colors.primary },
      { bg: "rgba(82, 196, 26, 0.05)", color: "#389e0d", accent: "#52c41a" },
      { bg: "rgba(250, 173, 20, 0.05)", color: "#d48806", accent: "#faad14" },
      { bg: "rgba(114, 46, 209, 0.05)", color: "#531dab", accent: "#722ed1" },
      { bg: "rgba(19, 194, 194, 0.05)", color: "#08979c", accent: "#13c2c2" },
    ];
    const style = levelStyles[level % levelStyles.length];
    const leftPadding = level * 16;

    return nodes.map((node: any, index: number) => {
      const hasChildren = node.children && node.children.length > 0;
      const chapterNumber = level === 0 ? `${index + 1}` : generateChapterNumber(node.path);
      return (
        <div key={node.id} style={{ marginBottom: level === 0 ? 6 : 3 }}>
          <div style={{ paddingLeft: leftPadding }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: level === 0 ? "10px 14px" : "7px 12px",
                borderRadius: ds.radiusMD,
                background: style.bg,
              }}
            >
              {chapterNumber && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    background: style.accent,
                    borderRadius: 6,
                    padding: "1px 7px",
                    lineHeight: "18px",
                    letterSpacing: 0.5,
                  }}
                >
                  {chapterNumber}
                </span>
              )}
              {hasChildren ? (
                <FolderOutlined style={{ color: style.color, fontSize: 13 }} />
              ) : (
                <BookOutlined style={{ color: style.color, fontSize: 13 }} />
              )}
              <Text strong={level === 0} style={{ flex: 1, fontSize: level === 0 ? 13.5 : 13, color: ds.onSurface }}>
                {node.title}
              </Text>
              {hasChildren && (
                <span style={{ fontSize: 10, color: ds.muted, fontWeight: 500 }}>
                  {node.children.length} 节
                </span>
              )}
            </div>
          </div>
          {hasChildren && (
            <div style={{ marginTop: 2 }}>{renderChapterCards(node.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (!currentTenant || !user) {
    return (
      <div style={{ minHeight: "100vh", background: ds.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <Title level={4} style={{ marginBottom: 16 }}>未选择组织</Title>
        <Text>请选择一个组织以访问课程内容</Text>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: ds.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>加载课程信息中...</Text>
      </div>
    );
  }

  if (!selectedCourse) {
    return (
      <div style={{ minHeight: "100vh", background: ds.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Empty description="未选择课程">
          <Button type="primary" onClick={() => navigate("/dashboard/front")}>选择课程</Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className="ci-page" style={{ minHeight: "100vh", background: ds.bg }}>
      {/* ═══════════════════ Hero Section: 7+5 Grid ═══════════════════ */}
      <section style={{ marginBottom: 24 }}>
        <div
          style={{
            background: ds.surface,
            borderRadius: ds.radiusXL,
            boxShadow: ds.shadowSm,
            padding: 24,
          }}
        >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "7fr 5fr",
            gap: 24,
          }}
        >
        {/* Left: Media Player (7 cols) - Video or Image Slideshow */}
        <div
          style={{
            borderRadius: ds.radiusLG,
            overflow: "hidden",
            background: "#0d1117",
            position: "relative",
            height: 320,
          }}
        >
          {(() => {
            const hasVideos = albumVideos.length > 0;
            const hasImages = albumImages.length > 0;
            const showVideoMode = mediaMode === "video" || !hasImages;

            // ── 1. Video playing ──
            if (isPlaying && activeVideo?.videoUrl) {
              return (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <video
                    src={activeVideo.videoUrl}
                    controls
                    autoPlay
                    style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
                  />
                  {/* Back to slideshow button */}
                  {hasImages && (
                    <div
                      onClick={() => { setIsPlaying(false); setMediaMode("auto"); }}
                      style={{
                        position: "absolute", top: 16, left: 16,
                        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                        borderRadius: 8, padding: "6px 12px",
                        color: "#fff", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <PictureOutlined /> 返回图片
                    </div>
                  )}
                  {/* Video selector badge */}
                  {albumVideos.length > 1 && (
                    <div
                      style={{
                        position: "absolute", top: 16, right: 16,
                        background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                        borderRadius: 8, padding: "4px 10px",
                        color: "#fff", fontSize: 12, fontWeight: 500,
                      }}
                    >
                      <VideoCameraOutlined style={{ marginRight: 5 }} />
                      {activeVideoIndex + 1} / {albumVideos.length}
                    </div>
                  )}
                </div>
              );
            }

            // ── 2. Video poster (when in video mode or no images) ──
            if (showVideoMode && hasVideos) {
              return (
                <>
                  {(activeVideo?.imageUrl || selectedCourse.imageUrl) && (
                    <img
                      src={activeVideo?.imageUrl || selectedCourse.imageUrl}
                      alt={activeVideo?.name || selectedCourse.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <div
                    style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)",
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => setIsPlaying(true)}
                  >
                    {/* Back to images if available */}
                    {hasImages && (
                      <div
                        onClick={(e) => { e.stopPropagation(); setMediaMode("auto"); }}
                        style={{
                          position: "absolute", top: 16, left: 16,
                          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
                          borderRadius: 8, padding: "6px 12px",
                          color: "#fff", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        <PictureOutlined /> 查看图片
                      </div>
                    )}
                    {/* Play button */}
                    <div
                      style={{
                        width: 72, height: 72, borderRadius: "50%",
                        background: "rgba(255,255,255,0.18)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1.5px solid rgba(255,255,255,0.3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.2s, background 0.2s",
                        boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "scale(1.08)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.28)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "scale(1)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                      }}
                    >
                      <CaretRightOutlined style={{ fontSize: 32, color: "#fff", marginLeft: 4 }} />
                    </div>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 600, marginTop: 14, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                      {activeVideo?.name || "播放视频"}
                    </span>
                    {/* Bottom title */}
                    <div style={{ position: "absolute", bottom: 20, left: 24, right: 24 }}>
                      <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
                        {selectedCourse.title}
                      </div>
                    </div>
                    {/* Video count badge */}
                    {albumVideos.length > 0 && (
                      <div
                        style={{
                          position: "absolute", top: 16, right: 16,
                          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                          borderRadius: 8, padding: "4px 10px",
                          color: "#fff", fontSize: 12, fontWeight: 500,
                        }}
                      >
                        <VideoCameraOutlined style={{ marginRight: 5 }} />
                        {albumVideos.length} 个视频
                      </div>
                    )}
                  </div>
                </>
              );
            }

            // ── 3. Image slideshow (when images exist and not in video mode) ──
            if (hasImages) {
              const currentImg = albumImages[imageSlideIndex];
              const total = albumImages.length;
              return (
                <div style={{ position: "relative", width: "100%", height: "100%" }}>
                  <img
                    src={currentImg.imageUrl}
                    alt={currentImg.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover", transition: "opacity 0.3s" }}
                  />
                  {/* Bottom gradient */}
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                    padding: "16px 20px",
                    display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                  }}>
                    <div>
                      <div style={{ color: "#fff", fontSize: 14, fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}>
                        {currentImg.name}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
                        {imageSlideIndex + 1} / {total}
                      </div>
                    </div>
                    {/* Nav dots */}
                    {total > 1 && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          onClick={() => setImageSlideIndex((imageSlideIndex - 1 + total) % total)}
                          style={{
                            background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%",
                            width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >‹</button>
                        {Array.from({ length: Math.min(total, 7) }, (_, i) => (
                          <div
                            key={i}
                            onClick={() => setImageSlideIndex(i)}
                            style={{
                              width: i === imageSlideIndex ? 20 : 8, height: 8, borderRadius: 4,
                              background: i === imageSlideIndex ? "#fff" : "rgba(255,255,255,0.4)",
                              cursor: "pointer", transition: "all 0.2s",
                            }}
                          />
                        ))}
                        <button
                          onClick={() => setImageSlideIndex((imageSlideIndex + 1) % total)}
                          style={{
                            background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%",
                            width: 28, height: 28, color: "#fff", cursor: "pointer", fontSize: 14,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >›</button>
                      </div>
                    )}
                  </div>
                  {/* Image count badge */}
                  <div style={{
                    position: "absolute", top: 16, right: 16,
                    background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)",
                    borderRadius: 8, padding: "4px 10px",
                    color: "#fff", fontSize: 12, fontWeight: 500,
                  }}>
                    <PictureOutlined style={{ marginRight: 5 }} />
                    {total} 张图片
                  </div>
                  {/* Switch to video mode button */}
                  {hasVideos && (
                    <div
                      onClick={() => { setActiveVideoIndex(0); setMediaMode("video"); }}
                      style={{
                        position: "absolute", top: 16, left: 16,
                        background: "rgba(37,115,230,0.85)",
                        borderRadius: 8, padding: "6px 12px",
                        color: "#fff", fontSize: 12, fontWeight: 600,
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <PlayCircleOutlined /> 播放视频
                    </div>
                  )}
                </div>
              );
            }

            // ── 4. Empty state ──
            return (
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                height: "100%", color: "#475569",
              }}>
                <VideoCameraOutlined style={{ fontSize: 48, color: "#475569", marginBottom: 16 }} />
                <span style={{ fontSize: 14 }}>暂无课程媒体</span>
              </div>
            );
          })()}
        </div>

        {/* Right: Course Info (5 cols) */}
        <div style={{ display: "flex", flexDirection: "column", height: 320 }}>
          {/* Top: Tags + Title + Description */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            {/* Tags */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {selectedCourse.major && (
                <span
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "4px 12px",
                    borderRadius: 20, background: ds.primaryLight, color: ds.primary,
                    border: `1px solid ${ds.primaryBorder}`,
                  }}
                >
                  {selectedCourse.major}
                </span>
              )}
              <span
                style={{
                  fontSize: 12, fontWeight: 600, padding: "4px 12px",
                  borderRadius: 20, background: "rgba(82,196,26,0.06)", color: "#389e0d",
                  border: "1px solid rgba(82,196,26,0.15)",
                }}
              >
                <CheckCircleOutlined style={{ marginRight: 4, fontSize: 11 }} />
                已发布
              </span>
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: "'Manrope', 'PingFang SC', 'Microsoft YaHei', sans-serif",
                fontSize: 26, fontWeight: 800, lineHeight: 1.3,
                color: ds.onSurface, margin: "0 0 10px 0",
                letterSpacing: "-0.02em",
              }}
            >
              {selectedCourse.title}
            </h1>

            {/* Description */}
            {selectedCourse.description && (
              <div>
                <div
                  style={{
                    color: ds.onSurfaceVariant,
                    fontSize: 13,
                    lineHeight: 1.6,
                    display: descExpanded ? "block" : "-webkit-box",
                    WebkitLineClamp: descExpanded ? undefined : 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {selectedCourse.description}
                </div>
                {!descExpanded && (
                  <span
                    onClick={() => setDescExpanded(true)}
                    style={{
                      fontSize: 12,
                      color: ds.primary,
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    ...展开更多
                  </span>
                )}
                {descExpanded && (
                  <span
                    onClick={() => setDescExpanded(false)}
                    style={{
                      fontSize: 12,
                      color: ds.primary,
                      cursor: "pointer",
                      fontWeight: 500,
                      marginLeft: 4,
                    }}
                  >
                    收起
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Info cards */}
          <div
            style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
              background: ds.surfaceLow, borderRadius: ds.radiusLG, padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ScheduleOutlined style={{ fontSize: 15, color: ds.primary }} />
              <div>
                <div style={{ fontSize: 12, color: ds.muted, fontWeight: 500 }}>学时</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ds.onSurface }}>
                  {selectedCourse.semesterHours || "--"} 学时
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BookOutlined style={{ fontSize: 15, color: "#722ed1" }} />
              <div>
                <div style={{ fontSize: 12, color: ds.muted, fontWeight: 500 }}>章节</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ds.onSurface }}>
                  {chapters.length} 个章节
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <EyeOutlined style={{ fontSize: 15, color: "#c41d7f" }} />
              <div>
                <div style={{ fontSize: 12, color: ds.muted, fontWeight: 500 }}>浏览</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ds.onSurface }}>
                  {selectedCourse.browseCount || 0} 次
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <TeamOutlined style={{ fontSize: 15, color: "#08979c" }} />
              <div>
                <div style={{ fontSize: 12, color: ds.muted, fontWeight: 500 }}>教师</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: ds.onSurface }}>
                  {teachers.length} 位教师
                </div>
              </div>
            </div>
          </div>

          {/* Action button - full width */}
          <Button
            block
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={handleStartLearning}
            style={{
              backgroundColor: colors.primary, borderColor: colors.primary,
              height: 44, fontWeight: 700, borderRadius: ds.radiusLG,
              fontSize: 15,
              boxShadow: `0 4px 14px rgba(37,115,230,0.25)`,
            }}
          >
            立即参加
          </Button>
        </div>
        </div>
        </div>
      </section>

      {/* ═══════════════════ Media Thumbnails (collapsible) ═══════════════════ */}
      {(albumVideos.length > 0 || albumImages.length > 1) && (
        <section style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {albumVideos.length > 0 && (
              <Button
                type="text"
                size="small"
                onClick={() => {
                  const el = document.getElementById("video-thumb-list");
                  const imgEl = document.getElementById("image-thumb-list");
                  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
                  // close image list when opening video list
                  if (imgEl) imgEl.style.display = "none";
                }}
                style={{
                  color: mediaMode === "video" ? ds.primary : ds.muted,
                  fontSize: 12, padding: "0 4px", height: 24,
                  fontWeight: mediaMode === "video" ? 600 : 400,
                }}
              >
                <VideoCameraOutlined style={{ marginRight: 4 }} />
                {albumVideos.length} 个视频
                <CaretRightOutlined style={{ fontSize: 10, marginLeft: 4, transition: "transform 0.2s" }} />
              </Button>
            )}
            {albumImages.length > 1 && (
              <Button
                type="text"
                size="small"
                onClick={() => {
                  const el = document.getElementById("image-thumb-list");
                  const vidEl = document.getElementById("video-thumb-list");
                  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
                  // close video list when opening image list
                  if (vidEl) vidEl.style.display = "none";
                  // switch hero to image mode
                  setMediaMode("auto");
                }}
                style={{
                  color: mediaMode === "auto" && albumImages.length > 0 ? "#13c2c2" : ds.muted,
                  fontSize: 12, padding: "0 4px", height: 24,
                  fontWeight: mediaMode === "auto" && albumImages.length > 0 ? 600 : 400,
                }}
              >
                <PictureOutlined style={{ marginRight: 4 }} />
                {albumImages.length} 张图片
                <CaretRightOutlined style={{ fontSize: 10, marginLeft: 4, transition: "transform 0.2s" }} />
              </Button>
            )}
          </div>

          {/* Video thumbnails */}
          {albumVideos.length > 0 && (
            <div
              id="video-thumb-list"
              style={{ display: "none", gap: 10, overflowX: "auto", paddingBottom: 4, marginTop: 8 }}
            >
              {albumVideos.map((video: any, index: number) => (
                <div
                  key={video.id}
                  onClick={() => handleSelectVideo(index)}
                  style={{
                    width: 140, flexShrink: 0,
                    borderRadius: ds.radiusMD,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: activeVideoIndex === index && mediaMode === "video" ? `2px solid ${ds.primary}` : "2px solid transparent",
                    opacity: activeVideoIndex === index && mediaMode === "video" ? 1 : 0.7,
                    transition: "all 0.2s",
                    boxShadow: activeVideoIndex === index && mediaMode === "video" ? `0 2px 12px ${ds.primaryBorder}` : "none",
                  }}
                >
                  {video.imageUrl ? (
                    <img
                      src={video.imageUrl}
                      alt={video.name}
                      style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%", aspectRatio: "16/9", background: ds.surfaceHigh,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <PlayCircleOutlined style={{ fontSize: 20, color: ds.muted }} />
                    </div>
                  )}
                  <div style={{ padding: "6px 8px", background: ds.surface }}>
                    <Text
                      style={{
                        display: "block", fontSize: 11,
                        color: activeVideoIndex === index && mediaMode === "video" ? ds.primary : ds.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontWeight: activeVideoIndex === index && mediaMode === "video" ? 600 : 400,
                      }}
                    >
                      {video.name}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image thumbnails */}
          {albumImages.length > 1 && (
            <div
              id="image-thumb-list"
              style={{ display: "none", gap: 10, overflowX: "auto", paddingBottom: 4, marginTop: 8 }}
            >
              {albumImages.map((img: any, index: number) => (
                <div
                  key={img.id}
                  onClick={() => { setImageSlideIndex(index); setMediaMode("auto"); }}
                  style={{
                    width: 120, flexShrink: 0,
                    borderRadius: ds.radiusMD,
                    overflow: "hidden",
                    cursor: "pointer",
                    border: imageSlideIndex === index && mediaMode === "auto" ? `2px solid #13c2c2` : "2px solid transparent",
                    opacity: imageSlideIndex === index && mediaMode === "auto" ? 1 : 0.7,
                    transition: "all 0.2s",
                    boxShadow: imageSlideIndex === index && mediaMode === "auto" ? "0 2px 12px rgba(19,194,194,0.15)" : "none",
                  }}
                >
                  {img.imageUrl ? (
                    <img
                      src={img.imageUrl}
                      alt={img.name}
                      style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%", aspectRatio: "4/3", background: ds.surfaceHigh,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <PictureOutlined style={{ fontSize: 20, color: ds.muted }} />
                    </div>
                  )}
                  <div style={{ padding: "4px 8px", background: ds.surface }}>
                    <Text
                      style={{
                        display: "block", fontSize: 11,
                        color: imageSlideIndex === index && mediaMode === "auto" ? "#13c2c2" : ds.muted,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontWeight: imageSlideIndex === index && mediaMode === "auto" ? 600 : 400,
                      }}
                    >
                      {img.name}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ═══════════════════ Content Area ═══════════════════ */}
      <section>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Statistics Bento Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: 12,
            }}
          >
            {/* Primary card - Knowledge Resources (4 cols) */}
            <div
              style={{
                gridColumn: "span 4",
                background: `linear-gradient(135deg, ${colors.primary}15 0%, ${colors.primary}08 100%)`,
                borderRadius: ds.radiusXL,
                padding: "20px 22px",
                color: colors.textPrimary,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                overflow: "hidden",
                minHeight: 100,
                border: `1px solid ${colors.primary}20`,
              }}
            >
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 1, opacity: 0.9, marginBottom: 8 }}>
                  知识资源
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: colors.primary }}>{knowledgeData?.total || 0}</span>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>个节点</span>
                </div>
              </div>
              <div style={{ position: "absolute", right: -8, bottom: -8, opacity: 0.1 }}>
                <CheckCircleOutlined style={{ fontSize: 72 }} />
              </div>
            </div>

            {/* Stats grid (8 cols, 3x2) */}
            <div style={{ gridColumn: "span 8", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "课程章节", value: chapters.length, icon: <BookOutlined />, bg: "rgba(114, 46, 209, 0.06)", color: "#722ed1" },
                { label: "课程教材", value: booksData?.length || 0, icon: <ReadOutlined />, bg: "rgba(82, 196, 26, 0.06)", color: "#389e0d" },
                { label: "教学视频", value: videosData?.length || 0, icon: <PlayCircleOutlined />, bg: "rgba(250, 173, 20, 0.06)", color: "#d48806" },
                { label: "浏览次数", value: selectedCourse?.browseCount || 0, icon: <EyeOutlined />, bg: "rgba(235, 47, 150, 0.06)", color: "#c41d7f" },
                { label: "学习资源", value: (filesData?.length || 0) + (linksData?.length || 0), icon: <FolderOutlined />, bg: "rgba(37, 115, 230, 0.06)", color: colors.primary },
                { label: "章节数", value: chapterTree.length, icon: <BookOutlined />, bg: "rgba(19, 194, 194, 0.06)", color: "#08979c" },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: item.bg,
                    borderRadius: ds.radiusLG,
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: 30, height: 30, borderRadius: 8,
                        background: ds.surface,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}
                    >
                      {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: 15, color: item.color } })}
                    </div>
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: ds.onSurface }}>{item.value}</div>
                    <div style={{ fontSize: 13, color: ds.muted, marginTop: 2, fontWeight: 500 }}>{item.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Course Books */}
          {booksData && booksData.length > 0 && (
            <div
              style={{
                borderRadius: ds.radiusXL,
                background: ds.surface,
                boxShadow: ds.shadowSm,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: ds.radiusMD,
                    background: "rgba(82, 196, 26, 0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <ReadOutlined style={{ fontSize: 16, color: "#389e0d" }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: ds.onSurface }}>
                  课程教材
                </span>
                <span style={{ fontSize: 12, color: ds.muted, marginLeft: 4 }}>
                  共 {booksData.length} 本
                </span>
              </div>
              <div style={{ padding: 16 }}>
                <Row gutter={[12, 12]}>
                  {booksData.map((book: any) => (
                    <Col xs={24} md={12} key={book.id}>
                      <div
                        style={{
                          background: ds.surfaceLow,
                          borderRadius: ds.radiusLG,
                          padding: 16,
                          display: "flex",
                          gap: 14,
                          transition: "background 0.2s",
                          cursor: book.attachment ? "pointer" : "default",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = ds.primaryLight; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = ds.surfaceLow; }}
                      >
                        {book.coverImage ? (
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            style={{
                              width: 72, height: 100, borderRadius: 6,
                              objectFit: "cover", flexShrink: 0,
                              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 72, height: 100, borderRadius: 6, flexShrink: 0,
                              background: ds.surfaceHigh,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            <BookOutlined style={{ fontSize: 28, color: ds.muted }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: ds.onSurface, marginBottom: 6, lineHeight: 1.3 }}>
                            {book.title}
                          </div>
                          {book.author && (
                            <Text style={{ fontSize: 12, color: ds.muted, display: "block", marginBottom: 3 }}>
                              作者: {book.author}
                            </Text>
                          )}
                          {book.publisher && (
                            <Text style={{ fontSize: 12, color: ds.muted, display: "block" }}>
                              出版社: {book.publisher}
                            </Text>
                          )}
                          {book.attachment && (
                            <Button
                              type="link"
                              size="small"
                              icon={<PaperClipOutlined />}
                              onClick={(e) => {
                                e.stopPropagation();
                                const fileName = book.attachment.split("/").pop() || "附件";
                                const ext = fileName.split(".").pop()?.toLowerCase() || "";
                                const isPdf = ext === "pdf";
                                const typeMap: Record<string, string> = {
                                  pdf: "application/pdf",
                                  doc: "application/msword",
                                  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                  ppt: "application/vnd.ms-powerpoint",
                                  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                                };
                                setPreviewFile({
                                  url: book.attachment,
                                  name: fileName,
                                  type: typeMap[ext] || "application/octet-stream",
                                  isPdf,
                                });
                              }}
                              style={{ padding: 0, marginTop: 8, fontSize: 12 }}
                            >
                              预览附件
                            </Button>
                          )}
                        </div>
                      </div>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          )}

          {/* Course Modules */}
          {chapterTree && chapterTree.length > 0 && (
            <div
              style={{
                borderRadius: ds.radiusXL,
                background: ds.surface,
                boxShadow: ds.shadowSm,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "20px 24px 0", display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 32, height: 32, borderRadius: ds.radiusMD,
                    background: ds.primaryLight,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <BookOutlined style={{ fontSize: 16, color: ds.primary }} />
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: ds.onSurface }}>
                  课程模块
                </span>
                <span style={{ fontSize: 12, color: ds.muted, marginLeft: 4 }}>
                  共 {chapters.length} 个章节
                </span>
              </div>
              <div style={{ padding: "8px 24px 20px" }}>
                {renderChapterCards(chapterTree)}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* File Preview Modal */}
      {previewFile && (
        <Modal
          title={previewFile.name}
          open={!!previewFile}
          onCancel={() => setPreviewFile(null)}
          footer={null}
          width={previewFile.isPdf ? "90vw" : 800}
          style={{ top: 20 }}
          styles={{ body: { height: "80vh", padding: 0 } }}
        >
          {previewFile.isPdf ? (
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewFile.url)}&embedded=true`}
              style={{ width: "100%", height: "100%", border: "none" }}
              title="PDF Preview"
            />
          ) : (
            <FilePreview
              open={!!previewFile}
              onClose={() => setPreviewFile(null)}
              file={previewFile}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
