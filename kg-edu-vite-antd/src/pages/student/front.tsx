import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Button,
  Avatar,
  Spin,
  Layout,
  Drawer,
  Grid,
} from "antd";
import {
  TeamOutlined,
  BookOutlined,
  RightOutlined,
  ClockCircleOutlined,
  BankOutlined,
  DownOutlined,
  UpOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  ApartmentOutlined,
  MenuOutlined,
  CommentOutlined,
  DeploymentUnitOutlined,
} from "@ant-design/icons";
import {
  getCourseByGuest,
  getCourseInfo,
  courseOverview,
  listOrganizations,
  listCourseAssignments,
  listCourseVideos,
  getUser,
  getMainAbilitiesByCourse,
  buildCSRFHeaders,
  listFiles,
  listVideos,
  listExercises,
  listHomeworks,
  listChapters,
  listKnowledges,
  listLinks,
  listDiscussionSessions,
  listQuestions,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { trackCourseView, getCourseViewStats } from "@/utils/viewTracking";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import CoursePanorama from "@/components/course-panorama";
import courseGraphImage from "@/assets/course-album/course-graph.jpg";
import courseStructureImage from "@/assets/course-album/course-structure.jpg";
import courseSystemImage from "@/assets/course-album/course-system.jpg";
import "@/styles/student-front-dashboard.css";

const { Paragraph } = Typography;
const { Header } = Layout;
const { useBreakpoint } = Grid;

type DashboardTheme = {
  pageOverlayStart: string;
  pageOverlayEnd: string;
  pageTopFade: string;
  headerBg: string;
  headerBorder: string;
  headerGlow: string;
  brandText: string;
  heroTitle: string;
  heroSubtitle: string;
  metaBg: string;
  metaBorder: string;
  metaText: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardMutedText: string;
  surfaceBg: string;
  surfaceBorder: string;
  ghostButtonBg: string;
  ghostButtonBorder: string;
  ghostButtonText: string;
  solidButtonBg: string;
  solidButtonText: string;
  solidButtonShadow: string;
  iconBg: string;
  iconText: string;
  systemBlue: string;
  systemViolet: string;
  systemGreen: string;
  systemGold: string;
  // 系统面板专用颜色
  systemPanelBlue: string;
  systemPanelViolet: string;
  systemPanelGreen: string;
  systemPanelGold: string;
  systemPanelTitle: string;
  logoVariant: "light" | "dark";
};

type ThemeStyle = React.CSSProperties & Record<`--front-${string}`, string>;

type PresetColorSchemeKey =
  | "graphite_blue"
  | "sea_mist"
  | "pine_green"
  | "amber_brown"
  | "mist_purple"
  | "inkstone_gray"
  | "celadon_gray";

type ColorSchemeKey = "auto" | "pure" | PresetColorSchemeKey;

type ColorSchemeOption = {
  key: ColorSchemeKey;
  name: string;
  description: string;
  swatch: string;
};

type CourseAssignmentItem = {
  id?: string;
  role?: string;
  teacher?: {
    id?: string;
    name?: string | null;
    jobTitle?: string | null;
    avatarUrl?: string | null;
    colledge?: string | null;
    major?: string | null;
  } | null;
};

type OrganizationItem = {
  id?: string;
  name?: string | null;
  schemaName?: string | null;
};

type CourseMediaItem = {
  id?: string;
  name?: "课程视频" | "课程体系" | "课程结构" | "课程地图" | string;
  mediaType?: "video" | "image" | string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  courseId?: string;
};

type AlbumCardPalette = "blue" | "violet" | "green" | "gold";

type AlbumCard = {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  route: string;
  actionLabel: string;
  highlights: string[];
  metricLabel: string;
  metricValue: string;
  imageUrl?: string | null;
  palette: AlbumCardPalette;
};

// SVG 树状图组件 - 替代原有图片
const TreeDiagramSVG: React.FC<{ palette: AlbumCardPalette; title: string }> = ({ palette, title }) => {
  const getColors = () => {
    switch (palette) {
      case "blue":
        return { primary: "#4a7ac4", secondary: "rgba(74, 122, 196, 0.35)", tertiary: "rgba(74, 122, 196, 0.2)", accent: "rgba(74, 122, 196, 0.1)" };
      case "violet":
        return { primary: "#8b6fc4", secondary: "rgba(139, 111, 196, 0.35)", tertiary: "rgba(139, 111, 196, 0.2)", accent: "rgba(139, 111, 196, 0.1)" };
      case "green":
        return { primary: "#4a9a7a", secondary: "rgba(74, 154, 122, 0.35)", tertiary: "rgba(74, 154, 122, 0.2)", accent: "rgba(74, 154, 122, 0.1)" };
      case "gold":
        return { primary: "#c49a4a", secondary: "rgba(196, 154, 74, 0.35)", tertiary: "rgba(196, 154, 74, 0.2)", accent: "rgba(196, 154, 74, 0.1)" };
      default:
        return { primary: "#4a7ac4", secondary: "rgba(74, 122, 196, 0.35)", tertiary: "rgba(74, 122, 196, 0.2)", accent: "rgba(74, 122, 196, 0.1)" };
    }
  };


  const colors = getColors();

  // 课程体系 - 层级树状结构
  if (title === "课程体系") {
    return (
      <svg viewBox="0 0 320 180" className="front-dashboard-album-card__svg">
        <defs>
          <linearGradient id="nodeGradBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={colors.primary} stopOpacity="0.75" />
          </linearGradient>
          <filter id="nodeShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(74, 122, 196, 0.15)" />
          </filter>
        </defs>
        
        {/* 根节点 - 核心 */}
        <circle cx="160" cy="36" r="32" fill="url(#nodeGradBlue)" filter="url(#nodeShadow)" />
        <text x="160" y="42" textAnchor="middle" fill="white" fontSize="14" fontWeight="800">核心</text>
        
        {/* 连接线 */}
        <line x1="160" y1="68" x2="160" y2="86" stroke={colors.secondary} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="100" y1="100" x2="140" y2="86" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" />
        <line x1="220" y1="100" x2="180" y2="86" stroke={colors.secondary} strokeWidth="2" strokeLinecap="round" />
        
        {/* 二级节点 - 三大模块 */}
        <rect x="68" y="86" width="64" height="36" rx="12" fill={colors.primary} filter="url(#nodeShadow)" />
        <text x="100" y="110" textAnchor="middle" fill="white" fontSize="12" fontWeight="700">知识</text>
        
        <rect x="128" y="86" width="64" height="36" rx="12" fill={colors.secondary} filter="url(#nodeShadow)" />
        <text x="160" y="110" textAnchor="middle" fill={colors.primary} fontSize="12" fontWeight="700">素养</text>
        
        <rect x="188" y="86" width="64" height="36" rx="12" fill={colors.tertiary} filter="url(#nodeShadow)" />
        <text x="220" y="110" textAnchor="middle" fill={colors.primary} fontSize="12" fontWeight="700">能力</text>
        
        {/* 底部三级节点 - 简洁 */}
        <circle cx="100" cy="148" r="16" fill={colors.accent} />
        <circle cx="160" cy="148" r="16" fill={colors.accent} />
        <circle cx="220" cy="148" r="16" fill={colors.accent} />
        
        {/* 底部装饰线 */}
        <line x1="100" y1="122" x2="100" y2="132" stroke={colors.tertiary} strokeWidth="1.5" strokeDasharray="3,3" />
        <line x1="160" y1="122" x2="160" y2="132" stroke={colors.tertiary} strokeWidth="1.5" strokeDasharray="3,3" />
        <line x1="220" y1="122" x2="220" y2="132" stroke={colors.tertiary} strokeWidth="1.5" strokeDasharray="3,3" />
      </svg>
    );
  }

  // 课程结构 - 网络/模块连接结构
  if (title === "课程结构") {
    return (
      <svg viewBox="0 0 320 180" className="front-dashboard-album-card__svg">
        <defs>
          <linearGradient id="centerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
            <stop offset="100%" stopColor={colors.primary} stopOpacity="0.8" />
          </linearGradient>
          <filter id="structShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.08)" />
          </filter>
        </defs>
        
        {/* 连接线 */}
        <path d="M80 50 L160 80" stroke={colors.secondary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M160 80 L240 50" stroke={colors.secondary} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M80 50 L80 100" stroke={colors.tertiary} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M240 50 L240 100" stroke={colors.tertiary} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M80 100 L160 125" stroke={colors.tertiary} strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M240 100 L160 125" stroke={colors.tertiary} strokeWidth="2" fill="none" strokeLinecap="round" />
        
        {/* 中心主节点 */}
        <rect x="105" y="56" width="110" height="48" rx="14" fill="url(#centerGrad)" filter="url(#structShadow)" />
        <text x="160" y="86" textAnchor="middle" fill="white" fontSize="16" fontWeight="900">章节</text>
        
        {/* 四个角模块 */}
        <rect x="30" y="26" width="80" height="40" rx="12" fill={colors.primary} filter="url(#structShadow)" />
        <text x="70" y="51" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">模块一</text>
        
        <rect x="210" y="26" width="80" height="40" rx="12" fill={colors.primary} filter="url(#structShadow)" />
        <text x="250" y="51" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">模块二</text>
        
        <rect x="30" y="86" width="80" height="40" rx="12" fill={colors.secondary} filter="url(#structShadow)" />
        <text x="70" y="111" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">模块三</text>
        
        <rect x="210" y="86" width="80" height="40" rx="12" fill={colors.secondary} filter="url(#structShadow)" />
        <text x="250" y="111" textAnchor="middle" fill="white" fontSize="11" fontWeight="700">模块四</text>
        
        {/* 底部单元 */}
        <rect x="30" y="140" width="52" height="28" rx="8" fill={colors.accent} />
        <text x="56" y="158" textAnchor="middle" fill={colors.primary} fontSize="10" fontWeight="600">单元1</text>
        
        <rect x="92" y="140" width="52" height="28" rx="8" fill={colors.accent} />
        <text x="118" y="158" textAnchor="middle" fill={colors.primary} fontSize="10" fontWeight="600">单元2</text>
        
        <rect x="154" y="140" width="52" height="28" rx="8" fill={colors.primary} filter="url(#structShadow)" />
        <text x="180" y="158" textAnchor="middle" fill="white" fontSize="10" fontWeight="700">单元3</text>
        
        <rect x="216" y="140" width="52" height="28" rx="8" fill={colors.accent} />
        <text x="242" y="158" textAnchor="middle" fill={colors.primary} fontSize="10" fontWeight="600">单元4</text>
      </svg>
    );
  }

  // 课程图谱 - 节点关系图
  return (
    <svg viewBox="0 0 320 180" className="front-dashboard-album-card__svg">
      <defs>
        <linearGradient id="coreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} stopOpacity="1" />
          <stop offset="100%" stopColor={colors.primary} stopOpacity="0.8" />
        </linearGradient>
        <filter id="graphShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.08)" />
        </filter>
      </defs>
      
      {/* 连接线 */}
      <line x1="160" y1="50" x2="90" y2="78" stroke={colors.secondary} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="160" y1="50" x2="230" y2="78" stroke={colors.secondary} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="160" y1="50" x2="160" y2="88" stroke={colors.secondary} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="90" y1="78" x2="60" y2="112" stroke={colors.tertiary} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="90" y1="78" x2="120" y2="112" stroke={colors.tertiary} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="230" y1="78" x2="200" y2="112" stroke={colors.tertiary} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="230" y1="78" x2="260" y2="112" stroke={colors.tertiary} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="160" y1="88" x2="160" y2="112" stroke={colors.tertiary} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* 中心主节点 */}
      <circle cx="160" cy="50" r="36" fill="url(#coreGrad)" filter="url(#graphShadow)" />
      <text x="160" y="56" textAnchor="middle" fill="white" fontSize="15" fontWeight="900">核心</text>
      
      {/* 一级节点 */}
      <rect x="58" y="58" width="64" height="36" rx="12" fill={colors.primary} filter="url(#graphShadow)" />
      <text x="90" y="81" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">A</text>
      
      <rect x="198" y="58" width="64" height="36" rx="12" fill={colors.primary} filter="url(#graphShadow)" />
      <text x="230" y="81" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">B</text>
      
      <rect x="128" y="68" width="64" height="36" rx="12" fill={colors.secondary} filter="url(#graphShadow)" />
      <text x="160" y="91" textAnchor="middle" fill="white" fontSize="13" fontWeight="800">C</text>
      
      {/* 二级节点 */}
      <circle cx="60" cy="112" r="18" fill={colors.accent} />
      <circle cx="120" cy="112" r="18" fill={colors.accent} />
      <circle cx="200" cy="112" r="18" fill={colors.accent} />
      <circle cx="260" cy="112" r="18" fill={colors.accent} />
      
      {/* 三级叶子节点 */}
      <circle cx="60" cy="148" r="12" fill={colors.tertiary} />
      <circle cx="120" cy="148" r="12" fill={colors.tertiary} />
      <circle cx="160" cy="148" r="14" fill={colors.secondary} />
      <circle cx="200" cy="148" r="12" fill={colors.tertiary} />
      <circle cx="260" cy="148" r="12" fill={colors.tertiary} />
      
      {/* 边缘装饰 */}
      <circle cx="18" cy="40" r="10" fill={colors.accent} />
      <circle cx="302" cy="44" r="9" fill={colors.accent} />
      <circle cx="298" cy="150" r="8" fill={colors.accent} />
      <circle cx="22" cy="148" r="9" fill={colors.accent} />
    </svg>
  );
};


const colorSchemeOptions: ColorSchemeOption[] = [
  {
    key: "auto",
    name: "自动匹配",
    description: "根据课程图片稳定映射到专业色域",
    swatch: "linear-gradient(135deg, #506481 0%, #9aa9bc 100%)",
  },
  {
    key: "graphite_blue",
    name: "石墨蓝",
    description: "冷静克制，适合作为默认推荐方案",
    swatch: "linear-gradient(135deg, #314965 0%, #7e96b4 100%)",
  },
  {
    key: "sea_mist",
    name: "海雾青",
    description: "偏科技与理工表达，适合冷色封面图",
    swatch: "linear-gradient(135deg, #2d4b56 0%, #7ea7b6 100%)",
  },
  {
    key: "pine_green",
    name: "松烟绿",
    description: "沉静自然，适合知识与研究表达",
    swatch: "linear-gradient(135deg, #31483f 0%, #7f9f8f 100%)",
  },
  {
    key: "amber_brown",
    name: "暖金棕",
    description: "温润成熟，适合人文与通识课程",
    swatch: "linear-gradient(135deg, #8e6b45 0%, #e7d2af 100%)",
  },
  {
    key: "mist_purple",
    name: "雾紫灰",
    description: "理性克制，适合交叉学科与设计表达",
    swatch: "linear-gradient(135deg, #5f5870 0%, #d3cbdd 100%)",
  },
  {
    key: "inkstone_gray",
    name: "砚石灰",
    description: "中性稳重，适合建筑、法学、管理类内容",
    swatch: "linear-gradient(135deg, #474f5d 0%, #c7ced9 100%)",
  },
  {
    key: "celadon_gray",
    name: "瓷青灰",
    description: "清透克制，适合医学、基础学科与浅色封面",
    swatch: "linear-gradient(135deg, #4f6565 0%, #d8e4df 100%)",
  },
];

const presetThemes: Record<PresetColorSchemeKey, DashboardTheme> = {
  graphite_blue: {
    pageOverlayStart: "rgba(14, 22, 35, 0.84)",
    pageOverlayEnd: "rgba(35, 49, 70, 0.7)",
    pageTopFade:
      "linear-gradient(180deg, rgba(8, 13, 23, 0.72) 0%, rgba(8, 13, 23, 0.28) 42%, rgba(8, 13, 23, 0) 100%)",
    headerBg: "rgba(14, 20, 31, 0.82)",
    headerBorder: "rgba(160, 183, 212, 0.18)",
    headerGlow: "rgba(186, 210, 237, 0.14)",
    brandText: "rgba(243, 247, 252, 0.96)",
    heroTitle: "#f7fbff",
    heroSubtitle: "rgba(209, 220, 235, 0.84)",
    metaBg: "rgba(221, 232, 247, 0.1)",
    metaBorder: "rgba(191, 210, 233, 0.2)",
    metaText: "rgba(232, 239, 248, 0.92)",
    cardBg:
      "linear-gradient(180deg, rgba(33, 44, 61, 0.58) 0%, rgba(21, 31, 45, 0.38) 100%)",
    cardBorder: "rgba(197, 214, 234, 0.16)",
    cardText: "rgba(242, 247, 252, 0.95)",
    cardMutedText: "rgba(199, 213, 231, 0.78)",
    surfaceBg: "rgba(225, 234, 245, 0.1)",
    surfaceBorder: "rgba(196, 214, 232, 0.14)",
    ghostButtonBg: "rgba(228, 236, 246, 0.08)",
    ghostButtonBorder: "rgba(194, 210, 229, 0.24)",
    ghostButtonText: "rgba(244, 247, 251, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #edf3fb 0%, #cfddec 100%)",
    solidButtonText: "#203650",
    solidButtonShadow: "0 16px 34px rgba(8, 18, 32, 0.18)",
    iconBg: "linear-gradient(135deg, rgba(239, 245, 252, 0.94) 0%, rgba(207, 222, 240, 0.88) 100%)",
    iconText: "#2b4867",
    systemBlue: "#80a0cb",
    systemViolet: "#998aba",
    systemGreen: "#83a893",
    systemGold: "#c39b69",
    // 系统面板专用 - 深色主题
    systemPanelBlue: "#5b9bd5",
    systemPanelViolet: "#a78bda",
    systemPanelGreen: "#6bb88a",
    systemPanelGold: "#d4a84b",
    systemPanelTitle: "rgba(242, 247, 252, 0.98)",
    logoVariant: "light",
  },
  sea_mist: {
    pageOverlayStart: "rgba(12, 24, 28, 0.82)",
    pageOverlayEnd: "rgba(34, 63, 72, 0.68)",
    pageTopFade:
      "linear-gradient(180deg, rgba(8, 15, 18, 0.68) 0%, rgba(8, 15, 18, 0.24) 46%, rgba(8, 15, 18, 0) 100%)",
    headerBg: "rgba(14, 24, 29, 0.82)",
    headerBorder: "rgba(171, 203, 211, 0.18)",
    headerGlow: "rgba(206, 229, 234, 0.12)",
    brandText: "rgba(242, 249, 250, 0.96)",
    heroTitle: "#f4fbfc",
    heroSubtitle: "rgba(203, 222, 226, 0.84)",
    metaBg: "rgba(224, 237, 239, 0.1)",
    metaBorder: "rgba(188, 212, 216, 0.2)",
    metaText: "rgba(233, 244, 246, 0.92)",
    cardBg:
      "linear-gradient(180deg, rgba(31, 49, 56, 0.58) 0%, rgba(20, 33, 38, 0.38) 100%)",
    cardBorder: "rgba(192, 216, 221, 0.16)",
    cardText: "rgba(243, 248, 249, 0.95)",
    cardMutedText: "rgba(195, 216, 220, 0.78)",
    surfaceBg: "rgba(226, 237, 239, 0.1)",
    surfaceBorder: "rgba(191, 214, 218, 0.14)",
    ghostButtonBg: "rgba(226, 237, 239, 0.08)",
    ghostButtonBorder: "rgba(192, 214, 218, 0.24)",
    ghostButtonText: "rgba(243, 248, 249, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #edf6f7 0%, #cfe0e4 100%)",
    solidButtonText: "#254952",
    solidButtonShadow: "0 16px 34px rgba(9, 20, 24, 0.18)",
    iconBg: "linear-gradient(135deg, rgba(241, 247, 248, 0.94) 0%, rgba(204, 226, 231, 0.88) 100%)",
    iconText: "#2d5762",
    systemBlue: "#7da8bd",
    systemViolet: "#8f8fb4",
    systemGreen: "#7fa99d",
    systemGold: "#bda174",
    // 系统面板专用 - 深色主题
    systemPanelBlue: "#5b9cb5",
    systemPanelViolet: "#a78bb5",
    systemPanelGreen: "#6ab59a",
    systemPanelGold: "#d4a070",
    systemPanelTitle: "rgba(243, 248, 249, 0.98)",
    logoVariant: "light",
  },
  pine_green: {
    pageOverlayStart: "rgba(13, 24, 21, 0.82)",
    pageOverlayEnd: "rgba(34, 55, 48, 0.7)",
    pageTopFade:
      "linear-gradient(180deg, rgba(8, 14, 12, 0.68) 0%, rgba(8, 14, 12, 0.24) 46%, rgba(8, 14, 12, 0) 100%)",
    headerBg: "rgba(15, 24, 21, 0.82)",
    headerBorder: "rgba(171, 199, 188, 0.18)",
    headerGlow: "rgba(209, 228, 219, 0.12)",
    brandText: "rgba(241, 247, 243, 0.96)",
    heroTitle: "#f5fbf7",
    heroSubtitle: "rgba(206, 222, 214, 0.84)",
    metaBg: "rgba(223, 236, 229, 0.1)",
    metaBorder: "rgba(187, 211, 200, 0.22)",
    metaText: "rgba(236, 243, 239, 0.92)",
    cardBg:
      "linear-gradient(180deg, rgba(30, 48, 42, 0.58) 0%, rgba(20, 34, 29, 0.38) 100%)",
    cardBorder: "rgba(196, 218, 208, 0.16)",
    cardText: "rgba(244, 248, 245, 0.95)",
    cardMutedText: "rgba(199, 218, 209, 0.78)",
    surfaceBg: "rgba(226, 238, 231, 0.1)",
    surfaceBorder: "rgba(194, 215, 205, 0.14)",
    ghostButtonBg: "rgba(225, 236, 230, 0.08)",
    ghostButtonBorder: "rgba(191, 212, 201, 0.24)",
    ghostButtonText: "rgba(243, 247, 244, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #edf4f0 0%, #d0dfd6 100%)",
    solidButtonText: "#26463a",
    solidButtonShadow: "0 16px 34px rgba(10, 22, 18, 0.18)",
    iconBg: "linear-gradient(135deg, rgba(239, 246, 241, 0.94) 0%, rgba(206, 225, 214, 0.88) 100%)",
    iconText: "#325445",
    systemBlue: "#779ab3",
    systemViolet: "#8c82a6",
    systemGreen: "#7ea38d",
    systemGold: "#b99a6d",
    // 系统面板专用 - 深色主题
    systemPanelBlue: "#5b9cb5",
    systemPanelViolet: "#a78bb5",
    systemPanelGreen: "#6ab59a",
    systemPanelGold: "#d4a070",
    systemPanelTitle: "rgba(244, 248, 245, 0.98)",
    logoVariant: "light",
  },
  amber_brown: {
    pageOverlayStart: "rgba(244, 236, 223, 0.9)",
    pageOverlayEnd: "rgba(214, 195, 167, 0.78)",
    pageTopFade:
      "linear-gradient(180deg, rgba(238, 230, 215, 0.72) 0%, rgba(238, 230, 215, 0.34) 44%, rgba(238, 230, 215, 0) 100%)",
    headerBg: "rgba(248, 240, 228, 0.84)",
    headerBorder: "rgba(135, 104, 69, 0.16)",
    headerGlow: "rgba(255, 250, 239, 0.32)",
    brandText: "rgba(71, 54, 36, 0.96)",
    heroTitle: "#4f3a26",
    heroSubtitle: "rgba(104, 79, 55, 0.84)",
    metaBg: "rgba(255, 251, 244, 0.54)",
    metaBorder: "rgba(145, 115, 83, 0.16)",
    metaText: "rgba(88, 63, 39, 0.9)",
    cardBg:
      "linear-gradient(180deg, rgba(255, 251, 246, 0.62) 0%, rgba(246, 235, 219, 0.44) 100%)",
    cardBorder: "rgba(158, 124, 88, 0.14)",
    cardText: "rgba(77, 56, 36, 0.95)",
    cardMutedText: "rgba(114, 86, 61, 0.78)",
    surfaceBg: "rgba(255, 252, 247, 0.58)",
    surfaceBorder: "rgba(168, 136, 100, 0.14)",
    ghostButtonBg: "rgba(255, 250, 243, 0.62)",
    ghostButtonBorder: "rgba(149, 118, 86, 0.16)",
    ghostButtonText: "rgba(88, 62, 39, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #705235 0%, #916846 100%)",
    solidButtonText: "#fff8ef",
    solidButtonShadow: "0 16px 34px rgba(76, 48, 24, 0.18)",
    iconBg: "linear-gradient(135deg, rgba(250, 242, 229, 0.96) 0%, rgba(231, 212, 182, 0.92) 100%)",
    iconText: "#6f5435",
    systemBlue: "#8198ac",
    systemViolet: "#9a8aa5",
    systemGreen: "#89a490",
    systemGold: "#b98556",
    // 系统面板专用 - 浅色主题需要更深的颜色
    systemPanelBlue: "#3d6b99",
    systemPanelViolet: "#6b5a9e",
    systemPanelGreen: "#3d8a6b",
    systemPanelGold: "#c47a3d",
    systemPanelTitle: "rgba(77, 56, 36, 0.98)",
    logoVariant: "dark",
  },
  mist_purple: {
    pageOverlayStart: "rgba(238, 236, 243, 0.88)",
    pageOverlayEnd: "rgba(196, 188, 208, 0.74)",
    pageTopFade:
      "linear-gradient(180deg, rgba(232, 229, 238, 0.7) 0%, rgba(232, 229, 238, 0.32) 44%, rgba(232, 229, 238, 0) 100%)",
    headerBg: "rgba(242, 239, 247, 0.84)",
    headerBorder: "rgba(98, 86, 118, 0.16)",
    headerGlow: "rgba(255, 255, 255, 0.34)",
    brandText: "rgba(69, 61, 83, 0.96)",
    heroTitle: "#4b4559",
    heroSubtitle: "rgba(96, 88, 110, 0.84)",
    metaBg: "rgba(255, 255, 255, 0.48)",
    metaBorder: "rgba(119, 107, 140, 0.16)",
    metaText: "rgba(83, 74, 98, 0.9)",
    cardBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.56) 0%, rgba(231, 226, 238, 0.44) 100%)",
    cardBorder: "rgba(123, 112, 143, 0.14)",
    cardText: "rgba(74, 67, 88, 0.95)",
    cardMutedText: "rgba(108, 100, 124, 0.78)",
    surfaceBg: "rgba(255, 255, 255, 0.5)",
    surfaceBorder: "rgba(132, 121, 151, 0.14)",
    ghostButtonBg: "rgba(255, 255, 255, 0.54)",
    ghostButtonBorder: "rgba(123, 112, 143, 0.16)",
    ghostButtonText: "rgba(81, 73, 96, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #666078 0%, #837996 100%)",
    solidButtonText: "#f8f6fc",
    solidButtonShadow: "0 16px 34px rgba(54, 47, 66, 0.16)",
    iconBg: "linear-gradient(135deg, rgba(248, 245, 252, 0.96) 0%, rgba(219, 210, 231, 0.92) 100%)",
    iconText: "#655c78",
    systemBlue: "#869dbf",
    systemViolet: "#9f89c2",
    systemGreen: "#8ea59b",
    systemGold: "#bd9877",
    // 系统面板专用 - 浅色主题需要更深的颜色
    systemPanelBlue: "#4a6d99",
    systemPanelViolet: "#7b5ab5",
    systemPanelGreen: "#4d8a7a",
    systemPanelGold: "#b58555",
    systemPanelTitle: "rgba(74, 67, 88, 0.98)",
    logoVariant: "dark",
  },
  inkstone_gray: {
    pageOverlayStart: "rgba(233, 236, 241, 0.9)",
    pageOverlayEnd: "rgba(184, 193, 206, 0.78)",
    pageTopFade:
      "linear-gradient(180deg, rgba(228, 232, 238, 0.72) 0%, rgba(228, 232, 238, 0.34) 44%, rgba(228, 232, 238, 0) 100%)",
    headerBg: "rgba(241, 244, 248, 0.84)",
    headerBorder: "rgba(87, 97, 115, 0.16)",
    headerGlow: "rgba(255, 255, 255, 0.34)",
    brandText: "rgba(63, 72, 88, 0.96)",
    heroTitle: "#444d5c",
    heroSubtitle: "rgba(92, 102, 119, 0.84)",
    metaBg: "rgba(255, 255, 255, 0.5)",
    metaBorder: "rgba(110, 120, 138, 0.16)",
    metaText: "rgba(76, 85, 100, 0.9)",
    cardBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(227, 232, 239, 0.44) 100%)",
    cardBorder: "rgba(117, 128, 147, 0.14)",
    cardText: "rgba(67, 77, 92, 0.95)",
    cardMutedText: "rgba(101, 111, 128, 0.78)",
    surfaceBg: "rgba(255, 255, 255, 0.52)",
    surfaceBorder: "rgba(126, 137, 156, 0.14)",
    ghostButtonBg: "rgba(255, 255, 255, 0.56)",
    ghostButtonBorder: "rgba(118, 129, 147, 0.16)",
    ghostButtonText: "rgba(73, 82, 97, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #596273 0%, #768093 100%)",
    solidButtonText: "#f7f9fc",
    solidButtonShadow: "0 16px 34px rgba(56, 64, 77, 0.16)",
    iconBg: "linear-gradient(135deg, rgba(247, 249, 252, 0.96) 0%, rgba(214, 221, 230, 0.92) 100%)",
    iconText: "#5b6678",
    systemBlue: "#8799b2",
    systemViolet: "#978aa9",
    systemGreen: "#8ea199",
    systemGold: "#baa07d",
    // 系统面板专用 - 浅色主题需要更深的颜色
    systemPanelBlue: "#4a6d99",
    systemPanelViolet: "#7b5a9e",
    systemPanelGreen: "#4d8a7a",
    systemPanelGold: "#b58555",
    systemPanelTitle: "rgba(67, 77, 92, 0.98)",
    logoVariant: "dark",
  },
  celadon_gray: {
    pageOverlayStart: "rgba(234, 241, 238, 0.9)",
    pageOverlayEnd: "rgba(193, 208, 202, 0.78)",
    pageTopFade:
      "linear-gradient(180deg, rgba(228, 236, 233, 0.72) 0%, rgba(228, 236, 233, 0.34) 44%, rgba(228, 236, 233, 0) 100%)",
    headerBg: "rgba(242, 247, 245, 0.84)",
    headerBorder: "rgba(86, 109, 108, 0.16)",
    headerGlow: "rgba(255, 255, 255, 0.34)",
    brandText: "rgba(63, 83, 81, 0.96)",
    heroTitle: "#44615e",
    heroSubtitle: "rgba(91, 114, 111, 0.84)",
    metaBg: "rgba(255, 255, 255, 0.5)",
    metaBorder: "rgba(104, 128, 125, 0.16)",
    metaText: "rgba(74, 98, 95, 0.9)",
    cardBg:
      "linear-gradient(180deg, rgba(255, 255, 255, 0.58) 0%, rgba(228, 237, 233, 0.44) 100%)",
    cardBorder: "rgba(115, 140, 136, 0.14)",
    cardText: "rgba(66, 94, 91, 0.95)",
    cardMutedText: "rgba(100, 122, 119, 0.78)",
    surfaceBg: "rgba(255, 255, 255, 0.52)",
    surfaceBorder: "rgba(124, 149, 145, 0.14)",
    ghostButtonBg: "rgba(255, 255, 255, 0.56)",
    ghostButtonBorder: "rgba(116, 142, 138, 0.16)",
    ghostButtonText: "rgba(70, 98, 95, 0.94)",
    solidButtonBg: "linear-gradient(135deg, #587473 0%, #779390 100%)",
    solidButtonText: "#f6fbfa",
    solidButtonShadow: "0 16px 34px rgba(51, 72, 70, 0.16)",
    iconBg: "linear-gradient(135deg, rgba(247, 250, 249, 0.96) 0%, rgba(216, 228, 224, 0.92) 100%)",
    iconText: "#5b7674",
    systemBlue: "#87a3b2",
    systemViolet: "#9792ad",
    systemGreen: "#86a59d",
    systemGold: "#bba07b",
    // 系统面板专用 - 浅色主题需要更深的颜色
    systemPanelBlue: "#4a6d99",
    systemPanelViolet: "#7b5a9e",
    systemPanelGreen: "#4d8a7a",
    systemPanelGold: "#b58555",
    systemPanelTitle: "rgba(66, 94, 91, 0.98)",
    logoVariant: "dark",
  },
};

