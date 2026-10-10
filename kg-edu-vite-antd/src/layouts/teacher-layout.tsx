import { useState, useEffect, useMemo, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Alert, Badge, Input, Drawer, Modal } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  HomeOutlined,
  BookOutlined,
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
  LockOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  EnterOutlined,
  AudioOutlined,
  MenuOutlined,
  DownOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import GlobalFooter from "@/components/layout/global-footer";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listEmailMessages } from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { themeColors as colors } from "@/styles/theme";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const FAVORITES_KEY = "teacher-favorites";

// 参照「易课程-完整交互原型」教师端导航分组
const NAV_ITEMS: NavItem[] = [
  { path: "/teacher/dashboard", label: "教师工作台", icon: <HomeOutlined />, group: "工作空间" },
  { path: "/teacher/dashboard/virtual-research-room", label: "虚拟教研室", icon: <ExperimentOutlined />, group: "工作空间" },
  { path: "/teacher/dashboard/profile", label: "个人中心", icon: <UserOutlined />, group: "工作空间" },

  { path: "/teacher/dashboard/ai-assistant", label: "AI智能体助手", icon: <RobotOutlined />, group: "AI 工作台" },
  { path: "/teacher/dashboard/ai-exercise", label: "AI生成试题", icon: <EditOutlined />, group: "AI 工作台" },
  { path: "/teacher/dashboard/ai-file", label: "AI文件", icon: <FileOutlined />, group: "AI 工作台" },
  { path: "/teacher/dashboard/ai-command", label: "AI命令中心", icon: <MacCommandOutlined />, group: "AI 工作台" },

  { path: "/teacher/dashboard/course", label: "课程管理", icon: <BookOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/course-category", label: "学科分类", icon: <FolderOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/assign-course", label: "分配课程", icon: <UserOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/student-enrollment", label: "学生选课", icon: <TeamOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/course-info", label: "课程信息", icon: <FileTextOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/book-info", label: "教材管理", icon: <BookOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/link", label: "链接管理", icon: <LinkOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/course-video", label: "课程视频", icon: <VideoCameraOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/course-evaluation", label: "课程评价管理", icon: <CommentOutlined />, group: "课程建设" },
  { path: "/teacher/dashboard/discussion-session", label: "实时课程讨论", icon: <TeamOutlined />, group: "课程建设" },

  { path: "/teacher/dashboard/knowledge-resource", label: "知识点管理", icon: <BookOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/knowledge-relation", label: "知识关系管理", icon: <PartitionOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/knowledge-cognitive-goals", label: "认知目标管理", icon: <TrophyOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/knowledge-file", label: "知识点课程资源", icon: <FileOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/graph-course", label: "课程图谱", icon: <ApartmentOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/graph-ideological", label: "思政图谱", icon: <BookOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/graph-competency", label: "能力图谱", icon: <TrophyOutlined />, group: "知识体系" },

  { path: "/teacher/dashboard/chapter", label: "章节管理", icon: <BookOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/file", label: "资源管理", icon: <FileOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/video", label: "视频管理", icon: <VideoCameraOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/exercise", label: "题库管理", icon: <FileTextOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/question", label: "问题管理", icon: <FileTextOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/homework", label: "作业管理", icon: <CheckSquareOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/exam-management", label: "考试管理", icon: <ScheduleOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/face-check", label: "人脸抓拍", icon: <SafetyCertificateOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/group-management", label: "分组管理", icon: <TeamOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/group-task", label: "分组任务", icon: <ScheduleOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/check-in-management", label: "签到管理", icon: <CheckSquareOutlined />, group: "教学运行" },
  { path: "/teacher/dashboard/experiment-management", label: "实验管理", icon: <ExperimentOutlined />, group: "教学运行" },

  { path: "/teacher/dashboard/course-statistics", label: "课程数据统计", icon: <BarChartOutlined />, group: "统计分析" },
  { path: "/teacher/dashboard/learning-statistics", label: "学习数据统计", icon: <BarChartOutlined />, group: "统计分析" },
  { path: "/teacher/dashboard/student-profile", label: "学生学情画像", icon: <UserOutlined />, group: "统计分析" },
  { path: "/teacher/dashboard/learning-recommendations", label: "学习推荐分析", icon: <TrophyOutlined />, group: "统计分析" },
  { path: "/teacher/dashboard/activity-summary", label: "活动总结", icon: <BarChartOutlined />, group: "统计分析" },

  { path: "/teacher/dashboard/job-list", label: "岗位管理", icon: <TeamOutlined />, group: "知识体系" },
  { path: "/teacher/dashboard/job-competency-graphs", label: "课程能力图谱", icon: <ApartmentOutlined />, group: "知识体系" },

  { path: "/teacher/dashboard/email-messages", label: "邮件消息", icon: <MailOutlined />, group: "邮件与表单" },
  { path: "/teacher/dashboard/email-config", label: "邮件配置", icon: <SettingOutlined />, group: "邮件与表单" },
  { path: "/teacher/dashboard/custom-form", label: "自定义表单", icon: <FileTextOutlined />, group: "邮件与表单" },

  { path: "/teacher/dashboard/ai-practice", label: "AI 实践", icon: <RobotOutlined />, group: "AI 工具" },
  { path: "/teacher/dashboard/tts", label: "AI 语音合成", icon: <AudioOutlined />, group: "AI 工具" },
  { path: "/teacher/dashboard/research-track", label: "学术追踪", icon: <SearchOutlined />, group: "AI 工具" },
  { path: "/teacher/dashboard/assistant-plugins", label: "助教插件", icon: <MacCommandOutlined />, group: "AI 工具" },

  { path: "/teacher/dashboard/settings", label: "系统设置", icon: <SettingOutlined />, group: "设置" },
];

