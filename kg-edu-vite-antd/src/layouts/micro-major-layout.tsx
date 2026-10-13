import { useState, useEffect, useMemo, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Grid, Input, Modal } from "antd";
import {
  ApartmentOutlined,
  BookOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FileOutlined,
  ReadOutlined,
  DashboardOutlined,
  EditOutlined,
  FilePdfOutlined,
  MenuOutlined,
  UserOutlined,
  SearchOutlined,
  DownOutlined,
  RightOutlined,
  EnterOutlined,
} from "@ant-design/icons";
import { MobileFullMenu } from "@/components/layout/mobile-full-menu";
import { ModuleSwitcher } from "@/components/layout/module-switcher";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import GlobalFooter from "@/components/layout/global-footer";
import { themeColors as colors } from "@/styles/theme";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { getCurrentTenant } from "@/lib/tenant";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/micro-major/dashboard", label: "微专业管理", icon: <DashboardOutlined />, group: "微专业管理" },
  { path: "/micro-major/student-management", label: "微专业学生管理", icon: <TeamOutlined />, group: "微专业管理" },
  { path: "/micro-major/certificates", label: "证书模板", icon: <FilePdfOutlined />, group: "微专业管理" },

  { path: "/micro-major/courses", label: "课程管理", icon: <ReadOutlined />, group: "课程管理" },
  { path: "/micro-major/chapters", label: "章节管理", icon: <BookOutlined />, group: "课程管理" },
  { path: "/micro-major/chapter-content", label: "章节内容关联", icon: <FileTextOutlined />, group: "课程管理" },

  { path: "/micro-major/videos", label: "视频管理", icon: <VideoCameraOutlined />, group: "课程资源管理" },
  { path: "/micro-major/exercises", label: "习题管理", icon: <EditOutlined />, group: "课程资源管理" },
  { path: "/micro-major/resources", label: "资源管理", icon: <FileOutlined />, group: "课程资源管理" },
  { path: "/micro-major/homework", label: "作业管理", icon: <FileOutlined />, group: "课程资源管理" },

  { path: "/micro-major/analytics", label: "微专业学习分析", icon: <ApartmentOutlined />, group: "分析统计" },
];

const GROUP_ORDER = ["微专业管理", "课程管理", "课程资源管理", "分析统计"];

const MOBILE_MENU_ITEMS = [
  ...NAV_ITEMS.map((it) => ({ key: it.path, label: it.label })),
];

export default function MicroMajorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const branding = useBranding();
  usePageTitle();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const currentTenant = getCurrentTenant();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [commandVisible, setCommandVisible] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);

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

  const visibleGroups = useMemo(() => {
    const kw = navSearch.trim().toLowerCase();
    if (!kw) return navGroups;
    return navGroups
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(kw)) }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, navSearch]);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const commandItems = useMemo(() => {
    const kw = commandSearch.trim().toLowerCase();
    return kw ? NAV_ITEMS.filter((it) => it.label.toLowerCase().includes(kw)) : NAV_ITEMS;
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

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  const renderNav = () => (
    <aside className="pu-aside">
      <div className="pu-scope">
        <small>当前机构</small>
        <b title={currentTenant?.name || "未选择机构"}>
          {currentTenant?.name || "未选择机构"}
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
            {!collapsed && group.items.map((item) => (
              <button
                key={item.path}
                type="button"
                className={`pu-nav-link${isActive(item.path) ? " active" : ""}`}
                onClick={() => handleNavClick(item.path)}
              >
                <span className="pu-nav-icon">{item.icon}</span>
                <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {item.label}
                </span>
              </button>
            ))}
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
    <div className="mm-layout" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--pu-bg, #f5f7fb)" }}>
      <style>{`
@media(max-width:768px){
.mm-layout .mm-topbar{padding:0 12px!important;min-height:64px!important}
.mm-layout .mm-brand-text{display:none!important}
.mm-layout .mm-topbar-title{font-size:14px!important}
.mm-layout .mm-logo{height:36px!important}
}
@media(min-width:769px){
.mm-layout .mm-mobile-menu-btn{display:none!important}
}
`}</style>
      {/* Top bar */}
      <div
        className="mm-topbar"
        style={{
          position: "sticky",
          top: 0,
          minHeight: isMobile ? 64 : 76,
          flexShrink: 0,
          background: "#FFFFFF",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "center",
          padding: isMobile ? "0 12px" : "0 40px",
          zIndex: 1000,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          columnGap: isMobile ? 8 : 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            gap: isMobile ? 6 : 8,
            minWidth: 0,
            overflow: "hidden",
          }}
          onClick={() => navigate("/teacher/module-home")}
        >
          {!isMobile && (
            <img
              src={branding.logo_dark}
              alt={branding.app_name}
              style={{ height: 44, objectFit: "contain" }}
              className="mm-logo"
            />
          )}
          <span
            className="mm-topbar-title"
            style={{
              fontSize: isMobile ? 14 : 19,
              fontWeight: 700,
              color: colors.textPrimary,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {isMobile ? "微专业管理" : `${branding.app_title} · 微专业管理`}
          </span>
        </div>
        <div style={{ justifySelf: "center" }}>
          <ModuleSwitcher active="micro-major" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 12, justifySelf: "end" }}>
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
          {!isMobile && <UserManualModal role="teacher" />}
          <Button
            type="text"
            icon={<UserOutlined style={{ fontSize: 16, color: colors.textPrimary }} />}
            onClick={() => navigate("/micro-major/profile")}
            aria-label="账户"
          />
          {isMobile && (
            <Button
              type="text"
              className="mm-mobile-menu-btn"
              icon={<MenuOutlined style={{ fontSize: 18, color: colors.textPrimary }} />}
              onClick={() => setMobileMenuOpen(true)}
              aria-label="打开菜单"
            />
          )}
        </div>
      </div>

      <MobileFullMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={MOBILE_MENU_ITEMS}
        activeKey={location.pathname}
        sectionTitle="微专业管理"
      />

      {/* Main content with sidebar */}
      <div className="pu-shell pu-shell--teacher">
        {!isMobile && renderNav()}

        <main className="pu-workspace">
          <div
            data-scroll-container
            style={{ flex: 1, minHeight: "calc(100vh - 76px)", display: "flex", flexDirection: "column" }}
          >
            <div className="pu-app" style={{ flex: 1 }}>
              <Outlet />
            </div>
          </div>
          <GlobalFooter />
        </main>
      </div>

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
