import React, { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Grid, Typography, Spin } from "antd";
import {
  LeftOutlined,
  RightOutlined,
  CloseOutlined,
  ApartmentOutlined,
  PartitionOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import {
  listChapters,
  listKnowledges,
} from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { getAuthHeaders } from "@/lib/auth";
import { PanoramaGraphInner } from "@/components/PanoramaGraph";

const { Text } = Typography;

const modalStyleBase = {
  body: { padding: 0, background: "transparent", backgroundColor: "transparent" } as const,
  header: { display: "none" } as const,
  mask: {
    background: "rgba(8,12,28,0.78)",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  } as const,
};

interface CoursePanoramaProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  tenant: string;
  user: any;
  courseName: string;
  /** overview / 课程详情页同源的 courseInfo（含 background / objectives / target / courseStructure / courseHighlights） */
  courseInfo?: any;
  /** 传入后在标题栏显示「进入详情页」按钮 */
  onOpenDetail?: () => void;
  /** 与课程详情页主题一致的背景 overlay（rgba 渐变） */
  themeOverlayStart?: string;
  themeOverlayEnd?: string;
  /**
   * 页面是浅色主题时（如 amber_brown / mist_purple / inkstone_gray / celadon_gray），
   * 弹窗会铺上一层浅色 overlay，导致原来的白字看不清。
   * 传 true 会把内部文字/按钮改为深色调。
   */
  lightMode?: boolean;
}

/**
 * 课程全景窗口：同一个窗口内展示三个模块
 *  1. 课程体系 —— 课程背景 / 教学目标 / 目标学员（数据与 /dashboard/overview 同源：courseInfo）
 *  2. 课程结构 —— 课程结构说明 + 课程亮点（数据与 overview「课程结构」Tab 一致）
 *  3. 课程图谱 —— 树状图谱（课程 → 章节 → 知识点）
 */