const GROUP_ORDER = [
  "工作空间",
  "AI 工作台",
  "AI 工具",
  "课程建设",
  "知识体系",
  "教学运行",
  "统计分析",
  "邮件与表单",
  "设置",
];

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

export default function TeacherLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, refreshCurrentUser } = useAuth();
  const editPermission = useEditPermission();
  const currentTenant = getCurrentTenant();
  const branding = useBranding();
  const { isMobile } = useResponsive();
  usePageTitle();

  // 挂载时刷新当前用户，使已登录教师能立即感知编辑权限（无需重新登录）
  useEffect(() => {
    refreshCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [navSearch, setNavSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => getFavorites());
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  const [commandVisible, setCommandVisible] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);

  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  // 组装分组
  const navGroups = useMemo(() => {
    return GROUP_ORDER.map((label) => ({
      label,
      items: NAV_ITEMS.filter((it) => it.group === label),
    })).filter((g) => g.items.length > 0);
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setCollapsedGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  }, []);

  const toggleFavorite = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
      saveFavorites(next);
      return next;
    });
  }, []);

  const favoriteItems = useMemo(
    () => favorites.map((p) => NAV_ITEMS.find((it) => it.path === p)).filter((x): x is NavItem => Boolean(x)),
    [favorites]
  );

  const visibleGroups = useMemo(() => {
    const kw = navSearch.trim().toLowerCase();
    if (!kw) return navGroups;
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(kw)) }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, navSearch]);

  // Command palette 结果
  const commandItems = useMemo(() => {
    const kw = commandSearch.trim().toLowerCase();
    const base = kw ? NAV_ITEMS.filter((it) => it.label.toLowerCase().includes(kw)) : NAV_ITEMS;
    return base;
  }, [commandSearch]);

  useEffect(() => {
    setCommandIndex(0);
  }, [commandSearch]);

  const handleCommandSelect = useCallback(
    (path: string) => {
      navigate(path);
      setCommandVisible(false);
      setCommandSearch("");
      setCommandIndex(0);
    },
    [navigate]
  );

  const { data: unreadData } = useQuery({
    queryKey: ["email-messages-unread-count", user?.id],
    queryFn: async () => {
      const result = await listEmailMessages({
        tenant,
        fields: ["id", "parentMessageId"],
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

  // Cmd+K / Ctrl+K 快捷键
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandVisible((v) => !v);
        setCommandSearch("");
        setCommandIndex(0);
      }
      if (e.key === "Escape" && commandVisible) {
        setCommandVisible(false);
        setCommandSearch("");
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [commandVisible]);

  const isActive = (path: string) => {
    if (path === "/teacher/dashboard") {
      return location.pathname === "/teacher/dashboard" || location.pathname === "/teacher/dashboard/";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const renderNavLink = (item: NavItem, showFav = true) => {
    const active = isActive(item.path);
    const isFav = favorites.includes(item.path);
    return (
      <button
        key={item.path}
        type="button"
        className={`pu-nav-link${active ? " active" : ""}`}
        onClick={() => handleNavClick(item.path)}
      >
        <span className="pu-nav-icon">{item.icon}</span>
        <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.label}
        </span>
        {item.path === "/teacher/dashboard/email-messages" && unreadCount > 0 && (
          <Badge count={unreadCount} overflowCount={99} size="small" />
        )}
        {showFav && (
          <span
            onClick={(e) => toggleFavorite(item.path, e)}
            style={{
              cursor: "pointer",
              color: isFav ? "#faad14" : "#c9d2df",
              fontSize: 13,
              lineHeight: 1,
            }}
            title={isFav ? "取消收藏" : "收藏"}
          >
            {isFav ? <StarFilled /> : <StarOutlined />}
          </span>
        )}
      </button>
    );
  };

  const renderNav = () => (
    <aside className="pu-aside">
      <div className="pu-scope">
        <small>当前机构</small>
        <b title={currentTenant?.name || tenant || "未选择机构"}>
          {currentTenant?.name || tenant || "未选择机构"}
        </b>
      </div>

      <Input
        className="pu-nav-search"
        prefix={<SearchOutlined style={{ color: "#9aa7ba" }} />}
        placeholder="查找功能页面"
        value={navSearch}
        onChange={(e) => setNavSearch(e.target.value)}
        allowClear
      />

      {!navSearch.trim() && favoriteItems.length > 0 && (() => {
        const collapsed = collapsedGroups.includes("收藏");
        return (
          <div>
            <button
              type="button"
              className="pu-nav-group pu-nav-group__toggle"
              onClick={() => toggleGroup("收藏")}
              aria-expanded={!collapsed}
            >
              <span>收藏</span>
              {collapsed ? <RightOutlined /> : <DownOutlined />}
            </button>
            {!collapsed && favoriteItems.map((item) => renderNavLink(item))}
          </div>
        );
      })()}

      {visibleGroups.map((group) => {
        const collapsed = !navSearch.trim() && collapsedGroups.includes(group.label);
        return (
          <div key={group.label}>
            <button
              type="button"
              className="pu-nav-group pu-nav-group__toggle"
              onClick={() => toggleGroup(group.label)}
              aria-expanded={!collapsed}
            >
              <span>{group.label}</span>
              {collapsed ? <RightOutlined /> : <DownOutlined />}
            </button>
            {!collapsed && group.items.map((item) => renderNavLink(item))}
          </div>
        );
      })}

      {visibleGroups.length === 0 && (
        <div style={{ padding: "16px 12px", color: colors.textSecondary, fontSize: 13 }}>
          没有匹配的功能页面
        </div>
      )}
    </aside>
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--pu-bg, #f5f7fb)",
      }}
    >
      {/* 顶部栏 */}
      <div
        className="teacher-layout-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 12px" : "0 40px",
            minHeight: isMobile ? 54 : 60,
            gap: 8,
          }}
        >
          <div
            className="teacher-layout-brand"
            style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 12, flexShrink: 0 }}
            onClick={() => navigate("/teacher/dashboard")}
          >
            <img
              src={branding.logo_dark}
              alt={branding.app_name}
              style={{ height: isMobile ? 36 : 44, objectFit: "contain" }}
            />
            <span
              className="teacher-layout-brand-text"
              style={{
                fontSize: 19,
                fontWeight: 700,
                fontFamily: "'Manrope', sans-serif",
                color: colors.textPrimary,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {branding.app_title} · 教师端
            </span>
          </div>

          <div
            className="teacher-layout-actions"
            style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12, flexShrink: 0 }}
          >
            <div
              onClick={() => {
                setCommandVisible(true);
                setCommandSearch("");
                setCommandIndex(0);
              }}
              style={{
                display: isMobile ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 8,
                background: "#F3F4F6",
                border: "1px solid transparent",
                cursor: "pointer",
                height: 36,
              }}
            >
              <SearchOutlined style={{ color: colors.textSecondary, fontSize: 15 }} />
              <span style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 500 }}>搜索</span>
              <kbd
                style={{
                  background: "#FFFFFF",
                  padding: "1px 5px",
                  borderRadius: 4,
                  border: "1px solid #E1E3E4",
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: colors.textSecondary,
                }}
              >
                ⌘K
              </kbd>
            </div>
            {!isMobile && <NotificationBell />}
            {!isMobile && <UserManualModal role="teacher" />}
            <UserMenu role="teacher" compact={isMobile} />
            {isMobile && (
              <div
                onClick={() => setMobileNavOpen(true)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "#F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: colors.textPrimary,
                }}
              >
                <MenuOutlined style={{ fontSize: 16 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 只读横幅 */}
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

      {/* 主体：左侧导航 + 工作区 */}
      <div className="pu-shell">
        {!isMobile && renderNav()}

        <main className="pu-workspace">
          <div
            data-scroll-container
            style={{ flex: 1, minHeight: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}
          >
            <div className="pu-app" style={{ flex: 1 }}>
              <Outlet />
            </div>
          </div>
          <GlobalFooter />
        </main>
      </div>

      <Drawer
        title={<span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>教师导航</span>}
        placement="left"
        onClose={() => setMobileNavOpen(false)}
        open={mobileNavOpen}
        width="76vw"
        styles={{ body: { padding: 0 } }}
      >
        {renderNav()}
      </Drawer>

      {/* Command Palette */}
      <Modal
        open={commandVisible}
        onCancel={() => {
          setCommandVisible(false);
          setCommandSearch("");
        }}
        footer={null}
        centered
        closable={false}
        width={520}
        styles={{ body: { padding: 0 } }}
        style={{ top: 80 }}
      >
        <Input
          autoFocus
          prefix={<SearchOutlined style={{ color: colors.primary, fontSize: 16 }} />}
          placeholder="搜索导航页面..."
          value={commandSearch}
          onChange={(e) => setCommandSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCommandIndex((prev) => Math.min(prev + 1, commandItems.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCommandIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && commandItems.length > 0) {
              handleCommandSelect(commandItems[commandIndex].path);
            }
          }}
          style={{ height: 52, fontSize: 15, border: "none", borderBottom: "1px solid #f0f0f0" }}
          bordered={false}
        />
        <div style={{ maxHeight: 380, overflow: "auto" }}>
          {commandItems.length === 0 ? (
            <div style={{ padding: 32, color: "#999", textAlign: "center" }}>没有匹配的页面</div>
          ) : (
            commandItems.map((item, idx) => {
              const isSelected = idx === commandIndex;
              return (
                <div
                  key={item.path}
                  onClick={() => handleCommandSelect(item.path)}
                  onMouseEnter={() => setCommandIndex(idx)}
                  style={{
                    padding: "10px 16px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: isSelected ? `${colors.primary}08` : "transparent",
                    borderLeft: isSelected ? `3px solid ${colors.primary}` : "3px solid transparent",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 16, color: colors.primary }}>{item.icon}</span>
                  <span style={{ fontWeight: 500, color: isSelected ? colors.primary : "#333", flex: 1 }}>
                    {item.label}
                  </span>
                  <span style={{ fontSize: 12, color: "#9aa7ba" }}>{item.group}</span>
                  {isSelected && <EnterOutlined style={{ fontSize: 14, color: colors.primary }} />}
                </div>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
}
