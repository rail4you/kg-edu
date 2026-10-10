import React from "react";
import { Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ScheduleOutlined,
  PartitionOutlined,
  MailOutlined,
  BulbOutlined,
  TeamOutlined,
  BookOutlined,
  FileOutlined,
  FormOutlined,
  ExperimentOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  ReadOutlined,
  SearchOutlined,
  MenuOutlined,
  HomeOutlined,
  InteractionOutlined,
  EnterOutlined,
  AppstoreOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Input, Spin, Modal, Drawer, Grid } from "antd";
import { useState, useEffect, useMemo, useCallback } from "react";
import { UserMenu } from "@/components/layout/user-menu";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import { NotificationBell } from "@/components/layout/notification-bell";
import { AIChatButton } from "@/components/layout/ai-chat-button";
import GlobalFooter from "@/components/layout/global-footer";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { themeColors as colors } from "@/styles/theme";
import { getAllCourses } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";

interface NavItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// 参照「易课程-完整交互原型」学生端导航：学习空间 / 课堂与实践 / 支持与交流
const navGroups: NavGroup[] = [
  {
    label: "学习空间",
    items: [
      { key: "/dashboard/overview", label: "学习首页", icon: <HomeOutlined /> },
      { key: "/dashboard/intro", label: "课程概览", icon: <BookOutlined /> },
      { key: "/dashboard/graph", label: "图谱总览", icon: <PartitionOutlined /> },
      { key: "/dashboard/course-video", label: "课程视频", icon: <VideoCameraOutlined /> },
      { key: "/dashboard/knowledge-cognitive-goals", label: "认知目标", icon: <BarChartOutlined /> },
      { key: "/dashboard/resource", label: "教学资源", icon: <FileOutlined /> },
      { key: "/dashboard/learning-recommendations", label: "学习推荐", icon: <BulbOutlined /> },
    ],
  },
  {
    label: "课堂与实践",
    items: [
      { key: "/dashboard/interaction", label: "互动课堂", icon: <InteractionOutlined /> },
      { key: "/dashboard/exam-courses", label: "考试系统", icon: <ScheduleOutlined /> },
      { key: "/dashboard/experiment-courses", label: "实验系统", icon: <ExperimentOutlined /> },
      { key: "/dashboard/data-forms", label: "数据表单", icon: <FormOutlined /> },
    ],
  },
  {
    label: "微专业",
    items: [
      { key: "/dashboard/micro-majors", label: "我的微专业", icon: <AppstoreOutlined /> },
    ],
  },
  {
    label: "支持与交流",
    items: [
      { key: "/dashboard/teacher", label: "教师团队", icon: <TeamOutlined /> },
      { key: "/dashboard/email-qa", label: "邮件问答", icon: <MailOutlined /> },
      { key: "/dashboard/chat", label: "AI 助手", icon: <RobotOutlined /> },
      { key: "/dashboard/profile", label: "个人中心", icon: <UserOutlined /> },
    ],
  },
  {
    label: "智慧功能",
    items: [
      { key: "/dashboard/smart-portal", label: "智能门户", icon: <AppstoreOutlined /> },
      { key: "/dashboard/ai-qa", label: "互动故事", icon: <ReadOutlined /> },
    ],
  },
];

