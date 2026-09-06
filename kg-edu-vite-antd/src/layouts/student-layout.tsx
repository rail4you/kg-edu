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
  ExperimentOutlined,
  BarChartOutlined,
  VideoCameraOutlined,
  ReadOutlined,
  SearchOutlined,
  MenuOutlined,
  RightOutlined,
  CommentOutlined,
  DeploymentUnitOutlined,
  InteractionOutlined,
  EnterOutlined,
} from "@ant-design/icons";
import { Input, Spin, Modal, Drawer, Button, Grid } from "antd";
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

// 按「内容 → 学习 → 评测 → 工具」四类分组
const navGroups: NavGroup[] = [
  {
    label: "内容",
    items: [
      { key: "/dashboard/overview", label: "课程概述", icon: <BookOutlined /> },
      { key: "/dashboard/intro", label: "课程概览", icon: <ReadOutlined /> },
      { key: "/dashboard/graph", label: "图谱总览", icon: <PartitionOutlined /> },
    ],
  },
  {
    label: "学习",
    items: [
      { key: "/dashboard/course-video", label: "课程视频", icon: <VideoCameraOutlined /> },
      { key: "/dashboard/knowledge-cognitive-goals", label: "认知目标", icon: <BarChartOutlined /> },
      { key: "/dashboard/resource", label: "教学资源", icon: <FileOutlined /> },
      { key: "/dashboard/learning-recommendations", label: "学习推荐", icon: <BulbOutlined /> },
    ],
  },
  {
    label: "互动",
    items: [
      { key: "/dashboard/interaction", label: "互动课堂", icon: <InteractionOutlined /> },
    ],
  },
  {
    label: "评测",
    items: [
      { key: "/dashboard/exam-courses", label: "考试系统", icon: <ScheduleOutlined /> },
      { key: "/dashboard/experiment-courses", label: "实验系统", icon: <ExperimentOutlined /> },
    ],
  },
  {
    label: "工具",
    items: [
      { key: "/dashboard/teacher", label: "教师团队", icon: <TeamOutlined /> },
      { key: "/dashboard/email-qa", label: "邮件问答", icon: <MailOutlined /> },
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
  const [searchValue, setSearchValue] = useState("");
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

  const handleCommandSelect = useCallback((key: string) => {
    const params = searchParams.toString();
    navigate(params ? `${key}?${params}` : key);
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

  // 获取当前课程信息用于面包屑
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
    const params = searchParams.toString();
    navigate(params ? `${key}?${params}` : key);
    setMobileNavOpen(false);
  };

  const isActive = (key: string) => {
    if (key === "/dashboard/overview" && currentPath === "/dashboard") {
      return true;
    }
    // Sub-route matching for interaction hub
    if (key === "/dashboard/interaction" && currentPath.startsWith("/dashboard/interaction")) {
      return true;
    }
    return currentPath === key;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: colors.background }}>
      {/* 顶部导航区域 - Refined Layout 风格：白底浅色顶栏 */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: "#FFFFFF",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.06)",
          overflow: "hidden",
        }}
      >
        {/* 主导航行 - 白底，深色文字 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: isMobile ? "0 6px" : "0 40px",
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
                fontSize: isMobile ? 18 : 22,
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
                      fontSize: 22,
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
                        fontSize: 14,
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
            {/* 搜索按钮 */}
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

        {isMobile && courseTitle && (
          <div
            style={{
              padding: "0 16px 12px",
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: "#111827",
                lineHeight: 1.2,
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
                }}
              >
                {courseMajor}
              </span>
            )}
          </div>
        )}

        {/* Sub Navigation Bar - Glassmorphism + 药丸容器 (Refined Layout 风格) */}
        {!isMobile && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "12px 40px",
              background: "rgba(248, 249, 250, 0.4)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              overflowX: "auto",
            }}
          >
            {/* 药丸容器 - 包裹所有 Tab，分组显示 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 0,
                padding: 4,
                background: "#F3F4F5",
                borderRadius: 9999,
                flexShrink: 0,
              }}
            >
              {navGroups.map((group, gi) => {
                const items = group.items;
                return (
                  <React.Fragment key={group.label}>
                    {/* Group separator */}
                    {gi > 0 && (
                      <div
                        style={{
                          width: 1,
                          height: 20,
                          background: "#D1D5DB",
                          margin: "0 4px",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    {items.map((item) => {
                      const active = isActive(item.key);
                      return (
                        <div
                          key={item.key}
                          onClick={() => handleNavClick(item.key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "8px 16px",
                            cursor: "pointer",
                            fontSize: 15,
                            fontWeight: active ? 600 : 400,
                            fontFamily: "'Manrope', sans-serif",
                            color: active ? "#FFFFFF" : "#424754",
                            whiteSpace: "nowrap",
                            borderRadius: 9999,
                            background: active ? colors.primary : "transparent",
                            transition: "all 0.2s ease",
                            flexShrink: 0,
                            letterSpacing: "0.01em",
                          }}
                          onMouseEnter={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLDivElement).style.background = "rgba(255, 255, 255, 0.5)";
                              (e.currentTarget as HTMLDivElement).style.color = colors.textPrimary;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!active) {
                              (e.currentTarget as HTMLDivElement).style.background = "transparent";
                              (e.currentTarget as HTMLDivElement).style.color = "#424754";
                            }
                          }}
                        >
                          {item.icon && (
                            <span style={{ fontSize: 15, opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                          )}
                          {item.label}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>

            {/* AI 智能助手 - Tab 栏右侧 */}
            <div style={{ flex: 1 }} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "0 14px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: "nowrap",
                flexShrink: 0,
                background: colors.primaryLightBg,
                border: `1px solid ${colors.primaryBorder}`,
                color: colors.primary,
                borderRadius: 9999,
                height: 34,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = "rgba(37, 115, 230, 0.10)";
                el.style.borderColor = "rgba(37, 115, 230, 0.25)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLDivElement;
                el.style.background = colors.primaryLightBg;
                el.style.borderColor = colors.primaryBorder;
              }}
            >
              <AIChatButton variant="inline" />
            </div>
          </div>
        )}
      </div>

      {/* 主内容区域 */}
      <div data-outlet-scroll style={{ flex: 1, padding: isMobile ? "0 0 8px" : "0 12px 12px", minHeight: "calc(100vh - 132px)", display: "flex", flexDirection: "column" }}>
        <Outlet />
      </div>

      <GlobalFooter />

      {/* AI 助手悬浮按钮 */}
      <AIChatButton variant="fab" />

      <Drawer
        title={
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>学习导航</span>
        }
        placement="right"
        onClose={() => setMobileNavOpen(false)}
        open={mobileNavOpen}
        width="72vw"
        styles={{ body: { padding: 10, background: "#F0F2F5" } }}
      >
        {courseTitle && (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: `linear-gradient(135deg, ${colors.primary}10 0%, ${colors.primary}04 100%)`,
              border: `1px solid ${colors.primaryBorder}`,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.primary, marginBottom: 4, letterSpacing: 1 }}>
              当前课程
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.3 }}>
              {courseTitle}
            </div>
            {courseMajor && (
              <div style={{ marginTop: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: colors.primary,
                    padding: "2px 8px",
                    background: colors.primaryLightBg,
                    border: `1px solid ${colors.primaryBorder}`,
                    borderRadius: 9999,
                  }}
                >
                  {courseMajor}
                </span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {navGroups.map((group) => (
            <div
              key={group.label}
              style={{
                borderRadius: 10,
                background: "#FFFFFF",
                overflow: "hidden",
              }}
            >
              {/* 分组标题 */}
              <div style={{
                padding: "10px 12px 2px",
                fontSize: 10,
                fontWeight: 700,
                color: "#999",
                letterSpacing: 1.5,
                textTransform: "uppercase" as const,
              }}>
                {group.label}
              </div>
              <div style={{ padding: "2px 6px 6px" }}>
                {group.items.map((item) => {
                  const active = isActive(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => handleNavClick(item.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: "none",
                        background: active ? `${colors.primary}08` : "transparent",
                        color: active ? colors.primary : "#333",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.12s",
                      }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: 7,
                        background: active ? colors.primary : "#F3F4F5",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.12s",
                      }}>
                        <span style={{ fontSize: 13, color: active ? "#fff" : "#757780", lineHeight: 1 }}>{item.icon}</span>
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <UserManualModal role="student" />
        </div>
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
                          key={item.key}
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
