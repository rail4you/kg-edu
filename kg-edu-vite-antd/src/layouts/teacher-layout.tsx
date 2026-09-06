import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ProLayout } from "@ant-design/pro-components";
import { Alert, Badge, Input } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  HomeOutlined,
  BookOutlined,
  ReadOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  TeamOutlined,
  FolderOutlined,
  PartitionOutlined,
  EditOutlined,
  RobotOutlined,
  BarChartOutlined,
  MailOutlined,
  SettingOutlined,
  VideoCameraOutlined,
  FileOutlined,
  CheckSquareOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  CommentOutlined,
  ApartmentOutlined,
  UserOutlined,
  LinkOutlined,
  MacCommandOutlined,
  StarOutlined,
  StarFilled,
  ClockCircleOutlined,
  LockOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  EnterOutlined,
} from "@ant-design/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listEmailMessages } from "@/lib/ash_rpc";
import { useTranslate } from "@/locales/use-locales";
import { themeColors as colors } from "@/styles/theme";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { useEditPermission } from "@/hooks/use-edit-permission";
import type { MenuDataItem } from "@ant-design/pro-components";

interface RecentItem {
  path: string;
  nameKey: string;
  timestamp: number;
}

const FAVORITES_KEY = "teacher-favorites";
const RECENT_VIEWS_KEY = "teacher-recent-views";
const MAX_RECENT_VIEWS = 15;

const getFavorites = (): string[] => {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favorites: string[]) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  } catch (e) {
    console.error("Failed to save favorites:", e);
  }
};

