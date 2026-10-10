import { useState } from "react";
import { Button, ConfigProvider, Grid, Layout } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileFullMenu } from "@/components/layout/mobile-full-menu";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems } from "@/hooks/use-portal-config";
import { themeColors } from "@/styles/theme";

const { Header } = Layout;

interface PortalHeaderProps {
  /** 当前高亮的导航项路径 */
  activeKey: string;
  /** 移动端全屏菜单标题 */
  sectionTitle?: string;
}

/**
 * 门户公共顶栏 —— 首页 / 课程 / 微专业 / 模板页 统一使用。
 * 白底、品牌 + 动态导航 + 登录/用户菜单，移动端收进全屏菜单。
 */
export default function PortalHeader({ activeKey, sectionTitle }: PortalHeaderProps) {
  const navigate = useNavigate();
  const branding = useBranding();
  const { authenticated, user } = useAuth();
  const navItems = usePortalNavItems();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <ConfigProvider wave={{ disabled: true }}>
      <Header className="home-header ed-top">
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <img src={branding.logo_dark} alt={branding.app_name} className="home-brand__logo" />
              <div className="home-brand__title">{branding.app_title}</div>
            </div>
            {!isMobile && (
              <div className="home-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    type="text"
                    className={`home-nav__button ${item.key === activeKey ? "is-active" : ""}`}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="home-header__actions">
            {isMobile ? (
              <>
                {authenticated && user && <UserMenu role="student" variant="header" />}
                <Button
                  type="text"
                  icon={<MenuOutlined style={{ fontSize: 18, color: themeColors.textPrimary }} />}
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="打开菜单"
                />
              </>
            ) : authenticated && user ? (
              <UserMenu role="student" variant="header" />
            ) : (
              <Button className="home-login-button" onClick={() => navigate("/login")}>
                登录
              </Button>
            )}
          </div>
        </div>
      </Header>

      <MobileFullMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={navItems}
        activeKey={activeKey}
        sectionTitle={sectionTitle}
        authActions={
          !authenticated
            ? [{ label: "登录" }]
            : undefined
        }
      />
    </ConfigProvider>
  );
}