const tealSlateAutoTheme: DashboardTheme = {
  pageOverlayStart: "rgba(17, 29, 33, 0.82)",
  pageOverlayEnd: "rgba(39, 63, 70, 0.68)",
  pageTopFade:
    "linear-gradient(180deg, rgba(10, 17, 20, 0.7) 0%, rgba(10, 17, 20, 0.26) 44%, rgba(10, 17, 20, 0) 100%)",
  headerBg: "rgba(16, 25, 29, 0.82)",
  headerBorder: "rgba(176, 203, 208, 0.18)",
  headerGlow: "rgba(208, 228, 232, 0.12)",
  brandText: "rgba(242, 248, 249, 0.96)",
  heroTitle: "#f4fbfd",
  heroSubtitle: "rgba(205, 220, 224, 0.84)",
  metaBg: "rgba(226, 237, 239, 0.1)",
  metaBorder: "rgba(188, 212, 216, 0.2)",
  metaText: "rgba(234, 243, 245, 0.92)",
  cardBg:
    "linear-gradient(180deg, rgba(32, 48, 54, 0.58) 0%, rgba(20, 31, 36, 0.38) 100%)",
  cardBorder: "rgba(193, 215, 219, 0.16)",
  cardText: "rgba(243, 248, 249, 0.95)",
  cardMutedText: "rgba(197, 216, 219, 0.78)",
  surfaceBg: "rgba(227, 236, 238, 0.1)",
  surfaceBorder: "rgba(191, 213, 217, 0.14)",
  ghostButtonBg: "rgba(227, 236, 238, 0.08)",
  ghostButtonBorder: "rgba(193, 213, 217, 0.24)",
  ghostButtonText: "rgba(243, 248, 249, 0.94)",
  solidButtonBg: "linear-gradient(135deg, #edf5f6 0%, #d0e0e4 100%)",
  solidButtonText: "#2a4a53",
  solidButtonShadow: "0 16px 34px rgba(10, 20, 24, 0.18)",
  iconBg: "linear-gradient(135deg, rgba(240, 247, 248, 0.94) 0%, rgba(207, 225, 228, 0.88) 100%)",
  iconText: "#325661",
  systemBlue: "#7aa5b4",
  systemViolet: "#8f8db6",
  systemGreen: "#81a99f",
  systemGold: "#bf9d72",
  // 系统面板专用 - 深色主题
  systemPanelBlue: "#5b9cb5",
  systemPanelViolet: "#a78bb5",
  systemPanelGreen: "#6ab59a",
  systemPanelGold: "#d4a070",
  systemPanelTitle: "rgba(243, 248, 249, 0.98)",
  logoVariant: "light",
};

