import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button, Grid } from "antd";
import { ProLayout } from "@ant-design/pro-components";
import {
  ApartmentOutlined,
  BookOutlined,
  TeamOutlined,
  ArrowLeftOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FileOutlined,
  ReadOutlined,
  DashboardOutlined,
  EditOutlined,
  FilePdfOutlined,
  MenuOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileFullMenu } from "@/components/layout/mobile-full-menu";
import { useAuth } from "@/auth/auth-context";
import { themeColors as colors } from "@/styles/theme";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import type { MenuDataItem } from "@ant-design/pro-components";

// ✅ Static menu — all items always have fixed routes, no dynamic path computation
// Each page handles its own context via URL search params internally
const MENU_ITEMS: MenuDataItem[] = [
  {
    key: "mm-group", name: "微专业管理", icon: <DashboardOutlined />,
    children: [
      { key: "dashboard", path: "/micro-major/dashboard", name: "微专业管理" },
      { key: "student-management", path: "/micro-major/student-management", name: "微专业学生管理", icon: <TeamOutlined /> },
      { key: "certificates", path: "/micro-major/certificates", name: "证书模板", icon: <FilePdfOutlined /> },
    ],
  },
  {
    key: "course-group", name: "课程管理", icon: <ReadOutlined />,
    children: [
      { key: "courses", path: "/micro-major/courses", name: "课程管理" },
      { key: "chapters", path: "/micro-major/chapters", name: "章节管理" },
      { key: "chapter-content", path: "/micro-major/chapter-content", name: "章节内容关联" },
    ],
  },
  {
    key: "resource-group", name: "课程资源管理", icon: <FileOutlined />,
    children: [
      { key: "videos", path: "/micro-major/videos", name: "视频管理" },
      { key: "exercises", path: "/micro-major/exercises", name: "习题管理" },
      { key: "resources", path: "/micro-major/resources", name: "资源管理" },
      { key: "homework", path: "/micro-major/homework", name: "作业管理" },
    ],
  },
  {
    key: "analytics-group", name: "分析统计", icon: <ApartmentOutlined />,
    children: [
      { key: "analytics", path: "/micro-major/analytics", name: "微专业学习分析" },
    ],
  },
  { key: "home", path: "/teacher/module-home", name: "返回首页", icon: <ArrowLeftOutlined /> },
];

export default function MicroMajorLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const branding = useBranding();
  usePageTitle();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;

  const [collapsed, setCollapsed] = useState(isMobile);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const ALL_KEYS = ["mm-group", "course-group", "resource-group", "analytics-group"];
  const [openKeys, setOpenKeys] = useState<string[]>(ALL_KEYS);

  // 保持所有菜单始终展开
  const handleOpenChange = (keys: string[]) => {
    // 如果某个菜单被关闭了，重新打开它（保持全部展开）
    const allOpen = ALL_KEYS.every(k => keys.includes(k));
    if (!allOpen) {
      setOpenKeys(ALL_KEYS);
    } else {
      setOpenKeys(keys);
    }
  };

  // Fix sider position
  useEffect(() => {
    const styleId = "mm-layout-sider-fix";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      .ant-pro-layout .ant-layout-sider {
        top: ${isMobile ? 50 : 56}px !important;
        height: calc(100vh - ${isMobile ? 50 : 56}px) !important;
      }
      .ant-pro-layout .ant-layout-sider .ant-layout-sider-children {
        height: calc(100vh - ${isMobile ? 50 : 56}px) !important;
      }
    `;
    return () => {
      style.remove();
    };
  }, []);

  return (
    <div className="mm-layout" style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <style>{`
@media(max-width:768px){
.mm-layout .mm-topbar{padding:0 12px!important;height:50px!important}
.mm-layout .mm-brand-text{display:none!important}
.mm-layout .mm-topbar-title{font-size:14px!important}
.mm-layout .mm-logo{height:36px!important}
.mm-layout .teacher-page-back-btn{display:none!important}
}
@media(min-width:769px){
.mm-layout .mm-mobile-menu-btn{display:none!important}
}
`}</style>
      {/* Top bar */}
      <div
        className="mm-topbar"
        style={{
          height: isMobile ? 50 : 60,
          flexShrink: 0,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 12px" : "0 40px",
          zIndex: 1000,
          position: "relative",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            gap: isMobile ? 6 : 8,
            minWidth: 0,
            flex: 1,
          }}
          onClick={() => navigate("/teacher/module-home")}
        >
          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={(e) => { e.stopPropagation(); navigate("/teacher/module-home"); }}
            style={{ color: "#722ed1", padding: "4px 8px", fontSize: isMobile ? 14 : 16, flexShrink: 0 }}
          />
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
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 12, flexShrink: 0 }}>
          <Button
              type="text"
              icon={<UserOutlined style={{ fontSize: 16, color: colors.textPrimary }} />}
              onClick={() => navigate("/teacher/profile")}
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
        items={[
          { key: "/teacher/module-home", label: "返回首页" },
          { key: "/micro-major/dashboard", label: "微专业管理" },
          { key: "/micro-major/student-management", label: "微专业学生管理" },
          { key: "/micro-major/certificates", label: "证书模板" },
          { key: "/micro-major/courses", label: "课程管理" },
          { key: "/micro-major/chapters", label: "章节管理" },
          { key: "/micro-major/chapter-content", label: "章节内容关联" },
          { key: "/micro-major/videos", label: "视频管理" },
          { key: "/micro-major/exercises", label: "习题管理" },
          { key: "/micro-major/resources", label: "资源管理" },
          { key: "/micro-major/homework", label: "作业管理" },
          { key: "/micro-major/analytics", label: "学习分析" },
        ]}
        activeKey={location.pathname}
        sectionTitle="微专业管理"
      />

      {/* Main content with sidebar */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <ProLayout
          title={false}
          logo={false}
          layout="side"
          collapsed={collapsed}
          onCollapse={setCollapsed}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          location={{ pathname: location.pathname }}
          route={{ path: "/", routes: MENU_ITEMS }}
          menuItemRender={(item, dom) => (
            <div
              onClick={() => {
                if (item.path) navigate(item.path);
              }}
              style={{ cursor: "pointer" }}
            >
              {dom}
            </div>
          )}
          headerRender={false}
          menuHeaderRender={() => (
            <div style={{ padding: "12px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#722ed1" }}>
                <ApartmentOutlined style={{ marginRight: 6 }} />
                微专业导航
              </div>
            </div>
          )}
          token={{
            sider: {
              colorMenuBackground: "#fff",
              colorTextMenu: "#333",
              colorTextMenuActive: "#722ed1",
              colorTextMenuSelected: "#722ed1",
            },
          }}
          fixSiderbar
          style={{ height: "100%" }}
          contentStyle={{ padding: 0, height: "100%", overflow: "auto" }}
          footerRender={false}
        >
          <Outlet />
        </ProLayout>
      </div>
    </div>
  );
}
