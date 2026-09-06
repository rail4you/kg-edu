import { Button } from "antd";
import { CloseOutlined, HomeOutlined, BookOutlined, ApartmentOutlined, FolderOpenOutlined, LinkOutlined, RightOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useBranding } from "@/hooks/use-branding";

export interface MobileNavItem {
  key: string;
  label: string;
}

export interface MobileFullMenuProps {
  open: boolean;
  onClose: () => void;
  items: MobileNavItem[];
  activeKey?: string;
  /** Eyebrow text above the nav list */
  sectionTitle?: string;
  /** Optional auth buttons (when not logged in) */
  authActions?: { label: string; primary?: boolean }[];
  /** Click handler — receives the item key, defaults to navigate(item.key) */
  onSelect?: (key: string) => void;
}

/**
 * 全屏式移动端菜单（替代 Antd Drawer 的右侧抽屉）：
 * - 半透明遮罩 + 右滑入面板
 * - 大尺寸点击热区，符合移动端 UX
 * - 撑满整个视口，避免抽屉过窄
 */
export function MobileFullMenu({
  open,
  onClose,
  items,
  activeKey,
  sectionTitle = "导航",
  authActions,
  onSelect,
}: MobileFullMenuProps) {
  const navigate = useNavigate();
  const branding = useBranding();

  const iconMap: Record<string, React.ReactNode> = {
    "/": <HomeOutlined />,
    "/courses": <BookOutlined />,
    "/micro-majors": <ApartmentOutlined />,
    "/resources": <FolderOpenOutlined />,
  };

  const getIcon = (key: string): React.ReactNode => {
    return iconMap[key] || <LinkOutlined />;
  };

  const handleSelect = (key: string) => {
    onClose();
    if (onSelect) {
      onSelect(key);
    } else {
      navigate(key);
    }
  };

  return (
    <div
      className={`mobile-full-menu ${open ? "is-open" : ""}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mobile-full-menu__panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mobile-full-menu__header">
          <div className="mobile-full-menu__brand">
            <img src={branding.logo_dark} alt={branding.app_name} className="mobile-full-menu__logo" />
            <span className="mobile-full-menu__app-name">{branding.app_title}</span>
          </div>
          <Button
            type="text"
            icon={<CloseOutlined />}
            className="mobile-full-menu__close"
            onClick={onClose}
            aria-label="关闭菜单"
          />
        </div>
        <div className="mobile-full-menu__section">
          <div className="mobile-full-menu__eyebrow">{sectionTitle}</div>
          <div className="mobile-full-menu__nav">
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`mobile-full-menu__nav-item ${activeKey === item.key ? "is-active" : ""}`}
                onClick={() => handleSelect(item.key)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="mobile-full-menu__nav-icon">{getIcon(item.key)}</span>
                  <span>{item.label}</span>
                </span>
                <RightOutlined />
              </button>
            ))}
          </div>
        </div>
        {authActions && authActions.length > 0 && (
          <div className="mobile-full-menu__auth">
            {authActions.map((a) => (
              <Button
                key={a.label}
                block
                size="large"
                type={a.primary ? "primary" : "default"}
                onClick={() => {
                  onClose();
                  navigate("/login");
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MobileFullMenu;