function hashString(value: string) {
  return value.split("").reduce((acc, char) => {
    return (acc << 5) - acc + char.charCodeAt(0);
  }, 0);
}

function buildPresetTheme(schemeKey: PresetColorSchemeKey): DashboardTheme {
  return presetThemes[schemeKey];
}

// 纯图主题 - 无颜色叠加
const pureTheme: DashboardTheme = {
  pageOverlayStart: "rgba(255, 255, 255, 0.0)",
  pageOverlayEnd: "rgba(255, 255, 255, 0.0)",
  pageTopFade:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(255, 255, 255, 0) 100%)",
  headerBg: "rgba(255, 255, 255, 0.92)",
  headerBorder: "rgba(0, 0, 0, 0.06)",
  headerGlow: "rgba(255, 255, 255, 0.12)",
  brandText: "rgba(26, 26, 26, 0.96)",
  heroTitle: "#1a1a1a",
  heroSubtitle: "rgba(80, 80, 80, 0.84)",
  metaBg: "rgba(255, 255, 255, 0.6)",
  metaBorder: "rgba(0, 0, 0, 0.06)",
  metaText: "rgba(60, 60, 60, 0.92)",
  cardBg:
    "linear-gradient(180deg, rgba(255, 255, 255, 0.72) 0%, rgba(255, 255, 255, 0.54) 100%)",
  cardBorder: "rgba(0, 0, 0, 0.06)",
  cardText: "rgba(26, 26, 26, 0.95)",
  cardMutedText: "rgba(80, 80, 80, 0.78)",
  surfaceBg: "rgba(255, 255, 255, 0.5)",
  surfaceBorder: "rgba(0, 0, 0, 0.06)",
  ghostButtonBg: "rgba(255, 255, 255, 0.64)",
  ghostButtonBorder: "rgba(0, 0, 0, 0.08)",
  ghostButtonText: "rgba(26, 26, 26, 0.94)",
  solidButtonBg: "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%)",
  solidButtonText: "#1a1a1a",
  solidButtonShadow: "0 12px 28px rgba(0, 0, 0, 0.08)",
  iconBg: "linear-gradient(135deg, rgba(255, 255, 255, 0.96) 0%, rgba(248, 248, 248, 0.92) 100%)",
  iconText: "#3d3d3d",
  systemBlue: "#4a6d99",
  systemViolet: "#7b5a9e",
  systemGreen: "#4d8a7a",
  systemGold: "#b58555",
  systemPanelBlue: "#4a6d99",
  systemPanelViolet: "#7b5a9e",
  systemPanelGreen: "#4d8a7a",
  systemPanelGold: "#b58555",
  systemPanelTitle: "rgba(26, 26, 26, 0.98)",
  logoVariant: "dark",
};

