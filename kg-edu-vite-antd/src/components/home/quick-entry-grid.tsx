import { useNavigate } from "react-router-dom";
import { Grid } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import { usePortalNavItems } from "@/hooks/use-portal-config";
import { getQuickNavIconSrc } from "./quick-nav-icons";

/**
 * 首页快速入口（参考站风格：一行 4 个，超出换行，动态全显示）
 * - 桌面端专属（< 1024px 隐藏）
 * - hover 上浮 + 阴影
 * - 嵌入 .xyedu-portal-main__left 容器内
 * - 图标使用预置 SVG（public/icons/home/），管理端可在模板页管理中更换
 */
function EntryImg({ src, label }: { src: string; label: string }) {
  return <img src={src} alt={label} className="xyedu-quick-entry__img" draggable={false} />;
}

// 参考站风格：图标本身彩色、无底色
const ENTRY_COLORS = ["#2f7cf6", "#22a06b", "#2f7cf6", "#f59e0b", "#f59e0b", "#2f7cf6", "#22a06b", "#2f7cf6"];

export default function QuickEntryGrid() {
  const navigate = useNavigate();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;
  const navItems = usePortalNavItems();

  if (isMobile) {
    return null;
  }

  // 一行 4 个，多出换行：全部入口都显示（2 固定 + 动态模板页，hook 侧总数上限 8）
  const entries = navItems;

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
              <EntryImg src={getQuickNavIconSrc(item.key, item.icon)} label={item.label} />
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