const getRecentViews = (): RecentItem[] => {
  try {
    const stored = localStorage.getItem(RECENT_VIEWS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentViews = (recentViews: RecentItem[]) => {
  try {
    localStorage.setItem(RECENT_VIEWS_KEY, JSON.stringify(recentViews));
  } catch (e) {
    console.error("Failed to save recent views:", e);
  }
};

const flattenMenuRoutes = (routes: MenuDataItem[]): MenuDataItem[] => {
  const result: MenuDataItem[] = [];
  const traverse = (items: MenuDataItem[]) => {
    items.forEach((item) => {
      if (item.path && !item.routes) {
        result.push(item);
      }
      if (item.routes) {
        traverse(item.routes as MenuDataItem[]);
      }
    });
  };
  traverse(routes);
  return result;
};

const getMenuData = (t: (key: string) => string): MenuDataItem[] => [
  { path: "/teacher/dashboard", name: t("menu.teacherDashboard"), icon: <HomeOutlined /> },
  {
    path: "/teacher/personal",
    name: t("menu.personal"),
    icon: <UserOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/virtual-research-room",
        name: t("menu.virtualResearchRoom"),
        icon: <ExperimentOutlined />,
      },
    ],
  },
  {
    path: "/teacher/ai-workspace",
    name: t("menu.aiWorkspace"),
    icon: <RobotOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/ai-assistant",
        name: t("menu.aiAssistant"),
        icon: <RobotOutlined />,
      },
      {
        path: "/teacher/dashboard/ai-exercise",
        name: t("menu.aiExercise"),
        icon: <EditOutlined />,
      },
      {
        path: "/teacher/dashboard/ai-file",
        name: t("menu.aiFile"),
        icon: <FileOutlined />,
      },
      {
        path: "/teacher/dashboard/ai-command",
        name: t("menu.aiCommand"),
        icon: <MacCommandOutlined />,
      },
    ],
  },
  {
    path: "/teacher/course",
    name: t("menu.courseManagement"),
    icon: <FolderOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/course",
        name: t("menu.courseManagement"),
        icon: <ReadOutlined />,
      },
      {
        path: "/teacher/dashboard/course-category",
        name: t("menu.courseCategory"),
        icon: <FolderOutlined />,
      },
      {
        path: "/teacher/dashboard/assign-course",
        name: t("menu.assignCourse"),
        icon: <UserOutlined />,
      },
      {
        path: "/teacher/dashboard/student-enrollment",
        name: t("menu.studentEnrollment"),
        icon: <TeamOutlined />,
      },
      {
        path: "/teacher/dashboard/course-info",
        name: t("menu.courseInfo"),
        icon: <FileTextOutlined />,
      },
      {
        path: "/teacher/dashboard/book-info",
        name: t("menu.bookInfo"),
        icon: <BookOutlined />,
      },
      {
        path: "/teacher/dashboard/link",
        name: t("menu.link"),
        icon: <LinkOutlined />,
      },
      {
        path: "/teacher/dashboard/course-video",
        name: t("menu.courseVideo"),
        icon: <VideoCameraOutlined />,
      },
      {
        path: "/teacher/dashboard/course-evaluation",
        name: t("menu.discussionManagement"),
        icon: <CommentOutlined />,
      },
      {
        path: "/teacher/dashboard/discussion-session",
        name: t("menu.discussionSession"),
        icon: <TeamOutlined />,
      },
    ],
  },
  {
    path: "/teacher/knowledge",
    name: t("menu.knowledgeManagement"),
    icon: <BookOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/knowledge-resource",
        name: t("menu.knowledgeManagement"),
        icon: <BookOutlined />,
      },
      {
        path: "/teacher/dashboard/knowledge-relation",
        name: t("menu.knowledgeRelation"),
        icon: <PartitionOutlined />,
      },
      {
        path: "/teacher/dashboard/knowledge-cognitive-goals",
        name: t("menu.knowledgeCognitiveGoals"),
        icon: <TrophyOutlined />,
      },
      {
        path: "/teacher/dashboard/knowledge-file",
        name: t("menu.knowledgeFile"),
        icon: <FileOutlined />,
      },
    ],
  },
  {
    path: "/teacher/graph",
    name: t("menu.graphManagement"),
    icon: <ApartmentOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/graph-course",
        name: t("menu.graphCourse"),
        icon: <ApartmentOutlined />,
      },
      {
        path: "/teacher/dashboard/graph-ideological",
        name: t("menu.graphIdeological"),
        icon: <BookOutlined />,
      },
      {
        path: "/teacher/dashboard/graph-competency",
        name: t("menu.graphCompetency"),
        icon: <TrophyOutlined />,
      },
    ],
  },
  {
    path: "/teacher/resource",
    name: t("menu.teachingResource"),
    icon: <EditOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/chapter",
        name: t("menu.chapter"),
        icon: <BookOutlined />,
      },
      {
        path: "/teacher/dashboard/file",
        name: t("menu.file"),
        icon: <FileOutlined />,
      },
      {
        path: "/teacher/dashboard/video",
        name: t("menu.video"),
        icon: <VideoCameraOutlined />,
      },
      {
        path: "/teacher/dashboard/exercise",
        name: t("menu.exercise"),
        icon: <FileTextOutlined />,
      },
      {
        path: "/teacher/dashboard/question",
        name: t("menu.question"),
        icon: <FileTextOutlined />,
      },
      {
        path: "/teacher/dashboard/homework",
        name: t("menu.homework"),
        icon: <CheckSquareOutlined />,
      },
      {
        path: "/teacher/dashboard/exam-management",
        name: t("menu.examManagement"),
        icon: <ScheduleOutlined />,
      },
      {
        path: "/teacher/dashboard/group-management",
        name: t("menu.groupManagement"),
        icon: <TeamOutlined />,
      },
      {
        path: "/teacher/dashboard/group-task",
        name: t("menu.groupTask"),
        icon: <ScheduleOutlined />,
      },
      {
        path: "/teacher/dashboard/check-in-management",
        name: t("menu.checkInManagement"),
        icon: <CheckSquareOutlined />,
      },
      {
        path: "/teacher/dashboard/experiment-management",
        name: t("menu.experimentManagement"),
        icon: <ExperimentOutlined />,
      },
    ],
  },
  {
    path: "/teacher/statistics",
    name: t("menu.statistics"),
    icon: <BarChartOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/course-statistics",
        name: t("menu.courseStatistics"),
        icon: <BarChartOutlined />,
      },
      {
        path: "/teacher/dashboard/learning-statistics",
        name: t("menu.learningStatistics"),
        icon: <BarChartOutlined />,
      },
      {
        path: "/teacher/dashboard/student-profile",
        name: t("menu.studentProfile"),
        icon: <UserOutlined />,
      },
      {
        path: "/teacher/dashboard/learning-recommendations",
        name: t("menu.learningRecommendations"),
        icon: <TrophyOutlined />,
      },
      {
        path: "/teacher/dashboard/activity-summary",
        name: t("menu.activitySummary"),
        icon: <BarChartOutlined />,
      },
    ],
  },
  {
    path: "/teacher/email",
    name: t("menu.emailManagement"),
    icon: <MailOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/email-config",
        name: t("menu.emailConfig"),
        icon: <SettingOutlined />,
      },
      {
        path: "/teacher/dashboard/email-messages",
        name: t("menu.emailMessages"),
        icon: <MailOutlined />,
      },
    ],
  },
  {
    path: "/teacher/major",
    name: "专业",
    icon: <ApartmentOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/job-list",
        name: "岗位管理",
        icon: <TeamOutlined />,
      },
      {
        path: "/teacher/dashboard/job-competency-graphs",
        name: "课程能力图谱",
        icon: <ApartmentOutlined />,
      },
    ],
  },
  {
    path: "/teacher/system",
    name: t("menu.systemSettings"),
    icon: <SettingOutlined />,
    routes: [
      {
        path: "/teacher/dashboard/settings",
        name: t("menu.systemSettings"),
        icon: <SettingOutlined />,
      },
    ],
  },
] as unknown as MenuDataItem[];