export default function CoursePanorama({
  open,
  onClose,
  courseId,
  tenant,
  user,
  courseName,
  courseInfo,
  onOpenDetail,
  themeOverlayStart,
  themeOverlayEnd,
  lightMode = false,
}: CoursePanoramaProps) {
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const overlayStart = themeOverlayStart || "rgba(14, 22, 35, 0.84)";
  const overlayEnd = themeOverlayEnd || "rgba(35, 49, 70, 0.7)";
  const baseStart = "#132036";
  const baseEnd = "#0f1a2b";
  const bgImage = `linear-gradient(180deg, ${overlayStart} 0%, ${overlayEnd} 100%), linear-gradient(180deg, ${baseStart} 0%, ${baseEnd} 100%)`;

  // 浅色主题下需要反转为深色文字 / 深色控件背景
  const fgColor = lightMode ? "#3d2c14" : "#fff";
  const fgMuted = lightMode ? "rgba(60, 44, 20, 0.78)" : "rgba(255,255,255,0.78)";
  const fgFaint = lightMode ? "rgba(60, 44, 20, 0.55)" : "rgba(255,255,255,0.55)";
  const labelColor1 = lightMode ? "#6b5230" : "#9db8e0";
  const labelColor2 = lightMode ? "#5e7a64" : "#9bcab3";
  const bodyColor = lightMode ? "rgba(50, 35, 18, 0.92)" : "#e8eef7";
  const cardBg = lightMode ? "rgba(255, 252, 246, 0.55)" : "rgba(255,255,255,0.06)";
  const cardBorder = lightMode ? "rgba(80, 60, 30, 0.22)" : "1px solid rgba(255,255,255,0.12)";
  const headerBorder = lightMode ? "rgba(80, 60, 30, 0.18)" : "rgba(255,255,255,0.1)";
  const btnBorder = lightMode ? "rgba(80, 60, 30, 0.28)" : "rgba(255,255,255,0.28)";
  const btnBg = lightMode ? "rgba(80, 60, 30, 0.10)" : "rgba(255,255,255,0.12)";
  const btnBgHover = lightMode ? "rgba(80, 60, 30, 0.22)" : "rgba(255,255,255,0.26)";

  // ===== 树状图谱数据（与 PanoramaGraph「树图」同源）=====
  const { data: chaptersReq } = useQuery({
    queryKey: ["course-panorama-chapters", courseId, tenant],
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
    queryKey: ["course-panorama-knowledges", courseId, tenant],
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

  const chapters = (chaptersReq as any[]) || [];
  const knowledges = (knowledgesReq as any[]) || [];

  const dataProps = useMemo(
    () => ({
      chapters,
      knowledges,
      courseName,
      chartBgColor: "transparent",
    }),
    [chapters, knowledges, courseName],
  );

  const graphLoaded = chapters.length > 0 || knowledges.length > 0;

  // ===== 课程体系模块（与 overview 同源数据）=====
  const systemBlocks = useMemo(() => {
    const blocks: Array<{ label: string; content?: string | null }> = [];
    const background = courseInfo?.background || courseInfo?.courseIntroduction;
    if (background) blocks.push({ label: "课程背景", content: background });
    if (courseInfo?.objectives) blocks.push({ label: "教学目标", content: courseInfo.objectives });
    if (courseInfo?.target) blocks.push({ label: "目标学员", content: courseInfo.target });
    return blocks;
  }, [courseInfo]);

  // ===== 课程结构模块（与 overview「课程结构」Tab 一致）=====
  const structureBlocks = useMemo(() => {
    const blocks: Array<{ label: string; content?: string | null }> = [];
    if (courseInfo?.courseStructure) blocks.push({ label: "结构说明", content: courseInfo.courseStructure });
    if (courseInfo?.courseHighlights) blocks.push({ label: "课程亮点", content: courseInfo.courseHighlights });
    return blocks;
  }, [courseInfo]);

  const moduleCardStyle: React.CSSProperties = {
    borderRadius: 12,
    border: cardBorder,
    background: cardBg,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  };

  const moduleHeaderStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderBottom: `1px solid ${headerBorder}`,
    color: fgColor,
    fontSize: 14,
    fontWeight: 700,
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="92vw"
      centered
      destroyOnHidden={false}
      styles={{
        ...modalStyleBase,
        content: {
          backgroundImage: bgImage,
          backgroundColor: baseStart,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          borderRadius: 12,
          overflow: "hidden",
          padding: 0,
        },
        wrapper: { background: "transparent" },
      }}
      closeIcon={null}
    >
      <div
        style={{
          position: "relative",
          padding: isMobile ? 12 : 20,
          // 桌面固定窗口高度，三模块等高铺满；移动端自然高度
          height: isMobile ? undefined : "70vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          backgroundImage: bgImage,
          backgroundColor: baseStart,
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
            marginBottom: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ApartmentOutlined style={{ color: fgColor, fontSize: 16 }} />
            <span style={{ color: fgColor, fontSize: 15, fontWeight: 700 }}>
              课程全景 · {courseName || "课程"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {onOpenDetail ? (
              <button
                onClick={() => {
                  onClose();
                  onOpenDetail();
                }}
                style={{
                  height: 30,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: `1px solid ${btnBorder}`,
                  background: btnBg,
                  color: fgColor,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  backdropFilter: "blur(4px)",
                  WebkitBackdropFilter: "blur(4px)",
                  transition: "background 0.15s",
                } as React.CSSProperties}
                onMouseEnter={(e) => (e.currentTarget.style.background = btnBgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = btnBg)}
              >
                <RightOutlined style={{ fontSize: 11 }} />
                <span>进入详情页</span>
              </button>
            ) : null}
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                border: "none",
                background: btnBg,
                color: fgColor,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                transition: "background 0.15s",
              } as React.CSSProperties}
              onMouseEnter={(e) => (e.currentTarget.style.background = btnBgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = btnBg)}
              title="收起课程全景"
            >
              <CloseOutlined />
            </button>
          </div>
        </div>

        {/* 三个模块同一窗口 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1.1fr 1.1fr 1.3fr",
            gap: 12,
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* 模块一：课程体系 */}
          <div style={moduleCardStyle}>
            <div style={moduleHeaderStyle}>
              <PartitionOutlined style={{ color: "#7bb3ff" }} />
              <span>课程体系</span>
            </div>
            <div style={{ padding: "10px 14px", overflowY: "auto", flex: 1, minHeight: 0, maxHeight: isMobile ? 240 : undefined }}>
              {systemBlocks.length > 0 ? (
                systemBlocks.map((b) => (
                  <div key={b.label} style={{ marginBottom: 12 }}>
                    <div style={{ color: labelColor1, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      {b.label}
                    </div>
                    <div
                      style={{
                        color: bodyColor,
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {b.content}
                    </div>
                  </div>
                ))
              ) : (
                <Text style={{ color: fgFaint, fontSize: 13 }}>
                  暂无课程体系信息
                </Text>
              )}
            </div>
          </div>

          {/* 模块二：课程结构 */}
          <div style={moduleCardStyle}>
            <div style={moduleHeaderStyle}>
              <ShareAltOutlined style={{ color: "#7bd0a8" }} />
              <span>课程结构</span>
            </div>
            <div style={{ padding: "10px 14px", overflowY: "auto", flex: 1, minHeight: 0, maxHeight: isMobile ? 240 : undefined }}>
              {structureBlocks.length > 0 ? (
                structureBlocks.map((b) => (
                  <div key={b.label} style={{ marginBottom: 12 }}>
                    <div style={{ color: labelColor2, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                      {b.label}
                    </div>
                    <div
                      style={{
                        color: bodyColor,
                        fontSize: 13,
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {b.content}
                    </div>
                  </div>
                ))
              ) : (
                <Text style={{ color: fgFaint, fontSize: 13 }}>
                  暂无课程结构信息
                </Text>
              )}
            </div>
          </div>

          {/* 模块三：课程图谱（树状图谱） */}
          <div style={moduleCardStyle}>
            <div style={moduleHeaderStyle}>
              <ApartmentOutlined style={{ color: "#e8b06a" }} />
              <span>课程图谱 · 树状图谱</span>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: isMobile ? 300 : 0,
                minWidth: 0,
                position: "relative",
                padding: 4,
                width: "100%",
              } as React.CSSProperties}
            >
              {!graphLoaded ? (
                <div
                  style={{
                    height: "100%",
                    minHeight: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Spin size="large" />
                </div>
              ) : (
                <PanoramaGraphInner graphType="tree" {...dataProps} compact={false} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}