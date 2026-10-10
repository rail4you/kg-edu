import { useState, useMemo, useEffect } from "react";
import { Alert, Drawer, Input } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LockOutlined, MenuOutlined, SearchOutlined } from "@ant-design/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import GlobalFooter from "@/components/layout/global-footer";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { getAdminNavigationItems, type AdminNavigationItem } from "./admin-menu-config";
import { getCurrentTenant } from "@/lib/tenant";
import { themeColors as colors } from "@/styles/theme";

interface NavGroup {
  label: string;
  paths: string[];
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [navSearch, setNavSearch] = useState("");
  const { isMobile } = useResponsive();
  const { user, refreshCurrentUser } = useAuth();
  const editPermission = useEditPermission();
  const branding = useBranding();
  const currentTenant = getCurrentTenant();
  usePageTitle();

  // 挂载时刷新当前用户，使已登录管理员能立即感知编辑权限（无需重新登录）
  useEffect(() => {
    refreshCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuperAdmin = user?.role === "super_admin";
  const menuData = useMemo(() => getAdminNavigationItems(user?.role), [user?.role]);

  // 切换路由时自动关闭移动端抽屉
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // 参照交互原型的分组结构
  const groupDefs = useMemo<NavGroup[]>(
    () => [
      { label: isSuperAdmin ? "平台总览" : "工作空间", paths: ["/admin/dashboard"] },
      {
        label: "平台运营",
        paths: [
          "/admin/dashboard/organizations",
          "/admin/dashboard/api-key-config",
          "/admin/dashboard/site-content",
          "/admin/dashboard/portal-config",
          "/admin/dashboard/course-categories",
          "/admin/dashboard/smart-portal",
          "/admin/dashboard/data-insight",
          "/admin/dashboard/branding",
        ],
      },
      {
        label: "组织与用户",
        paths: [
          "/admin/dashboard/admins",
          "/admin/dashboard/teachers",
          "/admin/dashboard/students",
          "/admin/dashboard/classes",
          "/admin/dashboard/groups",
        ],
      },
      {
        label: "系统治理",
        paths: [
          "/admin/dashboard/permissions",
          "/admin/dashboard/system",
          "/admin/dashboard/logs",
        ],
      },
    ],
    [isSuperAdmin]
  );

  const navGroups = useMemo(() => {
    const byPath = new Map(menuData.map((m) => [m.path, m]));
    return groupDefs
      .map((g) => ({
        label: g.label,
        items: g.paths
          .map((p) => byPath.get(p))
          .filter((x): x is AdminNavigationItem => Boolean(x)),
      }))
      .filter((g) => g.items.length > 0);
  }, [groupDefs, menuData]);

  const visibleGroups = useMemo(() => {
    const kw = navSearch.trim().toLowerCase();
    if (!kw) return navGroups;
    return navGroups
      .map((g) => ({
        ...g,
        items: g.items.filter((it) => it.name.toLowerCase().includes(kw)),
      }))
      .filter((g) => g.items.length > 0);
  }, [navGroups, navSearch]);

  const isActive = (path: string) => {
    if (path === "/admin/dashboard") {
      return location.pathname === "/admin/dashboard" || location.pathname === "/admin/dashboard/";
    }
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  const renderNav = () => (
    <aside className="pu-aside">
      <div className="pu-scope">
        <small>{isSuperAdmin ? "平台管理" : "当前机构"}</small>
        <b title={isSuperAdmin ? "全平台" : currentTenant?.name || currentTenant?.schemaName || "未选择机构"}>
          {isSuperAdmin ? "全平台" : currentTenant?.name || currentTenant?.schemaName || "未选择机构"}
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

      {visibleGroups.map((group) => (
        <div key={group.label}>
          <div className="pu-nav-group">{group.label}</div>
          {group.items.map((item) => (
            <button
              key={item.path}
              type="button"
              className={`pu-nav-link${isActive(item.path) ? " active" : ""}`}
              onClick={() => {
                navigate(item.path);
                setMobileDrawerOpen(false);
              }}
            >
              <span className="pu-nav-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
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
        className="admin-layout-header"
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
          }}
        >
          <div
            className="admin-layout-brand"
            style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 12 }}
            onClick={() => navigate("/admin/dashboard")}
          >
            <img
              className="admin-layout-brand-logo"
              src={branding.logo_dark}
              alt={branding.app_name}
              style={{ height: isMobile ? 36 : 44, objectFit: "contain" }}
            />
            <span
              className="admin-layout-brand-text"
              style={{
                fontSize: 19,
                fontWeight: 700,
                fontFamily: "'Manrope', sans-serif",
                color: colors.textPrimary,
                letterSpacing: "-0.01em",
                whiteSpace: "nowrap",
              }}
            >
              {branding.app_title} · 管理平台
            </span>
          </div>
          <div
            className="admin-layout-actions"
            style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 12 }}
          >
            {!isMobile && <NotificationBell />}
            {!isMobile && <UserManualModal role="admin" />}
            <UserMenu role="admin" compact />
            {isMobile && (
              <div
                className="admin-layout-hamburger"
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileDrawerOpen(true);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#F3F4F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: colors.textPrimary,
                  transition: "background 0.2s",
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
        title={
          <span style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>管理导航</span>
        }
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width="76vw"
        styles={{ body: { padding: 0 } }}
      >
        {renderNav()}
      </Drawer>
    </div>
  );
}
