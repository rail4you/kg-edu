import { useNavigate } from "react-router-dom";

/**
 * 首页移动端推广 Banner（仿人卫慕课风格）。
 *
 * 仅在 ≤768px 显示，桌面端通过 CSS `display: none` 隐藏。
 * 文案为平台通用文案，不绑定特定营销信息。
 */
export default function MobilePromoBanner() {
  const navigate = useNavigate();
  const pills = ["AI 智慧课程", "智能学习路径", "高效班级管理"];

  return (
    <aside className="mobile-promo-banner">
      <div className="mobile-promo-banner__gradient">
        <div className="mobile-promo-banner__pills">
          {pills.map((pill) => (
            <span className="mobile-promo-banner__pill" key={pill}>
              {pill}
            </span>
          ))}
        </div>

        <h2 className="mobile-promo-banner__title">精品在线课程资源库</h2>
        <p className="mobile-promo-banner__subtitle">AI 赋能 · 全学科覆盖 · 学习更高效</p>

        <button
          type="button"
          className="mobile-promo-banner__cta"
          onClick={() => navigate("/courses")}
        >
          浏览课程 →
        </button>
      </div>
    </aside>
  );
}