const PATH_TO_KEY: Record<string, string> = {
  "/teacher/dashboard": "menu.teacherDashboard",
  "/teacher/dashboard/virtual-research-room": "menu.virtualResearchRoom",
  "/teacher/dashboard/ai-assistant": "menu.aiAssistant",
  "/teacher/dashboard/ai-exercise": "menu.aiExercise",
  "/teacher/dashboard/ai-file": "menu.aiFile",
  "/teacher/dashboard/ai-command": "menu.aiCommand",
  "/teacher/dashboard/course": "menu.courseManagement",
  "/teacher/dashboard/course-category": "menu.courseCategory",
  "/teacher/dashboard/assign-course": "menu.assignCourse",
  "/teacher/dashboard/student-enrollment": "menu.studentEnrollment",
  "/teacher/dashboard/course-info": "menu.courseInfo",
  "/teacher/dashboard/book-info": "menu.bookInfo",
  "/teacher/dashboard/link": "menu.link",
  "/teacher/dashboard/course-video": "menu.courseVideo",
  "/teacher/dashboard/course-evaluation": "menu.discussionManagement",
  "/teacher/dashboard/discussion-session": "menu.discussionSession",
  "/teacher/dashboard/knowledge-resource": "menu.knowledgeManagement",
  "/teacher/dashboard/knowledge-relation": "menu.knowledgeRelation",
  "/teacher/dashboard/knowledge-cognitive-goals": "menu.knowledgeCognitiveGoals",
  "/teacher/dashboard/knowledge-file": "menu.knowledgeFile",
  "/teacher/dashboard/graph-course": "menu.graphCourse",
  "/teacher/dashboard/graph-ideological": "menu.graphIdeological",
  "/teacher/dashboard/graph-competency": "menu.graphCompetency",
  "/teacher/dashboard/chapter": "menu.chapter",
  "/teacher/dashboard/file": "menu.file",
  "/teacher/dashboard/video": "menu.video",
  "/teacher/dashboard/exercise": "menu.exercise",
  "/teacher/dashboard/question": "menu.question",
  "/teacher/dashboard/homework": "menu.homework",
  "/teacher/dashboard/exam-management": "menu.examManagement",
  "/teacher/dashboard/group-management": "menu.groupManagement",
  "/teacher/dashboard/group-task": "menu.groupTask",
  "/teacher/dashboard/check-in-management": "menu.checkInManagement",
  "/teacher/dashboard/experiment-management": "menu.experimentManagement",
  "/teacher/dashboard/course-statistics": "menu.courseStatistics",
  "/teacher/dashboard/learning-statistics": "menu.learningStatistics",
  "/teacher/dashboard/student-profile": "menu.studentProfile",
  "/teacher/dashboard/learning-recommendations": "menu.learningRecommendations",
  "/teacher/dashboard/activity-summary": "menu.activitySummary",
  "/teacher/dashboard/email-config": "menu.emailConfig",
  "/teacher/dashboard/email-messages": "menu.emailMessages",
  "/teacher/dashboard/job-list": "岗位管理",
  "/teacher/dashboard/job-competency-graphs": "课程能力图谱",
  "/teacher/dashboard/job-competency-graphs/": "课程能力图谱",
  "/teacher/dashboard/settings": "menu.systemSettings",
};