export default function StudentLayout() {
  const { useBreakpoint } = Grid;
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const branding = useBranding();
  const [navSearch, setNavSearch] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  usePageTitle();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  // Command palette
  const [commandVisible, setCommandVisible] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);

  // 扁平化所有导航项，用于 command palette 搜索
  const allNavItems = useMemo(() => {
    return navGroups.flatMap(group =>
      group.items.map(item => ({ ...item, group: group.label }))
    );
  }, []);

  const filteredCommands = useMemo(() => {
    if (!commandSearch.trim()) return allNavItems;
    const kw = commandSearch.toLowerCase();
    return allNavItems.filter(item => item.label.toLowerCase().includes(kw));
  }, [commandSearch, allNavItems]);

  // 左侧导航搜索过滤
  const visibleGroups = useMemo(() => {
    const kw = navSearch.trim().toLowerCase();
    if (!kw) return navGroups;
    return navGroups
      .map(g => ({ ...g, items: g.items.filter(it => it.label.toLowerCase().includes(kw)) }))
      .filter(g => g.items.length > 0);
  }, [navSearch]);

  const handleCommandSelect = useCallback((key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("tenant");
    const str = params.toString();
    navigate(str ? `${key}?${str}` : key);
    setCommandVisible(false);
    setCommandSearch("");
    setCommandIndex(0);
  }, [navigate, searchParams]);

  // Cmd+K / Ctrl+K 快捷键
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandVisible(v => !v);
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

  const currentPath = location.pathname;
  const courseId = searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";
  const currentTenant = getCurrentTenant();

  // 获取当前课程信息用于侧边栏
  const { data: courseData } = useQuery({
    queryKey: ["nav-course-info", courseId, currentTenant?.schemaName],
    queryFn: async () => {
      if (!courseId || !currentTenant?.schemaName) return null;
      const result = await getAllCourses({
        tenant: currentTenant.schemaName,
        fields: ["id", "title", "major"],
        headers: user ? getHeaders(user) : undefined,
      });
      if (result.success && result.data) {
        const courses = Array.isArray(result.data)
          ? result.data
          : (result.data as any).results || [];
        return courses.find((c: any) => c.id === courseId) || null;
      }
      return null;
    },
    enabled: !!courseId && !!currentTenant?.schemaName,
    staleTime: 5 * 60 * 1000,
  });

  const courseMajor = courseData?.major || "";
  const courseTitle = courseData?.title || "";

  const handleNavClick = (key: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("tenant");
    const str = params.toString();
    navigate(str ? `${key}?${str}` : key);
    setMobileNavOpen(false);
  };

  const isActive = (key: string) => {
    if (key === "/dashboard/overview" && (currentPath === "/dashboard" || currentPath === "/dashboard/")) {
      return true;
    }
    if (key === "/dashboard/interaction" && currentPath.startsWith("/dashboard/interaction")) {
      return true;
    }
    if (key === "/dashboard/exam-courses" && currentPath.startsWith("/dashboard/exam-")) {
      return true;
    }
    if (key === "/dashboard/experiment-courses" && currentPath.startsWith("/dashboard/experiment-")) {
      return true;
    }
    return currentPath === key;
  };

  const renderNav = () => (
    <aside className="pu-aside">
      <div className="pu-scope">
        <small>当前学习课程</small>
        <b title={courseTitle || "未选择课程"}>{courseTitle || "未选择课程"}</b>
      </div>

      <Input
        className="pu-nav-search"
        prefix={<SearchOutlined style={{ color: "#9aa7ba" }} />}
        placeholder="查找功能页面"
        value={navSearch}
        onChange={(e) => setNavSearch(e.target.value)}
        allowClear
      />

      {visibleGroups.map((group) => (
        <div key={group.label}>
          <div className="pu-nav-group">{group.label}</div>
          {group.items.map((item) => {
            const active = isActive(item.key);
            return (
              <button
                key={`${group.label}-${item.key}-${item.label}`}
                type="button"
                className={`pu-nav-link${active ? " active" : ""}`}
                onClick={() => handleNavClick(item.key)}
              >
                <span className="pu-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}

      {visibleGroups.length === 0 && (
        <div style={{ padding: "16px 12px", color: colors.textSecondary, fontSize: 13 }}>
          没有匹配的功能页面
        </div>
      )}
    </aside>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--pu-bg, #f5f7fb)" }}>
      {/* 顶部栏 */}
      <div
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
            padding: isMobile ? "0 6px" : "0 24px",
            minHeight: isMobile ? 44 : 60,
            gap: isMobile ? 2 : 0,
          }}
        >
          {/* 左侧 Logo + 系统名称 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 6 : 12,
              cursor: "pointer",
              flexShrink: 0,
            }}
            onClick={() => navigate("/")}
          >
            <img
              src={branding.logo_dark}
              alt={branding.app_name}
              style={{ height: isMobile ? 32 : 44, objectFit: "contain" }}
            />
            {!isMobile && (
              <span style={{
                fontSize: 22,
                fontWeight: 700,
                fontFamily: "'Manrope', sans-serif",
                color: colors.textPrimary,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}>
                {branding.app_title}
              </span>
            )}
          </div>

          {/* 中间 - 当前课程焦点区 */}
          {!isMobile && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                maxWidth: "min(46vw, 560px)",
                minWidth: 0,
                pointerEvents: "none",
              }}
            >
              {courseTitle && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    minWidth: 0,
                    maxWidth: "100%",
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 800,
                      color: "#111827",
                      lineHeight: 1.1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "100%",
                    }}
                  >
                    {courseTitle}
                  </span>
                  {courseMajor && (
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.primary,
                        whiteSpace: "nowrap",
                        padding: "4px 10px",
                        background: `${colors.primary}0d`,
                        border: `1px solid ${colors.primary}22`,
                        borderRadius: 9999,
                        flexShrink: 0,
                      }}
                    >
                      {courseMajor}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 右侧功能区域 */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 2 : 10, flexShrink: 0 }}>
            <div
              onClick={() => { setCommandVisible(true); setCommandSearch(""); setCommandIndex(0); }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: isMobile ? 0 : 8,
                padding: isMobile ? "0 6px" : "6px 12px",
                borderRadius: 6,
                background: "#F3F4F6",
                border: "1px solid transparent",
                cursor: "pointer",
                height: isMobile ? 28 : 36,
                width: isMobile ? 28 : "auto",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "#E7E8E9";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = "#F3F4F6";
              }}
            >
              <SearchOutlined style={{ color: colors.textSecondary, fontSize: 15 }} />
              {!isMobile && (
                <>
                  <span style={{ color: colors.textSecondary, fontSize: 14, fontWeight: 500 }}>搜索</span>
                  <kbd style={{
                    background: "#FFFFFF",
                    padding: "1px 5px",
                    borderRadius: 4,
                    border: "1px solid #E1E3E4",
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: colors.textSecondary,
                  }}>⌘K</kbd>
                </>
              )}
            </div>
            <NotificationBell />
            {!isMobile && <UserManualModal role="student" />}
            <UserMenu role="student" compact={isMobile} />
            {isMobile && (
              <div
                onClick={() => setMobileNavOpen(true)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  background: "#F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: colors.textPrimary,
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#E7E8E9"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "#F3F4F6"; }}
              >
                <MenuOutlined style={{ fontSize: 16 }} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 主体：左侧导航 + 工作区 */}
      <div className="pu-shell">
        {!isMobile && renderNav()}

        <main className="pu-workspace">
          <div
            data-outlet-scroll
            style={{ flex: 1, minHeight: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}
          >
            <Outlet />
          </div>
          <GlobalFooter />
        </main>
      </div>

      {/* AI 助手悬浮按钮 */}
      <AIChatButton variant="fab" />

      <Drawer
        title={
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>学习导航</span>
        }
        placement="left"
        onClose={() => setMobileNavOpen(false)}
        open={mobileNavOpen}
        width="72vw"
        styles={{ body: { padding: 0 } }}
      >
        {renderNav()}
      </Drawer>

      {/* Command Palette */}
      <Modal
        open={commandVisible}
        onCancel={() => { setCommandVisible(false); setCommandSearch(""); }}
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
          onChange={(e) => { setCommandSearch(e.target.value); setCommandIndex(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCommandIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCommandIndex(prev => Math.max(prev - 1, 0));
            } else if (e.key === "Enter" && filteredCommands.length > 0) {
              handleCommandSelect(filteredCommands[commandIndex].key);
            }
          }}
          style={{ height: 52, fontSize: 15, border: "none", borderBottom: "1px solid #f0f0f0" }}
          bordered={false}
        />
        <div style={{ maxHeight: 380, overflow: "auto" }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: 32, color: "#999", textAlign: "center" }}>没有匹配的页面</div>
          ) : (
            <div>
              {navGroups.map((group) => {
                const items = filteredCommands.filter(item => item.group === group.label);
                if (items.length === 0) return null;
                return (
                  <div key={group.label}>
                    <div style={{ padding: "8px 16px", fontSize: 12, color: "#999", background: "#fafafa", fontWeight: 500 }}>
                      {group.label}
                    </div>
                    {items.map((item) => {
                      const globalIdx = filteredCommands.indexOf(item);
                      const isSelected = globalIdx === commandIndex;
                      return (
                        <div
                          key={`${item.group}-${item.key}-${item.label}`}
                          onClick={() => handleCommandSelect(item.key)}
                          onMouseEnter={() => setCommandIndex(globalIdx)}
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
                          <span style={{ fontWeight: 500, color: isSelected ? colors.primary : "#333", flex: 1 }}>{item.label}</span>
                          {isSelected && (
                            <EnterOutlined style={{ fontSize: 14, color: colors.primary }} />
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
        <div style={{
          padding: "8px 16px",
          borderTop: "1px solid #f0f0f0",
          background: "#fafafa",
          fontSize: 11,
          color: "#999",
          display: "flex",
          gap: 16,
        }}>
          <span><kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}>↑↓</kbd> 导航</span>
          <span><kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}><EnterOutlined /></kbd> 确认</span>
          <span><kbd style={{ background: "#fff", padding: "1px 5px", borderRadius: 3, border: "1px solid #d9d9d9" }}>Esc</kbd> 关闭</span>
        </div>
      </Modal>
    </div>
  );
}
