import { useNavigate } from "react-router-dom";
import { Grid } from "antd";
import {
  AppstoreOutlined,
  TeamOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { usePortalNavItems } from "@/hooks/use-portal-config";

/**
 * 首页 6 个快速入口（学银在线风格 3×2 网格）
 * - 桌面端专属（< 1024px 隐藏）
 * - hover 上浮 + 阴影
 * - 嵌入 .xyedu-portal-main__left 容器内
 * - 图标使用设计稿 SVG（无背景底色版本，public/icons/home/）
 */
const NAV_ICON_SRC: Record<string, string> = {
  "/courses": "/icons/home/course.svg",
  "/micro-majors": "/icons/home/micro_major.svg",
  "/page/resources": "/icons/home/resource_library.svg",
  "/page/demo": "/icons/home/demo_package.svg",
  "/page/textbook": "/icons/home/digital_textbook.svg",
  "/page/about": "/icons/home/about_us.svg",
  "/page/partners": "/icons/home/about_us.svg",
  "/page/partners-college": "/icons/home/about_us.svg",
};

function EntryImg({ src, label }: { src: string; label: string }) {
  return <img src={src} alt={label} className="xyedu-quick-entry__img" draggable={false} />;
}

// 参考站风格：图标本身彩色、无底色
const ENTRY_COLORS = ["#2f7cf6", "#22a06b", "#2f7cf6", "#f59e0b", "#f59e0b", "#2f7cf6", "#22a06b", "#2f7cf6"];

function getEntryIcon(key: string, label: string): React.ReactNode {
  if (NAV_ICON_SRC[key]) return <EntryImg src={NAV_ICON_SRC[key]} label={label} />;
  // 动态模板页按 slug 匹配
  if (key.includes("about")) return <EntryImg src="/icons/home/about_us.svg" label={label} />;
  if (key.includes("partner")) return <TeamOutlined />;
  if (key.includes("resource")) return <EntryImg src="/icons/home/resource_library.svg" label={label} />;
  if (key.includes("textbook")) return <EntryImg src="/icons/home/digital_textbook.svg" label={label} />;
  if (key.includes("demo")) return <EntryImg src="/icons/home/demo_package.svg" label={label} />;
  return <ApartmentOutlined />;
}

export default function QuickEntryGrid() {
  const navigate = useNavigate();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;
  const navItems = usePortalNavItems();

  if (isMobile) {
    return null;
  }

  // 快捷导航与顶部智慧导航一致：2 固定 + 4 动态 = 6 上限
  const entries = navItems.slice(0, 6);

  return (
    <section className="xyedu-quick-entry">
      <div className="xyedu-quick-entry__grid">
        {entries.map((item, idx) => (
          <button
            key={item.key}
            type="button"
            className="xyedu-quick-entry__card"
            style={{ "--entry-color": ENTRY_COLORS[idx % ENTRY_COLORS.length] } as React.CSSProperties}
            onClick={() => navigate(item.key)}
            aria-label={item.label}
          >
            <div
              className="xyedu-quick-entry__icon"
              aria-hidden="true"
            >
              {getEntryIcon(item.key, item.label)}
            </div>
            <div className="xyedu-quick-entry__text">
              <div className="xyedu-quick-entry__label">{item.label}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/**
 * 左侧栏顶部标题组件（学银在线风格：图标 + "快捷导航"）
 * 与 QuickEntryGrid 配合使用
 */
export function QuickEntryHeader() {
  return (
    <div className="xyedu-portal-main__left-header">
      <span className="xyedu-portal-main__left-icon">
        <AppstoreOutlined />
      </span>
      <h3 className="xyedu-portal-main__left-title">快捷导航</h3>
    </div>
  );
}