function buildPureTheme(): DashboardTheme {
  return pureTheme;
}

function buildAutoTheme(imageUrl?: string | null): DashboardTheme {
  if (!imageUrl) {
    return buildPresetTheme("graphite_blue");
  }

  const hash = Math.abs(hashString(imageUrl));
  const hue = hash % 360;
  const variant = Math.floor(hash / 360) % 2;

  if (hue < 38) {
    return buildPresetTheme("amber_brown");
  }
  if (hue < 82) {
    return buildPresetTheme(variant === 0 ? "amber_brown" : "inkstone_gray");
  }
  if (hue < 122) {
    return buildPresetTheme("celadon_gray");
  }
  if (hue < 164) {
    return buildPresetTheme("pine_green");
  }
  if (hue < 206) {
    return buildPresetTheme("sea_mist");
  }
  if (hue < 248) {
    return buildPresetTheme(variant === 0 ? "graphite_blue" : "sea_mist");
  }
  if (hue < 292) {
    return buildPresetTheme("mist_purple");
  }
  if (hue < 332) {
    return buildPresetTheme(variant === 0 ? "inkstone_gray" : "mist_purple");
  }
  if (variant === 0) {
    return tealSlateAutoTheme;
  }
  return buildPresetTheme("graphite_blue");
}

function buildPageThemeStyle(
  theme: DashboardTheme,
  imageUrl?: string | null,
): ThemeStyle {
  return {
    "--front-page-overlay-start": theme.pageOverlayStart,
    "--front-page-overlay-end": theme.pageOverlayEnd,
    "--front-page-top-fade": theme.pageTopFade,
    "--front-header-bg": theme.headerBg,
    "--front-header-border": theme.headerBorder,
    "--front-header-glow": theme.headerGlow,
    "--front-brand-text": theme.brandText,
    "--front-hero-title": theme.heroTitle,
    "--front-hero-subtitle": theme.heroSubtitle,
    "--front-meta-bg": theme.metaBg,
    "--front-meta-border": theme.metaBorder,
    "--front-meta-text": theme.metaText,
    "--front-card-bg": theme.cardBg,
    "--front-card-border": theme.cardBorder,
    "--front-card-text": theme.cardText,
    "--front-card-muted-text": theme.cardMutedText,
    "--front-surface-bg": theme.surfaceBg,
    "--front-surface-border": theme.surfaceBorder,
    "--front-ghost-button-bg": theme.ghostButtonBg,
    "--front-ghost-button-border": theme.ghostButtonBorder,
    "--front-ghost-button-text": theme.ghostButtonText,
    "--front-solid-button-bg": theme.solidButtonBg,
    "--front-solid-button-text": theme.solidButtonText,
    "--front-solid-button-shadow": theme.solidButtonShadow,
    "--front-icon-bg": theme.iconBg,
    "--front-icon-text": theme.iconText,
    "--front-system-blue": theme.systemBlue,
    "--front-system-violet": theme.systemViolet,
    "--front-system-green": theme.systemGreen,
    "--front-system-gold": theme.systemGold,
    // 系统面板专用颜色
    "--front-system-panel-blue": theme.systemPanelBlue,
    "--front-system-panel-violet": theme.systemPanelViolet,
    "--front-system-panel-green": theme.systemPanelGreen,
    "--front-system-panel-gold": theme.systemPanelGold,
    "--front-system-panel-title": theme.systemPanelTitle,
    backgroundImage: imageUrl
      ? `linear-gradient(180deg, ${theme.pageOverlayStart} 0%, ${theme.pageOverlayEnd} 100%), url(${imageUrl})`
      : `linear-gradient(180deg, ${theme.pageOverlayStart} 0%, ${theme.pageOverlayEnd} 100%)`,
    backgroundSize: imageUrl ? "cover, cover" : "cover",
    backgroundPosition: imageUrl ? "center top, center center" : "center center",
  };
}

