import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography,
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
  VideoCameraOutlined,
  ScheduleOutlined,
  TeamOutlined,
  PictureOutlined,
  ApartmentOutlined,
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
import { ProtoCard, ProtoTag, StatGrid } from "@/components/proto";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text, Paragraph } = Typography;

// Design system tokens (from Stitch prototype)
const ds = {
  bg: "#f8f9fa",
  surface: "#ffffff",
  surfaceLow: "#f3f4f5",
  surfaceHigh: "#e7e8e9",
  primary: colors.primary,
  primaryLight: "rgba(40, 89, 223, 0.06)",
  primaryBorder: "rgba(40, 89, 223, 0.12)",
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
      { bg: "rgba(40, 89, 223, 0.08)", color: "#1d4fc4", accent: "#2859df" },
      { bg: "rgba(40, 89, 223, 0.055)", color: "#3f74e6", accent: "#4f82e8" },
      { bg: "rgba(40, 89, 223, 0.035)", color: "#5b8bef", accent: "#6f9cf2" },
      { bg: "rgba(40, 89, 223, 0.02)", color: "#7aa4f4", accent: "#8fb2f6" },
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
    <div className="pu-page">
      {/* ═══════════════════ 课程信息 ═══════════════════ */}
      <ProtoCard className="pu-intro-card">
        <div className="pu-intro-grid">
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 650, color: "var(--pu-ink)", marginBottom: 10 }}>
              {selectedCourse.title}
            </h2>
            <p style={{ color: "var(--pu-muted)", fontSize: 14, lineHeight: 1.9, margin: 0 }}>
              {selectedCourse.description || "建立扎实的专业基础，在理解与实践中形成自己的知识体系。"}
            </p>
          </div>

          <div className="pu-info">
            {[
              { label: "课程名称", value: selectedCourse.title },
              { label: "所属专业", value: selectedCourse.major || "—" },
              { label: "课程状态", value: "已发布" },
              { label: "总学时", value: `${selectedCourse.semesterHours || "--"} 学时` },
              { label: "章节数", value: `${chapters.length} 个章节` },
              { label: "浏览次数", value: `${selectedCourse.browseCount || 0} 次` },
              {
                label: "授课教师",
                value: teachers.length > 0 ? teachers.map((t: any) => t.name).join("、") : "教学团队",
              },
            ].map((row) => (
              <div className="pu-info__row" key={row.label}>
                <span className="pu-info__label">{row.label}</span>
                <span className="pu-info__value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </ProtoCard>

      {/* ═══════════════════ 数据概览 ═══════════════════ */}
      <div className="pu-intro-stats">
        <StatGrid
          columns={3}
          items={[
            { label: "知识资源", value: knowledgeData?.total || 0, unit: "个节点", desc: "课程知识体系规模", icon: <ApartmentOutlined /> },
            { label: "课程章节", value: chapters.length, unit: "章", desc: "含子章节结构", icon: <BookOutlined /> },
            { label: "课程教材", value: booksData?.length || 0, unit: "本", desc: "配套教材与讲义", icon: <ReadOutlined /> },
            { label: "教学视频", value: videosData?.length || 0, unit: "个", desc: "课程视频资源", icon: <PlayCircleOutlined /> },
            { label: "学习资源", value: (filesData?.length || 0) + (linksData?.length || 0), unit: "项", desc: "文件与链接资源", icon: <FolderOutlined /> },
            { label: "浏览次数", value: selectedCourse?.browseCount || 0, unit: "次", desc: "本课程累计浏览", icon: <EyeOutlined /> },
          ]}
        />
      </div>

      {/* ═══════════════════ 媒体播放 ═══════════════════ */}
      <ProtoCard
        title="课程媒体"
        extra={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {albumVideos.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("video-thumb-list");
                  const imgEl = document.getElementById("image-thumb-list");
                  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
                  if (imgEl) imgEl.style.display = "none";
                }}
                className={`pu-tabs__item${mediaMode === "video" ? " is-active" : ""}`}
                style={{ padding: "4px 8px", fontSize: 12, borderBottom: 0 }}
              >
                <VideoCameraOutlined style={{ marginRight: 4 }} />
                {albumVideos.length} 个视频
              </button>
            )}
            {albumImages.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById("image-thumb-list");
                  const vidEl = document.getElementById("video-thumb-list");
                  if (el) el.style.display = el.style.display === "none" ? "flex" : "none";
                  if (vidEl) vidEl.style.display = "none";
                  setMediaMode("auto");
                }}
                className={`pu-tabs__item${mediaMode === "auto" && albumImages.length > 0 ? " is-active" : ""}`}
                style={{ padding: "4px 8px", fontSize: 12, borderBottom: 0 }}
              >
                <PictureOutlined style={{ marginRight: 4 }} />
                {albumImages.length} 张图片
              </button>
            )}
          </div>
        }
        style={{ marginBottom: 20 }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "7fr 5fr",
            gap: 20,
          }}
        >
        {/* Left: Media Player (7 cols) - Video or Image Slideshow */}
        <div
          style={{
            borderRadius: 12,
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
                      position: "absolute", top: 0, right: 0, bottom: 0, left: 0, inset: 0,
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
                        background: "rgba(40, 89, 223,0.85)",
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

        {/* Right: 媒体信息 (5 cols) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
          <div
            style={{
              padding: 18,
              background: "#f6f8fb",
              borderRadius: 12,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div className="pu-eyebrow" style={{ marginBottom: 6 }}>正在播放</div>
            <div style={{ fontSize: 18, fontWeight: 650, color: ds.onSurface, lineHeight: 1.5 }}>
              {mediaMode === "video"
                ? activeVideo?.name || "课程视频"
                : albumImages[imageSlideIndex]?.name || selectedCourse.title}
            </div>
            <div style={{ fontSize: 13, color: ds.muted, marginTop: 8, lineHeight: 1.8 }}>
              {albumVideos.length > 0 && `${albumVideos.length} 个视频`}
              {albumVideos.length > 0 && albumImages.length > 0 && " · "}
              {albumImages.length > 0 && `${albumImages.length} 张图片`}
              {albumVideos.length === 0 && albumImages.length === 0 && "暂无课程媒体，可查看下方课程章节"}
            </div>
            <div className="pu-tags" style={{ marginTop: 16 }}>
              <ProtoTag tone="blue">{selectedCourse.major || "通用"}</ProtoTag>
              {selectedCourse.semesterHours ? <ProtoTag tone="gray">{selectedCourse.semesterHours} 学时</ProtoTag> : null}
              <ProtoTag tone="gray">{chapters.length} 章节</ProtoTag>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "学时", value: selectedCourse.semesterHours || "--", icon: <ScheduleOutlined /> },
              { label: "章节", value: chapters.length, icon: <BookOutlined /> },
              { label: "浏览", value: selectedCourse.browseCount || 0, icon: <EyeOutlined /> },
              { label: "教师", value: teachers.length, icon: <TeamOutlined /> },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", background: "#f6f8fb", borderRadius: 10,
                }}
              >
                <span style={{ color: ds.primary, display: "grid", placeItems: "center", fontSize: 16 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 12, color: ds.muted }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 650, color: ds.onSurface }}>{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
      </ProtoCard>

      {/* ═══════════════════ 课程内容 ═══════════════════ */}
      <div className="pu-grid pu-grid--two">
        <ProtoCard
          title="课程模块"
          extra={<span style={{ fontSize: 12, color: ds.muted }}>共 {chapters.length} 个章节</span>}
        >
          {chapterTree && chapterTree.length > 0 ? (
            <div style={{ maxHeight: 660, overflowY: "auto", paddingRight: 6 }}>
              {renderChapterCards(chapterTree)}
            </div>
          ) : (
            <Empty description="暂无章节信息" />
          )}
        </ProtoCard>

        <ProtoCard
          title="课程教材"
          extra={<span style={{ fontSize: 12, color: ds.muted }}>共 {booksData?.length || 0} 本</span>}
        >
          {booksData && booksData.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {booksData.map((book: any) => (
                <div
                  key={book.id}
                  style={{
                    background: "#f6f8fb",
                    borderRadius: 10,
                    padding: 14,
                    display: "flex",
                    gap: 14,
                    transition: "background 0.2s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = ds.primaryLight; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "#f6f8fb"; }}
                >
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      style={{
                        width: 64, height: 88, borderRadius: 6,
                        objectFit: "cover", flexShrink: 0,
                        border: `1px solid ${colors.border}`,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64, height: 88, borderRadius: 6, flexShrink: 0,
                        background: "#e7e8e9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <BookOutlined style={{ fontSize: 24, color: ds.muted }} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: ds.onSurface, marginBottom: 6, lineHeight: 1.4 }}>
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
              ))}
            </div>
          ) : (
            <Empty description="暂无教材信息" />
          )}
        </ProtoCard>
      </div>

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
              title="PDF 预览"
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
