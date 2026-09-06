import { useNavigate } from "react-router-dom";
import { Grid } from "antd";
import {
  BankOutlined,
  RightOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import type { SubjectCategoryAccent } from "@/lib/subject-category-grouping";
import type { CatalogCourse } from "@/hooks/use-course-catalog";
import { buildSubjectCategoryPanels } from "@/lib/subject-category-grouping";

interface SubjectCategoryPanelsProps {
  courses: CatalogCourse[];
  /** 门户配置中的动态层级名称，按 SubjectCategoryKey 覆盖默认标题 */
  titleOverrides?: Record<string, { title: string; subtitle: string }>;
}

/** 4 个面板标题对应的图标（设计稿 SVG，带背景底色，public/icons/home/） */
const PANEL_ICON_SRC: Record<string, { src: string; label: string }> = {
  graduate: { src: "/icons/home/postgraduate.svg", label: "研究生" },
  undergraduate: { src: "/icons/home/undergraduate.svg", label: "本科" },
  "higher-vocational": { src: "/icons/home/higher_vocational.svg", label: "高职" },
  "secondary-vocational": { src: "/icons/home/secondary_vocational.svg", label: "中职" },
};

const ACCENT_COLOR: Record<SubjectCategoryAccent, { icon: string; more: string }> = {
  blue: { icon: "#1677FF", more: "#1677FF" },
  green: { icon: "#16B67F", more: "#16B67F" },
  purple: { icon: "#7B61FF", more: "#7B61FF" },
  orange: { icon: "#FF8A3D", more: "#FF8A3D" },
};

const PLACEHOLDER_ICONS = [<BankOutlined key="bank" />, <TrophyOutlined key="trophy" />];

/**
 * 首页 4 个学科分类面板（学银在线风格 2×2 网格）
 * - 桌面端专属（< 1024px 隐藏）
 * - 每个面板只显示 count > 0 的学科，按 count 倒序取前 6 个
 * - chip 单行横向布局 + 查看更多
 * - 面板始终显示，空时显示"暂无开课"
 */
export default function SubjectCategoryPanels({ courses, titleOverrides }: SubjectCategoryPanelsProps) {
  const navigate = useNavigate();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;

  if (isMobile) {
    return null;
  }

  const panels = buildSubjectCategoryPanels(courses, titleOverrides);

  return (
    <>
      {panels.map((panel, panelIdx) => {
        const iconSrc = PANEL_ICON_SRC[panel.config.key];
        const icon = iconSrc ? (
          <img
            src={iconSrc.src}
            alt={iconSrc.label}
            className="xyedu-subject-panel__img"
            draggable={false}
          />
        ) : (
          PLACEHOLDER_ICONS[panelIdx % PLACEHOLDER_ICONS.length]
        );
        return (
          <div
            key={panel.config.key}
            className={`xyedu-subject-panel xyedu-subject-panel--${panel.config.accent}`}
            style={{ "--accent-color": ACCENT_COLOR[panel.config.accent].icon } as React.CSSProperties}
          >
            <button
              type="button"
              className="xyedu-subject-panel__header"
              onClick={() => navigate(`/courses?level=${panel.config.key}`)}
            >
              <span className="xyedu-subject-panel__icon">{icon}</span>
              <h3 className="xyedu-subject-panel__title">{panel.config.title}</h3>
              <RightOutlined className="xyedu-subject-panel__more" />
            </button>

            <div className="xyedu-subject-panel__chips">
              {panel.subjects.map((subject) => {
                const isEmpty = subject.count === 0;
                return (
                  <button
                    key={subject.code}
                    type="button"
                    className={`xyedu-subject-panel__chip ${isEmpty ? "is-empty" : ""}`}
                    disabled={isEmpty}
                    aria-disabled={isEmpty}
                    title={isEmpty ? "该学科暂无开课" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isEmpty) return;
                      navigate(`/courses?subject=${subject.code}`);
                    }}
                  >
                    {subject.name}
                    {!isEmpty && (
                      <span className="xyedu-subject-panel__count">{subject.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}