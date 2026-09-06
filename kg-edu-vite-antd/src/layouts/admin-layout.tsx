import { useState, useMemo, useEffect } from "react";
import { Alert, Layout, Menu, Drawer } from "antd";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { LockOutlined, MenuOutlined } from "@ant-design/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { UserManualModal } from "@/components/layout/user-manual-modal";
import GlobalFooter from "@/components/layout/global-footer";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { getAdminNavigationItems } from "./admin-menu-config";
import { themeColors as colors } from "@/styles/theme";

const { Sider, Content } = Layout;

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const { isMobile } = useResponsive();
  const { user, refreshCurrentUser } = useAuth();
  const editPermission = useEditPermission();
  const branding = useBranding();
  usePageTitle();

  // 挂载时刷新当前用户，使已登录管理员能立即感知编辑权限（无需重新登录）
  useEffect(() => {
    refreshCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const menuData = useMemo(() => getAdminNavigationItems(user?.role), [user?.role]);

  // 切换路由时自动关闭移动端抽屉
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // 注入响应式样式
  useEffect(() => {
    const styleId = "admin-layout-responsive";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      /* 桌面端隐藏汉堡菜单 */
      .admin-layout-hamburger {
        display: none;
      }

      /* 移动端表格宽度自适应 */
      .ant-table-wrapper {
        width: 100%;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      /* 移动端：隐藏桌面侧栏 */
      @media (max-width: 768px) {
        .admin-layout-desktop-sider {
          display: none !important;
        }
      }

      /* 移动端页面内边距调整 */
      @media (max-width: 768px) {
        .admin-layout-header {
          padding: 0 16px !important;
          height: 54px !important;
        }
        .admin-layout-brand {
          gap: 8px !important;
        }
        .admin-layout-brand-logo {
          height: 36px !important;
        }
        .admin-layout-brand-text {
          font-size: 15px !important;
        }
        .admin-layout-actions {
          gap: 6px !important;
        }
        .admin-layout-hamburger {
          display: inline-flex !important;
        }
      }

      @media (max-width: 480px) {
        .admin-layout-header {
          padding: 0 10px !important;
          height: 50px !important;
        }
        .admin-layout-brand {
          gap: 6px !important;
        }
        .admin-layout-brand-logo {
          height: 32px !important;
        }
        .admin-layout-brand-text {
          display: none !important;
        }
        .admin-layout-actions {
          gap: 4px !important;
        }
      }


    `;
    return () => {
      style.remove();
    };
  }, []);

  // 当前选中的菜单 key
  const selectedKey =
    menuData.find((m) => location.pathname === m.path)?.path || location.pathname;

  const renderMenu = () => (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      style={{
        borderRight: 0,
        background: "transparent",
      }}
      items={menuData.map((item) => ({
        key: item.path,
        icon: item.icon,
        label: item.name,
      }))}
      onClick={({ key }) => {
        navigate(key as string);
        setMobileDrawerOpen(false);
      }}
    />
  );

  // 卡片式菜单分组
  const menuGroups = useMemo(() => {
    const groups: { label: string; items: typeof menuData }[] = [];
    const overviewItems = menuData.filter((m) => m.path === "/admin/dashboard");
    const managementItems = menuData.filter(
      (m) =>
        m.path.includes("/admins") ||
        m.path.includes("/teachers") ||
        m.path.includes("/students") ||
        m.path.includes("/classes") ||
        m.path.includes("/groups")
    );
    const systemItems = menuData.filter(
      (m) =>
        m.path.includes("/permissions") ||
        m.path.includes("/system") ||
        m.path.includes("/logs")
    );
    const configItems = menuData.filter(
      (m) => m.path.includes("/organizations") || m.path.includes("/api-key")
    );

    if (overviewItems.length > 0) {
      groups.push({ label: "概览", items: overviewItems });
    }
    if (configItems.length > 0) {
      groups.push({ label: "配置", items: configItems });
    }
    if (managementItems.length > 0) {
      groups.push({ label: "管理", items: managementItems });
    }
    if (systemItems.length > 0) {
      groups.push({ label: "系统", items: systemItems });
    }
    return groups;
  }, [menuData]);

  const renderDrawerMenu = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {menuGroups.map((group) => (
        <div
          key={group.label}
          style={{
            borderRadius: 10,
            background: "#FFFFFF",
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <div
            style={{
              padding: "10px 12px 2px",
              fontSize: 10,
              fontWeight: 700,
              color: "#999",
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
            }}
          >
            {group.label}
          </div>
          <div style={{ padding: "2px 6px 6px" }}>
            {group.items.map((item) => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    navigate(item.path);
                    setMobileDrawerOpen(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: active ? `${colors.primary}10` : "transparent",
                    color: active ? colors.primary : "#333",
                    cursor: "pointer",
                    textAlign: "left" as const,
                    transition: "all 0.12s",
                    marginBottom: 2,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 7,
                      background: active ? colors.primary : "#F3F4F5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "background 0.12s",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        color: active ? "#fff" : "#757780",
                        lineHeight: 1,
                      }}
                    >
                      {item.icon}
                    </span>
                  </div>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                    }}
                  >
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* 全宽顶部栏 */}
      <div
        className="admin-layout-header"
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
          className="admin-layout-brand"
          style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: 12 }}
          onClick={() => navigate("/admin/dashboard")}
        >

          <img
            className="admin-layout-brand-logo"
            src={branding.logo_dark}
            alt={branding.app_name}
            style={{ height: 44, objectFit: "contain" }}
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
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <NotificationBell />
          <UserManualModal role="admin" />
          <UserMenu role="admin" compact />
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
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: colors.textPrimary,
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "#E7E8E9";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = "#F3F4F6";
            }}
          >
            <MenuOutlined style={{ fontSize: 16 }} />
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

      {/* 桌面端布局：使用 Layout + Sider + Menu */}
      {!isMobile && (
        <Layout style={{ flex: 1, minHeight: 0, background: "#fff" }}>
          <Sider
            className="admin-sider admin-layout-desktop-sider"
            width={232}
            collapsedWidth={64}
            collapsible
            collapsed={collapsed}
            onCollapse={setCollapsed}
            trigger={null}
            style={{
              background: "#fff",
              borderRight: "1px solid #f0f0f0",
              overflow: "auto",
            }}
          >
            {renderMenu()}
          </Sider>
          <Content
            style={{
              padding: 0,
              background: "#f5f5f5",
              overflow: "auto",
            }}
          >
            <Outlet />
          </Content>
        </Layout>
      )}

      {/* 移动端布局：内容直出，侧栏入抽屉 */}
      {isMobile && (
        <>
          <div style={{ flex: 1, padding: 12, overflow: "auto", minHeight: 0 }}>
            <Outlet />
          </div>
          <Drawer
            placement="right"
            open={mobileDrawerOpen}
            onClose={() => setMobileDrawerOpen(false)}
            width="72vw"
            styles={{ body: { padding: 10, background: "#F0F2F5" } }}
          >
            {renderDrawerMenu()}
          </Drawer>
        </>
      )}
      <GlobalFooter />
    </div>
  );
}