function normalizeText(value?: string | null) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

function summarizeText(
  value: string | null | undefined,
  fallback: string,
  maxLength = 84,
) {
  const content = normalizeText(value);
  if (!content) return fallback;
  if (content.length <= maxLength) return content;
  return `${content.slice(0, maxLength).trim()}...`;
}

function extractHighlights(
  value: string | null | undefined,
  fallback: string[],
  limit = 3,
) {
  const content = normalizeText(value);
  if (!content) return fallback.slice(0, limit);

  const tokens = content
    .split(/[\n。；;，,、|!?！？]/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

  const uniqueTokens = Array.from(new Set(tokens));
  return (uniqueTokens.length > 0 ? uniqueTokens : fallback).slice(0, limit);
}

function formatAlbumMetric(
  value: number | string | null | undefined,
  fallback: string,
) {
  if (typeof value === "number") {
    return value > 0 ? String(value) : fallback;
  }
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

export default function StudentFront() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const branding = useBranding();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  usePageTitle();
  const currentTenant = getCurrentTenant();

  const rawCourseId = searchParams.get("courseId");
  const urlCourseId = rawCourseId || localStorage.getItem("selectedCourse") || "";
  const urlTenant = searchParams.get("tenant");

  const [introExpanded, setIntroExpanded] = useState(false);
  const [activeAlbumIndex, setActiveAlbumIndex] = useState(0);
  const [albumHovered, setAlbumHovered] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 课程相册 → 课程全景窗口：route 供「进入详情页」跳转
  const [albumPanorama, setAlbumPanorama] = useState<{ route: string } | null>(null);

  const tenantToUse = urlTenant || currentTenant?.schemaName || "default";

  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ["course", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await getCourseByGuest({
        tenant: tenantToUse,
        fields: [
          "id",
          "title",
          "description",
          "imageUrl",
          "major",
          "semester",
          "semesterHours",
          "credits",
          "publishStatus",
          "colorScheme",
          "teacherId",
        ],
        input: { courseId: urlCourseId! },
      });
      return result.success ? result.data : null;
    },
    enabled: !!urlCourseId,
  });

  const { data: courseInfoData } = useQuery({
    queryKey: ["course-info", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await getCourseInfo({
        tenant: tenantToUse,
        fields: [
          "id",
          "courseId",
          "background",
          "objectives",
          "target",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
        ],
        filter: { courseId: { eq: urlCourseId! } },
        headers: user ? getHeaders(user) : undefined,
      });
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          return result.data[0] ?? null;
        }
        return result.data;
      }
      return null;
    },
    enabled: !!urlCourseId,
  });

  const { data: assignmentsData } = useQuery({
    queryKey: ["course-assignments", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await listCourseAssignments({
        tenant: tenantToUse,
        fields: [
          "id",
          "role",
          { teacher: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge"] },
        ],
        filter: { courseId: { eq: urlCourseId! } },
        page: { limit: 100, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId,
  });

  // 获取主教师信息（通过 course.teacherId）
  const { data: primaryTeacherData } = useQuery({
    queryKey: ["primary-teacher", courseData?.teacherId, tenantToUse],
    queryFn: async () => {
      if (!courseData?.teacherId) return null;
      const result = await getUser({
        tenant: tenantToUse,
        input: { id: courseData.teacherId },
        fields: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge"],
      });
      return result.success ? result.data : null;
    },
    enabled: !!courseData?.teacherId && !!tenantToUse,
  });

  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await listOrganizations({
        fields: ["id", "name", "schemaName"],
        sort: "+name",
      });
      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          return result.data;
        }
        const pagedData = result.data as { results?: OrganizationItem[] };
        if (Array.isArray(pagedData.results)) {
          return pagedData.results;
        }
      }
      return [];
    },
  });

  const { data: courseMediaData } = useQuery({
    queryKey: ["course-media", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await listCourseVideos({
        tenant: tenantToUse,
        fields: ["id", "name", "mediaType", "videoUrl", "imageUrl", "courseId"],
        filter: { courseId: { eq: urlCourseId! } },
        page: { limit: 24, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId,
  });

  const { data: courseOverviewData } = useQuery({
    queryKey: ["course-overview", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await courseOverview({
        tenant: tenantToUse,
        input: { courseId: urlCourseId! },
      });
      return result.success ? result.data : null;
    },
    enabled: !!urlCourseId,
  });

  // 能力数量：统计课程图谱中能力图谱的所有能力（主能力 + 子能力），与 /dashboard/graph 的能力图谱 tab 一致
  const { data: mainAbilitiesByCourseData } = useQuery({
    queryKey: ["main-abilities-by-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await getMainAbilitiesByCourse({
        tenant: tenantToUse,
        input: { courseId: urlCourseId },
        fields: ["id", "subAbilitiesCount"],
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const abilityCount = useMemo(() => {
    const mains = (mainAbilitiesByCourseData as any[]) || [];
    const mainCount = mains.length;
    const subCount = mains.reduce((sum: number, m: any) => sum + (m.subAbilitiesCount || 0), 0);
    return mainCount + subCount;
  }, [mainAbilitiesByCourseData]);

  // 问题数量：问题图谱的问题总数，对应问题体系统计
  const { data: questionsByCourseData } = useQuery({
    queryKey: ["questions-by-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listQuestions({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const questionCount = useMemo(() => {
    return (questionsByCourseData as any[])?.length || 0;
  }, [questionsByCourseData]);

  // 教学资源数量：与 /dashboard/resource 的 allResources 保持一致（文件+视频去重+练习+作业）
  const { data: filesForCourseData } = useQuery({
    queryKey: ["files-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listFiles({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: chaptersForCourseData } = useQuery({
    queryKey: ["chapters-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listChapters({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 200, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: knowledgesForCourseData } = useQuery({
    queryKey: ["knowledges-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listKnowledges({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: videosForCourseData } = useQuery({
    queryKey: ["videos-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listVideos({
        tenant: tenantToUse,
        fields: ["id", "chapterId", "knowledgeResourceId"],
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: exercisesForCourseData } = useQuery({
    queryKey: ["exercises-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listExercises({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: homeworksForCourseData } = useQuery({
    queryKey: ["homeworks-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listHomeworks({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const { data: linksForCourseData } = useQuery({
    queryKey: ["links-for-course", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listLinks({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const teachingResourceCount = useMemo(() => {
    const files = (filesForCourseData as any[])?.length || 0;
    const exercises = (exercisesForCourseData as any[])?.length || 0;
    const homeworks = (homeworksForCourseData as any[])?.length || 0;
    const links = (linksForCourseData as any[])?.length || 0;
    const chapterIds = new Set((chaptersForCourseData as any[])?.map((c: any) => c.id) || []);
    const knowledgeIds = new Set((knowledgesForCourseData as any[])?.map((k: any) => k.id) || []);
    const videos = (videosForCourseData as any[]) || [];
    // 去重：同一视频可能同时关联章节与知识点，仅计一次
    const videoIds = new Set<string>();
    videos.forEach((v: any) => {
      const inChapter = v.chapterId && chapterIds.has(v.chapterId);
      const inKnowledge = v.knowledgeResourceId && knowledgeIds.has(v.knowledgeResourceId);
      if (inChapter || inKnowledge) videoIds.add(v.id);
    });
    const videosDistinct = videoIds.size;
    // 回退：若无章节/知识点（如新课），按课程维度兜底
    const videoCount = videosDistinct > 0 ? videosDistinct : (videos as any[]).filter((v: any) => v.courseId === urlCourseId).length || 0;
    // 与 /dashboard/resource 的 allResources（文件+视频+练习+作业+链接）保持一致
    const total = files + videoCount + exercises + homeworks + links;
    if (total === 0) return (courseOverviewData as any)?.totalResources?.total || 0;
    return total;
  }, [filesForCourseData, videosForCourseData, chaptersForCourseData, knowledgesForCourseData, exercisesForCourseData, homeworksForCourseData, linksForCourseData, courseOverviewData]);

  // 知识点数量：与 /dashboard/knowledge-cognitive-goals 保持一致（基于同一层级接口统计）
  const { data: knowledgeHierarchyData } = useQuery({
    queryKey: ["knowledge-hierarchy-count", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId || !tenantToUse || !user) return [];
      const response = await fetch(
        `/api/knowledge/hierarchy/nested?course_id=${urlCourseId}&tenant=${tenantToUse}`,
        { headers: { ...buildCSRFHeaders(), ...getHeaders(user) } },
      );
      if (!response.ok) return [];
      const result = await response.json();
      if (result && typeof result === "object" && Array.isArray(result.data)) return result.data;
      if (Array.isArray(result)) return result;
      return [];
    },
    enabled: !!urlCourseId && !!tenantToUse && !!user,
  });
  const knowledgeCount = useMemo(() => {
    const data = knowledgeHierarchyData as any[];
    if (!Array.isArray(data) || data.length === 0) {
      // 回退到 courseOverview 的 total，避免闪 0
      return (courseOverviewData as any)?.knowledgeResources?.total || (courseOverviewData as any)?.knowledgeResources?.total_knowledge_resources || 0;
    }
    const seen = new Set<string>();
    let count = 0;
    const flatten = (items: any[]) => {
      items.forEach((item: any) => {
        if (!item?.id || seen.has(item.id)) return;
        seen.add(item.id);
        count += 1;
        const childArrays = [item.childUnits, item.directCells, item.subjectCells, item.childCells, item.nestedChildCells];
        childArrays.forEach((children: any[]) => {
          if (Array.isArray(children)) flatten(children);
        });
      });
    };
    flatten(data);
    return count;
  }, [knowledgeHierarchyData, courseOverviewData]);

  // 累计互动：与 /dashboard/interaction 的讨论数一致（仅计讨论会话数）
  const { data: discussionSessionsData } = useQuery({
    queryKey: ["discussion-sessions-count", urlCourseId, tenantToUse],
    queryFn: async () => {
      if (!urlCourseId) return [];
      const result = await listDiscussionSessions({
        tenant: tenantToUse,
        fields: ["id"],
        filter: { courseId: { eq: urlCourseId } },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });
  const discussionCount = (discussionSessionsData as any[])?.length || 0;

  const assignments = extractArrayData(assignmentsData) as CourseAssignmentItem[];
  const organizations = extractArrayData(organizationsData) as OrganizationItem[];
  const courseMediaItems = extractArrayData(courseMediaData) as CourseMediaItem[];
  const albumAssets = courseMediaItems.filter(
    (item) => item.name !== "课程视频",
  );

  // 主教师信息
  const primaryTeacherInfo = primaryTeacherData ? {
    id: primaryTeacherData.id,
    role: "primary_teacher" as const,
    teacher: primaryTeacherData,
  } : null;

  // 合并主教师和分配教师列表（主教师优先，不重复）
  const sortedAssignments = useMemo(() => {
    const teacherIds = new Set<string>();
    const result: typeof assignments = [];

    // 先添加主教师
    if (primaryTeacherInfo) {
      teacherIds.add(primaryTeacherInfo.teacher.id);
      result.push(primaryTeacherInfo);
    }

    // 再添加其他分配教师（排除主教师）
    for (const a of assignments) {
      if (a.teacher?.id && !teacherIds.has(a.teacher.id)) {
        teacherIds.add(a.teacher.id);
        result.push(a);
      }
    }

    return result;
  }, [primaryTeacherInfo, assignments]);

  const visibleTeacherAssignments = sortedAssignments.slice(0, 4);
  const remainingTeacherCount = Math.max(sortedAssignments.length - visibleTeacherAssignments.length, 0);

  // 从课程数据中获取 colorScheme，如果没有则默认 auto
  const colorScheme = (courseData?.colorScheme as ColorSchemeKey) || "auto";

  const colorTheme = useMemo<DashboardTheme>(() => {
    if (colorScheme === "auto") {
      return buildAutoTheme(courseData?.imageUrl);
    }
    if (colorScheme === "pure") {
      return buildPureTheme();
    }
    return buildPresetTheme(colorScheme as PresetColorSchemeKey);
  }, [courseData?.imageUrl, colorScheme]);

  const pageThemeStyle = useMemo(
    () => buildPageThemeStyle(colorTheme, courseData?.imageUrl),
    [colorTheme, courseData?.imageUrl],
  );

  const logoSrc =
    colorTheme.logoVariant === "light"
      ? branding.logo_light
      : branding.logo_dark;

  const courseIntro =
    courseInfoData?.courseIntroduction ||
    courseData?.description ||
    "暂无课程简介";
  const courseTitle = courseData?.title || "课程详情";
  const courseMajor = courseData?.major || "";
  const matchedTenant = organizations.find((org) => org.schemaName === tenantToUse);
  const schoolName =
    matchedTenant?.name ||
    (currentTenant?.schemaName === tenantToUse ? currentTenant.name : "") ||
    "院校信息";

  const courseMetaTags = [
    courseData?.major
      ? {
          text: courseData.major,
          icon: <BookOutlined style={{ fontSize: 11 }} />,
        }
      : null,
    courseData?.semester
      ? {
          text: courseData.semester,
          icon: <ClockCircleOutlined style={{ fontSize: 11 }} />,
        }
      : null,
    courseData?.semesterHours
      ? {
          text: `${courseData.semesterHours} 学时`,
          icon: <ClockCircleOutlined style={{ fontSize: 11 }} />,
        }
      : null,
    courseData?.credits
      ? {
          text: `${courseData.credits} 学分`,
          icon: <VideoCameraOutlined style={{ fontSize: 11 }} />,
        }
      : null,
  ].filter(Boolean) as Array<{ text: string; icon: React.ReactNode }>;

  const systemLayers = [
    {
      type: "is-blue",
      title: "能力体系",
      nodes: ["通用能力", "专业能力", "岗位能力"],
      value: abilityCount,
      unit: "能力",
      // 能力图谱已整合到课程图谱左侧导航
      route: "/dashboard/graph",
    },
    {
      type: "is-violet",
      title: "问题体系",
      nodes: ["全局问题", "概念问题", "方法问题"],
      value: questionCount,
      unit: "问题",
      // 对应课程图谱里的问题图谱
      route: "/dashboard/graph",
    },
    {
      type: "is-green",
      title: "知识体系",
      nodes: ["知识点", "技能点", "教案"],
      value: knowledgeCount,
      unit: "知识点",
      // 对应课程图谱里的树状图
      route: "/dashboard/graph",
    },
    {
      type: "is-gold",
      title: "教学资源",
      nodes: ["文档", "习题", "视频"],
      value: teachingResourceCount,
      unit: "教学资源",
      route: "/dashboard/resource",
    },
  ];

  React.useEffect(() => {
    if (urlCourseId) {
      trackCourseView(urlCourseId);
      localStorage.setItem("selectedCourse", urlCourseId);
    }
  }, [urlCourseId]);

  // 同步 URL 中的 courseId 到 localStorage，确保从 StudentLayout 返回时仍能通过 fallback 恢复
  React.useEffect(() => {
    if (rawCourseId) {
      localStorage.setItem("selectedCourse", rawCourseId);
    }
  }, [rawCourseId]);

  const viewStats = getCourseViewStats(urlCourseId || "");

  const cumulativeStats = [
    {
      label: "累计人数",
      value: courseOverviewData?.users?.total || viewStats.uniqueViews || 0,
      note: "课程参与人数",
    },
    {
      label: "累计学校",
      value: courseOverviewData?.users?.schools || 1,
      note: schoolName,
    },
    {
      label: "累计互动",
      value: discussionCount,
      note: "讨论会话数",
    },
    {
      label: "累计访问",
      value: viewStats.totalViews || 0,
      note: viewStats.lastViewed
        ? `最近访问 ${new Date(viewStats.lastViewed).toLocaleDateString("zh-CN")}`
        : "暂无访问记录",
    },
  ];

  const linkedCourseQuery = new URLSearchParams({
    courseId: urlCourseId || "",
    tenant: tenantToUse,
  }).toString();

  const linkedDashboardRoute = (path: string) =>
    `${path}?${linkedCourseQuery}`;

  // 未登录点击需要登录的入口时，跳转登录页（带 redirect 参数，登录成功后回到当前页）
  const requireAuth = (action: () => void) => () => {
    if (!user) {
      const currentPath = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    action();
  };

  const frontMenuActions = [
    {
      key: "overview",
      label: "课程概述",
      description: "进入课程学习主页",
      icon: <BookOutlined />,
      route: linkedDashboardRoute("/dashboard/overview"),
    },
    {
      key: "graph",
      label: "知识图谱",
      description: "查看知识、问题与能力结构",
      icon: <ApartmentOutlined />,
      route: linkedDashboardRoute("/dashboard/graph"),
    },
    {
      key: "teachers",
      label: "教师团队",
      description: "查看授课教师与组织信息",
      icon: <TeamOutlined />,
      route: linkedDashboardRoute("/dashboard/teacher"),
    },
    {
      key: "video",
      label: "课程视频",
      description: "浏览课程视频与学习材料",
      icon: <VideoCameraOutlined />,
      route: linkedDashboardRoute("/dashboard/course-video"),
    },
    {
      key: "discussions",
      label: "课堂讨论",
      description: "查看教师开启的实时讨论会话",
      icon: <CommentOutlined />,
      route: linkedDashboardRoute("/dashboard/discussions"),
    },
    {
      key: "group-tasks",
      label: "小组任务",
      description: "进入当前课程已发布的分组任务",
      icon: <DeploymentUnitOutlined />,
      route: linkedDashboardRoute("/dashboard/group-tasks"),
    },
  ];

  const albumCards = useMemo<AlbumCard[]>(() => {
    const defaultCards: AlbumCard[] = [
      {
        id: "system",
        badge: "课程体系",
        title: "课程体系",
        subtitle: "以模块递进的方式组织知识、任务与能力目标。",
        description: summarizeText(
          courseInfoData?.background ||
            courseInfoData?.courseIntroduction ||
            courseData?.description,
          "从整体课程框架切入，先建立结构感，再进入章节与图谱学习。",
        ),
        route: `/dashboard/overview?${linkedCourseQuery}`,
        actionLabel: "查看课程概述",
        highlights: extractHighlights(
          courseInfoData?.background || courseInfoData?.courseHighlights,
          ["核心模块", "能力递进", "学习路径"],
        ),
        metricLabel: "知识单元",
        metricValue: formatAlbumMetric(
          courseOverviewData?.knowledgeResources?.knowledgeUnits,
          "体系化",
        ),
        imageUrl:
          albumAssets.find((item) => item.name === "课程体系" && item.imageUrl)?.imageUrl ||
          courseSystemImage,
        palette: "blue",
      },
      {
        id: "structure",
        badge: "课程结构",
        title: "课程结构",
        subtitle: "把重点章节、核心单元与学习顺序用卡片方式展开。",
        description: summarizeText(
          courseInfoData?.courseStructure,
          "围绕章节层次、单元分工与资源组织，快速看清课程的展开方式。",
        ),
        route: `/dashboard/overview?${linkedCourseQuery}&section=structure`,
        actionLabel: "查看课程结构",
        highlights: extractHighlights(
          courseInfoData?.courseStructure,
          ["章节层级", "重点单元", "学习节奏"],
        ),
        metricLabel: "教学资源",
        metricValue: formatAlbumMetric(
          courseOverviewData?.totalResources?.total,
          "结构化",
        ),
        imageUrl:
          albumAssets.find((item) => item.name === "课程结构" && item.imageUrl)?.imageUrl ||
          courseStructureImage,
        palette: "violet",
      },
      {
        id: "map",
        badge: "课程图谱",
        title: "课程图谱",
        subtitle: "把知识点、问题链与能力项串成可浏览的课程地图。",
        description: summarizeText(
          courseInfoData?.courseHighlights || courseInfoData?.courseIntroduction,
          "从图谱视角理解课程的关系网络，适合用于定位重点与回看关联内容。",
        ),
        route: `/dashboard/graph?${linkedCourseQuery}`,
        actionLabel: "进入知识图谱",
        highlights: extractHighlights(
          courseInfoData?.courseHighlights,
          ["知识关联", "问题链", "能力映射"],
        ),
        metricLabel: "知识节点",
        metricValue: formatAlbumMetric(
          courseOverviewData?.knowledgeResources?.knowledgeCells,
          "图谱化",
        ),
        imageUrl:
          albumAssets.find((item) => item.name === "课程地图" && item.imageUrl)?.imageUrl ||
          courseGraphImage,
        palette: "green",
      },
    ];

    return defaultCards;
  }, [
    albumAssets,
    courseData?.description,
    courseInfoData?.background,
    courseInfoData?.courseHighlights,
    courseInfoData?.courseIntroduction,
    courseInfoData?.courseStructure,
    courseInfoData?.objectives,
    courseInfoData?.target,
    courseOverviewData?.activities?.total,
    courseOverviewData?.knowledgeResources?.knowledgeCells,
    courseOverviewData?.knowledgeResources?.knowledgeUnits,
    courseOverviewData?.totalResources?.total,
    linkedCourseQuery,
  ]);

  const activeAlbumCard = albumCards[activeAlbumIndex] || albumCards[0];

  React.useEffect(() => {
    if (activeAlbumIndex >= albumCards.length) {
      setActiveAlbumIndex(0);
    }
  }, [activeAlbumIndex, albumCards.length]);

  React.useEffect(() => {
    if (albumCards.length <= 1 || albumHovered) return undefined;

    const timer = window.setInterval(() => {
      setActiveAlbumIndex((prev) => (prev + 1) % albumCards.length);
    }, 4600);

    return () => window.clearInterval(timer);
  }, [albumCards.length, albumHovered]);

  if (!urlCourseId) {
    return (
      <Layout className="front-dashboard-page" style={pageThemeStyle}>
        <Header className="front-dashboard-header">
          <div className="front-dashboard-header__inner">
            <div className="front-dashboard-header__start">
              <div className="front-dashboard-brand" onClick={() => navigate("/")}>
                <img
                  src={logoSrc}
                  alt={branding.app_name}
                  className="front-dashboard-brand__logo"
                />
                <div className="front-dashboard-brand__title">{branding.app_title}</div>
              </div>
              {user && isMobile && (
              <div className="front-dashboard-header__user-menu-wrapper">
                <UserMenu role="student" variant="header" />
              </div>
            )}
            </div>
            <div className="front-dashboard-header__actions">
              {user ? (
                <>
                  {!isMobile && (
                    <Button
                      type="text"
                      icon={<MenuOutlined />}
                      className="front-dashboard-header__menu-trigger"
                      onClick={() => setMobileMenuOpen(true)}
                    />
                  )}
                  {!isMobile && (
              <div className="front-dashboard-header__user-menu-wrapper">
                <UserMenu role="student" variant="header" />
              </div>
            )}
                </>
              ) : (
                <>
                  <Button
                    onClick={() => {
                      const currentPath = `${window.location.pathname}${window.location.search}`;
                      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
                    }}
                    className="front-dashboard-header__ghost"
                  >
                    登录
                  </Button>
                </>
              )}
            </div>
          </div>
        </Header>
        <main className="front-dashboard-shell">
          <section className="front-dashboard-hero">
            <div className="front-dashboard-hero__content">
              <div className="front-dashboard-hero__headline">
                <h1>课程详情</h1>
              </div>
            </div>
          </section>
        </main>
        <GlobalFooter />
      </Layout>
    );
  }

  if (courseLoading) {
    return (
      <Layout className="front-dashboard-page" style={pageThemeStyle}>
        <Header className="front-dashboard-header">
          <div className="front-dashboard-header__inner">
            <div className="front-dashboard-brand" onClick={() => navigate("/")}>
              <img
                src={logoSrc}
                alt={branding.app_name}
                className="front-dashboard-brand__logo"
              />
              <div className="front-dashboard-brand__title">{branding.app_title}</div>
            </div>
          </div>
        </Header>
        <main
          className="front-dashboard-shell"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "60vh",
          }}
        >
          <Spin size="large" />
        </main>
        <GlobalFooter />
      </Layout>
    );
  }

  if (!courseData) {
    return (
      <Layout className="front-dashboard-page" style={pageThemeStyle}>
        <Header className="front-dashboard-header">
          <div className="front-dashboard-header__inner">
            <div className="front-dashboard-brand" onClick={() => navigate("/")}>
              <img
                src={logoSrc}
                alt={branding.app_name}
                className="front-dashboard-brand__logo"
              />
              <div className="front-dashboard-brand__title">{branding.app_title}</div>
            </div>
          </div>
        </Header>
        <main className="front-dashboard-shell">
          <section className="front-dashboard-hero">
            <div className="front-dashboard-hero__content">
              <div className="front-dashboard-hero__headline">
                <h1>未找到课程</h1>
              </div>
            </div>
          </section>
        </main>
        <GlobalFooter />
      </Layout>
    );
  }

  return (
    <Layout className="front-dashboard-page" style={pageThemeStyle}>
      <Header className="front-dashboard-header">
        <div className="front-dashboard-header__inner">
          <div className="front-dashboard-header__start">
            <div className="front-dashboard-brand" onClick={() => navigate("/")}>
              <img src={logoSrc} alt={branding.app_name} className="front-dashboard-brand__logo" />
              <div className="front-dashboard-brand__title">{branding.app_title}</div>
            </div>
            {user && isMobile && (
              <div className="front-dashboard-header__user-menu-wrapper">
                <UserMenu role="student" variant="header" />
              </div>
            )}
          </div>
          <div className="front-dashboard-header__actions">
            {user ? (
              <>
                {!isMobile && (
                  <Button
                    type="text"
                    icon={<MenuOutlined />}
                    className="front-dashboard-header__menu-trigger"
                    onClick={() => setMobileMenuOpen(true)}
                  />
                )}
                {!isMobile && (
              <div className="front-dashboard-header__user-menu-wrapper">
                <UserMenu role="student" variant="header" />
              </div>
            )}
              </>
            ) : (
              <>
                <Button
                  onClick={() => {
                    const currentPath = `${window.location.pathname}${window.location.search}`;
                    navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
                  }}
                  className="front-dashboard-header__ghost"
                >
                  登录
                </Button>
              </>
            )}
          </div>
        </div>
      </Header>

      <main className="front-dashboard-shell">
        <section className="front-dashboard-hero">
          <div className="front-dashboard-hero__content">
            <div className="front-dashboard-hero__headline">
              <h1>{courseTitle}</h1>
              <p>{courseMajor}</p>
              <div className="front-dashboard-hero__meta">
                {courseMetaTags.map((tag, index) => (
                  <span key={`${tag.text}-${index}`} className="front-dashboard-meta-pill">
                    {tag.icon}
                    {tag.text}
                  </span>
                ))}
              </div>
            </div>

            <div className="front-dashboard-overview-grid">
              <div className="front-dashboard-overview-grid__main">
                <div className="front-dashboard-glass-card front-dashboard-intro-card">
                  <div className="front-dashboard-section-title">
                    <span className="front-dashboard-section-title__icon">
                      <BookOutlined />
                    </span>
                    <span>课程简介</span>
                  </div>
                  <Paragraph
                    className="front-dashboard-intro-card__text"
                    ellipsis={
                      introExpanded
                        ? false
                        : { rows: 4, expandable: false, symbol: "" }
                    }
                  >
                    {courseIntro}
                  </Paragraph>
                  {courseIntro?.length > 120 && (
                    <Button
                      type="link"
                      className="front-dashboard-intro-card__toggle"
                      onClick={() => setIntroExpanded(!introExpanded)}
                      icon={introExpanded ? <UpOutlined /> : <DownOutlined />}
                    >
                      {introExpanded ? "收起" : "展开全部"}
                    </Button>
                  )}
                  <div className="front-dashboard-intro-card__actions">
                    <Button
                      type={user ? "primary" : "default"}
                      icon={<RightOutlined />}
                      onClick={requireAuth(() => navigate(linkedDashboardRoute("/dashboard/overview")))}
                      className="front-dashboard-primary-button"
                    >
                      {user ? "学习课程" : "登录后选课"}
                    </Button>
                    <Button
                      icon={<ApartmentOutlined />}
                      onClick={requireAuth(() => navigate(linkedDashboardRoute("/dashboard/graph")))}
                      className="front-dashboard-secondary-button"
                    >
                      查看知识图谱
                    </Button>
                  </div>
                </div>

                <div className="front-dashboard-blocks-grid">
                  <div
                    className="front-dashboard-glass-card front-dashboard-feature-card front-dashboard-feature-card--album"
                    style={isMobile ? { width: "100%", marginBottom: 16 } : undefined}
                    role="button"
                    tabIndex={0}
                    onClick={() => setAlbumPanorama({ route: activeAlbumCard.route })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setAlbumPanorama({ route: activeAlbumCard.route });
                      }
                    }}
                    aria-label="打开课程全景"
                  >
                    <div
                      className="front-dashboard-feature-card__header"
                      onClick={(event) => {
                        event.stopPropagation();
                        setAlbumPanorama({ route: activeAlbumCard.route });
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setAlbumPanorama({ route: activeAlbumCard.route });
                        }
                      }}
                    >
                      <div className="front-dashboard-section-title">
                        <span className="front-dashboard-section-title__icon">
                          <PictureOutlined />
                        </span>
                        <span>课程相册</span>
                      </div>
                      <RightOutlined className="front-dashboard-feature-card__arrow" />
                    </div>

                    <div
                      className="front-dashboard-album-strip"
                      onMouseEnter={() => setAlbumHovered(true)}
                      onMouseLeave={() => setAlbumHovered(false)}
                    >
                      <div
                        className="front-dashboard-album-stage"
                        role="presentation"
                      >
                        {albumCards.map((card, index) => {
                          const distance =
                            (index - activeAlbumIndex + albumCards.length) % albumCards.length;

                          let positionClass = "is-hidden";
                          if (distance === 0) positionClass = "is-active";
                          if (distance === 1) positionClass = "is-next";
                          if (distance === albumCards.length - 1) positionClass = "is-prev";
                          if (distance > 1 && distance < albumCards.length - 1) {
                            positionClass = "is-hidden";
                          }

                          return (
                            <div
                              key={card.id}
                              role="button"
                              tabIndex={0}
                              className={`front-dashboard-album-card ${positionClass} is-${card.palette} ${colorTheme.logoVariant === "dark" ? "is-page-light" : "is-page-dark"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                // 未登录也允许弹出全景图谱（详情页入口在全景内再鉴权）
                                if (index === activeAlbumIndex) {
                                  setAlbumPanorama({ route: card.route });
                                  return;
                                }
                                setActiveAlbumIndex(index);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  if (index === activeAlbumIndex) {
                                    setAlbumPanorama({ route: card.route });
                                  } else {
                                    setActiveAlbumIndex(index);
                                  }
                                }
                              }}
                              aria-label={card.title}
                            >
                                <div className="front-dashboard-album-card__media">
                                  <TreeDiagramSVG palette={card.palette} title={card.title} />
                                  <div
                                    className="front-dashboard-album-card__title"
                                    role="button"
                                    tabIndex={0}
                                    onClick={(event) => {
                                      // 标题与卡片整体一致：均可弹出全景图谱，未登录也允许
                                      event.stopPropagation();
                                      if (index === activeAlbumIndex) {
                                        setAlbumPanorama({ route: card.route });
                                      } else {
                                        setActiveAlbumIndex(index);
                                      }
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        if (index === activeAlbumIndex) {
                                          setAlbumPanorama({ route: card.route });
                                        } else {
                                          setActiveAlbumIndex(index);
                                        }
                                      }
                                    }}
                                  >
                                    {card.title}
                                  </div>
                                </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div
                    className="front-dashboard-glass-card front-dashboard-feature-card front-dashboard-feature-card--team"
                    onClick={requireAuth(() => navigate(`/dashboard/teacher?${linkedCourseQuery}`))}
                  >
                    <div className="front-dashboard-feature-card__header">
                      <div className="front-dashboard-section-title">
                        <span className="front-dashboard-section-title__icon">
                          <TeamOutlined />
                        </span>
                        <span>教师团队</span>
                      </div>
                      <span className="front-dashboard-school-chip">
                        <BankOutlined />
                        <span>{schoolName}</span>
                      </span>
                    </div>

                    <div className="front-dashboard-teacher-list">
                      {assignments.length > 0 ? (
                        <>
                          {visibleTeacherAssignments.map((assignment, idx: number) => (
                            <div
                              key={assignment.id || assignment.teacher?.id || idx}
                              className="front-dashboard-teacher-row"
                            >
                              <Avatar
                                size={36}
                                src={assignment.teacher?.avatarUrl || undefined}
                                className="front-dashboard-teacher-row__avatar"
                              >
                                {assignment.teacher?.name?.[0] || "教"}
                              </Avatar>
                              <div className="front-dashboard-teacher-row__body">
                                <strong>{assignment.teacher?.name || "教师"}</strong>
                                <span>{assignment.teacher?.jobTitle || "教师"}</span>
                              </div>
                            </div>
                          ))}
                          {remainingTeacherCount > 0 ? (
                            <div className="front-dashboard-teacher-row front-dashboard-teacher-row--more">
                              <div className="front-dashboard-teacher-row__more">
                                +{remainingTeacherCount}
                              </div>
                              <div className="front-dashboard-teacher-row__body">
                                <strong>更多教师</strong>
                                <span>查看完整团队</span>
                              </div>
                              <RightOutlined className="front-dashboard-teacher-row__arrow" />
                            </div>
                          ) : null}
                        </>
                      ) : (
                        <div className="front-dashboard-teacher-list__empty">暂无教师信息</div>
                      )}
                    </div>
                  </div>

                  <div className="front-dashboard-glass-card front-dashboard-cumulative-panel">
                    <div className="front-dashboard-section-title">
                      <span className="front-dashboard-section-title__icon">
                        <TeamOutlined />
                      </span>
                      <span>累计数据</span>
                    </div>
                    <div className="front-dashboard-cumulative-grid">
                      {cumulativeStats.map((item) => (
                        <div key={item.label} className="front-dashboard-cumulative-card">
                          <strong>{item.value}</strong>
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

            </div>
          </div>

          {isMobile && (
            <div className="front-dashboard-glass-card" style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid var(--front-card-border)",
              background: "var(--front-card-bg)",
              boxShadow: "0 18px 38px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}>
              <div className="front-dashboard-section-title">
                <span className="front-dashboard-section-title__icon">
                  <ApartmentOutlined />
                </span>
                <span>课程图谱概览</span>
              </div>
              <div className="front-dashboard-cumulative-grid">
                {systemLayers.map((layer) => (
                  <div key={layer.title} className="front-dashboard-cumulative-card">
                    <strong>{layer.value}</strong>
                    <span>{layer.title} · {layer.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

              {!isMobile && (
<div className="front-dashboard-overview-grid__side">
                <div className="front-dashboard-system-panel">
                  <div className="front-dashboard-system-stage">
                    {systemLayers.map((layer) => {
                      const getLayerColors = () => {
                        switch (layer.type) {
                          case "is-blue":
                            return { title: colorTheme.systemPanelTitle, node: colorTheme.systemPanelBlue };
                          case "is-violet":
                            return { title: colorTheme.systemPanelTitle, node: colorTheme.systemPanelViolet };
                          case "is-green":
                            return { title: colorTheme.systemPanelTitle, node: colorTheme.systemPanelGreen };
                          case "is-gold":
                            return { title: colorTheme.systemPanelTitle, node: colorTheme.systemPanelGold };
                          default:
                            return { title: colorTheme.systemPanelTitle, node: colorTheme.systemPanelBlue };
                        }
                      };
                      const colors = getLayerColors();
                      const isAbility = layer.title === "能力体系";
                      const isQuestion = layer.title === "问题体系";
                      const isKnowledge = layer.title === "知识体系";
                      let targetRoute: string;
                      if (isAbility) {
                        // 能力体系 → 课程图谱左侧导航的能力图谱视图
                        targetRoute = `${linkedDashboardRoute("/dashboard/graph")}&main=knowledge&view=competency`;
                      } else if (isQuestion) {
                        // 问题体系 → 课程图谱里的问题图谱
                        targetRoute = `${linkedDashboardRoute("/dashboard/graph")}&main=knowledge&view=question`;
                      } else if (isKnowledge) {
                        // 知识体系 → 课程图谱里的树状图
                        targetRoute = `${linkedDashboardRoute("/dashboard/graph")}&main=knowledge&view=tree`;
                      } else {
                        targetRoute = linkedDashboardRoute(layer.route);
                      }
                      const handleLayerNavigate = () => {
                        if (urlCourseId) {
                          localStorage.setItem("selectedCourse", urlCourseId);
                        }
                        navigate(targetRoute);
                      };
                      return (
                        <div
                          key={layer.title}
                          className="front-dashboard-system-row"
                          onClick={requireAuth(handleLayerNavigate)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              requireAuth(handleLayerNavigate)();
                            }
                          }}
                        >
                          <div
                            className={`front-dashboard-system-layer ${layer.type}`}
                          >
                            <div className="front-dashboard-system-layer__surface" />
                            <div className="front-dashboard-system-layer__inner">
                              <span
                                className="front-dashboard-system-layer__title"
                                style={{ color: colors.title, textShadow: "none" }}
                              >
                                {layer.title}
                              </span>
                              <div className="front-dashboard-system-layer__nodes">
                                {layer.nodes.map((node) => (
                                  <span
                                    key={node}
                                    className="front-dashboard-system-node"
                                    style={{ color: colors.node }}
                                  >
                                    <i style={{ background: colors.node }} />
                                    {node}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="front-dashboard-system-metric">
                            <strong>{layer.value}</strong>
                            <span>{layer.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
              </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Drawer
        title={courseTitle}
        placement="right"
        width="86vw"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        className="front-dashboard-mobile-drawer"
        styles={{ body: { padding: 16 } }}
      >
        <div className="front-dashboard-mobile-drawer__section">
          <div className="front-dashboard-mobile-drawer__eyebrow">课程入口</div>
          <div className="front-dashboard-mobile-drawer__actions">
            {frontMenuActions.map((item) => (
              <button
                key={item.key}
                type="button"
                className="front-dashboard-mobile-drawer__action"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate(item.route);
                }}
              >
                <span className="front-dashboard-mobile-drawer__action-icon">{item.icon}</span>
                <span className="front-dashboard-mobile-drawer__action-copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
                <RightOutlined />
              </button>
            ))}
          </div>
        </div>

        </Drawer>

      {/* 课程相册 → 课程全景（课程体系 + 课程结构 + 课程图谱·树状图谱，同一窗口） */}
      {albumPanorama && (
        <CoursePanorama
          open
          onClose={() => setAlbumPanorama(null)}
          courseId={urlCourseId as string}
          tenant={tenantToUse}
          user={user}
          courseName={courseTitle}
          courseInfo={courseInfoData}
          lightMode={colorTheme.logoVariant === "dark"}
          onOpenDetail={() => {
            if (!user) {
              // 未登录 → 跳转登录（登录后返回当前课程页）
              const currentPath = `${window.location.pathname}${window.location.search}`;
              setAlbumPanorama(null);
              navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
              return;
            }
            setAlbumPanorama(null);
            navigate(albumPanorama.route);
          }}
          themeOverlayStart={colorTheme.pageOverlayStart}
          themeOverlayEnd={colorTheme.pageOverlayEnd}
        />
      )}

      <GlobalFooter />
    </Layout>
  );
}