export default function TeacherLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useAuth();
  const editPermission = useEditPermission();
  const currentTenant = getCurrentTenant();
  const branding = useBranding();
  const { t } = useTranslate("teacher");
  usePageTitle();

  // 挂载时刷新当前用户，使已登录教师能立即感知编辑权限（无需重新登录）
  useEffect(() => {
    refreshCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [collapsed, setCollapsed] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [recentViews, setRecentViews] = useState<RecentItem[]>(() => getRecentViews());
  const [searchInputVisible, setSearchInputVisible] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [openKeys, setOpenKeys] = useState<string[]>([
    "/teacher/personal",
    "/teacher/ai-workspace",
    "/teacher/course",
    "/teacher/knowledge",
    "/teacher/major",
    "/teacher/graph",
    "/teacher/resource",
    "/teacher/statistics",
    "/teacher/email",
    "/teacher/system",
  ]);

  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const menuData = useMemo(() => getMenuData(t), [t]);
  const menuDataRef = useRef(menuData);
  menuDataRef.current = menuData;

  const updateRecentViews = useCallback((path: string) => {
    const nameKey = PATH_TO_KEY[path];
    if (nameKey) {
      const flatRoutes = flattenMenuRoutes(menuDataRef.current);
      const currentRoute = flatRoutes.find((r) => r.path === path);
      
      if (currentRoute) {
        const newRecent: RecentItem = {
          path: path,
          nameKey: nameKey,
          timestamp: Date.now(),
        };
        
        setRecentViews((prev) => {
          const filtered = prev.filter((item) => item.path !== path);
          const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_VIEWS);
          saveRecentViews(updated);
          return updated;
        });
      }
    }
  }, []);

  useEffect(() => {
    updateRecentViews(location.pathname);
  }, [location.pathname, updateRecentViews]);

  const toggleFavorite = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const newFavorites = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      saveFavorites(newFavorites);
      return newFavorites;
    });
  }, []);

  const flatRoutes = useMemo(() => flattenMenuRoutes(menuData), [menuData]);

  const favoriteRoutes = useMemo(() => {
    return flatRoutes.filter((r) => favorites.includes(r.path || ""));
  }, [favorites, flatRoutes]);

  const recentRouteItems = useMemo(() => {
    return recentViews
      .filter((r) => flatRoutes.some((fr) => fr.path === r.path))
      .map((r) => {
        const route = flatRoutes.find((fr) => fr.path === r.path);
        return route ? { ...route, name: t(r.nameKey) } : null;
      })
      .filter((r): r is MenuDataItem => r !== null);
  }, [recentViews, flatRoutes, t]);

  const searchResults = useMemo(() => {
    if (!searchValue.trim()) return [];
    const keyword = searchValue.toLowerCase();
    return flatRoutes.filter(
      (r) =>
        r.name?.toLowerCase().includes(keyword) ||
        r.path?.toLowerCase().includes(keyword)
    ).slice(0, 10);
  }, [searchValue, flatRoutes]);

  interface SearchOption {
    key: string;
    item: MenuDataItem;
    category: "favorite" | "recent" | "search";
    categoryName: string;
  }

  const allSearchOptions = useMemo((): SearchOption[] => {
    const options: SearchOption[] = [];
    
    if (!searchValue.trim()) {
      favoriteRoutes.forEach((r) => {
        options.push({
          key: `fav-${r.path}`,
          item: r,
          category: "favorite",
          categoryName: t("menu.favorites"),
        });
      });
      
      recentRouteItems.slice(0, 5).forEach((r) => {
        options.push({
          key: `recent-${r.path}`,
          item: r,
          category: "recent",
          categoryName: t("menu.recentViews"),
        });
      });
    } else {
      searchResults.forEach((r) => {
        const isFav = favorites.includes(r.path || "");
        options.push({
          key: `search-${r.path}`,
          item: r,
          category: "search",
          categoryName: isFav ? t("menu.favorites") : t("menu.searchResult"),
        });
      });
    }
    
    return options;
  }, [searchValue, favoriteRoutes, recentRouteItems, searchResults, favorites, t]);

  useEffect(() => {
    if (searchInputVisible) {
      setSelectedIndex(0);
    }
  }, [searchInputVisible]);

  const dynamicMenuData: MenuDataItem[] = useMemo(() => {
    const result: MenuDataItem[] = [];

    if (favoriteRoutes.length > 0) {
      result.push({
        key: "__favorites__",
        path: "/teacher/favorites",
        name: t("menu.favorites"),
        icon: <StarOutlined />,
        routes: favoriteRoutes.map((r) => ({ ...r, key: `fav-${r.path}` })),
      } as MenuDataItem);
    }

    if (recentRouteItems.length > 0) {
      result.push({
        key: "__recent__",
        path: "/teacher/recent",
        name: t("menu.recentViews"),
        icon: <ClockCircleOutlined />,
        routes: recentRouteItems.map((r) => ({ ...r, key: `recent-${r.path}` })),
      } as MenuDataItem);
    }

    return [...result, ...(menuData as MenuDataItem[])] as MenuDataItem[];
  }, [favoriteRoutes, recentRouteItems, menuData, t]);

  const { data: unreadData } = useQuery({
    queryKey: ["email-messages-unread-count", user?.id],
    queryFn: async () => {
      const result = await listEmailMessages({
        tenant,
        fields: ["id", "parentMessageId"],
        // 只统计当前教师接收的未读消息，不受租户内其他教师未读影响
        filter: {
          and: [
            { readStatus: { eq: "unread" } },
            { receiverUserId: { eq: user?.id } },
          ],
        },
        page: { limit: 100, count: true },
        headers,
      });
      if (!result.success) return 0;
      const data = result.data as unknown as { results?: Array<{ id: string; parentMessageId?: string | null }>; count?: number | null };
      const topLevelUnread = data.results?.filter((m) => !m.parentMessageId).length || 0;
      return topLevelUnread;
    },
    enabled: !!tenant && !!user,
  });

  const unreadCount = unreadData || 0;

  const handleSearch = useCallback((path: string) => {
    navigate(path);
    setSearchValue("");
    setSearchInputVisible(false);
  }, [navigate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, allSearchOptions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && allSearchOptions.length > 0) {
      e.preventDefault();
      handleSearch(allSearchOptions[selectedIndex].item.path!);
    }
  }, [allSearchOptions, selectedIndex, handleSearch]);

  const renderMenuItem = (item: MenuDataItem, dom: React.ReactNode) => {
    const isEmailMessages = item.path === "/teacher/dashboard/email-messages";
    const isFav = favorites.includes(item.path || "");
    
    if (item.path?.startsWith("/teacher/favorites") || item.path?.startsWith("/teacher/recent")) {
      return (
        <div style={{ display: "flex", alignItems: "center", fontWeight: 500 }}>
          {dom}
        </div>
      );
    }

    const handleClick = () => {
      if (item.path) {
        navigate(item.path);
      }
    };

    return (
      <div 
        onClick={handleClick}
        style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between",
          paddingRight: 8,
          width: "100%",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
          {dom}
          {isEmailMessages && unreadCount > 0 && (
            <Badge
              count={unreadCount}
              style={{
                marginLeft: 8,
                fontSize: 10,
                minWidth: 16,
                height: 16,
                lineHeight: "16px",
                padding: "0 4px",
              }}
              overflowCount={99}
            />
          )}
        </div>
        {item.path && !item.routes && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.path!, e);
            }}
            style={{
              cursor: "pointer",
              color: isFav ? "#faad14" : "#d9d9d9",
              fontSize: 14,
              padding: "2px 6px",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#faad14")}
            onMouseLeave={(e) => (e.currentTarget.style.color = isFav ? "#faad14" : "#d9d9d9")}
          >
            {isFav ? <StarFilled /> : <StarOutlined />}
          </span>
        )}
      </div>
    );
  };

  // 修正侧边栏位置：从 header 下方开始
  useEffect(() => {
    const styleId = "teacher-layout-sider-fix";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      .ant-pro-layout .ant-layout-sider {
        top: 56px !important;
        height: calc(100vh - 56px) !important;
      }
      .ant-pro-layout .ant-layout-sider .ant-layout-sider-children {
        height: calc(100vh - 56px) !important;
      }

      @media (max-width: 768px) {
        .teacher-layout-header {
          padding: 0 16px !important;
          height: 54px !important;
        }
        .teacher-layout-brand {
          gap: 8px !important;
        }
        .teacher-layout-brand-text {
          font-size: 15px !important;
        }
        .teacher-layout-actions {
          gap: 6px !important;
        }
        .teacher-layout-search-input {
          width: 140px !important;
        }
      }

      @media (max-width: 480px) {
        .teacher-layout-header {
          padding: 0 10px !important;
          height: 50px !important;
        }
        .teacher-layout-brand {
          gap: 6px !important;
        }
        .teacher-layout-brand-text {
          display: none !important;
        }
        .teacher-layout-actions {
          gap: 4px !important;
        }
        .teacher-layout-search-input {
          width: 100px !important;
        }
      }

      /* 教师页面所有表格宽度填满容器 */
      .ant-table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      .ant-table-wrapper .ant-table-thead > tr > th,
      .ant-table-wrapper .ant-table-tbody > tr > td {
        white-space: nowrap;
      }
      .ant-table-wrapper .ant-table-container {
        width: 100%;
      }
      .ant-table-wrapper .ant-table-container table {
        width: 100% !important;
        table-layout: fixed !important;
      }

      /* 移动端返回按钮通用样式 */
      @media (max-width: 768px) {
        .teacher-page-back-btn {
          display: inline-flex !important;
        }
      }
      @media (min-width: 769px) {
        .teacher-page-back-btn {
          display: none !important;
        }
      }
    `;
    return () => {
      style.remove();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchInputVisible(true);
      }
      if (e.key === "Escape") {
        setSearchInputVisible(false);
        setSearchValue("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchPlaceholder = t("layout.searchPlaceholder");
  const searchHint = t("layout.searchHint");
  const noResults = t("layout.noResults");
  const navigateText = t("layout.navigate");
  const confirmText = t("layout.confirm");
  const closeText = t("layout.close");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* 全宽顶部栏 - 白底风格 */}
      <div
        className="teacher-layout-header"
        style={{
          height: 60,
          flexShrink: 0,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 40px",
          zIndex: 1000,
          position: "relative",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div
          className="teacher-layout-brand"
          style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 12 }}
          onClick={() => navigate("/teacher/module-home")}
        >
          <img
            src={branding.logo_dark}
            alt={branding.app_name}
            style={{ height: 44, objectFit: "contain" }}
          />
          <span className="teacher-layout-brand-text" style={{
            fontSize: 19,
            fontWeight: 700,
            fontFamily: "'Manrope', sans-serif",
            color: colors.textPrimary,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
          }}>
            {branding.app_title} · 教师端
          </span>
        </div>
        <div className="teacher-layout-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="teacher-layout-search-wrap">
            <Input
              prefix={<SearchOutlined style={{ color: "#8c8c8c" }} />}
              placeholder={searchPlaceholder}
              readOnly
              onClick={() => setSearchInputVisible(true)}
              className="teacher-layout-search-input"
              style={{
                width: 200,
                cursor: "pointer",
                background: "#F3F4F6",
                border: "1px solid transparent",
                borderRadius: 8,
                color: "#8c8c8c",
                height: 34,
              }}
            />
          </div>
          <UserMenu role="teacher" />
          <UserManualModal role="teacher" />
        </div>
      </div>

      <div data-scroll-container style={{ flex: 1, overflow: "auto" }}>
      {!editPermission.canEdit && (
        <Alert
          banner
          type="warning"
          showIcon
          icon={<LockOutlined />}
          message={editPermission.statusText}
          style={{ borderRadius: 0 }}
        />
      )}
      <ProLayout
        title={false}
        logo={false}
        layout="side"
        collapsed={collapsed}
        onCollapse={setCollapsed}
        location={{ pathname: location.pathname }}
        route={{ path: "/", routes: dynamicMenuData }}
        menuProps={{
          openKeys,
          onOpenChange: (keys) => setOpenKeys(keys as string[]),
        }}
        menuItemRender={(item, dom) => renderMenuItem(item, dom)}
        headerRender={false}
        menuHeaderRender={false}
        token={{
          sider: {
            colorMenuBackground: "#fff",
            colorTextMenu: "#333",
            colorTextMenuActive: "#0A2463",
            colorTextMenuSelected: "#0A2463",
          },
        }}
        fixSiderbar
        style={{ height: "100%" }}
        contentStyle={{ padding: 0, height: "100%", overflow: "auto" }}
        footerRender={false}
      >
      {searchInputVisible && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 999,
            display: "flex",
            justifyContent: "center",
            paddingTop: 80,
          }}
          onClick={() => {
            setSearchInputVisible(false);
            setSearchValue("");
          }}
        >
          <div
            style={{
              width: 560,
              background: "#fff",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              autoFocus
              prefix={<SearchOutlined style={{ color: "#1890ff", fontSize: 18 }} />}
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              style={{ height: 56, fontSize: 16, border: "none", borderBottom: "1px solid #f0f0f0" }}
              bordered={false}
            />
            <div style={{ maxHeight: 420, overflow: "auto" }}>
              {allSearchOptions.length === 0 ? (
                <div style={{ padding: 32, color: "#999", textAlign: "center" }}>
                  {searchValue.trim() === "" ? searchHint : noResults}
                </div>
              ) : (
                <div>
                  {[t("menu.favorites"), t("menu.recentViews"), t("menu.searchResult")].map((cat) => {
                    const optionsInCat = allSearchOptions.filter((o) => o.categoryName === cat);
                    if (optionsInCat.length === 0) return null;
                    
                    return (
                      <div key={cat}>
                        <div
                          style={{
                            padding: "8px 16px",
                            fontSize: 12,
                            color: "#999",
                            background: "#fafafa",
                            fontWeight: 500,
                          }}
                        >
                          {cat}
                        </div>
                        {optionsInCat.map((opt) => {
                          const globalIdx = allSearchOptions.indexOf(opt);
                          const isSelected = globalIdx === selectedIndex;
                          
                          return (
                            <div
                              key={opt.key}
                              onClick={() => handleSearch(opt.item.path!)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              style={{
                                padding: "12px 16px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                background: isSelected ? "#e6f7ff" : "transparent",
                                borderBottom: "1px solid #f5f5f5",
                                transition: "background 0.15s",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                                <span style={{ fontSize: 16, color: "#1890ff" }}>{opt.item.icon}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 500, color: "#333" }}>{opt.item.name}</div>
                                </div>
                                {opt.category === "favorite" && (
                                  <StarFilled style={{ color: "#faad14", fontSize: 14 }} />
                                )}
                              </div>
                              {isSelected && (
                                <EnterOutlined style={{ fontSize: 16, color: "#1890ff" }} />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "8px 16px",
                borderTop: "1px solid #f0f0f0",
                background: "#fafafa",
                fontSize: 12,
                color: "#999",
                display: "flex",
                gap: 16,
              }}
            >
              <span>
                <kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}>↑↓</kbd> {navigateText}
              </span>
              <span>
                <kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}><EnterOutlined /></kbd> {confirmText}
              </span>
              <span>
                <kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}>Esc</kbd> {closeText}
              </span>
            </div>
          </div>
        </div>
      )}
      <Outlet />
    </ProLayout>
    </div>
    </div>
  );
}
